# 🔐 Clerk Authentication Setup

## Quick Setup Steps

### 1. Create Clerk Account
1. Go to **https://clerk.com**
2. **Sign up** for free
3. **Create new application** called "MyBA"
4. Choose **Email** and **Password** as sign-in methods
5. **Copy your API keys** from the dashboard

### 2. Add Keys to .env
Replace the placeholder values in `.env`:

```bash
# Replace with your actual Clerk keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_real_clerk_key_here  
CLERK_SECRET_KEY=sk_test_your_real_clerk_secret_here
```

### 3. Configure Webhooks (for Stripe integration)
In your Clerk dashboard:
1. Go to **Webhooks** section
2. **Add Endpoint**: `http://152.42.141.162/myba/api/clerk/webhook`
3. **Select Events**: `user.created`, `user.updated`
4. **Copy webhook secret** and add to `.env`:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

### 4. Test Installation
```bash
# Install Clerk dependency
npm install

# Build and deploy
npm run build
./deploy-live.sh
```

## What Happens Next

Once you add the keys:
✅ **Sign Up/In buttons** appear on MyBA  
✅ **Users must authenticate** to generate tickets
✅ **User profile** and logout options in header
✅ **Token system** will connect to user accounts
✅ **Stripe customers** created automatically

## Current Features Ready

- 🔐 **Sign up/in modals** with your branding
- 👤 **User profiles** with Clerk's built-in UI  
- 🎫 **Token manager** (authenticated users only)
- ⚙️ **Settings** (authenticated users only)
- 🚫 **Unauthenticated users** can't generate tickets

The system gracefully falls back when Clerk isn't configured, so the app still works during setup!