// Token Plans Configuration
// Easy to modify pricing strategy - just update this file!

const PRICING_CONFIG = {
  // Cost per generation for our calculations
  estimatedCostPerGeneration: 0.02, // $0.02 per OpenRouter request
  
  // Markup multiplier (2.5x = 150% markup)
  markupMultiplier: 2.5,
  
  // Base price per token (cost * markup)
  get pricePerToken() {
    return this.estimatedCostPerGeneration * this.markupMultiplier;
  }
};

// Token Plans - easy to modify!
const TOKEN_PLANS = [
  {
    id: 'starter',
    name: 'Starter Pack',
    tokens: 25,
    price: 3.99, // ~$0.16 per token
    description: 'Perfect for trying out AI-powered tickets',
    popular: false,
    features: [
      '25 AI-generated tickets',
      'All ticket types supported',
      'Copy & paste functionality',
      'No expiration',
      'Email support'
    ],
    stripeProductId: 'price_starter_pack', // Will be set when Stripe products are created
    color: '#95a5a6'
  },
  {
    id: 'professional',
    name: 'Professional',
    tokens: 100,
    price: 12.99, // ~$0.13 per token (better value)
    description: 'Great for active product managers',
    popular: true,
    features: [
      '100 AI-generated tickets',
      'All ticket types supported', 
      'Priority processing',
      'Usage analytics dashboard',
      'Priority email support',
      'No expiration'
    ],
    stripeProductId: 'price_professional_pack',
    color: '#667eea'
  },
  {
    id: 'team',
    name: 'Team Pack',
    tokens: 500,
    price: 49.99, // ~$0.10 per token (best value)
    description: 'Perfect for development teams',
    popular: false,
    features: [
      '500 AI-generated tickets',
      'Team sharing capabilities',
      'Priority support',
      'Advanced analytics',
      'Bulk operations',
      'Custom integrations',
      'No expiration'
    ],
    stripeProductId: 'price_team_pack',
    color: '#27ae60'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tokens: 2000,
    price: 149.99, // ~$0.075 per token (enterprise discount)
    description: 'For large organizations',
    popular: false,
    features: [
      '2000 AI-generated tickets',
      'White-label options',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom AI model training',
      'API access',
      'No expiration'
    ],
    stripeProductId: 'price_enterprise_pack',
    color: '#8e44ad'
  }
];

// FREE TRIAL CONFIGURATION
const FREE_TRIAL_CONFIG = {
  tokensForNewUsers: 3,
  tokensForReferrals: 5, // Future feature
  tokensForSocialShare: 1 // Future feature
};

// PROMOTIONAL PRICING (easy to enable/disable)
const PROMOTIONS = {
  enabled: false, // Set to true to enable promotions
  
  blackFriday: {
    enabled: false,
    discountPercent: 30,
    validUntil: '2024-11-30',
    affectedPlanIds: ['professional', 'team']
  },
  
  firstTimeBuyer: {
    enabled: true,
    discountPercent: 20,
    maxUses: 1, // per user
    affectedPlanIds: ['starter', 'professional']
  }
};

// DYNAMIC PRICING CALCULATION
function calculateDynamicPrice(basePlan, userContext = {}) {
  let finalPrice = basePlan.price;
  
  if (!PROMOTIONS.enabled) return finalPrice;
  
  // First-time buyer discount
  if (PROMOTIONS.firstTimeBuyer.enabled && 
      userContext.isFirstPurchase &&
      PROMOTIONS.firstTimeBuyer.affectedPlanIds.includes(basePlan.id)) {
    finalPrice = finalPrice * (1 - PROMOTIONS.firstTimeBuyer.discountPercent / 100);
  }
  
  // Seasonal promotions
  if (PROMOTIONS.blackFriday.enabled &&
      new Date() < new Date(PROMOTIONS.blackFriday.validUntil) &&
      PROMOTIONS.blackFriday.affectedPlanIds.includes(basePlan.id)) {
    finalPrice = finalPrice * (1 - PROMOTIONS.blackFriday.discountPercent / 100);
  }
  
  return Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
}

// GET PLANS WITH DYNAMIC PRICING
function getTokenPlans(userContext = {}) {
  return TOKEN_PLANS.map(plan => ({
    ...plan,
    originalPrice: plan.price,
    price: calculateDynamicPrice(plan, userContext),
    pricePerToken: Math.round((calculateDynamicPrice(plan, userContext) / plan.tokens) * 100) / 100
  }));
}

// EXPORT FOR FRONTEND
function getPublicConfig() {
  return {
    plans: TOKEN_PLANS,
    freeTrialTokens: FREE_TRIAL_CONFIG.tokensForNewUsers,
    promotions: PROMOTIONS.enabled ? {
      firstTimeBuyer: PROMOTIONS.firstTimeBuyer.enabled,
      seasonal: PROMOTIONS.blackFriday.enabled
    } : null
  };
}

module.exports = {
  TOKEN_PLANS,
  FREE_TRIAL_CONFIG,
  PROMOTIONS,
  PRICING_CONFIG,
  getTokenPlans,
  calculateDynamicPrice,
  getPublicConfig
};