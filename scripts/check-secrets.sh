#!/bin/bash

# Script to check for accidentally committed secrets
# Run this before committing to ensure no secrets leak into git

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 Checking for secrets in repository..."
echo ""

ISSUES_FOUND=0

# Check for real API keys in tracked files
echo "Checking for API keys..."
FOUND_KEYS=$(git ls-files | grep -v "package-lock.json\|\.lock\|\.md$\|docs/" | xargs grep -l "sk-proj-[a-zA-Z0-9]\{20,\}" 2>/dev/null | xargs grep -v "YOUR_KEY\|YOUR_ACTUAL\|example\|template\|placeholder\|PLACEHOLDER" 2>/dev/null || true)
if [ -n "$FOUND_KEYS" ]; then
    echo -e "${RED}❌ Found real OpenAI API keys in tracked files!${NC}"
    echo "$FOUND_KEYS"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✓ No API keys found in tracked files${NC}"
fi

# Check if secret files are tracked
echo ""
echo "Checking for secret files..."
SECRET_FILES=$(git ls-files | grep -E "(secrets\.yaml|\.keyvault-config|\.env$)" | grep -v "example\|template" || true)
if [ -n "$SECRET_FILES" ]; then
    echo -e "${RED}❌ Found secret files tracked in git:${NC}"
    echo "$SECRET_FILES"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✓ No secret files tracked in git${NC}"
fi

# Check for passwords or tokens
echo ""
echo "Checking for passwords and tokens..."
SUSPICIOUS=$(git ls-files | xargs grep -il "password.*=.*['\"][^y][^o][^u][^r]" 2>/dev/null | grep -v "example\|template\|test\|doc\|README" || true)
if [ -n "$SUSPICIOUS" ]; then
    echo -e "${YELLOW}⚠️  Found potential passwords in:${NC}"
    echo "$SUSPICIOUS"
    echo -e "${YELLOW}Please review these files to ensure no real passwords are committed${NC}"
fi

# Check Azure subscription IDs and tenant IDs
echo ""
echo "Checking for Azure IDs..."
AZURE_IDS=$(git ls-files | xargs grep -E "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" 2>/dev/null | grep -v "example\|template\|test\|doc" | wc -l)
if [ "$AZURE_IDS" -gt 5 ]; then
    echo -e "${YELLOW}⚠️  Found $AZURE_IDS files with Azure GUIDs${NC}"
    echo -e "${YELLOW}This may be normal, but verify no sensitive subscription/tenant IDs are exposed${NC}"
else
    echo -e "${GREEN}✓ No excessive Azure IDs found${NC}"
fi

# Check .gitignore exists and contains key patterns
echo ""
echo "Checking .gitignore configuration..."
if [ -f .gitignore ]; then
    if grep -q "secrets.yaml" .gitignore && grep -q "keyvault-config" .gitignore && grep -q ".env" .gitignore; then
        echo -e "${GREEN}✓ .gitignore properly configured${NC}"
    else
        echo -e "${RED}❌ .gitignore missing important patterns${NC}"
        ISSUES_FOUND=1
    fi
else
    echo -e "${RED}❌ .gitignore file not found!${NC}"
    ISSUES_FOUND=1
fi

# Summary
echo ""
echo "================================"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No security issues found!${NC}"
    exit 0
else
    echo -e "${RED}❌ Security issues found! Please fix before committing.${NC}"
    echo ""
    echo "To remove files from git history:"
    echo "  git rm --cached <filename>"
    echo ""
    echo "To remove secrets from git history:"
    echo "  git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch <filename>' --prune-empty --tag-name-filter cat -- --all"
    exit 1
fi
