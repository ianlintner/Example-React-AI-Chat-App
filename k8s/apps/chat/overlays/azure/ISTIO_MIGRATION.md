# Azure AKS Istio Migration

This document describes the migration from NGINX Ingress Controller to AKS-managed Istio service mesh.

## Changes Made

### 1. New Istio Configuration Files

#### `istio-gateway.yaml`

- **Purpose**: Defines the Istio Gateway for external traffic
- **Selector**: `istio: aks-istio-ingressgateway-external` (AKS-managed Istio)
- **Protocol**: HTTP on port 80 (HTTPS configuration commented out)
- **Hosts**: Wildcard (`*`) to accept all domains
- **TLS Ready**: Includes commented configuration for HTTPS/TLS

#### `istio-virtualservice.yaml`

- **Purpose**: Defines traffic routing rules for the chat application
- **Key Features**:
  - WebSocket support with `websocketUpgrade: true` for Socket.io
  - Extended timeouts (3600s) for long-lived WebSocket connections
  - CORS policy with wildcard origins
  - Specific routes for:
    - `/api/*` - REST API endpoints (60s timeout)
    - `/socket.io/*` - WebSocket connections (3600s timeout)
    - `/health`, `/healthz` - Health checks
    - `/docs` - API documentation
    - `/metrics` - Prometheus metrics
    - `/` - Root and catchall

### 2. Updated Configuration Files

#### `kustomization.yaml`

**Changed**:

- Removed: `- ingress.yaml`
- Added: `- istio-gateway.yaml`
- Added: `- istio-virtualservice.yaml`
- Updated comments to reflect Istio usage

#### `README.md`

**Updated Sections**:

- Directory structure
- Component descriptions
- Domain configuration instructions
- SSL/TLS setup instructions
- External access flow diagram
- Troubleshooting commands
- References

#### `GETTING_STARTED.md`

**Updated**:

- Prerequisites (removed Helm, added Istio requirement)
- Domain setup instructions
- What gets created section
- Common commands section
- Troubleshooting section

### 3. Archived Files

#### `ingress.yaml.bak`

- Original NGINX Ingress configuration
- Kept as backup for reference

## Istio vs NGINX Comparison

### NGINX Ingress (Previous)

- ✅ Simple to set up
- ✅ Well-documented
- ❌ Requires separate installation
- ❌ Limited observability
- ❌ Basic traffic management
- ❌ Annotations-based configuration

### Istio Service Mesh (Current)

- ✅ Managed by AKS (no installation needed when configured in portal)
- ✅ Advanced traffic management
- ✅ Built-in observability (metrics, traces)
- ✅ Security features (mTLS, authorization)
- ✅ Declarative configuration
- ✅ Service mesh capabilities
- ❌ Slightly more complex concepts

## Deployment Instructions

### Prerequisites

Ensure Istio is enabled on your AKS cluster via Azure Portal:

1. Navigate to your AKS cluster
2. Go to Service mesh
3. Enable Istio add-on
4. Select "External" ingress gateway

### Deploy Application

```bash
# From repository root
./scripts/azure/deploy-aks.sh deploy
```

Or manually:

```bash
kubectl apply -k k8s/apps/chat/overlays/azure/
```

### Verify Deployment

```bash
# Check Istio gateway
kubectl get gateway chat-gateway-external

# Check virtual service
kubectl get virtualservice chat-vs-external

# Get external IP
kubectl get svc -n aks-istio-ingress
```

### Access Application

Get the external IP from the Istio ingress gateway:

```bash
kubectl get svc -n aks-istio-ingress -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}'
```

Access your application at: `http://<EXTERNAL_IP>`

## Testing WebSocket Connections

The Istio configuration includes specific support for Socket.io:

```bash
# Test WebSocket connection
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://<EXTERNAL_IP>/socket.io/
```

## Observability

Istio provides enhanced observability out of the box:

### Metrics

```bash
# View Istio metrics
kubectl exec -n aks-istio-system <istio-pod> -- \
  curl http://localhost:15090/stats/prometheus
```

### Traces

Istio automatically generates distributed traces for all traffic passing through the mesh.

### Dashboards

Access Istio dashboards (if configured):

- Kiali: Service mesh visualization
- Grafana: Istio metrics
- Jaeger: Distributed tracing

## Custom Domain Setup

### 1. Update Gateway

Edit `istio-gateway.yaml`:

```yaml
spec:
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - 'chat.yourdomain.com' # Your domain
```

### 2. Update VirtualService

Edit `istio-virtualservice.yaml`:

```yaml
spec:
  hosts:
    - 'chat.yourdomain.com' # Your domain
  gateways:
    - chat-gateway-external
```

### 3. Configure DNS

Point your domain's A record to the Istio ingress gateway's external IP.

### 4. Redeploy

```bash
kubectl apply -k k8s/apps/chat/overlays/azure/
```

## TLS/HTTPS Setup

### 1. Create TLS Secret

```bash
kubectl create secret tls chat-backend-tls \
  --cert=path/to/cert.crt \
  --key=path/to/key.key \
  -n default
```

### 2. Update Gateway

Uncomment the HTTPS section in `istio-gateway.yaml`:

```yaml
spec:
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: chat-backend-tls
      hosts:
        - 'chat.yourdomain.com'
```

### 3. Redeploy

```bash
kubectl apply -k k8s/apps/chat/overlays/azure/
```

## Troubleshooting

### Gateway Not Ready

```bash
# Check gateway status
kubectl describe gateway chat-gateway-external

# Check Istio system pods
kubectl get pods -n aks-istio-system

# View Istio ingress logs
kubectl logs -n aks-istio-ingress -l app=istio-ingressgateway
```

### VirtualService Issues

```bash
# Check virtual service
kubectl describe virtualservice chat-vs-external

# Validate configuration
istioctl analyze -n default
```

### No External IP

```bash
# Check ingress service
kubectl get svc -n aks-istio-ingress

# Describe service for events
kubectl describe svc -n aks-istio-ingress <service-name>
```

### WebSocket Connection Failures

```bash
# Check virtual service routes
kubectl get virtualservice chat-vs-external -o yaml

# View backend pod logs
kubectl logs -l app=chat-backend -f

# Check if websocketUpgrade is enabled
kubectl get virtualservice chat-vs-external -o jsonpath='{.spec.http[?(@.match[0].uri.prefix=="/socket.io")].websocketUpgrade}'
```

## Benefits of This Migration

1. **Managed Service**: No need to install or maintain ingress controller
2. **Advanced Features**: Traffic splitting, retries, timeouts, circuit breakers
3. **Better Observability**: Automatic metrics and traces for all traffic
4. **Security**: mTLS, authorization policies, and certificate management
5. **Azure Integration**: Seamless integration with AKS and Azure services
6. **Future-Ready**: Service mesh capabilities for microservices growth

## Rollback Plan

If you need to revert to NGINX Ingress:

1. Restore the backup:

   ```bash
   mv istio-gateway.yaml istio-gateway.yaml.bak
   mv istio-virtualservice.yaml istio-virtualservice.yaml.bak
   mv ingress.yaml.bak ingress.yaml
   ```

2. Update `kustomization.yaml`:

   ```yaml
   resources:
     - ingress.yaml
     # - istio-gateway.yaml
     # - istio-virtualservice.yaml
   ```

3. Install NGINX Ingress Controller:

   ```bash
   helm install ingress-nginx ingress-nginx/ingress-nginx \
     --namespace ingress-nginx --create-namespace
   ```

4. Redeploy:
   ```bash
   kubectl apply -k k8s/apps/chat/overlays/azure/
   ```

## References

- [AKS Istio Add-on Documentation](https://docs.microsoft.com/en-us/azure/aks/istio-about)
- [Istio Gateway API](https://istio.io/latest/docs/reference/config/networking/gateway/)
- [Istio VirtualService API](https://istio.io/latest/docs/reference/config/networking/virtual-service/)
- [Istio Traffic Management](https://istio.io/latest/docs/concepts/traffic-management/)
