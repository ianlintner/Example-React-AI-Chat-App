# Azure Key Vault Integration Guide

This guide explains how to securely manage secrets using Azure Key Vault with the CSI Secrets Store driver for your AKS deployment.

## Overview

Azure Key Vault integration provides:
- ✅ **Secure Secret Storage** - Secrets stored in Azure Key Vault (`ai-chat-kv-1763873634`), not in Git
- ✅ **Automatic Secret Rotation** - CSI driver can auto-update secrets (2-minute sync interval)
- ✅ **Managed Identity** - No credentials needed, uses AKS kubelet identity
- ✅ **Audit Logging** - Track all secret access in Azure
- ✅ **Production Ready** - Enterprise-grade secret management

**Current Status:** ✅ OpenAI API key (`OPENAI-API-KEY`) is already stored in Key Vault

## Architecture

```text
┌─────────────────────┐
│   Azure Key Vault   │
│ ai-chat-kv-17638... │
│                     │
│ Secret:             │
│ OPENAI-API-KEY      │
└──────────┬──────────┘
           │
           │ CSI Driver syncs secret
           │
           ▼
┌─────────────────────┐
│   AKS Pod           │
│                     │
│ Volume Mount:       │
│ /mnt/secrets-store  │
│                     │
│ K8s Secret (sync):  │
│ kv-openai-secret    │
│                     │
│ Env Var:            │
│ OPENAI_API_KEY      │
└─────────────────────┘
```

## Quick Setup (5 minutes)

### Prerequisites

- Azure CLI installed and logged in: `az login`
- kubectl configured for your AKS cluster
- Existing AKS cluster deployed
- **✅ COMPLETED:** OpenAI API key already stored in Key Vault (`ai-chat-kv-1763873634`)

### Step 1: Enable CSI Secrets Store Driver on AKS

```bash
# Enable the addon if not already enabled
az aks enable-addons \
  --addons azure-keyvault-secrets-provider \
  --resource-group ai-chat-rg \
  --name <your-aks-cluster-name>
```

### Step 2: Get AKS Managed Identity Client ID

```bash
# Get the kubelet identity (managed identity used by AKS)
IDENTITY_CLIENT_ID=$(az aks show \
  --resource-group ai-chat-rg \
  --name <your-aks-cluster-name> \
  --query identityProfile.kubeletidentity.clientId \
  --output tsv)

echo "Managed Identity Client ID: $IDENTITY_CLIENT_ID"
```

### Step 3: Grant Key Vault Access

```bash
# Get Key Vault resource ID
KV_ID=$(az keyvault show \
  --name ai-chat-kv-1763873634 \
  --query id \
  --output tsv)

# Assign "Key Vault Secrets User" role
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee "${IDENTITY_CLIENT_ID}" \
  --scope "${KV_ID}"
```

### Step 4: Deploy the Application with Key Vault Integration

The manifests are already configured. Simply apply them:

```bash
# Apply all resources including SecretProviderClass
kubectl apply -k k8s/apps/chat/base/

# Verify SecretProviderClass is created
kubectl get secretproviderclass

# Check pod status
kubectl get pods -l app=chat-backend

# Verify secret is synced
kubectl get secret kv-openai-secret
```

### Step 5: Verify Secret Mounting

```bash
# Describe the pod to see volume mounts
POD_NAME=$(kubectl get pods -l app=chat-backend -o jsonpath='{.items[0].metadata.name}')
kubectl describe pod $POD_NAME

# Check if environment variable is set
kubectl exec $POD_NAME -- env | grep OPENAI_API_KEY

# Verify the secret content (optional - be careful with this in production)
kubectl get secret kv-openai-secret -o jsonpath='{.data.OPENAI_API_KEY}' | base64 --decode
echo ""
```

## Manual Configuration (Alternative)

If you prefer manual setup or need to troubleshoot:

### 1. Create Key Vault

```bash
RESOURCE_GROUP="ai-chat-rg"
KEY_VAULT_NAME="ai-chat-kv-$(date +%s)"
LOCATION="eastus"

az keyvault create \
  --name "$KEY_VAULT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --enable-rbac-authorization false
```

### 2. Enable CSI Driver on AKS

```bash
AKS_CLUSTER_NAME="ai-chat-aks"

az aks enable-addons \
  --name "$AKS_CLUSTER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --addons azure-keyvault-secrets-provider \
  --enable-secret-rotation
```

### 3. Grant Access to Kubelet Identity

```bash
# Get kubelet identity
KUBELET_IDENTITY_OBJECT_ID=$(az aks show \
  --name "$AKS_CLUSTER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query identityProfile.kubeletidentity.objectId -o tsv)

# Grant access
az keyvault set-policy \
  --name "$KEY_VAULT_NAME" \
  --object-id "$KUBELET_IDENTITY_OBJECT_ID" \
  --secret-permissions get list
```

### 4. Add Secrets to Key Vault

```bash
# OpenAI API Key
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "OPENAI-API-KEY" \
  --value "sk-proj-YOUR_KEY"

# Redis Password (auto-generate)
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "REDIS-PASSWORD" \
  --value "$(openssl rand -base64 32)"
```

## Verifying the Setup

### Check CSI Driver Status

```bash
# Check if CSI driver is running
kubectl get pods -n kube-system | grep csi

# Expected output:
# csi-secrets-store-provider-azure-xxxxx   1/1     Running
# csi-secrets-store-xxxxx                  3/3     Running
```

### Check SecretProviderClass

```bash
kubectl get secretproviderclass -n default
kubectl describe secretproviderclass azure-keyvault-chat-secrets
```

### Check Secrets are Mounted

```bash
# Get pod name
POD_NAME=$(kubectl get pods -l app=chat-backend -o jsonpath='{.items[0].metadata.name}')

# Check if secrets are mounted
kubectl exec -it $POD_NAME -- ls -la /mnt/secrets-store/

# Verify Kubernetes secret is created
kubectl get secret chat-secrets-from-keyvault
kubectl describe secret chat-secrets-from-keyvault
```

### Test Environment Variables

```bash
# Check if environment variables are set
kubectl exec -it $POD_NAME -- env | grep -E "OPENAI_API_KEY|REDIS_PASSWORD"

# Should show: OPENAI_API_KEY=sk-proj-...
```

## Updating Secrets

To update a secret without redeploying:

```bash
# Update the secret in Key Vault
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "OPENAI-API-KEY" \
  --value "sk-proj-NEW_KEY"

# Wait for CSI driver to sync (default: 2 minutes)
# Or restart the pod to force immediate update
kubectl rollout restart deployment/chat-backend
```

## Troubleshooting

### Secret Not Found

**Symptom:** Pod fails to start with "failed to mount secret"

**Solution:**
```bash
# Check SecretProviderClass configuration
kubectl describe secretproviderclass azure-keyvault-chat-secrets

# Verify Key Vault access
az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "OPENAI-API-KEY"

# Check CSI driver logs
kubectl logs -n kube-system -l app=secrets-store-csi-driver
```

### Permission Denied

**Symptom:** "access denied" or "403" errors in pod events

**Solution:**
```bash
# Verify kubelet identity has access
KUBELET_IDENTITY_OBJECT_ID=$(az aks show \
  --name "$AKS_CLUSTER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query identityProfile.kubeletidentity.objectId -o tsv)

# Re-apply access policy
az keyvault set-policy \
  --name "$KEY_VAULT_NAME" \
  --object-id "$KUBELET_IDENTITY_OBJECT_ID" \
  --secret-permissions get list
```

### CSI Driver Not Running

**Symptom:** CSI pods not found in kube-system namespace

**Solution:**
```bash
# Enable the addon
az aks enable-addons \
  --name "$AKS_CLUSTER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --addons azure-keyvault-secrets-provider

# Wait for pods to start
kubectl get pods -n kube-system -w | grep csi
```

## Security Best Practices

1. **Use Managed Identity** - Never store credentials in code or config
2. **Enable Secret Rotation** - CSI driver supports automatic rotation
3. **Audit Secret Access** - Enable Key Vault logging
4. **Use RBAC** - Limit who can access Key Vault
5. **Separate Environments** - Use different Key Vaults for dev/staging/prod

## Migration from Manual Secrets

If you're migrating from manual secrets (`secrets.yaml`):

1. Create secrets in Key Vault with same keys
2. Apply SecretProviderClass
3. Update kustomization.yaml to use keyvault patch
4. Deploy and verify
5. Remove `secrets.yaml` from Git (if not already ignored)

```bash
# Backup current secrets
kubectl get secret chat-secrets -o yaml > backup-secrets.yaml

# Get values to migrate
OPENAI_KEY=$(kubectl get secret chat-secrets -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d)

# Add to Key Vault
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "OPENAI-API-KEY" \
  --value "$OPENAI_KEY"

# Deploy with Key Vault integration
kubectl apply -k k8s/apps/chat/overlays/azure/
```

## Cost Considerations

Azure Key Vault pricing (as of 2024):
- **Secrets**: $0.03 per 10,000 transactions
- **Key Vault**: No monthly charge
- **Typical monthly cost**: < $5 for small applications

CSI driver is free (part of AKS).

## Additional Resources

- [Azure Key Vault Documentation](https://docs.microsoft.com/azure/key-vault/)
- [CSI Secrets Store Driver](https://secrets-store-csi-driver.sigs.k8s.io/)
- [AKS Key Vault Integration](https://docs.microsoft.com/azure/aks/csi-secrets-store-driver)
- [Secret Rotation](https://secrets-store-csi-driver.sigs.k8s.io/topics/secret-auto-rotation.html)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review CSI driver logs: `kubectl logs -n kube-system -l app=secrets-store-csi-driver`
3. Check Key Vault access logs in Azure Portal
4. See [Azure deployment documentation](../azure-deployment.md)
