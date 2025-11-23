# Kubernetes Configuration

Azure AKS deployment configuration for the AI Chat application.

## Structure

```
k8s/
├── apps/chat/              # Chat backend application
│   ├── base/               # Base Kubernetes resources
│   └── overlays/azure/     # Azure-specific configuration
└── observability/          # OpenTelemetry Collector for tracing
```

## Quick Deploy

```bash
# Deploy to Azure AKS
kubectl apply -k k8s/apps/chat/overlays/azure

# Deploy observability stack
kubectl apply -f k8s/observability/otel-collector.yaml
```

## Configuration

### Azure Overlay

The Azure overlay (`overlays/azure/`) includes:
- Azure-specific ConfigMaps (environment variables)
- Ingress configuration with SSL/TLS
- Secrets (via Azure Key Vault or manual creation)
- Redis configuration
- Service patches

### Base Resources

Base Kubernetes resources include:
- Backend Deployment
- Service definitions
- ServiceAccount
- Secret templates
- Redis Service and Secret

## Environment Variables

Key environment variables configured in `overlays/azure/configmap.yaml`:
- `ENABLE_TRACING=true` - OpenTelemetry tracing
- `TRACING_EXPORTER=otlp` - OTLP export to collector
- `OTEL_EXPORTER_OTLP_ENDPOINT` - Collector endpoint
- `OTEL_TRACES_SAMPLER_RATIO` - Sampling rate

## Observability

OpenTelemetry Collector deployed separately:
- Receives traces via OTLP (gRPC: 4317, HTTP: 4318)
- Exports to debug console (ready for Azure Monitor)
- Resource limits configured (CPU: 500m, Memory: 512Mi)

## See Also

- [Azure Deployment Guide](../docs/azure-deployment.md)
- [Azure Quick Setup](../docs/azure-quick-setup.md)
- [Tracing Documentation](../docs/operations/tracing-azure-monitor.md)
