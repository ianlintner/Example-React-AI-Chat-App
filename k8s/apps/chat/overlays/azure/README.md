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
├── service-patch.yaml          # Service configuration for Azure LB
├── ingress.yaml                # NGINX Ingress Controller routing
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
- Includes Azure resources (Ingress, ConfigMap, Redis)
- Sets namespace to `default`

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
- **Annotations**: Azure Load Balancer settings
- **Port**: Exposes port 80, targets container port 5001

### ingress.yaml

NGINX Ingress Controller configuration:

- **Class**: nginx
- **WebSocket Support**: Long timeouts for Socket.io
- **CORS**: Enabled for cross-origin requests
- **SSL**: Configurable with cert-manager
- **Routing**:
  - Domain-based (chat.yourdomain.com)
  - IP-based (fallback for initial access)

Key annotations:

- `nginx.ingress.kubernetes.io/websocket-services: chat-backend` - WebSocket support
- `nginx.ingress.kubernetes.io/upstream-hash-by: '$binary_remote_addr'` - Session affinity
- `nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"` - Long-lived connections

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

Edit `ingress.yaml`:

```yaml
spec:
  rules:
    - host: chat.yourcompany.com # Your domain
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: chat-backend
                port:
                  number: 80
```

### Enable SSL/TLS

1. Install cert-manager in your cluster
2. Uncomment TLS section in `ingress.yaml`:

```yaml
spec:
  tls:
    - hosts:
        - chat.yourcompany.com
      secretName: chat-backend-tls
```

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

- **Internet** → **Azure Load Balancer** → **NGINX Ingress** → **chat-backend service** → **chat-backend pods**

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

### Ingress not working

```bash
# Check ingress
kubectl get ingress
kubectl describe ingress chat-backend-ingress

# Check NGINX controller
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
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
- [Kustomize Documentation](https://kustomize.io/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
