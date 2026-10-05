import { dayKey, toDate } from './dates.js';

export class ChronoError extends Error {}

export function addTask(data, title, now = new Date()) {
  const clean = String(title ?? '').trim();
  if (!clean) throw new ChronoError('Titre de tache vide.');
  if (clean.length > 140) throw new ChronoError('Titre trop long (140 caracteres max).');

  const duplicate = data.tasks.find((t) => t.status === 'todo' && t.title.toLowerCase() === clean.toLowerCase());
  if (duplicate) return { task: duplicate, created: false };

  const task = {
    id: data.nextId,
    title: clean,
    status: 'todo',
    createdAt: toDate(now).toISOString(),
    doneAt: null,
  };
  data.nextId += 1;
  data.tasks.push(task);
  return { task, created: true };
}

export function getTask(data, id) {
  const wanted = Number(id);
  const task = data.tasks.find((t) => Number(t.id) === wanted);
  if (!task) throw new ChronoError(`Tache #${id} introuvable.`);
  return task;
}

export function listTasks(data, status = 'open') {
  if (status === 'all') return [...data.tasks];
  if (status === 'done') return data.tasks.filter((t) => t.status === 'done');
  return data.tasks.filter((t) => t.status === 'todo');
}

export function completeTask(data, id, now = new Date()) {
  const task = getTask(data, id);
  if (task.status === 'done') return { task, changed: false };
  task.status = 'done';
  task.doneAt = toDate(now).toISOString();
  return { task, changed: true };
}

export function reopenTask(data, id) {
  const task = getTask(data, id);
  task.status = 'todo';
  task.doneAt = null;
  return task;
}

export function removeTask(data, id) {
  const task = getTask(data, id);
  if (data.running && data.running.taskId === task.id) {
    data.running = null;
  }
  data.tasks = data.tasks.filter((t) => t.id !== task.id);
  return task;
}

function computeSession(data, now) {
  const date = toDate(now);
  const minutes = Math.max(0, Math.floor((date - new Date(data.running.startedAt)) / 60_000));
  return {
    taskId: data.running.taskId,
    startedAt: data.running.startedAt,
    endedAt: date.toISOString(),
    minutes,
    day: data.running.day ?? dayKey(data.running.startedAt),
  };
}

export function stop(data, now = new Date(), { force = false } = {}) {
  if (!data.running) {
    if (force) return null;
    throw new ChronoError('Aucune session en cours.');
  }
  const session = computeSession(data, now);
  if (session.minutes <= 0 && !force) {
    throw new ChronoError('Session trop courte (< 1 min) : elle est ignoree.');
  }
  data.running = null;
  if (session.minutes <= 0) return null;
  data.sessions.push(session);
  return session;
}

export function start(data, taskId, now = new Date()) {
  const date = toDate(now);
  const closed = data.running ? stop(data, date, { force: true }) : null;
  const task = taskId == null ? null : getTask(data, taskId);
  data.running = {
    taskId: task ? task.id : null,
    startedAt: date.toISOString(),
    day: dayKey(date),
  };
  return { task, closed };
}

export function runningTask(data) {
  if (!data.running) return null;
  if (data.running.taskId == null) return null;
  return data.tasks.find((t) => t.id === data.running.taskId) ?? null;
}

export function recentSessions(data, limit = 10) {
  return [...data.sessions]
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, limit);
}

export function findTaskByQuery(data, query) {
  const raw = String(query ?? '').trim();
  if (!raw) throw new ChronoError('Precisez un identifiant de tache.');
  if (/^\d+$/.test(raw)) return getTask(data, raw);
  const needle = raw.toLowerCase();
  const matches = data.tasks.filter((t) => t.title.toLowerCase().includes(needle));
  if (matches.length === 0) throw new ChronoError(`Aucune tache ne correspond a "${raw}".`);
  return matches[0];
}
