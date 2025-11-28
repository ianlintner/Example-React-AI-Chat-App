# Kubernetes Configuration

Azure AKS deployment configuration for the AI Chat application.

## Structure

```
k8s/
├── apps/chat/              # Chat backend application (single environment)
│   ├── kustomization.yaml  # Kustomize configuration
│   ├── deployment.yaml     # Backend deployment
│   ├── service.yaml        # Service definition
│   ├── configmap.yaml      # Environment configuration
│   ├── secrets.yaml        # Secret templates
│   ├── redis.yaml          # Redis deployment and service
│   ├── istio-gateway.yaml  # Istio gateway configuration
│   ├── istio-virtualservice.yaml  # Istio routing
│   ├── certificate.yaml    # TLS certificate
│   ├── clusterissuer.yaml  # Let's Encrypt cluster issuer
│   ├── secret-provider-class.yaml  # Azure Key Vault integration
│   └── authz-policy.yaml   # Istio authorization policy
└── observability/          # OpenTelemetry Collector for tracing
```

## Quick Deploy

```bash
# Deploy to Azure AKS
kubectl apply -k k8s/apps/chat

# Deploy observability stack
kubectl apply -f k8s/observability/otel-collector.yaml
```

## Configuration

The chat application configuration includes:

- ConfigMap with environment variables
- Secrets (via Azure Key Vault or manual creation)
- Redis deployment for caching
- Istio Gateway and VirtualService for routing
- TLS certificates via cert-manager

## Environment Variables

Key environment variables configured in `configmap.yaml`:

- `NODE_ENV=production` - Environment mode
- `ENABLE_METRICS=true` - Prometheus metrics
- `ENABLE_TRACING=false` - OpenTelemetry tracing
- `FRONTEND_URL` - Frontend URL for CORS

## Authentication

OAuth authentication is handled at the cluster level via oauth2-proxy, not within the application.

## Observability

OpenTelemetry Collector deployed separately:

- Receives traces via OTLP (gRPC: 4317, HTTP: 4318)
- Exports to debug console (ready for Azure Monitor)
- Resource limits configured (CPU: 500m, Memory: 512Mi)

## See Also

- [Azure Deployment Guide](../docs/azure-deployment.md)
- [Azure Quick Setup](../docs/azure-quick-setup.md)
- [Tracing Documentation](../docs/operations/tracing-azure-monitor.md)
