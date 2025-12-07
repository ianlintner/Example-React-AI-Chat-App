# GitHub Actions Azure Authentication Setup

This guide explains how to set up Azure authentication for GitHub Actions CI/CD pipeline using OpenID Connect (OIDC).

## Why OIDC?

OIDC authentication is more secure than using service principal credentials because:

- **No long-lived secrets**: No client secrets to rotate or manage
- **Short-lived tokens**: GitHub requests tokens on-demand from Azure
- **Better audit trail**: Clear identity of requests in Azure logs
- **Follows security best practices**: Recommended by both Microsoft and GitHub

## Quick Setup (Automated)

We provide a script that automates the entire setup process:

```bash
# Run from repository root
./scripts/azure/setup-github-secrets.sh
```

The script will:

1. Create or update an Azure AD application
2. Create a service principal with Contributor role
3. Configure federated credentials for GitHub Actions
4. Optionally set GitHub secrets (if `gh` CLI is installed)

## Manual Setup

If you prefer to set up authentication manually, follow these steps:

### 1. Create Azure AD Application

```bash
# Login to Azure
az login

# Create the application
az ad app create --display-name "github-actions-Example-React-AI-Chat-App-oidc"

# Get the application ID
APP_ID=$(az ad app list --display-name "github-actions-Example-React-AI-Chat-App-oidc" --query "[0].appId" -o tsv)
echo "Application ID: $APP_ID"
```

### 2. Create Service Principal

```bash
# Create service principal
az ad sp create --id $APP_ID

# Get subscription details
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo "Subscription ID: $SUBSCRIPTION_ID"
echo "Tenant ID: $TENANT_ID"
```

### 3. Assign Contributor Role

```bash
# Assign Contributor role at subscription level
az role assignment create \
    --assignee $APP_ID \
    --role Contributor \
    --scope "/subscriptions/$SUBSCRIPTION_ID"
```

### 4. Configure Federated Credentials

Configure OIDC trust for different GitHub contexts:

**Main branch:**

```bash
az ad app federated-credential create \
    --id $APP_ID \
    --parameters '{
        "name": "github-main-branch",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:ianlintner/Example-React-AI-Chat-App:ref:refs/heads/main",
        "description": "GitHub Actions OIDC for main branch",
        "audiences": ["api://AzureADTokenExchange"]
    }'
```

**Develop branch:**

```bash
az ad app federated-credential create \
    --id $APP_ID \
    --parameters '{
        "name": "github-develop-branch",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:ianlintner/Example-React-AI-Chat-App:ref:refs/heads/develop",
        "description": "GitHub Actions OIDC for develop branch",
        "audiences": ["api://AzureADTokenExchange"]
    }'
```

**Pull requests:**

```bash
az ad app federated-credential create \
    --id $APP_ID \
    --parameters '{
        "name": "github-pull-requests",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:ianlintner/Example-React-AI-Chat-App:pull_request",
        "description": "GitHub Actions OIDC for pull requests",
        "audiences": ["api://AzureADTokenExchange"]
    }'
```

### 5. Set GitHub Secrets

Add these secrets to your GitHub repository at:
`https://github.com/ianlintner/Example-React-AI-Chat-App/settings/secrets/actions`

**Required secrets:**

- `AZURE_CLIENT_ID`: The application (client) ID from step 1
- `AZURE_TENANT_ID`: Your Azure tenant ID from step 2
- `AZURE_SUBSCRIPTION_ID`: Your Azure subscription ID from step 2

**Using GitHub CLI:**

```bash
gh secret set AZURE_CLIENT_ID --body "$APP_ID"
gh secret set AZURE_TENANT_ID --body "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID"
```

### 6. Remove Old Secrets (if applicable)

If you were previously using client secret authentication, you can now safely remove:

- `AZURE_CLIENT_SECRET` (no longer needed with OIDC)

## Workflow Configuration

The CI workflow (`.github/workflows/ci.yml`) uses the new OIDC authentication:

```yaml
- name: Azure Login (OIDC)
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

**Key requirements:**

1. The job must have `id-token: write` permission
2. Secrets must be configured in GitHub
3. Federated credentials must match your repository and branches

## Troubleshooting

### Authentication Fails

**Error**: `AADSTS70021: No matching federated identity record found`

**Solution**: Verify the federated credential subject matches exactly:

```bash
# List existing credentials
az ad app federated-credential list --id $APP_ID

# Check the subject format matches:
# repo:OWNER/REPO:ref:refs/heads/BRANCH
# or
# repo:OWNER/REPO:pull_request
```

### Permission Denied to ACR

**Error**: `The client does not have authorization to perform action`

**Solution**: Ensure the service principal has the correct role:

```bash
# Check current role assignments
az role assignment list --assignee $APP_ID --all

# Add ACR push permission if needed
ACR_ID=$(az acr show --name gabby --query id -o tsv)
az role assignment create \
    --assignee $APP_ID \
    --role AcrPush \
    --scope $ACR_ID
```

### Token Exchange Fails

**Error**: `Unable to get ACTIONS_ID_TOKEN_REQUEST_URL env variable`

**Solution**: Ensure your workflow has:

```yaml
permissions:
  id-token: write
  contents: read
```

## Security Best Practices

1. **Principle of Least Privilege**: Only grant necessary permissions
   - Use resource group scope instead of subscription when possible
   - Use specific roles like `AcrPush` instead of `Contributor` where appropriate

2. **Separate Environments**: Use different service principals for:
   - Development/staging
   - Production
   - Different teams or projects

3. **Regular Auditing**: Review federated credentials and role assignments:

```bash
# List federated credentials
az ad app federated-credential list --id $APP_ID

# List role assignments
az role assignment list --assignee $APP_ID --all
```

4. **Monitor Usage**: Check Azure Activity Logs for service principal actions:
   - Go to Azure Portal → Monitor → Activity Log
   - Filter by the service principal name

## Additional Resources

- [Azure OIDC Documentation](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure)
- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Azure Login Action](https://github.com/Azure/login)

## Related Documentation

- [Azure Quick Setup Guide](../azure-quick-setup.md)
- [Azure Deployment Guide](../azure-deployment.md)
- [Getting Started](../getting-started/quickstart.md)
