# Quality gate and local observability

Card 10 of the 2026–27 agentic modernization makes agent quality and security
measurable before the legacy stack is removed. Everything here runs locally;
no cloud resources, hosting or DNS are involved.

## Golden trajectory eval

```sh
npm run eval              # mock model, CI gate
npm run eval:live         # local Switchyard report (never in CI)
EVAL_REPORT=/tmp/eval.json npm run eval
```

`npm run eval` runs 48 cases across routing (24), tools (8), goal runs (8) and
research (8). Each case is scored on **both** outcome and trajectory; a case
can pass the outcome and still fail the trajectory. Cases drive the real seams
(`ToolRegistry`, `GoalRunEngine`, `runResearch`, `classify`) with injected
deterministic fakes. There are no network LLM calls in mock mode.

The CLI writes `eval-report.json` (golden + injection results) and exits non-zero
on any failure. CI runs it in the `new-stack` job with `LLM_PROVIDER: mock` and
uploads the report as an artifact.

Live mode runs the same deterministic golden cases, then probes `LLM_BASE_URL`
via one minimal chat completion per env-mapped tier route (`ROUTE_FAST`,
`ROUTE_DEEP`, `ROUTE_RESEARCH`). It records only route names, status and latency
— never prompts, completions, model ids or API keys. The probe fails closed when
the gateway is unreachable, so `npm run eval:live` is for local Switchyard only,
never CI. No model id is hardcoded anywhere. Never point it at a paid endpoint
without knowing the cost; do not edit `~/.config/switchyard/routes.yaml`.

## Injection suite

18 attack cases across tool poisoning, indirect injection via fetched pages and
excessive agency. They assert the real authorization boundaries:

- `ToolRegistry.toolsFor` only exposes tools in the selected skill's
  `allowedTools` and only to authenticated principals. Model output or fetched
  page text can never widen that set.
- `sanitizeExcerpt` / `containsDirective` strip or flag instructions embedded
  in research pages before they reach the model.
- A `GoalRunEngine` with `maxReplans: 0` and `phase: 'commit'` guards proves
  side effects happen only after approval and exactly once.
- Citation resolution rejects unresolved source ids.

The suite is part of `npm run eval` and the Vitest gate test; both must report
zero breaches. Attack payloads are fixture data only and are never logged
verbatim.

## Observability

`npm run dev:services` starts Prometheus (`:9090`), Grafana (`:3001`) and an
OTel collector (OTLP/HTTP `:4318`, gRPC `:4317`) alongside Postgres, Redis and
Inngest. All bind to loopback only.

- `packages/agent-core/src/obs/genai.ts` emits one `gen_ai` span per LLM call
  as OTLP/HTTP JSON. It records the env-mapped *route name*, token counts,
  duration and error class — never prompt text, model ids or secrets. Export is
  best-effort and cannot fail the request. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to
  override the collector; an invalid URL disables export (fail closed).
- `packages/agent-core/src/obs/metrics.ts` plus `apps/agent/src/router-obs.ts`
  register ~13 Prometheus collectors on one registry exposed at
  `apps/agent/metrics`. Names reuse the legacy `backend/src/metrics/prometheus.ts`
  vocabulary (`http_server_requests_total`, `llm_requests_total`,
  `llm_tokens_total`, `agent_response_time_seconds`, `validation_checks_total`,
  `backend_errors_total`, …) so dashboards survive the legacy deletion.
- `grafana/dashboards/agent-observability.json` is the local dashboard. It is
  provisioned on startup; no import steps are needed for `npm run dev`.

The legacy `prometheus.yml` / `otel-collector-config.yaml` (with azuremonitor
and zipkin exporters) are untouched and remain for the old stack until card 12.
The new stack uses `prometheus.agent.yml` and `otel-collector.agent.yaml`, which
have no cloud exporter and require no credentials.

## Contract for contributors

- Never hardcode a model id or a secret. Fail closed on missing configuration.
- Keep metric labels bounded and free of user content.
- New router/tools/goals/research behaviour needs a golden case; new attack
  surfaces need an injection case. Update expectations only when the labelled
  ground truth changes, not to hide a regression.
- Do not run live eval in CI.
