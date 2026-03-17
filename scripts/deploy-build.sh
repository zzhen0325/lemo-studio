#!/bin/bash
set -e
echo "Installing dependencies..."
pnpm install
echo "Building project..."
pnpm run build
echo "Build complete!"
