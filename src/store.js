import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { dayKey, toDate } from './dates.js';

export const VERSION = 1;

export function dataDir(env = process.env) {
  return path.resolve(env.CHRONO_HOME ?? path.join(os.homedir(), '.chrono'));
}

export function dataFile(env = process.env) {
  return path.join(dataDir(env), 'data.json');
}

export function emptyData(now = new Date()) {
  return {
    version: VERSION,
    createdAt: now.toISOString(),
    nextId: 1,
    running: null,
    sessions: [],
    tasks: [],
  };
}

function safeIso(value, fallback = null) {
  if (value != null) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (fallback == null) return null;
  const f = new Date(fallback);
  return Number.isNaN(f.getTime()) ? null : f.toISOString();
}

function normalizeTask(raw, now) {
  const created = safeIso(raw.createdAt, now);
  return {
    id: raw.id,
    title: String(raw.title ?? '').trim(),
    status: raw.status === 'done' ? 'done' : 'todo',
    createdAt: created,
    doneAt: raw.doneAt ? safeIso(raw.doneAt, now) : null,
  };
}

function normalizeSession(raw, now) {
  const started = safeIso(raw.startedAt, now);
  const day = raw.day ?? dayKey(started);
  return {
    taskId: raw.taskId ?? null,
    startedAt: started,
    endedAt: raw.endedAt ? safeIso(raw.endedAt, now) : null,
    minutes: Math.max(0, Math.round(Number(raw.minutes) || 0)),
    day,
  };
}

export function normalize(raw, now = new Date()) {
  const base = emptyData(now);
  if (!raw || typeof raw !== 'object') return base;

  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  const normalizedTasks = tasks.map((task) => normalizeTask(task, now)).filter((t) => t.id != null && t.title);
  const maxId = normalizedTasks.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0);

  let running = null;
  if (raw.running && raw.running.startedAt) {
    const startedAt = safeIso(raw.running.startedAt, null);
    if (startedAt) {
      running = {
        taskId: raw.running.taskId ?? null,
        startedAt,
        day: raw.running.day ?? dayKey(startedAt),
      };
    }
  }

  return {
    version: VERSION,
    createdAt: raw.createdAt ?? base.createdAt,
    nextId: Math.max(Number(raw.nextId) || 1, maxId + 1),
    running,
    sessions: sessions.map((s) => normalizeSession(s, now)),
    tasks: normalizedTasks,
  };
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function load(env = process.env, now = new Date()) {
  const file = dataFile(env);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return emptyData(now);
    throw new Error(`Lecture impossible (${file}) : ${err.message}`);
  }
  try {
    return normalize(JSON.parse(stripBom(text)), now);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Fichier de donnees corrompu (${file}) : ${err.message}`);
    }
    throw err;
  }
}

export function save(data, env = process.env) {
  const dir = dataDir(env);
  fs.mkdirSync(dir, { recursive: true });
  const file = dataFile(env);
  const tmp = path.join(dir, `data.${process.pid}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
  return file;
}

export function update(mutator, { env = process.env, now = new Date() } = {}) {
  const data = load(env, now);
  const result = mutator(data);
  save(data, env);
  return result ?? data;
}

export function taskMinutes(data, taskId) {
  return data.sessions
    .filter((s) => s.taskId === taskId)
    .reduce((total, s) => total + s.minutes, 0);
}

export function runningMinutes(data, now = new Date()) {
  if (!data.running) return 0;
  return Math.max(0, Math.floor((toDate(now) - toDate(data.running.startedAt)) / 60_000));
}
