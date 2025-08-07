import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react';

export function AuthButton() {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) {
    // Loading state
    return (
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '50%',
        width: '48px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
        zIndex: 100
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderTop: '2px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100
      }}>
        {/* User greeting */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          color: '#2c3e50',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '600',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          Hi, {user.firstName || user.emailAddresses[0]?.emailAddress.split('@')[0]}!
        </div>
        
        {/* User button with profile/logout */}
        <div style={{
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
        }}>
          <UserButton 
            appearance={{
              elements: {
                avatarBox: {
                  width: '48px',
                  height: '48px'
                }
              }
            }}
            showName={false}
            userProfileMode="navigation"
            userProfileUrl="/user-profile"
            afterSignOutUrl="/myba/"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      display: 'flex',
      gap: '12px',
      zIndex: 100
    }}>
      <SignInButton mode="modal">
        <button style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '8px',
          color: 'white',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }}>
          Sign In
        </button>
      </SignInButton>
      
      <SignUpButton mode="modal">
        <button style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
        }}>
          Sign Up
        </button>
      </SignUpButton>
    </div>
  );
}