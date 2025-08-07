// Token-based credit system for MyBA monetization
export interface TokenBalance {
  total: number;
  used: number;
  remaining: number;
  lastUpdated: number;
}

export interface TokenPlan {
  id: string;
  name: string;
  tokens: number;
  price: number; // in USD
  popular?: boolean;
  description: string;
  features: string[];
}

// Token pricing tiers
export const TOKEN_PLANS: TokenPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tokens: 25,
    price: 5,
    description: 'Perfect for trying out AI-powered tickets',
    features: [
      '25 AI-generated tickets',
      'All ticket types supported',
      'Copy & paste functionality',
      'No expiration'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    tokens: 100,
    price: 15,
    popular: true,
    description: 'Great for active product managers',
    features: [
      '100 AI-generated tickets',
      'All ticket types supported', 
      'Priority processing',
      'Usage analytics',
      'No expiration'
    ]
  },
  {
    id: 'team',
    name: 'Team',
    tokens: 500,
    price: 50,
    description: 'Perfect for development teams',
    features: [
      '500 AI-generated tickets',
      'Team sharing capabilities',
      'Priority support',
      'Usage analytics',
      'Bulk operations',
      'No expiration'
    ]
  }
];

// Token costs per operation
export const TOKEN_COSTS = {
  GENERATE_TICKET: 1, // 1 token per AI generation
  PREMIUM_FEATURES: 0 // Future premium features
};

// Storage keys
const TOKEN_STORAGE_KEY = 'myba-tokens';
const USAGE_STORAGE_KEY = 'myba-usage';

// Default token balance for new users
const DEFAULT_BALANCE: TokenBalance = {
  total: 3, // 3 free tokens for new users
  used: 0,
  remaining: 3,
  lastUpdated: Date.now()
};

// Get current token balance
export function getTokenBalance(): TokenBalance {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load token balance:', error);
  }
  return DEFAULT_BALANCE;
}

// Save token balance
export function saveTokenBalance(balance: TokenBalance): void {
  try {
    const updatedBalance = {
      ...balance,
      lastUpdated: Date.now()
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(updatedBalance));
  } catch (error) {
    console.warn('Failed to save token balance:', error);
  }
}

// Check if user has enough tokens
export function hasTokens(required: number = TOKEN_COSTS.GENERATE_TICKET): boolean {
  const balance = getTokenBalance();
  return balance.remaining >= required;
}

// Consume tokens
export function consumeTokens(amount: number = TOKEN_COSTS.GENERATE_TICKET): boolean {
  const balance = getTokenBalance();
  
  if (balance.remaining < amount) {
    return false; // Not enough tokens
  }
  
  const newBalance: TokenBalance = {
    total: balance.total,
    used: balance.used + amount,
    remaining: balance.remaining - amount,
    lastUpdated: Date.now()
  };
  
  saveTokenBalance(newBalance);
  trackUsage(amount);
  return true;
}

// Add tokens (after purchase)
export function addTokens(amount: number, planId?: string): void {
  const balance = getTokenBalance();
  const newBalance: TokenBalance = {
    total: balance.total + amount,
    used: balance.used,
    remaining: balance.remaining + amount,
    lastUpdated: Date.now()
  };
  
  saveTokenBalance(newBalance);
  trackPurchase(amount, planId);
}

// Track usage for analytics
function trackUsage(tokens: number): void {
  try {
    const usage = JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY) || '[]');
    usage.push({
      tokens,
      timestamp: Date.now(),
      type: 'generation'
    });
    
    // Keep only last 100 usage records
    const recentUsage = usage.slice(-100);
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(recentUsage));
  } catch (error) {
    console.warn('Failed to track usage:', error);
  }
}

// Track purchases for analytics
function trackPurchase(tokens: number, planId?: string): void {
  try {
    const usage = JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY) || '[]');
    usage.push({
      tokens,
      planId,
      timestamp: Date.now(),
      type: 'purchase'
    });
    
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  } catch (error) {
    console.warn('Failed to track purchase:', error);
  }
}

// Get usage statistics
export function getUsageStats(): { totalGenerated: number; totalPurchased: number; averagePerDay: number } {
  try {
    const usage = JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY) || '[]');
    
    const generations = usage.filter((u: any) => u.type === 'generation');
    const purchases = usage.filter((u: any) => u.type === 'purchase');
    
    const totalGenerated = generations.reduce((sum: number, u: any) => sum + u.tokens, 0);
    const totalPurchased = purchases.reduce((sum: number, u: any) => sum + u.tokens, 0);
    
    // Calculate average per day (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentGenerations = generations.filter((u: any) => u.timestamp > thirtyDaysAgo);
    const averagePerDay = recentGenerations.length / 30;
    
    return {
      totalGenerated,
      totalPurchased,
      averagePerDay: Math.round(averagePerDay * 10) / 10
    };
  } catch (error) {
    return { totalGenerated: 0, totalPurchased: 0, averagePerDay: 0 };
  }
}

// Check if user is new (for showing welcome message)
export function isNewUser(): boolean {
  const balance = getTokenBalance();
  return balance.used === 0 && balance.total === DEFAULT_BALANCE.total;
}

// Reset tokens (for testing)
export function resetTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USAGE_STORAGE_KEY);
}