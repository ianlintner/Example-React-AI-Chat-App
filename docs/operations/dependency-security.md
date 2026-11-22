# Dependency security posture

This page records the disposition of npm advisories and Trivy lockfile findings for the
repository. It is the reference for what the CI security gate scans, what remains open,
and why no Expo major upgrade was taken.

## What CI scans

The `security` job in `.github/workflows/ci.yml` runs `aquasecurity/trivy-action` with
`scan-type: fs` over the repository root, uploads the SARIF to GitHub code scanning, and
runs `npm audit` in `backend/` and `frontend/`. Trivy's filesystem scan of production
lockfiles reports **zero** findings on `main`; the uploaded SARIF contains no results,
and the security job is green.

`npm audit` reports advisories in development and build-time dependency trees. Those do
not reach the running application, but they are listed here so the residual risk is
explicit.

## Root dependency advisories

The root lockfile has 13 advisory entries. None is a runtime dependency of the chat
service.

| Package | Severity | Source and reason for deferral |
| --- | --- | --- |
| `expo`, `@expo/cli`, `@expo/mcp-tunnel` | high | Expo SDK 54 development tooling and MCP tunnel. Fixes require an Expo 55 major migration. The app does not ship the tunnel; the SDK 54 runtime is pinned for React Native compatibility, so the major bump is not taken without a dedicated migration and device test pass. |
| `basic-ftp` | critical | Transitive Expo CLI development dependency. Not reachable from the built web or embed bundles. |
| `ip-address` | high | Transitive development dependency. Affected APIs are not called by application code. |
| `undici` | high | Transitive development tooling version. Runtime HTTP uses the platform fetch implementation, not this copy. |
| `zod`, `zod-to-json-schema` | high | Transitive schema tooling; fixes are available without a direct version change. |
| `markdownlint-cli` and its `markdownlint`, `katex`, `micromark-extension-math`, `smol-toml` tree | high / low | Documentation lint tool only. The fix is a semver-major jump to `markdownlint-cli` 0.50; deferred to keep docs CI output stable. |

The root `package.json` already carries targeted `overrides` for previously observed
transitive advisories (`@xmldom/xmldom`, `@babel/core`, `brace-expansion`, `glob`,
`js-yaml`, `minimatch`, `postcss`, `tar`, `undici` 6.x, `ws`, and others). `web/` and
`embed/` carry their own `socket.io-parser`, `ws`, and `nanoid` overrides.

## Stale code-scanning alerts

GitHub code scanning may still list older Trivy alerts whose most recent instance is
marked `fixed` on `main`. Those instances reference a 2025 commit and `external/Example-React-AI-Chat-App/`
lockfile paths that are not present in this repository. They are reconciled by the next
SARIF upload from `main`; they do not indicate a current vulnerability.

## Verification checklist

Run these before declaring the dependency state clean:

```bash
npm ci
npm run lint && npm run type-check
npm test && npm run web:test
npm run web:build && npm --prefix embed run build
trivy fs --scanners vuln --format sarif --output /tmp/trivy.sarif .
```
