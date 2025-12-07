#!/bin/bash
set -e

# Azure GitHub Actions Service Principal Setup Script
# This script creates a service principal and federated credentials for GitHub Actions OIDC authentication

echo "==================================="
echo "Azure GitHub Actions Setup"
echo "==================================="

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not installed. Install from: https://aka.ms/azure-cli"
    exit 1
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI not installed. You'll need to manually add secrets to GitHub."
    echo "   Install from: https://cli.github.com/"
    MANUAL_SECRETS=true
else
    MANUAL_SECRETS=false
fi

# Get GitHub repository info
echo ""
echo "Enter your GitHub repository details:"
read -p "GitHub username/org (default: ianlintner): " GITHUB_USER
GITHUB_USER=${GITHUB_USER:-ianlintner}

read -p "Repository name (default: Example-React-AI-Chat-App): " REPO_NAME
REPO_NAME=${REPO_NAME:-Example-React-AI-Chat-App}

REPO_FULL="${GITHUB_USER}/${REPO_NAME}"

# Login to Azure
echo ""
echo "Logging into Azure..."
az login

# Get subscription info
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)

echo ""
echo "Using Azure subscription:"
echo "  Name: $SUBSCRIPTION_NAME"
echo "  ID: $SUBSCRIPTION_ID"
echo "  Tenant: $TENANT_ID"
echo ""
read -p "Is this correct? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Please run 'az account set --subscription <subscription-id>' to select the correct subscription"
    exit 1
fi

# App name
APP_NAME="github-actions-${REPO_NAME}-oidc"

echo ""
echo "Creating Azure AD Application: $APP_NAME"

# Create or update Azure AD application
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)

if [ -z "$APP_ID" ]; then
    echo "Creating new Azure AD application..."
    APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
    echo "✅ Created application with ID: $APP_ID"
else
    echo "✅ Found existing application with ID: $APP_ID"
fi

# Create service principal if it doesn't exist
SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)

if [ -z "$SP_ID" ]; then
    echo "Creating service principal..."
    az ad sp create --id "$APP_ID"
    SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)
    echo "✅ Created service principal"
else
    echo "✅ Service principal already exists"
fi

# Assign Contributor role at subscription level
echo "Assigning Contributor role to service principal..."
ROLE_ASSIGNMENT=$(az role assignment list --assignee "$APP_ID" --role Contributor --scope "/subscriptions/$SUBSCRIPTION_ID" --query "[0].id" -o tsv)

if [ -z "$ROLE_ASSIGNMENT" ]; then
    az role assignment create \
        --assignee "$APP_ID" \
        --role Contributor \
        --scope "/subscriptions/$SUBSCRIPTION_ID"
    echo "✅ Assigned Contributor role"
else
    echo "✅ Contributor role already assigned"
fi

# Configure federated credentials for main branch
echo "Configuring federated credentials for GitHub Actions..."
CRED_NAME="github-main-branch"

# Check if credential already exists
EXISTING_CRED=$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$CRED_NAME'].name" -o tsv)

if [ -z "$EXISTING_CRED" ]; then
    az ad app federated-credential create \
        --id "$APP_ID" \
        --parameters "{
            \"name\": \"$CRED_NAME\",
            \"issuer\": \"https://token.actions.githubusercontent.com\",
            \"subject\": \"repo:${REPO_FULL}:ref:refs/heads/main\",
            \"description\": \"GitHub Actions OIDC for main branch\",
            \"audiences\": [\"api://AzureADTokenExchange\"]
        }"
    echo "✅ Created federated credential for main branch"
else
    echo "✅ Federated credential for main branch already exists"
fi

# Configure federated credentials for develop branch
CRED_NAME_DEV="github-develop-branch"
EXISTING_CRED_DEV=$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$CRED_NAME_DEV'].name" -o tsv)

if [ -z "$EXISTING_CRED_DEV" ]; then
    az ad app federated-credential create \
        --id "$APP_ID" \
        --parameters "{
            \"name\": \"$CRED_NAME_DEV\",
            \"issuer\": \"https://token.actions.githubusercontent.com\",
            \"subject\": \"repo:${REPO_FULL}:ref:refs/heads/develop\",
            \"description\": \"GitHub Actions OIDC for develop branch\",
            \"audiences\": [\"api://AzureADTokenExchange\"]
        }"
    echo "✅ Created federated credential for develop branch"
else
    echo "✅ Federated credential for develop branch already exists"
fi

# Configure federated credentials for pull requests
CRED_NAME_PR="github-pull-requests"
EXISTING_CRED_PR=$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$CRED_NAME_PR'].name" -o tsv)

if [ -z "$EXISTING_CRED_PR" ]; then
    az ad app federated-credential create \
        --id "$APP_ID" \
        --parameters "{
            \"name\": \"$CRED_NAME_PR\",
            \"issuer\": \"https://token.actions.githubusercontent.com\",
            \"subject\": \"repo:${REPO_FULL}:pull_request\",
            \"description\": \"GitHub Actions OIDC for pull requests\",
            \"audiences\": [\"api://AzureADTokenExchange\"]
        }"
    echo "✅ Created federated credential for pull requests"
else
    echo "✅ Federated credential for pull requests already exists"
fi

echo ""
echo "==================================="
echo "✅ Azure Configuration Complete"
echo "==================================="
echo ""
echo "GitHub Secrets to Configure:"
echo "----------------------------"
echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
echo ""

# Set GitHub secrets if gh CLI is available
if [ "$MANUAL_SECRETS" = false ]; then
    echo "Setting GitHub secrets using gh CLI..."
    
    # Check if we're in the correct repo
    CURRENT_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
    
    if [ "$CURRENT_REPO" != "$REPO_FULL" ]; then
        echo "⚠️  Not in the correct repository. Current: $CURRENT_REPO, Expected: $REPO_FULL"
        echo "   Skipping automatic secret setup. Please add secrets manually."
        MANUAL_SECRETS=true
    else
        gh secret set AZURE_CLIENT_ID --body "$APP_ID"
        gh secret set AZURE_TENANT_ID --body "$TENANT_ID"
        gh secret set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID"
        echo "✅ GitHub secrets have been set!"
    fi
fi

if [ "$MANUAL_SECRETS" = true ]; then
    echo ""
    echo "Manual Steps Required:"
    echo "--------------------"
    echo "1. Go to: https://github.com/${REPO_FULL}/settings/secrets/actions"
    echo "2. Add the following secrets:"
    echo "   - AZURE_CLIENT_ID = $APP_ID"
    echo "   - AZURE_TENANT_ID = $TENANT_ID"
    echo "   - AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID"
fi

echo ""
echo "==================================="
echo "Next Steps:"
echo "==================================="
echo "1. Your CI workflow will now use OIDC authentication (more secure!)"
echo "2. Remove old secrets if they exist:"
echo "   - AZURE_CLIENT_SECRET (no longer needed with OIDC)"
echo "3. Test the workflow by pushing to main or develop branch"
echo ""
echo "Documentation:"
echo "  - https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure"
echo ""
