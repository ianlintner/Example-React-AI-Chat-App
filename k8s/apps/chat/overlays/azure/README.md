# Azure AKS Deployment Configuration

This directory contains Kubernetes manifests specifically configured for deploying the AI Chat Application to Azure Kubernetes Service (AKS).

## Quick Start

```bash
# From the repository root
./scripts/azure/deploy-aks.sh deploy
```

See [Azure Deployment Guide](../../../docs/azure-deployment.md) for complete instructions.

## Directory Structure

```
azure/
├── kustomization.yaml          # Main Kustomize configuration
├── deployment-patch.yaml       # Deployment overrides for Azure
├── service-patch.yaml          # Service configuration for Azure
├── istio-gateway.yaml          # Istio Gateway configuration
├── istio-virtualservice.yaml   # Istio VirtualService routing
├── configmap.yaml              # Azure-specific environment config
├── redis.yaml                  # In-cluster Redis deployment
├── secrets.yaml.example        # Template for secrets
└── README.md                   # This file
```

## Configuration Files

### kustomization.yaml

Main Kustomize file that:

- References base manifests from `../../base`
- Applies Azure-specific patches
- Includes Azure resources (Istio Gateway, VirtualService, ConfigMap, Redis)
- Sets namespace to `default`
- Uses AKS-managed Istio service mesh

### deployment-patch.yaml

Modifies the deployment for Azure:

- **Replicas**: 2 (for high availability)
- **Image**: Uses Azure Container Registry (ACR)
- **Annotations**: Disables Istio sidecar injection
- **Environment**: Adds Azure-specific env vars
- **Resources**: CPU/Memory requests and limits
- **Probes**: Startup, readiness, and liveness checks

### service-patch.yaml

Configures the service for Azure:

- **Type**: ClusterIP (internal to cluster)
- **Annotations**: Azure-specific service settings
- **Port**: Exposes port 80, targets container port 5001

### istio-gateway.yaml

Istio Gateway configuration for external traffic:

- **Selector**: `istio: aks-istio-ingressgateway-external` (AKS-managed Istio)
- **Protocol**: HTTP on port 80
- **Hosts**: Wildcard (`*`) for all domains
- **TLS**: Configurable for HTTPS (commented out by default)

### istio-virtualservice.yaml

Istio VirtualService routing rules:

- **WebSocket Support**: Extended timeouts (3600s) for Socket.io connections
- **CORS**: Enabled for cross-origin requests
- **Socket.io CORS**: Dedicated policy on `/socket.io` route to allow browser upgrades through Istio
- **Routing**:
  - `/api/*` - API endpoints with 60s timeout
  - `/socket.io/*` - WebSocket connections with long-lived timeout
  - `/health`, `/healthz` - Health check endpoints
  - `/docs` - API documentation
  - `/metrics` - Prometheus metrics endpoint
  - `/` - Root and all other paths

Key features:

- Automatic WebSocket upgrade for Socket.io
- CORS policy with wildcard origins
- Extended timeouts for long-lived connections
- Service mesh observability with Istio

### configmap.yaml

Non-sensitive configuration:

- `NODE_ENV`: production
- `LOG_LEVEL`: info
- `PORT`: 5001
- `ENABLE_TRACING`: false (can enable with OpenTelemetry)
- `ENABLE_METRICS`: true (Prometheus metrics)
- `REDIS_HOST`: redis-service
- `REDIS_PORT`: 6379

### redis.yaml

In-cluster Redis deployment:

- **Image**: redis:7-alpine
- **Replicas**: 1
- **Authentication**: Password-protected
- **Resources**: 100m CPU / 128Mi RAM (can scale up)
- **Probes**: TCP liveness, command readiness
- **Service**: ClusterIP on port 6379

Alternative: Use Azure Redis Cache for production.

### secrets.yaml.example

Template for Kubernetes secrets:

- `OPENAI_API_KEY`: OpenAI API key
- `REDIS_PASSWORD`: Redis authentication
- Additional secrets as needed

**Important**:

1. Copy to `secrets.yaml`: `cp secrets.yaml.example secrets.yaml`
2. Update with actual values
3. **Never commit** `secrets.yaml` to git (in .gitignore)
4. For production, use Azure Key Vault with CSI driver

## Deployment Options

### Option 1: Automated Script (Recommended)

```bash
./scripts/azure/deploy-aks.sh deploy
```

### Option 2: Manual with kubectl

```bash
# Create secrets
cp k8s/apps/chat/overlays/azure/secrets.yaml.example \
   k8s/apps/chat/overlays/azure/secrets.yaml
# Edit secrets.yaml with your values

# Deploy
kubectl apply -k k8s/apps/chat/overlays/azure/
```

### Option 3: Preview before deployment

```bash
# Generate manifests
kubectl kustomize k8s/apps/chat/overlays/azure/ > /tmp/azure-manifests.yaml

# Review
cat /tmp/azure-manifests.yaml

# Apply
kubectl apply -f /tmp/azure-manifests.yaml
```

## Customization

### Change Number of Replicas

Edit `deployment-patch.yaml`:

```yaml
spec:
  replicas: 3 # Change from 2 to 3
```

### Change Node Resources

Edit `deployment-patch.yaml`:

```yaml
resources:
  requests:
    cpu: '500m' # Increase from 250m
    memory: '1Gi' # Increase from 512Mi
  limits:
    cpu: '2000m' # Increase from 1000m
    memory: '2Gi' # Increase from 1Gi
```

### Add Custom Domain

Edit `istio-gateway.yaml`:

```yaml
spec:
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - 'chat.yourcompany.com' # Your domain instead of "*"
```

Update `istio-virtualservice.yaml`:

```yaml
spec:
  hosts:
    - 'chat.yourcompany.com' # Your domain instead of "*"
  gateways:
    - chat-gateway-external
```

### Enable SSL/TLS (Optional)

**Note**: SSL/TLS setup is handled separately in the infrastructure repository. See [OPTIONAL_SSL_SETUP.md](./OPTIONAL_SSL_SETUP.md) for complete instructions on:

- Installing cert-manager
- Configuring DNS-01 challenges with various providers
- Creating Let's Encrypt certificates
- Copying secrets to Istio namespace

The Gateway is already configured to:

- Serve HTTPS on port 443 (when TLS secret is provided)
- Redirect HTTP (port 80) to HTTPS automatically
- Use domain: `example-chat.cat-herding.net`

### Use Azure Redis Cache

1. Create Azure Redis Cache
2. Update `configmap.yaml` with Redis connection details
3. Remove or comment out redis.yaml in `kustomization.yaml`
4. Add Redis password to secrets

## Environment Variables

### Required (via secrets)

- `OPENAI_API_KEY` - OpenAI API key (or use RAG mode without)

### Optional

- `REDIS_PASSWORD` - Redis authentication (if using password)

### Available in ConfigMap

- `NODE_ENV` - Environment (production/development)
- `LOG_LEVEL` - Logging verbosity (debug/info/warn/error)
- `PORT` - Application port (default: 5001)
- `ENABLE_TRACING` - OpenTelemetry tracing
- `ENABLE_METRICS` - Prometheus metrics
- `REDIS_HOST` - Redis hostname
- `REDIS_PORT` - Redis port

## Networking

### Internal Communication

- **chat-backend** ↔ **redis-service**: Port 6379
- All pods communicate via Kubernetes DNS

### External Access

- **Internet** → **Azure Load Balancer** → **Istio Ingress Gateway** → **chat-backend service** → **chat-backend pods**
- Istio service mesh provides traffic management, observability, and security

### Ports

- **5001**: Application port (internal)
- **80**: Service port (internal)
- **80/443**: Ingress ports (external, via Load Balancer)

## Monitoring

### Application Metrics

Prometheus metrics available at `/metrics`:

```bash
kubectl port-forward svc/chat-backend 5001:80
curl http://localhost:5001/metrics
```

### Health Checks

- **Startup**: `/healthz` - Checks if app has started
- **Readiness**: `/health` - Checks if app is ready for traffic
- **Liveness**: `/health` - Checks if app is still running

### Logs

```bash
# Backend logs
kubectl logs -l app=chat-backend -f

# Redis logs
kubectl logs -l app=redis -f

# All pods
kubectl logs -l app -f
```

### Azure Monitor

View metrics in Azure Portal:

1. Navigate to your AKS cluster
2. Click "Insights" in the left menu
3. View workload details and logs

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl get pods

# Describe pod for events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>
```

### Image pull errors

Ensure ACR is attached to AKS:

```bash
az aks update \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --attach-acr $ACR_NAME
```

### Istio Gateway not working

```bash
# Check Istio installation
kubectl get pods -n aks-istio-system

# Check gateway
kubectl get gateway
kubectl describe gateway chat-gateway-external

# Check virtual service
kubectl get virtualservice
kubectl describe virtualservice chat-vs-external

# Get external IP
kubectl get svc -n aks-istio-ingress
```

### Redis connection issues

```bash
# Check Redis pod
kubectl get pods -l app=redis
kubectl logs -l app=redis

# Test Redis connection
kubectl run -it --rm redis-test --image=redis:7-alpine --restart=Never -- \
  redis-cli -h redis-service ping
```

## Security Best Practices

1. **Secrets Management**
   - Use Azure Key Vault with CSI driver
   - Never commit secrets to git
   - Rotate secrets regularly

2. **Network Policies**
   - Implement Kubernetes NetworkPolicies
   - Restrict pod-to-pod communication
   - Use Azure Network Security Groups

3. **RBAC**
   - Configure role-based access control
   - Use service accounts with minimal permissions
   - Regularly audit access

4. **Pod Security**
   - Enable Pod Security Standards
   - Use non-root containers
   - Set securityContext properly

5. **Image Security**
   - Scan images with Azure Defender
   - Use specific image tags (not :latest)
   - Regularly update base images

## Scaling

### Manual Scaling

```bash
# Scale deployment
kubectl scale deployment chat-backend --replicas=5

# Scale AKS nodes
az aks scale \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count 5
```

### Auto-scaling

#### Horizontal Pod Autoscaler

```bash
kubectl autoscale deployment chat-backend \
  --cpu-percent=50 \
  --min=2 \
  --max=10
```

#### Cluster Autoscaler

```bash
az aks update \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 10
```

## Cleanup

### Remove application

```bash
kubectl delete -k k8s/apps/chat/overlays/azure/
```

### Remove everything (cluster included)

```bash
./scripts/azure/deploy-aks.sh cleanup
```

## References

- [Main Azure Deployment Guide](../../../docs/azure-deployment.md)
- [Quick Setup Guide](../../../docs/azure-quick-setup.md)
- [AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [AKS Istio Add-on](https://docs.microsoft.com/en-us/azure/aks/istio-about)
- [Kustomize Documentation](https://kustomize.io/)
- [Istio Documentation](https://istio.io/latest/docs/)
