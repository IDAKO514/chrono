import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function tempHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-test-'));
  return { CHRONO_HOME: dir, dir };
}

export function cleanup(env) {
  if (env?.CHRONO_HOME) fs.rmSync(env.CHRONO_HOME, { recursive: true, force: true });
}

export function captureStdout(fn) {
  const chunks = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };
  const originalErr = process.stderr.write;
  process.stderr.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
    process.stderr.write = originalErr;
  }
  return chunks.join('');
}

export function session(taskId, day, minutes, startedAt = `${day}T09:00:00`) {
  return { taskId, startedAt, endedAt: `${day}T10:00:00`, minutes, day };
}
