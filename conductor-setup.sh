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

# Check if .env.local exists in root
if [ -f "$CONDUCTOR_ROOT_PATH/.env.local" ]; then
    echo "Found .env.local in root, creating symlink..."
    ln -sf "$CONDUCTOR_ROOT_PATH/.env.local" .env.local
    echo "✅ Linked .env.local from root"
elif [ -f "$CONDUCTOR_ROOT_PATH/.env" ]; then
    echo "Found .env in root, creating symlink..."
    ln -sf "$CONDUCTOR_ROOT_PATH/.env" .env.local
    echo "✅ Linked .env from root as .env.local"
else
    echo "⚠️  No .env file found in root"
    echo "   Creating .env.local from .env.example..."

    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo "✅ Created .env.local from .env.example"
        echo ""
        echo "⚠️  IMPORTANT: You need to configure your .env.local file!"
        echo "   Key variables to set:"
        echo "   - BETTER_AUTH_SECRET (generate with: openssl rand -base64 32)"
        echo "   - CONVEX_URL and NEXT_PUBLIC_CONVEX_URL"
        echo "   - OAuth credentials (optional)"
    else
        echo "❌ Error: No .env.example found"
        exit 1
    fi
fi

# Set up Convex
echo ""
echo "Setting up Convex..."
echo "⚠️  You'll need to run 'bun run convex:dev' to initialize Convex"
echo "   This will:"
echo "   - Connect to your Convex project (or create a new one)"
echo "   - Generate TypeScript types"
echo "   - Set CONVEX_URL and NEXT_PUBLIC_CONVEX_URL in your .env.local"
echo ""
echo "   After running 'convex:dev' once, your workspace will be ready!"

echo ""
echo "======================================"
echo "✅ Setup complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Review your .env.local file and add any missing secrets"
echo "  2. Run 'bun run convex:dev' to initialize Convex (first time only)"
echo "  3. Click the 'Run' button to start the dev servers"
echo ""
