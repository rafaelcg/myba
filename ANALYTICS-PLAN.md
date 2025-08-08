# 📊 MyBA Analytics & Tracking Plan

## 🎯 Overview

This document outlines the comprehensive analytics strategy for MyBA's token-based AI ticket generation service. The focus is on tracking critical user journeys to optimize conversion from anonymous users to paying customers.

## 🔍 Critical User Journeys to Track

### 1. Anonymous User Funnel (Acquisition → Trial → Conversion)
```
Landing → Try Free → Generate Ticket → Sign Up → Purchase
```

**Key Metrics:**
- **Acquisition Rate**: Landing page visits → first token usage
- **Trial Conversion**: Free token usage → signup rate  
- **Activation Rate**: Signups → first successful paid generation
- **Anonymous Token Efficiency**: Average tokens used before signup

**Track Events:**
```javascript
posthog.capture('page_view', { 
  page: 'homepage',
  referrer: document.referrer,
  user_agent: navigator.userAgent 
})

posthog.capture('free_token_used', { 
  tokens_remaining: 2,
  session_id: 'anon_xyz',
  prompt_length: 45,
  generation_success: true 
})

posthog.capture('signup_prompt_shown', { 
  trigger: 'low_tokens', // or 'post_generation'
  tokens_remaining: 1 
})

posthog.capture('signup_initiated', { 
  source: 'low_tokens_prompt',
  tokens_remaining: 0 
})

posthog.capture('signup_completed', { 
  provider: 'google', // or 'email', 'github'
  anonymous_tokens_transferred: 3,
  welcome_tokens_received: 6 
})
```

### 2. Authenticated User Journey (Activation → Retention)
```
Sign Up → Welcome → Generate Tickets → Low Tokens → Purchase → Repeat Usage
```

**Key Metrics:**
- **User Activation**: % users who generate ≥1 paid ticket within 24h
- **Token Consumption Rate**: Average tokens used per session
- **Purchase Conversion**: Low tokens warning → purchase rate
- **User Retention**: D1, D7, D30 retention rates
- **Customer Lifetime Value**: Total revenue per user cohort

**Track Events:**
```javascript
posthog.capture('user_activated', { 
  first_paid_generation: true,
  time_to_activation: '00:05:23',
  tokens_consumed: 1 
})

posthog.capture('token_consumed', { 
  tokens_before: 5,
  tokens_after: 4,
  generation_success: true,
  model: 'openai/gpt-oss-20b',
  prompt_length: 67,
  response_length: 1500 
})

posthog.capture('low_tokens_warning', { 
  tokens_remaining: 3,
  warning_type: 'banner', // or 'modal'
  user_action: 'dismissed' // or 'clicked_buy'
})

posthog.capture('purchase_initiated', { 
  source: 'low_tokens_warning', // or 'token_manager'
  tokens_remaining: 1 
})
```

### 3. Revenue & Business Metrics
```
Traffic → Trial → Paid Conversion → LTV → Churn
```

**Key Metrics:**
- **Conversion Funnel**: Anonymous → Trial → Paid → Repeat
- **Plan Performance**: Which token packages convert best
- **Revenue per User**: Average revenue by user segment
- **Churn Analysis**: When and why users stop using the service
- **Price Sensitivity**: Response to different pricing experiments

**Track Events:**
```javascript
posthog.capture('checkout_started', { 
  plan_id: 'starter-10',
  plan_name: 'Starter Pack',
  price: 5.99,
  tokens: 10,
  price_per_token: 0.599 
})

posthog.capture('purchase_completed', { 
  plan_id: 'starter-10',
  amount: 5.99,
  currency: 'USD',
  payment_method: 'card',
  stripe_session_id: 'cs_xyz',
  tokens_purchased: 10,
  tokens_before: 0,
  tokens_after: 10 
})

posthog.capture('revenue', { 
  amount: 5.99,
  plan: 'starter-10',
  user_ltv: 5.99, // cumulative
  purchase_number: 1 // 1st, 2nd, 3rd purchase
})

posthog.capture('user_churned', { 
  last_activity: '2025-07-25',
  total_tokens_purchased: 50,
  total_tokens_used: 47,
  total_revenue: 24.99,
  churn_reason: 'inactivity_30d' 
})
```

### 4. Product Experience & Issues
```
Usage → Friction Points → Errors → Support Needs
```

**Key Metrics:**
- **Error Rate**: Failed generations, payment failures, technical issues  
- **User Experience**: Session duration, feature usage, mobile vs desktop
- **Performance**: Generation speed, uptime, user satisfaction
- **Support Impact**: Error types that require user intervention

**Track Events:**
```javascript
posthog.capture('error_occurred', { 
  error_type: 'generation_failed',
  error_code: 'insufficient_tokens',
  error_message: 'No tokens remaining',
  user_action: 'clicked_buy_tokens',
  tokens_consumed: true // if token was lost
})

posthog.capture('session_started', { 
  platform: 'mobile', // or 'desktop'
  viewport: '375x667',
  user_type: 'authenticated' // or 'anonymous'
})

posthog.capture('feature_used', { 
  feature: 'token_manager',
  user_type: 'authenticated',
  session_duration: '00:03:45' 
})

posthog.capture('generation_performance', { 
  generation_time: 8.5, // seconds
  model: 'openai/gpt-oss-20b',
  prompt_tokens: 45,
  completion_tokens: 1200,
  success: true 
})
```

## 📈 Analytics Platform Recommendation: PostHog

### Why PostHog?
✅ **Self-hosted option** - Keep sensitive data on your infrastructure  
✅ **Event tracking + Session replay** - See exactly what users experience  
✅ **Funnel analysis** - Perfect for conversion optimization  
✅ **Cohort analysis** - Track user groups over time  
✅ **Feature flags** - A/B testing capabilities  
✅ **Free tier** - 1M events/month (sufficient for initial growth)  
✅ **React integration** - Easy implementation with existing stack  
✅ **Privacy-focused** - GDPR compliant, user data control  

### Alternative Platforms Considered:
- **Mixpanel** - Excellent for events but higher cost at scale
- **Amplitude** - Powerful analytics but complex setup and expensive  
- **Plausible** - Privacy-focused but limited SaaS-specific features
- **Google Analytics 4** - Free but inadequate for detailed SaaS metrics

## 🚀 Implementation Plan

### Phase 1: Core Tracking (Week 1-2)
**Goal**: Establish basic funnel tracking and revenue metrics

**Priority Events**:
1. `page_view` - Track traffic sources and pages
2. `free_token_used` - Anonymous user engagement  
3. `signup_completed` - Registration conversion
4. `purchase_completed` - Revenue tracking
5. `token_consumed` - Core product usage
6. `error_occurred` - Critical issue identification

**Success Metrics**:
- Track complete anonymous → paid user funnel
- Identify top conversion bottlenecks
- Monitor daily/weekly revenue trends
- Catch and resolve critical errors quickly

### Phase 2: Advanced Analytics (Week 3-4)
**Goal**: Deep user behavior analysis and optimization

**Advanced Features**:
- **User Cohorts**: Group users by signup date, source, behavior
- **Session Replays**: Watch failed purchase attempts and user struggles  
- **Funnel Analysis**: Conversion rates at each step with drop-off points
- **Retention Analysis**: D1, D7, D30 user return rates

**Advanced Events**:
- `session_duration` - Engagement depth
- `feature_usage` - Which features drive retention
- `user_segment` - Categorize users (power users, casual, churned)
- `experiment_viewed` - A/B testing foundation

### Phase 3: Business Intelligence (Week 5-6)
**Goal**: Strategic insights and growth optimization

**Dashboards**:
- **Revenue Dashboard**: MRR, LTV, plan performance
- **User Health**: Activation, retention, churn prediction
- **Product Performance**: Generation success rates, model efficiency
- **Growth Funnel**: Source attribution, conversion optimization

**Advanced Analysis**:
- **Cohort LTV**: Revenue per user group over time
- **Churn Prediction**: Identify at-risk users for retention campaigns
- **Price Optimization**: Test different token package pricing
- **Feature Impact**: Which features drive the most value

## 📊 Key Dashboards to Create

### 1. Executive Dashboard
- **Daily Active Users** (Anonymous + Authenticated)
- **Monthly Recurring Revenue** (MRR growth)
- **Conversion Rate** (Anonymous → Paid)
- **Customer Acquisition Cost** (CAC)
- **Lifetime Value** (LTV)

### 2. Product Dashboard  
- **Token Usage Metrics** (Consumption patterns, waste)
- **Generation Success Rate** (AI performance)
- **Feature Usage** (Token Manager, Admin Dashboard)
- **Error Rates** (Failed generations, payment issues)
- **User Experience** (Session duration, mobile vs desktop)

### 3. Growth Dashboard
- **Traffic Sources** (Referrals, direct, organic)
- **Signup Funnel** (Landing → Trial → Paid)
- **Retention Cohorts** (User stickiness over time)
- **Churn Analysis** (Why users leave, when they leave)

## 🎯 Success Metrics & KPIs

### Acquisition Metrics
- **Traffic Conversion**: Visitors → Anonymous token users (Target: >15%)
- **Trial Conversion**: Anonymous users → Signups (Target: >25%)  
- **Activation Rate**: Signups → First paid generation (Target: >60%)

### Revenue Metrics  
- **Anonymous → Paid**: Free users → Purchase (Target: >10%)
- **Average Order Value**: Revenue per purchase (Current: ~$15)
- **Customer LTV**: Total revenue per user (Target: >$50)
- **Monthly Recurring Revenue**: Growth rate (Target: 20% MoM)

### Product Metrics
- **Generation Success**: AI completions without errors (Target: >95%)
- **Token Efficiency**: Successful generations per token (Target: >90%)
- **User Retention**: D30 retention rate (Target: >40%)
- **Session Quality**: Time to first generation (Target: <2 min)

## 🔧 Technical Implementation

### PostHog Setup
```bash
# Install PostHog
npm install posthog-js

# Environment variables
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### React Integration
```javascript
// src/utils/analytics.ts
import posthog from 'posthog-js'

export const initAnalytics = () => {
  if (typeof window !== 'undefined') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: false // We'll handle this manually
    })
  }
}

export const trackEvent = (event: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties)
  }
}

// Helper functions for common events
export const trackPageView = (page: string) => {
  trackEvent('page_view', { page })
}

export const trackTokenUsed = (tokensRemaining: number, success: boolean) => {
  trackEvent('token_consumed', { 
    tokens_remaining: tokensRemaining,
    generation_success: success,
    timestamp: new Date().toISOString()
  })
}

export const trackPurchase = (planId: string, amount: number) => {
  trackEvent('purchase_completed', {
    plan_id: planId,
    amount: amount,
    currency: 'USD'
  })
}
```

### User Identification
```javascript
// Identify users after signup
useEffect(() => {
  if (isSignedIn && user) {
    posthog.identify(user.id, {
      email: user.emailAddresses[0]?.emailAddress,
      name: user.fullName,
      signup_date: user.createdAt,
      plan: 'free' // or current plan
    })
  }
}, [isSignedIn, user])
```

## 🚦 Privacy & Compliance

### Data Collection Principles
- **Minimal Collection**: Only track events essential for product improvement
- **User Consent**: Implement cookie consent for EU users
- **Data Retention**: Automatically delete old analytical data
- **Anonymization**: Hash or pseudonymize PII when possible

### GDPR Compliance
- **Cookie Banner**: Inform users about tracking
- **Opt-out Mechanism**: Allow users to disable analytics
- **Data Export**: Provide user data downloads on request
- **Right to Deletion**: Remove user data when requested

## 📅 Implementation Timeline

### Week 1: Foundation
- [ ] Set up PostHog account and integration  
- [ ] Implement core 6 tracking events
- [ ] Test tracking in development environment
- [ ] Deploy basic tracking to production

### Week 2: Optimization
- [ ] Create initial dashboards for key metrics
- [ ] Set up automated alerts for critical issues
- [ ] Implement user identification and segmentation  
- [ ] Add session replay for conversion analysis

### Week 3: Advanced Features  
- [ ] Build comprehensive funnel analysis
- [ ] Set up cohort tracking for retention
- [ ] Implement A/B testing framework
- [ ] Create automated reports for stakeholders

### Week 4: Business Intelligence
- [ ] Revenue and LTV analysis dashboards
- [ ] Churn prediction and user health scoring
- [ ] Performance optimization based on data insights
- [ ] Documentation and team training

## 🎯 Expected Outcomes

After implementing this analytics plan, you should be able to:

✅ **Understand Your Funnel**: See exactly where users drop off  
✅ **Optimize Conversion**: A/B test pricing, messaging, and UX  
✅ **Predict Revenue**: Forecast growth based on user behavior  
✅ **Reduce Churn**: Identify and re-engage at-risk users  
✅ **Improve Product**: Data-driven feature development  
✅ **Scale Efficiently**: Know which channels drive best ROI  

---

## 🚀 Ready to Implement?

This analytics foundation will provide **deep insights** into user behavior and business performance. The PostHog implementation will give you:

- **Real user session replays** to see exactly what works and what doesn't
- **Conversion funnel analysis** to optimize your anonymous → paid journey  
- **Cohort retention analysis** to predict long-term growth
- **Revenue tracking** to understand unit economics

**Next Step**: Begin Phase 1 implementation with the core 6 events to start gathering actionable data immediately!

---
*Created: August 8, 2025*  
*Implementation Priority: High - Essential for growth optimization*