#!/bin/bash
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
bun install

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

# Set up Convex
echo ""
if [ -f "apps/server/.env.local" ] && grep -q "CONVEX_DEPLOYMENT" apps/server/.env.local; then
    echo "✅ Convex configuration found in apps/server/.env.local"
    echo "   Your worktree will use the same Convex deployment as the main project"
else
    echo "⚠️  No Convex configuration found"
    echo "   Convex will prompt you to select a project when you run 'convex dev'"
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
