# Optional: SSL/TLS Setup with Let's Encrypt

This document describes how to optionally configure SSL/TLS certificates for your deployment using Let's Encrypt and cert-manager.

> **Note**: SSL/TLS setup is handled in a separate infrastructure repository. This guide is provided for reference only.

## Prerequisites

- Domain name configured with DNS provider
- cert-manager installed in cluster
- DNS provider credentials (for DNS-01 challenge)

## Overview

The application is configured to run at `example-chat.cat-herding.net`. To enable HTTPS:

1. Configure DNS A record pointing to your load balancer IP
2. Install cert-manager in your cluster
3. Create ClusterIssuer with your DNS provider
4. Create Certificate resource
5. Update Gateway to use the TLS secret

## Example Configuration

### 1. DNS Configuration

```bash
# Example: Azure DNS
az network dns record-set a add-record \
  --resource-group YOUR_RG \
  --zone-name cat-herding.net \
  --record-set-name example-chat \
  --ipv4-address YOUR_LOAD_BALANCER_IP
```

### 2. cert-manager Installation

```bash
# Add Jetstack Helm repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.13.3 \
  --set installCRDs=true
```

### 3. ClusterIssuer Example (Azure DNS)

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - dns01:
          azureDNS:
            subscriptionID: YOUR_SUBSCRIPTION_ID
            resourceGroupName: YOUR_DNS_RG
            hostedZoneName: cat-herding.net
            environment: AzurePublicCloud
            clientID: YOUR_CLIENT_ID
            clientSecretSecretRef:
              name: azuredns-config
              key: client-secret
            tenantID: YOUR_TENANT_ID
```

### 4. Certificate Resource

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: example-chat-cert
  namespace: default
spec:
  secretName: example-chat-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - example-chat.cat-herding.net
```

### 5. Copy Secret to Istio Namespace

```bash
# cert-manager creates the secret in the same namespace as Certificate
# Istio needs it in the ingress namespace
kubectl get secret example-chat-tls -n default -o yaml | \
  sed 's/namespace: default/namespace: aks-istio-ingress/' | \
  kubectl apply -f -
```

### 6. Update Gateway Configuration

The Gateway is already configured to use TLS. Update the `credentialName` in `gateway-patch.yaml`:

```yaml
tls:
  mode: SIMPLE
  credentialName: example-chat-tls # Your TLS secret name
```

## DNS Provider Options

### Cloudflare (Recommended for simplicity)

```yaml
solvers:
  - dns01:
      cloudflare:
        apiTokenSecretRef:
          name: cloudflare-api-token
          key: api-token
```

### AWS Route53

```yaml
solvers:
  - dns01:
      route53:
        region: us-east-1
        accessKeyID: YOUR_ACCESS_KEY_ID
        secretAccessKeySecretRef:
          name: route53-credentials
          key: secret-access-key
```

### Google Cloud DNS

```yaml
solvers:
  - dns01:
      cloudDNS:
        project: your-gcp-project
        serviceAccountSecretRef:
          name: clouddns-dns01-solver-sa
          key: key.json
```

## Verification

Once certificate is issued:

```bash
# Check certificate status
kubectl get certificate example-chat-cert -n default

# Test HTTPS
curl -I https://example-chat.cat-herding.net

# Verify certificate details
echo | openssl s_client -servername example-chat.cat-herding.net \
  -connect example-chat.cat-herding.net:443 2>/dev/null | \
  openssl x509 -noout -text
```

## Troubleshooting

```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager -f

# Check challenges
kubectl get challenges -n default

# Describe certificate for details
kubectl describe certificate example-chat-cert -n default
```

## Certificate Renewal

cert-manager automatically renews certificates 30 days before expiration. Monitor renewal:

```bash
kubectl get certificate example-chat-cert -n default -o yaml | \
  grep -A 3 "renewalTime"
```

## References

- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Istio TLS Configuration](https://istio.io/latest/docs/tasks/traffic-management/ingress/secure-ingress/)
