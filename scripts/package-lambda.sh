#!/bin/bash
set -euo pipefail

# Install production dependencies
npm ci --omit=dev

ZIPFILE="lambda.zip"
rm -f "$ZIPFILE"

# Archive backend files and dependencies
zip -r "$ZIPFILE" \
  lambda.js server.js package.json package-lock.json \
  config routes services utils templates migrations brandingAssets \
  node_modules

echo "Created $ZIPFILE"
