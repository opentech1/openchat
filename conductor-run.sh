#!/bin/bash
# Ensure this script runs in bash even if called from fish or other shells
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

echo "Starting OpenChat for Conductor..."
echo ""
echo "✅ Using LOCAL Convex deployment (no cloud, no prompts)"
echo "   Your changes won't affect the main project's database"
echo "   Each workspace has its own isolated Convex backend"
echo ""

# Temporarily bypass global Convex login to avoid prompts
# This allows anonymous local deployments to work without asking
# about linking to a cloud account
CONVEX_CONFIG="$HOME/.convex/config.json"
CONVEX_CONFIG_BACKUP=""

if [ -f "$CONVEX_CONFIG" ]; then
    CONVEX_CONFIG_BACKUP="$HOME/.convex/config.json.conductor-backup-$$"
    mv "$CONVEX_CONFIG" "$CONVEX_CONFIG_BACKUP"
    echo "   (Temporarily bypassing Convex login for local-only mode)"
fi

# Restore config on exit (normal or error)
cleanup() {
    if [ -n "$CONVEX_CONFIG_BACKUP" ] && [ -f "$CONVEX_CONFIG_BACKUP" ]; then
        mv "$CONVEX_CONFIG_BACKUP" "$CONVEX_CONFIG"
    fi
}
trap cleanup EXIT

echo ""
echo "Starting dev servers..."
# Use bun run dev which calls turbo with proper setup
FORCE_COLOR=1 bun run dev
