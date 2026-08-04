// Better Auth client with a Clerk-compatible surface so existing components
// keep their props/hooks unchanged: useUser, useAuth, useClerk, SignInButton,
// SignUpButton, UserButton. Sessions are cookie-based (same-origin /api/auth
// via the Pages proxy), so getToken returns a placeholder — the Worker
// authenticates requests from the session cookie, not the Authorization header.
import { createAuthClient } from 'better-auth/react';
import {
  CSSProperties,
  FormEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export const authClient = createAuthClient();

interface CompatEmail {
  emailAddress: string;
}

export interface CompatUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  imageUrl: string | null;
  primaryEmailAddress: CompatEmail | null;
  emailAddresses: CompatEmail[];
  createdAt: Date | null;
}

function mapUser(
  u:
    | { id: string; name?: string | null; email?: string | null; image?: string | null; createdAt?: Date | string | null }
    | null
    | undefined
): CompatUser | null {
  if (!u) return null;
  const name = (u.name || '').trim();
  const [firstName, ...rest] = name.split(/\s+/).filter(Boolean);
  const email = u.email ? { emailAddress: u.email } : null;
  return {
    id: u.id,
    firstName: firstName || null,
    lastName: rest.length ? rest.join(' ') : null,
    fullName: name || null,
    imageUrl: u.image || null,
    primaryEmailAddress: email,
    emailAddresses: email ? [email] : [],
    createdAt: u.createdAt ? new Date(u.createdAt) : null,
  };
}

export function useUser() {
  const { data, isPending } = authClient.useSession();
  return {
    isLoaded: !isPending,
    isSignedIn: Boolean(data?.user),
    user: mapUser(data?.user),
  };
}

export function useAuth() {
  const { data, isPending } = authClient.useSession();
  const isSignedIn = Boolean(data?.user);
  return {
    isLoaded: !isPending,
    isSignedIn,
    userId: data?.user?.id ?? null,
    getToken: async (_options?: unknown): Promise<string | null> =>
      isSignedIn ? 'session-cookie' : null,
  };
}

async function signOutAndRedirect(redirectUrl = '/') {
  try {
    await authClient.signOut();
  } finally {
    window.location.assign(redirectUrl);
  }
}

export function useClerk() {
  return {
    signOut: (options?: { redirectUrl?: string }) =>
      signOutAndRedirect(options?.redirectUrl || '/'),
  };
}

type AuthModalMode = 'signIn' | 'signUp';

const AuthModalContext = createContext<{ openAuthModal: (mode: AuthModalMode) => void }>({
  openAuthModal: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [modalMode, setModalMode] = useState<AuthModalMode | null>(null);
  return (
    <AuthModalContext.Provider value={{ openAuthModal: setModalMode }}>
      {children}
      {modalMode && (
        <AuthModal
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSwitchMode={setModalMode}
        />
      )}
    </AuthModalContext.Provider>
  );
}

interface TriggerProps {
  mode?: 'modal' | 'redirect';
  children: ReactNode;
}

export function SignInButton({ children }: TriggerProps) {
  const { openAuthModal } = useContext(AuthModalContext);
  return (
    <span style={{ display: 'contents' }} onClick={() => openAuthModal('signIn')}>
      {children}
    </span>
  );
}

export function SignUpButton({ children }: TriggerProps) {
  const { openAuthModal } = useContext(AuthModalContext);
  return (
    <span style={{ display: 'contents' }} onClick={() => openAuthModal('signUp')}>
      {children}
    </span>
  );
}

interface UserButtonProps {
  appearance?: { elements?: { avatarBox?: { width?: string; height?: string } } };
  showName?: boolean;
  userProfileMode?: string;
  userProfileUrl?: string;
  afterSignOutUrl?: string;
}

export function UserButton({ appearance, userProfileUrl, afterSignOutUrl = '/' }: UserButtonProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  if (!user) return null;

  const size = parseInt(appearance?.elements?.avatarBox?.width || '36', 10) || 36;
  const initials = (user.fullName || user.primaryEmailAddress?.emailAddress || '?')
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const menuItemStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    fontSize: '13px',
    color: '#0f172a',
    cursor: 'pointer',
    textDecoration: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          fontSize: Math.max(11, Math.round(size / 3)),
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initials
        )}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: size + 8,
            minWidth: 220,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(15, 23, 42, 0.06)',
            overflow: 'hidden',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(15, 23, 42, 0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
              {user.fullName || 'Account'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', overflowWrap: 'anywhere' }}>
              {user.primaryEmailAddress?.emailAddress}
            </div>
          </div>
          {userProfileUrl && (
            <a href={userProfileUrl} style={menuItemStyle}>
              Manage account
            </a>
          )}
          <button onClick={() => signOutAndRedirect(afterSignOutUrl)} style={menuItemStyle}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function AuthModal({
  mode,
  onClose,
  onSwitchMode,
}: {
  mode: AuthModalMode;
  onClose: () => void;
  onSwitchMode: (mode: AuthModalMode) => void;
}) {
  const { data } = authClient.useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.user) onClose();
  }, [data?.user, onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const result =
      mode === 'signIn'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: name.trim() || email.split('@')[0],
          });
    if (result.error) {
      setError(result.error.message || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    setError('');
    const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/app' });
    if (result.error) {
      setError(result.error.message || 'Google sign-in is unavailable right now.');
    }
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          width: '100%',
          maxWidth: 400,
          padding: 28,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#2c3e50' }}>
          {mode === 'signIn' ? 'Sign in to MyBA' : 'Create your MyBA account'}
        </h2>
        <p style={{ margin: '6px 0 20px', fontSize: 13, color: '#7f8c8d' }}>
          {mode === 'signIn'
            ? 'Welcome back! Sign in to continue.'
            : 'Start turning ideas into sprint-ready tickets.'}
        </p>

        <button
          onClick={signInWithGoogle}
          type="button"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: 'white',
            fontSize: 14,
            fontWeight: 500,
            color: '#0f172a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '18px 0',
            color: '#94a3b8',
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          or
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signUp' && (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              autoComplete="name"
              style={inputStyle}
            />
          )}
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            type="email"
            required
            autoComplete="email"
            style={inputStyle}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            style={inputStyle}
          />
          {error && (
            <div style={{ fontSize: 13, color: '#e74c3c' }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ margin: '16px 0 0', fontSize: 13, color: '#64748b', textAlign: 'center' }}>
          {mode === 'signIn' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => onSwitchMode('signUp')}
                style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 13, padding: 0 }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onSwitchMode('signIn')}
                style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 13, padding: 0 }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
