import { metricsEmit } from './prometheus';

/**
 * Rolling-window counter of unique anonymous sessions. Each time
 * resolveIdentity sees an anon id we record "now" for that id; entries
 * older than WINDOW_MS are purged and the gauge is set to the surviving
 * map size.
 *
 * Intentionally per-pod — good enough for a coarse liveness signal of
 * guest traffic without needing Redis for another shared counter. For a
 * fleet-wide figure, aggregate the gauge in Prometheus (sum()).
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const REAP_INTERVAL_MS = 60 * 1000; // 60 seconds

const lastSeen = new Map<string, number>();
let reaperHandle: NodeJS.Timeout | null = null;

function reap(nowMs: number = Date.now()): void {
  const cutoff = nowMs - WINDOW_MS;
  for (const [id, ts] of lastSeen) {
    if (ts < cutoff) {
      lastSeen.delete(id);
    }
  }
  metricsEmit.tier.anonSessionsActive(lastSeen.size);
}

export function recordAnonSession(anonId: string): void {
  lastSeen.set(anonId, Date.now());
  metricsEmit.tier.anonSessionsActive(lastSeen.size);
}

export function startAnonSessionTracker(): void {
  if (reaperHandle) {
    return;
  }
  reaperHandle = setInterval(() => reap(), REAP_INTERVAL_MS);
  reaperHandle.unref?.();
}

export function stopAnonSessionTracker(): void {
  if (!reaperHandle) {
    return;
  }
  clearInterval(reaperHandle);
  reaperHandle = null;
}

// Test-only reset.
export function __resetAnonSessionTracker(): void {
  lastSeen.clear();
  stopAnonSessionTracker();
}

// Test helper — force a reap without waiting for the interval.
export function __reapNow(nowMs?: number): void {
  reap(nowMs);
}
