#!/bin/bash
set -euo pipefail

# Usage:
#   ./scripts/deploy-frontend.sh dev
#   ./scripts/deploy-frontend.sh prod
#
# Requires:
#   - gcloud CLI installed and authenticated
#   - npm installed
#   - Correct GCP project set via `gcloud config set project <PROJECT_ID>`

ENVIRONMENT=${1:-dev}

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]"
  exit 1
fi

BUCKET="chat-frontend"
if [[ "$ENVIRONMENT" == "dev" ]]; then
  BUCKET="chat-frontend-dev"
fi

echo "Building frontend for $ENVIRONMENT..."
pushd frontend > /dev/null
npm ci
npm run build
popd > /dev/null

echo "Deploying to GCS bucket: gs://$BUCKET"
gcloud storage rsync --recursive frontend/dist "gs://$BUCKET"

echo "Deployment to $ENVIRONMENT complete."
