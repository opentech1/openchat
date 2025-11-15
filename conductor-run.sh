#!/bin/bash

echo "Starting OpenChat for Conductor..."
echo ""
echo "⚠️  Note: Skipping Convex codegen for Conductor"
echo "   The app will run without backend database functionality"
echo "   To use Convex, run 'bun run convex:dev' separately"
echo ""

echo "Starting dev servers..."
# Use bun run dev which calls turbo with proper setup
FORCE_COLOR=1 bun run dev
