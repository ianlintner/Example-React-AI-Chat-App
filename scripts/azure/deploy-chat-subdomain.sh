#!/bin/bash

# Comprehensive deployment script for chat.hugecat.net
# This script deploys cert-manager, configures DNS, and deploys the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-default}"
DNS_ZONE_NAME="${AZURE_DNS_ZONE:-hugecat.net}"
SUBDOMAIN="${SUBDOMAIN:-chat}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.14.0}"

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Chat.hugecat.net Deployment Script               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    local missing_tools=()
    
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi
    
    if ! command -v helm &> /dev/null; then
        missing_tools+=("helm")
    fi
    
    if ! command -v az &> /dev/null; then
        missing_tools+=("az (Azure CLI)")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        echo -e "${RED}Error: Missing required tools: ${missing_tools[*]}${NC}"
        exit 1
    fi
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Error: Cannot connect to Kubernetes cluster.${NC}"
        echo "Please configure kubectl to connect to your AKS cluster."
        exit 1
    fi
    
    echo -e "${GREEN}✓ All prerequisites met${NC}"
}

# Function to install cert-manager
install_cert_manager() {
    echo -e "${YELLOW}Installing cert-manager...${NC}"
    
    # Check if cert-manager is already installed
    if kubectl get namespace cert-manager &> /dev/null; then
        echo -e "${GREEN}✓ cert-manager already installed${NC}"
        return
    fi
    
    # Add Jetstack Helm repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install cert-manager
    helm install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --version ${CERT_MANAGER_VERSION} \
        --set installCRDs=true \
        --set prometheus.enabled=false
    
    # Wait for cert-manager to be ready
    echo -e "${YELLOW}Waiting for cert-manager to be ready...${NC}"
    kubectl wait --for=condition=ready pod \
        -l app.kubernetes.io/instance=cert-manager \
        -n cert-manager \
        --timeout=300s
    
    echo -e "${GREEN}✓ cert-manager installed${NC}"
}

# Function to configure Azure DNS for cert-manager
configure_azure_dns_for_certmanager() {
    echo -e "${YELLOW}Configuring Azure DNS for cert-manager...${NC}"
    
    # Get subscription ID
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    
    # Search for DNS zone
    ZONE_INFO=$(az network dns zone list --query "[?name=='${DNS_ZONE_NAME}']" -o json 2>/dev/null)
    
    if [ -z "$ZONE_INFO" ] || [ "$ZONE_INFO" == "[]" ]; then
        echo -e "${RED}Error: DNS zone ${DNS_ZONE_NAME} not found.${NC}"
        exit 1
    fi
    
    DNS_RESOURCE_GROUP=$(echo "$ZONE_INFO" | jq -r '.[0].resourceGroup')
    
    echo -e "${GREEN}✓ Found DNS zone: ${DNS_ZONE_NAME} in RG: ${DNS_RESOURCE_GROUP}${NC}"
    
    # Get AKS cluster info
    AKS_NAME=$(kubectl config current-context | cut -d'-' -f1)
    AKS_RG=$(az aks list --query "[?name=='${AKS_NAME}'].resourceGroup" -o tsv | head -n1)
    
    # Get managed identity client ID
    MANAGED_IDENTITY=$(az aks show -g "${AKS_RG}" -n "${AKS_NAME}" \
        --query "identityProfile.kubeletidentity.clientId" -o tsv)
    
    echo -e "${YELLOW}Granting DNS Zone Contributor role to AKS managed identity...${NC}"
    
    # Grant DNS Zone Contributor role
    az role assignment create \
        --assignee "${MANAGED_IDENTITY}" \
        --role "DNS Zone Contributor" \
        --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${DNS_RESOURCE_GROUP}/providers/Microsoft.Network/dnszones/${DNS_ZONE_NAME}" \
        --output none 2>/dev/null || echo "Role assignment may already exist"
    
    echo -e "${GREEN}✓ Azure DNS configured${NC}"
    
    # Update ClusterIssuer with actual values
    echo -e "${YELLOW}Updating ClusterIssuer configuration...${NC}"
    
    sed -i.bak \
        -e "s/YOUR_SUBSCRIPTION_ID/${SUBSCRIPTION_ID}/g" \
        -e "s/YOUR_RESOURCE_GROUP/${DNS_RESOURCE_GROUP}/g" \
        -e "s/YOUR_MANAGED_IDENTITY_CLIENT_ID/${MANAGED_IDENTITY}/g" \
        k8s/apps/chat/overlays/azure/clusterissuer.yaml
    
    rm -f k8s/apps/chat/overlays/azure/clusterissuer.yaml.bak
    
    echo -e "${GREEN}✓ ClusterIssuer configuration updated${NC}"
}

# Function to deploy ClusterIssuer
deploy_clusterissuer() {
    echo -e "${YELLOW}Deploying ClusterIssuer...${NC}"
    
    kubectl apply -f k8s/apps/chat/overlays/azure/clusterissuer.yaml
    
    # Wait a bit for the issuer to initialize
    sleep 5
    
    echo -e "${GREEN}✓ ClusterIssuer deployed${NC}"
}

# Function to deploy application
deploy_application() {
    echo -e "${YELLOW}Deploying application with Kustomize...${NC}"
    
    kubectl apply -k k8s/apps/chat/overlays/azure/
    
    echo -e "${GREEN}✓ Application deployed${NC}"
}

# Function to wait for certificate
wait_for_certificate() {
    echo -e "${YELLOW}Waiting for TLS certificate to be issued...${NC}"
    echo "This may take a few minutes as Let's Encrypt validates your domain..."
    
    local timeout=600
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        CERT_STATUS=$(kubectl get certificate chat-hugecat-tls -n ${NAMESPACE} \
            -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")
        
        if [ "$CERT_STATUS" == "True" ]; then
            echo -e "${GREEN}✓ Certificate issued successfully!${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 10
        elapsed=$((elapsed + 10))
    done
    
    echo ""
    echo -e "${RED}Warning: Certificate not ready after ${timeout}s${NC}"
    echo "Check certificate status with: kubectl describe certificate chat-hugecat-tls -n ${NAMESPACE}"
}

# Function to configure DNS
configure_dns() {
    echo -e "${YELLOW}Configuring DNS A record...${NC}"
    
    # Run the DNS configuration script
    ./scripts/azure/configure-dns.sh configure
    
    echo -e "${GREEN}✓ DNS configured${NC}"
}

# Function to show deployment status
show_status() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Deployment Status                                 ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${YELLOW}Pods:${NC}"
    kubectl get pods -n ${NAMESPACE} -l app=chat-backend
    echo ""
    
    echo -e "${YELLOW}Services:${NC}"
    kubectl get svc -n ${NAMESPACE} -l app=chat-backend
    echo ""
    
    echo -e "${YELLOW}Certificate:${NC}"
    kubectl get certificate -n ${NAMESPACE}
    echo ""
    
    echo -e "${YELLOW}Gateway:${NC}"
    kubectl get gateway -n ${NAMESPACE}
    echo ""
    
    echo -e "${YELLOW}VirtualService:${NC}"
    kubectl get virtualservice -n ${NAMESPACE}
    echo ""
    
    # Get ingress IP
    INGRESS_IP=$(kubectl get service -n aks-istio-ingress aks-istio-ingressgateway-external \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
    
    echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Deployment Complete!                              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Ingress IP:${NC} ${INGRESS_IP}"
    echo -e "${YELLOW}Domain:${NC} https://${SUBDOMAIN}.${DNS_ZONE_NAME}"
    echo ""
    echo "Wait a few minutes for DNS propagation, then access your app at:"
    echo -e "${GREEN}https://${SUBDOMAIN}.${DNS_ZONE_NAME}${NC}"
    echo ""
    echo "To verify DNS: nslookup ${SUBDOMAIN}.${DNS_ZONE_NAME}"
    echo "To check certificate: kubectl describe certificate chat-hugecat-tls -n ${NAMESPACE}"
}

# Main deployment flow
main() {
    check_prerequisites
    install_cert_manager
    configure_azure_dns_for_certmanager
    deploy_clusterissuer
    deploy_application
    configure_dns
    wait_for_certificate
    show_status
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    install-certmanager)
        check_prerequisites
        install_cert_manager
        ;;
    configure-dns-only)
        configure_dns
        ;;
    status)
        show_status
        ;;
    cleanup)
        echo -e "${RED}Cleaning up deployment...${NC}"
        kubectl delete -k k8s/apps/chat/overlays/azure/ || true
        kubectl delete clusterissuer letsencrypt-prod || true
        ./scripts/azure/configure-dns.sh delete
        echo -e "${GREEN}✓ Cleanup complete${NC}"
        ;;
    *)
        echo "Usage: $0 {deploy|install-certmanager|configure-dns-only|status|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy                - Full deployment (default)"
        echo "  install-certmanager   - Install cert-manager only"
        echo "  configure-dns-only    - Configure DNS only"
        echo "  status                - Show deployment status"
        echo "  cleanup               - Remove all resources"
        echo ""
        echo "Environment variables:"
        echo "  NAMESPACE             - Kubernetes namespace (default: default)"
        echo "  AZURE_DNS_ZONE        - DNS zone name (default: hugecat.net)"
        echo "  SUBDOMAIN             - Subdomain to create (default: chat)"
        echo "  CERT_MANAGER_VERSION  - cert-manager version (default: v1.14.0)"
        exit 1
        ;;
esac
