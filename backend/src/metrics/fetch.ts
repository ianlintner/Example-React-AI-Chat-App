/**
 * Instrumented fetch wrapper. Emits `http_client_requests_total` and
 * `http_client_request_duration_seconds`. Use for every outbound call
 * to an external peer — pass a stable `peer_service` label.
 *
 * Example:
 *   const res = await instrumentedFetch('youtube', url, { headers });
 *
 * Metric labels fall back to the `other` bucket for peer names not in
 * the whitelist (see PEER_SERVICES in prometheus.ts).
 */
import { metricsEmit } from './prometheus';

export async function instrumentedFetch(
  peerService: string,
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const start = process.hrtime.bigint();
  try {
    const res = await fetch(input, init);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    metricsEmit.httpClient.request(peerService, method, res.status, seconds);
    return res;
  } catch (err) {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    // Treat network-level failures as 0 status → status_class "other".
    metricsEmit.httpClient.request(peerService, method, 0, seconds);
    throw err;
  }
}
