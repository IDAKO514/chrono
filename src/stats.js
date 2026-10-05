import { addDays, dayKey, daysBetween, startOfDay } from './dates.js';

export function sessionsForDay(data, day) {
  const key = typeof day === 'string' ? day : dayKey(day);
  return data.sessions.filter((s) => s.day === key);
}

export function totalMinutes(data, predicate = () => true) {
  return data.sessions.filter(predicate).reduce((total, s) => total + s.minutes, 0);
}

export function range(data, fromDay, toDay) {
  const from = typeof fromDay === 'string' ? new Date(`${fromDay}T00:00:00`) : startOfDay(fromDay);
  const to = typeof toDay === 'string' ? new Date(`${toDay}T00:00:00`) : startOfDay(toDay);
  return data.sessions.filter((s) => {
    const d = new Date(`${s.day}T00:00:00`);
    return d >= from && d <= to;
  });
}

export function daily(data, days, now = new Date()) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(now, -i);
    const key = dayKey(date);
    const sessions = sessionsForDay(data, key);
    out.push({
      day: key,
      date,
      minutes: sessions.reduce((t, s) => t + s.minutes, 0),
      sessions: sessions.length,
    });
  }
  return out;
}

export function lastNDays(data, days, now = new Date()) {
  const first = dayKey(addDays(now, -(days - 1)));
  return range(data, first, dayKey(now));
}

export function streak(data, now = new Date()) {
  const active = new Set(data.sessions.filter((s) => s.minutes > 0).map((s) => s.day));
  if (active.size === 0) return 0;

  let cursor = startOfDay(now);
  if (!active.has(dayKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!active.has(dayKey(cursor))) return 0;
  }
  let count = 0;
  while (active.has(dayKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function topTasks(data, limit = 5) {
  const totals = new Map();
  for (const s of data.sessions) {
    if (s.taskId == null || s.minutes <= 0) continue;
    totals.set(s.taskId, (totals.get(s.taskId) ?? 0) + s.minutes);
  }
  return [...totals.entries()]
    .map(([taskId, minutes]) => ({ taskId, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit);
}

export function summary(data, now = new Date(), { days = 7 } = {}) {
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(addDays(now, -1));
  const today = sessionsForDay(data, todayKey);
  const week = lastNDays(data, 7, now);

  return {
    todayMinutes: today.reduce((t, s) => t + s.minutes, 0),
    todaySessions: today.length,
    yesterdayMinutes: totalMinutes(data, (s) => s.day === yesterdayKey),
    weekMinutes: week.reduce((t, s) => t + s.minutes, 0),
    weekSessions: week.length,
    streak: streak(data, now),
    openTasks: data.tasks.filter((t) => t.status === 'todo').length,
    doneTasks: data.tasks.filter((t) => t.status === 'done').length,
    daysElapsed: data.createdAt ? Math.max(1, daysBetween(data.createdAt, now) + 1) : 1,
    daily: daily(data, days, now),
  };
}
