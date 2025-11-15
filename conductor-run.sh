#!/bin/bash
set -e

echo "Starting OpenChat for Conductor..."
echo ""

# Try to run Convex codegen once for backend (skip if not configured yet)
echo "Running Convex codegen..."
(cd apps/server && bunx convex dev --local --once) || echo "⚠️  Skipping Convex codegen (not configured yet)"

echo ""
echo "Starting dev servers..."
# Run dev without Turborepo UI (plain output)
turbo -F web -F server dev --no-ui
