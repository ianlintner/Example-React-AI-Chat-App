# Troubleshooting

Common issues and fixes during setup and development.

## Backend

- Swagger UI not available at /docs
  - Ensure backend is running and swagger setup is enabled
- Tracing not emitted
  - Verify OTEL env vars and sampling settings

## Frontend

- Expo cannot connect to packager
  - Check network, restart with `expo start -c`

## Observability

- Prometheus/Grafana not showing data
  - Validate targets and scraping config, see Operations > Observability

---

<!-- Sources to merge (from plan):
- README.md (root)
- SETUP-INSTRUCTIONS.md (root)
- docs/development.md
-->
