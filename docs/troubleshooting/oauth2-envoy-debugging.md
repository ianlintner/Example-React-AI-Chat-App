# OAuth2 Envoy Filter Troubleshooting Guide

## Issue Summary

The chat pod is receiving a **401 Unauthorized** response on the OAuth2 callback endpoint (`/_oauth2/callback`), while traces are being successfully sent to the OTEL collector. The EnvoyFilter OAuth2 configuration is present but not properly handling the authentication flow.

### Error Signature

```
[2025-12-17T00:52:30.610Z] "GET /_oauth2/callback?code=...&state=... HTTP/1.1" 401 - ...
```

## ⚠️ ROOT CAUSE IDENTIFIED

**The `chat-backend` OAuth2 client is NOT registered with the OAuth2 server.**

### Diagnostic Evidence

1. **OAuth2 Server Status**: ✅ Running (`oauth2-server-585876b9d9-7sptt`)
2. **SDS Files**: ✅ Mounted (`/etc/istio/oauth2/chat-oauth-token.yaml`, `chat-oauth-hmac.yaml`)
3. **Credentials Format**: ✅ Valid SDS format with inline client secret
4. **Token Endpoint Test**: ❌ **FAILED** with `{"error":"unauthorized_client"}`
   ```bash
   curl -X POST http://localhost:9000/oauth2/token \
     -u chat-backend:demo-chat-backend-client-secret \
     -d "grant_type=client_credentials"
   # Response: {"error":"unauthorized_client"}
   ```

### Why This Causes 401 Errors

When a user visits the OAuth2 authorization endpoint:
1. User clicks "Login" → browser redirects to `https://oauth2.cat-herding.net/oauth2/authorize?client_id=chat-backend&...`
2. User authenticates and approves scope
3. Authorization server redirects back to: `https://chat.cat-herding.net/_oauth2/callback?code=XXX&state=XXX`
4. Envoy intercepts this callback and attempts token exchange
5. **OAuth2 server rejects the exchange because `chat-backend` client is not registered** → Returns 401
6. User receives 401 Unauthorized error

## Root Cause Analysis

### 1. **Chat-Backend Client Not Registered**

The OAuth2 server does not have a `chat-backend` client registered. This must be configured in the OAuth2 server's database (usually via Flyway migrations or admin API).

**Verification:**
```bash
# This client attempt fails
curl -X POST http://localhost:9000/oauth2/token \
  -u chat-backend:demo-chat-backend-client-secret \
  -d "grant_type=client_credentials"
# Returns: {"error":"unauthorized_client"}
```

### 2. **Envoy Filter Configuration Issues**

The current EnvoyFilter has several potential misconfigurations:

```yaml
token_endpoint:
  cluster: oauth2_token_cluster_chat
  uri: http://oauth2-server.default.svc.cluster.local:9000/oauth2/token  # HTTP!
  timeout: 5s
```

**Problem**: Using HTTP to talk to the OAuth2 server from within the cluster is acceptable, but the server must be reachable and listening.

### 3. **SDS Configuration Dependency**

The OAuth2 filter depends on SDS to mount:
- `/etc/istio/oauth2/chat-oauth-token.yaml`
- `/etc/istio/oauth2/chat-oauth-hmac.yaml`

These files must contain the client secret and HMAC key in the proper SDS format.

## Diagnostic Steps

### Step 1: Verify OAuth2 Server Is Running ✅ CONFIRMED

```bash
kubectl get pods -n default | grep oauth2-server
# Output: oauth2-server-585876b9d9-7sptt           2/2     Running   0          9m
```

**Status**: ✅ OAuth2 server pod is running and healthy.

### Step 2: Check SDS File Mounting ✅ CONFIRMED

```bash
kubectl exec -it chat-backend-8679f4c8f7-tfvdn -c chat-backend -- ls -la /etc/istio/oauth2/
```

**Output**:
```
-rw-r--r--  1 root root  196 Dec 16 12:52 chat-oauth-hmac.yaml
-rw-r--r--  1 root root  201 Dec 16 12:52 chat-oauth-token.yaml
```

**Status**: ✅ SDS credentials properly mounted in pod.

### Step 3: Verify Secret Format ✅ CONFIRMED

```bash
kubectl exec -it chat-backend-8679f4c8f7-tfvdn -c chat-backend -- cat /etc/istio/oauth2/chat-oauth-token.yaml
```

**Output**:
```yaml
resources:
- "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.Secret
  name: chat-oauth-token
  generic_secret:
    secret:
      inline_string: "demo-chat-backend-client-secret"
```

**Status**: ✅ SDS file format is correct.

### Step 4: Test Token Endpoint ❌ FAILED - ROOT CAUSE IDENTIFIED

```bash
kubectl exec -it oauth2-server-585876b9d9-7sppt -c oauth2-server -- \
  curl -X POST http://localhost:9000/oauth2/token \
    -u chat-backend:demo-chat-backend-client-secret \
    -d "grant_type=client_credentials"
```

**Response**: `{"error":"unauthorized_client"}`

**Status**: ❌ **CRITICAL**: Client `chat-backend` is not registered with the OAuth2 server.

## Common Fixes

### **FIX 1: Register the chat-backend Client with OAuth2 Server** ⭐ PRIMARY SOLUTION

The `chat-backend` client must be registered in the OAuth2 server. This is typically done via Flyway database migrations.

#### Option A: Add to Flyway Migrations (Recommended for Kubernetes)

Create a new migration file: `k8s/flyway-migrations/V003__register_chat_backend_client.sql`

```sql
-- Register chat-backend as an OAuth2 client
INSERT INTO oauth2_registered_client (
    id, client_id, client_id_issued_at, client_secret, client_secret_expires_at,
    client_name, client_authentication_methods, client_auth_methods_desc, 
    redirect_uris, redirect_uris_desc, scopes, scopes_desc,
    client_settings, token_settings, authorization_grant_types, auth_grant_types_desc
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'chat-backend',
    NOW(),
    '{noop}demo-chat-backend-client-secret',  -- Use {noop} for plaintext, or bcrypt hash
    NULL,
    'Chat Backend Service',
    '["client_secret_basic"]',
    'Client Secret (Basic Auth)',
    '["https://chat.cat-herding.net/_oauth2/callback","http://localhost:5001/_oauth2/callback"]',
    'OAuth2 callback endpoints',
    '["openid","profile","email"]',
    'OpenID Connect + Profile + Email',
    '{"@class":"java.util.Collections$EmptyMap"}',
    '{"@class":"java.util.Collections$EmptyMap"}',
    '["refresh_token","client_credentials","authorization_code"]',
    'Authorization Code Flow + Client Credentials'
) ON CONFLICT (client_id) DO UPDATE SET
    client_secret = EXCLUDED.client_secret,
    redirect_uris = EXCLUDED.redirect_uris;
```

Then restart the OAuth2 server:
```bash
kubectl rollout restart deployment oauth2-server -n default
```

#### Option B: Register via Admin API (Temporary/Testing)

If the OAuth2 server has an admin API endpoint:
```bash
curl -X POST http://localhost:9000/oauth2/admin/clients \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "chat-backend",
    "client_secret": "demo-chat-backend-client-secret",
    "client_name": "Chat Backend Service",
    "redirect_uris": [
      "https://chat.cat-herding.net/_oauth2/callback",
      "http://localhost:5001/_oauth2/callback"
    ],
    "scopes": ["openid", "profile", "email"],
    "grant_types": ["authorization_code", "client_credentials", "refresh_token"]
  }'
```

#### Verification After Fix

```bash
# Test the token endpoint again
curl -X POST http://localhost:9000/oauth2/token \
  -u chat-backend:demo-chat-backend-client-secret \
  -d "grant_type=client_credentials"

# Expected response (NOT the error):
# {
#   "access_token": "eyJhbGc...",
#   "expires_in": 3600,
#   "token_type": "Bearer"
# }
```

### Fix 2: Verify SDS Credentials (Already Confirmed ✅)

The SDS file verification shows credentials ARE properly mounted:

```bash
$ cat /etc/istio/oauth2/chat-oauth-token.yaml
resources:
- "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.Secret
  name: chat-oauth-token
  generic_secret:
    secret:
      inline_string: "demo-chat-backend-client-secret"
```

✅ **Status**: SDS configuration is correct.

### Fix 3: Quick Automated Fix (Recommended)

Run the automated registration script:

```bash
# Make the script executable
chmod +x scripts/quick-fix-oauth2-registration.sh

# Run it (will find PostgreSQL pod automatically)
./scripts/quick-fix-oauth2-registration.sh
```

This script will:
1. Connect to PostgreSQL
2. Insert the `chat-backend` client record
3. Verify the OAuth2 token endpoint works
4. Confirm the fix resolved the 401 error

### Fix 4: Manual Registration (If Script Fails)

```bash
# Connect to PostgreSQL pod
POSTGRES_POD=$(kubectl get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# Run the INSERT command
kubectl exec -it $POSTGRES_POD -- psql -U oauth2user -d oauth2db << 'EOF'
INSERT INTO oauth2_registered_client (
    id, 
    client_id, 
    client_id_issued_at, 
    client_secret, 
    client_secret_expires_at,
    client_name, 
    client_authentication_methods, 
    redirect_uris, 
    scopes,
    client_settings, 
    token_settings, 
    authorization_grant_types
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'chat-backend',
    NOW(),
    '{noop}demo-chat-backend-client-secret',
    NULL,
    'Chat Backend Service',
    '["client_secret_basic"]',
    '["https://chat.cat-herding.net/_oauth2/callback","http://localhost:5001/_oauth2/callback"]',
    '["openid","profile","email"]',
    '{}',
    '{}',
    '["refresh_token","client_credentials","authorization_code"]'
) ON CONFLICT (client_id) DO UPDATE SET
    client_secret = EXCLUDED.client_secret,
    redirect_uris = EXCLUDED.redirect_uris;
EOF

# Verify
OAUTH2_POD=$(kubectl get pods -l app=oauth2-server -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $OAUTH2_POD -c oauth2-server -- \
  curl -X POST http://localhost:9000/oauth2/token \
    -u "chat-backend:demo-chat-backend-client-secret" \
    -d "grant_type=client_credentials"
```

Expected successful response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### Fix 5: Permanent Solution - Add Flyway Migration

Create [k8s/oauth2-client-registration.yaml](../../k8s/oauth2-client-registration.yaml) and apply:

```bash
kubectl apply -f k8s/oauth2-client-registration.yaml
kubectl rollout restart deployment oauth2-server
```

This ensures the client registration persists across pod restarts and is version-controlled.

## Recommended Diagnostic Command Sequence

```bash
#!/bin/bash
set -e

CHAT_POD="chat-backend-8679f4c8f7-tfvdn"
NAMESPACE="default"

echo "=== 1. Check if oauth2-server exists ==="
kubectl get pods -n $NAMESPACE | grep oauth2 || echo "⚠️  oauth2-server not found"

echo ""
echo "=== 2. Check SDS mount in proxy ==="
kubectl exec -it "$CHAT_POD" -c istio-proxy -- \
  ls -la /etc/istio/oauth2/ 2>&1 || echo "⚠️  SDS files not mounted"

echo ""
echo "=== 3. Test connectivity to oauth2-server ==="
kubectl exec -it "$CHAT_POD" -c istio-proxy -- \
  curl -v --connect-timeout 5 http://oauth2-server.default.svc.cluster.local:9000/health \
  2>&1 | head -20 || echo "⚠️  Cannot reach oauth2-server"

echo ""
echo "=== 4. Check Envoy OAuth2 filter config ==="
kubectl exec -it "$CHAT_POD" -c istio-proxy -- \
  curl -s localhost:15000/config_dump 2>/dev/null | \
  jq '.configs[]? | select(.name | contains("chat-oauth"))' || echo "⚠️  OAuth2 filter not found in config"

echo ""
echo "=== 5. Check Secrets ==="
kubectl get secret -n $NAMESPACE | grep oauth || echo "⚠️  OAuth secrets not found"

echo ""
echo "=== 6. Check istio-proxy logs ==="
kubectl logs "$CHAT_POD" -c istio-proxy --tail=20 -n $NAMESPACE 2>&1 | grep -i oauth || echo "ℹ️  No OAuth-related logs found"
```

## Prevention & Best Practices

1. **Test OAuth2 locally first** - Use docker-compose to verify the flow before deploying to Kubernetes
2. **Monitor token endpoint** - Add Prometheus metrics to track token exchange success/failure
3. **Add request authentication** - Use `RequestAuthentication` alongside OAuth2 for better debugging
4. **Document credentials** - Clearly document where client secrets come from (KeyVault, external OAuth2 provider, etc.)
5. **Implement fallback** - Consider allowing unauthenticated requests to health/ready endpoints as passthrough matchers show

## Related Configuration Files

- [EnvoyFilter OAuth2 Exchange](../../k8s/apps/chat/envoyfilter-chat-oauth2-exchange.yaml)
- [EnvoyFilter JWT to Headers](../../k8s/apps/chat/envoyfilter-chat-jwt-to-headers.yaml)
- [Secret Provider OAuth2](../../k8s/apps/chat/secret-provider-oauth2.yaml)
- [Deployment Configuration](../../k8s/apps/chat/deployment.yaml)

## Support Resources

- [Envoy OAuth2 Filter Documentation](https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/filters/http/oauth2/v3/oauth2.proto)
- [Istio EnvoyFilter Guide](https://istio.io/latest/docs/reference/config/networking/envoy-filter/)
- [Secret Discovery Service (SDS)](https://istio.io/latest/docs/concepts/security/)
