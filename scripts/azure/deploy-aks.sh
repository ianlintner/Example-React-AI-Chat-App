#!/bin/bash

# Azure AKS Deployment Script for AI Chat Application
# This script helps deploy the application to Azure Kubernetes Service (AKS)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-ai-chat-rg}"
CLUSTER_NAME="${AZURE_CLUSTER_NAME:-ai-chat-aks}"
LOCATION="${AZURE_LOCATION:-eastus}"
ACR_NAME="${AZURE_ACR_NAME:-aichatacr}"
NODE_COUNT="${AZURE_NODE_COUNT:-2}"
NODE_SIZE="${AZURE_NODE_SIZE:-Standard_D2s_v3}"

echo -e "${GREEN}=== Azure AKS Deployment Script ===${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed.${NC}"
    echo "Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed.${NC}"
    echo "Please install it from: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Check if user is logged in
echo -e "${YELLOW}Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Please log in.${NC}"
    az login
fi

# Display current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}Using Azure Subscription: ${SUBSCRIPTION}${NC}"
echo ""

# Function to create resource group
create_resource_group() {
    echo -e "${YELLOW}Creating resource group: ${RESOURCE_GROUP}${NC}"
    az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}"
    echo -e "${GREEN}✓ Resource group created${NC}"
    echo ""
}

# Function to create ACR
create_acr() {
    echo -e "${YELLOW}Creating Azure Container Registry: ${ACR_NAME}${NC}"
    az acr create --resource-group "${RESOURCE_GROUP}" \
        --name "${ACR_NAME}" \
        --sku Standard \
        --location "${LOCATION}"
    echo -e "${GREEN}✓ ACR created${NC}"
    echo ""
}

# Function to create AKS cluster
create_aks_cluster() {
    echo -e "${YELLOW}Creating AKS cluster: ${CLUSTER_NAME}${NC}"
    echo "This may take several minutes..."
    
    az aks create \
        --resource-group "${RESOURCE_GROUP}" \
        --name "${CLUSTER_NAME}" \
        --node-count "${NODE_COUNT}" \
        --node-vm-size "${NODE_SIZE}" \
        --enable-managed-identity \
        --attach-acr "${ACR_NAME}" \
        --enable-addons monitoring \
        --generate-ssh-keys \
        --network-plugin azure \
        --network-policy azure \
        --load-balancer-sku standard
    
    echo -e "${GREEN}✓ AKS cluster created${NC}"
    echo ""
}

# Function to get AKS credentials
get_aks_credentials() {
    echo -e "${YELLOW}Getting AKS credentials...${NC}"
    az aks get-credentials \
        --resource-group "${RESOURCE_GROUP}" \
        --name "${CLUSTER_NAME}" \
        --overwrite-existing
    echo -e "${GREEN}✓ Credentials configured${NC}"
    echo ""
}

# Function to install NGINX Ingress Controller
install_nginx_ingress() {
    echo -e "${YELLOW}Installing NGINX Ingress Controller...${NC}"
    
    # Add the Helm repository
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    # Install NGINX Ingress Controller
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --create-namespace \
        --namespace ingress-nginx \
        --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz
    
    echo -e "${GREEN}✓ NGINX Ingress Controller installed${NC}"
    echo ""
}

# Function to build and push Docker image
build_and_push_image() {
    echo -e "${YELLOW}Building and pushing Docker image...${NC}"
    
    # Login to ACR
    az acr login --name "${ACR_NAME}"
    
    # Build and push the image
    cd "$(dirname "$0")/../.."
    docker build -t "${ACR_NAME}.azurecr.io/chat-backend:latest" .
    docker push "${ACR_NAME}.azurecr.io/chat-backend:latest"
    
    echo -e "${GREEN}✓ Image built and pushed${NC}"
    echo ""
}

# Function to deploy application
deploy_application() {
    echo -e "${YELLOW}Deploying application to AKS...${NC}"
    
    cd "$(dirname "$0")/../.."
    
    # Update the image in deployment-patch.yaml
    sed -i "s/YOUR_ACR_NAME/${ACR_NAME}/g" k8s/apps/chat/overlays/azure/deployment-patch.yaml
    
    # Apply the Kubernetes manifests
    kubectl apply -k k8s/apps/chat/overlays/azure/
    
    echo -e "${GREEN}✓ Application deployed${NC}"
    echo ""
}

# Function to get ingress IP
get_ingress_ip() {
    echo -e "${YELLOW}Waiting for Ingress IP address...${NC}"
    echo "This may take a few minutes..."
    
    INGRESS_IP=""
    while [ -z "$INGRESS_IP" ]; do
        sleep 5
        INGRESS_IP=$(kubectl get ingress chat-backend-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    done
    
    echo -e "${GREEN}✓ Ingress IP: ${INGRESS_IP}${NC}"
    echo ""
    echo -e "${GREEN}=== Deployment Complete ===${NC}"
    echo ""
    echo "Your application is accessible at: http://${INGRESS_IP}"
    echo ""
    echo "To set up a custom domain, update the ingress.yaml file with your domain"
    echo "and configure your DNS to point to: ${INGRESS_IP}"
    echo ""
}

# Main deployment flow
main() {
    echo -e "${YELLOW}Starting Azure AKS deployment...${NC}"
    echo ""
    
    # Check if cluster already exists
    if az aks show --resource-group "${RESOURCE_GROUP}" --name "${CLUSTER_NAME}" &> /dev/null; then
        echo -e "${YELLOW}AKS cluster already exists. Skipping creation.${NC}"
        get_aks_credentials
    else
        create_resource_group
        create_acr
        create_aks_cluster
        get_aks_credentials
        install_nginx_ingress
    fi
    
    build_and_push_image
    deploy_application
    get_ingress_ip
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    create-cluster)
        create_resource_group
        create_acr
        create_aks_cluster
        get_aks_credentials
        install_nginx_ingress
        ;;
    build)
        build_and_push_image
        ;;
    update)
        deploy_application
        ;;
    cleanup)
        echo -e "${RED}Deleting resource group: ${RESOURCE_GROUP}${NC}"
        az group delete --name "${RESOURCE_GROUP}" --yes --no-wait
        echo -e "${GREEN}✓ Cleanup initiated${NC}"
        ;;
    *)
        echo "Usage: $0 {deploy|create-cluster|build|update|cleanup}"
        exit 1
        ;;
esac
