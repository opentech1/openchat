#!/bin/bash
set -e

echo "Starting OpenChat for Conductor..."
echo ""

# Run Convex codegen once for backend
echo "Running Convex codegen..."
cd apps/server && bunx convex dev --local --once
cd ../..

echo ""
echo "Starting dev servers..."
# Run dev without Turborepo UI (plain output)
turbo -F web -F server dev --no-ui
