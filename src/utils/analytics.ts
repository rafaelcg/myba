import posthog from 'posthog-js'

export const initAnalytics = () => {
  if (typeof window !== 'undefined') {
    const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
    const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';
    
    if (key) {
      posthog.init(key, {
        api_host: host,
        capture_pageview: false // We'll handle this manually
      });
      console.log('PostHog initialized:', { key: key.substring(0, 10) + '...', host });
    } else {
      console.warn('PostHog key not found');
    }
  }
}

export const trackEvent = (event: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties)
  }
}

// Helper functions for common events
export const trackPageView = (page: string) => {
  trackEvent('page_view', { 
    page,
    referrer: document.referrer,
    user_agent: navigator.userAgent
  })
}

export const trackTokenUsed = (tokensRemaining: number, success: boolean, isAnonymous: boolean = false, promptLength?: number) => {
  trackEvent(isAnonymous ? 'free_token_used' : 'token_consumed', { 
    tokens_remaining: tokensRemaining,
    generation_success: success,
    prompt_length: promptLength,
    timestamp: new Date().toISOString(),
    session_id: isAnonymous ? `anon_${Date.now()}` : undefined
  })
}

export const trackPurchase = (planId: string, amount: number, tokensAfter: number, tokensPurchased: number) => {
  trackEvent('purchase_completed', {
    plan_id: planId,
    amount: amount,
    currency: 'USD',
    tokens_purchased: tokensPurchased,
    tokens_after: tokensAfter
  })
}

export const trackSignupPromptShown = (trigger: 'low_tokens' | 'post_generation', tokensRemaining: number) => {
  trackEvent('signup_prompt_shown', {
    trigger,
    tokens_remaining: tokensRemaining
  })
}

export const trackSignupInitiated = (source: string, tokensRemaining: number) => {
  trackEvent('signup_initiated', {
    source,
    tokens_remaining: tokensRemaining
  })
}

export const trackSignupCompleted = (provider: string, anonymousTokensTransferred: number, welcomeTokensReceived: number) => {
  trackEvent('signup_completed', {
    provider,
    anonymous_tokens_transferred: anonymousTokensTransferred,
    welcome_tokens_received: welcomeTokensReceived
  })
}

export const trackCheckoutStarted = (planId: string, planName: string, price: number, tokens: number) => {
  trackEvent('checkout_started', {
    plan_id: planId,
    plan_name: planName,
    price,
    tokens,
    price_per_token: price / tokens
  })
}

export const trackError = (errorType: string, errorCode?: string, errorMessage?: string, tokensConsumed: boolean = false) => {
  trackEvent('error_occurred', {
    error_type: errorType,
    error_code: errorCode,
    error_message: errorMessage,
    tokens_consumed: tokensConsumed
  })
}

export const trackLowTokensWarning = (tokensRemaining: number, warningType: 'banner' | 'modal', userAction: 'dismissed' | 'clicked_buy') => {
  trackEvent('low_tokens_warning', {
    tokens_remaining: tokensRemaining,
    warning_type: warningType,
    user_action: userAction
  })
}

export const trackPurchaseInitiated = (source: string, tokensRemaining: number) => {
  trackEvent('purchase_initiated', {
    source,
    tokens_remaining: tokensRemaining
  })
}

export const trackSessionStarted = (platform: 'mobile' | 'desktop', userType: 'authenticated' | 'anonymous') => {
  trackEvent('session_started', {
    platform,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    user_type: userType
  })
}

export const trackFeatureUsed = (feature: string, userType: 'authenticated' | 'anonymous') => {
  trackEvent('feature_used', {
    feature,
    user_type: userType
  })
}

export const trackGenerationPerformance = (generationTime: number, model: string, promptTokens: number, completionTokens: number, success: boolean) => {
  trackEvent('generation_performance', {
    generation_time: generationTime,
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    success
  })
}

// User identification for authenticated users
export const identifyUser = (userId: string, properties: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    posthog.identify(userId, properties)
  }
}

// Alias for anonymous users becoming authenticated
export const aliasUser = (distinctId: string) => {
  if (typeof window !== 'undefined') {
    posthog.alias(distinctId)
  }
}