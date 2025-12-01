# OAuth2 Proxy Sidecar Integration

This application now uses an OAuth2 Proxy sidecar to enforce GitHub OAuth authentication for all inbound traffic to `chat.cat-herding.net`.

## Flow
Internet → Istio Gateway → oauth2-proxy (port 4180) → chat-backend (port 5001)

## Key Changes
- Added `oauth2-proxy` container to `deployment.yaml` with health probes and securityContext.
- Updated primary `Service` (`chat-backend`) to route to port `4180` instead of `5001` so traffic is authenticated.
- Added auth annotations to the pod template:
  - `auth.cat-herding.net/provider: oauth2-proxy-sidecar`
  - `auth.cat-herding.net/domain: chat.cat-herding.net`
- Mounted shared cluster ConfigMaps: `oauth2-proxy-sidecar-config` and `oauth2-proxy-templates`.
- Referenced existing cluster Secret `oauth2-proxy-secret` for client ID, client secret, and cookie secret (no new SecretProviderClass needed).

## Environment Variables
The sidecar sets standard variables (client ID/secret, cookie secret, upstream, redirect URL) and enables passing auth headers:
- `OAUTH2_PROXY_UPSTREAMS=http://127.0.0.1:5001`
- `OAUTH2_PROXY_SET_AUTHORIZATION_HEADER=true`
- `OAUTH2_PROXY_SET_XAUTHREQUEST=true`
- `OAUTH2_PROXY_PASS_ACCESS_TOKEN=true`

## Health Probes
- Liveness & readiness: HTTP GET `/ping` on port 4180.

## Security
- Non-root user (`runAsUser: 2000`), read-only root filesystem, dropped ALL capabilities.
- Istio sidecar remains injected for mTLS and telemetry.

## WebSockets
Socket.io WebSocket endpoints continue to function via oauth2-proxy assuming user session is established; initial auth handshake redirects if unauthenticated.

## If Issues Occur
1. Check oauth2-proxy logs:
   ```bash
   kubectl logs -l app=chat-backend -c oauth2-proxy --tail=100
   ```
2. Verify service target port:
   ```bash
   kubectl get svc chat-backend -o yaml | grep targetPort
   ```
3. Confirm required secret:
   ```bash
   kubectl get secret oauth2-proxy-secret -o yaml
   ```
4. Validate ConfigMaps:
   ```bash
   kubectl get configmap oauth2-proxy-sidecar-config
   kubectl get configmap oauth2-proxy-templates
   ```

## Rollback
To temporarily disable auth, revert the `service.yaml` targetPort to `5001` and remove the oauth2-proxy container block from `deployment.yaml`.

---
Document generated automatically by GitHub Copilot aks-deploy agent.
