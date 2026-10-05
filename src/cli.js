#!/usr/bin/env node
import process from 'node:process';
import { load, save, dataFile, taskMinutes, runningMinutes } from './store.js';
import {
  ChronoError,
  addTask,
  completeTask,
  findTaskByQuery,
  listTasks,
  recentSessions,
  removeTask,
  reopenTask,
  runningTask,
  start,
  stop,
} from './logic.js';
import { summary, topTasks } from './stats.js';
import { bar, c, heading, kv, sessionLine, taskLine, weekdayShort } from './format.js';
import { dayKey, humanMinutes } from './dates.js';

const HELP = `
${c.bold('chrono')} ${c.gray('- suivi du temps et des taches, 100% local')}

${c.bold('USAGE')}
  chrono <commande> [arguments]

${c.bold('TACHES')}
  add <titre>              Cree une tache
  ls [todo|done|all]       Liste les taches (defaut: todo)
  done <id|titre>          Marque une tache comme terminee
  reopen <id|titre>        Remet une tache en cours
  rm <id|titre>            Supprime une tache

${c.bold('SESSION')}
  start [id|titre]         Demarre une session de concentration
  stop                     Arrete la session en cours et l'enregistre
  status                   Affiche l'etat courant

${c.bold('ANALYSE')}
  stats [--days N]         Resume + graphique des N derniers jours
  today                    Detail de la journee en cours
  log [--limit N]          Historique des sessions

${c.bold('OPTIONS')}
  -h, --help               Cette aide
  -v, --version            Version
      --json               Sortie JSON brute (pour scripts)
      --no-color           Desactive les couleurs

${c.gray(`Donnees : ${dataFile()}`)}
`;

function parseArgs(argv) {
  const args = [...argv];
  const flags = { json: false, help: false, version: false, days: 7, limit: 10 };
  const positional = [];

  while (args.length > 0) {
    const arg = args.shift();
    switch (arg) {
      case '-h':
      case '--help':
        flags.help = true;
        break;
      case '-v':
      case '--version':
        flags.version = true;
        break;
      case '--json':
        flags.json = true;
        break;
      case '--no-color':
        process.env.NO_COLOR = '1';
        break;
      case '--days':
        flags.days = clamp(Number(args.shift()), 1, 90, 7);
        break;
      case '--limit':
        flags.limit = clamp(Number(args.shift()), 1, 200, 10);
        break;
      default:
        if (arg.startsWith('--days=')) flags.days = clamp(Number(arg.slice(7)), 1, 90, 7);
        else if (arg.startsWith('--limit=')) flags.limit = clamp(Number(arg.slice(8)), 1, 200, 10);
        else if (arg.startsWith('-')) throw new ChronoError(`Option inconnue : ${arg}`);
        else positional.push(arg);
    }
  }
  return { flags, positional };
}

function clamp(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function out(text = '') {
  process.stdout.write(`${text}\n`);
}

function cmdAdd(data, positional, now) {
  const title = positional.join(' ').trim();
  const { task, created } = addTask(data, title, now);
  out(created ? `${c.green('+')} Tache ${c.bold(`#${task.id}`)} : ${task.title}` : `${c.yellow('=')} Deja listee : ${c.bold(`#${task.id}`)} ${task.title}`);
}

function cmdList(data, positional, flags, now) {
  const wanted = positional[0];
  const status = wanted === 'all' || wanted === 'done' || wanted === 'todo' ? wanted : 'todo';
  const tasks = listTasks(data, status);
  if (tasks.length === 0) {
    out(c.gray('Aucune tache. Lancez : chrono add "ecrire le rapport"'));
    return;
  }
  const running = data.running?.taskId ?? null;
  const sorted = [...tasks].sort((a, b) => {
    if (a.id === running) return -1;
    if (b.id === running) return 1;
    if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
    return a.id - b.id;
  });
  out(heading(`Taches (${sorted.length})`));
  for (const task of sorted) {
    out(`  ${taskLine(task, taskMinutes(data, task.id), task.id === running)}`);
  }
  if (data.running) out(c.gray(`\n  Session en cours : ${humanMinutes(runningMinutes(data, now))}`));
}

function cmdStart(data, positional, now) {
  const query = positional.join(' ').trim();
  const { task, closed } = start(data, query === '' ? null : findTaskByQuery(data, query).id, now);
  if (closed && closed.minutes > 0) {
    out(`${c.gray('Session precedente enregistree :')} ${humanMinutes(closed.minutes)}`);
  }
  out(`${c.green('▶')} Session demarree${task ? ` sur ${c.bold(`#${task.id}`)} ${task.title}` : ''}`);
}

function cmdStop(data, now) {
  const task = runningTask(data);
  if (!data.running) throw new ChronoError('Aucune session en cours (lancez : chrono start).');
  const session = stop(data, now, { force: true });
  const title = task ? task.title : null;
  if (!session) {
    out(`${c.yellow('!')} Session fermee sans minutes comptees (duree < 1 min).`);
    return;
  }
  out(`${c.green('✔')} ${humanMinutes(session.minutes)} ${title ? `sur ${c.bold(title)}` : ''}`);
}

function cmdDone(data, positional, now) {
  const task = findTaskByQuery(data, positional.join(' '));
  const { changed } = completeTask(data, task.id, now);
  out(changed ? `${c.green('✔')} Terminee : ${task.title}` : `${c.yellow('=')} Deja terminee : ${task.title}`);
}

function cmdReopen(data, positional) {
  const task = reopenTask(data, findTaskByQuery(data, positional.join(' ')).id);
  out(`${c.blue('↺')} Reouverte : ${task.title}`);
}

function cmdRemove(data, positional) {
  const task = removeTask(data, findTaskByQuery(data, positional.join(' ')).id);
  out(`${c.red('-')} Supprimee : ${task.title}`);
}

function cmdStatus(data, flags, now) {
  if (flags.json) return void out(JSON.stringify(statusPayload(data, now), null, 2));
  out('');
  if (data.running) {
    const task = runningTask(data);
    out(kv('En cours', `${c.yellow('▶')} ${humanMinutes(runningMinutes(data, now))}`));
    out(kv('Tache', task ? `${c.bold(`#${task.id}`)} ${task.title}` : c.gray('(aucune)')));
    out(kv('Debut', new Date(data.running.startedAt).toLocaleTimeString('fr-FR')));
  } else {
    out(kv('En cours', c.gray('rien - lancez : chrono start')));
  }
  const open = listTasks(data, 'todo');
  out(kv('Taches', `${open.length} ouverte(s), ${listTasks(data, 'done').length} terminee(s)`));
  out(kv('Aujourd hui', `${humanMinutes(summary(data, now).todayMinutes)}`));
  out('');
}

function statusPayload(data, now) {
  const task = runningTask(data);
  return {
    running: data.running
      ? {
          taskId: data.running.taskId,
          taskTitle: task?.title ?? null,
          startedAt: data.running.startedAt,
          minutes: runningMinutes(data, now),
        }
      : null,
    openTasks: listTasks(data, 'todo').length,
    doneTasks: listTasks(data, 'done').length,
    todayMinutes: summary(data, now).todayMinutes,
  };
}

function cmdStats(data, flags, now) {
  const s = summary(data, now, { days: flags.days });
  if (flags.json) {
    return void out(JSON.stringify({ ...s, daily: s.daily.map(({ date, ...rest }) => rest), top: topTasks(data) }, null, 2));
  }
  out('');
  out(kv('Aujourd hui', `${c.bold(humanMinutes(s.todayMinutes))} ${c.gray(`(${s.todaySessions} session(s))`)}`));
  out(kv('Hier', c.gray(humanMinutes(s.yesterdayMinutes))));
  out(kv(`7 derniers j`, `${c.bold(humanMinutes(s.weekMinutes))} ${c.gray(`(${s.weekSessions} session(s))`)}`));
  out(kv('Serie en cours', s.streak > 0 ? `${c.green(c.bold(`${s.streak} jour(s)`))}` : c.gray('0')));
  out(kv('Taches', `${s.openTasks} ouverte(s) / ${s.doneTasks} terminee(s)`));
  const avg = Math.round(s.weekMinutes / 7);
  out(kv('Moyenne / jour', humanMinutes(avg)));
  out(kv('Total historique', humanMinutes(data.sessions.reduce((t, x) => t + x.minutes, 0))));

  out(heading(`Activite sur ${s.daily.length} jours`));
  const max = Math.max(...s.daily.map((d) => d.minutes), 0);
  for (const day of s.daily) {
    const label = `${dayKey(day.date) === dayKey(now) ? c.yellow('auj') : c.gray(weekdayShort(day.date))}`;
    out(`  ${label} ${c.gray(day.day)} ${bar(day.minutes, max)} ${humanMinutes(day.minutes).padStart(7)}`);
  }

  const top = topTasks(data, 5);
  if (top.length > 0) {
    out(heading('Top taches'));
    const maxTop = Math.max(...top.map((t) => t.minutes));
    for (const entry of top) {
      const task = data.tasks.find((t) => t.id === entry.taskId);
      const title = task ? task.title : c.gray(`#${entry.taskId} (supprimee)`);
      out(`  ${bar(entry.minutes, maxTop, 18)} ${humanMinutes(entry.minutes).padStart(7)}  ${title}`);
    }
  }
  out('');
}

function cmdToday(data, flags, now) {
  const key = dayKey(now);
  const sessions = data.sessions.filter((s) => s.day === key);
  const minutes = sessions.reduce((t, s) => t + s.minutes, 0);
  if (flags.json) return void out(JSON.stringify({ day: key, minutes, sessions }, null, 2));
  out(heading(`Journal du ${key}`));
  if (sessions.length === 0) out(c.gray('  Aucune session enregistree.'));
  for (const s of sessions) {
    const task = data.tasks.find((t) => t.id === s.taskId);
    out(`  ${sessionLine(s, task?.title)}`);
  }
  out(`\n  ${c.bold('Total')} ${humanMinutes(minutes)}\n`);
}

function cmdLog(data, flags) {
  const sessions = recentSessions(data, flags.limit);
  if (flags.json) return void out(JSON.stringify(sessions, null, 2));
  out(heading('Historique'));
  if (sessions.length === 0) out(c.gray('  Aucune session.'));
  for (const s of sessions) {
    const task = data.tasks.find((t) => t.id === s.taskId);
    out(sessionLine(s, task?.title));
  }
  out('');
}

const COMMANDS = {
  add: (d, p, f, n) => cmdAdd(d, p, n),
  ls: (d, p, f, n) => cmdList(d, p, f, n),
  list: (d, p, f, n) => cmdList(d, p, f, n),
  start: (d, p, f, n) => cmdStart(d, p, n),
  stop: (d, p, f, n) => cmdStop(d, n),
  done: (d, p, f, n) => cmdDone(d, p, n),
  check: (d, p, f, n) => cmdDone(d, p, n),
  reopen: (d, p, f, n) => cmdReopen(d, p),
  rm: (d, p, f, n) => cmdRemove(d, p),
  del: (d, p, f, n) => cmdRemove(d, p),
  status: (d, p, f, n) => cmdStatus(d, f, n),
  stats: (d, p, f, n) => cmdStats(d, f, n),
  today: (d, p, f, n) => cmdToday(d, f, n),
  log: (d, p, f, n) => cmdLog(d, f),
};

export function run(argv = process.argv.slice(2), { env = process.env, now = new Date() } = {}) {
  if (env.NO_COLOR) process.env.NO_COLOR = '1';
  const { flags, positional } = parseArgs(argv);
  const [command, ...rest] = positional;

  if (flags.version) {
    out('1.0.0');
    return 0;
  }
  if (flags.help) {
    out(HELP);
    return 0;
  }
  if (!command) {
    out(HELP);
    return 1;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    process.stderr.write(`${c.red('Commande inconnue')} : ${command}\n`);
    out(HELP);
    return 1;
  }

  const data = load(env, now);
  try {
    handler(data, rest, flags, now);
  } catch (err) {
    if (err instanceof ChronoError) {
      process.stderr.write(`${c.red('Erreur')} : ${err.message}\n`);
      return 1;
    }
    throw err;
  }
  save(data, env);
  return 0;
}
