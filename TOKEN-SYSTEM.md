# 🎫 MyBA Token-Based AI System

## Overview

MyBA now features a **token-based AI service** where users don't need to provide their own OpenAI API keys. Instead, they purchase tokens that are consumed when generating AI tickets using our backend service.

## 🏗️ Architecture

```
Frontend (React) → Backend API (Node.js) → OpenAI API
     ↓                    ↓
Token Management    Server API Key
```

### Key Components

1. **Backend API Server** (`server.js`) - Handles AI requests using our OpenAI key
2. **Token System** (`src/utils/tokenSystem.ts`) - Manages user token balance and consumption
3. **Backend Service** (`src/utils/backendService.ts`) - Frontend service to call our API
4. **Token Manager UI** (`src/components/TokenManager.tsx`) - Purchase and manage tokens

## 🚀 Getting Started

### 1. Configure Your OpenAI API Key

```bash
# Edit .env file
OPENAI_API_KEY=sk-your-actual-openai-key-here
```

### 2. Start the Full System

```bash
# Option 1: Use the startup script
./start.sh

# Option 2: Start manually
npm run start
```

### 3. Access the Application

- **Frontend**: http://localhost:3000 (or your domain)
- **API Health Check**: http://localhost:3001/api/health

## 🎫 Token System

### Default Setup
- **New users**: 3 free tokens
- **Token cost**: 1 token per AI generation
- **Storage**: Local browser storage

### Token Plans
```javascript
Starter: 25 tokens - $5
Professional: 100 tokens - $15 (Popular)
Team: 500 tokens - $50
```

### Token Consumption Flow
1. User clicks "Generate" 
2. System checks token balance
3. If sufficient tokens → Make API request
4. On success → Consume token
5. Update UI with new balance

## 🔧 User Experience

### Token-Based Mode (Default)
- ✅ No API key required
- ✅ 3 free tokens to start
- ✅ Simple pay-per-use
- ✅ Token manager in UI

### User API Key Mode (Advanced)
- ⚙️ User provides their own API key
- ⚙️ Bypasses token system
- ⚙️ For users with unlimited API access

### Mock Mode (Fallback)
- 🎭 No tokens or API key
- 🎭 Uses sample templates
- 🎭 Good for demos

## 🔐 Security Features

- **Server-side API key**: OpenAI key never exposed to frontend
- **Token validation**: Backend validates token consumption
- **Rate limiting**: Natural rate limiting through token system
- **Error handling**: Graceful failures with fallbacks

## 🌐 Production Deployment

### 1. Set Up Environment
```bash
# Production .env
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=your_production_key
CORS_ORIGIN=https://yourdomain.com
```

### 2. Install as System Service
```bash
# Copy service file
sudo cp myba-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable myba-api
sudo systemctl start myba-api
```

### 3. Configure Nginx Proxy
```nginx
# Add to your nginx config
location /api/ {
    proxy_pass http://localhost:3001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## 🔄 API Endpoints

### `POST /api/generate-ticket`
```json
{
  "prompt": "Enhanced prompt from frontend",
  "tokensUsed": 1
}
```

**Response:**
```json
{
  "content": "Generated ticket content",
  "tokensConsumed": 1,
  "usage": { "prompt_tokens": 45, "completion_tokens": 123 }
}
```

### `GET /api/health`
```json
{
  "status": "healthy",
  "timestamp": "2023-...",
  "environment": "production"
}
```

## 📊 Frontend Integration

### Token Balance Display
- Real-time token count in header
- Low token warnings
- Visual progress indicators

### Smart Error Handling
- Token insufficient → Show purchase options
- API errors → Fallback to mock templates
- Network issues → Retry suggestions

### Seamless UX
- Works without tokens (mock mode)
- Upgrade path to token system
- Optional user API key mode

## 🎯 Benefits of This System

### For Users
- **No Setup Required**: Start using immediately with free tokens
- **Fair Pricing**: Pay only for what you use
- **No API Management**: No need to handle OpenAI accounts
- **Secure**: API keys never exposed to user

### For You
- **Revenue Stream**: Token sales business model
- **Cost Control**: Manage OpenAI usage centrally  
- **User Analytics**: Track usage patterns
- **Scalability**: Easy to add more AI providers

## 🔮 Next Steps

1. **Payment Integration**: Add Stripe for token purchases
2. **User Accounts**: Save tokens to user accounts vs localStorage
3. **Analytics**: Track usage and revenue
4. **Multiple Models**: Support different AI models/pricing tiers
5. **Bulk Operations**: Discounted tokens for bulk purchases

## 🆘 Troubleshooting

### Common Issues

**Backend won't start:**
```bash
# Check .env file exists and has OPENAI_API_KEY
cat .env
```

**Frontend can't reach API:**
```bash
# Check API is running
curl http://localhost:3001/api/health
```

**Tokens not working:**
```bash
# Check browser localStorage
# Open DevTools → Application → Storage → localStorage
```

---

🌟 **Your token-based AI ticket generator is ready to monetize!** Users get instant access with free tokens and can purchase more as needed.