#!/bin/bash

if [ -f api.pid ]; then
    PID=$(cat api.pid)
    echo "🛑 Stopping API server (PID: $PID)..."
    kill $PID
    rm api.pid
    echo "✅ API server stopped"
else
    echo "❌ No API server PID file found"
    echo "Checking for any node processes..."
    pkill -f "node server.js"
    echo "✅ Killed any remaining server processes"
fi