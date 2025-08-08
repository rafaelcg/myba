import { ClerkProvider as BaseClerkProvider } from '@clerk/clerk-react';
import { ReactNode } from 'react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn('⚠️  Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to .env');
}

interface ClerkProviderProps {
  children: ReactNode;
}

export function ClerkProvider({ children }: ClerkProviderProps) {
  if (!PUBLISHABLE_KEY) {
    // Graceful fallback when Clerk is not configured
    return (
      <div>
        {children}
      </div>
    );
  }

  const isDev = !!import.meta.env.DEV;
  const basePath = isDev ? '/' : '/myba/';

  return (
    <BaseClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      afterSignInUrl={basePath}
      afterSignUpUrl={basePath}
      signInUrl={basePath}
      signUpUrl={basePath}
      appearance={{
        baseTheme: undefined,
        elements: {
          // Match your app's styling
          formButtonPrimary: {
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8, #6a419a)',
            }
          },
          card: {
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          },
          headerTitle: {
            color: '#2c3e50',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '24px',
            fontWeight: '600'
          },
          headerSubtitle: {
            color: '#7f8c8d',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          },
          socialButtonsBlockButton: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '14px',
            fontWeight: '500'
          },
          formFieldLabel: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            color: '#2c3e50'
          },
          formFieldInput: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '14px'
          },
          footerActionLink: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }
        }
      }}
    >
      {children}
    </BaseClerkProvider>
  );
}