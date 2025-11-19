# Frontend GCS Deployment Guide

## Overview

This document explains the frontend deployment process to Google Cloud Storage (GCS) and how to verify the deployment is working correctly.

## Deployment Architecture

The frontend is deployed as a static website to GCS buckets:
- **Production**: `gs://chat-frontend` (deployed from `main` branch)
- **Development**: `gs://chat-frontend-dev` (deployed from feature branches)

## Deployment Process

### Automatic Deployment

The GitHub Actions workflow `.github/workflows/deploy-frontend.yaml` automatically deploys the frontend when:
1. Changes are pushed to the `main` branch
2. Changes are made to files in the `frontend/` directory or the workflow file itself

### Build Process

1. **Install Dependencies**: `npm ci` in the `frontend/` directory
2. **Build Application**: `npm run build` creates static files in `frontend/dist/`
3. **Generated Output**:
   - `index.html` - Main entry point
   - `_expo/static/js/` - JavaScript bundles
   - `assets/` - Images, fonts, and other static assets
   - Additional HTML files for routes (e.g., `_sitemap.html`, `+not-found.html`)

### Upload Process

The workflow uses `gcloud storage rsync` with the following flags:

```bash
gcloud storage rsync --recursive --delete-unmatched-destination-objects \
  --cache-control="public, max-age=3600" \
  frontend/dist gs://[BUCKET_NAME]
```

**Flags explained:**
- `--recursive`: Upload all files and subdirectories
- `--delete-unmatched-destination-objects`: Remove files in bucket that aren't in local directory (cleanup)
- `--cache-control="public, max-age=3600"`: Set cache headers (files cached for 1 hour)

### Setting Public Access

After uploading files, the workflow sets IAM policy to make the bucket publicly readable:

```bash
gcloud storage buckets add-iam-policy-binding gs://[BUCKET_NAME] \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

This allows anyone to access the website without authentication.

## Infrastructure Configuration

### GCS Bucket Configuration

Located in `k8s/apps/chat/base/frontend-bucket.yaml`:

```yaml
apiVersion: storage.cnrm.cloud.google.com/v1beta1
kind: StorageBucket
metadata:
  name: chat-frontend-prod
spec:
  location: US
  uniformBucketLevelAccess: true
  website:
    mainPageSuffix: index.html
    notFoundPage: index.html
```

**Key settings:**
- `mainPageSuffix: index.html` - Serves `index.html` for directory requests
- `notFoundPage: index.html` - SPA routing (all 404s go to index.html)
- `uniformBucketLevelAccess: true` - Consistent access control for all objects

### IAM Policy Configuration

Located in `k8s/apps/chat/base/frontend-bucket-iam.yaml`:

```yaml
apiVersion: iam.cnrm.cloud.google.com/v1beta1
kind: IAMPolicyMember
metadata:
  name: chat-frontend-prod-public-read
spec:
  member: allUsers
  role: roles/storage.objectViewer
  resourceRef:
    apiVersion: storage.cnrm.cloud.google.com/v1beta1
    kind: StorageBucket
    name: chat-frontend-prod
```

This declaratively manages the public read access policy.

## Verification Steps

### 1. Verify Workflow Execution

Check the GitHub Actions tab for the workflow run:
1. Go to `https://github.com/ianlintner/Example-React-AI-Chat-App/actions`
2. Find the "Deploy Frontend to GCS" workflow
3. Verify all steps completed successfully

### 2. Verify Files in GCS Bucket

Using gcloud CLI:

```bash
# List files in production bucket
gcloud storage ls gs://chat-frontend/

# Expected output should include:
# - index.html
# - _sitemap.html
# - +not-found.html
# - _expo/ directory
# - assets/ directory
```

### 3. Verify Public Access

Using gcloud CLI:

```bash
# Check bucket IAM policy
gcloud storage buckets get-iam-policy gs://chat-frontend

# Should include:
# - member: allUsers
# - role: roles/storage.objectViewer
```

### 4. Test Website Access

Access the website using the GCS website URL:

```bash
# Production
curl -I https://storage.googleapis.com/chat-frontend/index.html

# Or visit in browser
# https://storage.googleapis.com/chat-frontend/index.html
```

Expected response:
- Status: `200 OK`
- `cache-control: public, max-age=3600`
- `content-type: text/html`

### 5. Verify Cache Headers

Check that cache headers are properly set:

```bash
curl -I https://storage.googleapis.com/chat-frontend/index.html | grep cache-control
```

Expected: `cache-control: public, max-age=3600`

## Troubleshooting

### Issue: index.html not found in bucket

**Possible causes:**
1. Workflow didn't run (check GitHub Actions)
2. Build failed (check workflow logs)
3. Authentication failed (check GCP credentials)

**Solution:**
1. Verify workflow triggered on push to main
2. Check build logs for errors
3. Verify GCP secrets are configured correctly

### Issue: Files uploaded but not accessible

**Possible causes:**
1. IAM policy not set
2. Bucket not configured for website hosting

**Solution:**
1. Run IAM policy binding command manually:
   ```bash
   gcloud storage buckets add-iam-policy-binding gs://chat-frontend \
     --member=allUsers \
     --role=roles/storage.objectViewer
   ```
2. Verify bucket website configuration

### Issue: Old files not cleaned up

**Possible causes:**
1. `--delete-unmatched-destination-objects` flag not used

**Solution:**
1. Workflow now includes this flag
2. Manually clean up if needed:
   ```bash
   gcloud storage rm -r gs://chat-frontend/*
   # Then re-run deployment
   ```

## Cache Configuration

### Current Settings

- **Cache-Control**: `public, max-age=3600` (1 hour)
- All files have the same cache duration

### Recommendations for Production

Consider different cache durations for different file types:

1. **HTML files**: Short cache (1 hour) - allows quick updates
2. **JavaScript/CSS**: Long cache (1 year) - with content hash in filename
3. **Images**: Medium cache (1 week) - balance between performance and updates

This would require a more sophisticated upload script that sets different cache-control headers based on file type.

## Security Considerations

### Public Access

The bucket is configured for public read access because this is a static website. This is appropriate for:
- Marketing websites
- Documentation sites
- Public web applications

### HTTPS

When accessing via `storage.googleapis.com`, traffic is automatically encrypted with HTTPS.

### Content Security

- No sensitive data should be in the frontend build
- API keys should never be committed to the repository
- Backend API should handle authentication and authorization

## Maintenance

### Regular Tasks

1. **Monitor Workflow Runs**: Check GitHub Actions for failures
2. **Review Bucket Costs**: Monitor GCS storage and bandwidth costs in GCP Console
3. **Update Cache Headers**: Adjust cache duration based on update frequency

### Updating Deployment

To modify the deployment process:

1. Edit `.github/workflows/deploy-frontend.yaml`
2. Test changes in a feature branch first
3. Merge to main when verified

### Infrastructure Updates

To modify bucket configuration:

1. Edit files in `k8s/apps/chat/base/`
2. Apply using kubectl or your GitOps tool
3. Verify changes in GCP Console

## Performance Optimization

### Current Optimizations

1. **CDN**: BackendConfig enables Cloud CDN for fast global delivery
2. **Caching**: 1-hour cache reduces server requests
3. **Compression**: Expo builds include compressed assets

### Future Optimizations

1. Implement content-hash based filenames for long-term caching
2. Use different cache durations for different file types
3. Enable GZIP compression in transit
4. Implement pre-compression for large files

## Related Documentation

- [Expo Web Deployment](https://docs.expo.dev/distribution/publishing-websites/)
- [GCS Static Website Hosting](https://cloud.google.com/storage/docs/hosting-static-website)
- [GitHub Actions for GCP](https://github.com/google-github-actions/auth)
