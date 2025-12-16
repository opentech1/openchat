#!/bin/bash

# Production deployment confirmation script
echo ""
echo "=========================================="
echo "  PRODUCTION DEPLOYMENT"
echo "=========================================="
echo ""
read -p "Are you sure you want to deploy to PRODUCTION? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Deploying to PRODUCTION..."
  npx convex deploy --prod
else
  echo ""
  echo "Production deployment cancelled."
  exit 1
fi
