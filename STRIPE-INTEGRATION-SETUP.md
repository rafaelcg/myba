# 🔗 Stripe + Clerk Integration Setup

## 🎯 What This Does

When users **sign up** → **Automatic Stripe customer creation** → **6 welcome tokens** (3 signup bonus + 3 transferred from anonymous usage)

## ⚡ Quick Setup Steps

### 1. Configure Clerk Webhook

In your **Clerk Dashboard** (https://dashboard.clerk.com/):

1. Go to **Webhooks** section
2. **Create Endpoint**: 
   ```
   http://152.42.141.162/myba/api/webhook/clerk
   ```
3. **Select Events**: 
   - ✅ `user.created` 
   - ✅ `user.updated`
4. **Copy the webhook signing secret** and add to `.env`:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_your_actual_webhook_secret_here
   ```

### 2. Test the Flow

1. **Visit**: http://152.42.141.162/myba/
2. **Use anonymous tokens** (try generating 1-2 tickets)  
3. **Sign up** when prompted
4. **Check server logs**: `tail -f api.log`
   - You should see: `👤 New user signup: email@domain.com`
   - And: `💳 Stripe customer created: cus_xxxxx`

### 3. What Happens Automatically

```mermaid
User Signs Up
    ↓
Clerk Webhook Triggered
    ↓  
Create Stripe Customer
    ↓
Store 6 Tokens in Metadata
    ↓
User Gets Persistent Tokens!
```

## 🎫 Token System

- **Anonymous**: 3 free tokens (temporary)
- **Sign up**: 6 tokens (persistent across devices)
- **Purchase**: Buy more tokens via Stripe

## 🔍 Debugging

**Check if webhook is working:**
```bash
tail -f api.log
# Sign up a test user
# Look for: "👤 New user signup" and "💳 Stripe customer created"
```

**Check user tokens:**
```bash
curl http://152.42.141.162/myba/api/user-tokens/USER_ID
```

## 🚀 Next Steps After Setup

1. ✅ **Webhook working** → Users get tokens on signup
2. ✅ **Frontend integration** → Show user tokens in UI  
3. ✅ **Purchase flow** → Buy tokens adds to Stripe metadata
4. ✅ **Token consumption** → Deduct from user account

The foundation is ready - just need to add your Clerk webhook secret! 🎉