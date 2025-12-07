# Quick Fix: Azure Login for GitHub Actions

## Problem
GitHub Actions CI failing at "Azure Login" step with authentication errors.

## Solution
Run the setup script to create new Azure credentials using OIDC (more secure):

```bash
./scripts/azure/setup-github-secrets.sh
```

## What This Does

1. ✅ Creates Azure AD application with service principal
2. ✅ Configures OIDC federated credentials (no secrets needed!)
3. ✅ Assigns Contributor role for ACR access
4. ✅ Sets GitHub repository secrets automatically

## Manual Alternative

If you prefer to set secrets manually:

1. **Run the script** to create Azure resources:
   ```bash
   ./scripts/azure/setup-github-secrets.sh
   ```

2. **Copy the output values** (shown at the end)

3. **Add to GitHub**: Go to Repository Settings → Secrets and variables → Actions
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`

## What Changed

The CI workflow now uses OIDC authentication instead of client secrets:

**Before** (insecure - using long-lived secret):
```yaml
- name: Azure Login
  uses: azure/login@v2
  with:
    creds: '{"clientId":"...","clientSecret":"...",...}'
```

**After** (secure - using OIDC):
```yaml
- name: Azure Login (OIDC)
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

## Verification

After setup, test the workflow:

```bash
# Trigger CI by pushing to main
git push origin main

# Or create a pull request to test
```

## Troubleshooting

**Script fails with "az: command not found"**
```bash
# Install Azure CLI
brew install azure-cli  # macOS
# or visit: https://aka.ms/azure-cli
```

**"No matching federated identity record found"**
- Verify you pushed to `main` or `develop` branch (configured for OIDC)
- Check repository name matches in federated credentials
- Re-run the setup script

**"Permission denied" to ACR**
- Service principal needs time to propagate (wait 1-2 minutes)
- Verify ACR name matches in workflow (`gabby`)
- Check role assignment: `az role assignment list --assignee $AZURE_CLIENT_ID`

## Full Documentation

For complete details, see:
- [GitHub Actions Azure Setup Guide](./deployment/github-actions-azure-setup.md)
- [Azure Quick Setup](./azure-quick-setup.md)
