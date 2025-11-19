#!/bin/bash

echo "Starting OpenChat for Conductor..."
echo ""
echo "✅ Using LOCAL Convex deployment for this worktree"
echo "   Your changes won't affect the main project's database"
echo "   Each worktree has its own isolated Convex backend"
echo ""

echo "Starting dev servers..."
# Use bun run dev which calls turbo with proper setup
FORCE_COLOR=1 bun run dev
