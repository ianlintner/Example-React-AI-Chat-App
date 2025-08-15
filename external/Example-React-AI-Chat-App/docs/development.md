# Development Guide

This document provides comprehensive information about setting up the development environment and development workflows for the AI Chat Application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [API Development](#api-development)
8. [Frontend Development](#frontend-development)
9. [Testing](#testing)
10. [Code Quality](#code-quality)
11. [Debugging](#debugging)
12. [Performance Monitoring](#performance-monitoring)
13. [Common Development Tasks](#common-development-tasks)

## Prerequisites

### System Requirements

- **Node.js**: v18 or higher
- **npm**: v9 or higher (comes with Node.js)
- **Git**: Latest version
- **Code Editor**: VS Code recommended

### Recommended Tools

- **VS Code Extensions**:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - REST Client
  - Thunder Client (for API testing)
  - Socket.io Extension

### Optional Tools

- **Postman**: For API testing
- **Docker**: For containerization
- **MongoDB Compass**: If using MongoDB
- **Redis CLI**: If using Redis

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ai-chat-app.git
cd ai-chat-app
```

### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Configuration

#### Backend Environment

```bash
# Copy environment template
cd backend
cp .env.example .env

# Edit .env file
nano .env
```

Required environment variables:

```bash
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:8081
OPENAI_API_KEY=your-openai-api-key-here
```

#### Frontend Environment

```bash
# Copy environment template
cd frontend
cp .env.example .env

# Edit .env file
nano .env
```

Required environment variables:

```bash
VITE_API_URL=http://localhost:5001
```

### 4. Start Development Servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 5. Verify Setup

- Backend: http://localhost:5001/api/health
- Frontend: http://localhost:8081 (Expo web) or use mobile app
- Test real-time features by opening multiple browser tabs

## Project Structure

```
ai-chat-app/
├── backend/                    # Node.js backend
│   ├── src/
│   │   ├── routes/            # API routes
│   │   ├── socket/            # WebSocket handlers
│   │   ├── storage/           # Data storage
│   │   ├── middleware/        # Custom middleware
│   │   ├── services/          # Business logic
│   │   ├── utils/             # Utility functions
│   │   ├── types.ts           # Type definitions
│   │   └── index.ts           # Main server file
│   ├── tests/                 # Backend tests
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── services/          # API services
│   │   ├── hooks/             # Custom hooks
│   │   ├── utils/             # Utility functions
│   │   ├── theme/             # Material-UI theme
│   │   ├── types.ts           # Type definitions
│   │   └── App.tsx            # Main app component
│   ├── public/                # Static assets
│   ├── tests/                 # Frontend tests
│   ├── package.json
│   ├── vite.config.ts
│   └── .env
├── shared/                     # Shared types and utilities
│   └── types.ts
├── docs/                       # Documentation
├── scripts/                    # Build and deployment scripts
└── README.md
```

## Development Workflow

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push changes
git push origin feature/new-feature

# Create pull request
```

### Commit Message Convention

Follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build/config changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring

## Environment Configuration

### Development Environment Variables

#### Backend (.env)

```bash
# Server Configuration
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:8081

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Database Configuration (optional)
DATABASE_URL=mongodb://localhost:27017/ai-chat-dev
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log

# Security
JWT_SECRET=your-jwt-secret-for-development
SESSION_SECRET=your-session-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration (optional)
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
```

#### Frontend (.env)

```bash
# API Configuration
VITE_API_URL=http://localhost:5001

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DARK_MODE=true
VITE_ENABLE_NOTIFICATIONS=true

# Analytics (optional)
VITE_GA_TRACKING_ID=your-google-analytics-id
VITE_SENTRY_DSN=your-sentry-dsn
```

## Database Setup

### MongoDB Setup (Optional)

```bash
# Install MongoDB locally
# macOS
brew install mongodb/brew/mongodb-community

# Ubuntu
sudo apt-get install mongodb

# Start MongoDB
mongod

# Create database and user
mongo ai-chat-dev
db.createUser({
  user: "dev-user",
  pwd: "dev-password",
  roles: ["readWrite"]
});
```

### Redis Setup (Optional)

```bash
# Install Redis locally
# macOS
brew install redis

# Ubuntu
sudo apt-get install redis-server

# Start Redis
redis-server
```

## API Development

### Creating New API Routes

```typescript
// backend/src/routes/example.ts
import express from 'express';
import { validateRequest } from '../middleware/validation';
import { ExampleService } from '../services/ExampleService';

const router = express.Router();
const exampleService = new ExampleService();

// GET /api/example
router.get('/', async (req, res) => {
  try {
    const data = await exampleService.getData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/example
router.post('/', validateRequest, async (req, res) => {
  try {
    const result = await exampleService.createData(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

### Adding Route to Main Server

```typescript
// backend/src/index.ts
import exampleRoutes from './routes/example';

app.use('/api/example', exampleRoutes);
```

### Testing API Endpoints

```bash
# Using curl
curl -X GET http://localhost:5001/api/health

# Using VS Code REST Client
# Create a .http file
GET http://localhost:5001/api/health
```

## Frontend Development

### Creating New Components

```typescript
// frontend/src/components/ExampleComponent.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface ExampleComponentProps {
  title: string;
  onAction: () => void;
}

const ExampleComponent: React.FC<ExampleComponentProps> = ({ title, onAction }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Component lifecycle logic
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5">{title}</Typography>
      <Typography>Count: {count}</Typography>
      <Button onClick={() => setCount(count + 1)}>
        Increment
      </Button>
      <Button onClick={onAction}>
        Action
      </Button>
    </Box>
  );
};

export default ExampleComponent;
```

### Adding Custom Hooks

```typescript
// frontend/src/hooks/useExample.ts
import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export const useExample = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await apiService.getData();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};
```

## Testing

### Backend Testing

```bash
# Run backend tests
cd backend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Frontend Testing

```bash
# Run frontend tests
cd frontend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### E2E Testing

```bash
# Install Playwright
npm install -D @playwright/test

# Run E2E tests
npx playwright test
```

## Code Quality

### ESLint Configuration

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Prettier Configuration

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

### Pre-commit Hooks

```bash
# Install husky
npm install -D husky

# Setup pre-commit hooks
npx husky install
npx husky add .husky/pre-commit "npm run lint && npm run test"
```

## Debugging

### Backend Debugging

```bash
# Debug with VS Code
# Add to launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/src/index.ts",
  "env": {
    "NODE_ENV": "development"
  },
  "console": "integratedTerminal",
  "restart": true,
  "runtimeExecutable": "node",
  "runtimeArgs": ["-r", "ts-node/register"]
}
```

### Frontend Debugging

```bash
# Debug with browser dev tools
# Add breakpoints in source code
# Use React DevTools extension
```

### Socket.io Debugging

```typescript
// Enable Socket.io debugging
localStorage.debug = 'socket.io-client:*';
```

## Performance Monitoring

### Backend Performance

```typescript
// Add performance middleware
import { performance } from 'perf_hooks';

app.use((req, res, next) => {
  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;
    console.log(`${req.method} ${req.url} - ${duration.toFixed(2)}ms`);
  });

  next();
});
```

### Frontend Performance

```typescript
// Use React DevTools Profiler
// Monitor bundle size
npm run build && npm run analyze
```

## Common Development Tasks

### Adding New Dependencies

```bash
# Backend
cd backend
npm install package-name
npm install -D @types/package-name

# Frontend
cd frontend
npm install package-name
```

### Database Migration

```bash
# Create migration script
mkdir -p backend/migrations
touch backend/migrations/001_create_users.ts
```

### Environment Setup for New Developer

```bash
# Quick setup script
./scripts/setup-dev.sh
```

### Updating Dependencies

```bash
# Check outdated packages
npm outdated

# Update packages
npm update

# Update major versions
npx npm-check-updates -u
npm install
```

### Building for Production

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### Docker Development

```dockerfile
# Dockerfile.dev
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 5001

CMD ["npm", "run", "dev"]
```

```bash
# Build and run
docker build -f Dockerfile.dev -t ai-chat-dev .
docker run -p 5001:5001 ai-chat-dev
```

### Troubleshooting Common Issues

#### Port Already in Use

```bash
# Kill process on port
lsof -ti:5001 | xargs kill -9
```

#### Node Modules Issues

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript Issues

```bash
# Check TypeScript configuration
npx tsc --noEmit

# Clear TypeScript cache
rm -rf node_modules/.cache
```

This development guide provides a comprehensive overview of the development environment, workflows, and common tasks. Following these practices will ensure a smooth development experience and maintain code quality throughout the project lifecycle.
