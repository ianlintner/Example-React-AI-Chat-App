#!/bin/bash
# Quick Fix: Register chat-backend OAuth2 Client
# This script adds the chat-backend client directly to the PostgreSQL database

set -e

echo "🔧 OAuth2 Client Registration - Direct Database Fix"
echo "===================================================="
echo ""

# Configuration
OAUTH2_POD="oauth2-server-585876b9d9-7sptt"
NAMESPACE="default"
POSTGRES_POD="postgres-0"  # Adjust if your postgres pod name is different

# Step 1: Find postgres pod
echo "Step 1: Finding PostgreSQL pod..."
POSTGRES_POD=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [ -z "$POSTGRES_POD" ]; then
    echo "⚠️  PostgreSQL pod not found, trying 'postgres' label..."
    POSTGRES_POD=$(kubectl get pods -n "$NAMESPACE" | grep postgres | awk '{print $1}' | head -1)
fi

if [ -z "$POSTGRES_POD" ]; then
    echo "❌ Could not find PostgreSQL pod"
    echo "Try running manually:"
    echo "  kubectl get pods -n $NAMESPACE | grep postgres"
    exit 1
fi

echo "✓ Found PostgreSQL pod: $POSTGRES_POD"
echo ""

# Step 2: Create the SQL insertion command
SQL_COMMAND="
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
    '[\"client_secret_basic\"]',
    '[\"https://chat.cat-herding.net/_oauth2/callback\",\"http://localhost:5001/_oauth2/callback\"]',
    '[\"openid\",\"profile\",\"email\"]',
    '{}',
    '{}',
    '[\"refresh_token\",\"client_credentials\",\"authorization_code\"]'
) ON CONFLICT (client_id) DO UPDATE SET
    client_secret = EXCLUDED.client_secret,
    redirect_uris = EXCLUDED.redirect_uris
RETURNING client_id, client_name;
"

echo "Step 2: Registering chat-backend client in PostgreSQL..."
echo "SQL: $SQL_COMMAND"
echo ""

# Step 3: Execute the SQL command
echo "Step 3: Executing SQL insert..."
kubectl exec -it "$POSTGRES_POD" -n "$NAMESPACE" -- \
  psql -U oauth2user -d oauth2db -c "$SQL_COMMAND" 2>&1 || {
    echo "❌ SQL execution failed"
    echo "Troubleshooting:"
    echo "  1. Get postgres credentials: kubectl get secret oauth2-app-secrets -o yaml"
    echo "  2. Exec into postgres: kubectl exec -it $POSTGRES_POD -- psql -U oauth2user -d oauth2db"
    echo "  3. Run the SQL manually"
    exit 1
}

echo "✓ Client registered successfully"
echo ""

# Step 4: Verify the registration
echo "Step 4: Verifying registration in OAuth2 server..."
sleep 2  # Give database time to sync

VERIFY_RESULT=$(kubectl exec -it "$OAUTH2_POD" -n "$NAMESPACE" -c oauth2-server -- \
  curl -s -X POST http://localhost:9000/oauth2/token \
    -u "chat-backend:demo-chat-backend-client-secret" \
    -d "grant_type=client_credentials" 2>&1 || true)

if echo "$VERIFY_RESULT" | grep -q "access_token"; then
    echo "✅ SUCCESS: OAuth2 client registration verified!"
    echo ""
    echo "Token endpoint is now working:"
    echo "$VERIFY_RESULT" | jq . 2>/dev/null || echo "$VERIFY_RESULT"
    echo ""
    echo "The 401 errors on /_oauth2/callback should now resolve."
    exit 0
else
    echo "⚠️  Token endpoint still returning errors"
    echo "Response: $VERIFY_RESULT"
    echo ""
    echo "Next steps:"
    echo "  1. Check PostgreSQL logs: kubectl logs $POSTGRES_POD -n $NAMESPACE"
    echo "  2. Verify client exists: kubectl exec -it $POSTGRES_POD -- psql -U oauth2user -d oauth2db -c \"SELECT client_id, client_name FROM oauth2_registered_client WHERE client_id='chat-backend';\""
    echo "  3. Check OAuth2 logs: kubectl logs $OAUTH2_POD -c oauth2-server -n $NAMESPACE --tail=50"
    exit 1
fi
