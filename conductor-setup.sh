#!/bin/bash
# Ensure this script runs in bash even if called from fish or other shells
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

set -e

echo "======================================"
echo "OpenChat Conductor Workspace Setup"
echo "======================================"
echo ""

# Check for required tools
echo "Checking for required tools..."

if ! command -v bun &> /dev/null; then
    echo "❌ Error: Bun is not installed or not in PATH"
    echo "   Install Bun from: https://bun.sh"
    exit 1
fi
echo "✅ Bun found: $(bun --version)"

# Install dependencies
echo ""
echo "Installing dependencies..."
# Set environment to skip optional native builds that may fail
export npm_config_build_from_source=false
export npm_config_optional=false
bun install || {
    echo "⚠️  Initial install had some errors, trying with --ignore-scripts..."
    bun install --ignore-scripts
}

# Set up local-only Convex deployment (no cloud, no prompts)
echo ""
echo "Setting up local-only Convex deployment..."

# Use a shared anonymous deployment name for all conductor workspaces
# This avoids the complexity of bootstrapping new deployments non-interactively
# All workspaces share the same local database, which is fine for development
DEPLOY_NAME="anonymous-openchat-dev"
DEPLOY_STATE_DIR="$HOME/.convex/anonymous-convex-backend-state/$DEPLOY_NAME"

# Check if the deployment exists, if not it will be created on first run
if [ -d "$DEPLOY_STATE_DIR" ] && [ -f "$DEPLOY_STATE_DIR/config.json" ]; then
    echo "✅ Using existing local deployment: $DEPLOY_NAME"
else
    echo "⚠️  No local deployment found. One will be created on first run."
    echo "   (This may require a one-time interactive setup)"
fi

# Set up environment files for local development
echo ""
echo "Configuring environment for local development..."

mkdir -p apps/server apps/web

# Create apps/server/.env.local for Convex
cat > apps/server/.env.local << EOF
# Local Convex deployment (auto-configured by Conductor)
CONVEX_DEPLOYMENT=anonymous:$DEPLOY_NAME
CONVEX_URL=http://127.0.0.1:3210
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
echo "✅ Created apps/server/.env.local"

# Create apps/web/.env.local for frontend
cat > apps/web/.env.local << EOF
# Local Convex URLs (auto-configured by Conductor)
VITE_CONVEX_URL=http://127.0.0.1:3210
VITE_CONVEX_SITE_URL=http://127.0.0.1:3211
EOF
echo "✅ Created apps/web/.env.local"

# Modify server package.json to use local Convex deployment with force-upgrade
if [ -f "apps/server/package.json" ]; then
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('apps/server/package.json', 'utf8'));
        pkg.scripts.dev = 'convex dev --local';
        fs.writeFileSync('apps/server/package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "✅ Configured Convex for local-only development"
else
    echo "⚠️  Could not find apps/server/package.json"
fi

# Store deployment name for the run script
echo "$DEPLOY_NAME" > .convex-deployment-name

echo ""
echo "======================================"
echo "✅ Setup complete!"
echo "======================================"
echo ""
echo "Your workspace uses a local Convex backend (no cloud needed)."
echo "Data is stored at: ~/.convex/anonymous-convex-backend-state/$DEPLOY_NAME"
echo ""
echo "Next steps:"
echo "  1. Click the 'Run' button to start the dev servers"
echo "  2. No login prompts - it just works!"
echo ""
