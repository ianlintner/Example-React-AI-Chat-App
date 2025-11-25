# Multi-stage build for combined Frontend + Backend
# Stage 1: Build Frontend (Expo Web)
FROM node:24-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend for web
RUN npm run build

# Stage 2: Build Backend (TypeScript)
FROM node:24-alpine AS backend-builder

WORKDIR /backend

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm ci

# Copy shared types first
COPY shared/ /shared/

# Copy backend source
COPY backend/ ./

# Build backend TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 3: Production - Combined Frontend + Backend
FROM node:24-alpine AS production

# Install dumb-init and curl for proper signal handling and health checks
RUN apk add --no-cache dumb-init curl

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy backend built application
COPY --from=backend-builder --chown=nodejs:nodejs /backend/dist ./dist
COPY --from=backend-builder --chown=nodejs:nodejs /backend/node_modules ./node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /backend/package*.json ./

# Copy frontend built application
COPY --from=frontend-builder --chown=nodejs:nodejs /frontend/dist ./public

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/backend/src/index.js"]
