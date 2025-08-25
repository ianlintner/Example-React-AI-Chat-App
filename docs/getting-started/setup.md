# Complete Setup Guide

**Comprehensive development environment setup for the AI Chat Application.**

## Overview

This guide covers the complete setup process for local development, from installing prerequisites to configuring advanced development tools. Choose your preferred setup method based on your development needs.

**Target Audience:** Developers, contributors, and team members setting up local development environments  
**Estimated Time:** 15-30 minutes depending on your system and chosen method

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 18+ | Backend runtime and frontend tooling |
| **npm/yarn** | Latest | Package management |
| **Git** | Latest | Version control |
| **Docker** | Latest | Container orchestration (optional) |

### Platform Support

- ✅ **macOS** (Intel/Apple Silicon)
- ✅ **Linux** (Ubuntu 20.04+, other distributions)
- ✅ **Windows** (10/11 with WSL2 recommended)

### Mobile Development (Optional)

- **iOS Development:** Xcode 12+ (macOS only)
- **Android Development:** Android Studio + SDK
- **Mobile Testing:** Physical device or emulator
- **Expo Go App:** Available on iOS/Android app stores

## Setup Methods

### Method 1: Docker Development (Recommended)

**Pros:** Isolated environment, all services included, minimal setup  
**Cons:** Higher resource usage, less debugging flexibility

```bash
# 1. Clone repository
git clone <repository-url>
cd <project-directory>

# 2. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Configure environment variables (optional)
# Edit backend/.env for OpenAI API key
# OPENAI_API_KEY=your_key_here

# 4. Start all services
docker-compose up -d

# 5. Verify services
docker-compose ps
```

**Services Running:**
- 🚀 Backend API: http://localhost:5001
- 📊 Prometheus: http://localhost:9090  
- 📈 Grafana: http://localhost:3000
- 🔍 Jaeger: http://localhost:16686
- 📱 Frontend: Expo development server

### Method 2: Local Development

**Pros:** Full debugging control, faster iteration, native tooling  
**Cons:** Requires manual service management, more complex setup

#### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install
# or
yarn install

# 3. Environment configuration
cp .env.example .env

# 4. Configure environment variables (see Environment Configuration section)

# 5. Start development server
npm run dev
# ✅ Backend running on http://localhost:5001
```

#### Frontend Setup (React Native/Expo)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install
# or
yarn install

# 3. Environment configuration (optional)
cp .env.example .env

# 4. Start Expo development server
npm start
# ✅ Expo Dev Tools opens in browser
# 📱 Use Expo Go app to scan QR code
```

#### Supporting Services (Optional)

For full observability stack:

```bash
# Start supporting services only
docker-compose up -d prometheus grafana jaeger

# Or install locally (advanced)
# See docs/operations/observability.md
```

## Environment Configuration

### Backend Environment Variables

Create `backend/.env` with the following configuration:

```bash
# Server Configuration
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:8081

# AI Integration (Optional)
OPENAI_API_KEY=your_openai_api_key_here

# Database (Future)
DATABASE_URL=postgresql://localhost:5432/aicha

# Observability
ENABLE_TRACING=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces
PROMETHEUS_PORT=9464

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
```

### Frontend Environment Variables

Create `frontend/.env` with the following configuration:

```bash
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:5001

# Development Settings
EXPO_PUBLIC_DEV_MODE=true
EXPO_PUBLIC_DEBUG_LOGGING=true
```

### OpenAI API Key Setup (Optional)

**For AI Functionality:**
1. Sign up at https://openai.com/api
2. Generate an API key
3. Add to `backend/.env`: `OPENAI_API_KEY=your_key_here`

**Demo Mode:**
- System works without OpenAI API key
- Uses pre-curated content from RAG system
- Perfect for development and testing

## Development Workflow

### Daily Development Commands

```bash
# Backend Development
cd backend
npm run dev          # Start dev server with hot reload
npm run test         # Run test suite
npm run lint         # Check code quality
npm run build        # Build for production

# Frontend Development  
cd frontend
npm start            # Start Expo dev server
npm run android      # Run on Android device/emulator
npm run ios          # Run on iOS device/simulator
npm run web          # Run web version
npm test             # Run test suite
```

### Docker Development Commands

```bash
# Service Management
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose restart <service>  # Restart specific service
docker-compose logs <service>     # View service logs

# Development
docker-compose up backend frontend  # Start only core services
docker-compose exec backend npm test  # Run backend tests
```

## Development Tools Setup

### VS Code Extensions (Recommended)

```bash
# Install recommended extensions
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss  
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-eslint
code --install-extension expo.vscode-expo-tools
```

### Database Setup (Future)

```bash
# PostgreSQL with Docker
docker run --name aicha-db \
  -e POSTGRES_PASSWORD=development \
  -e POSTGRES_DB=aicha \
  -p 5432:5432 \
  -d postgres:14

# Or install locally
brew install postgresql  # macOS
sudo apt install postgresql  # Ubuntu
```

### Code Quality Tools

```bash
# Backend
cd backend
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking

# Frontend  
cd frontend
npm run lint         # Expo lint
npx expo doctor      # Check Expo configuration
```

## Verification Checklist

### ✅ Backend Verification

```bash
# Health check
curl http://localhost:5001/api/health

# API documentation
open http://localhost:5001/docs

# WebSocket connection (optional)
# Use browser dev tools to test socket.io connection
```

### ✅ Frontend Verification

**Mobile App:**
- [ ] Expo Go app installed on device
- [ ] QR code scannable from terminal
- [ ] App loads with chat interface
- [ ] Can send/receive messages

**Development Tools:**
- [ ] Expo Dev Tools accessible at http://localhost:19002
- [ ] Hot reload working on code changes
- [ ] Debug menu accessible in app

### ✅ Integration Testing

```bash
# Send a test message and verify:
# 1. Real-time message appears
# 2. Agent classification works  
# 3. Response validation scores appear
# 4. Metrics update in Grafana (if running)
```

## Troubleshooting Common Issues

### Node.js Version Issues

```bash
# Check version
node --version  # Should be 18+

# Use Node Version Manager
nvm install 18
nvm use 18
```

### Port Conflicts

```bash
# Check what's using a port
lsof -i :5001
sudo lsof -i :5001  # Linux

# Kill process on port
kill -9 $(lsof -t -i:5001)
```

### Docker Issues

```bash
# Reset Docker state
docker-compose down -v
docker system prune -f

# Check Docker resources
docker system df
```

### Expo/React Native Issues

```bash
# Clear Expo cache
npx expo start --clear

# Reset React Native cache
npx react-native start --reset-cache

# Clear npm cache
npm cache clean --force
```

## Advanced Configuration

### Custom Domain Setup (Optional)

```bash
# Add to /etc/hosts (macOS/Linux)
127.0.0.1 ai-chat.local

# Update environment variables
FRONTEND_URL=http://ai-chat.local:8081
```

### SSL/HTTPS Setup (Optional)

```bash
# Generate self-signed certificates
cd backend
mkdir ssl
openssl req -x509 -newkey rsa:4096 -nodes -keyout ssl/key.pem -out ssl/cert.pem -days 365
```

### Performance Optimization

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable V8 compiler cache
export NODE_OPTIONS="--max-old-space-size=4096 --compilation-cache"
```

## Next Steps

### 🚀 Quick Start
To get running immediately with minimal setup:
**→ [Quickstart Guide](./quickstart.md)**

### 🔧 Issue Resolution
If you encounter problems during setup:
**→ [Troubleshooting Guide](./troubleshooting.md)**

### 🏗️ Architecture Understanding
To learn about system design and components:
**→ [Architecture Overview](../architecture/)**

### 📊 Monitoring & Observability
To set up advanced monitoring:
**→ [Observability Guide](../operations/observability.md)**

### 🧪 Testing & Quality
To set up testing and code quality tools:
**→ [Code Quality Reference](../reference/code-quality.md)**

---

**Need Help?** Check our [Troubleshooting Guide](./troubleshooting.md) or review the [Architecture Documentation](../architecture/) for system understanding.
