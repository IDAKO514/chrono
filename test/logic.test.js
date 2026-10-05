import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ChronoError,
  addTask,
  completeTask,
  findTaskByQuery,
  getTask,
  listTasks,
  recentSessions,
  removeTask,
  reopenTask,
  runningTask,
  start,
  stop,
} from '../src/logic.js';
import { emptyData, taskMinutes } from '../src/store.js';

const NOW = new Date(2026, 4, 18, 14, 30);

function fresh() {
  return emptyData(NOW);
}

test('addTask cree une tache et incremente nextId', () => {
  const data = fresh();
  const { task, created } = addTask(data, '  Ecrire le rapport  ', NOW);
  assert.equal(created, true);
  assert.equal(task.id, 1);
  assert.equal(task.title, 'Ecrire le rapport');
  assert.equal(task.status, 'todo');
  assert.equal(data.nextId, 2);
});

test('addTask refuse un titre vide', () => {
  const data = fresh();
  assert.throws(() => addTask(data, '   ', NOW), ChronoError);
  assert.equal(data.tasks.length, 0);
});

test('addTask refuse un titre trop long', () => {
  assert.throws(() => addTask(fresh(), 'x'.repeat(141), NOW), ChronoError);
});

test('addTask detecte les doublons en cours (insensible a la casse)', () => {
  const data = fresh();
  addTask(data, 'Relire le code', NOW);
  const { task, created } = addTask(data, 'relire le CODE', NOW);
  assert.equal(created, false);
  assert.equal(task.id, 1);
  assert.equal(data.tasks.length, 1);
});

test('une tache terminee peut etre recreee', () => {
  const data = fresh();
  const { task } = addTask(data, 'Relire le code', NOW);
  completeTask(data, task.id, NOW);
  const again = addTask(data, 'Relire le code', NOW);
  assert.equal(again.created, true);
  assert.notEqual(again.task.id, task.id);
});

test('completeTask est idempotent et horodate', () => {
  const data = fresh();
  const { task } = addTask(data, 'Migrer la config', NOW);
  assert.equal(completeTask(data, task.id, NOW).changed, true);
  assert.equal(task.doneAt, NOW.toISOString());
  assert.equal(completeTask(data, task.id, NOW).changed, false);
  reopenTask(data, task.id);
  assert.equal(task.status, 'todo');
  assert.equal(task.doneAt, null);
});

test('getTask leve une erreur explicite', () => {
  assert.throws(() => getTask(fresh(), 42), /Tache #42 introuvable/);
});

test('listTasks filtre par statut', () => {
  const data = fresh();
  const a = addTask(data, 'A', NOW).task;
  const b = addTask(data, 'B', NOW).task;
  completeTask(data, a.id, NOW);
  assert.deepEqual(listTasks(data, 'todo').map((t) => t.id), [b.id]);
  assert.deepEqual(listTasks(data, 'done').map((t) => t.id), [a.id]);
  assert.equal(listTasks(data, 'all').length, 2);
});

test('start puis stop enregistre une session', () => {
  const data = fresh();
  const task = addTask(data, 'Refactor', NOW).task;
  start(data, task.id, new Date(2026, 4, 18, 10, 0));
  assert.equal(data.running.taskId, task.id);
  assert.equal(runningTask(data).title, 'Refactor');

  const session = stop(data, new Date(2026, 4, 18, 10, 25));
  assert.equal(session.minutes, 25);
  assert.equal(session.day, '2026-05-18');
  assert.equal(data.running, null);
  assert.equal(data.sessions.length, 1);
  assert.equal(taskMinutes(data, task.id), 25);
});

test('start ferme automatiquement la session precedente', () => {
  const data = fresh();
  start(data, null, new Date(2026, 4, 18, 9, 0));
  const { closed } = start(data, null, new Date(2026, 4, 18, 9, 30));
  assert.equal(closed.minutes, 30);
  assert.equal(data.sessions.length, 1);
});

test('stop sans session en cours leve une erreur', () => {
  assert.throws(() => stop(fresh(), NOW), /Aucune session en cours/);
});

test('stop ignore les sessions de moins d une minute', () => {
  const data = fresh();
  start(data, null, new Date(2026, 4, 18, 10, 0));
  assert.throws(() => stop(data, new Date(2026, 4, 18, 10, 0, 30)), /trop courte/);
  assert.equal(data.running.taskId, null);
});

test('une session peut etre lancee hors tache', () => {
  const data = fresh();
  start(data, undefined, NOW);
  assert.equal(data.running.taskId, null);
  assert.equal(runningTask(data), null);
  const session = stop(data, new Date(2026, 4, 18, 15, 0));
  assert.equal(session.taskId, null);
  assert.equal(session.minutes, 30);
});

test('findTaskByQuery accepte un id ou un fragment de titre', () => {
  const data = fresh();
  const task = addTask(data, 'Corriger le bug de parsing', NOW).task;
  assert.equal(findTaskByQuery(data, String(task.id)).id, task.id);
  assert.equal(findTaskByQuery(data, 'parsing').id, task.id);
  assert.throws(() => findTaskByQuery(data, 'inexistant'), /Aucune tache/);
  assert.throws(() => findTaskByQuery(data, ''), /Precisez/);
});

test('removeTask supprime et libere la session en cours', () => {
  const data = fresh();
  const task = addTask(data, 'Tache jetable', NOW).task;
  start(data, task.id, NOW);
  removeTask(data, task.id);
  assert.equal(data.running, null);
  assert.equal(listTasks(data, 'all').length, 0);
});

test('recentSessions trie du plus recent au plus ancien', () => {
  const data = fresh();
  start(data, null, new Date(2026, 4, 10, 8, 0));
  stop(data, new Date(2026, 4, 10, 9, 0));
  start(data, null, new Date(2026, 4, 17, 8, 0));
  stop(data, new Date(2026, 4, 17, 9, 0));
  const recent = recentSessions(data, 2);
  assert.deepEqual(recent.map((s) => s.day), ['2026-05-17', '2026-05-10']);
});
