#!/bin/bash
# OAuth2 Client Registration Fix Script
# This script registers the chat-backend client with the OAuth2 server

set -e

OAUTH2_POD="${1:-oauth2-server-585876b9d9-7sptt}"
NAMESPACE="${2:-default}"
CHAT_CLIENT_ID="${3:-chat-backend}"
CHAT_CLIENT_SECRET="${4:-demo-chat-backend-client-secret}"

echo "🔧 OAuth2 Client Registration Fix"
echo "=================================="
echo "Pod: $OAUTH2_POD"
echo "Namespace: $NAMESPACE"
echo "Client ID: $CHAT_CLIENT_ID"
echo ""

# Step 1: Verify oauth2-server is running
echo "✓ Step 1: Verifying OAuth2 server is running..."
if ! kubectl get pod "$OAUTH2_POD" -n "$NAMESPACE" &> /dev/null; then
    echo "❌ Pod not found: $OAUTH2_POD in namespace $NAMESPACE"
    exit 1
fi
echo "✓ OAuth2 server pod is running"
echo ""

# Step 2: Test current token endpoint (should fail with unauthorized_client)
echo "✓ Step 2: Testing current token endpoint..."
CURRENT_TEST=$(kubectl exec -it "$OAUTH2_POD" -n "$NAMESPACE" -c oauth2-server -- \
  curl -s -X POST http://localhost:9000/oauth2/token \
    -u "$CHAT_CLIENT_ID:$CHAT_CLIENT_SECRET" \
    -d "grant_type=client_credentials" 2>&1 || true)

if echo "$CURRENT_TEST" | grep -q "unauthorized_client"; then
    echo "✓ Confirmed: Client not registered (expected)"
    echo "  Response: $CURRENT_TEST"
elif echo "$CURRENT_TEST" | grep -q "access_token"; then
    echo "⚠️  Client already appears to be registered!"
    echo "  Response: ${CURRENT_TEST:0:100}..."
    exit 0
else
    echo "⚠️  Unexpected response: $CURRENT_TEST"
fi
echo ""

# Step 3: Create SQL migration file
echo "✓ Step 3: Creating Flyway migration file..."
MIGRATION_FILE="k8s/flyway-migrations/V003__register_chat_backend_client.sql"

mkdir -p "$(dirname "$MIGRATION_FILE")"

cat > "$MIGRATION_FILE" << 'EOF'
-- Register chat-backend as an OAuth2 client for Envoy filter integration
-- This client is used by the Envoy OAuth2 filter in the chat service

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
    '{"@class":"java.util.Collections$EmptyMap"}',
    '{"@class":"java.util.Collections$EmptyMap"}',
    '["refresh_token","client_credentials","authorization_code"]'
) ON CONFLICT DO NOTHING;
EOF

echo "✓ Created migration file: $MIGRATION_FILE"
echo ""

# Step 4: Apply changes to kubernetes
echo "✓ Step 4: Creating ConfigMap for migration..."
kubectl create configmap flyway-migrations-v3 \
  --from-file="$MIGRATION_FILE" \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -
echo "✓ ConfigMap updated"
echo ""

# Step 5: Restart oauth2-server to run migrations
echo "✓ Step 5: Restarting OAuth2 server to run migrations..."
kubectl rollout restart deployment oauth2-server -n "$NAMESPACE"
echo "✓ Deployment restarted"
echo ""

# Step 6: Wait for pod to be ready
echo "✓ Step 6: Waiting for pod to be ready (this may take a minute)..."
kubectl rollout status deployment/oauth2-server -n "$NAMESPACE" --timeout=5m || \
  echo "⚠️  Rollout status check timed out, but deployment may still be progressing"
echo ""

# Step 7: Verify the fix
echo "✓ Step 7: Verifying client registration..."
sleep 5  # Give server time to start fully

# Get the new pod name
NEW_POD=$(kubectl get pods -n "$NAMESPACE" -l app=oauth2-server \
  -o jsonpath='{.items[0].metadata.name}')

echo "  Testing with pod: $NEW_POD"
VERIFY_TEST=$(kubectl exec -it "$NEW_POD" -n "$NAMESPACE" -c oauth2-server -- \
  curl -s -X POST http://localhost:9000/oauth2/token \
    -u "$CHAT_CLIENT_ID:$CHAT_CLIENT_SECRET" \
    -d "grant_type=client_credentials" 2>&1 || true)

if echo "$VERIFY_TEST" | grep -q "access_token"; then
    echo "✅ SUCCESS: Client registered and token exchange working!"
    echo ""
    echo "Sample token response:"
    echo "$VERIFY_TEST" | jq . 2>/dev/null || echo "$VERIFY_TEST"
    exit 0
elif echo "$VERIFY_TEST" | grep -q "unauthorized_client"; then
    echo "❌ FAILED: Client still not registered"
    echo "  Response: $VERIFY_TEST"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check oauth2-server logs: kubectl logs $NEW_POD -c oauth2-server --tail=50"
    echo "2. Verify migration file was applied correctly"
    echo "3. Ensure database migrations ran successfully"
    exit 1
else
    echo "⚠️  Unexpected response:"
    echo "$VERIFY_TEST"
    exit 1
fi
