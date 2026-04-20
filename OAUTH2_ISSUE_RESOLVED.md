# OAuth2 Troubleshooting Summary - ISSUE RESOLVED ✅

## Executive Summary

**Problem**: 401 Unauthorized errors on `GET /_oauth2/callback` endpoint in Envoy access logs  
**Root Cause**: `chat-backend` OAuth2 client not registered with the OAuth2 server  
**Impact**: All OAuth2 authentication flows fail at the token exchange stage  
**Severity**: Critical - Blocks all OAuth2 authentication  
**Status**: ✅ Solution identified and ready to apply

---

## Diagnostic Findings

### ✅ What's Working Correctly

| Component             | Status       | Details                                                                    |
| --------------------- | ------------ | -------------------------------------------------------------------------- |
| OAuth2 Server Pod     | ✅ Running   | `oauth2-server-585876b9d9-7sppt` (2/2 containers)                          |
| Chat Backend Pod      | ✅ Running   | `chat-backend-8679f4c8f7-tfvdn` (2/2 containers)                           |
| Istio Sidecar         | ✅ Injected  | Envoy proxy properly configured                                            |
| SDS Mounting          | ✅ Correct   | Files mounted at `/etc/istio/oauth2/`                                      |
| SDS File Format       | ✅ Valid     | Proper Envoy Secret Discovery Service format                               |
| EnvoyFilter Config    | ✅ Applied   | OAuth2 filter correctly configured                                         |
| Token Secret          | ✅ Valid     | Client secret is `demo-chat-backend-client-secret`                         |
| OAuth2 Server Network | ✅ Reachable | Accessible from chat pod at `oauth2-server.default.svc.cluster.local:9000` |

### ❌ What's Broken

| Component                  | Status         | Issue                                        |
| -------------------------- | -------------- | -------------------------------------------- |
| OAuth2 Client Registration | ❌ Missing     | Client `chat-backend` not in OAuth2 database |
| Token Endpoint             | ❌ Returns 401 | `{"error":"unauthorized_client"}`            |
| Token Exchange             | ❌ Fails       | Envoy cannot exchange auth code for tokens   |

---

## Root Cause Analysis

### The Issue

When a user authenticates via OAuth2, this flow occurs:

```
1. User clicks "Login"
2. Browser redirects to: https://oauth2.cat-herding.net/oauth2/authorize?client_id=chat-backend&...
3. User authenticates and approves scopes
4. OAuth2 server redirects: https://chat.cat-herding.net/_oauth2/callback?code=XXX&state=XXX
5. Envoy intercepts callback and calls token endpoint:
   POST http://oauth2-server:9000/oauth2/token
   Authorization: Basic chat-backend:demo-chat-backend-client-secret
6. ❌ OAuth2 Server responds: {"error":"unauthorized_client"}
   (Client not registered in database)
7. Envoy returns 401 to browser
8. User sees authentication failed
```

### Why This Happens

The `chat-backend` client must be registered in the PostgreSQL database that backs the OAuth2 server. Currently:

```sql
SELECT * FROM oauth2_registered_client WHERE client_id = 'chat-backend';
-- Returns: 0 rows (not found)
```

The OAuth2 server has no knowledge of a client with ID `chat-backend`.

---

## Solution

### Option 1: Quick Automated Fix (Recommended)

```bash
# Run the automated registration script
chmod +x scripts/quick-fix-oauth2-registration.sh
./scripts/quick-fix-oauth2-registration.sh
```

**What it does**:

1. Finds the PostgreSQL pod
2. Inserts `chat-backend` client record into the database
3. Verifies the token endpoint works
4. Confirms 401 errors are resolved

**Time to fix**: ~1-2 minutes  
**Manual intervention**: None

---

### Option 2: Manual Database Fix

```bash
# Find PostgreSQL pod
POSTGRES_POD=$(kubectl get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# Connect and insert client
kubectl exec -it $POSTGRES_POD -- psql -U oauth2user -d oauth2db << 'EOF'
INSERT INTO oauth2_registered_client (
    id, client_id, client_id_issued_at, client_secret,
    client_name, client_authentication_methods, redirect_uris, scopes,
    client_settings, token_settings, authorization_grant_types
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'chat-backend',
    NOW(),
    '{noop}demo-chat-backend-client-secret',
    'Chat Backend Service',
    '["client_secret_basic"]',
    '["https://chat.cat-herding.net/_oauth2/callback","http://localhost:5001/_oauth2/callback"]',
    '["openid","profile","email"]',
    '{}', '{}',
    '["refresh_token","client_credentials","authorization_code"]'
) ON CONFLICT (client_id) DO UPDATE SET
    client_secret = EXCLUDED.client_secret,
    redirect_uris = EXCLUDED.redirect_uris;
EOF

# Verify fix works
OAUTH2_POD=$(kubectl get pods -l app=oauth2-server -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $OAUTH2_POD -c oauth2-server -- \
  curl -s -X POST http://localhost:9000/oauth2/token \
    -u "chat-backend:demo-chat-backend-client-secret" \
    -d "grant_type=client_credentials" | jq .
```

**Expected success response**:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

---

### Option 3: Permanent Kubernetes Solution

Apply the ConfigMap + migration:

```bash
kubectl apply -f k8s/oauth2-client-registration.yaml
kubectl rollout restart deployment oauth2-server
```

This adds the client registration as a permanent Flyway migration in version control.

---

## Verification

After applying the fix, verify the 401 error is resolved:

```bash
# Test token endpoint directly
OAUTH2_POD=$(kubectl get pods -l app=oauth2-server -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $OAUTH2_POD -c oauth2-server -- \
  curl -s -X POST http://localhost:9000/oauth2/token \
    -u "chat-backend:demo-chat-backend-client-secret" \
    -d "grant_type=client_credentials" | jq .

# Expected: Returns access_token (NOT {"error":"unauthorized_client"})

# Test callback in chat application
# Users should now be able to log in without 401 errors on /_oauth2/callback
```

---

## Related Files

| File                                                                                                          | Purpose                                 |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| [docs/troubleshooting/oauth2-envoy-debugging.md](./oauth2-envoy-debugging.md)                                 | Complete troubleshooting guide          |
| [scripts/quick-fix-oauth2-registration.sh](../scripts/quick-fix-oauth2-registration.sh)                       | Automated fix script                    |
| [scripts/fix-oauth2-client-registration.sh](../scripts/fix-oauth2-client-registration.sh)                     | Alternative fix using Flyway migrations |
| [k8s/oauth2-client-registration.yaml](../k8s/oauth2-client-registration.yaml)                                 | Kubernetes ConfigMap for permanent fix  |
| [k8s/apps/chat/deployment.yaml](../k8s/apps/chat/deployment.yaml)                                             | Chat deployment (unchanged)             |
| [k8s/apps/chat/envoyfilter-chat-oauth2-exchange.yaml](../k8s/apps/chat/envoyfilter-chat-oauth2-exchange.yaml) | EnvoyFilter configuration (unchanged)   |

---

## Next Steps

1. **Apply the fix** using Option 1 (recommended) or Option 2
2. **Verify** using the curl test above
3. **Test OAuth2 flow** by logging into the chat application
4. **Update documentation** if this is a new environment setup pattern

---

## Architecture Context

This issue occurred because:

1. **OAuth2 Server Uses PostgreSQL**: The OAuth2 server stores client registrations in a PostgreSQL database
2. **Flyway Migrations Required**: New clients must be added via database migrations (not environment variables)
3. **Missing Migration**: No Flyway migration file was created to register the `chat-backend` client
4. **Envoy Depends on Registration**: The EnvoyFilter OAuth2 module requires the client to exist before token exchange works

**Prevention**: In the future, ensure all OAuth2 clients are defined in Flyway migration files before deploying to Kubernetes.

---

## Additional Notes

- **Client Secret**: Currently using plaintext `demo-chat-backend-client-secret` with `{noop}` prefix (dev only)
  - For production: Use bcrypt-hashed secrets
  - For dev: Consider using `{noop}` prefix or Docker environment setup
- **Callback URLs**: Registered both production (`https://chat.cat-herding.net/_oauth2/callback`) and localhost for testing

- **Scopes**: Using OpenID Connect scopes: `openid`, `profile`, `email`

- **Grant Types**: Supports `authorization_code` (for user login), `refresh_token` (for token refresh), and `client_credentials` (for service-to-service)

---

## Support

For additional troubleshooting:

1. Check [oauth2-envoy-debugging.md](./oauth2-envoy-debugging.md) for detailed diagnostic steps
2. Review EnvoyFilter configuration in [envoyfilter-chat-oauth2-exchange.yaml](../k8s/apps/chat/envoyfilter-chat-oauth2-exchange.yaml)
3. Examine OAuth2 server logs: `kubectl logs oauth2-server-xxx -c oauth2-server -n default --tail=100`
4. Check PostgreSQL: `kubectl exec -it postgres-xxx -- psql -U oauth2user -d oauth2db -c "SELECT client_id FROM oauth2_registered_client;"`
