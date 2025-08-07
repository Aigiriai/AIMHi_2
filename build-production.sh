#!/bin/bash

# Production build script for AIM Hi System
# This script builds the client and ensures static files are in the correct location for deployment

echo "🏗️ Building AIM Hi System for production..."

# Step 1: Build the client with Vite
echo "📦 Building client application..."
npm run build

# Step 2: Ensure static files are in the expected server location
echo "📁 Copying static files to server/public..."
mkdir -p server/public
cp -r dist/public/* server/public/

# Step 3: Verify build artifacts
echo "✅ Build verification:"
echo "   - Static files: $(ls -la server/public/ | wc -l) files"
echo "   - Index.html: $(test -f server/public/index.html && echo 'Found' || echo 'Missing')"
echo "   - Assets: $(test -d server/public/assets && echo 'Found' || echo 'Missing')"

echo "🚀 Production build complete!"
echo "   To start in production mode: NODE_ENV=production node dist/index.js"