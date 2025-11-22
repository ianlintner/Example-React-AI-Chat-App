# Azure AKS Deployment Guide

This guide walks you through deploying the AI Chat Application to Azure Kubernetes Service (AKS).

## Prerequisites

Before you begin, ensure you have:

1. **Azure Account**: An active Azure subscription ([Get one free](https://azure.microsoft.com/free/))
2. **Azure CLI**: Install from [here](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
3. **kubectl**: Install from [here](https://kubernetes.io/docs/tasks/tools/)
4. **Docker**: Install from [here](https://docs.docker.com/get-docker/)
5. **Helm** (optional, for NGINX Ingress): Install from [here](https://helm.sh/docs/intro/install/)

## Architecture Overview

The Azure deployment includes:

- **Azure Kubernetes Service (AKS)**: Managed Kubernetes cluster
- **Azure Container Registry (ACR)**: Private Docker registry for your images
- **NGINX Ingress Controller**: HTTP(S) routing and load balancing
- **Azure Load Balancer**: External traffic routing (created automatically)
- **Redis**: In-cluster Redis for session storage
- **Optional**: Azure Monitor for container monitoring (enabled by default)

## Quick Start

### Option 1: Automated Deployment (Recommended)

Use the provided deployment script to set up everything automatically:

```bash
# Set environment variables (optional, defaults provided)
export AZURE_RESOURCE_GROUP="nekoc"
export AZURE_CLUSTER_NAME="bigboy"
export AZURE_LOCATION="eastus"
export AZURE_ACR_NAME="gabby"  # Must be globally unique, lowercase letters/numbers only

# Run the deployment script
./scripts/azure/deploy-aks.sh deploy
```

This script will:
1. Create a resource group
2. Create an Azure Container Registry (ACR)
3. Create an AKS cluster
4. Install NGINX Ingress Controller
5. Build and push your Docker image
6. Deploy the application
7. Display the public IP address

### Option 2: Manual Step-by-Step Deployment

If you prefer manual control, follow these steps:

#### 1. Login to Azure

```bash
az login
```

#### 2. Set Environment Variables

```bash
export RESOURCE_GROUP="nekoc"
export CLUSTER_NAME="bigboy"
export LOCATION="eastus"
export ACR_NAME="gabby"  # Must be globally unique
```

#### 3. Create Resource Group

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

#### 4. Create Azure Container Registry

```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Standard \
  --location $LOCATION
```

#### 5. Create AKS Cluster

```bash
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count 2 \
  --node-vm-size Standard_D2s_v3 \
  --enable-managed-identity \
  --attach-acr $ACR_NAME \
  --enable-addons monitoring \
  --generate-ssh-keys \
  --network-plugin azure \
  --network-policy azure \
  --load-balancer-sku standard
```

This will take several minutes to complete.

#### 6. Get AKS Credentials

```bash
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --overwrite-existing
```

#### 7. Install NGINX Ingress Controller

```bash
# Add Helm repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --create-namespace \
  --namespace ingress-nginx \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz
```

#### 8. Build and Push Docker Image

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push the image
docker build -t ${ACR_NAME}.azurecr.io/chat-backend:latest .
docker push ${ACR_NAME}.azurecr.io/chat-backend:latest
```

#### 9. Configure Secrets

Create a `secrets.yaml` file from the example:

```bash
cp k8s/apps/chat/overlays/azure/secrets.yaml.example \
   k8s/apps/chat/overlays/azure/secrets.yaml
```

Edit the `secrets.yaml` file with your actual values:

```bash
# Edit with your preferred editor
nano k8s/apps/chat/overlays/azure/secrets.yaml
```

Update the kustomization.yaml to include secrets:

```bash
# Uncomment the secrets line in k8s/apps/chat/overlays/azure/kustomization.yaml
```

#### 10. Update Deployment Configuration

Update the ACR name in the deployment patch:

```bash
sed -i "s/YOUR_ACR_NAME/${ACR_NAME}/g" \
  k8s/apps/chat/overlays/azure/deployment-patch.yaml
```

#### 11. Deploy to AKS

```bash
kubectl apply -k k8s/apps/chat/overlays/azure/
```

#### 12. Get the Ingress IP Address

Wait for the Load Balancer to be provisioned:

```bash
kubectl get ingress chat-backend-ingress -w
```

Once the EXTERNAL-IP appears (may take a few minutes), you can access your application:

```bash
INGRESS_IP=$(kubectl get ingress chat-backend-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Application URL: http://${INGRESS_IP}"
```

## Configuration

### Environment Variables

The deployment script accepts these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `AZURE_RESOURCE_GROUP` | `nekoc` | Azure resource group name |
| `AZURE_CLUSTER_NAME` | `bigboy` | AKS cluster name |
| `AZURE_LOCATION` | `eastus` | Azure region |
| `AZURE_ACR_NAME` | `gabby` | Container registry name (must be globally unique) |
| `AZURE_NODE_COUNT` | `2` | Number of nodes in the cluster |
| `AZURE_NODE_SIZE` | `Standard_D2s_v3` | VM size for nodes |

### Updating the Application

To update your application after making changes:

```bash
# Build and push new image
./scripts/azure/deploy-aks.sh build

# Deploy updates
./scripts/azure/deploy-aks.sh update
```

Or manually:

```bash
# Build and push
az acr login --name $ACR_NAME
docker build -t ${ACR_NAME}.azurecr.io/chat-backend:latest .
docker push ${ACR_NAME}.azurecr.io/chat-backend:latest

# Restart deployment to pull new image
kubectl rollout restart deployment/chat-backend
```

## Setting Up a Custom Domain

### 1. Point Your Domain to the Ingress IP

Get the Ingress IP:

```bash
kubectl get ingress chat-backend-ingress
```

Create an A record in your DNS provider pointing to this IP:

```
chat.yourdomain.com -> <INGRESS_IP>
```

### 2. Update the Ingress Configuration

Edit `k8s/apps/chat/overlays/azure/ingress.yaml`:

```yaml
spec:
  rules:
    - host: chat.yourdomain.com  # Your actual domain
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

### 3. Set Up TLS/SSL with cert-manager (Optional but Recommended)

Install cert-manager:

```bash
# Add Jetstack Helm repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

Create a ClusterIssuer for Let's Encrypt:

```bash
kubectl apply -f - <<EOF
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
    - http01:
        ingress:
          class: nginx
EOF
```

Update the ingress to enable TLS:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - chat.yourdomain.com
      secretName: chat-backend-tls
  rules:
    - host: chat.yourdomain.com
      # ... rest of configuration
```

Apply the changes:

```bash
kubectl apply -k k8s/apps/chat/overlays/azure/
```

## Monitoring and Logs

### View Application Logs

```bash
# View backend logs
kubectl logs -l app=chat-backend --tail=100 -f

# View Redis logs
kubectl logs -l app=redis --tail=100 -f
```

### View Ingress Controller Logs

```bash
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=100 -f
```

### Azure Monitor

Your cluster is deployed with Azure Monitor enabled. View metrics and logs in the Azure Portal:

1. Go to the Azure Portal
2. Navigate to your AKS cluster
3. Click on "Insights" in the left menu

## Scaling

### Scale the Application

```bash
# Scale to 3 replicas
kubectl scale deployment chat-backend --replicas=3

# Or update the deployment-patch.yaml and redeploy
```

### Scale the AKS Cluster

```bash
az aks scale \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count 3
```

### Enable Autoscaling

```bash
# Enable cluster autoscaler
az aks update \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 5

# Create Horizontal Pod Autoscaler for the application
kubectl autoscale deployment chat-backend --cpu-percent=50 --min=2 --max=10
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods
kubectl describe pod <pod-name>
```

### Check Service Status

```bash
kubectl get services
kubectl describe service chat-backend
```

### Check Ingress Status

```bash
kubectl get ingress
kubectl describe ingress chat-backend-ingress
```

### Check Ingress Controller

```bash
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### Common Issues

#### 1. Image Pull Errors

Ensure ACR is attached to AKS:

```bash
az aks update \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --attach-acr $ACR_NAME
```

#### 2. Ingress Not Getting an IP

Check NGINX Ingress Controller status:

```bash
kubectl get services -n ingress-nginx
```

Ensure the LoadBalancer service has an external IP.

#### 3. Application Not Accessible

Check if the application pods are running:

```bash
kubectl get pods
```

Check ingress configuration:

```bash
kubectl get ingress chat-backend-ingress -o yaml
```

## Cost Optimization

### Estimated Costs

- AKS cluster (2 x Standard_D2s_v3): ~$140/month
- Azure Load Balancer: ~$25/month
- ACR (Standard): ~$20/month
- Azure Monitor: Variable based on usage

### Tips to Reduce Costs

1. Use smaller VM sizes for development: `Standard_B2s` (~$30/month)
2. Reduce node count to 1 for non-production environments
3. Use Azure Dev/Test pricing if applicable
4. Set up auto-shutdown for non-production clusters
5. Delete resources when not in use:

```bash
./scripts/azure/deploy-aks.sh cleanup
```

## Security Best Practices

1. **Use Azure Key Vault**: Store secrets in Azure Key Vault instead of Kubernetes secrets
2. **Enable RBAC**: Configure role-based access control
3. **Network Policies**: Use Azure Network Policies or Calico
4. **Private Cluster**: Consider using a private AKS cluster for production
5. **Update Regularly**: Keep AKS and applications updated

## Advanced Configuration

### Using Azure Redis Cache

Instead of the in-cluster Redis, use Azure Redis Cache:

1. Create Azure Redis Cache:

```bash
az redis create \
  --resource-group $RESOURCE_GROUP \
  --name ai-chat-redis \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0
```

2. Update ConfigMap with Redis connection details
3. Remove the redis.yaml from kustomization

### Using Azure Key Vault

Integrate with Azure Key Vault for secrets:

1. Install the Secrets Store CSI Driver
2. Create a Key Vault
3. Configure workload identity
4. Update deployments to mount secrets from Key Vault

See Azure documentation for detailed steps.

## Cleanup

To delete all resources and avoid charges:

```bash
./scripts/azure/deploy-aks.sh cleanup
```

Or manually:

```bash
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

## Support

For issues or questions:

1. Check the [main README](https://github.com/ianlintner/Example-React-AI-Chat-App/blob/main/README.md)
2. Review Azure AKS documentation
3. Open an issue on GitHub

## References

- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/en-us/azure/container-registry/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
