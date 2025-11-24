# Chat.hugecat.net Deployment

This directory contains scripts and configuration for deploying the chat application to the `chat.hugecat.net` subdomain on Azure AKS with Istio.

## Quick Deploy

```bash
# Full deployment (cert-manager, DNS, application)
./scripts/azure/deploy-chat-subdomain.sh deploy

# Verify deployment
./scripts/azure/verify-chat-subdomain.sh
```

## What Was Deployed

### 1. DNS Configuration
- **A Record**: `chat.hugecat.net` → AKS Istio Ingress IP (`52.182.228.75`)
- **DNS Zone**: `hugecat.net` in Azure DNS
- **Resource Group**: Auto-detected from Azure DNS zone

### 2. TLS Certificate
- **Issuer**: Let's Encrypt (Production)
- **Certificate**: `chat-hugecat-tls`
- **Secret**: `chat-hugecat-tls-cert`
- **Validation**: DNS-01 challenge via Azure DNS
- **Status**: ✓ Ready and trusted

### 3. Istio Gateway
- **Gateway**: `chat-gateway`
- **Selector**: `istio: aks-istio-ingressgateway-external`
- **Hosts**: 
  - `chat.hugecat.net` (HTTPS with TLS)
  - `example-chat.cat-herding.net` (existing)
- **HTTP → HTTPS**: Automatic redirect enabled

### 4. Virtual Service
- **VirtualService**: `chat-vs-external`
- **Routes**:
  - `/api/socket.io` → Backend (WebSocket support)
  - `/api/*` → Backend API
  - `/health`, `/healthz` → Health checks
  - `/docs` → API documentation
  - `/metrics` → Prometheus metrics
  - `/*` → Frontend/catch-all

### 5. Authorization Policy
- **Policy**: `chat-app-authz`
- **Scope**: `app=chat-backend`
- **Action**: Allow all (customize for production)

## Files Created/Modified

### New Files
```
k8s/apps/chat/overlays/azure/
├── certificate.yaml              # TLS certificate resource
├── clusterissuer.yaml            # Let's Encrypt ClusterIssuer
└── authz-policy.yaml             # Istio AuthorizationPolicy

scripts/azure/
├── configure-dns.sh              # DNS A record management
├── deploy-chat-subdomain.sh      # Full deployment script
└── verify-chat-subdomain.sh      # Verification script
```

### Modified Files
```
k8s/apps/chat/base/
└── kustomization.yaml            # Added Gateway and VirtualService

k8s/apps/chat/overlays/azure/
├── gateway-patch.yaml            # Updated with chat.hugecat.net
├── istio-virtualservice.yaml     # Updated with chat.hugecat.net
└── kustomization.yaml            # Added new resources
```

## Accessing the Application

### URLs
- **HTTPS**: https://chat.hugecat.net
- **Health Check**: https://chat.hugecat.net/health
- **API Base**: https://chat.hugecat.net/api
- **WebSocket**: wss://chat.hugecat.net/api/socket.io

### Testing
```bash
# Test HTTPS connectivity
curl https://chat.hugecat.net/health

# Test HTTP redirect
curl -I http://chat.hugecat.net/health

# Verify DNS
nslookup chat.hugecat.net

# Check certificate
echo | openssl s_client -servername chat.hugecat.net -connect chat.hugecat.net:443 2>/dev/null | openssl x509 -noout -dates -subject
```

## Management Commands

### DNS Management
```bash
# Configure/update DNS
./scripts/azure/configure-dns.sh configure

# Show DNS record
./scripts/azure/configure-dns.sh show

# Delete DNS record
./scripts/azure/configure-dns.sh delete
```

### Certificate Management
```bash
# Check certificate status
kubectl get certificate chat-hugecat-tls -n default

# View certificate details
kubectl describe certificate chat-hugecat-tls -n default

# Manual certificate renewal (if needed)
kubectl delete certificate chat-hugecat-tls -n default
kubectl apply -k k8s/apps/chat/overlays/azure/
```

### Application Management
```bash
# Deploy/update application
kubectl apply -k k8s/apps/chat/overlays/azure/

# Check deployment status
kubectl get pods -n default -l app=chat-backend
kubectl get gateway chat-gateway -n default
kubectl get virtualservice -n default

# View logs
kubectl logs -n default -l app=chat-backend --tail=100 -f

# Cleanup
./scripts/azure/deploy-chat-subdomain.sh cleanup
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ DNS: chat.hugecat.net → 52.182.228.75
                     │
                     ▼
         ┌───────────────────────────┐
         │  Azure Load Balancer      │
         │  (52.182.228.75)          │
         └───────────┬───────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │  Istio Ingress Gateway    │
         │  (aks-istio-ingress)      │
         │  - TLS Termination        │
         │  - Gateway: chat-gateway  │
         └───────────┬───────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │  VirtualService           │
         │  (chat-vs-external)       │
         │  - Route matching         │
         │  - CORS policies          │
         └───────────┬───────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
   ┌────────┐              ┌────────────┐
   │ /api/* │              │ /* (other) │
   └────┬───┘              └─────┬──────┘
        │                        │
        ▼                        ▼
   ┌─────────────────────────────────┐
   │   Backend Service               │
   │   (chat-backend)                │
   │   - Express + Socket.io         │
   │   - Port 80 → Container 5001    │
   └─────────────────────────────────┘
```

## Security Features

### TLS/SSL
- ✓ Let's Encrypt certificates (auto-renewal)
- ✓ TLS 1.2+ only
- ✓ HTTP to HTTPS redirect
- ✓ HSTS headers (via Istio)

### Network Security
- ✓ Istio service mesh
- ✓ AuthorizationPolicy for access control
- ✓ CORS policies on API endpoints
- ✓ Internal service communication

### Certificate Management
- ✓ Automated issuance via cert-manager
- ✓ DNS-01 challenge (Azure DNS)
- ✓ 90-day certificates with auto-renewal
- ✓ Secrets managed by Kubernetes

## Troubleshooting

### Certificate Not Ready
```bash
# Check certificate status
kubectl describe certificate chat-hugecat-tls -n default

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=50

# Common issues:
# 1. DNS not propagated: Wait 5-10 minutes
# 2. DNS Zone permissions: Check managed identity has DNS Zone Contributor role
# 3. Rate limit: Let's Encrypt has rate limits (5 certs/week per domain)
```

### HTTPS Not Working
```bash
# Verify certificate secret exists in istio namespace
kubectl get secret chat-hugecat-tls-cert -n aks-istio-ingress

# If missing, copy it:
kubectl get secret chat-hugecat-tls-cert -n default -o yaml | \
  sed 's/namespace: default/namespace: aks-istio-ingress/' | \
  kubectl apply -f -

# Check gateway configuration
kubectl get gateway chat-gateway -n default -o yaml

# Check ingress gateway logs
kubectl logs -n aks-istio-ingress -l app=aks-istio-ingressgateway-external --tail=100
```

### DNS Not Resolving
```bash
# Check DNS record in Azure
az network dns record-set a show \
  --resource-group nekoc \
  --zone-name hugecat.net \
  --name chat

# Verify with multiple DNS servers
nslookup chat.hugecat.net 8.8.8.8
dig chat.hugecat.net @1.1.1.1

# Wait for propagation (TTL is 300 seconds)
```

### Application Not Responding
```bash
# Check pods
kubectl get pods -n default -l app=chat-backend

# Check logs
kubectl logs -n default -l app=chat-backend --tail=100

# Check service
kubectl get svc chat-backend -n default

# Test internal connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://chat-backend.default.svc.cluster.local/health
```

## Environment Variables

### DNS Configuration
```bash
export AZURE_DNS_ZONE="hugecat.net"        # DNS zone name
export AZURE_DNS_RG="nekoc"                 # Resource group (auto-detected)
export SUBDOMAIN="chat"                     # Subdomain to create
export DNS_TTL="300"                        # TTL in seconds
```

### Deployment Configuration
```bash
export NAMESPACE="default"                  # Kubernetes namespace
export CERT_MANAGER_VERSION="v1.14.0"       # cert-manager version
```

## Production Considerations

### Before Going to Production

1. **Update Email in ClusterIssuer**
   - Edit `k8s/apps/chat/overlays/azure/clusterissuer.yaml`
   - Change `email: admin@hugecat.net` to your email

2. **Customize Authorization Policy**
   - Edit `k8s/apps/chat/overlays/azure/authz-policy.yaml`
   - Implement proper access controls

3. **Review CORS Policies**
   - Edit `k8s/apps/chat/overlays/azure/istio-virtualservice.yaml`
   - Restrict `allowOrigins` to specific domains

4. **Enable Rate Limiting**
   - Consider adding Istio RateLimitConfig
   - Implement API rate limiting in application

5. **Monitor Certificate Expiry**
   - Set up alerts for certificate renewal
   - Monitor cert-manager logs

6. **Backup Configuration**
   - Document all manual steps
   - Version control all configurations

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Kubernetes events: `kubectl get events -n default --sort-by='.lastTimestamp'`
- Check application logs: `kubectl logs -n default -l app=chat-backend`
- Verify Istio configuration: `istioctl analyze -n default`

## Related Documentation

- [Azure Deployment Guide](../../docs/azure-deployment.md)
- [Azure Quick Setup](../../docs/azure-quick-setup.md)
- [Kubernetes Configuration](../../k8s/README.md)
