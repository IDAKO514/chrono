#!/usr/bin/env node
import { run } from '../src/cli.js';

try {
  process.exitCode = run();
} catch (err) {
  process.stderr.write(`chrono : erreur inattendue - ${err.message}\n`);
  process.exitCode = 70;
}
