#!/usr/bin/env bash
set -euo pipefail

# Ensure backend/.env and frontend/.env exist so docker-compose env_file paths don't fail.
# - If .env.example exists, copy it.
# - Otherwise create a minimal fallback suitable for CI/local dev.
# Idempotent: won't overwrite existing .env files.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$ROOT_DIR"

echo "Preparing environment files..."

# Backend
if [ -f backend/.env ]; then
  echo "backend/.env already exists"
elif [ -f backend/.env.example ]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env from backend/.env.example"
else
  {
    echo "NODE_ENV=test"
    echo "PORT=5001"
    echo "FRONTEND_URL=http://localhost:8080"
    echo "OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318"
    echo "ENABLE_TRACING=true"
    echo "ENABLE_METRICS=true"
    echo "LOG_LEVEL=info"
    # Provide empty/placeholder secrets to avoid runtime crashes
    echo "OPENAI_API_KEY="
    echo "MONGODB_URI=mongodb://localhost:27017/ai-chat"
    echo "JWT_SECRET=dev_jwt_secret"
  } > backend/.env
  echo "Created minimal backend/.env"
fi

# Frontend (optional)
if [ -f frontend/.env ]; then
  echo "frontend/.env already exists"
elif [ -f frontend/.env.example ]; then
  cp frontend/.env.example frontend/.env
  echo "Created frontend/.env from frontend/.env.example"
else
  {
    echo "NODE_ENV=development"
    echo "REACT_APP_API_URL=http://localhost:5001"
    echo "REACT_APP_SOCKET_URL=http://localhost:5001"
  } > frontend/.env
  echo "Created minimal frontend/.env"
fi

echo "Environment preparation complete."
