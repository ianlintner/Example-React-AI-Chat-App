# Security: Preventing Secret Leaks

This document outlines the security measures in place to prevent accidentally committing secrets to the repository.

## Protected Secrets

The following types of secrets are protected:

- ✅ **OpenAI API Keys** (`sk-proj-...`)
- ✅ **Azure Key Vault Configuration** (`.keyvault-config`)
- ✅ **Kubernetes Secrets** (`secrets.yaml`)
- ✅ **Environment Files** (`.env`)
- ✅ **Private Keys** (`*.pem`, `*.key`)
- ✅ **Passwords and Tokens**

## .gitignore Configuration

The `.gitignore` file is configured to exclude:

```gitignore
# Environment files
frontend/.env
backend/.env
k8s/apps/chat/overlays/azure/.env

# Azure Kubernetes secrets
k8s/apps/chat/overlays/azure/secrets.yaml
k8s/apps/chat/overlays/azure/.keyvault-config
k8s/apps/chat/overlays/azure/secrets-patch.yaml

# Azure Key Vault configuration
**/.keyvault-config

# Private keys
*.pem
*.key
```

## Automated Checks

### 1. Manual Check Script

Run before committing:

```bash
./scripts/check-secrets.sh
```

This script checks for:
- Real OpenAI API keys (excluding placeholders in documentation)
- Secret files tracked in git
- Hardcoded passwords
- Excessive Azure IDs

### 2. Pre-commit Hook (Optional)

Install the pre-commit hook to automatically check before every commit:

```bash
# Install the hook
ln -s ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit

# Test it
git commit -m "test"
```

The hook will:
- ✅ Run secrets check automatically
- ❌ Block commits if secrets are detected
- 📝 Show detailed error messages

### 3. CI/CD Checks (TODO)

Add to `.github/workflows/security.yml`:

```yaml
name: Security Check
on: [push, pull_request]
jobs:
  secrets-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check for secrets
        run: ./scripts/check-secrets.sh
```

## Best Practices

### ✅ DO:

1. **Use Azure Key Vault** for production secrets
2. **Keep `.gitignore` updated** with secret patterns
3. **Use placeholder values** in documentation (e.g., `YOUR_KEY_HERE`)
4. **Run checks before committing**: `./scripts/check-secrets.sh`
5. **Use example files**: `secrets.yaml.example` for templates

### ❌ DON'T:

1. **Never commit** `.env` files with real values
2. **Never commit** `secrets.yaml` with actual secrets
3. **Never bypass** pre-commit hooks without review
4. **Never store** API keys in code or config files
5. **Never commit** `.keyvault-config` files

## Safe Examples in Documentation

When writing documentation, use these patterns for examples:

```bash
# Good: Clearly a placeholder
export OPENAI_API_KEY="sk-proj-YOUR_KEY_HERE"
export OPENAI_API_KEY="your-openai-api-key-here"

# Bad: Looks like a real key
export OPENAI_API_KEY="sk-proj-abc123def456..."
```

The secrets check script allows:
- Markdown files (`.md`)
- Files in `docs/` directory
- Strings containing: `YOUR_KEY`, `YOUR_ACTUAL`, `example`, `template`, `placeholder`

## If You Accidentally Commit Secrets

### 1. Remove from Latest Commit

```bash
# Remove the file
git rm --cached k8s/apps/chat/overlays/azure/secrets.yaml

# Amend the commit
git commit --amend -m "Remove secrets"

# Force push (if already pushed)
git push --force
```

### 2. Remove from Git History

If the secret was committed in an earlier commit:

```bash
# Remove from all history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch k8s/apps/chat/overlays/azure/secrets.yaml' \
  --prune-empty --tag-name-filter cat -- --all

# Force push all branches
git push --force --all
```

### 3. Rotate the Secret

**IMPORTANT:** After removing from git, you must rotate the compromised secret:

```bash
# For OpenAI Key
# 1. Go to https://platform.openai.com/api-keys
# 2. Revoke the old key
# 3. Create a new key
# 4. Update in Azure Key Vault:
az keyvault secret set \
  --vault-name ai-chat-kv-1763873827 \
  --name OPENAI-API-KEY \
  --value "sk-proj-NEW_KEY"
```

## GitHub Security Features

### Enable Secret Scanning

GitHub can automatically detect secrets:

1. Go to repository **Settings** → **Security** → **Code security and analysis**
2. Enable **Secret scanning**
3. Enable **Push protection** to block pushes with secrets

### Review Security Alerts

Check **Security** → **Secret scanning alerts** regularly for any detected secrets.

## Verification

To verify your repository is secure:

```bash
# Run the security check
./scripts/check-secrets.sh

# Check git status
git status

# Verify .gitignore
git check-ignore -v k8s/apps/chat/overlays/azure/secrets.yaml
# Should show: .gitignore:... k8s/apps/chat/overlays/azure/secrets.yaml

# Check for tracked secret files
git ls-files | grep -E "(secrets\.yaml|keyvault-config|\.env$)" | grep -v example
# Should return nothing
```

## Security Checklist

Before every commit:

- [ ] Run `./scripts/check-secrets.sh`
- [ ] Verify no `.env` files with real values
- [ ] Confirm `secrets.yaml` is in `.gitignore`
- [ ] Check no real API keys in code
- [ ] Ensure `.keyvault-config` not tracked

Before every release:

- [ ] Audit all configuration files
- [ ] Verify Azure Key Vault is being used
- [ ] Confirm GitHub secret scanning is enabled
- [ ] Review security alerts
- [ ] Test with non-production secrets first

## Support

For security concerns or questions:

1. Review this document
2. Run `./scripts/check-secrets.sh` for diagnostics
3. Check [Azure Key Vault Setup Guide](./deployment/azure-keyvault-setup.md)
4. Contact security team if secrets were exposed

## References

- [Azure Key Vault Integration](./deployment/azure-keyvault-setup.md)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Git Filter-Branch](https://git-scm.com/docs/git-filter-branch)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) (alternative to filter-branch)
