# Anonymous Users

The chat application supports two classes of callers:

- **Authenticated** — users who have signed in through the cluster's
  `oauth2-proxy` / `roauth2` flow. Identified by the `x-auth-subject`
  header injected by Istio at the chat-backend sidecar.
- **Anonymous** — users who have not signed in. Identified by an
  HttpOnly `_chat_anon` cookie containing a UUID v4. Minted by the
  backend on first request and refreshed on every subsequent one
  (8-hour rolling expiry).

The two tiers are distinguished downstream to drive rate limits,
LLM model selection, and UI gating.

## Backend

`backend/src/middleware/identity.ts` exposes a single `resolveIdentity`
Express middleware. It is applied to the public data routes
(`/api/chat`, `/api/conversations`, `/api/reactions`,
`/api/validation`, `/api/test-bench`, `/api/queue`) in
`backend/src/index.ts` in place of the stricter `authenticateToken`.

After the middleware runs, every request has:

- `req.user` — a `User` object. Authenticated users are persisted in
  `userStorage`; anonymous users are synthesized per-request as
  `anon_<uuid>` and **not** stored (to avoid unbounded growth from
  crawlers).
- `req.userId` — either the persisted user id or `anon_<uuid>`.
- `req.tier` — `'authenticated'` or `'anonymous'`.
- `req.isAnonymous` — boolean.

Strict endpoints (e.g. `/api/auth/me`) continue to use
`authenticateToken` from `backend/src/middleware/auth.ts`, which
returns 401 if the `x-auth-subject` header is missing.

The Socket.IO authentication middleware in
`backend/src/socket/socketHandlers.ts` mirrors the same model. When
no `x-auth-request-*` headers or JWT are present, the socket is
marked `tier = 'anonymous'` and — if the `_chat_anon` cookie is
present on the handshake — keyed as `anon_<uuid>` so rate-limit
buckets are stable across reconnects.

## Kubernetes — AuthorizationPolicy

`k8s/apps/chat/authorizationpolicy-chat.yaml` now permits
unauthenticated access to the public chat surface:

- `/api/chat`, `/api/chat/*`
- `/api/conversations`, `/api/conversations/*`
- `/api/reactions`, `/api/reactions/*`

Admin and operator surfaces (`/api/test-bench`, `/api/queue`,
`/api/validation`) remain gated on the authenticated `requestPrincipals`
rule.

## Kubernetes — Ingress Lua (external)

The ingress-level `EnvoyFilter` `secure-subdomain-oauth2-exchange` in
the `aks-istio-ingress` namespace currently redirects every
unauthenticated request on `chat.cat-herding.net` to the `oauth2-proxy`
sign-in page. For anonymous users to reach the backend, the Lua
`envoy_on_request` function needs to **pass through on 401 for the
chat authority** instead of returning a 302.

The patch is applied out-of-repo (the filter is shared cluster
infrastructure and lives in another repository). The required
change, in summary:

```lua
-- In envoy_on_request, after the httpCall:
if status == "401" then
  if authority == "chat.cat-herding.net"
      or authority == "chat.cat-herding.net:443" then
    -- Anonymous pass-through: let the request proceed without any
    -- x-auth-request-* or authorization headers. The chat backend's
    -- resolveIdentity middleware will mint/refresh a `_chat_anon`
    -- cookie and assign the anonymous tier.
    return
  end
  -- All other hosts: existing redirect behaviour.
  local rd = url_encode(original_url)
  local location = proto .. "://" .. authority .. OAUTH2_PREFIX .. "/start?rd=" .. rd
  request_handle:respond({
    [":status"] = "302",
    ["location"] = location,
  }, "")
  return
end
```

When the cluster filter has not yet been patched, anonymous traffic
to `chat.cat-herding.net` will still be redirected to sign-in. The
backend changes are safe to deploy first — authenticated users are
unaffected.

## Tier-driven behaviour

Downstream features key on `req.tier` / `socket.tier`:

- **Rate limits** — tier-specific quotas plus a global ceiling
  (see `backend/src/middleware/rateLimit.ts`).
- **LLM routing** — anonymous users are routed to the Azure AI
  Foundry free/low-cost tier; authenticated users receive premium
  models (see `backend/src/llm/`).
- **UI** — the web client shows a login banner to anonymous users
  prompting them to sign in for the HQ LLM.
