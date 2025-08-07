# Docker Setup Guide

This guide explains how to set up and run the AI Goal-Seeking System using Docker Compose with full observability stack for testing and tracing validation.

## Architecture Overview

The Docker setup includes:

### Core Services
- **Backend**: Node.js API with TypeScript, OpenTelemetry tracing
- **Frontend**: React Native Web app served by Nginx
- **Redis**: In-memory data structure store for caching and sessions

### Observability Stack
- **Jaeger**: Distributed tracing UI and storage
- **OpenTelemetry Collector**: Telemetry data collection and processing
- **Prometheus**: Metrics storage and monitoring
- **Grafana**: Visualization dashboards for metrics and traces

### Testing Services
- **Test Runner**: Automated test execution
- **Load Test**: k6-based performance testing
- **Trace Validator**: Automated trace validation

## Quick Start

### 1. Basic Stack
Start the complete stack with observability:
```bash
./run-docker-stack.sh -d
```

### 2. With Testing
Start stack and run tests:
```bash
./run-docker-stack.sh -d -t
```

### 3. Load Testing
Start stack and run load tests:
```bash
./run-docker-stack.sh -d -l
```

### 4. Trace Validation
Start stack and validate tracing:
```bash
./run-docker-stack.sh -d -v
```

### 5. Clean Start
Clean everything and start fresh:
```bash
./run-docker-stack.sh -d -c
```

## Service URLs

When running in detached mode, access services at:

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:5001
- **Grafana**: http://localhost:3000 (admin/admin)
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Redis**: redis://localhost:6379

## Manual Docker Compose Commands

### Basic Operations

Start all services:
```bash
docker-compose up -d
```

Stop all services:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f
```

Build images:
```bash
docker-compose build
```

### Testing Operations

Run with test profile:
```bash
docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d --profile test
```

Run load tests:
```bash
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm load-test
```

Run trace validation:
```bash
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm trace-validator
```

## Environment Configuration

### Backend Environment Variables

The backend service uses these environment variables:

```bash
# Application
NODE_ENV=production
PORT=5001

# Redis
REDIS_URL=redis://redis:6379

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=ai-goal-seeking-backend
OTEL_RESOURCE_ATTRIBUTES=service.name=ai-goal-seeking-backend,service.version=1.0.0,deployment.environment=docker

# Frontend CORS
FRONTEND_URL=http://frontend:80,http://localhost:8080
```

### Frontend Environment Variables

```bash
NODE_ENV=development
REACT_APP_API_URL=http://backend:5001
REACT_APP_SOCKET_URL=http://backend:5001
```

## Health Checks

All services include health checks:

### Backend Health Check
```bash
curl http://localhost:5001/health
```

### Frontend Health Check
```bash
curl http://localhost:8080/health
```

### Service Status
```bash
docker-compose ps
```

## Testing and Validation

### Load Testing

The load testing uses k6 and includes:
- Health endpoint validation
- API endpoint testing
- Performance metrics collection
- Response time validation

Results are saved to `load-test-results.json`.

### Trace Validation

The trace validation script:
1. Waits for all services to be healthy
2. Generates test traces by calling API endpoints
3. Queries Jaeger to verify traces are collected
4. Validates trace data integrity

### Running Individual Tests

Backend unit tests:
```bash
docker-compose run --rm backend npm test
```

Load test only:
```bash
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm load-test
```

Trace validation only:
```bash
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm trace-validator
```

## Monitoring and Observability

### Grafana Dashboards

Access Grafana at http://localhost:3000:
- Username: `admin`
- Password: `admin`

Pre-configured data sources:
- Prometheus (metrics)
- Jaeger (traces)

### Jaeger Tracing

Access Jaeger UI at http://localhost:16686:
- View distributed traces
- Search by service name: `ai-goal-seeking-backend`
- Analyze request flows and performance

### Prometheus Metrics

Access Prometheus at http://localhost:9090:
- Monitor application metrics
- Query custom business metrics
- Set up alerts

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Stop conflicting services
   sudo lsof -i :5001
   sudo lsof -i :8080
   ```

2. **Docker Build Failures**
   ```bash
   # Clean Docker cache
   docker system prune -a
   docker-compose build --no-cache
   ```

3. **Service Startup Issues**
   ```bash
   # Check logs
   docker-compose logs backend
   docker-compose logs frontend
   ```

4. **Health Check Failures**
   ```bash
   # Check service status
   docker-compose ps
   
   # Restart unhealthy services
   docker-compose restart backend
   ```

### Debug Mode

Enable debug logging:
```bash
# Set environment in docker-compose.test.yml
LOG_LEVEL=debug
```

### Network Issues

Test service connectivity:
```bash
# Enter backend container
docker-compose exec backend sh

# Test Redis connection
redis-cli -h redis ping

# Test collector connection
curl http://otel-collector:4318/
```

## Development Workflow

### Hot Reloading

For development with hot reloading:
```bash
# Use test override with source mounting
docker-compose -f docker-compose.yml -f docker-compose.test.yml up backend
```

### Debugging

Access container for debugging:
```bash
docker-compose exec backend sh
docker-compose exec frontend sh
```

## Production Considerations

### Security
- Services run as non-root users
- Proper signal handling with dumb-init
- Resource limits configured

### Performance
- Multi-stage builds for smaller images
- Health checks with appropriate intervals
- Restart policies configured

### Monitoring
- Comprehensive metrics collection
- Distributed tracing enabled
- Log aggregation ready

## Cleanup

### Stop and Remove Everything
```bash
./run-docker-stack.sh -c
```

Or manually:
```bash
docker-compose -f docker-compose.yml -f docker-compose.test.yml down -v --remove-orphans
docker system prune -a
```

### Remove Specific Volumes
```bash
docker volume rm react_prometheus_data
docker volume rm react_grafana_data
docker volume rm react_redis_data
