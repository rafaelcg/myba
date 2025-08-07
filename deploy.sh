#!/bin/bash
cd /var/www/html/myba

echo "🚀 Building MyBA for production..."

# Build the application
npm run build

# Copy built files to serve via nginx  
if [ -d "dist/public" ]; then
    echo "📦 Copying built files..."
    cp -r dist/public/* ./
    rm -rf dist # Clean up
    echo "✅ MyBA deployed successfully!"
    echo "🌐 Visit http://152.42.141.162/myba/"
else
    echo "❌ Build failed - no output directory found"
    exit 1
fi