# Combined Frontend/Backend Docker Image Implementation

## Summary

This implementation combines the frontend and backend into a single Docker image, eliminating the need for separate GCS bucket hosting and simplifying deployment.

## Changes Made

### 1. New Combined Dockerfile (`/Dockerfile`)

Created a multi-stage Dockerfile that:

- **Stage 1 (frontend-builder)**: Builds the React Native web frontend using Expo
- **Stage 2 (backend-builder)**: Compiles TypeScript backend to JavaScript
- **Stage 3 (production)**: Combines both into a single production image
  - Serves backend API on port 5001
  - Serves frontend static files from `/public` directory

### 2. Backend Updates (`backend/src/index.ts`)

Modified the Express server to serve frontend static files:

```typescript
import path from 'path';

// Serve static frontend files
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes, health checks, metrics, docs, and socket.io
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/health') ||
    req.path.startsWith('/metrics') ||
    req.path.startsWith('/docs')
  ) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});
```

Also updated CORS configuration to include same-origin (http://localhost:5001) for local testing.

### 3. Kubernetes Manifests

#### Updated `k8s/apps/chat/base/kustomization.yaml`

- Commented out `frontend-bucket.yaml`
- Commented out `frontend-bucket-iam.yaml`
- These resources are no longer needed as frontend is served from the backend pod

#### Updated `k8s/apps/chat/base/istio-gateway.yaml`

- Added `chat-ui.hugecat.net` to the list of hosts
- Both backend and frontend domains now route through the same gateway

#### Updated `k8s/apps/chat/base/istio-virtualservice.yaml`

- Added `chat-ui.hugecat.net` to the list of hosts
- All traffic to both domains routes to the backend pod

#### Updated `k8s/apps/chat/overlays/prod/dns-records-frontend.yaml`

- Changed from CNAME pointing to CDN (`chat-frontend-cdn.endpoints.hugecat.net`)
- Changed to A record pointing to cluster ingress IP (`34.31.128.59`)
- Frontend now resolves to the same cluster as backend

### 4. CI/CD Workflow (`github/workflows/ci-optimized.yml`)

Updated Docker build jobs:

- Removed matrix strategy that built separate backend and frontend images
- Now builds single combined image from root Dockerfile
- Image name remains `chat-backend` for backward compatibility
- GAR image: `{GCP_ARTIFACT_REGION}-docker.pkg.dev/{GCP_PROJECT_ID}/kame-house-images/chat-backend`
- Docker Hub image: `ianlintner068/example-react-ai-chat-app`

### 5. Docker Compose (`docker-compose.yml`)

Updated to use combined service:

- Renamed service from separate `backend` and `frontend` to single `backend` service
- Build context changed from `./backend` to `.` (root directory)
- Dockerfile path changed to root `Dockerfile`
- Port 8080 now maps to 5001 (same as backend port)
- Removed separate `frontend` service

### 6. Frontend Deployment Workflow

Disabled `.github/workflows/deploy-frontend.yaml`:

- Renamed to `.github/workflows/deploy-frontend.yaml.disabled`
- This workflow deployed frontend to GCS bucket, which is no longer needed

### 7. Docker Ignore (`.dockerignore`)

Added comprehensive `.dockerignore` file to:

- Exclude unnecessary files from Docker build context
- Speed up Docker builds
- Reduce image size
- Exclude: node_modules, tests, docs, CI/CD files, etc.

## Architecture Changes

### Before

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌────────────┐  ┌──────────┐
│  GCS CDN   │  │ Backend  │
│ (Frontend) │  │   Pod    │
└────────────┘  └──────────┘
```

### After

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│   Combined Pod       │
│  ┌────────────────┐  │
│  │ Express Server │  │
│  │  - API Routes  │  │
│  │  - Static FE   │  │
│  └────────────────┘  │
└──────────────────────┘
```

## Benefits

1. **Simplified Deployment**: Single Docker image instead of separate frontend bucket and backend deployment
2. **No CDN Dependency**: No need to manage GCS bucket, IAM policies, or CDN configuration
3. **Single Ingress Point**: All traffic goes through Istio ingress gateway to backend pod
4. **Reduced Infrastructure**: Fewer resources to manage in Kubernetes
5. **Same-Origin Serving**: No CORS issues between frontend and backend
6. **Atomic Deployments**: Frontend and backend are always in sync

## Testing

### Local Testing with Docker

```bash
# Build the combined image
docker build -t chat-app:test .

# Run locally
docker run -p 5001:5001 chat-app:test

# Access frontend at http://localhost:5001
# Access API at http://localhost:5001/api/*
```

### Local Testing with Docker Compose

```bash
# Start all services
docker-compose up

# Access frontend at http://localhost:5001 or http://localhost:8080
# Access API at http://localhost:5001/api/*
```

## Deployment to Kubernetes

After merging this PR:

1. CI/CD will automatically build and push the combined image
2. Update the deployment in Kubernetes:
   ```bash
   kubectl rollout restart deployment/chat-backend -n prod
   ```
3. Apply updated Kubernetes manifests:
   ```bash
   kubectl apply -k k8s/apps/chat/overlays/prod/
   ```
4. DNS changes will take effect within TTL (300 seconds)

## Verification Steps

1. **Check Image Build**: Verify CI/CD successfully builds combined image
2. **Check Pod Status**: Ensure backend pod is running with new image
3. **Check Frontend Access**: Visit `https://chat-ui.hugecat.net`
4. **Check Backend API**: Visit `https://chat-backend.hugecat.net/api/health`
5. **Check DNS Resolution**: Verify DNS points to cluster ingress
   ```bash
   dig chat-ui.hugecat.net
   ```

## Rollback Plan

If issues occur, rollback is straightforward:

1. Revert this PR
2. Re-enable frontend GCS deployment workflow
3. Restore previous Kubernetes manifests
4. Redeploy previous backend image

## Security Considerations

- Static file serving is not rate-limited (acceptable for demo app)
- All API routes remain protected as before
- CORS configuration updated to allow same-origin requests
- No new security vulnerabilities introduced

## Known Issues

None currently known.

## Future Improvements

1. Add rate limiting for static file serving
2. Implement CDN caching at Istio ingress level
3. Add health check for static file serving
4. Optimize Docker image size further

## References

- [Express Static Files Documentation](https://expressjs.com/en/starter/static-files.html)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Istio Virtual Service](https://istio.io/latest/docs/reference/config/networking/virtual-service/)
