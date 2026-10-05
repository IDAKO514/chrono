import test from 'node:test';
import assert from 'node:assert/strict';
import { daily, lastNDays, range, sessionsForDay, streak, summary, topTasks, totalMinutes } from '../src/stats.js';
import { emptyData } from '../src/store.js';
import { session } from './helpers.js';

const NOW = new Date(2026, 4, 18, 12, 0);

function dataset() {
  const data = emptyData(new Date(2026, 4, 1));
  data.tasks = [
    { id: 1, title: 'Refactor', status: 'todo', createdAt: '2026-05-01T09:00:00.000Z', doneAt: null },
    { id: 2, title: 'Rapport', status: 'done', createdAt: '2026-05-02T09:00:00.000Z', doneAt: '2026-05-10T09:00:00.000Z' },
    { id: 3, title: 'Supprimee', status: 'todo', createdAt: '2026-05-03T09:00:00.000Z', doneAt: null },
  ];
  data.sessions = [
    session(1, '2026-05-16', 60),
    session(2, '2026-05-17', 30),
    session(null, '2026-05-17', 15),
    session(1, '2026-05-18', 90),
    session(3, '2026-05-18', 20),
  ];
  return data;
}

test('sessionsForDay selectionne par jour local', () => {
  const data = dataset();
  assert.equal(sessionsForDay(data, '2026-05-17').length, 2);
  assert.equal(sessionsForDay(data, new Date(2026, 4, 18, 23, 59)).length, 2);
  assert.equal(sessionsForDay(data, '2026-05-01').length, 0);
});

test('totalMinutes additionne les sessions filtrees', () => {
  const data = dataset();
  assert.equal(totalMinutes(data), 215);
  assert.equal(totalMinutes(data, (s) => s.taskId === 1), 150);
});

test('range est bornes inclusives', () => {
  const data = dataset();
  assert.equal(range(data, '2026-05-16', '2026-05-17').length, 3);
  assert.equal(range(data, '2026-05-17', '2026-05-17').length, 2);
  assert.equal(range(data, '2026-05-19', '2026-05-20').length, 0);
});

test('lastNDays inclut exactement N jours', () => {
  const data = dataset();
  assert.equal(lastNDays(data, 2, NOW).length, 4);
  assert.equal(lastNDays(data, 3, NOW).length, 5);
  assert.equal(lastNDays(data, 10, NOW).length, 5);
});

test('daily renvoie une serie continue de N jours', () => {
  const series = daily(dataset(), 7, NOW);
  assert.equal(series.length, 7);
  assert.equal(series[0].day, '2026-05-12');
  assert.equal(series[6].day, '2026-05-18');
  assert.deepEqual(series.map((d) => d.minutes), [0, 0, 0, 0, 60, 45, 110]);
});

test('streak compte les jours consecutifs jusqu a aujourd hui', () => {
  assert.equal(streak(dataset(), NOW), 3);
  assert.equal(streak(dataset(), new Date(2026, 4, 19, 12, 0)), 3);
  assert.equal(streak(dataset(), new Date(2026, 4, 20, 12, 0)), 0);
  assert.equal(streak(emptyData(), NOW), 0);
});

test('streak ignore les sessions de zero minute', () => {
  const data = emptyData();
  data.sessions = [session(1, '2026-05-18', 0)];
  assert.equal(streak(data, NOW), 0);
});

test('topTasks trie par volume et exclut les sessions sans tache', () => {
  const top = topTasks(dataset(), 5);
  assert.deepEqual(top, [
    { taskId: 1, minutes: 150 },
    { taskId: 3, minutes: 20 },
    { taskId: 2, minutes: 30 },
  ].sort((a, b) => b.minutes - a.minutes));
  assert.equal(topTasks(dataset(), 2).length, 2);
});

test('summary agrege jour, semaine, serie et taches', () => {
  const s = summary(dataset(), NOW);
  assert.equal(s.todayMinutes, 110);
  assert.equal(s.todaySessions, 2);
  assert.equal(s.yesterdayMinutes, 45);
  assert.equal(s.weekMinutes, 215);
  assert.equal(s.weekSessions, 5);
  assert.equal(s.streak, 3);
  assert.equal(s.openTasks, 2);
  assert.equal(s.doneTasks, 1);
  assert.equal(s.daysElapsed, 18);
});

test('summary gere une base vide', () => {
  const s = summary(emptyData(), NOW);
  assert.equal(s.todayMinutes, 0);
  assert.equal(s.weekMinutes, 0);
  assert.equal(s.streak, 0);
  assert.equal(s.daily.length, 7);
});
