# CI/CD Setup Guide

This document explains the GitHub Actions CI/CD workflows configured for this project.

## Workflows Overview

### 1. Main CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Push to any branch (`**`)
- Pull requests targeting any branch
- Manual triggering (`workflow_dispatch`)

**Jobs:**
- `backend-test`: Runs backend tests, linting, and build
- `frontend-test`: Runs frontend tests, linting, and build  
- `integration-test`: Runs integration tests after backend and frontend tests pass

### 2. PR Checks Workflow (`.github/workflows/pr-checks.yml`)

**Triggers:**
- Pull request events (opened, synchronized, reopened)
- Pull request review submissions

**Features:**
- Matrix strategy for parallel backend/frontend testing
- Automated PR comments with test results using GitHub CLI
- Build artifact uploads
- Security checks (npm audit, secrets scanning)
- Status updates with emojis and actionable next steps

### 3. Branch Protection Helper (`.github/workflows/branch-protection.yml`)

**Purpose:** Helps configure branch protection rules via GitHub CLI

**Usage:**
1. Go to Actions → Branch Protection Helper → Run workflow
2. Specify branch name (default: main)
3. Choose to enable/disable protection

## Key Features

### ✅ Comprehensive Testing
- Backend: Jest tests + build verification
- Frontend: React Native tests + ESLint + build verification
- Integration: Full build pipeline validation

### 🔧 GitHub CLI Integration
- Automated PR comments with test results
- Branch protection management
- Status checks and reviews integration

### 🛡️ Security Features
- NPM audit for vulnerabilities
- Basic secrets scanning
- Configurable security thresholds

### 🚀 Developer Experience
- Clear status indicators in PRs
- Build artifacts for debugging
- Manual workflow triggers
- Detailed error reporting

## Setting Up Branch Protection

To enable branch protection with required status checks:

```bash
# Using the workflow (recommended)
# Go to Actions → Branch Protection Helper → Run workflow

# Or using GitHub CLI directly
gh api --method PUT "repos/OWNER/REPO/branches/main/protection" \
  --field required_status_checks='{"strict":true,"contexts":["backend-test","frontend-test","integration-test"]}' \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field enforce_admins=true
```

## Required Status Checks

When branch protection is enabled, the following checks must pass:
- `backend-test` - Backend tests and build
- `frontend-test` - Frontend tests and build
- `integration-test` - Integration testing
- `PR Checks / test-and-build (backend)` - PR-specific backend checks
- `PR Checks / test-and-build (frontend)` - PR-specific frontend checks

## Local Testing

Before pushing, run tests locally:

```bash
# Backend
cd backend
npm test
npm run build

# Frontend  
cd frontend
npm run test:ci
npm run lint
npm run build

# Full CI simulation
npm run test:ci  # If available in root package.json
```

## PR Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes & Test Locally**
   ```bash
   # Run tests as shown above
   ```

3. **Push & Create PR**
   ```bash
   git push origin feature/your-feature-name
   gh pr create --title "Your PR Title" --body "Description"
   ```

4. **Monitor CI Results**
   - Check Actions tab for detailed results
   - Review automated PR comment with status
   - Address any failing tests

5. **Request Review**
   ```bash
   gh pr review --approve  # If you have permissions
   # Or request specific reviewers
   gh pr edit --add-reviewer @username
   ```

## Troubleshooting

### Common Issues

**Tests failing on CI but passing locally:**
- Ensure all dependencies are committed
- Check for environment-specific code
- Verify CI environment matches local Node version

**PR checks not running:**
- Ensure workflows are in `.github/workflows/`
- Check branch protection settings
- Verify GitHub Actions are enabled for the repo

**Branch protection setup fails:**
- Repository admin permissions required
- Some settings may need to be configured via GitHub UI

### Getting Help

```bash
# Check workflow status
gh run list

# View specific workflow run
gh run view <run-id>

# Re-run failed workflows  
gh run rerun <run-id>
```

## Advanced Configuration

### Custom Status Checks
Edit `.github/workflows/ci.yml` to add custom validation steps:

```yaml
- name: Custom Validation
  run: |
    # Your custom validation logic
    npm run custom-checks
```

### Notification Integration
Add Slack/Discord notifications by adding steps to workflows:

```yaml
- name: Notify on Failure
  if: failure()
  run: |
    # Send notification logic
```

### Performance Monitoring
Add performance benchmarks:

```yaml
- name: Performance Tests
  run: |
    npm run perf-tests
    # Upload results as artifacts
```

## Security Considerations

- GitHub tokens are automatically provided
- Secrets should be stored in repository settings
- Branch protection prevents direct pushes to main
- Required reviews ensure code quality
- Security audits run on every PR

## Maintenance

- Review and update Node.js versions regularly
- Monitor workflow performance and optimize as needed
- Update status check names if workflow jobs change
- Regularly review security audit results
