/**
 * Bundle-size budget for <agent-chat>. Runs against the built ES module and
 * enforces both raw and gzip ceilings so the embed stays lightweight on
 * third-party pages. No network, no dependencies.
 */
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, '../dist/agent-chat.js');
const RAW_LIMIT = 80 * 1024; // 80 KiB minified
const GZIP_LIMIT = 24 * 1024; // 24 KiB compressed

try {
  statSync(bundle);
} catch {
  console.error(`Bundle not found: ${bundle}. Run npm run -w apps/embed build first.`);
  process.exit(1);
}

const code = readFileSync(bundle);
const gzip = gzipSync(code, { level: 9 }).length;
const raw = code.length;
const kib = n => `${(n / 1024).toFixed(1)} KiB`;
console.log(`<agent-chat> bundle: ${kib(raw)} raw, ${kib(gzip)} gzip`);

let failed = false;
if (raw > RAW_LIMIT) {
  console.error(`Raw size ${kib(raw)} exceeds budget ${kib(RAW_LIMIT)}.`);
  failed = true;
}
if (gzip > GZIP_LIMIT) {
  console.error(`Gzip size ${kib(gzip)} exceeds budget ${kib(GZIP_LIMIT)}.`);
  failed = true;
}
if (failed) process.exit(1);
console.log(`Size budget OK (raw <= ${kib(RAW_LIMIT)}, gzip <= ${kib(GZIP_LIMIT)}).`);
