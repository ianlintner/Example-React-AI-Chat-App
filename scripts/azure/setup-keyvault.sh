#!/bin/bash

# Azure Key Vault Setup Script
# This script creates and configures Azure Key Vault for storing application secrets
# Prerequisites: Azure CLI installed and logged in

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-ai-chat-rg}"
KEY_VAULT_NAME="${AZURE_KEY_VAULT_NAME:-ai-chat-kv-$(date +%s)}"
LOCATION="${AZURE_LOCATION:-eastus}"
AKS_CLUSTER_NAME="${AZURE_AKS_CLUSTER_NAME:-ai-chat-aks}"
NAMESPACE="${K8S_NAMESPACE:-default}"

echo -e "${BLUE}=== Azure Key Vault Setup ===${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! command_exists az; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

if ! command_exists kubectl; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    echo "Install from: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites satisfied${NC}"
echo ""

# Check Azure login
echo -e "${YELLOW}Checking Azure login...${NC}"
if ! az account show > /dev/null 2>&1; then
    echo -e "${RED}Error: Not logged into Azure CLI${NC}"
    echo "Run: az login"
    exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo -e "${GREEN}✓ Logged into Azure (Subscription: $SUBSCRIPTION_ID)${NC}"
echo ""

# Create or verify resource group
echo -e "${YELLOW}Setting up resource group: $RESOURCE_GROUP${NC}"
if ! az group show --name "$RESOURCE_GROUP" > /dev/null 2>&1; then
    echo "Creating resource group..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
else
    echo -e "${GREEN}✓ Resource group already exists${NC}"
fi
echo ""

# Create Key Vault
echo -e "${YELLOW}Creating Azure Key Vault: $KEY_VAULT_NAME${NC}"
if ! az keyvault show --name "$KEY_VAULT_NAME" > /dev/null 2>&1; then
    az keyvault create \
        --name "$KEY_VAULT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --enable-rbac-authorization false \
        --enabled-for-deployment true \
        --enabled-for-template-deployment true
    
    echo -e "${GREEN}✓ Key Vault created${NC}"
else
    echo -e "${GREEN}✓ Key Vault already exists${NC}"
fi
echo ""

# Get AKS cluster managed identity
echo -e "${YELLOW}Getting AKS cluster managed identity...${NC}"
if ! az aks show --name "$AKS_CLUSTER_NAME" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
    echo -e "${RED}Error: AKS cluster '$AKS_CLUSTER_NAME' not found${NC}"
    echo "Make sure the cluster is created first or set AZURE_AKS_CLUSTER_NAME"
    exit 1
fi

# Get the kubelet identity (used by pods)
KUBELET_IDENTITY_CLIENT_ID=$(az aks show \
    --name "$AKS_CLUSTER_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query identityProfile.kubeletidentity.clientId -o tsv)

KUBELET_IDENTITY_OBJECT_ID=$(az aks show \
    --name "$AKS_CLUSTER_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query identityProfile.kubeletidentity.objectId -o tsv)

echo -e "${GREEN}✓ Kubelet Identity Client ID: $KUBELET_IDENTITY_CLIENT_ID${NC}"
echo -e "${GREEN}✓ Kubelet Identity Object ID: $KUBELET_IDENTITY_OBJECT_ID${NC}"
echo ""

# Grant Key Vault access to kubelet identity
echo -e "${YELLOW}Granting Key Vault access to AKS kubelet identity...${NC}"
az keyvault set-policy \
    --name "$KEY_VAULT_NAME" \
    --object-id "$KUBELET_IDENTITY_OBJECT_ID" \
    --secret-permissions get list \
    --key-permissions get list \
    --certificate-permissions get list

echo -e "${GREEN}✓ Access policy configured${NC}"
echo ""

# Install CSI Secrets Store Provider (if not already installed)
echo -e "${YELLOW}Checking for CSI Secrets Store Provider addon...${NC}"
CSI_ENABLED=$(az aks show --name "$AKS_CLUSTER_NAME" --resource-group "$RESOURCE_GROUP" \
    --query "addonProfiles.azureKeyvaultSecretsProvider.enabled" -o tsv)

if [ "$CSI_ENABLED" != "true" ]; then
    echo "Enabling Azure Key Vault CSI driver addon..."
    az aks enable-addons \
        --name "$AKS_CLUSTER_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --addons azure-keyvault-secrets-provider \
        --enable-secret-rotation
    
    echo -e "${GREEN}✓ CSI driver addon enabled${NC}"
else
    echo -e "${GREEN}✓ CSI driver addon already enabled${NC}"
fi
echo ""

# Create placeholder secrets (user will update these)
echo -e "${YELLOW}Creating placeholder secrets in Key Vault...${NC}"
echo -e "${BLUE}You will need to update these with actual values${NC}"

# Check and create OPENAI_API_KEY
if ! az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "OPENAI-API-KEY" > /dev/null 2>&1; then
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "OPENAI-API-KEY" \
        --value "your-openai-api-key-here"
    echo -e "${GREEN}✓ Created OPENAI-API-KEY secret (placeholder)${NC}"
else
    echo -e "${GREEN}✓ OPENAI-API-KEY secret already exists${NC}"
fi

# Check and create REDIS_PASSWORD
if ! az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "REDIS-PASSWORD" > /dev/null 2>&1; then
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "REDIS-PASSWORD" \
        --value "$(openssl rand -base64 32)"
    echo -e "${GREEN}✓ Created REDIS-PASSWORD secret (auto-generated)${NC}"
else
    echo -e "${GREEN}✓ REDIS-PASSWORD secret already exists${NC}"
fi

echo ""

# Output configuration details
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo -e "${BLUE}Configuration Details:${NC}"
echo "  Resource Group:        $RESOURCE_GROUP"
echo "  Key Vault Name:        $KEY_VAULT_NAME"
echo "  AKS Cluster:           $AKS_CLUSTER_NAME"
echo "  Location:              $LOCATION"
echo "  Tenant ID:             $TENANT_ID"
echo "  Subscription ID:       $SUBSCRIPTION_ID"
echo "  Kubelet Identity:      $KUBELET_IDENTITY_CLIENT_ID"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update the OpenAI API key:"
echo -e "   ${BLUE}az keyvault secret set --vault-name $KEY_VAULT_NAME --name OPENAI-API-KEY --value 'sk-proj-YOUR_KEY'${NC}"
echo ""
echo "2. Apply the SecretProviderClass:"
echo -e "   ${BLUE}kubectl apply -f k8s/apps/chat/overlays/azure/secret-provider-class.yaml${NC}"
echo ""
echo "3. Deploy the application with Key Vault integration"
echo ""
echo -e "${GREEN}Key Vault is ready for use!${NC}"

# Save configuration to file
cat > k8s/apps/chat/overlays/azure/.keyvault-config << EOF
# Azure Key Vault Configuration
# Generated: $(date)
AZURE_KEY_VAULT_NAME=$KEY_VAULT_NAME
AZURE_TENANT_ID=$TENANT_ID
AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
KUBELET_IDENTITY_CLIENT_ID=$KUBELET_IDENTITY_CLIENT_ID
RESOURCE_GROUP=$RESOURCE_GROUP
AKS_CLUSTER_NAME=$AKS_CLUSTER_NAME
EOF

echo -e "${GREEN}✓ Configuration saved to k8s/apps/chat/overlays/azure/.keyvault-config${NC}"
