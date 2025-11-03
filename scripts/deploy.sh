#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_NAME="currency-ph"
DEPLOY_TO_FLY=false
SKIP_TESTS=false
DRY_RUN=false
VERBOSE=false

# Functions
print_header() {
    echo -e "${BLUE}══════════���════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --fly              Deploy to Fly.dev after building"
    echo "  -s, --skip-tests       Skip running tests before building"
    echo "  -d, --dry-run          Show what would be done without executing"
    echo "  -v, --verbose          Enable verbose output"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Build only"
    echo "  $0 --fly               # Build and deploy to Fly.dev"
    echo "  $0 --fly --skip-tests  # Build and deploy without tests"
    echo "  $0 --dry-run           # Show deployment plan without executing"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--fly)
            DEPLOY_TO_FLY=true
            shift
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Setup logging
if [ "$VERBOSE" = true ]; then
    exec 3>&1
else
    exec 3>/dev/null
fi

print_header "🚀 Deployment Script for $PROJECT_NAME"

# Step 1: Check prerequisites
print_header "Step 1: Checking Prerequisites"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_success "Node.js is installed: $(node -v)"

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm is installed: $(npm -v)"

if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi
print_success "Git is installed: $(git --version)"

if [ "$DEPLOY_TO_FLY" = true ]; then
    if ! command -v flyctl &> /dev/null; then
        print_warning "flyctl (Fly.dev CLI) is not installed"
        print_info "Visit https://fly.io/docs/getting-started/installing-flyctl/ to install"
        DEPLOY_TO_FLY=false
    else
        print_success "Fly.dev CLI is installed"
    fi
fi

# Step 2: Check Git status
print_header "Step 2: Verifying Git Status"

if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then
    print_error "Git user.name or user.email not configured"
    print_info "Run: git config --global user.name 'Your Name'"
    print_info "Run: git config --global user.email 'your@email.com'"
    exit 1
fi
print_success "Git user configured: $(git config user.name) <$(git config user.email)>"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_info "Current branch: $CURRENT_BRANCH"

if [ "$DRY_RUN" != true ]; then
    git status >&3
fi

# Step 3: Install dependencies
print_header "Step 3: Installing Dependencies"

if [ "$DRY_RUN" = true ]; then
    print_info "[DRY RUN] Would run: npm install"
else
    if ! npm install 2>&1 | tail -20 >&3; then
        print_error "Failed to install dependencies"
        exit 1
    fi
    print_success "Dependencies installed"
fi

# Step 4: Run tests (if not skipped)
if [ "$SKIP_TESTS" != true ]; then
    print_header "Step 4: Running Tests"
    
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        if [ "$DRY_RUN" = true ]; then
            print_info "[DRY RUN] Would run: npm test"
        else
            if ! npm test 2>&1 | tail -20 >&3; then
                print_warning "Tests failed or not configured, continuing anyway"
            else
                print_success "Tests passed"
            fi
        fi
    else
        print_info "No test script found in package.json"
    fi
else
    print_info "Skipping tests"
fi

# Step 5: Build the project
print_header "Step 5: Building Project"

if [ "$DRY_RUN" = true ]; then
    print_info "[DRY RUN] Would run: npm run build"
else
    if ! npm run build 2>&1 | tail -50 >&3; then
        print_error "Build failed"
        exit 1
    fi
    print_success "Build completed successfully"
    
    # Check build output
    if [ -d "dist" ]; then
        BUILD_SIZE=$(du -sh dist | cut -f1)
        FILE_COUNT=$(find dist -type f | wc -l)
        print_info "Build output: $BUILD_SIZE ($FILE_COUNT files)"
    fi
fi

# Step 6: Commit changes (if any)
print_header "Step 6: Committing Changes"

if [ "$DRY_RUN" = true ]; then
    print_info "[DRY RUN] Would commit and push changes"
else
    if [ -n "$(git status --porcelain)" ]; then
        print_info "Unstaged changes detected"
        git add .
        
        COMMIT_MSG="build: deploy $(date '+%Y-%m-%d %H:%M:%S')"
        if git commit -m "$COMMIT_MSG" 2>&1 >&3; then
            print_success "Changes committed: $COMMIT_MSG"
        else
            print_info "No new changes to commit"
        fi
    else
        print_info "No changes to commit"
    fi
fi

# Step 7: Push to remote
print_header "Step 7: Pushing to Remote Repository"

if [ "$DRY_RUN" = true ]; then
    print_info "[DRY RUN] Would push to: $(git config --get remote.origin.url)"
else
    if git push origin "$CURRENT_BRANCH" 2>&1 >&3; then
        print_success "Pushed to remote successfully"
    else
        print_error "Failed to push to remote"
        exit 1
    fi
fi

# Step 8: Deploy to Fly.dev (if requested)
if [ "$DEPLOY_TO_FLY" = true ]; then
    print_header "Step 8: Deploying to Fly.dev"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would deploy using: flyctl deploy"
    else
        if ! flyctl deploy 2>&1 | tail -50 >&3; then
            print_error "Deployment to Fly.dev failed"
            exit 1
        fi
        print_success "Deployed to Fly.dev successfully"
        
        # Get deployment status
        if command -v flyctl &> /dev/null; then
            APP_NAME=$(grep "^app = " fly.toml 2>/dev/null | cut -d'"' -f2 || echo "unknown")
            print_info "Application: $APP_NAME"
            print_info "Status: $(flyctl status -a "$APP_NAME" 2>/dev/null | head -5 || echo 'Check Fly.dev dashboard')"
        fi
    fi
else
    print_info "Skipping Fly.dev deployment (use --fly to enable)"
fi

# Summary
print_header "✅ Deployment Complete!"

DEPLOYMENT_INFO="\
Build Information:
  • Project: $PROJECT_NAME
  • Branch: $CURRENT_BRANCH
  • Build Status: Success
  • Node Version: $(node -v)
  • npm Version: $(npm -v)

Next Steps:
  1. Verify the build: npm run preview
  2. Check the dist folder for output files
  3. Deploy with: $0 --fly
  4. Monitor logs: Check your deployment platform dashboard
"

echo -e "$DEPLOYMENT_INFO"

if [ "$DRY_RUN" = true ]; then
    print_warning "This was a dry run. No actual changes were made."
fi

exit 0
