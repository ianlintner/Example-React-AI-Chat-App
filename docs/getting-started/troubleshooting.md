# Troubleshooting Guide

Comprehensive solutions for common issues during development and deployment.

## Quick Diagnostics

Before diving into specific issues, run these diagnostic commands to gather system information:

```bash
# Check system status
docker --version && docker-compose --version
node --version && npm --version

# Verify services
docker-compose ps
curl -f http://localhost:3001/health || echo "Backend not responding"
curl -f http://localhost:8080/api/health || echo "Frontend not responding"
```

## Environment Setup Issues

### Prerequisites Missing

**Symptom**: Command not found errors during setup

**Solutions**:

```bash
# Install Node.js (if missing)
# macOS
brew install node

# Windows
winget install OpenJS.NodeJS

# Linux
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker (if missing)
# Visit https://docs.docker.com/get-docker/
```

### Environment Configuration

**Symptom**: Environment variables not loaded

**Solutions**:

```bash
# Check environment files exist
ls -la */.env* */.*env*

# Verify environment loading
cd backend && node -e "console.log(process.env.NODE_ENV)"
cd frontend && node -e "console.log(process.env.EXPO_PUBLIC_API_URL)"

# Recreate from templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Backend Issues

### Server Startup Problems

**Symptom**: `EADDRINUSE` port already in use

**Solutions**:

```bash
# Find and kill process using port
lsof -ti:3001 | xargs kill -9
# Or use different port
PORT=3002 npm run dev
```

**Symptom**: Database connection errors

**Solutions**:

```bash
# Reset database
docker-compose down -v
docker-compose up database -d
sleep 10
npm run db:migrate
```

### API Issues

**Symptom**: Swagger UI not available at `/docs`

**Solutions**:

```bash
# Verify backend is running
curl http://localhost:3001/health

# Check swagger configuration
grep -r "swagger\|openapi" backend/src/

# Restart with swagger enabled
NODE_ENV=development npm run dev
```

**Symptom**: CORS errors in browser console

**Solutions**:

```bash
# Check CORS configuration in backend
grep -r "cors\|origin" backend/src/

# Verify frontend URL in backend env
echo $FRONTEND_URL  # Should match frontend dev server
```

### WebSocket Connection Issues

**Symptom**: Real-time features not working

**Solutions**:

```bash
# Test WebSocket connection
wscat -c ws://localhost:3001

# Check socket event handlers
grep -r "socket\|emit\|on" backend/src/socket/
```

## Frontend Issues

### React Native/Expo Problems

**Symptom**: Metro bundler won't start

**Solutions**:

```bash
# Clear Metro cache
npx expo start --clear

# Reset Metro cache and node_modules
rm -rf node_modules/.cache
npm run clean
npm install
```

**Symptom**: "Cannot connect to development server"

**Solutions**:

```bash
# Check network connectivity
ipconfig getifaddr en0  # Get local IP
expo start --host tunnel  # Use tunnel for complex networks

# Restart with specific host
expo start --host 192.168.1.100
```

### Component Rendering Issues

**Symptom**: Components not displaying correctly

**Solutions**:

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Verify component imports
grep -r "import.*from" frontend/components/

# Test specific component
npm test -- --testNamePattern="ComponentName"
```

### State Management Issues

**Symptom**: State not updating in real-time

**Solutions**:

```bash
# Check socket service connection
grep -A 10 -B 5 "socket.*connect" frontend/services/

# Verify state updates in logs
# Add console.log in components and check browser console
```

## Testing Issues

### Unit Test Failures

**Symptom**: Tests failing unexpectedly

**Solutions**:

```bash
# Run tests with verbose output
npm test -- --verbose

# Update snapshots if needed
npm test -- --updateSnapshot

# Check test environment
npm test -- --detectOpenHandles --forceExit
```

### Integration Test Problems

**Symptom**: API integration tests failing

**Solutions**:

```bash
# Verify test database
NODE_ENV=test npm run test:integration

# Check test data setup
ls -la backend/src/__tests__/fixtures/

# Reset test environment
npm run test:clean
```

## Docker Issues

### Container Startup Problems

**Symptom**: Containers failing to start

**Solutions**:

```bash
# Check container logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild containers
docker-compose build --no-cache
docker-compose up --force-recreate

# Clean Docker system
docker system prune -a
```

### Volume Mount Issues

**Symptom**: Code changes not reflected in containers

**Solutions**:

```bash
# Verify volume mounts
docker-compose config

# Check file permissions (Linux/macOS)
ls -la $(pwd)

# Use bind mounts instead of volumes
# Edit docker-compose.yml volumes section
```

## Observability Issues

### Tracing Not Working

**Symptom**: No traces in Jaeger UI

**Solutions**:

```bash
# Verify OTEL configuration
env | grep OTEL

# Check tracing service
curl http://localhost:14268/api/traces

# Verify sampling
# Set OTEL_TRACES_SAMPLER=always_on for debugging
```

### Prometheus Metrics Missing

**Symptom**: No metrics in Grafana dashboards

**Solutions**:

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify metrics endpoint
curl http://localhost:3001/metrics

# Check Prometheus configuration
docker-compose exec prometheus cat /etc/prometheus/prometheus.yml
```

### Grafana Dashboard Issues

**Symptom**: Dashboards not loading or showing "No Data"

**Solutions**:

```bash
# Check Grafana datasource
curl -u admin:admin http://localhost:3000/api/datasources

# Verify dashboard provisioning
docker-compose exec grafana ls -la /etc/grafana/provisioning/

# Import dashboards manually
# Use Grafana UI to import JSON files from grafana/dashboards/
```

## Performance Issues

### Slow Response Times

**Symptom**: API endpoints responding slowly

**Solutions**:

```bash
# Check system resources
docker stats

# Profile specific endpoints
curl -w "@curl-format.txt" -o /dev/null http://localhost:3001/api/chat

# Enable performance logging
NODE_ENV=development DEBUG=* npm run dev
```

### Memory Leaks

**Symptom**: Increasing memory usage over time

**Solutions**:

```bash
# Monitor memory usage
docker stats --no-stream

# Check for memory leaks in logs
grep -i "memory\|heap" logs/*.log

# Restart services periodically
docker-compose restart
```

## Network Issues

### Service Discovery Problems

**Symptom**: Services can't communicate with each other

**Solutions**:

```bash
# Check Docker network
docker network ls
docker network inspect react_default

# Test inter-service communication
docker-compose exec backend ping frontend
docker-compose exec frontend ping backend
```

### External API Connectivity

**Symptom**: Cannot reach external services

**Solutions**:

```bash
# Test connectivity from container
docker-compose exec backend curl -I https://api.openai.com

# Check proxy/firewall settings
env | grep -i proxy

# Verify DNS resolution
nslookup api.openai.com
```

## Data Issues

### Database Connection Problems

**Symptom**: Cannot connect to database

**Solutions**:

```bash
# Check database container
docker-compose logs database

# Test connection directly
docker-compose exec database psql -U postgres -d react_db

# Reset database permissions
docker-compose exec database psql -U postgres -c "ALTER USER postgres PASSWORD 'password';"
```

### Data Migration Issues

**Symptom**: Schema migrations failing

**Solutions**:

```bash
# Check migration status
npm run db:status

# Rollback and retry
npm run db:rollback
npm run db:migrate

# Reset database completely
npm run db:reset
```

## Development Workflow Issues

### Git Hooks Failing

**Symptom**: Pre-commit hooks blocking commits

**Solutions**:

```bash
# Check hook configuration
ls -la .husky/

# Run hooks manually
npm run lint
npm run test
npm run build

# Bypass hooks (emergency only)
git commit --no-verify -m "Fix: emergency commit"
```

### Build Problems

**Symptom**: Build process failing

**Solutions**:

```bash
# Clean build artifacts
npm run clean

# Check for dependency issues
npm audit fix

# Verify TypeScript configuration
npx tsc --showConfig
```

## Getting Help

### Diagnostic Information to Collect

When reporting issues, include:

```bash
# System information
uname -a
node --version
npm --version
docker --version

# Project status
git status
git log --oneline -5

# Service status
docker-compose ps
curl -f http://localhost:3001/health
```

### Log Collection

```bash
# Collect all logs
docker-compose logs > system-logs.txt

# Backend specific logs
docker-compose logs backend > backend-logs.txt

# Frontend specific logs
docker-compose logs frontend > frontend-logs.txt
```

### Common Log Patterns to Look For

- **Error patterns**: `ERROR`, `Failed`, `Exception`, `Cannot`, `ENOENT`
- **Performance issues**: `timeout`, `slow`, `memory`, `CPU`
- **Network problems**: `ECONNREFUSED`, `DNS`, `404`, `500`

## Related Documentation

- **Setup Guide**: [Getting Started → Setup](setup.md) - Initial development environment setup
- **Quick Start**: [Getting Started → Quick Start](quickstart.md) - Fast track to running the system
- **Architecture**: [Architecture → System Overview](../architecture/system-overview.md) - Understanding system components
- **Operations**: [Operations → Observability](../operations/observability.md) - Monitoring and debugging
- **API Reference**: [Reference → API Reference](../reference/api-reference.md) - API endpoint documentation

---

*Last updated: 2024*
*Need help? Check our [setup guide](setup.md) or [quick start guide](quickstart.md) for basic configuration.*
