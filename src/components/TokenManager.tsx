import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { getTokenBalance, TokenBalance, getUsageStats, isNewUser, addTokens } from '../utils/tokenSystem';
import { API_BASE_URL } from '../utils/backendService';
import { trackCheckoutStarted, trackPurchaseInitiated } from '../utils/analytics';

interface TokenPlan {
  id: string;
  name: string;
  tokens: number;
  price: number;
  originalPrice?: number;
  description: string;
  popular?: boolean;
  features: string[];
  color: string;
  pricePerToken?: number;
}

interface TokenManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase?: (plan: TokenPlan) => void;
}

export function TokenManager({ isOpen, onClose }: TokenManagerProps) {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [balance, setBalance] = useState<TokenBalance>(getTokenBalance());
  const [authenticatedTokens, setAuthenticatedTokens] = useState<{tokens: number; used: number; remaining: number} | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<TokenPlan | null>(null);
  const [showPurchaseFlow, setShowPurchaseFlow] = useState(false);
  const [stats, setStats] = useState(getUsageStats());
  const [plans, setPlans] = useState<TokenPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isSignedIn && user) {
        fetchUserTokens();
      } else {
        setBalance(getTokenBalance());
      }
      setStats(getUsageStats());
      fetchPlans();
    }
  }, [isOpen, isSignedIn, user]);

  const fetchUserTokens = async () => {
    if (!user) return;
    
    try {
      const token = await getToken({ template: undefined }).catch(() => null);
      const response = await fetch(`${API_BASE_URL}/user-tokens/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (response.ok) {
        const tokens = await response.json();
        console.log('TokenManager: Received token data:', tokens);
        setAuthenticatedTokens(tokens);
        
        // Update stats with real data from authenticated tokens
        if (tokens.purchased !== undefined) {
          const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date('2025-08-07').getTime()) / (1000 * 60 * 60 * 24)));
          const newStats = {
            totalGenerated: tokens.used || 0,
            totalPurchased: tokens.purchased || 0,
            averagePerDay: Math.round((tokens.used || 0) / daysSinceStart * 10) / 10
          };
          console.log('TokenManager: Setting stats:', newStats);
          setStats(newStats);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user tokens:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/plans?first_purchase=${isNewUser()}&user_id=${user?.id || 'anonymous'}`);
      if (!response.ok) throw new Error('Failed to fetch plans');
      
      const data = await response.json();
      setPlans(data.plans);
      setStripeEnabled(data.stripeEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan: TokenPlan) => {
    if (!stripeEnabled) {
      // Simulate purchase for development
      setSelectedPlan(plan);
      setShowPurchaseFlow(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Track checkout initiated
      trackCheckoutStarted(plan.id, plan.name, plan.price, plan.tokens);
      trackPurchaseInitiated('token_manager', authenticatedTokens?.remaining || 0);

      const response = await fetch(`${API_BASE_URL}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.id,
          userContext: {
            isFirstPurchase: isNewUser(),
            userId: user?.id || 'anonymous'
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to create payment session');

      const data = await response.json();
      
      if (data.simulatedPayment) {
        // Handle simulated payment
        setSelectedPlan(plan);
        setShowPurchaseFlow(true);
      } else {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedPurchase = async (plan: TokenPlan) => {
    if (isSignedIn && user) {
      // For authenticated users, simulate adding tokens to backend
      try {
        // Simulate the purchase by calling the backend
        // In real implementation, this would be handled by Stripe webhooks
        alert(`✅ Simulated purchase successful!\n+${plan.tokens} tokens would be added to your account via Stripe.`);
        await fetchUserTokens(); // Refresh the token balance
      } catch (error) {
        console.error('Failed to simulate purchase:', error);
      }
    } else {
      // For anonymous users, use local storage
      addTokens(plan.tokens, plan.id);
      setBalance(getTokenBalance());
      alert(`✅ Simulated purchase successful!\n+${plan.tokens} tokens added to your account.`);
    }
    
    setShowPurchaseFlow(false);
    setSelectedPlan(null);
  };

  // Removed unused getBalanceColor function

  const getBalanceStatus = () => {
    const remaining = isSignedIn ? (authenticatedTokens?.remaining || 0) : balance.remaining;
    if (remaining === 0) return 'No tokens remaining';
    if (remaining <= 3) return 'Running low';
    if (remaining >= 50) return 'Plenty of tokens';
    return 'Active';
  };


  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 1000,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: showPurchaseFlow ? '800px' : '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          <div>
            <h2 style={{
              color: '#2c3e50',
              fontSize: '28px',
              fontWeight: '700',
              margin: '0 0 4px 0'
            }}>
              🎫 Token Manager
            </h2>
            <p style={{
              color: '#7f8c8d',
              margin: 0,
              fontSize: '14px'
            }}>
              Manage your AI generation credits
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#95a5a6',
              padding: '8px',
              borderRadius: '50%',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8f9fa';
              e.currentTarget.style.color = '#2c3e50';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#95a5a6';
            }}
          >
            ✕
          </button>
        </div>

        {!showPurchaseFlow ? (
          <>
            {/* Current Balance */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              marginBottom: '32px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    margin: '0 0 4px 0'
                  }}>
                    Current Balance
                  </h3>
                  <p style={{
                    opacity: 0.9,
                    margin: 0,
                    fontSize: '14px'
                  }}>
                    {getBalanceStatus()}
                  </p>
                </div>
                <div style={{
                  textAlign: 'right'
                }}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '700',
                    lineHeight: 1
                  }}>
                    {isSignedIn ? (authenticatedTokens?.remaining || 0) : balance.remaining}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    opacity: 0.8
                  }}>
                    tokens left
                  </div>
                </div>
              </div>
              
              {/* Progress bar */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                height: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  height: '100%',
                  width: `${isSignedIn 
                    ? ((authenticatedTokens?.remaining || 0) / (authenticatedTokens?.tokens || 1)) * 100
                    : (balance.remaining / balance.total) * 100}%`,
                  borderRadius: '8px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '12px',
                opacity: 0.8
              }}>
                <span>Used: {isSignedIn ? (authenticatedTokens?.used || 0) : balance.used}</span>
                <span>Total: {isSignedIn ? (authenticatedTokens?.tokens || 0) : balance.total}</span>
              </div>
            </div>

            {/* New User Welcome */}
            {isNewUser() && (
              <div style={{
                background: '#e8f5e8',
                border: '1px solid #27ae60',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h4 style={{
                  color: '#27ae60',
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: '0 0 8px 0'
                }}>
                  🎉 Welcome to MyBA!
                </h4>
                <p style={{
                  color: '#2d5a2d',
                  fontSize: '14px',
                  margin: 0
                }}>
                  You have <strong>3 free tokens</strong> to try our AI ticket generator. 
                  Each token generates one professional ticket!
                </p>
              </div>
            )}

            {/* Usage Stats */}
            <div style={{
              background: '#f8f9fa',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '32px'
            }}>
              <h4 style={{
                color: '#2c3e50',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 16px 0'
              }}>
                📊 Usage Statistics
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '16px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#667eea'
                  }}>
                    {stats.totalGenerated}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#7f8c8d'
                  }}>
                    Tickets Generated
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#27ae60'
                  }}>
                    {stats.totalPurchased}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#7f8c8d'
                  }}>
                    Tokens Purchased
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#f39c12'
                  }}>
                    {stats.averagePerDay}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#7f8c8d'
                  }}>
                    Daily Average
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Plans */}
            <div>
              <h4 style={{
                color: '#2c3e50',
                fontSize: '18px',
                fontWeight: '600',
                margin: '0 0 20px 0'
              }}>
                💳 Purchase More Tokens
              </h4>
              
              {loading && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#7f8c8d'
                }}>
                  Loading plans...
                </div>
              )}
              
              {error && (
                <div style={{
                  background: '#ffe6e6',
                  border: '1px solid #ff9999',
                  borderRadius: '8px',
                  padding: '16px',
                  color: '#cc0000',
                  textAlign: 'center'
                }}>
                  {error}
                  <button 
                    onClick={fetchPlans}
                    style={{
                      marginLeft: '12px',
                      background: 'none',
                      border: '1px solid #cc0000',
                      color: '#cc0000',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px'
              }}>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    style={{
                      border: plan.popular ? '2px solid #667eea' : '1px solid #e9ecef',
                      borderRadius: '12px',
                      padding: '20px',
                      position: 'relative',
                      background: plan.popular ? '#f8f9ff' : 'white',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => handlePurchase(plan)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {plan.popular && (
                      <div style={{
                        position: 'absolute',
                        top: '-8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#667eea',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        POPULAR
                      </div>
                    )}
                    
                    <div style={{
                      textAlign: 'center',
                      marginBottom: '16px'
                    }}>
                      <h5 style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#2c3e50',
                        margin: '0 0 4px 0'
                      }}>
                        {plan.name}
                      </h5>
                      <p style={{
                        color: '#7f8c8d',
                        fontSize: '14px',
                        margin: 0
                      }}>
                        {plan.description}
                      </p>
                    </div>
                    
                    <div style={{
                      textAlign: 'center',
                      marginBottom: '20px'
                    }}>
                      {plan.originalPrice && plan.originalPrice > plan.price && (
                        <div style={{
                          fontSize: '18px',
                          color: '#7f8c8d',
                          textDecoration: 'line-through',
                          marginBottom: '4px'
                        }}>
                          ${plan.originalPrice}
                        </div>
                      )}
                      <div style={{
                        fontSize: '36px',
                        fontWeight: '700',
                        color: plan.originalPrice && plan.originalPrice > plan.price ? '#27ae60' : '#2c3e50'
                      }}>
                        ${plan.price}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#7f8c8d'
                      }}>
                        {plan.tokens} tokens
                        {plan.pricePerToken && (
                          <span style={{ fontSize: '12px', marginLeft: '8px' }}>
                            (${plan.pricePerToken}/token)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <ul style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '0 0 20px 0'
                    }}>
                      {plan.features.map((feature, index) => (
                        <li key={index} style={{
                          fontSize: '14px',
                          color: '#2c3e50',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ color: '#27ae60' }}>✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <button 
                      onClick={() => handlePurchase(plan)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: plan.popular 
                          ? 'linear-gradient(135deg, #667eea, #764ba2)'
                          : 'linear-gradient(135deg, #95a5a6, #7f8c8d)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      {loading ? 'Processing...' : (stripeEnabled ? 'Purchase Now' : 'Simulate Purchase')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Simulated Purchase Flow */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>
              {stripeEnabled ? '🔒' : '🎯'}
            </div>
            <h3 style={{
              color: '#2c3e50',
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '16px'
            }}>
              {stripeEnabled ? 'Secure Payment' : 'Simulated Purchase'}
            </h3>
            <p style={{
              color: '#7f8c8d',
              fontSize: '16px',
              marginBottom: '32px'
            }}>
              {stripeEnabled ? (
                <>
                  You'll be redirected to Stripe for secure payment processing.
                  <br />
                  Your tokens will be added automatically after payment.
                </>
              ) : (
                <>
                  Stripe is not configured - this will simulate a successful purchase.
                  <br />
                  Tokens will be added to your account immediately.
                </>
              )}
            </p>
            
            {selectedPlan && (
              <div style={{
                background: '#f8f9fa',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                border: '2px solid #667eea'
              }}>
                <h4 style={{ 
                  color: '#2c3e50', 
                  marginBottom: '12px',
                  fontSize: '20px'
                }}>
                  {selectedPlan.name}
                </h4>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <span style={{ color: '#7f8c8d' }}>
                    {selectedPlan.tokens} tokens
                  </span>
                  <span style={{ 
                    fontSize: '24px', 
                    fontWeight: '700', 
                    color: selectedPlan.originalPrice && selectedPlan.originalPrice > selectedPlan.price ? '#27ae60' : '#2c3e50'
                  }}>
                    ${selectedPlan.price}
                  </span>
                </div>
                {selectedPlan.originalPrice && selectedPlan.originalPrice > selectedPlan.price && (
                  <div style={{
                    background: '#e8f5e8',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    color: '#27ae60',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    💰 Save ${(selectedPlan.originalPrice - selectedPlan.price).toFixed(2)}!
                  </div>
                )}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowPurchaseFlow(false)}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#7f8c8d',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Back to Plans
              </button>
              
              {selectedPlan && (
                <button
                  onClick={() => stripeEnabled ? handlePurchase(selectedPlan) : handleSimulatedPurchase(selectedPlan)}
                  disabled={loading}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? 'Creating Session...' : (stripeEnabled ? 'Proceed to Stripe' : 'Simulate Purchase')}
                </button>
              )}
            </div>
          </div>
        )}

        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(30px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>
      </div>
    </div>
  );
}