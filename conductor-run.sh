#!/bin/bash
# Ensure this script runs in bash even if called from fish or other shells
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

echo "Starting OpenChat for Conductor..."
echo ""
echo "✅ Using LOCAL Convex deployment for this worktree"
echo "   Your changes won't affect the main project's database"
echo "   Each worktree has its own isolated Convex backend"
echo ""

echo "Starting dev servers..."
# Use bun run dev which calls turbo with proper setup
FORCE_COLOR=1 bun run dev
