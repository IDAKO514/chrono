export function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  throw new TypeError(`Date invalide: ${JSON.stringify(value)}`);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function dayKey(date = new Date()) {
  const d = toDate(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(date = new Date()) {
  const d = toDate(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(date, amount) {
  const d = toDate(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + amount);
}

export function daysBetween(from, to) {
  const a = startOfDay(from);
  const b = startOfDay(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function minutesSince(date, now = new Date()) {
  return Math.max(0, Math.round((toDate(now) - toDate(date)) / 60_000));
}

export function humanMinutes(total) {
  const minutes = Math.max(0, Math.round(total));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${pad(m)}`;
}

export function humanDuration(start, now = new Date()) {
  let seconds = Math.max(0, Math.floor((toDate(now) - toDate(start)) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const clock = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return `${clock} (${humanMinutes(seconds / 60)})`;
}

export { pad };
