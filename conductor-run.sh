#!/bin/bash

echo "Starting OpenChat for Conductor..."
echo ""

# Check if Convex is configured by looking for deployment URL
if [ -f ".env.local" ] && grep -q "CONVEX_URL" .env.local 2>/dev/null; then
  echo "Running Convex codegen..."
  cd apps/server && bunx convex dev --local --once && cd ../..
  echo ""
fi

echo "Starting dev servers..."
# Use bun run dev which calls turbo with proper setup
FORCE_COLOR=1 bun run dev
