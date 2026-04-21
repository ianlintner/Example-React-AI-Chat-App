import {
  recordAnonSession,
  __resetAnonSessionTracker,
  __reapNow,
} from '../anonSessionTracker';
import { register } from '../prometheus';

async function readGauge(): Promise<number> {
  const json = await register.getMetricsAsJSON();
  const m = json.find(x => x.name === 'anon_sessions_active');
  if (!m || !('values' in m)) {
    return 0;
  }
  const v = (m as { values: Array<{ value: number }> }).values;
  return v[0]?.value ?? 0;
}

describe('anonSessionTracker', () => {
  beforeEach(() => {
    __resetAnonSessionTracker();
  });
  afterAll(() => {
    __resetAnonSessionTracker();
  });

  it('counts unique anon ids and updates the gauge', async () => {
    recordAnonSession('a-1');
    recordAnonSession('a-2');
    recordAnonSession('a-1'); // duplicate — same key, still size 2
    expect(await readGauge()).toBe(2);
  });

  it('purges stale entries when reap is called past the window', async () => {
    recordAnonSession('keep-me');
    recordAnonSession('stale-me');
    // Force every current entry to look old so they all purge.
    const farFuture = Date.now() + 24 * 60 * 60 * 1000;
    __reapNow(farFuture);
    expect(await readGauge()).toBe(0);
  });
});
