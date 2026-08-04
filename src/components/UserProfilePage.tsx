import { Link } from 'react-router-dom'
import { useUser, useClerk } from '../lib/auth'

export function UserProfilePage() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '420px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        {!isLoaded ? (
          <p style={{ color: '#7f8c8d', margin: 0 }}>Loading…</p>
        ) : !user ? (
          <>
            <h2 style={{ margin: '0 0 8px', color: '#2c3e50' }}>Not signed in</h2>
            <p style={{ color: '#7f8c8d', fontSize: 14 }}>
              Head back to the <Link to="/">home page</Link> to sign in.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 20px', color: '#2c3e50', fontSize: 24, fontWeight: 600 }}>
              Account
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>Name</div>
                <div style={{ fontSize: 15, color: '#0f172a' }}>{user.fullName || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>Email</div>
                <div style={{ fontSize: 15, color: '#0f172a', overflowWrap: 'anywhere' }}>
                  {user.primaryEmailAddress?.emailAddress || '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link
                to="/app"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                Open App
              </Link>
              <button
                onClick={() => signOut()}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  color: '#e74c3c',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
