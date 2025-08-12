import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'

interface NavBarProps {
  isSignedIn: boolean;
  onOpenTokens?: () => void;
  tokensLabel?: string;
}

export function NavBar({ isSignedIn, onOpenTokens, tokensLabel }: NavBarProps) {
  const { isSignedIn: clerkSignedIn } = useUser();
  const basePath = import.meta.env.DEV ? '/' : '/myba/';
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <header style={{ 
      width: '100%', 
      position: 'sticky', 
      top: 0, 
      zIndex: 50, 
      background: 'rgba(255,255,255,0.95)',
      borderBottom: '1px solid rgba(15,23,42,0.06)',
      boxShadow: '0 2px 8px rgba(2,6,23,0.04)'
    }}>
      <div style={{ 
        maxWidth: '1100px', 
        margin: '0 auto', 
        padding: '16px 20px', 
        position: 'relative', 
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMobile ? 'flex-start' : 'center'
      }}>
        {/* Left links */}
        {/* <div style={{ position: 'absolute', left: 20, top: 16, display: 'flex', gap: 16 }}>
          <a href="#" style={{ color: '#334155', textDecoration: 'none', fontSize: 14 }}>Pricing</a>
        </div> */}

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: isMobile ? 'flex-start' : 'center', pointerEvents: 'none' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #10b981, #34d399)' }} />
          <span style={{ fontWeight: 700, color: '#0f172a' }}>MyBA</span>
        </div>

        {/* Right actions */}
        <div style={{ position: 'absolute', right: 20, top: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          {isSignedIn && (
            <button
              onClick={onOpenTokens}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 32,
                lineHeight: '32px',
                background: 'rgba(15,23,42,0.04)',
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: 9999,
                padding: '0 12px',
                fontSize: 12,
                color: '#0f172a'
              }}
            >
              {tokensLabel || 'Tokens'}
            </button>
          )}
          {clerkSignedIn ? (
            <UserButton
              appearance={{ elements: { avatarBox: { width: '36px', height: '36px' } } }}
              showName={false}
              userProfileMode="navigation"
              userProfileUrl={`${basePath}user-profile`}
              afterSignOutUrl={basePath}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SignInButton mode="modal">
                <button style={{
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#0f172a',
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer'
                }}>Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button style={{
                  border: '1px solid transparent',
                  background: '#10b981',
                  color: 'white',
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer'
                }}>Sign up</button>
              </SignUpButton>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}


