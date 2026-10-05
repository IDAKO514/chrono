import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dataFile, load } from '../src/store.js';
import { run } from '../src/cli.js';
import { captureStdout, cleanup, tempHome } from './helpers.js';

function cli(env, argv, now) {
  let code = null;
  const output = captureStdout(() => {
    code = run(argv, { env, now });
  });
  return { code, output, data: () => load(env, now) };
}

const T0 = new Date(2026, 4, 18, 9, 0);
const T1 = new Date(2026, 4, 18, 9, 25);
const T2 = new Date(2026, 4, 18, 9, 50);

test('--help et --version reussissent', () => {
  const env = tempHome();
  try {
    assert.equal(cli(env, ['--help'], T0).code, 0);
    assert.equal(cli(env, ['--version'], T0).output.trim(), '1.0.0');
    assert.equal(cli(env, [], T0).code, 1);
  } finally {
    cleanup(env);
  }
});

test('commande inconnue renvoie 1', () => {
  const env = tempHome();
  try {
    assert.equal(cli(env, ['nope'], T0).code, 1);
  } finally {
    cleanup(env);
  }
});

test('parcours complet : add, start, stop, done, stats', () => {
  const env = tempHome();
  try {
    assert.equal(cli(env, ['add', 'Ecrire', 'le', 'rapport'], T0).code, 0);
    assert.equal(cli(env, ['ls'], T0).data().tasks.length, 1);

    cli(env, ['start', '1'], T0);
    assert.equal(cli(env, ['stop'], T1).data().sessions[0].minutes, 25);

    cli(env, ['start', 'rapport'], T1);
    cli(env, ['stop'], T2);
    assert.equal(cli(env, ['done', '1'], T2).data().tasks[0].status, 'done');

    const stats = cli(env, ['stats', '--json'], T2);
    const payload = JSON.parse(stats.output);
    assert.equal(payload.todayMinutes, 50);
    assert.equal(payload.todaySessions, 2);
    assert.equal(payload.streak, 1);
    assert.equal(payload.doneTasks, 1);
    assert.deepEqual(payload.top[0], { taskId: 1, minutes: 50 });
    assert.equal(payload.daily.length, 7);
  } finally {
    cleanup(env);
  }
});

test('stop explicite ferme toujours la session, meme courte', () => {
  const env = tempHome();
  try {
    const start = cli(env, ['start'], T0);
    assert.equal(start.code, 0);
    const stopped = cli(env, ['stop'], new Date(2026, 4, 18, 9, 0, 5));
    assert.equal(stopped.code, 0);
    assert.match(stopped.output, /sans minutes comptees/);
    assert.equal(stopped.data().running, null);
    assert.equal(stopped.data().sessions.length, 0);
  } finally {
    cleanup(env);
  }
});

test('stop sans session en cours signale une erreur', () => {
  const env = tempHome();
  try {
    const result = cli(env, ['stop'], T0);
    assert.equal(result.code, 1);
    assert.match(result.output, /Aucune session en cours/);
  } finally {
    cleanup(env);
  }
});

test('un restart immediat ne cree pas de session vide', () => {
  const env = tempHome();
  try {
    cli(env, ['add', 'Refactor'], T0);
    cli(env, ['start', '1'], T0);
    cli(env, ['start', '1'], T0);
    const data = cli(env, ['status', '--json'], T0).data();
    assert.equal(data.running.taskId, 1);
    assert.equal(data.sessions.length, 0);
  } finally {
    cleanup(env);
  }
});

test('les doublons sont signales et ne creent pas de tache', () => {
  const env = tempHome();
  try {
    cli(env, ['add', 'Course'], T0);
    const second = cli(env, ['add', 'course'], T0);
    assert.match(second.output, /Deja listee/);
    assert.equal(cli(env, ['ls', '--json', 'all'], T0).data().tasks.length, 1);
  } finally {
    cleanup(env);
  }
});

test('status --json expose la session en cours', () => {
  const env = tempHome();
  try {
    cli(env, ['add', 'Debugger'], T0);
    cli(env, ['start', '1'], T0);
    const payload = JSON.parse(cli(env, ['status', '--json'], new Date(2026, 4, 18, 9, 12)).output);
    assert.equal(payload.running.taskId, 1);
    assert.equal(payload.running.minutes, 12);
    assert.equal(payload.running.taskTitle, 'Debugger');
    assert.equal(payload.openTasks, 1);
  } finally {
    cleanup(env);
  }
});

test('today --json renvoie les sessions du jour', () => {
  const env = tempHome();
  try {
    cli(env, ['start'], T0);
    cli(env, ['stop'], T1);
    const payload = JSON.parse(cli(env, ['today', '--json'], T1).output);
    assert.equal(payload.day, '2026-05-18');
    assert.equal(payload.minutes, 25);
    assert.equal(payload.sessions.length, 1);
  } finally {
    cleanup(env);
  }
});

test('une erreur metier renvoie 1 sans ecrire de fichier', () => {
  const env = tempHome();
  try {
    const result = cli(env, ['done', '99'], T0);
    assert.equal(result.code, 1);
    assert.match(result.output, /introuvable/);
    assert.equal(fs.existsSync(dataFile(env)), false);
  } finally {
    cleanup(env);
  }
});

test('rm supprime une tache et ses sessions restent orphelines', () => {
  const env = tempHome();
  try {
    cli(env, ['add', 'Jetable'], T0);
    cli(env, ['start', '1'], T0);
    cli(env, ['stop'], T1);
    cli(env, ['rm', '1'], T1);
    const data = cli(env, ['stats', '--json'], T1).data();
    assert.equal(data.tasks.length, 0);
    assert.equal(data.sessions.length, 1);
    assert.equal(data.sessions[0].taskId, 1);
  } finally {
    cleanup(env);
  }
});

test('log --limit limite l historique', () => {
  const env = tempHome();
  try {
    cli(env, ['start'], T0);
    cli(env, ['stop'], T1);
    cli(env, ['start'], T1);
    cli(env, ['stop'], T2);
    assert.equal(JSON.parse(cli(env, ['log', '--json'], T2).output).length, 2);
    assert.equal(JSON.parse(cli(env, ['log', '--json', '--limit', '1'], T2).output).length, 1);
  } finally {
    cleanup(env);
  }
});
