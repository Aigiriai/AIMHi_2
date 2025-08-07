#!/bin/bash

# Deployment Fix Script for AIM Hi System
# This script ensures static files are properly built and placed for production deployment

echo "🚀 Preparing AIM Hi System for deployment..."

# Step 1: Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/ server/public/

# Step 2: Build the application
echo "📦 Building application..."
npm run build

# Step 3: Ensure static files are in server/public (for server/vite.ts serveStatic function)
echo "📁 Setting up static files for deployment..."
mkdir -p server/public
cp -r dist/public/* server/public/

# Step 4: Verify the setup
echo "✅ Deployment verification:"
echo "   - Built server: $(test -f dist/index.js && echo 'Found' || echo 'Missing')"
echo "   - Static files: $(ls -la server/public/ 2>/dev/null | wc -l) files"
echo "   - Index.html: $(test -f server/public/index.html && echo 'Found' || echo 'Missing')"
echo "   - Assets dir: $(test -d server/public/assets && echo 'Found' || echo 'Missing')"

# Step 5: Test production server briefly
echo "🧪 Testing production server..."
NODE_ENV=production timeout 10s node dist/index.js &
sleep 5

# Test if server responds
if curl -f http://localhost:5000/ > /dev/null 2>&1; then
    echo "✅ Production server test: PASSED"
else
    echo "❌ Production server test: FAILED"
fi

# Cleanup test server
pkill -f "node dist/index.js" 2>/dev/null

echo "🎯 Deployment preparation complete!"
echo "   To deploy: NODE_ENV=production node dist/index.js"