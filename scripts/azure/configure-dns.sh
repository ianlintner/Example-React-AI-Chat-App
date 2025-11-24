#!/bin/bash

# Azure DNS Configuration Script for chat.hugecat.net
# This script configures Azure DNS to point chat.hugecat.net to your AKS ingress

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DNS_ZONE_NAME="${AZURE_DNS_ZONE:-hugecat.net}"
DNS_RESOURCE_GROUP="${AZURE_DNS_RG}"
SUBDOMAIN="${SUBDOMAIN:-chat}"
RECORD_NAME="${SUBDOMAIN}"
TTL="${DNS_TTL:-300}"

echo -e "${GREEN}=== Azure DNS Configuration for ${SUBDOMAIN}.${DNS_ZONE_NAME} ===${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed.${NC}"
    echo "Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if user is logged in
echo -e "${YELLOW}Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Please log in.${NC}"
    az login
fi

# Function to find DNS zone resource group if not provided
find_dns_zone_rg() {
    echo -e "${YELLOW}Searching for DNS zone ${DNS_ZONE_NAME}...${NC}"
    
    # Search for the DNS zone across all resource groups
    ZONE_INFO=$(az network dns zone list --query "[?name=='${DNS_ZONE_NAME}']" -o json 2>/dev/null)
    
    if [ -z "$ZONE_INFO" ] || [ "$ZONE_INFO" == "[]" ]; then
        echo -e "${RED}Error: DNS zone ${DNS_ZONE_NAME} not found in your subscription.${NC}"
        echo "Please ensure the DNS zone exists in Azure."
        exit 1
    fi
    
    # Extract resource group from the zone info
    DNS_RESOURCE_GROUP=$(echo "$ZONE_INFO" | jq -r '.[0].resourceGroup')
    echo -e "${GREEN}✓ Found DNS zone in resource group: ${DNS_RESOURCE_GROUP}${NC}"
}

# Function to get AKS ingress IP
get_ingress_ip() {
    echo -e "${YELLOW}Getting Istio ingress gateway external IP...${NC}"
    
    # Try to get Istio ingress gateway IP
    INGRESS_IP=$(kubectl get service -n aks-istio-ingress aks-istio-ingressgateway-external \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [ -z "$INGRESS_IP" ]; then
        echo -e "${RED}Error: Could not get Istio ingress gateway IP.${NC}"
        echo "Please ensure your AKS cluster is running and Istio is installed."
        echo ""
        echo "You can manually specify the IP with:"
        echo "  export INGRESS_IP=<your-ip>"
        echo "  $0"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Ingress IP: ${INGRESS_IP}${NC}"
}

# Function to create or update DNS A record
create_dns_record() {
    echo -e "${YELLOW}Creating/updating DNS A record for ${RECORD_NAME}.${DNS_ZONE_NAME}...${NC}"
    
    # Detect and handle existing CNAME (Azure DNS restriction: cannot have A and CNAME with same name)
    EXISTING_CNAME=$(az network dns record-set cname show \
        --resource-group "${DNS_RESOURCE_GROUP}" \
        --zone-name "${DNS_ZONE_NAME}" \
        --name "${RECORD_NAME}" 2>/dev/null || echo "")
    if [ -n "${EXISTING_CNAME}" ]; then
        echo -e "${YELLOW}Found existing CNAME record for ${RECORD_NAME}.${DNS_ZONE_NAME}. Removing to create A record...${NC}"
        az network dns record-set cname delete \
            --resource-group "${DNS_RESOURCE_GROUP}" \
            --zone-name "${DNS_ZONE_NAME}" \
            --name "${RECORD_NAME}" \
            --yes
        echo -e "${GREEN}✓ Removed CNAME record${NC}"
    fi

    # Check if record already exists
    EXISTING_RECORD=$(az network dns record-set a show \
        --resource-group "${DNS_RESOURCE_GROUP}" \
        --zone-name "${DNS_ZONE_NAME}" \
        --name "${RECORD_NAME}" 2>/dev/null || echo "")
    
    if [ -n "$EXISTING_RECORD" ]; then
        echo -e "${YELLOW}Record exists. Updating...${NC}"
        az network dns record-set a update \
            --resource-group "${DNS_RESOURCE_GROUP}" \
            --zone-name "${DNS_ZONE_NAME}" \
            --name "${RECORD_NAME}" \
            --set ttl=${TTL}
        
        az network dns record-set a remove-record \
            --resource-group "${DNS_RESOURCE_GROUP}" \
            --zone-name "${DNS_ZONE_NAME}" \
            --name "${RECORD_NAME}" \
            --ipv4-address "$(echo "$EXISTING_RECORD" | jq -r '.aRecords[0].ipv4Address')" 2>/dev/null || true
    else
        echo -e "${YELLOW}Creating new record...${NC}"
        az network dns record-set a create \
            --resource-group "${DNS_RESOURCE_GROUP}" \
            --zone-name "${DNS_ZONE_NAME}" \
            --name "${RECORD_NAME}" \
            --ttl ${TTL}
    fi
    
    # Add the IP address
    az network dns record-set a add-record \
        --resource-group "${DNS_RESOURCE_GROUP}" \
        --zone-name "${DNS_ZONE_NAME}" \
        --record-set-name "${RECORD_NAME}" \
        --ipv4-address "${INGRESS_IP}"
    
    echo -e "${GREEN}✓ DNS record created/updated${NC}"
}

# Function to verify DNS record
verify_dns() {
    echo -e "${YELLOW}Verifying DNS record...${NC}"
    
    # Show the record
    az network dns record-set a show \
        --resource-group "${DNS_RESOURCE_GROUP}" \
        --zone-name "${DNS_ZONE_NAME}" \
        --name "${RECORD_NAME}" \
        --query "{Name:name, TTL:ttl, IPAddress:aRecords[0].ipv4Address}" \
        -o table
    
    echo ""
    echo -e "${GREEN}✓ DNS configuration complete!${NC}"
    echo ""
    echo "DNS record: ${RECORD_NAME}.${DNS_ZONE_NAME} -> ${INGRESS_IP}"
    echo ""
    echo "Note: DNS propagation may take a few minutes."
    echo "You can verify with: nslookup ${RECORD_NAME}.${DNS_ZONE_NAME}"
}

# Main execution
main() {
    # If DNS resource group not provided, find it
    if [ -z "$DNS_RESOURCE_GROUP" ]; then
        find_dns_zone_rg
    fi
    
    # If INGRESS_IP not provided, get it from cluster
    if [ -z "$INGRESS_IP" ]; then
        get_ingress_ip
    else
        echo -e "${GREEN}Using provided ingress IP: ${INGRESS_IP}${NC}"
    fi
    
    create_dns_record
    verify_dns
}

# Parse command line arguments
case "${1:-configure}" in
    configure)
        main
        ;;
    delete)
        if [ -z "$DNS_RESOURCE_GROUP" ]; then
            find_dns_zone_rg
        fi
        echo -e "${RED}Deleting DNS A record for ${RECORD_NAME}.${DNS_ZONE_NAME}...${NC}"
        az network dns record-set a delete \
            --resource-group "${DNS_RESOURCE_GROUP}" \
            --zone-name "${DNS_ZONE_NAME}" \
            --name "${RECORD_NAME}" \
            --yes
        echo -e "${GREEN}✓ DNS record deleted${NC}"
        ;;
    show)
        if [ -z "$DNS_RESOURCE_GROUP" ]; then
            find_dns_zone_rg
        fi
        az network dns record-set a show \
            --resource-group "${DNS_RESOURCE_GROUP}" \
            --zone-name "${DNS_ZONE_NAME}" \
            --name "${RECORD_NAME}"
        ;;
    *)
        echo "Usage: $0 {configure|delete|show}"
        echo ""
        echo "Environment variables:"
        echo "  AZURE_DNS_ZONE      - DNS zone name (default: hugecat.net)"
        echo "  AZURE_DNS_RG        - DNS zone resource group (auto-detected if not set)"
        echo "  SUBDOMAIN           - Subdomain to create (default: chat)"
        echo "  INGRESS_IP          - Manual ingress IP (auto-detected if not set)"
        echo "  DNS_TTL             - DNS TTL in seconds (default: 300)"
        exit 1
        ;;
esac
