# Docker Observability Stack

This document describes how to set up and use the comprehensive observability stack for the AI Goal-Seeking Chat System using Docker Compose.

## Stack Components

The observability stack includes:

- **Zipkin** - Distributed tracing UI and storage
- **OpenTelemetry Collector** - Trace and metrics collection
- **Prometheus** - Metrics storage and alerting
- **Grafana** - Visualization and dashboards
- **Redis** - Optional caching and session storage

## Quick Start

### 1. Start the Observability Stack

```bash
# Start all observability services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 2. Update Application Configuration

Copy the environment configuration with OpenTelemetry settings:

```bash
# Update backend environment
cp backend/.env.example backend/.env

# Edit backend/.env and add your OpenAI API key
# The OpenTelemetry settings are already configured
```

### 3. Start the Application

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend  
cd frontend && npm run dev
```

### 4. Access Observability Tools

- **Application**: http://localhost:5173
- **Zipkin UI**: http://localhost:9411 (Distributed tracing)
- **Grafana**: http://localhost:3000 (Dashboards) - admin/admin
- **Prometheus**: http://localhost:9090 (Metrics)
- **OpenTelemetry Collector**: http://localhost:13133 (Health)

## Service Configuration

### OpenTelemetry Collector

The collector is configured to:
- Receive traces via OTLP HTTP (port 4318) and gRPC (port 4317)
- Export traces to Zipkin
- Export metrics to Prometheus
- Provide health checks and monitoring

**Configuration file**: `otel-collector-config.yaml`

### Zipkin

Zipkin provides:
- Distributed tracing visualization
- Trace search and filtering
- Service dependency maps
- Performance analysis

**Access**: http://localhost:9411

### Prometheus

Prometheus scrapes metrics from:
- OpenTelemetry Collector
- Application metrics endpoints
- System metrics

**Configuration file**: `prometheus.yml`

### Grafana

Grafana is pre-configured with:
- Prometheus datasource
- Zipkin datasource
- Custom dashboards for the AI system

**Access**: http://localhost:3000 (admin/admin)

## Using the Observability Stack

### 1. Viewing Traces

1. Open Zipkin UI: http://localhost:9411
2. Search for traces by service name: `ai-goal-seeking-backend`
3. Click on traces to explore details
4. Explore conversation flows, agent selections, and goal-seeking processes

**Key Trace Operations**:
- `conversation.stream_chat` - Full conversation processing
- `goal_seeking.process` - Goal-seeking system operations
- `agent.{type}.{operation}` - Agent-specific operations
- `validation.validate_response` - Response validation

### 2. Monitoring Metrics

1. Open Prometheus: http://localhost:9090
2. Explore available metrics
3. Create custom queries for system monitoring

**Key Metrics**:
- `ai_goal_seeking_*` - Application-specific metrics
- `otel_*` - OpenTelemetry collector metrics
- `system_*` - System resource metrics

### 3. Creating Dashboards

1. Open Grafana: http://localhost:3000
2. Login with admin/admin
3. Create new dashboards or import existing ones
4. Configure panels for:
   - Conversation response times
   - Agent selection patterns
   - Goal achievement rates
   - User engagement metrics

## Custom Dashboard Examples

### System Overview Dashboard

```json
{
  "dashboard": {
    "title": "AI Goal-Seeking System Overview",
    "panels": [
      {
        "title": "Active Conversations",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(ai_goal_seeking_active_conversations)"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, ai_goal_seeking_response_time_bucket)"
          }
        ]
      }
    ]
  }
}
```

### Agent Performance Dashboard

```json
{
  "dashboard": {
    "title": "Agent Performance",
    "panels": [
      {
        "title": "Agent Selection Rate",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum by (agent_type) (ai_goal_seeking_agent_selections_total)"
          }
        ]
      },
      {
        "title": "Agent Confidence",
        "type": "heatmap",
        "targets": [
          {
            "expr": "ai_goal_seeking_agent_confidence_bucket"
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check service logs
   docker-compose logs zipkin
   docker-compose logs otel-collector
   
   # Restart specific service
   docker-compose restart zipkin
   ```

2. **No traces appearing**
   - Verify OpenTelemetry endpoint configuration
   - Check collector health: http://localhost:13133
   - Ensure application is sending traces to correct endpoint

3. **Metrics not showing**
   - Check Prometheus targets: http://localhost:9090/targets
   - Verify collector configuration
   - Ensure metric exporters are configured

### Debug Commands

```bash
# Check OpenTelemetry Collector health
curl http://localhost:13133/

# Check Zipkin health
curl http://localhost:9411/health

# Check Prometheus metrics
curl http://localhost:9090/metrics

# View collector configuration
docker-compose exec otel-collector cat /etc/otel-collector-config.yaml

# Check logs
docker-compose logs -f otel-collector
docker-compose logs -f zipkin
```

## Advanced Configuration

### Custom Metrics

Add custom metrics to the application:

```typescript
// backend/src/metrics/customMetrics.ts
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('ai-goal-seeking-system');

export const conversationCounter = meter.createCounter('conversations_total', {
  description: 'Total number of conversations',
});

export const responseTimeHistogram = meter.createHistogram('response_time_seconds', {
  description: 'Response time distribution',
  unit: 's',
});
```

### Custom Dashboards

Create custom Grafana dashboards:

1. Design dashboard in Grafana UI
2. Export dashboard JSON
3. Save to `grafana/dashboards/`
4. Restart Grafana to load

### Alerting

Configure Prometheus alerting:

1. Create alert rules in `prometheus.yml`
2. Configure Alertmanager
3. Set up notification channels (Slack, email, etc.)

## Security Considerations

### Production Deployment

1. **Authentication**: Enable authentication for all services
2. **TLS**: Use TLS for all communications
3. **Network Security**: Restrict network access
4. **Data Retention**: Configure appropriate retention policies

### Sample Production Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  zipkin:
    environment:
      - STORAGE_TYPE=elasticsearch
      - ES_HOSTS=https://elasticsearch:9200
      - ES_USERNAME=zipkin
      - ES_PASSWORD=${ZIPKIN_ES_PASSWORD}
  
  grafana:
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_SERVER_ROOT_URL=https://grafana.yourdomain.com
```

## Performance Optimization

### Sampling

Configure trace sampling to reduce overhead:

```yaml
# otel-collector-config.yaml
processors:
  probabilistic_sampler:
    sampling_percentage: 10  # Sample 10% of traces
```

### Batching

Optimize batching for high-volume environments:

```yaml
# otel-collector-config.yaml
processors:
  batch:
    timeout: 200ms
    send_batch_size: 512
    send_batch_max_size: 1024
```

## Maintenance

### Regular Tasks

1. **Clean up old traces**: Zipkin retention policies
2. **Monitor disk usage**: Prometheus and Grafana storage
3. **Update configurations**: Keep collectors and exporters current
4. **Review dashboards**: Ensure metrics remain relevant

### Backup and Recovery

```bash
# Backup Grafana dashboards
docker-compose exec grafana grafana-cli admin export-dashboard

# Backup Prometheus data
docker-compose exec prometheus promtool tsdb snapshot /prometheus

# Restore from backup
docker-compose down
docker-compose up -d
```

## Integration with CI/CD

### Automated Deployment

```yaml
# .github/workflows/deploy-observability.yml
name: Deploy Observability Stack

on:
  push:
    branches: [main]
    paths: ['docker-compose.yml', 'otel-collector-config.yaml']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy Stack
        run: |
          docker-compose pull
          docker-compose up -d
          docker-compose ps
```

## Best Practices

1. **Resource Limits**: Set appropriate CPU and memory limits
2. **Health Checks**: Implement comprehensive health checks
3. **Monitoring**: Monitor the monitoring stack itself
4. **Documentation**: Keep configuration documentation current
5. **Testing**: Test observability stack changes in staging

This observability stack provides comprehensive monitoring, tracing, and alerting capabilities for the AI Goal-Seeking Chat System, enabling deep insights into system performance and user behavior.
