const express = require('express');
const cors = require('cors');
const stripe = require('stripe');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());

// Stripe webhook needs raw body, others need JSON
app.use('/api/webhook/stripe', express.raw({type: 'application/json'}));
app.use('/api/webhook/clerk', express.raw({type: 'application/json'}));
app.use(express.json());

// Initialize Stripe
let stripeClient;
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('your_stripe')) {
  stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
  console.log('💳 Stripe initialized');
} else {
  console.log('⚠️  Stripe not configured - payments will be simulated');
}

// User token storage (in-memory for now, will move to Stripe metadata)
const userTokens = new Map();

// Anonymous session storage (in-memory)
const anonymousSessions = new Map();

// Stripe webhook - handle payment completion
app.post('/api/webhook/stripe', async (req, res) => {
  const startTime = Date.now();
  let webhookId = `stripe_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📥 [${webhookId}] Stripe webhook received`);
  
  try {
    const sig = req.get('stripe-signature');
    let event;

    if (process.env.STRIPE_WEBHOOK_SECRET) {
      try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log(`✅ [${webhookId}] Webhook signature verified`);
      } catch (err) {
        console.error(`❌ [${webhookId}] Webhook signature verification failed:`, err.message);
        return res.status(400).json({ 
          error: 'Webhook signature verification failed', 
          webhookId,
          message: err.message 
        });
      }
    } else {
      try {
        event = JSON.parse(req.body.toString());
        console.log(`⚠️ [${webhookId}] No webhook secret - processing unsigned event`);
      } catch (parseError) {
        console.error(`❌ [${webhookId}] Failed to parse webhook body:`, parseError.message);
        return res.status(400).json({ 
          error: 'Invalid JSON payload', 
          webhookId 
        });
      }
    }

    console.log(`🔄 [${webhookId}] Processing event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const tokens = parseInt(session.metadata.tokens);
      
      if (!userId) {
        console.error(`❌ [${webhookId}] Missing client_reference_id in session`);
        return res.status(400).json({ 
          error: 'Missing user ID in session', 
          webhookId 
        });
      }
      
      if (!tokens || tokens <= 0) {
        console.error(`❌ [${webhookId}] Invalid token count: ${tokens}`);
        return res.status(400).json({ 
          error: 'Invalid token count', 
          webhookId 
        });
      }
      
      console.log(`💰 [${webhookId}] Payment completed! User ${userId} purchased ${tokens} tokens`);
      
      // Find user's Stripe customer with retry logic
      let customer = null;
      let customerAttempt = 0;
      const maxCustomerAttempts = 3;
      
      while (!customer && customerAttempt < maxCustomerAttempts) {
        try {
          console.log(`🔍 [${webhookId}] Searching for customer (attempt ${customerAttempt + 1})`);
          const customers = await stripeClient.customers.search({
            query: `metadata['clerk_user_id']:'${userId}'`,
            limit: 1
          });
          
          if (customers.data && customers.data.length > 0) {
            customer = customers.data[0];
            console.log(`✅ [${webhookId}] Customer found: ${customer.id}`);
          } else {
            console.log(`❌ [${webhookId}] Customer not found for user ${userId}`);
            if (customerAttempt < maxCustomerAttempts - 1) {
              // Wait 1 second before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (searchError) {
          console.error(`❌ [${webhookId}] Customer search failed (attempt ${customerAttempt + 1}):`, searchError.message);
          if (customerAttempt < maxCustomerAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        customerAttempt++;
      }
      
      if (customer) {
        try {
          const currentTokens = parseInt(customer.metadata.tokens || '0');
          const currentUsed = parseInt(customer.metadata.tokens_used || '0');
          
          // Add purchased tokens
          const newTotalTokens = currentTokens + tokens;
          
          // Track total purchased tokens for stats
          const currentPurchased = parseInt(customer.metadata.tokens_purchased || '0');
          const newTotalPurchased = currentPurchased + tokens;
          
          console.log(`🔄 [${webhookId}] Updating customer: ${currentTokens} + ${tokens} = ${newTotalTokens} tokens`);
          
          await stripeClient.customers.update(customer.id, {
            metadata: {
              tokens: newTotalTokens.toString(),
              tokens_used: currentUsed.toString(),
              tokens_purchased: newTotalPurchased.toString(),
              last_purchase: new Date().toISOString(),
              last_purchase_tokens: tokens.toString()
            }
          });
          
          // Update local cache
          userTokens.set(userId, {
            stripeCustomerId: customer.id,
            tokens: newTotalTokens,
            used: currentUsed,
            purchased: newTotalPurchased,
            lastUpdated: Date.now()
          });
          
          console.log(`🎫 [${webhookId}] Successfully added ${tokens} tokens to user ${userId}. New total: ${newTotalTokens}`);
        } catch (updateError) {
          console.error(`❌ [${webhookId}] Failed to update customer metadata:`, updateError.message);
          return res.status(500).json({ 
            error: 'Failed to update customer tokens', 
            webhookId,
            userId,
            customerId: customer.id,
            message: updateError.message 
          });
        }
      } else {
        console.error(`❌ [${webhookId}] Customer not found after ${maxCustomerAttempts} attempts for user ${userId}`);
        return res.status(404).json({ 
          error: 'Customer not found', 
          webhookId,
          userId 
        });
      }
    } else {
      console.log(`ℹ️ [${webhookId}] Ignoring event type: ${event.type}`);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ [${webhookId}] Webhook processed successfully in ${processingTime}ms`);
    res.json({ 
      received: true, 
      webhookId,
      processingTime,
      eventType: event.type 
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [${webhookId}] Webhook processing failed after ${processingTime}ms:`, error.message);
    console.error(`❌ [${webhookId}] Error stack:`, error.stack);
    res.status(500).json({ 
      error: 'Webhook processing failed', 
      webhookId,
      processingTime,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clerk webhook - create Stripe customer on user signup
app.post('/api/webhook/clerk', async (req, res) => {
  const startTime = Date.now();
  let webhookId = `clerk_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📥 [${webhookId}] Clerk webhook received`);
  
  try {
    // Parse webhook event
    let event;
    try {
      event = JSON.parse(req.body.toString());
      console.log(`🔄 [${webhookId}] Processing event: ${event.type}`);
    } catch (parseError) {
      console.error(`❌ [${webhookId}] Failed to parse webhook body:`, parseError.message);
      return res.status(400).json({ 
        error: 'Invalid JSON payload', 
        webhookId 
      });
    }
    
    if (event.type === 'user.created') {
      const user = event.data;
      const userId = user.id;
      const email = user.email_addresses?.[0]?.email_address;
      const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      
      if (!userId) {
        console.error(`❌ [${webhookId}] Missing user ID in event`);
        return res.status(400).json({ 
          error: 'Missing user ID', 
          webhookId 
        });
      }
      
      if (!email) {
        console.error(`❌ [${webhookId}] Missing email address for user ${userId}`);
        return res.status(400).json({ 
          error: 'Missing email address', 
          webhookId,
          userId 
        });
      }
      
      console.log(`👤 [${webhookId}] New user signup: ${email} (${userId})`);
      
      if (stripeClient) {
        try {
          console.log(`🔄 [${webhookId}] Creating Stripe customer for ${email}`);
          
          // Create Stripe customer
          const customer = await stripeClient.customers.create({
            email: email,
            name: name || email,
            metadata: {
              clerk_user_id: userId,
              tokens: '6', // 6 welcome tokens (will be adjusted if anonymous tokens are transferred)
              tokens_used: '0',
              tokens_purchased: '0',
              tokens_transferred: '0', // Track transferred tokens separately
              created_at: new Date().toISOString()
            }
          });
          
          console.log(`💳 [${webhookId}] Stripe customer created: ${customer.id} for user ${userId}`);
          
          // Store locally for quick access
          userTokens.set(userId, {
            stripeCustomerId: customer.id,
            tokens: 6,
            used: 0,
            purchased: 0,
            transferred: 0,
            lastUpdated: Date.now()
          });
          
        } catch (stripeError) {
          console.error(`❌ [${webhookId}] Failed to create Stripe customer for ${userId}:`, stripeError.message);
          // Continue without Stripe customer - user can still use the system
          userTokens.set(userId, {
            stripeCustomerId: null,
            tokens: 6,
            used: 0,
            purchased: 0,
            transferred: 0,
            lastUpdated: Date.now()
          });
          console.log(`⚠️ [${webhookId}] Fallback: User ${userId} created without Stripe customer`);
        }
      } else {
        // No Stripe configured, store locally
        console.log(`⚠️ [${webhookId}] No Stripe configured - storing user ${userId} locally`);
        userTokens.set(userId, {
          stripeCustomerId: null,
          tokens: 6,
          used: 0,
          purchased: 0,
          transferred: 0,
          lastUpdated: Date.now()
        });
        console.log(`🎫 [${webhookId}] Local tokens created for user ${userId}: 6 tokens`);
      }
    } else {
      console.log(`ℹ️ [${webhookId}] Ignoring event type: ${event.type}`);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ [${webhookId}] Webhook processed successfully in ${processingTime}ms`);
    res.json({ 
      received: true, 
      webhookId,
      processingTime,
      eventType: event.type 
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [${webhookId}] Webhook processing failed after ${processingTime}ms:`, error.message);
    console.error(`❌ [${webhookId}] Error stack:`, error.stack);
    res.status(500).json({ 
      error: 'Webhook processing failed', 
      webhookId,
      processingTime,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get user tokens
app.get('/api/user-tokens/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    let tokenData = userTokens.get(userId);
    
    if (!tokenData && stripeClient) {
      // Try to find Stripe customer
      const customers = await stripeClient.customers.search({
        query: `metadata['clerk_user_id']:'${userId}'`,
        limit: 1
      });
      
      if (customers.data && customers.data.length > 0) {
        const customer = customers.data[0];
        const tokens = parseInt(customer.metadata.tokens || '0');
        const used = parseInt(customer.metadata.tokens_used || '0');
        
        const purchased = parseInt(customer.metadata.tokens_purchased || '0');
        
        tokenData = {
          stripeCustomerId: customer.id,
          tokens,
          used,
          purchased,
          lastUpdated: Date.now()
        };
        
        userTokens.set(userId, tokenData);
      }
    }
    
    if (!tokenData) {
      return res.json({
        tokens: 0,
        used: 0,
        remaining: 0
      });
    }
    
    res.json({
      tokens: tokenData.tokens,
      used: tokenData.used,
      remaining: tokenData.tokens - tokenData.used,
      purchased: tokenData.purchased || 0
    });
    
  } catch (error) {
    console.error('Error getting user tokens:', error);
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

// Use user token
app.post('/api/user-tokens/:userId/consume', async (req, res) => {
  try {
    const { userId } = req.params;
    const tokenData = userTokens.get(userId);
    
    if (!tokenData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const remaining = tokenData.tokens - tokenData.used;
    if (remaining <= 0) {
      return res.status(400).json({ error: 'No tokens remaining' });
    }
    
    tokenData.used += 1;
    tokenData.lastUpdated = Date.now();
    userTokens.set(userId, tokenData);
    
    // Update Stripe customer metadata if available
    if (stripeClient && tokenData.stripeCustomerId) {
      try {
        await stripeClient.customers.update(tokenData.stripeCustomerId, {
          metadata: {
            tokens_used: tokenData.used.toString(),
            last_used: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Failed to update Stripe metadata:', error);
      }
    }
    
    console.log(`🎫 Token consumed for user ${userId}: ${remaining - 1} remaining`);
    
    res.json({
      success: true,
      remaining: remaining - 1,
      used: tokenData.used
    });
    
  } catch (error) {
    console.error('Error consuming token:', error);
    res.status(500).json({ error: 'Failed to consume token' });
  }
});

// Anonymous session endpoints
app.post('/api/anonymous-session', (req, res) => {
  const { fingerprint } = req.body;
  
  if (!fingerprint) {
    return res.status(400).json({ error: 'Fingerprint required' });
  }
  
  let session = anonymousSessions.get(fingerprint);
  
  if (!session) {
    // Create new anonymous session
    session = {
      id: fingerprint,
      tokens: 3, // 3 free tokens for anonymous users
      used: 0,
      created: Date.now(),
      lastUsed: Date.now(),
      fingerprint
    };
    anonymousSessions.set(fingerprint, session);
    console.log(`🎭 New anonymous session created: ${fingerprint}`);
  } else {
    // Update last used time
    session.lastUsed = Date.now();
    anonymousSessions.set(fingerprint, session);
  }
  
  res.json(session);
});

app.post('/api/anonymous-session/consume', (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }
  
  const session = anonymousSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const remaining = session.tokens - session.used;
  if (remaining <= 0) {
    return res.status(400).json({ error: 'No tokens remaining' });
  }
  
  session.used += 1;
  session.lastUsed = Date.now();
  anonymousSessions.set(sessionId, session);
  
  console.log(`🎭 Anonymous token consumed: ${sessionId} (${remaining - 1} remaining)`);
  
  res.json({
    success: true,
    remaining: remaining - 1,
    used: session.used
  });
});

// Transfer anonymous tokens to authenticated account
app.post('/api/transfer-anonymous-tokens', async (req, res) => {
  const startTime = Date.now();
  let transferId = `transfer_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔄 [${transferId}] Anonymous token transfer request received`);
  
  try {
    const { sessionId, userId, remainingTokens } = req.body;
    
    if (!sessionId || !userId || remainingTokens === undefined) {
      console.error(`❌ [${transferId}] Missing required parameters`);
      return res.status(400).json({ 
        error: 'Missing sessionId, userId, or remainingTokens',
        transferId 
      });
    }
    
    console.log(`🔄 [${transferId}] Transferring ${remainingTokens} anonymous tokens from ${sessionId} to user ${userId}`);
    
    // Find the anonymous session
    const anonymousSession = anonymousSessions.get(sessionId);
    if (!anonymousSession) {
      console.log(`⚠️ [${transferId}] Anonymous session not found: ${sessionId}`);
      // This is OK - user might have used localStorage only
      return res.json({ 
        success: true, 
        message: 'No server session found (localStorage-only user)', 
        transferId 
      });
    }
    
    const actualRemaining = anonymousSession.tokens - anonymousSession.used;
    const tokensToTransfer = Math.min(remainingTokens, actualRemaining);
    
    if (tokensToTransfer <= 0) {
      console.log(`ℹ️ [${transferId}] No tokens to transfer from ${sessionId}`);
      return res.json({ 
        success: true, 
        tokensTransferred: 0, 
        message: 'No tokens to transfer',
        transferId 
      });
    }
    
    // Find or create user's token record
    let userTokenData = userTokens.get(userId);
    let stripeCustomer = null;
    
    if (stripeClient) {
      try {
        // Find user's Stripe customer
        const customers = await stripeClient.customers.search({
          query: `metadata['clerk_user_id']:'${userId}'`,
          limit: 1
        });
        
        if (customers.data && customers.data.length > 0) {
          stripeCustomer = customers.data[0];
          const currentTokens = parseInt(stripeCustomer.metadata.tokens || '6'); // Default welcome tokens
          const currentUsed = parseInt(stripeCustomer.metadata.tokens_used || '0');
          const currentPurchased = parseInt(stripeCustomer.metadata.tokens_purchased || '0');
          
          // Add transferred tokens to existing total
          const newTotalTokens = currentTokens + tokensToTransfer;
          
          console.log(`🔄 [${transferId}] Updating Stripe customer: ${currentTokens} + ${tokensToTransfer} = ${newTotalTokens} tokens`);
          
          await stripeClient.customers.update(stripeCustomer.id, {
            metadata: {
              tokens: newTotalTokens.toString(),
              tokens_used: currentUsed.toString(),
              tokens_purchased: currentPurchased.toString(),
              tokens_transferred: tokensToTransfer.toString(),
              transfer_date: new Date().toISOString()
            }
          });
          
          // Update local cache
          userTokens.set(userId, {
            stripeCustomerId: stripeCustomer.id,
            tokens: newTotalTokens,
            used: currentUsed,
            purchased: currentPurchased,
            transferred: tokensToTransfer,
            lastUpdated: Date.now()
          });
          
        } else {
          console.log(`⚠️ [${transferId}] Stripe customer not found for user ${userId}`);
        }
      } catch (stripeError) {
        console.error(`❌ [${transferId}] Stripe error during transfer:`, stripeError.message);
      }
    }
    
    // If no Stripe customer found, update local storage
    if (!stripeCustomer) {
      if (userTokenData) {
        userTokenData.tokens += tokensToTransfer;
        userTokenData.transferred = tokensToTransfer;
        userTokenData.lastUpdated = Date.now();
      } else {
        userTokenData = {
          stripeCustomerId: null,
          tokens: 6 + tokensToTransfer, // 6 welcome + transferred
          used: 0,
          purchased: 0,
          transferred: tokensToTransfer,
          lastUpdated: Date.now()
        };
      }
      userTokens.set(userId, userTokenData);
      console.log(`📝 [${transferId}] Updated local token record for user ${userId}`);
    }
    
    // Remove anonymous session after successful transfer
    anonymousSessions.delete(sessionId);
    console.log(`🗑️ [${transferId}] Removed anonymous session: ${sessionId}`);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ [${transferId}] Successfully transferred ${tokensToTransfer} tokens in ${processingTime}ms`);
    
    res.json({
      success: true,
      tokensTransferred: tokensToTransfer,
      transferId,
      processingTime
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [${transferId}] Token transfer failed after ${processingTime}ms:`, error.message);
    console.error(`❌ [${transferId}] Error stack:`, error.stack);
    
    res.status(500).json({ 
      error: 'Token transfer failed', 
      transferId,
      processingTime,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stripeEnabled: !!stripeClient,
    userTokens: userTokens.size,
    anonymousSessions: anonymousSessions.size
  });
});

// Create checkout session endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  const startTime = Date.now();
  let sessionId = `checkout_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📦 [${sessionId}] Checkout session request received`);
  
  try {
    const { planId, userContext } = req.body;
    
    // Validate request data
    if (!planId) {
      console.error(`❌ [${sessionId}] Missing planId in request`);
      return res.status(400).json({ 
        error: 'Plan ID is required', 
        sessionId 
      });
    }
    
    if (!userContext || !userContext.userId) {
      console.error(`❌ [${sessionId}] Missing userContext or userId in request`);
      return res.status(400).json({ 
        error: 'User context with userId is required', 
        sessionId 
      });
    }
    
    console.log(`🔄 [${sessionId}] Processing checkout for user ${userContext.userId}, plan: ${planId}`);
    
    if (!stripeClient) {
      console.log(`⚠️ [${sessionId}] Stripe not configured - returning simulation mode`);
      return res.json({
        simulatedPayment: true,
        message: 'Stripe not configured - simulating payment',
        planId,
        userContext,
        sessionId
      });
    }

    // Plan configurations
    const planConfig = {
      'starter-10': {
        name: 'Starter Pack - 10 Tokens',
        price: userContext.isFirstPurchase ? 499 : 599, // in cents
        tokens: 10
      },
      'professional-50': {
        name: 'Professional - 50 Tokens', 
        price: userContext.isFirstPurchase ? 1999 : 2499,
        tokens: 50
      },
      'enterprise-200': {
        name: 'Enterprise - 200 Tokens',
        price: userContext.isFirstPurchase ? 6999 : 8999,
        tokens: 200
      }
    };

    const plan = planConfig[planId];
    if (!plan) {
      console.error(`❌ [${sessionId}] Invalid plan ID: ${planId}`);
      return res.status(400).json({ 
        error: 'Invalid plan ID', 
        sessionId,
        availablePlans: Object.keys(planConfig)
      });
    }

    console.log(`💰 [${sessionId}] Creating checkout for ${plan.tokens} tokens at $${plan.price/100}`);

    // Create Stripe checkout session with comprehensive error handling
    try {
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: `${plan.tokens} AI ticket generation tokens`,
            },
            unit_amount: plan.price,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `http://152.42.141.162/myba/?success=true&tokens=${plan.tokens}`,
        cancel_url: `http://152.42.141.162/myba/?canceled=true`,
        metadata: {
          planId,
          userId: userContext.userId,
          tokens: plan.tokens.toString(),
          isFirstPurchase: userContext.isFirstPurchase.toString()
        },
        client_reference_id: userContext.userId
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ [${sessionId}] Stripe checkout session created successfully in ${processingTime}ms`);
      console.log(`🔗 [${sessionId}] Checkout URL: ${session.url}`);

      res.json({
        url: session.url,
        sessionId: session.id,
        processingTime,
        planDetails: {
          name: plan.name,
          tokens: plan.tokens,
          price: plan.price
        }
      });
    } catch (stripeError) {
      console.error(`❌ [${sessionId}] Stripe API error:`, stripeError.message);
      console.error(`❌ [${sessionId}] Stripe error details:`, {
        type: stripeError.type,
        code: stripeError.code,
        decline_code: stripeError.decline_code,
        param: stripeError.param
      });
      
      // Return user-friendly error message based on Stripe error type
      let userMessage = 'Payment processing is temporarily unavailable';
      if (stripeError.type === 'StripeCardError') {
        userMessage = 'Card was declined. Please try a different payment method.';
      } else if (stripeError.type === 'StripeRateLimitError') {
        userMessage = 'Too many requests. Please try again in a moment.';
      } else if (stripeError.type === 'StripeInvalidRequestError') {
        userMessage = 'Invalid payment request. Please contact support.';
      } else if (stripeError.type === 'StripeAPIError') {
        userMessage = 'Payment service temporarily unavailable. Please try again.';
      }
      
      return res.status(500).json({ 
        error: userMessage,
        sessionId,
        stripeErrorType: stripeError.type,
        stripeErrorCode: stripeError.code
      });
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [${sessionId}] Checkout session creation failed after ${processingTime}ms:`, error.message);
    console.error(`❌ [${sessionId}] Error stack:`, error.stack);
    
    res.status(500).json({ 
      error: 'Failed to create checkout session', 
      sessionId,
      processingTime,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Token plans endpoint
app.get('/api/plans', (req, res) => {
  const isFirstPurchase = req.query.first_purchase === 'true';
  
  const plans = [
    {
      id: 'starter-10',
      name: 'Starter Pack',
      tokens: 10,
      price: isFirstPurchase ? 4.99 : 5.99,
      originalPrice: isFirstPurchase ? 5.99 : null,
      description: 'Perfect for trying out AI tickets',
      features: [
        '10 AI-generated tickets',
        'Professional formatting',
        'Instant generation'
      ],
      color: '#27ae60',
      pricePerToken: isFirstPurchase ? 0.499 : 0.599
    },
    {
      id: 'professional-50',
      name: 'Professional',
      tokens: 50,
      price: isFirstPurchase ? 19.99 : 24.99,
      originalPrice: isFirstPurchase ? 24.99 : null,
      description: 'Great for regular use',
      popular: true,
      features: [
        '50 AI-generated tickets',
        'Professional formatting',
        'Priority support',
        'Bulk generation'
      ],
      color: '#667eea',
      pricePerToken: isFirstPurchase ? 0.40 : 0.50
    },
    {
      id: 'enterprise-200',
      name: 'Enterprise',
      tokens: 200,
      price: isFirstPurchase ? 69.99 : 89.99,
      originalPrice: isFirstPurchase ? 89.99 : null,
      description: 'Best value for teams',
      features: [
        '200 AI-generated tickets',
        'Professional formatting',
        'Priority support',
        'Team collaboration',
        'Custom templates'
      ],
      color: '#f39c12',
      pricePerToken: isFirstPurchase ? 0.35 : 0.45
    }
  ];
  
  res.json({
    plans,
    stripeEnabled: !!stripeClient
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 MyBA API Server running on port ${port}`);
  console.log(`💡 Health check: http://localhost:${port}/api/health`);
  console.log(`🔗 Stripe: ${stripeClient ? '✅ Configured' : '❌ Not configured'}`);
});