#!/bin/bash

echo "🚀 Deploying MyBA with Token System to Production..."

# Build the frontend
echo "📦 Building frontend..."
npm run build

# Copy built files to the right location (they should already be in dist/)
echo "📁 Frontend built to dist/ directory"

# Start the API server in background
echo "🔧 Starting API server on port 3001..."
nohup node server.js > api.log 2>&1 &
API_PID=$!
echo $API_PID > api.pid

# Wait a moment for server to start
sleep 2

# Test if API is running
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ API server is running (PID: $API_PID)"
    echo "📊 Health check: http://152.42.141.162:3001/api/health"
else
    echo "❌ API server failed to start"
    exit 1
fi

echo ""
echo "🎯 Setup nginx proxy for /myba/api/ -> localhost:3001/api/"
echo "Add this to your nginx config:"
echo ""
echo "location /myba/api/ {"
echo "    proxy_pass http://localhost:3001/api/;"
echo "    proxy_set_header Host \$host;"
echo "    proxy_set_header X-Real-IP \$remote_addr;"
echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "}"
echo ""
echo "Then: sudo systemctl reload nginx"
echo ""
echo "🌟 Once nginx is configured:"
echo "👉 Frontend: http://152.42.141.162/myba/"
echo "👉 API: http://152.42.141.162/myba/api/health"
echo ""
echo "📄 API logs: tail -f api.log"
echo "🛑 Stop API: kill \$(cat api.pid)"