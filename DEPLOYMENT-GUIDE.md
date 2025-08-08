# 🚀 MyBA Deployment Guide

## Critical Deployment Steps (Production)

### 1. Environment Configuration
Set the following in `.env` (or systemd environment):
```bash
# Core
NODE_ENV=production
PORT=3001
PUBLIC_BASE_URL=https://your-domain.tld/myba

# CORS (exact origins)
CORS_ORIGINS=https://your-domain.tld

# Internal admin API key
INTERNAL_API_KEY=...

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_live_or_test_...
CLERK_SECRET_KEY=sk_live_or_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Stripe (Test or Live)
STRIPE_SECRET_KEY=sk_test_or_live_...
STRIPE_PUBLISHABLE_KEY=pk_test_or_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI Provider
OPENAI_API_KEY=sk-or-v1-...
```
Notes:
- `NODE_ENV=production` ensures frontend uses same-origin API base.
- `PORT=3001` must match Nginx proxy target `/myba/api/*` → `http://localhost:3001/api/*`.

### 2. Install & Build
```bash
npm install
npm run build
```

### 3. Deploy Built Frontend
```bash
cp -r dist/public/* .
```

### 4. Server Management
```bash
pkill -f "node server.js" 2>/dev/null || true
nohup node server.js > api.log 2>&1 & echo $! > api.pid

# Verify health
curl -s http://localhost:3001/api/health | jq .
curl -s https://your-domain.tld/myba/api/health | jq .
```

### 5. Full Deployment Script
```bash
#!/bin/bash
# deploy-myba.sh

echo "🚀 Deploying MyBA..."

# 1. Install & build
npm install
npm run build

# 2. Deploy frontend
cp -r dist/public/* .

# 3. Restart API server
pkill -f "node server.js" 2>/dev/null
nohup node server.js > api.log 2>&1 & echo $! > api.pid

# 4. Verify deployment
sleep 2
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ API server running"
else
    echo "❌ API server failed"
fi

if curl -s https://your-domain.tld/myba/api/health > /dev/null; then
    echo "✅ Proxy working"
else
    echo "❌ Proxy failed"
fi

echo "🌐 MyBA deployed at: https://your-domain.tld/myba/"
```

## Common Issues

### Issue: AI Service Shows Mock Responses
**Cause**: `NODE_ENV=development` in `.env`
**Fix**: Change to `NODE_ENV=production` and rebuild

### Issue: Build Fails with Asset Resolution
**Cause**: Old built assets in `index.html`
**Fix**: Reset `index.html` to development template before building

### Issue: Server Won't Start
**Cause**: Port 3001 already in use
**Fix**: `pkill -f "node server"` then restart

### Issue: Nginx 502 Error
**Cause**: API server not running on port 3001
**Fix**: Check `api.log` and restart server

## Environment Variables Required
See the list in section 1.

## Architecture
- **Frontend**: React + Vite + TypeScript + Clerk + PostHog
- **Backend**: Node.js + Express + Stripe + OpenRouter  
- **Deployment**: Static files + API server on port 3001
- **Proxy**: Nginx routes `/myba/api/*` → `localhost:3001/api/*`

---
*Last Updated: August 8, 2025 (updated for server.js auth & webhooks)*