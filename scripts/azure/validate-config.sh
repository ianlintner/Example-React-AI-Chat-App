#!/bin/bash

# Validation script for Azure Kubernetes configurations
# This script validates the Kubernetes manifests without deploying them

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Validating Azure Kubernetes Configurations ===${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed.${NC}"
    echo "Please install it from: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Check if kustomize is available (comes with kubectl 1.14+)
if ! kubectl kustomize --help &> /dev/null; then
    echo -e "${RED}Error: kubectl kustomize is not available.${NC}"
    echo "Please upgrade kubectl to version 1.14 or higher"
    exit 1
fi

cd "$(dirname "$0")/../.."

echo -e "${YELLOW}Validating Kustomize build...${NC}"

# Try to build the kustomization
if kubectl kustomize k8s/apps/chat/overlays/azure/ > /tmp/azure-manifests.yaml; then
    echo -e "${GREEN}✓ Kustomize build successful${NC}"
    echo ""
else
    echo -e "${RED}✗ Kustomize build failed${NC}"
    exit 1
fi

echo -e "${YELLOW}Validating Kubernetes manifests...${NC}"

# Validate the generated manifests (dry-run)
if kubectl apply --dry-run=client -f /tmp/azure-manifests.yaml > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Manifest validation successful${NC}"
    echo ""
else
    echo -e "${RED}✗ Manifest validation failed${NC}"
    echo "Run: kubectl apply --dry-run=client -f /tmp/azure-manifests.yaml"
    echo "to see detailed errors"
    exit 1
fi

echo -e "${YELLOW}Checking for required resources...${NC}"

# Check for required resources in the manifest
REQUIRED_RESOURCES=(
    "Deployment"
    "Service"
    "ConfigMap"
    "Ingress"
)

for resource in "${REQUIRED_RESOURCES[@]}"; do
    if grep -q "kind: $resource" /tmp/azure-manifests.yaml; then
        echo -e "${GREEN}✓ Found $resource${NC}"
    else
        echo -e "${RED}✗ Missing $resource${NC}"
    fi
done

echo ""
echo -e "${YELLOW}Checking for Azure-specific configurations...${NC}"

# Check for NGINX Ingress annotations
if grep -q "kubernetes.io/ingress.class: nginx" /tmp/azure-manifests.yaml; then
    echo -e "${GREEN}✓ NGINX Ingress class configured${NC}"
else
    echo -e "${YELLOW}⚠ NGINX Ingress class not found${NC}"
fi

# Check for container image configuration
if grep -q "azurecr.io" /tmp/azure-manifests.yaml; then
    echo -e "${GREEN}✓ Azure Container Registry image configured${NC}"
else
    echo -e "${YELLOW}⚠ ACR image reference not found (this is expected if not yet configured)${NC}"
fi

echo ""
echo -e "${GREEN}=== Validation Complete ===${NC}"
echo ""
echo "Generated manifest saved to: /tmp/azure-manifests.yaml"
echo ""
echo "Next steps:"
echo "1. Review the manifest: cat /tmp/azure-manifests.yaml"
echo "2. Update ACR name in deployment-patch.yaml"
echo "3. Create secrets.yaml from secrets.yaml.example"
echo "4. Deploy using: ./scripts/azure/deploy-aks.sh deploy"
echo ""

# Cleanup
rm -f /tmp/azure-manifests.yaml
