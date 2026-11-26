/**
 * npm run eval CLI. Mock mode is the CI gate; live mode (EVAL_MODE=live)
 * produces a report against local Switchyard for humans, and is never used
 * in CI (no network calls there). No model id or secret is ever hardcoded.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  runGoldenEval,
  formatReport,
} from '../packages/agent-core/src/evals/runner';
import {
  runInjectionSuite,
  formatInjectionReport,
} from '../packages/agent-core/src/security/runner';
import { runLiveProbe, formatLiveProbe } from './live-probe.mjs';

const mode = process.env.EVAL_MODE === 'live' ? 'live' : 'mock';
const report = await runGoldenEval(mode);
console.log(formatReport(report));

const security = await runInjectionSuite();
console.log(formatInjectionReport(security));

let live;
if (mode === 'live') {
  live = await runLiveProbe();
  console.log(formatLiveProbe(live));
}

const out =
  process.env.EVAL_REPORT ?? resolve(process.cwd(), 'eval-report.json');
const combined = {
  generatedAt: report.generatedAt,
  mode,
  golden: report,
  security,
  live,
  ok: report.ok && security.ok && (live?.ok ?? true),
};
await writeFile(out, `${JSON.stringify(combined, null, 2)}\n`, 'utf8');
console.log(`eval report: ${out}`);
if (!combined.ok) process.exitCode = 1;
