const express = require('express');
const cors = require('cors');
const stripe = require('stripe');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const winston = require('winston');
const { body, param, validationResult } = require('express-validator');
const { Webhook } = require('svix');
const { verifyToken } = require('@clerk/backend');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '') || 'http://localhost:3000/myba';

// Hide framework fingerprint
app.disable('x-powered-by');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'myba-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Admin allowlist (Clerk user IDs), comma-separated via env ADMIN_USER_IDS
const adminUserAllowlist = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Track suspicious activity
const suspiciousActivity = new Map();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://openrouter.ai"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const envOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
};

app.use(cors(corsOptions));

// Rate Limiting Configurations
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientId = req.ip + (req.auth?.userId || '');
    logger.warn(`Rate limit exceeded for ${clientId} on ${req.path}`);
    
    // Track suspicious activity
    const current = suspiciousActivity.get(clientId) || 0;
    suspiciousActivity.set(clientId, current + 1);
    
    res.status(429).json({ 
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }
});

// Different rate limits for different endpoints
const generalLimit = createRateLimit(15 * 60 * 1000, 100, 'Too many requests, please try again later');
const authLimit = createRateLimit(15 * 60 * 1000, 10, 'Too many authentication attempts');
const webhookLimit = createRateLimit(60 * 1000, 50, 'Webhook rate limit exceeded');
const paymentLimit = createRateLimit(15 * 60 * 1000, 5, 'Too many payment attempts');
const aiLimit = createRateLimit(60 * 1000, 10, 'AI generation rate limit exceeded');

// Apply general rate limiting
app.use('/api/', generalLimit);

// Request logging middleware
app.use((req, res, next) => {
  const requestId = uuidv4();
  req.requestId = requestId;
  
  const startTime = Date.now();
  
  logger.info({
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    logger.info({
      requestId,
      status: res.statusCode,
      duration: `${duration}ms`,
      responseSize: JSON.stringify(data).length
    });
    return originalJson.call(this, data);
  };
  
  next();
});

// Admin authentication middleware using Clerk tokens + allowlist
const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    if (!process.env.CLERK_SECRET_KEY) {
      logger.error('CLERK_SECRET_KEY is not configured');
      return res.status(500).json({ error: 'Server auth not configured' });
    }

    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    const subjectUserId = verified?.sub;
    if (!subjectUserId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!adminUserAllowlist.length) {
      logger.error('ADMIN_USER_IDS not configured; denying admin access');
      return res.status(500).json({ error: 'Admin access not configured' });
    }

    if (!adminUserAllowlist.includes(subjectUserId)) {
      return res.status(403).json({ error: 'Forbidden: admin access required' });
    }

    req.auth = { userId: subjectUserId, isAdmin: true };
    next();
  } catch (err) {
    logger.warn('Admin token verification failed:', err?.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// Input validation helper
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Validation errors for ${req.path}:`, errors.array());
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Stripe webhook needs raw body, others need JSON
app.use('/api/webhook/stripe', express.raw({type: 'application/json'}));
app.use('/api/webhook/clerk', express.raw({type: 'application/json'}));
app.use(express.json({ limit: '10mb' }));
// Authentication middleware for user-scoped routes (Clerk JWT)
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    if (!process.env.CLERK_SECRET_KEY) {
      logger.error('CLERK_SECRET_KEY is not configured');
      return res.status(500).json({ error: 'Server auth not configured' });
    }

    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    const subjectUserId = verified?.sub;
    if (!subjectUserId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Enforce subject match with URL param when present
    if (req.params && req.params.userId && req.params.userId !== subjectUserId) {
      return res.status(403).json({ error: 'Forbidden: subject mismatch' });
    }

    // Attach user info for downstream handlers
    req.auth = { userId: subjectUserId };
    next();
  } catch (err) {
    logger.warn('Token verification failed:', err?.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

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

// Anonymous session storage (in-memory) with IP tracking
const anonymousSessions = new Map();
const ipToFingerprints = new Map(); // Track IPs to prevent abuse
const fingerprintToIP = new Map(); // Track fingerprints to IPs

// Cleanup expired anonymous sessions (older than 24 hours)
function cleanupExpiredSessions() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  let cleanedCount = 0;
  
  for (const [fingerprint, session] of anonymousSessions.entries()) {
    if (now - session.lastUsed > maxAge) {
      // Clean up session
      anonymousSessions.delete(fingerprint);
      
      // Clean up IP tracking
      const sessionIP = fingerprintToIP.get(fingerprint);
      if (sessionIP) {
        const ipSessions = ipToFingerprints.get(sessionIP);
        if (ipSessions) {
          ipSessions.delete(fingerprint);
          if (ipSessions.size === 0) {
            ipToFingerprints.delete(sessionIP);
          }
        }
        fingerprintToIP.delete(fingerprint);
      }
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} expired anonymous sessions`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Stripe webhook - handle payment completion
app.post('/api/webhook/stripe', webhookLimit, async (req, res) => {
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
      console.error(`❌ [${webhookId}] STRIPE_WEBHOOK_SECRET not configured - rejecting unsigned webhook`);
      return res.status(400).json({ 
        error: 'Webhook secret not configured', 
        webhookId 
      });
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
app.post('/api/webhook/clerk', webhookLimit, async (req, res) => {
  const startTime = Date.now();
  let webhookId = `clerk_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📥 [${webhookId}] Clerk webhook received`);
  
  try {
    // Require configured secret and verify signature using Svix
    if (!process.env.CLERK_WEBHOOK_SECRET) {
      console.error(`❌ [${webhookId}] CLERK_WEBHOOK_SECRET not configured - rejecting webhook`);
      return res.status(400).json({ 
        error: 'Webhook secret not configured', 
        webhookId 
      });
    }
    
    // Verify signature headers
    const svixId = req.get('svix-id');
    const svixTimestamp = req.get('svix-timestamp');
    const svixSignature = req.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error(`❌ [${webhookId}] Missing Svix signature headers`);
      return res.status(400).json({ error: 'Missing signature headers', webhookId });
    }

    let event;
    try {
      const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
      event = wh.verify(req.body.toString('utf8'), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature
      });
      console.log(`🔄 [${webhookId}] Processing event: ${event.type}`);
    } catch (err) {
      console.error(`❌ [${webhookId}] Webhook verification failed:`, err?.message);
      return res.status(400).json({ error: 'Invalid signature', webhookId });
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
app.get('/api/user-tokens/:userId', 
  authenticateUser,
  param('userId').isLength({ min: 1 }).withMessage('User ID is required'),
  handleValidationErrors,
  async (req, res) => {
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
app.post('/api/user-tokens/:userId/consume', aiLimit,
  authenticateUser,
  param('userId').isLength({ min: 1 }).withMessage('User ID is required'),
  handleValidationErrors,
  async (req, res) => {
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

// Anonymous session endpoints with IP-based abuse prevention
app.post('/api/anonymous-session',
  body('fingerprint').isLength({ min: 5, max: 100 }).withMessage('Valid fingerprint required'),
  handleValidationErrors,
  (req, res) => {
  const { fingerprint } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Check if this IP already has too many sessions (prevent clearing cache abuse)
  const ipSessions = ipToFingerprints.get(clientIP) || new Set();
  const maxSessionsPerIP = 3; // Allow max 3 anonymous sessions per IP
  
  let session = anonymousSessions.get(fingerprint);
  
  if (!session) {
    // Check IP-based rate limiting
    if (ipSessions.size >= maxSessionsPerIP) {
      logger.warn(`Anonymous session creation blocked for IP ${clientIP}: too many sessions (${ipSessions.size}/${maxSessionsPerIP})`);
      
      // Return existing session from this IP if available, otherwise deny
      for (const existingFingerprint of ipSessions) {
        const existingSession = anonymousSessions.get(existingFingerprint);
        if (existingSession && (existingSession.tokens - existingSession.used) > 0) {
          logger.info(`Redirecting to existing session for IP ${clientIP}: ${existingFingerprint}`);
          return res.json(existingSession);
        }
      }
      
      return res.status(429).json({ 
        error: 'Too many anonymous sessions from this IP address. Please sign up for unlimited access.',
        maxSessions: maxSessionsPerIP,
        currentSessions: ipSessions.size
      });
    }
    
    // Create new anonymous session
    session = {
      id: fingerprint,
      tokens: 3, // 3 free tokens for anonymous users
      used: 0,
      created: Date.now(),
      lastUsed: Date.now(),
      fingerprint,
      clientIP: clientIP.substring(0, 20) // Store truncated IP for logging
    };
    
    // Track IP associations
    ipSessions.add(fingerprint);
    ipToFingerprints.set(clientIP, ipSessions);
    fingerprintToIP.set(fingerprint, clientIP);
    
    anonymousSessions.set(fingerprint, session);
    logger.info(`New anonymous session created: ${fingerprint} from IP ${clientIP} (${ipSessions.size}/${maxSessionsPerIP})`);
    console.log(`🎭 New anonymous session created: ${fingerprint}`);
  } else {
    // Update last used time for existing session
    session.lastUsed = Date.now();
    anonymousSessions.set(fingerprint, session);
    
    // Ensure IP tracking is up to date
    if (!fingerprintToIP.has(fingerprint)) {
      fingerprintToIP.set(fingerprint, clientIP);
      const ipSessions = ipToFingerprints.get(clientIP) || new Set();
      ipSessions.add(fingerprint);
      ipToFingerprints.set(clientIP, ipSessions);
    }
  }
  
  res.json(session);
});

app.post('/api/anonymous-session/consume', aiLimit,
  body('sessionId').isLength({ min: 5, max: 100 }).withMessage('Valid session ID required'),
  handleValidationErrors,
  (req, res) => {
  const { sessionId } = req.body;
  
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

// IP status endpoint - check how many anonymous sessions this IP has
app.get('/api/anonymous-status', generalLimit, (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const ipSessions = ipToFingerprints.get(clientIP) || new Set();
  const maxSessionsPerIP = 3;
  
  const sessions = [];
  for (const fingerprint of ipSessions) {
    const session = anonymousSessions.get(fingerprint);
    if (session) {
      sessions.push({
        fingerprint: fingerprint.substring(0, 8) + '...',
        tokens: session.tokens,
        used: session.used,
        remaining: session.tokens - session.used,
        created: new Date(session.created).toISOString(),
        lastUsed: new Date(session.lastUsed).toISOString()
      });
    }
  }
  
  res.json({
    ip: clientIP.substring(0, 20) + '...',
    sessionsUsed: ipSessions.size,
    maxSessions: maxSessionsPerIP,
    canCreateNew: ipSessions.size < maxSessionsPerIP,
    sessions
  });
});

// AI Ticket Generation endpoint with OpenRouter integration
app.post('/api/generate-ticket', aiLimit,
  body('prompt').isLength({ min: 10, max: 5000 }).withMessage('Prompt must be between 10-5000 characters'),
  body('tokensUsed').isInt({ min: 1, max: 10 }).withMessage('Valid token cost required'),
  handleValidationErrors,
  async (req, res) => {
    const { prompt, tokensUsed } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    try {
      // Check if we have an API key configured
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.warn('No AI API key configured, using fallback');
        return res.status(500).json({
          error: 'AI service not configured. Please contact support.'
        });
      }

      // Detect API provider based on key format
      const isOpenRouter = apiKey.startsWith('sk-or-');
      const isOpenAI = apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-');
      
      if (!isOpenRouter && !isOpenAI) {
        logger.error('Invalid API key format');
        return res.status(500).json({
          error: 'Invalid API key format. Please contact support.'
        });
      }
      
      // Configure endpoint and headers based on provider
      let endpoint, headers, model;
      
      if (isOpenRouter) {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': PUBLIC_BASE_URL,
          'X-Title': 'MyBA AI Ticket Generator'
        };
        model = 'openai/gpt-oss-20b'; // OpenRouter format - using OSS 20B model
      } else if (isOpenAI) {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        model = 'gpt-3.5-turbo'; // OpenAI format
      }

      logger.info(`AI request from IP ${clientIP.substring(0, 15)}: Using ${isOpenRouter ? 'OpenRouter OSS 20B' : 'OpenAI'}`);

      // Make request to appropriate AI API
      const aiResponse = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are a senior product manager and technical writer who creates exceptional, detailed tickets for software development teams. You understand different ticket types (bugs, features, epics, tasks, improvements) and tailor your responses accordingly. Always use professional language with clear structure and actionable details.`
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        })
      });

      if (!aiResponse.ok) {
        const error = await aiResponse.json().catch(() => ({ error: { message: 'Unknown API error' } }));
        
        logger.error('AI API Error:', {
          status: aiResponse.status,
          error: error,
          ip: clientIP.substring(0, 15)
        });

        if (aiResponse.status === 401) {
          return res.status(500).json({
            error: 'Server API configuration error. Please contact support.'
          });
        } else if (aiResponse.status === 429) {
          return res.status(429).json({
            error: 'Service temporarily overloaded. Please try again in a moment.'
          });
        } else if (aiResponse.status === 403) {
          return res.status(500).json({
            error: 'Service access issue. Please contact support.'
          });
        }
        
        return res.status(500).json({
          error: `AI service error: ${error.error?.message || aiResponse.statusText}`
        });
      }

      const data = await aiResponse.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        logger.error('No content generated from AI service');
        return res.status(500).json({
          error: 'No content generated from AI service'
        });
      }

      logger.info(`AI ticket generated successfully for IP ${clientIP.substring(0, 15)}: ${tokensUsed} tokens used`);
      
      // Return successful response
      res.json({
        content: content.trim(),
        tokensUsed,
        model: isOpenRouter ? 'openai/gpt-oss-20b' : 'gpt-3.5-turbo',
        timestamp: new Date().toISOString(),
        usage: data.usage || null
      });
      
    } catch (error) {
      logger.error('AI ticket generation failed:', error);
      res.status(500).json({ 
        error: 'Failed to generate ticket. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
});

// Transfer anonymous tokens to authenticated account
app.post('/api/transfer-anonymous-tokens',
  body('sessionId').isLength({ min: 5, max: 100 }).withMessage('Valid session ID required'),
  body('userId').isLength({ min: 5, max: 100 }).withMessage('Valid user ID required'),
  body('remainingTokens').isInt({ min: 0, max: 100 }).withMessage('Valid token count required'),
  handleValidationErrors,
  async (req, res) => {
  const startTime = Date.now();
  let transferId = `transfer_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔄 [${transferId}] Anonymous token transfer request received`);
  
  try {
    const { sessionId, userId, remainingTokens } = req.body;
    
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
          // Prevent duplicate transfers for the same anonymous session
          const alreadyTransferred = !!stripeCustomer.metadata[`transfer_${sessionId}`];
          if (alreadyTransferred) {
            console.log(`ℹ️ [${transferId}] Duplicate transfer attempt ignored for session ${sessionId} and user ${userId}`);
            // Clean up anonymous session and IP tracking even if duplicate
            anonymousSessions.delete(sessionId);
            const sessionIP = fingerprintToIP.get(sessionId);
            if (sessionIP) {
              const ipSessions = ipToFingerprints.get(sessionIP);
              if (ipSessions) {
                ipSessions.delete(sessionId);
                if (ipSessions.size === 0) {
                  ipToFingerprints.delete(sessionIP);
                } else {
                  ipToFingerprints.set(sessionIP, ipSessions);
                }
              }
              fingerprintToIP.delete(sessionId);
            }
            return res.json({
              success: true,
              tokensTransferred: 0,
              transferId,
              message: 'Tokens from this anonymous session were already transferred previously'
            });
          }
          
          // Add transferred tokens to existing total
          const newTotalTokens = currentTokens + tokensToTransfer;
          
          console.log(`🔄 [${transferId}] Updating Stripe customer: ${currentTokens} + ${tokensToTransfer} = ${newTotalTokens} tokens`);
          
          await stripeClient.customers.update(stripeCustomer.id, {
            metadata: {
              tokens: newTotalTokens.toString(),
              tokens_used: currentUsed.toString(),
              tokens_purchased: currentPurchased.toString(),
              tokens_transferred: tokensToTransfer.toString(),
              transfer_date: new Date().toISOString(),
              [`transfer_${sessionId}`]: 'true'
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
    
    // Clean up IP tracking
    const sessionIP = fingerprintToIP.get(sessionId);
    if (sessionIP) {
      const ipSessions = ipToFingerprints.get(sessionIP);
      if (ipSessions) {
        ipSessions.delete(sessionId);
        if (ipSessions.size === 0) {
          ipToFingerprints.delete(sessionIP);
        } else {
          ipToFingerprints.set(sessionIP, ipSessions);
        }
      }
      fingerprintToIP.delete(sessionId);
    }
    
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
    anonymousSessions: anonymousSessions.size,
    suspiciousActivityCount: suspiciousActivity.size
  });
});

// Security monitoring endpoint (admin only)
app.get('/api/security/status', requireAdmin, (req, res) => {
  const topSuspiciousClients = Array.from(suspiciousActivity.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([client, count]) => ({ client: client.substring(0, 20) + '...', violations: count }));
    
  res.json({
    timestamp: new Date().toISOString(),
    security: {
      totalSuspiciousClients: suspiciousActivity.size,
      topViolators: topSuspiciousClients,
      rateLimitConfig: {
        general: '100 requests per 15 minutes',
        authentication: '10 requests per 15 minutes',
        webhooks: '50 requests per minute',
        payments: '5 requests per 15 minutes',
        aiGeneration: '10 requests per minute'
      }
    },
    system: {
      nodeVersion: process.version,
      uptime: `${Math.floor(process.uptime())} seconds`,
      memoryUsage: process.memoryUsage()
    }
  });
});

// Clear suspicious activity (admin only)
app.post('/api/security/clear-violations', requireAdmin, (req, res) => {
  const clearedCount = suspiciousActivity.size;
  suspiciousActivity.clear();
  
  logger.info(`Cleared ${clearedCount} suspicious activity records`);
  
  res.json({
    message: `Cleared ${clearedCount} suspicious activity records`,
    timestamp: new Date().toISOString()
  });
});

// =============== ADMIN ENDPOINTS ===============

// Get all users with their token stats
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    
    const allUsers = [];
    
    // Get users from local cache
    for (const [userId, tokenData] of userTokens.entries()) {
      let userInfo = {
        userId,
        tokens: tokenData.tokens,
        used: tokenData.used,
        remaining: tokenData.tokens - tokenData.used,
        purchased: tokenData.purchased || 0,
        transferred: tokenData.transferred || 0,
        lastUpdated: new Date(tokenData.lastUpdated).toISOString(),
        stripeCustomerId: tokenData.stripeCustomerId
      };
      
      // Try to get additional user info from Stripe if available
      if (stripeClient && tokenData.stripeCustomerId) {
        try {
          const customer = await stripeClient.customers.retrieve(tokenData.stripeCustomerId);
          userInfo.email = customer.email;
          userInfo.name = customer.name;
          userInfo.created = customer.created ? new Date(customer.created * 1000).toISOString() : null;
          userInfo.stripeMetadata = customer.metadata;
        } catch (error) {
          // Continue without Stripe data
          logger.warn(`Could not fetch Stripe customer ${tokenData.stripeCustomerId}: ${error.message}`);
        }
      }
      
      // Apply search filter
      if (search && userInfo.email && !userInfo.email.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }
      
      allUsers.push(userInfo);
    }
    
    // Sort by last updated (most recent first)
    allUsers.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = allUsers.slice(startIndex, endIndex);
    
    res.json({
      users: paginatedUsers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(allUsers.length / limit),
        totalUsers: allUsers.length,
        hasNext: endIndex < allUsers.length,
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Admin users endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get detailed user info
app.get('/api/admin/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const tokenData = userTokens.get(userId);
    
    if (!tokenData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let userInfo = {
      userId,
      tokens: tokenData.tokens,
      used: tokenData.used,
      remaining: tokenData.tokens - tokenData.used,
      purchased: tokenData.purchased || 0,
      transferred: tokenData.transferred || 0,
      lastUpdated: new Date(tokenData.lastUpdated).toISOString(),
      stripeCustomerId: tokenData.stripeCustomerId,
      paymentHistory: []
    };
    
    // Get detailed Stripe info if available
    if (stripeClient && tokenData.stripeCustomerId) {
      try {
        const customer = await stripeClient.customers.retrieve(tokenData.stripeCustomerId);
        userInfo.email = customer.email;
        userInfo.name = customer.name;
        userInfo.created = customer.created ? new Date(customer.created * 1000).toISOString() : null;
        userInfo.stripeMetadata = customer.metadata;
        
        // Get payment history
        const charges = await stripeClient.charges.list({
          customer: tokenData.stripeCustomerId,
          limit: 10
        });
        
        userInfo.paymentHistory = charges.data.map(charge => ({
          id: charge.id,
          amount: charge.amount,
          currency: charge.currency,
          status: charge.status,
          created: new Date(charge.created * 1000).toISOString(),
          description: charge.description
        }));
        
      } catch (error) {
        logger.warn(`Could not fetch detailed Stripe data for ${tokenData.stripeCustomerId}: ${error.message}`);
      }
    }
    
    res.json(userInfo);
    
  } catch (error) {
    logger.error('Admin user detail endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user tokens (admin only)
app.post('/api/admin/users/:userId/tokens', requireAdmin,
  param('userId').isLength({ min: 1 }).withMessage('User ID required'),
  body('tokens').isInt({ min: 0, max: 10000 }).withMessage('Valid token count required'),
  body('reason').isLength({ min: 1, max: 200 }).withMessage('Reason required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { tokens, reason } = req.body;
      
      const tokenData = userTokens.get(userId);
      if (!tokenData) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const oldTokens = tokenData.tokens;
      tokenData.tokens = tokens;
      tokenData.lastUpdated = Date.now();
      userTokens.set(userId, tokenData);
      
      // Update Stripe metadata if available
      if (stripeClient && tokenData.stripeCustomerId) {
        try {
          await stripeClient.customers.update(tokenData.stripeCustomerId, {
            metadata: {
              ...tokenData.stripeMetadata,
              tokens: tokens.toString(),
              admin_adjustment: reason,
              admin_adjustment_date: new Date().toISOString(),
              previous_tokens: oldTokens.toString()
            }
          });
        } catch (error) {
          logger.warn(`Could not update Stripe metadata: ${error.message}`);
        }
      }
      
      logger.info(`Admin token adjustment: User ${userId} tokens changed from ${oldTokens} to ${tokens}. Reason: ${reason}`);
      
      res.json({
        success: true,
        userId,
        oldTokens,
        newTokens: tokens,
        reason,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Admin token update error:', error);
      res.status(500).json({ error: 'Failed to update user tokens' });
    }
  }
);

// Get system metrics and analytics
app.get('/api/admin/metrics', requireAdmin, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '7d'; // 1d, 7d, 30d
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    // Calculate user stats
    const allUsers = Array.from(userTokens.values());
    const totalUsers = allUsers.length;
    const totalTokensIssued = allUsers.reduce((sum, user) => sum + user.tokens, 0);
    const totalTokensUsed = allUsers.reduce((sum, user) => sum + user.used, 0);
    const totalTokensPurchased = allUsers.reduce((sum, user) => sum + (user.purchased || 0), 0);
    const totalTokensTransferred = allUsers.reduce((sum, user) => sum + (user.transferred || 0), 0);
    
    // Calculate revenue (if Stripe data available)
    let totalRevenue = 0;
    let recentRevenue = 0;
    
    if (stripeClient) {
      try {
        // Get all charges for revenue calculation
        const charges = await stripeClient.charges.list({ limit: 100 });
        totalRevenue = charges.data
          .filter(charge => charge.status === 'succeeded')
          .reduce((sum, charge) => sum + charge.amount, 0) / 100; // Convert to dollars
          
        recentRevenue = charges.data
          .filter(charge => charge.status === 'succeeded' && new Date(charge.created * 1000) >= startDate)
          .reduce((sum, charge) => sum + charge.amount, 0) / 100;
      } catch (error) {
        logger.warn('Could not fetch revenue data:', error.message);
      }
    }
    
    // Anonymous session stats
    const totalAnonymousSessions = anonymousSessions.size;
    const activeAnonymousSessions = Array.from(anonymousSessions.values())
      .filter(session => (session.tokens - session.used) > 0).length;
    
    // Calculate conversion rate (anonymous to authenticated)
    const estimatedConversionRate = totalUsers > 0 ? 
      (totalUsers / Math.max(totalUsers + totalAnonymousSessions, 1) * 100).toFixed(1) : 0;
    
    res.json({
      timeframe,
      timestamp: new Date().toISOString(),
      users: {
        total: totalUsers,
        newInPeriod: allUsers.filter(user => 
          new Date(user.lastUpdated) >= startDate
        ).length
      },
      tokens: {
        totalIssued: totalTokensIssued,
        totalUsed: totalTokensUsed,
        totalPurchased: totalTokensPurchased,
        totalTransferred: totalTokensTransferred,
        utilization: totalTokensIssued > 0 ? 
          ((totalTokensUsed / totalTokensIssued) * 100).toFixed(1) : 0
      },
      revenue: {
        total: totalRevenue,
        recent: recentRevenue,
        averagePerUser: totalUsers > 0 ? (totalRevenue / totalUsers).toFixed(2) : 0
      },
      anonymous: {
        totalSessions: totalAnonymousSessions,
        activeSessions: activeAnonymousSessions,
        conversionRate: estimatedConversionRate
      },
      security: {
        suspiciousClients: suspiciousActivity.size,
        rateLimitViolations: Array.from(suspiciousActivity.values())
          .reduce((sum, count) => sum + count, 0)
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    });
    
  } catch (error) {
    logger.error('Admin metrics endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get webhook status and history
app.get('/api/admin/webhooks', requireAdmin, async (req, res) => {
  try {
    const webhookStats = {
      stripe: {
        configured: !!process.env.STRIPE_WEBHOOK_SECRET,
        endpoint: `${PUBLIC_BASE_URL}/api/webhook/stripe`,
        recentActivity: 'Active' // Would need to track this
      },
      clerk: {
        configured: !!process.env.CLERK_WEBHOOK_SECRET,
        endpoint: `${PUBLIC_BASE_URL}/api/webhook/clerk`, 
        recentActivity: 'Active'
      }
    };
    
    // If Stripe is available, get recent webhook events
    if (stripeClient) {
      try {
        const events = await stripeClient.events.list({ limit: 10 });
        webhookStats.stripe.recentEvents = events.data.map(event => ({
          id: event.id,
          type: event.type,
          created: new Date(event.created * 1000).toISOString(),
          processed: true // We'd need to track this
        }));
      } catch (error) {
        logger.warn('Could not fetch Stripe events:', error.message);
      }
    }
    
    res.json({
      webhooks: webhookStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Admin webhooks endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch webhook status' });
  }
});

// Get recent activity log
app.get('/api/admin/activity', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // This is a simplified activity log - in production you'd want to store this properly
    const activities = [];
    
    // Add user activities
    for (const [userId, tokenData] of userTokens.entries()) {
      if (tokenData.lastUpdated) {
        activities.push({
          type: 'token_activity',
          userId: userId.substring(0, 8) + '...',
          action: 'Token usage',
          timestamp: new Date(tokenData.lastUpdated).toISOString(),
          details: `${tokenData.used}/${tokenData.tokens} tokens used`
        });
      }
    }
    
    // Add anonymous session activities
    for (const [sessionId, session] of anonymousSessions.entries()) {
      activities.push({
        type: 'anonymous_activity',
        sessionId: sessionId.substring(0, 8) + '...',
        action: 'Anonymous session',
        timestamp: new Date(session.lastUsed).toISOString(),
        details: `${session.used}/${session.tokens} tokens used`
      });
    }
    
    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      activities: activities.slice(0, limit),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Admin activity endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Create checkout session endpoint
app.post('/api/create-checkout-session', paymentLimit,
  body('planId').isIn(['starter-10', 'professional-50', 'enterprise-200']).withMessage('Valid plan ID required'),
  body('userContext.userId').isLength({ min: 5, max: 100 }).withMessage('Valid user ID required'),
  body('userContext.isFirstPurchase').isBoolean().withMessage('isFirstPurchase must be boolean'),
  handleValidationErrors,
  async (req, res) => {
  const startTime = Date.now();
  let sessionId = `checkout_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📦 [${sessionId}] Checkout session request received`);
  
  try {
    const { planId, userContext } = req.body;
    
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
        success_url: `${PUBLIC_BASE_URL}/?success=true&tokens=${plan.tokens}`,
        cancel_url: `${PUBLIC_BASE_URL}/?canceled=true`,
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