#!/bin/bash

# MyBA Full Stack Startup Script
echo "🚀 Starting MyBA Token-Based AI Service..."

# Check if .env file exists and has OpenAI key
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with your OpenAI API key:"
    echo "OPENAI_API_KEY=your_key_here"
    exit 1
fi

if ! grep -q "OPENAI_API_KEY=" .env || grep -q "your_openai_api_key_here" .env; then
    echo "⚠️  Please set your OpenAI API key in the .env file"
    echo "Edit .env and replace 'your_openai_api_key_here' with your actual key"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start both backend and frontend
echo "🎫 Starting token-based AI backend on port 3001..."
echo "🎨 Starting frontend on port 3000..."
echo "📱 Access your app at: http://localhost:3000"
echo "🔧 API health check: http://localhost:3001/api/health"
echo ""
echo "Press Ctrl+C to stop both servers"

npm run start