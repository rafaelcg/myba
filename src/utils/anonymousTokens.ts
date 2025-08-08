// Anonymous user token tracking - better than localStorage
// Uses browser fingerprinting + server-side session tracking

interface AnonymousSession {
  id: string;
  tokens: number;
  used: number;
  created: number;
  lastUsed: number;
  fingerprint: string;
}

import { API_BASE_URL } from './backendService';

// Create browser fingerprint (simple but effective)
function createFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx!.textBaseline = 'top';
  ctx!.font = '14px Arial';
  ctx!.fillText('MyBA fingerprint', 2, 2);
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return 'anon_' + Math.abs(hash).toString(36);
}

// Get or create anonymous session with robust server-side validation
export async function getAnonymousSession(): Promise<AnonymousSession | null> {
  const fingerprint = createFingerprint();
  
  try {
    // Always try server first (server is source of truth)
    const response = await fetch(`${API_BASE_URL}/anonymous-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fingerprint }),
    });
    
    if (response.ok) {
      const session = await response.json();
      // Update localStorage with server data
      const storageKey = `myba_anon_${fingerprint}`;
      localStorage.setItem(storageKey, JSON.stringify(session));
      return session;
    } else if (response.status === 429) {
      // Rate limited - too many sessions from this IP
      const errorData = await response.json();
      throw new Error(`Rate Limited: ${errorData.error}`);
    } else {
      throw new Error(`Server error: ${response.status}`);
    }
  } catch (error) {
    // If server is completely unavailable, try localStorage as fallback
    const storageKey = `myba_anon_${fingerprint}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const session = JSON.parse(stored);
        // Only use localStorage session if it's not completely used up
        if ((session.tokens - session.used) > 0) {
          console.warn('Using localStorage fallback session due to server error:', error instanceof Error ? error.message : String(error));
          return session;
        }
      } catch (parseError) {
        localStorage.removeItem(storageKey);
      }
    }
    
    // If rate limited or no valid fallback available
    if (error instanceof Error && error.message.includes('Rate Limited')) {
      throw error; // Re-throw rate limiting errors
    }
    
    // Server unavailable and no valid localStorage fallback
    console.error('Cannot create anonymous session:', error);
    return null;
  }
}

// Check if anonymous user has tokens
export async function hasAnonymousTokens(): Promise<boolean> {
  try {
    const session = await getAnonymousSession();
    return session ? (session.tokens - session.used) > 0 : false;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate Limited')) {
      return false; // Rate limited users have no tokens available
    }
    return false;
  }
}

// Use an anonymous token
export async function consumeAnonymousToken(): Promise<boolean> {
  try {
    const session = await getAnonymousSession();
    if (!session) return false;
    
    const remaining = session.tokens - session.used;
    
    if (remaining <= 0) {
      return false;
    }
    
    try {
      // Try to consume token on server first
      const response = await fetch(`${API_BASE_URL}/anonymous-session/consume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: session.id }),
      });
      
      if (response.ok) {
        const result = await response.json();
        // Update local session with server response
        session.used = session.tokens - result.remaining;
        session.lastUsed = Date.now();
        const storageKey = `myba_anon_${session.fingerprint}`;
        localStorage.setItem(storageKey, JSON.stringify(session));
        return true;
      } else {
        console.warn('Server token consumption failed, falling back to local');
      }
    } catch (error) {
      console.warn('Failed to update server session, using local storage');
    }
    
    // Fallback: update localStorage only
    session.used += 1;
    session.lastUsed = Date.now();
    const storageKey = `myba_anon_${session.fingerprint}`;
    localStorage.setItem(storageKey, JSON.stringify(session));
    
    return true;
  } catch (error) {
    console.error('Cannot consume anonymous token:', error);
    return false;
  }
}

// Get anonymous token balance
export async function getAnonymousBalance(): Promise<{ remaining: number; total: number; used: number } | null> {
  try {
    const session = await getAnonymousSession();
    if (!session) return null;
    
    return {
      remaining: session.tokens - session.used,
      total: session.tokens,
      used: session.used
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate Limited')) {
      // Return a special indicator for rate limited users
      return { remaining: 0, total: 0, used: 0 };
    }
    return null;
  }
}

// Check if user should be prompted to sign up
export async function shouldPromptSignup(): Promise<boolean> {
  const balance = await getAnonymousBalance();
  return balance ? balance.remaining <= 1 : true; // Prompt when 1 or fewer tokens left, or no access
}

// Transfer anonymous tokens to authenticated account (bonus for signing up)
export async function transferToAuthenticatedAccount(userId: string): Promise<boolean> {
  try {
    const session = await getAnonymousSession();
    if (!session) return false;
    
    const remaining = session.tokens - session.used;
    if (remaining <= 0) return false;
    
    const response = await fetch(`${API_BASE_URL}/transfer-anonymous-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        sessionId: session.id, 
        userId,
        remainingTokens: remaining 
      }),
    });
    
    if (response.ok) {
      // Clear anonymous session after successful transfer
      const storageKey = `myba_anon_${session.fingerprint}`;
      localStorage.removeItem(storageKey);
      return true;
    }
  } catch (error) {
    console.warn('Failed to transfer anonymous tokens:', error);
  }
  
  return false;
}

// Get rate limiting status for current IP
export async function getRateLimitStatus(): Promise<{
  canCreateNew: boolean;
  sessionsUsed: number;
  maxSessions: number;
  isRateLimited: boolean;
  error?: string;
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/anonymous-status`);
    
    if (response.ok) {
      const data = await response.json();
      return {
        canCreateNew: data.canCreateNew,
        sessionsUsed: data.sessionsUsed,
        maxSessions: data.maxSessions,
        isRateLimited: !data.canCreateNew && data.sessionsUsed >= data.maxSessions
      };
    }
  } catch (error) {
    console.warn('Failed to get rate limit status:', error);
  }
  
  return null;
}