import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dataFile, emptyData, load, normalize, runningMinutes, save, taskMinutes } from '../src/store.js';
import { addTask, completeTask, start, stop } from '../src/logic.js';
import { cleanup, tempHome } from './helpers.js';

const NOW = new Date(2026, 4, 18, 9, 0);

test('dataFile respecte CHRONO_HOME', () => {
  assert.equal(dataFile({ CHRONO_HOME: 'C:/tmp/x' }), path.resolve('C:/tmp/x/data.json'));
});

test('load renvoie une base vide si le fichier est absent', () => {
  const env = tempHome();
  try {
    const data = load(env, NOW);
    assert.deepEqual(data.tasks, []);
    assert.equal(data.nextId, 1);
    assert.equal(data.running, null);
  } finally {
    cleanup(env);
  }
});

test('save puis load fait un aller-retour fidele', () => {
  const env = tempHome();
  try {
    const data = emptyData(NOW);
    const task = addTask(data, 'Persistee', NOW).task;
    start(data, task.id, new Date(2026, 4, 18, 9, 0));
    stop(data, new Date(2026, 4, 18, 9, 45));
    completeTask(data, task.id, NOW);
    const file = save(data, env);
    assert.equal(file, path.join(path.resolve(env.CHRONO_HOME), 'data.json'));
    const reloaded = load(env, NOW);
    assert.equal(reloaded.tasks.length, 1);
    assert.equal(reloaded.tasks[0].status, 'done');
    assert.equal(reloaded.sessions[0].minutes, 45);
    assert.equal(taskMinutes(reloaded, task.id), 45);
  } finally {
    cleanup(env);
  }
});

test('save ne laisse pas de fichier temporaire', () => {
  const env = tempHome();
  try {
    save(emptyData(NOW), env);
    const left = fs.readdirSync(env.CHRONO_HOME).filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(left, []);
  } finally {
    cleanup(env);
  }
});

test('load signale un fichier corrompu', () => {
  const env = tempHome();
  try {
    fs.mkdirSync(env.CHRONO_HOME, { recursive: true });
    fs.writeFileSync(dataFile(env), '{ ceci nest pas du json', 'utf8');
    assert.throws(() => load(env, NOW), /donnees corrompu/);
  } finally {
    cleanup(env);
  }
});

test('normalize repare une structure partielle', () => {
  const data = normalize({ tasks: [{ id: 7, title: 'Sans date' }], sessions: 'nope' }, NOW);
  assert.equal(data.nextId, 8);
  assert.equal(data.tasks[0].createdAt, NOW.toISOString());
  assert.deepEqual(data.sessions, []);
  assert.equal(data.running, null);
});

test('normalize remplace les dates invalides au lieu de planter', () => {
  const data = normalize(
    {
      tasks: [{ id: 1, title: 'Date cassee', createdAt: 'oops', doneAt: 'nope' }],
      sessions: [{ taskId: 1, startedAt: 'oops', endedAt: 'nope', minutes: 'x' }],
    },
    NOW,
  );
  assert.equal(data.tasks[0].createdAt, NOW.toISOString());
  assert.equal(data.tasks[0].doneAt, NOW.toISOString());
  assert.equal(data.sessions[0].minutes, 0);
  assert.equal(data.sessions[0].endedAt, NOW.toISOString());
});

test('normalize ecarte les taches sans titre', () => {
  const data = normalize({ tasks: [{ id: 1, title: '   ' }, { id: 2, title: 'Valide' }] }, NOW);
  assert.equal(data.tasks.length, 1);
  assert.equal(data.tasks[0].id, 2);
});

test('normalize deduit le jour manquant et purge une session invalide', () => {
  const data = normalize(
    {
      tasks: [],
      sessions: [{ taskId: 1, startedAt: '2026-05-18T09:00:00.000Z', minutes: '30' }],
      running: { startedAt: 'pas une date' },
    },
    NOW,
  );
  assert.equal(data.sessions[0].day, dayOf(data.sessions[0].startedAt));
  assert.equal(data.sessions[0].minutes, 30);
  assert.equal(data.running, null);
});

test('load tolere un BOM UTF-8 en tete de fichier', () => {
  const env = tempHome();
  try {
    fs.mkdirSync(env.CHRONO_HOME, { recursive: true });
    fs.writeFileSync(dataFile(env), `\uFEFF${JSON.stringify({ tasks: [{ id: 1, title: 'Avec BOM' }] })}`, 'utf8');
    const data = load(env, NOW);
    assert.equal(data.tasks[0].title, 'Avec BOM');
    assert.equal(data.nextId, 2);
  } finally {
    cleanup(env);
  }
});

test('runningMinutes mesure la session en cours', () => {
  const data = emptyData(NOW);
  assert.equal(runningMinutes(data, NOW), 0);
  start(data, null, new Date(2026, 4, 18, 8, 10));
  assert.equal(runningMinutes(data, new Date(2026, 4, 18, 8, 42, 30)), 32);
  assert.equal(runningMinutes(data, new Date(2026, 4, 18, 7, 0)), 0);
});

function dayOf(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
