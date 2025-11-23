# Getting Started with Azure AKS Deployment

## Prerequisites Checklist

- [ ] Azure account with active subscription
- [ ] Azure CLI installed (`az --version`)
- [ ] kubectl installed (`kubectl version --client`)
- [ ] Docker installed (`docker --version`)
- [ ] Istio enabled on AKS (configured via Azure Portal)

## 5-Minute Quick Start

### 1. Login to Azure

```bash
az login
```

### 2. Set Unique ACR Name

```bash
# Use timestamp to make it unique
export AZURE_ACR_NAME="aichat$(date +%s)"
echo "Your ACR name: $AZURE_ACR_NAME"
```

### 3. Run Deployment

```bash
cd /path/to/Example-React-AI-Chat-App
./scripts/azure/deploy-aks.sh deploy
```

### 4. Access Your App

The script will display the public IP at the end. Access your app at:

```
http://<DISPLAYED_IP_ADDRESS>
```

### 5. (Optional) Set Up Domain

If you have a domain:

1. Point your domain's A record to the displayed IP
2. Update `k8s/apps/chat/overlays/azure/istio-gateway.yaml` with your domain
3. Update `k8s/apps/chat/overlays/azure/istio-virtualservice.yaml` with your domain
4. Redeploy: `./scripts/azure/deploy-aks.sh update`

## What Gets Created

✅ **Resource Group**: `ai-chat-rg`
✅ **Azure Container Registry**: Your unique ACR name
✅ **AKS Cluster**: 2-node cluster with Standard_D2s_v3 VMs
✅ **Istio Service Mesh**: Managed by AKS add-on
✅ **Istio Ingress Gateway**: Manages routing and load balancing
✅ **Azure Load Balancer**: Public IP for external access
✅ **Application**: Chat backend with Redis

## Estimated Costs

**Default Setup**: ~$185/month

- AKS nodes (2 × Standard_D2s_v3): ~$140/month
- Load Balancer: ~$25/month
- Container Registry: ~$20/month

**Budget Setup**: ~$30-40/month

```bash
export AZURE_NODE_COUNT=1
export AZURE_NODE_SIZE=Standard_B2s
./scripts/azure/deploy-aks.sh deploy
```

## Common Commands

### Check Status

```bash
kubectl get pods              # Check application pods
kubectl get services          # Check services
kubectl get gateway           # Check Istio gateway
kubectl get virtualservice    # Check Istio virtual service
```

### View Logs

```bash
kubectl logs -l app=chat-backend -f    # Follow backend logs
```

### Scale Application

```bash
kubectl scale deployment chat-backend --replicas=3
```

### Update Application

```bash
# After making code changes
./scripts/azure/deploy-aks.sh build   # Build and push new image
./scripts/azure/deploy-aks.sh update  # Deploy update
```

### Clean Up Everything

```bash
./scripts/azure/deploy-aks.sh cleanup
```

## Customization

### Change Region

```bash
export AZURE_LOCATION=westus2
./scripts/azure/deploy-aks.sh deploy
```

### Change Node Size/Count

```bash
export AZURE_NODE_COUNT=3
export AZURE_NODE_SIZE=Standard_D4s_v3
./scripts/azure/deploy-aks.sh deploy
```

### Use Custom Names

```bash
export AZURE_RESOURCE_GROUP=my-custom-rg
export AZURE_CLUSTER_NAME=my-cluster
export AZURE_ACR_NAME=myuniqueacr
./scripts/azure/deploy-aks.sh deploy
```

## Next Steps

1. **Add Secrets**

   ```bash
   cp k8s/apps/chat/overlays/azure/secrets.yaml.example \
      k8s/apps/chat/overlays/azure/secrets.yaml
   # Edit with your OpenAI API key
   ```

2. **Set Up SSL**
   - Install cert-manager
   - Configure Let's Encrypt
   - See [Azure Deployment Guide](../../../docs/azure-deployment.md#setting-up-a-custom-domain)

3. **Enable Monitoring**
   - Already enabled by default
   - View in Azure Portal → AKS Cluster → Insights

4. **Set Up CI/CD**
   - Configure GitHub Actions
   - Automated deployments on push

## Troubleshooting

### ACR Name Already Taken

```bash
# Try with your initials
export AZURE_ACR_NAME="aichatjd$(date +%s)"
```

### Can't Access Application

```bash
# Check if Istio gateway is ready
kubectl get gateway chat-gateway-external

# Check Istio ingress service for external IP
kubectl get svc -n aks-istio-ingress

# Check Istio pods
kubectl get pods -n aks-istio-system
```

### Deployment Failed

```bash
# Check pod events
kubectl get events --sort-by='.lastTimestamp'

# Check pod details
kubectl describe pod <pod-name>
```

### Need Help?

- See [README.md](./README.md) for detailed configuration
- See [Azure Deployment Guide](../../../docs/azure-deployment.md) for complete instructions
- Check [Azure AKS Troubleshooting](https://docs.microsoft.com/en-us/azure/aks/troubleshooting)

## Cost Monitoring

Monitor your costs:

1. Azure Portal → Cost Management + Billing
2. Set up budget alerts
3. Review resource usage regularly

**Remember to delete resources when not in use!**

```bash
./scripts/azure/deploy-aks.sh cleanup
```
