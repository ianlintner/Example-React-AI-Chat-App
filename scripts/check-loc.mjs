#!/usr/bin/env node
// Enforces the ~400-LOC ceiling (ARCHITECTURE.md §"File size") on the new
// stack: apps/, packages/, e2e/. Generated and vendored files are exempt.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const LIMIT = 400;
const ROOTS = ['apps', 'packages', 'e2e'];
const EXTS = /\.(ts|tsx|mts|cts|js|mjs|jsx|css)$/;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.output',
  '.tanstack',
  'storybook-static',
  'test-results',
  'playwright-report',
]);
// Vendored shadcn/AI Elements copies stay as upstream ships them.
const EXEMPT = [
  /\.gen\.ts$/,
  /\/components\/ui\//,
  /\/components\/ai-elements\//,
];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTS.test(name)) yield path;
  }
}

const offenders = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative('.', file);
    if (EXEMPT.some(re => re.test(`/${rel}`))) continue;
    const lines = readFileSync(file, 'utf8').split('\n').length;
    if (lines > LIMIT) offenders.push(`${rel}: ${lines} lines`);
  }
}

if (offenders.length) {
  console.error(
    `Files over ${LIMIT} lines (split them):\n  ${offenders.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(`check-loc: all files under ${LIMIT} lines`);
