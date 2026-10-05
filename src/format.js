import { humanMinutes } from './dates.js';

const useColor = process.stdout.isTTY === true && !process.env.NO_COLOR;

const CODES = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
};

export const c = new Proxy(
  {},
  {
    get: (_target, key) => (text) => {
      const code = CODES[key];
      if (!code || !useColor) return String(text);
      return `${code}${text}${CODES.reset}`;
    },
  },
);

const WEEKDAYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

export function weekdayShort(date) {
  return WEEKDAYS[date.getDay()];
}

export function bar(value, max, width = 24) {
  if (max <= 0) return c.gray('.'.repeat(width));
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return c.cyan('#'.repeat(filled)) + c.gray('.'.repeat(width - filled));
}

export function taskLine(task, minutes, running = false) {
  const status = task.status === 'done' ? c.green('[x]') : c.blue('[ ]');
  const mark = running ? c.yellow('>') : ' ';
  const mins = minutes > 0 ? c.gray(humanMinutes(minutes).padStart(6)) : ' '.repeat(6);
  const title = task.status === 'done' ? c.gray(task.title) : task.title;
  return `${mark}${status} ${c.gray(`#${task.id}`)} ${mins}  ${title}`;
}

export function sessionLine(session, taskTitle) {
  const when = new Date(session.startedAt).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return `  ${c.gray(when)}  ${c.bold(humanMinutes(session.minutes).padStart(7))}  ${
    taskTitle ?? c.gray('(hors tache)')
  }`;
}

export function kv(label, value) {
  return `  ${c.gray(String(label).padEnd(16))} ${value}`;
}

export function heading(text) {
  return `\n${c.bold(text)}\n`;
}
