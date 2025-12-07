#!/bin/bash

# Verification script for chat.hugecat.net deployment
# This script tests the deployment and verifies all components are working

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="chat.cat-herding.net"
NAMESPACE="default"

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Chat.hugecat.net Verification                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to test DNS
test_dns() {
    echo -e "${YELLOW}Testing DNS resolution...${NC}"
    
    DNS_RESULT=$(nslookup ${DOMAIN} 2>&1 | grep -A 1 "Name:" | grep "Address:" | awk '{print $2}' || echo "")
    
    if [ -z "$DNS_RESULT" ]; then
        echo -e "${RED}✗ DNS resolution failed${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ DNS resolves to: ${DNS_RESULT}${NC}"
}

# Function to test certificate
test_certificate() {
    echo -e "${YELLOW}Testing TLS certificate...${NC}"
    
    # Check certificate in default namespace
    CERT_READY=$(kubectl get certificate chat-hugecat-tls -n ${NAMESPACE} \
        -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")
    
    if [ "$CERT_READY" != "True" ]; then
        echo -e "${RED}✗ Certificate not ready in ${NAMESPACE} namespace${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Certificate ready in ${NAMESPACE} namespace${NC}"
    
    # Check certificate in istio-ingress namespace
    if ! kubectl get secret chat-hugecat-tls-cert -n aks-istio-ingress &> /dev/null; then
        echo -e "${YELLOW}! Certificate secret not found in aks-istio-ingress namespace${NC}"
        echo -e "${YELLOW}  Copying secret...${NC}"
        kubectl get secret chat-hugecat-tls-cert -n ${NAMESPACE} -o yaml | \
            sed 's/namespace: default/namespace: aks-istio-ingress/' | \
            kubectl apply -f - > /dev/null
        echo -e "${GREEN}✓ Certificate secret copied to aks-istio-ingress${NC}"
    else
        echo -e "${GREEN}✓ Certificate secret exists in aks-istio-ingress${NC}"
    fi
    
    # Verify certificate SAN
    SAN=$(kubectl get secret chat-hugecat-tls-cert -n ${NAMESPACE} \
        -o jsonpath='{.data.tls\.crt}' | base64 -d | \
        openssl x509 -noout -text | grep -A 1 "Subject Alternative Name" | \
        grep "DNS:" | sed 's/.*DNS://g' | tr -d ' ')
    
    if [ "$SAN" == "${DOMAIN}" ]; then
        echo -e "${GREEN}✓ Certificate SAN matches: ${SAN}${NC}"
    else
        echo -e "${RED}✗ Certificate SAN mismatch. Expected: ${DOMAIN}, Got: ${SAN}${NC}"
        return 1
    fi
}

# Function to test Gateway
test_gateway() {
    echo -e "${YELLOW}Testing Gateway configuration...${NC}"
    
    GATEWAY_HOSTS=$(kubectl get gateway chat-gateway -n ${NAMESPACE} \
        -o jsonpath='{.spec.servers[*].hosts}' 2>/dev/null || echo "")
    
    if [[ ! "$GATEWAY_HOSTS" =~ "${DOMAIN}" ]]; then
        echo -e "${RED}✗ Gateway does not include ${DOMAIN}${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Gateway includes ${DOMAIN}${NC}"
}

# Function to test VirtualService
test_virtualservice() {
    echo -e "${YELLOW}Testing VirtualService configuration...${NC}"
    
    VS_HOSTS=$(kubectl get virtualservice chat-vs-external -n ${NAMESPACE} \
        -o jsonpath='{.spec.hosts}' 2>/dev/null || echo "")
    
    if [[ ! "$VS_HOSTS" =~ "${DOMAIN}" ]]; then
        echo -e "${RED}✗ VirtualService does not include ${DOMAIN}${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ VirtualService includes ${DOMAIN}${NC}"
}

# Function to test HTTPS connectivity
test_https() {
    echo -e "${YELLOW}Testing HTTPS connectivity...${NC}"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health --max-time 10)
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo -e "${RED}✗ HTTPS health check failed (HTTP ${HTTP_CODE})${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ HTTPS health check passed (HTTP ${HTTP_CODE})${NC}"
}

# Function to test API endpoints
test_api() {
    echo -e "${YELLOW}Testing API endpoints...${NC}"
    
    # Test health endpoint
    HEALTH=$(curl -s https://${DOMAIN}/health --max-time 10 | jq -r '.status' 2>/dev/null || echo "")
    
    if [ "$HEALTH" != "OK" ]; then
        echo -e "${RED}✗ Health endpoint failed${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Health endpoint: ${HEALTH}${NC}"
}

# Function to test HTTP redirect
test_http_redirect() {
    echo -e "${YELLOW}Testing HTTP to HTTPS redirect...${NC}"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L http://${DOMAIN}/health --max-time 10)
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo -e "${YELLOW}! HTTP redirect may not be working (HTTP ${HTTP_CODE})${NC}"
    else
        echo -e "${GREEN}✓ HTTP redirect works (HTTP ${HTTP_CODE})${NC}"
    fi
}

# Function to show deployment status
show_status() {
    echo ""
    echo -e "${YELLOW}Deployment Status:${NC}"
    echo ""
    
    echo -e "${YELLOW}Pods:${NC}"
    kubectl get pods -n ${NAMESPACE} -l app=chat-backend
    echo ""
    
    echo -e "${YELLOW}Certificate:${NC}"
    kubectl get certificate chat-hugecat-tls -n ${NAMESPACE}
    echo ""
    
    echo -e "${YELLOW}Gateway:${NC}"
    kubectl get gateway chat-gateway -n ${NAMESPACE} -o jsonpath='{.spec.servers[*].hosts}' | tr ' ' '\n'
    echo ""
    echo ""
    
    echo -e "${YELLOW}Ingress IP:${NC}"
    kubectl get service -n aks-istio-ingress aks-istio-ingressgateway-external \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
    echo ""
}

# Run all tests
main() {
    local failed=0
    
    test_dns || failed=$((failed + 1))
    echo ""
    
    test_certificate || failed=$((failed + 1))
    echo ""
    
    test_gateway || failed=$((failed + 1))
    echo ""
    
    test_virtualservice || failed=$((failed + 1))
    echo ""
    
    test_https || failed=$((failed + 1))
    echo ""
    
    test_api || failed=$((failed + 1))
    echo ""
    
    test_http_redirect
    echo ""
    
    show_status
    echo ""
    
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ All tests passed!                              ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${GREEN}Your application is accessible at:${NC}"
        echo -e "${BLUE}https://${DOMAIN}${NC}"
        exit 0
    else
        echo -e "${RED}╔════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ✗ ${failed} test(s) failed                                ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════╝${NC}"
        exit 1
    fi
}

main
