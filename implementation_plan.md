# Implementation Plan

[Overview]  
Migrate the frontend from a Kubernetes pod deployment to a static hosting model using Google Cloud Storage (GCS) buckets with Cloud CDN, accessible at `chat-ui.hugecat.net`.

This change reduces operational overhead, improves scalability, and leverages CDN caching for faster global delivery. The backend remains in Kubernetes, while the frontend build artifacts are pushed to GCS buckets for both `dev` and `prod` environments. Cloud CDN will serve the assets, and DNS will be updated to point `chat-ui.hugecat.net` to the CDN endpoint.

[Types]  
No new application-level types are required. Infrastructure manifests will define GCP resources.

[Files]  
We will add new Kubernetes Config Connector manifests to provision GCS buckets, IAM bindings, and Cloud CDN backends.

- **New files**:
  - `k8s/apps/chat/base/frontend-bucket.yaml`  
    Defines a GCS bucket for static frontend hosting.
  - `k8s/apps/chat/base/frontend-backendconfig.yaml`  
    Defines Cloud CDN backend service for the bucket.
  - `k8s/apps/chat/overlays/prod/frontend-bucket-patch.yaml`  
    Patches bucket name for production.
  - `k8s/apps/chat/overlays/dev/frontend-bucket-patch.yaml`  
    Patches bucket name for development.
  - `k8s/apps/chat/overlays/prod/dns-records-frontend.yaml`  
    DNS record for `chat-ui.hugecat.net`.

- **Modified files**:
  - `k8s/apps/chat/base/kustomization.yaml` → include new bucket and CDN manifests.
  - `k8s/apps/chat/overlays/prod/kustomization.yaml` → include prod patches.
  - `k8s/apps/chat/overlays/dev/kustomization.yaml` → include dev patches.
  - Remove `patch-deployment-frontend.yaml` from overlays since frontend pod is no longer needed.

[Functions]  
No application functions are modified. CI/CD pipeline will be updated to build frontend and sync artifacts to the GCS bucket.

- **New CI/CD step**:
  - `npm run build` in `frontend/`
  - Use `gcloud storage rsync` to push build artifacts:
    - `gcloud storage rsync ./dist gs://chat-frontend-prod --recursive` (for prod)
    - `gcloud storage rsync ./dist gs://chat-frontend-dev --recursive` (for dev)

[Classes]  
No new classes are required. No modifications to existing application classes.

[Dependencies]

- Remove dependency on Nginx container for frontend.
- Add dependency on GCP Cloud Storage and Cloud CDN.
- Ensure `ConfigConnector` is enabled in the cluster for GCS and CDN resources.

[Testing]

- Validate that `chat-ui.hugecat.net` serves the built frontend.
- Confirm `/api` routes still go through Istio to backend.
- Test cache invalidation by updating assets and verifying CDN refresh.
- Validate both `dev` and `prod` buckets serve correct builds.

[Implementation Order]

1. Create GCS bucket manifests for dev and prod.
2. Add Cloud CDN backend configuration.
3. Update DNS to point `chat-ui.hugecat.net` to CDN.
4. Remove frontend pod deployment from Kubernetes.
5. Update CI/CD pipeline to push frontend build artifacts to GCS.
6. Validate deployment in dev environment.
7. Roll out to prod and validate.
8. Decommission old frontend pod resources.
