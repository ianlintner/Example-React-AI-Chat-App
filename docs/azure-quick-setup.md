# Azure AKS Quick Setup

This is a streamlined guide to get the AI Chat App running on Azure AKS quickly.

## Prerequisites

- Azure CLI installed
- kubectl installed
- Docker installed
- An Azure subscription

## Quick Deploy (5 commands)

```bash
# 1. Login to Azure
az login

# 2. Set your ACR name (must be globally unique)
export AZURE_ACR_NAME="aichatacr$(date +%s)"  # Creates unique name with timestamp

# 3. Clone and navigate to the repository (if not already done)
cd /path/to/Example-React-AI-Chat-App

# 4. Run the deployment script
./scripts/azure/deploy-aks.sh deploy

# 5. Get your app URL (displayed at the end of deployment)
# Access your app at the displayed IP address
```

## What Gets Created

- **Resource Group**: `nekoc` (in East US by default)
- **AKS Cluster**: `bigboy` with 2 nodes
- **Container Registry**: `gabby` (Azure Container Registry)
- **Load Balancer**: Created automatically by Kubernetes
- **Application**: Deployed and accessible via public IP

## Next Steps

1. **Access Your App**: Use the IP address displayed after deployment
2. **Set Up a Domain**: Follow the [full guide](./azure-deployment.md#setting-up-a-custom-domain)
3. **Configure SSL**: Set up cert-manager for HTTPS
4. **Add Secrets**: Update secrets.yaml with your OpenAI API key

## Customize Your Deployment

Set these environment variables before running the script:

```bash
export AZURE_RESOURCE_GROUP="my-custom-rg"
export AZURE_CLUSTER_NAME="my-cluster"
export AZURE_LOCATION="westus2"
export AZURE_ACR_NAME="myuniqueacr"
export AZURE_NODE_COUNT="3"
export AZURE_NODE_SIZE="Standard_D4s_v3"

./scripts/azure/deploy-aks.sh deploy
```

## Common Commands

```bash
# Check deployment status
kubectl get pods

# View logs
kubectl logs -l app=chat-backend -f

# Get ingress IP
kubectl get ingress

# Scale up
kubectl scale deployment chat-backend --replicas=3

# Update application
./scripts/azure/deploy-aks.sh update

# Clean up everything
./scripts/azure/deploy-aks.sh cleanup
```

## Troubleshooting

### Deployment Fails

```bash
# Check pod status
kubectl get pods
kubectl describe pod <pod-name>

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

### Can't Access the App

```bash
# Verify ingress has an IP
kubectl get ingress chat-backend-ingress

# Check NGINX Ingress Controller
kubectl get pods -n ingress-nginx
```

### ACR Name Already Exists

The ACR name must be globally unique across all of Azure. Try adding your initials or a random number:

```bash
export AZURE_ACR_NAME="aichatmyinitials$(date +%s)"
```

## Cost Estimate

With default settings (2 x Standard_D2s_v3 nodes):
- ~$140/month for AKS nodes
- ~$25/month for Load Balancer
- ~$20/month for Container Registry
- **Total: ~$185/month**

### Save Money

For development/testing:

```bash
export AZURE_NODE_COUNT="1"
export AZURE_NODE_SIZE="Standard_B2s"
./scripts/azure/deploy-aks.sh deploy
```

This reduces costs to ~$30-40/month.

**Remember to delete resources when not in use:**

```bash
./scripts/azure/deploy-aks.sh cleanup
```

## Full Documentation

For detailed information, see the [complete Azure deployment guide](./azure-deployment.md).
