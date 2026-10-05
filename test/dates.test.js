import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayKey, daysBetween, humanMinutes, humanDuration, minutesSince, startOfDay } from '../src/dates.js';

test('dayKey formate en AAAA-MM-JJ local', () => {
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('addDays traverse les mois et les annees bissextiles', () => {
  assert.equal(dayKey(addDays(new Date(2026, 0, 31), 1)), '2026-02-01');
  assert.equal(dayKey(addDays(new Date(2026, 11, 31), 1)), '2027-01-01');
  assert.equal(dayKey(addDays(new Date(2024, 1, 28), 1)), '2024-02-29');
  assert.equal(dayKey(addDays(new Date(2026, 4, 20), -20)), '2026-04-30');
});

test('daysBetween ignore les heures', () => {
  assert.equal(daysBetween(new Date(2026, 0, 1, 23, 30), new Date(2026, 0, 2, 0, 15)), 1);
  assert.equal(daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 1)), 0);
});

test('startOfDay remet a minuit', () => {
  const d = startOfDay(new Date(2026, 4, 9, 17, 42, 13));
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

test('humanMinutes formate les durees', () => {
  assert.equal(humanMinutes(0), '0min');
  assert.equal(humanMinutes(45), '45min');
  assert.equal(humanMinutes(60), '1h');
  assert.equal(humanMinutes(135), '2h15');
  assert.equal(humanMinutes(-5), '0min');
});

test('minutesSince arrondit au minute pres', () => {
  const start = new Date(2026, 0, 1, 10, 0, 0);
  assert.equal(minutesSince(start, new Date(2026, 0, 1, 10, 25, 30)), 26);
  assert.equal(minutesSince(start, new Date(2026, 0, 1, 9, 0, 0)), 0);
});

test('humanDuration affiche une horloge', () => {
  assert.equal(humanDuration(new Date(2026, 0, 1, 10, 0, 0), new Date(2026, 0, 1, 10, 25, 5)), '25:05 (25min)');
  assert.equal(humanDuration(new Date(2026, 0, 1, 10, 0, 0), new Date(2026, 0, 1, 12, 3, 4)), '2:03:04 (2h03)');
});
