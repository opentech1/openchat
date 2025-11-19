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

# Set up environment variables
echo ""
echo "Setting up environment variables..."

# Copy server .env.local (contains CONVEX_DEPLOYMENT config)
if [ -f "$CONDUCTOR_ROOT_PATH/apps/server/.env.local" ]; then
    echo "Copying apps/server/.env.local from main project..."
    mkdir -p apps/server
    cp "$CONDUCTOR_ROOT_PATH/apps/server/.env.local" apps/server/.env.local
    echo "✅ Copied apps/server/.env.local (includes Convex configuration)"
else
    echo "⚠️  No apps/server/.env.local found in main project"
    if [ -f "apps/server/.env.example" ]; then
        mkdir -p apps/server
        cp apps/server/.env.example apps/server/.env.local
        echo "⚠️  Created apps/server/.env.local from example - you'll need to configure Convex"
    fi
fi

# Copy web .env.local (contains all frontend env vars)
if [ -f "$CONDUCTOR_ROOT_PATH/apps/web/.env.local" ]; then
    echo "Copying apps/web/.env.local from main project..."
    mkdir -p apps/web
    cp "$CONDUCTOR_ROOT_PATH/apps/web/.env.local" apps/web/.env.local
    echo "✅ Copied apps/web/.env.local"
else
    echo "⚠️  No apps/web/.env.local found in main project"
    if [ -f "apps/web/.env.example" ]; then
        mkdir -p apps/web
        cp apps/web/.env.example apps/web/.env.local
        echo "⚠️  Created apps/web/.env.local from example - you may need to configure it"
    fi
fi

# Also handle root .env.local if it exists
if [ -f "$CONDUCTOR_ROOT_PATH/.env.local" ]; then
    echo "Copying root .env.local from main project..."
    cp "$CONDUCTOR_ROOT_PATH/.env.local" .env.local
    echo "✅ Copied root .env.local"
fi

# Set up Convex for local deployment
echo ""
echo "Configuring Convex to use local deployment..."

# Modify server package.json to use local Convex deployment
if [ -f "apps/server/package.json" ]; then
    # Use Node.js to safely modify the JSON file
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('apps/server/package.json', 'utf8'));
        pkg.scripts.dev = 'convex dev --local';
        fs.writeFileSync('apps/server/package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "✅ Configured Convex to use local deployment (isolated from main project)"
    echo "   Your worktree has its own Convex backend - schema changes won't conflict!"
else
    echo "⚠️  Could not find apps/server/package.json"
fi

echo ""
echo "======================================"
echo "✅ Setup complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Click the 'Run' button to start the dev servers"
echo "  2. Your worktree is configured to use the same Convex deployment"
echo ""
