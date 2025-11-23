# Subdomain Migration Complete

## Summary

Successfully migrated deployment from root domain `cat-herding.net` to subdomain `example-chat.cat-herding.net`.

## Changes Made

### 1. Cleanup of Let's Encrypt/SSL Setup Files

Removed the following files (SSL setup now handled in separate infrastructure repo):
- `setup-ssl.sh` - SSL setup automation script
- `setup-letsencrypt.sh` - Let's Encrypt certificate setup script
- `acme-http-solver.yaml` - ACME HTTP-01 challenge VirtualService
- `cert-manager-issuer.yaml` - ClusterIssuers for Let's Encrypt
- `certificate.yaml` - Certificate resource for wildcard cert
- `AZURE_DNS_SSL_SETUP.md` - Complete Azure DNS SSL setup guide
- `SSL_SETUP_OPTIONS.md` - SSL setup options documentation
- `LETSENCRYPT_SETUP.md` - General Let's Encrypt reference

### 2. Configuration Updates

**gateway-patch.yaml:**
- Updated host from `*.cat-herding.net` to `example-chat.cat-herding.net`
- Reverted credentialName to `cat-herding-tls` (wildcard cert covers subdomain)
- Configured HTTPS on port 443 with HTTP redirect on port 80

**istio-virtualservice.yaml:**
- Updated host from `cat-herding.net` to `example-chat.cat-herding.net`
- Routing remains unchanged (Socket.io, API, health, docs, metrics)

**kustomization.yaml:**
- Removed references to `cert-manager-issuer.yaml`
- Removed references to `certificate.yaml`

**README.md:**
- Simplified SSL/TLS setup section
- Referenced new `OPTIONAL_SSL_SETUP.md` for detailed instructions
- Updated domain references to `example-chat.cat-herding.net`

### 3. New Documentation

**OPTIONAL_SSL_SETUP.md:**
- Comprehensive SSL/TLS setup guide
- cert-manager installation instructions
- DNS-01 challenge examples for multiple providers (Azure DNS, Cloudflare, Route53, GCP)
- Certificate verification and troubleshooting
- Marked as optional/reference documentation

### 4. DNS Configuration

Created DNS A record:
```bash
az network dns record-set a add-record \
  --resource-group nekoc \
  --zone-name cat-herding.net \
  --record-set-name example-chat \
  --ipv4-address 52.182.228.75
```

**Result:**
- FQDN: `example-chat.cat-herding.net`
- IP: `52.182.228.75` (AKS Istio ingress external IP)
- TTL: 3600 seconds

## Current Configuration

### Domain
- **Live URL**: https://example-chat.cat-herding.net
- **DNS Zone**: cat-herding.net (Azure DNS)
- **Record Type**: A record
- **IP Address**: 52.182.228.75

### SSL/TLS
- **Certificate**: Wildcard Let's Encrypt certificate (`*.cat-herding.net`)
- **Secret Name**: `cat-herding-tls`
- **Secret Location**: `aks-istio-ingress` namespace
- **Expiration**: 2026-02-21
- **Auto-renewal**: Enabled via cert-manager

### Kubernetes Resources
- **Namespace**: default
- **Gateway**: chat-gateway (Istio Gateway)
- **VirtualService**: chat-vs-external
- **Backend Service**: chat-backend
- **Replicas**: 2

## Verification

### Test Results (2025-11-23)

✅ **HTTPS Root**: HTTP/2 200
```bash
curl -I https://example-chat.cat-herding.net
```

✅ **API Health Endpoint**: Returns JSON health status
```bash
curl https://example-chat.cat-herding.net/api/health
# {"status":"OK","timestamp":"2025-11-23T04:22:17.914Z"}
```

✅ **HTTP Redirect**: 301 to HTTPS
```bash
curl -I http://example-chat.cat-herding.net
# HTTP/1.1 301 Moved Permanently
# location: https://example-chat.cat-herding.net/
```

✅ **Certificate Verification**: Valid Let's Encrypt wildcard certificate
```bash
echo | openssl s_client -servername example-chat.cat-herding.net \
  -connect example-chat.cat-herding.net:443 2>/dev/null | \
  grep subject=
# subject=/CN=*.cat-herding.net
# issuer=/C=US/O=Let's Encrypt/CN=R12
```

## Architecture

```
Internet
    ↓
example-chat.cat-herding.net (52.182.228.75)
    ↓
Azure Load Balancer
    ↓
AKS Istio Ingress Gateway (aks-istio-ingressgateway-external)
    ↓
Istio Gateway (chat-gateway)
    ↓ [TLS Termination: cat-herding-tls secret]
Istio VirtualService (chat-vs-external)
    ↓
Backend Service (chat-backend:80)
    ↓
Backend Pods (2 replicas, port 5001)
```

## SSL/TLS Setup (For Reference)

SSL/TLS is now handled in a separate infrastructure repository. For teams needing to set up certificates:

1. See [OPTIONAL_SSL_SETUP.md](./OPTIONAL_SSL_SETUP.md) for complete instructions
2. Current setup uses:
   - cert-manager v1.13.3
   - Let's Encrypt production issuer
   - Azure DNS DNS-01 challenge
   - Service Principal: cert-manager-dns-cat-herding
   - Wildcard certificate: `*.cat-herding.net`

## Next Steps

### Optional Enhancements

1. **Dedicated Certificate** (Optional):
   - Create specific certificate for `example-chat.cat-herding.net`
   - Update gateway to use `example-chat-tls` secret
   - See OPTIONAL_SSL_SETUP.md for instructions

2. **Monitoring**:
   - Set up alerts for certificate expiration
   - Monitor SSL/TLS handshake metrics
   - Track DNS resolution times

3. **Additional Subdomains**:
   - API-specific: `api.cat-herding.net`
   - WebSocket-specific: `ws.cat-herding.net`
   - Admin panel: `admin.cat-herding.net`

### Deployment Notes

- Application is production-ready at `example-chat.cat-herding.net`
- All SSL/TLS infrastructure managed by cert-manager (automatic renewal)
- Wildcard certificate covers any additional `*.cat-herding.net` subdomains
- No code changes needed for SSL - handled entirely at ingress layer

## Troubleshooting

If HTTPS stops working:

```bash
# Check certificate status
kubectl get certificate -n default
kubectl describe certificate cat-herding-wildcard-cert -n default

# Check TLS secret
kubectl get secret cat-herding-tls -n aks-istio-ingress

# Check Gateway configuration
kubectl get gateway chat-gateway -o yaml

# Check Istio ingress logs
kubectl logs -n aks-istio-system -l app=istiod -f
```

## Maintenance

### Certificate Renewal
- Automatic via cert-manager (30 days before expiration)
- Monitor: `kubectl get certificate -n default -w`

### DNS Updates
- Managed via Azure DNS
- Update A record if load balancer IP changes
- TTL: 3600 seconds (1 hour propagation)

### Kubernetes Resources
- Gateway and VirtualService configurations in `k8s/apps/chat/overlays/azure/`
- Apply changes: `kubectl apply -k k8s/apps/chat/overlays/azure/`
- Rollback: `kubectl rollout undo deployment/chat-backend`

---

**Migration Date**: 2025-11-23  
**Status**: ✅ Complete and Verified  
**Live URL**: https://example-chat.cat-herding.net
