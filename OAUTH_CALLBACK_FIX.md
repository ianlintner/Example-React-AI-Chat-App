# OAuth Callback URL Fix

## Issue

OAuth callbacks were redirecting to `localhost:5001` in production instead of the production domain `https://chat.hugecat.net`.

## Root Cause

The OAuth callback URLs were not properly configured in the Kubernetes ConfigMap. The backend was using hardcoded defaults (`localhost:5001`) instead of the production URLs.

## Changes Made

### 1. Updated Kubernetes ConfigMap

**File:** `k8s/apps/chat/overlays/azure/configmap.yaml`

Added OAuth callback URLs to the ConfigMap:

```yaml
# OAuth Configuration
GITHUB_CALLBACK_URL: 'https://chat.hugecat.net/api/auth/github/callback'
GOOGLE_CALLBACK_URL: 'https://chat.hugecat.net/api/auth/google/callback'
FRONTEND_URL: 'https://chat.hugecat.net'
```

### 2. Updated Documentation

**File:** `backend/.env.example`

Added production URL examples:

```bash
# For production (example):
# GITHUB_CALLBACK_URL=https://chat.hugecat.net/api/auth/github/callback
# GOOGLE_CALLBACK_URL=https://chat.hugecat.net/api/auth/google/callback
# FRONTEND_URL=https://chat.hugecat.net
```

**File:** `AUTH_SETUP_GUIDE.md`

Added troubleshooting guidance for OAuth callback URL issues.

### 3. Applied Changes

```bash
# Applied ConfigMap update
kubectl apply -f k8s/apps/chat/overlays/azure/configmap.yaml

# Restarted backend pods to pick up new environment variables
kubectl rollout restart deployment/chat-backend
```

## Verification

Confirmed the environment variables are correctly set in the running pods:

```bash
GITHUB_CALLBACK_URL=https://chat.hugecat.net/api/auth/github/callback
GOOGLE_CALLBACK_URL=https://chat.hugecat.net/api/auth/google/callback
FRONTEND_URL=https://chat.hugecat.net
```

## Next Steps

### Update OAuth Provider Settings

You must also update the callback URLs in your OAuth provider configurations:

#### GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Select your OAuth app
3. Update **Authorization callback URL** to: `https://chat.hugecat.net/api/auth/github/callback`

#### Google OAuth Client

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Select your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**: `https://chat.hugecat.net/api/auth/google/callback`

### Testing

1. Try logging in with GitHub: `https://chat.hugecat.net/api/auth/github?mobile=true&redirect_uri=https://chat.hugecat.net/auth/callback`
2. Try logging in with Google: `https://chat.hugecat.net/api/auth/google?mobile=true&redirect_uri=https://chat.hugecat.net/auth/callback`
3. Verify successful authentication and token generation

## How OAuth Flow Works

1. **Frontend** initiates OAuth by navigating to: `/api/auth/{provider}?mobile=true&redirect_uri={app_callback}`
2. **Backend** redirects to OAuth provider (GitHub/Google) using the `CALLBACK_URL` from environment
3. **OAuth Provider** authenticates user and redirects back to the backend callback URL
4. **Backend** processes the OAuth response, generates JWT token, and redirects to `FRONTEND_URL` or returns JSON (for mobile)
5. **Frontend** receives token and stores it for authenticated requests

## Related Files

- `backend/src/services/authService.ts` - OAuth strategy configuration
- `backend/src/routes/auth.ts` - OAuth callback handlers
- `frontend/services/authService.ts` - Frontend OAuth initiation
- `k8s/apps/chat/overlays/azure/configmap.yaml` - Production environment configuration

## Status

✅ Fixed - OAuth callbacks now correctly use production URLs
