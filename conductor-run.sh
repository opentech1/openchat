#!/bin/bash
# Ensure this script runs in bash even if called from fish or other shells
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

echo "Starting OpenChat..."
echo ""

# Just run bun dev - uses cloud dev deployment from .env.local
FORCE_COLOR=1 bun run dev
