#!/bin/bash

# Code Quality Tools Setup Script
echo "🚀 Setting up comprehensive code quality tools..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Install root dependencies with legacy peer deps to handle version conflicts
echo "📦 Installing root dependencies..."
npm install --legacy-peer-deps || {
    print_warning "Standard install failed, trying with --force..."
    npm install --force || {
        print_error "Failed to install root dependencies even with --force"
        print_error "Please manually run: npm install --legacy-peer-deps"
        exit 1
    }
}

print_status "Root dependencies installed"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
(cd backend && npm install --legacy-peer-deps) || {
    print_warning "Backend dependencies install failed, trying standard install..."
    (cd backend && npm install) || {
        print_error "Failed to install backend dependencies"
        exit 1
    }
}

print_status "Backend dependencies installed"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
(cd frontend && npm install --legacy-peer-deps) || {
    print_warning "Frontend dependencies install failed, trying with --force..."
    (cd frontend && npm install --force) || {
        print_error "Failed to install frontend dependencies"
        print_error "Please manually run: cd frontend && npm install --legacy-peer-deps"
        exit 1
    }
}

print_status "Frontend dependencies installed"

# Initialize Husky
echo "🪝 Setting up Git hooks..."
npx husky install || {
    print_warning "Husky install failed - you may need to run 'npx husky install' manually"
}

# Make pre-commit hook executable
chmod +x .husky/pre-commit 2>/dev/null || print_warning "Could not make pre-commit hook executable"

print_status "Git hooks configured"

# Run initial quality checks
echo "🔍 Running initial quality checks..."

# Check formatting
echo "Checking code formatting..."
npm run format:check || {
    print_warning "Code formatting issues found. Run 'npm run format' to fix."
}

# Run linting
echo "Running linting checks..."
npm run lint || {
    print_warning "Linting issues found. Run 'npm run lint:fix' to fix auto-fixable issues."
}

# Run type checking
echo "Checking TypeScript types..."
npm run type-check || {
    print_warning "TypeScript type errors found. Please fix these issues."
}

# Run tests
echo "Running test suite..."
npm run coverage || {
    print_warning "Some tests failed or coverage is below threshold."
}

echo ""
print_status "Code quality tools setup complete!"
echo ""
echo "📋 Quick Reference Commands:"
echo "  npm run format          - Format all code"
echo "  npm run lint:fix        - Fix linting issues"
echo "  npm run type-check      - Check TypeScript types"
echo "  npm run coverage        - Run tests with coverage"
echo "  npm run test:backend    - Run backend tests"
echo "  npm run test:frontend   - Run frontend tests"
echo ""
echo "📚 See docs/code-quality-setup.md for comprehensive documentation"
echo ""
print_status "Ready for development with enhanced code quality! 🎉"
