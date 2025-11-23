# Azure Key Vault Integration Guide

This guide explains how to securely manage secrets using Azure Key Vault with the CSI Secrets Store driver for your AKS deployment.

## Overview

Azure Key Vault integration provides:
- ✅ **Secure Secret Storage** - Secrets stored in Azure Key Vault, not in Git
- ✅ **Automatic Secret Rotation** - CSI driver can auto-update secrets
- ✅ **Managed Identity** - No credentials needed, uses AKS kubelet identity
- ✅ **Audit Logging** - Track all secret access in Azure
- ✅ **Production Ready** - Enterprise-grade secret management

## Architecture

```
┌─────────────┐
│   AKS Pod   │
│             │
│  ┌───────┐  │      ┌──────────────────┐
│  │ App   │  │      │  Azure Key Vault │
│  │       │◄─┼──────┤                  │
│  └───────┘  │      │  - OPENAI_API_KEY│
│             │      │  - REDIS_PASSWORD│
│  CSI Driver │      └──────────────────┘
│  Volume     │              ▲
└─────────────┘              │
                      Kubelet Identity
```

## Quick Setup (5 minutes)

### Prerequisites

- Azure CLI installed and logged in: `az login`
- kubectl configured for your AKS cluster
- Existing AKS cluster deployed

### Step 1: Run Setup Script

```bash
# Make the script executable
chmod +x scripts/azure/setup-keyvault.sh

# Run the setup script
./scripts/azure/setup-keyvault.sh
```

The script will:
1. Create Azure Key Vault
2. Enable CSI driver addon on AKS
3. Configure access policies for kubelet identity
4. Create placeholder secrets
5. Generate configuration file

### Step 2: Update OpenAI API Key

After the script completes, update the OpenAI API key:

```bash
# Get Key Vault name from the output or config file
KEY_VAULT_NAME=$(grep AZURE_KEY_VAULT_NAME k8s/apps/chat/overlays/azure/.keyvault-config | cut -d= -f2)

# Set your OpenAI API key
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "OPENAI-API-KEY" \
  --value "sk-proj-YOUR_ACTUAL_OPENAI_KEY_HERE"
```

### Step 3: Configure SecretProviderClass

Update the SecretProviderClass with your Key Vault details:

```bash
# Get configuration values
source k8s/apps/chat/overlays/azure/.keyvault-config

# Update secret-provider-class.yaml
sed -i '' "s/<KEY_VAULT_NAME>/$AZURE_KEY_VAULT_NAME/g" \
  k8s/apps/chat/overlays/azure/secret-provider-class.yaml

sed -i '' "s/<TENANT_ID>/$AZURE_TENANT_ID/g" \
  k8s/apps/chat/overlays/azure/secret-provider-class.yaml
```

### Step 4: Enable Key Vault Integration

Edit `k8s/apps/chat/overlays/azure/kustomization.yaml` and uncomment the Key Vault patch:

```yaml
patches:
  - path: deployment-patch.yaml
    target:
      kind: Deployment
      name: chat-backend
  - path: deployment-keyvault-patch.yaml  # Uncomment this
    target:                                # and this
      kind: Deployment                     # and this
      name: chat-backend                   # and this
```

### Step 5: Deploy Application

```bash
# Apply the configuration
kubectl apply -k k8s/apps/chat/overlays/azure/

# Verify the secret is mounted
kubectl get secretproviderclass
kubectl get pods
kubectl describe pod <pod-name> | grep -A 10 "Mounts:"
```

## Manual Configuration (Alternative)

If you prefer manual setup:

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
4. See [Azure deployment documentation](azure-deployment.md)
