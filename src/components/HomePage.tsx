import { useState, useEffect } from 'react';
import { useUser, SignUpButton, useAuth } from '@clerk/clerk-react';
import { InputField } from './InputField';
import { GenerateButton } from './GenerateButton';
import { LoadingSpinner } from './LoadingSpinner';
import { ResultsCard } from './ResultsCard';
import { TokenManager } from './TokenManager';
import { AuthButton } from './AuthButton';
import { AdminDashboard } from './AdminDashboard';
import { generateTicketWithBackend, API_BASE_URL } from '../utils/backendService';
import { TokenPlan } from '../utils/tokenSystem';
import { getAnonymousBalance, hasAnonymousTokens, consumeAnonymousToken, shouldPromptSignup, transferToAuthenticatedAccount } from '../utils/anonymousTokens';
import { GeneratedTicket } from '../utils/mockAI';
import { trackPageView, trackSessionStarted, trackTokenUsed, trackError, trackSignupPromptShown, identifyUser, trackPurchase, trackSignupCompleted } from '../utils/analytics';

type AppState = 'idle' | 'generating' | 'results';
type AIProvider = 'myba' | 'mock';

export function HomePage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [appState, setAppState] = useState<AppState>('idle');
  const [generatedTicket, setGeneratedTicket] = useState<GeneratedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<AIProvider>('myba');
  const [authenticatedTokens, setAuthenticatedTokens] = useState<{tokens: number; used: number; remaining: number} | null>(null);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [anonymousBalance, setAnonymousBalance] = useState<{remaining: number; total: number; used: number} | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<{type: 'success' | 'canceled', tokens?: number} | null>(null);
  const [tokenTransferStatus, setTokenTransferStatus] = useState<{transferred: boolean, tokens: number} | null>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Handle clicking outside mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showMobileMenu && !target.closest('.mobile-menu') && !target.closest('.mobile-menu-toggle')) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMobileMenu]);

  useEffect(() => {
    
    // Check for Stripe payment redirect parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      const tokens = urlParams.get('tokens');
      const planId = urlParams.get('plan_id');
      const amount = urlParams.get('amount');
      
      setPaymentStatus({
        type: 'success',
        tokens: tokens ? parseInt(tokens) : undefined
      });
      
      // Track purchase completion
      if (tokens && planId && amount) {
        trackPurchase(planId, parseFloat(amount), parseInt(tokens), parseInt(tokens));
      }
      
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setPaymentStatus(null);
      }, 5000);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('canceled') === 'true') {
      setPaymentStatus({type: 'canceled'});
      // Auto-dismiss cancel message after 8 seconds
      setTimeout(() => {
        setPaymentStatus(null);
      }, 8000);
      // Clean up URL  
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Force token refresh on successful payment
    const forceRefreshOnPayment = urlParams.get('success') === 'true';
    
    // Load balances based on auth status
    const loadBalances = async () => {
      if (isSignedIn) {
        // Authenticated user - fetch from server
        if (user) {
          try {
            // Retry up to 3 times for payment refreshes (webhook may need time)
            const maxRetries = forceRefreshOnPayment ? 3 : 1;
            let attempt = 0;
            let tokens = null;
            
            while (attempt < maxRetries && !tokens) {
              if (attempt > 0) {
                // Wait 2 seconds before retry (allows webhook to process)
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
              
              const token = await getToken({ template: undefined }).catch(() => null);
              const response = await fetch(`${API_BASE_URL}/user-tokens/${user.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
              });
              if (response.ok) {
                const fetchedTokens = await response.json();
                // On payment success, verify tokens were actually added
                if (!forceRefreshOnPayment || fetchedTokens.tokens > 0) {
                  tokens = fetchedTokens;
                  break;
                }
              }
              attempt++;
            }
            
            if (tokens) {
              setAuthenticatedTokens(tokens);
              setCurrentProvider(tokens.remaining > 0 ? 'myba' : 'mock');
            } else {
              setAuthenticatedTokens({tokens: 0, used: 0, remaining: 0});
              setCurrentProvider('mock');
            }
            setTokensLoading(false);
          } catch (error) {
            console.error('Failed to fetch user tokens:', error);
            setAuthenticatedTokens({tokens: 0, used: 0, remaining: 0});
            setCurrentProvider('mock');
            setTokensLoading(false);
          }
        }
        
        // ONLY attempt token transfer if we have existing anonymous balance from before login
        // This prevents creating new anonymous sessions for already authenticated users
        if (user && anonymousBalance && anonymousBalance.remaining > 0) {
          // Check if we've already transferred tokens for this user session
          const transferKey = `token_transferred_${user.id}`;
          const alreadyTransferred = sessionStorage.getItem(transferKey);
          
          if (!alreadyTransferred) {
            try {
              const tokensToTransfer = anonymousBalance.remaining;
              console.log(`🔄 Attempting to transfer ${tokensToTransfer} anonymous tokens to user ${user.id}`);
              const transferred = await transferToAuthenticatedAccount(user.id);
              if (transferred) {
                console.log(`✅ Successfully transferred anonymous tokens to user ${user.id}`);
                setTokenTransferStatus({ transferred: true, tokens: tokensToTransfer });
                
                // Track signup completion with token transfer
                trackSignupCompleted('unknown', tokensToTransfer, 6);
                
                // Mark as transferred in session storage to prevent repeat transfers
                sessionStorage.setItem(transferKey, 'true');
                
                // Auto-dismiss transfer message after 4 seconds
                setTimeout(() => {
                  setTokenTransferStatus(null);
                }, 4000);
                
                // Refresh token balance to reflect the transfer
                setTimeout(async () => {
                  try {
                    const token = await getToken({ template: undefined }).catch(() => null);
                    const response = await fetch(`${API_BASE_URL}/user-tokens/${user.id}`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : undefined
                    });
                    if (response.ok) {
                      const updatedTokens = await response.json();
                      setAuthenticatedTokens(updatedTokens);
                    }
                  } catch (error) {
                    console.error('Failed to refresh tokens after transfer:', error);
                  }
                }, 1000);
              }
            } catch (error) {
              console.warn('Failed to transfer anonymous tokens:', error);
            }
          }
        }
        
        // Clear anonymous balance when signed in - authenticated users shouldn't have anonymous sessions
        setAnonymousBalance(null);
      } else {
        // Anonymous user - use temporary tokens
        try {
          const anonBalance = await getAnonymousBalance();
          setAnonymousBalance(anonBalance);
          setCurrentProvider(anonBalance && anonBalance.remaining > 0 ? 'myba' : 'mock');
          
          // Check if we should prompt for signup
          const shouldPrompt = await shouldPromptSignup();
          setShowSignupPrompt(shouldPrompt);
        } catch (error) {
          console.error('Failed to get anonymous balance:', error);
          setAnonymousBalance({remaining: 0, total: 0, used: 0});
          setCurrentProvider('mock');
        }
        // Clear authenticated tokens when not signed in
        setAuthenticatedTokens(null);
        setTokensLoading(false);
      }
    };
    
    loadBalances();
  }, [isSignedIn, user]);

  // Determine admin capability on auth changes
  useEffect(() => {
    const checkAdmin = async () => {
      if (!isSignedIn) { setIsAdmin(false); return; }
      try {
        const token = await getToken({ template: undefined }).catch(() => null);
        if (!token) { setIsAdmin(false); return; }
        const resp = await fetch(`${API_BASE_URL}/security/status`, { headers: { Authorization: `Bearer ${token}` } });
        setIsAdmin(resp.ok);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [isSignedIn, user, getToken]);

  // Analytics tracking
  useEffect(() => {
    // Track page view on component mount
    trackPageView('homepage');
    
    // Track session start
    trackSessionStarted(
      window.innerWidth < 768 ? 'mobile' : 'desktop',
      isSignedIn ? 'authenticated' : 'anonymous'
    );
  }, []);

  // Track user identification when they sign in
  useEffect(() => {
    if (isSignedIn && user) {
      identifyUser(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: user.fullName,
        signup_date: user.createdAt,
        plan: 'free'
      });
    }
  }, [isSignedIn, user]);

  const handleGenerate = async () => {
    if (!inputValue.trim() || appState === 'generating') return;
    
    setAppState('generating');
    setError(null);
    
    // Check tokens based on auth status
    let canGenerate = false;
    
    if (isSignedIn) {
      // Authenticated user
      canGenerate = (authenticatedTokens?.remaining ?? 0) > 0;
      if (!canGenerate) {
        setError('No tokens remaining. Purchase more tokens to continue!');
        setAppState('idle');
        return;
      }
    } else {
      // Anonymous user
      canGenerate = await hasAnonymousTokens();
      
      if (!canGenerate) {
        setError('No free tokens remaining. Sign up to get more tokens!');
        setAppState('idle');
        return;
      }
    }
    
    try {
      let ticket: GeneratedTicket;
      let usedProvider: AIProvider = 'mock';

      // Determine which AI service to use
      if (isSignedIn && authenticatedTokens && authenticatedTokens.remaining > 0) {
        // Authenticated user with tokens
        if (user) {
          // Consume token from backend
          const token = await getToken({ template: undefined }).catch(() => null);
          const response = await fetch(`${API_BASE_URL}/user-tokens/${user.id}/consume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
          });
          
          if (response.ok) {
            const result = await response.json();
            ticket = await generateTicketWithBackend(inputValue.trim());
            usedProvider = 'myba';
            // Update local state
            setAuthenticatedTokens(prev => prev ? {
              ...prev,
              used: result.used,
              remaining: result.remaining
            } : null);
            // Track token consumption for authenticated users
            trackTokenUsed(result.remaining, true, false, inputValue.trim().length);
          } else {
            throw new Error('Failed to consume token. Please try again.');
          }
        } else {
          throw new Error('User not found');
        }
      } else if (!isSignedIn && await hasAnonymousTokens()) {
        // Anonymous user with free tokens
        const consumed = await consumeAnonymousToken();
        if (consumed) {
          ticket = await generateTicketWithBackend(inputValue.trim());
          usedProvider = 'myba';
          // Update anonymous balance
          const newBalance = await getAnonymousBalance();
          setAnonymousBalance(newBalance);
          // Track free token usage for anonymous users
          if (newBalance) {
            trackTokenUsed(newBalance.remaining, true, true, inputValue.trim().length);
          }
          // Check if we should now prompt for signup
          const shouldPrompt = await shouldPromptSignup();
          setShowSignupPrompt(shouldPrompt);
          if (shouldPrompt && newBalance) {
            trackSignupPromptShown('low_tokens', newBalance.remaining);
          }
        } else {
          throw new Error('Failed to consume token. Please try again.');
        }
      } else {
        // Fallback to mock templates
        const { generateTicket } = await import('../utils/mockAI');
        ticket = await generateTicket(inputValue.trim());
        usedProvider = 'mock';
      }

      setCurrentProvider(usedProvider);
      setGeneratedTicket(ticket);
      setAppState('results');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate ticket';
      setError(errorMessage);
      setAppState('idle');
      // Track generation errors
      trackError('generation_failed', 'unknown', errorMessage, false);
    }
  };

  const handleStartOver = () => {
    setAppState('idle');
    setInputValue('');
    setGeneratedTicket(null);
    setError(null);
  };


  const handleTokenPurchase = (plan: TokenPlan) => {
    // This will be implemented when payment processing is added
    console.log('Purchase plan:', plan);
  };

  const canGenerate = inputValue.trim().length > 10 && appState === 'idle';
  const needsTokens = isSignedIn && (!authenticatedTokens || authenticatedTokens.remaining === 0) && appState === 'idle';

  const getProviderInfo = () => {
    switch (currentProvider) {
      case 'myba':
        return {
          status: 'MyBA AI',
          color: '#667eea',
          description: 'Powered by our AI service'
        };
      case 'mock':
      default:
        return {
          status: 'Sample Templates',
          color: '#f39c12',
          description: 'Demo mode'
        };
    }
  };

  const providerInfo = getProviderInfo();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: 'relative'
    }}>
      {/* Responsive Navigation */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'nowrap'
      }}>
        {/* Desktop Navigation */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
          {/* Admin (leftmost) */}
          {isSignedIn && isAdmin && (
            <button
              onClick={() => setShowAdminDashboard(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '50%',
                color: 'white',
                width: '48px',
                height: '48px',
                fontSize: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Admin Dashboard"
            >
              👤
            </button>
          )}
          
          
          {/* Token Manager (middle) */}
          {isSignedIn && (
            <button
              onClick={() => setShowTokenManager(true)}
              className="token-button"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '20px',
                color: 'white',
                padding: '8px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Token Manager"
            >
              🎫 {tokensLoading ? '...' : (authenticatedTokens ? `${authenticatedTokens.remaining}` : '0')}
            </button>
          )}
          {/* Auth/User (rightmost) */}
          <AuthButton />
        </div>
        
        {/* Mobile Menu Toggle */}
        <div className="mobile-nav">
          {!isSignedIn && <AuthButton />}
          {isSignedIn && (
            <>
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="mobile-menu-toggle"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '50%',
                  color: 'white',
                  width: '44px',
                  height: '44px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Menu"
              >
                {showMobileMenu ? '✕' : '☰'}
              </button>
              <AuthButton />
            </>
          )}
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
          {showMobileMenu && isSignedIn && (
        <div style={{
          position: 'fixed',
          top: '70px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: '12px',
          padding: '15px',
          zIndex: 1000,
          minWidth: '200px',
          animation: 'slideDown 0.2s ease-out'
        }} className="mobile-menu">
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px' 
          }}>
            <button
              onClick={() => {
                setShowTokenManager(true);
                setShowMobileMenu(false);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              🎫 <span>Tokens ({tokensLoading ? '...' : (authenticatedTokens ? authenticatedTokens.remaining : '0')})</span>
            </button>
            
            {isAdmin && (
              <button
                onClick={() => {
                  setShowAdminDashboard(true);
                  setShowMobileMenu(false);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                👤 <span>Admin Dashboard</span>
              </button>
            )}
            
          </div>
        </div>
      )}

      {/* AI Status & Token Balance - Mobile Optimized */}
      <div style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 100,
        maxWidth: 'calc(100vw - 200px)' // Leave space for right navigation
      }}>
        {/* AI Provider Status */}
        <div style={{
          background: `rgba(${currentProvider === 'myba' ? '102, 126, 234' : '243, 156, 18'}, 0.9)`,
          color: 'white',
          padding: '6px 12px',
          borderRadius: '16px',
          fontSize: '11px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.5s ease-out',
          width: 'fit-content'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            background: currentProvider === 'myba' ? '#667eea' : '#f39c12',
            borderRadius: '50%',
            animation: currentProvider === 'myba' ? 'pulse 2s infinite' : 'none'
          }} />
          {providerInfo.status}
        </div>

        {/* Token Balance */}
        {currentProvider === 'myba' && (
          <div style={{
            background: isSignedIn ? 'rgba(39, 174, 96, 0.9)' : 'rgba(243, 156, 18, 0.9)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '16px',
            fontSize: '11px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backdropFilter: 'blur(10px)',
            cursor: isSignedIn ? 'pointer' : 'default',
            animation: 'fadeIn 0.5s ease-out 0.2s both',
            width: 'fit-content'
          }}
          onClick={isSignedIn ? () => setShowTokenManager(true) : undefined}
          >
            🎫 {isSignedIn 
              ? (tokensLoading ? '...' : (authenticatedTokens ? `${authenticatedTokens.remaining}` : '0')) 
              : (anonymousBalance ? `${anonymousBalance.remaining}` : '0')
            }
          </div>
        )}

        {/* Low Token Warning */}
        {currentProvider === 'myba' && isSignedIn && authenticatedTokens && authenticatedTokens.remaining <= 3 && authenticatedTokens.remaining > 0 && (
          <div style={{
            background: 'rgba(243, 156, 18, 0.9)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '16px',
            fontSize: '11px',
            fontWeight: '600',
            animation: 'pulse 2s infinite',
            width: 'fit-content'
          }}>
            ⚠️ Low
          </div>
        )}
      </div>

      {/* Logo/Title Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: appState === 'results' ? '40px' : '60px',
        animation: 'fadeIn 0.8s ease-out',
        transform: appState === 'results' ? 'scale(0.8)' : 'scale(1)',
        transition: 'all 0.6s ease'
      }}>
        <h1 style={{
          fontSize: appState === 'results' ? 'clamp(2rem, 4vw, 3rem)' : 'clamp(2.5rem, 5vw, 4rem)',
          fontWeight: '300',
          color: 'white',
          margin: '0 0 12px 0',
          letterSpacing: '-0.02em',
          transition: 'font-size 0.6s ease'
        }}>
          MyBA
        </h1>
        <p style={{
          fontSize: appState === 'results' ? 'clamp(0.9rem, 2vw, 1rem)' : 'clamp(1rem, 2.5vw, 1.2rem)',
          color: 'rgba(255, 255, 255, 0.8)',
          margin: '0',
          fontWeight: '400',
          transition: 'font-size 0.6s ease'
        }}>
          Transform ideas into professional tickets
        </p>
      </div>

      {/* Payment Status Messages */}
      {paymentStatus && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          animation: 'slideUp 0.4s ease-out'
        }}>
          {paymentStatus.type === 'success' ? (
            <div style={{
              background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
              color: 'white',
              padding: '20px 24px',
              borderRadius: '16px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(46, 204, 113, 0.4)',
              maxWidth: '400px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                Payment Successful!
              </div>
              <div style={{ fontSize: '14px', marginBottom: '16px', opacity: 0.9 }}>
                {paymentStatus.tokens 
                  ? `${paymentStatus.tokens} tokens have been added to your account`
                  : 'Your tokens have been added to your account'
                }
              </div>
              <button
                onClick={() => setPaymentStatus(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                Got it!
              </button>
            </div>
          ) : (
            <div style={{
              background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
              color: 'white',
              padding: '20px 24px',
              borderRadius: '16px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(231, 76, 60, 0.4)',
              maxWidth: '400px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>😔</div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                Payment Cancelled
              </div>
              <div style={{ fontSize: '14px', marginBottom: '16px', opacity: 0.9 }}>
                No charges were made to your account. You can try again anytime.
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setPaymentStatus(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setPaymentStatus(null);
                    setShowTokenManager(true);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: 'none',
                    color: '#e74c3c',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Token Transfer Success Messages */}
      {tokenTransferStatus && (
        <div style={{
          position: 'fixed',
          top: paymentStatus ? '240px' : '80px', // Position below payment status if both exist
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          animation: 'slideUp 0.4s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            padding: '20px 24px',
            borderRadius: '16px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
            maxWidth: '400px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎁</div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              Welcome Bonus!
            </div>
            <div style={{ fontSize: '14px', marginBottom: '16px', opacity: 0.9 }}>
              Your {tokenTransferStatus.tokens} unused anonymous tokens have been transferred to your account
            </div>
            <button
              onClick={() => setTokenTransferStatus(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Great!
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{
        width: '100%',
        maxWidth: appState === 'results' ? '900px' : '700px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        transition: 'max-width 0.6s ease'
      }}>
        
        {/* Input Section - Hide when showing results */}
        {appState !== 'results' && (
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            animation: appState === 'generating' ? 'fadeOut 0.3s ease-out' : 'slideUp 0.6s ease-out 0.2s both'
          }}>
            <InputField
              value={inputValue}
              onChange={setInputValue}
              disabled={appState === 'generating'}
            />
            
            <GenerateButton
              onClick={handleGenerate}
              disabled={!canGenerate || needsTokens}
              loading={appState === 'generating'}
            />

            {/* Anonymous user signup prompt */}
            {!isSignedIn && showSignupPrompt && anonymousBalance && anonymousBalance.remaining <= 1 && (
              <div style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                padding: '20px 24px',
                borderRadius: '16px',
                textAlign: 'center',
                animation: 'slideUp 0.3s ease-out',
                backdropFilter: 'blur(10px)',
                maxWidth: '500px',
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                  🎉
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                  {anonymousBalance.remaining === 0 
                    ? 'Free tokens used up!' 
                    : `${anonymousBalance.remaining} free token left!`
                  }
                </div>
                <div style={{ fontSize: '14px', marginBottom: '16px', opacity: 0.9 }}>
                  Sign up now to get <strong>3 bonus tokens</strong> + access to purchase more!
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setShowSignupPrompt(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Maybe Later
                  </button>
                  <SignUpButton mode="modal">
                    <button
                      style={{
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        color: '#667eea',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      Sign Up Free 🚀
                    </button>
                  </SignUpButton>
                </div>
              </div>
            )}
            
            {/* Authenticated user token requirement notice */}
            {isSignedIn && needsTokens && (
              <div style={{
                background: 'rgba(243, 156, 18, 0.9)',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                textAlign: 'center',
                animation: 'slideUp 0.3s ease-out',
                backdropFilter: 'blur(10px)',
                maxWidth: '500px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  🎫 No tokens remaining
                </div>
                <div style={{ fontSize: '14px', marginBottom: '16px' }}>
                  Purchase tokens to use our AI service.
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setShowTokenManager(true)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Buy Tokens
                  </button>
                </div>
              </div>
            )}

            {/* AI Mode Indicator */}
            {appState === 'idle' && canGenerate && !needsTokens && (
              <p style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center',
                margin: '-16px 0 0 0',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                {currentProvider === 'myba' && isSignedIn && authenticatedTokens && `🤖 ${authenticatedTokens.remaining} tokens remaining`}
                {currentProvider === 'myba' && !isSignedIn && anonymousBalance && `🤖 ${anonymousBalance.remaining} free tokens remaining`}
                {currentProvider === 'mock' && '🎭 Demo mode - sign up for AI generation'}
              </p>
            )}
          </div>
        )}

        {/* Loading State */}
        {appState === 'generating' && (
          <div>
            <LoadingSpinner />
            <p style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '14px',
              marginTop: '16px',
              animation: 'fadeIn 0.5s ease-out 0.5s both'
            }}>
              {currentProvider === 'myba' && '🤖 MyBA AI is crafting your ticket...'}
              {currentProvider === 'mock' && '🎭 Preparing sample ticket...'}
            </p>
          </div>
        )}

        {/* Results State */}
        {appState === 'results' && generatedTicket && (
          <div style={{ width: '100%' }}>
            <ResultsCard
              title={generatedTicket.title}
              content={generatedTicket.content}
              onStartOver={handleStartOver}
            />
            
            {/* AI Attribution */}
            <div style={{
              textAlign: 'center',
              marginTop: '16px',
              animation: 'fadeIn 0.6s ease-out 0.8s both'
            }}>
              <p style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.6)',
                margin: 0
              }}>
                {currentProvider === 'myba' && '✨ Generated by MyBA AI'}
                {currentProvider === 'mock' && '🎭 Sample template'}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-dialog" style={{
            background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.9), rgba(192, 57, 43, 0.9))',
            color: 'white',
            padding: '20px 24px',
            borderRadius: '16px',
            textAlign: 'center',
            animation: 'slideUp 0.3s ease-out',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(231, 76, 60, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
            <div style={{ 
              marginBottom: '16px', 
              fontSize: '16px', 
              fontWeight: '600',
              lineHeight: '1.4'
            }}>
              {error}
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                Got it
              </button>
              {error.includes('token') && (
                <button
                  onClick={() => {
                    setError(null);
                    setShowTokenManager(true);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: 'none',
                    color: '#e74c3c',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Buy Tokens
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input validation hints */}
        {appState === 'idle' && inputValue.length > 0 && inputValue.length < 10 && (
          <div className="input-hints" style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '12px 16px',
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease-out',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <p style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.8)',
              margin: '0',
              fontWeight: '500'
            }}>
              💡 Add a few more details to create a better ticket ({inputValue.length}/10 characters)
            </p>
          </div>
        )}
        
        {/* Character count for longer inputs */}
        {appState === 'idle' && inputValue.length >= 10 && inputValue.length < 50 && (
          <div style={{
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <p style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.6)',
              margin: '0',
              marginTop: '-8px'
            }}>
              {inputValue.length} characters - looking good! ✨
            </p>
          </div>
        )}
      </div>


      {/* Token Manager Modal */}
      <TokenManager
        isOpen={showTokenManager}
        onClose={() => setShowTokenManager(false)}
        onPurchase={handleTokenPurchase}
      />
      {/* Admin Dashboard Modal */}
      <AdminDashboard
        isOpen={showAdminDashboard}
        onClose={() => setShowAdminDashboard(false)}
      />

      {/* Global styles for animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
          }
          
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          /* Mobile Navigation */
          .desktop-nav {
            display: none;
          }
          
          @media (min-width: 768px) {
            .desktop-nav {
              display: flex !important;
              align-items: center;
              gap: 10px;
            }
            
            .mobile-nav {
              display: none;
            }
          }
          
          @media (max-width: 767px) {
            .mobile-nav {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: nowrap;
            }
            
            /* Ensure mobile nav doesn't wrap or overflow */
            .mobile-nav > * {
              flex-shrink: 0;
            }
            
            /* Mobile improvements */
            .error-dialog {
              margin: 0 10px !important;
              max-width: calc(100vw - 20px) !important;
            }
            
            .input-hints {
              margin: 0 10px !important;
            }
          }
          
          @media (max-width: 480px) {
            /* Very small mobile screens */
            .mobile-nav {
              gap: 6px;
            }
            
            .token-button {
              font-size: 10px !important;
              padding: 6px 8px !important;
            }
          }
          
          * {
            box-sizing: border-box;
          }
          
          body {
            margin: 0;
            padding: 0;
            overflow-x: hidden;
          }
          
          textarea::placeholder {
            color: rgba(0, 0, 0, 0.4);
            transition: opacity 0.3s ease;
          }
          
          textarea:focus::placeholder {
            opacity: 0.6;
          }
          
          ::-webkit-scrollbar {
            width: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: rgba(102, 126, 234, 0.5);
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(102, 126, 234, 0.7);
          }
        `}
      </style>
    </div>
  );
}