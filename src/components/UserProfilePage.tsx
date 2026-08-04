import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { authClient, useUser, useClerk } from '../lib/auth'

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 14,
    boxSizing: 'border-box' as const
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true
    })
    if (result.error) {
      setMessage({ ok: false, text: result.error.message || 'Could not change password.' })
    } else {
      setMessage({ ok: true, text: 'Password updated.' })
      setCurrentPassword('')
      setNewPassword('')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>Change password</div>
      <input
        type="password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        placeholder="Current password"
        required
        autoComplete="current-password"
        style={inputStyle}
      />
      <input
        type="password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        placeholder="New password (min 8 characters)"
        required
        minLength={8}
        autoComplete="new-password"
        style={inputStyle}
      />
      {message && (
        <div style={{ fontSize: 13, color: message.ok ? '#27ae60' : '#e74c3c' }}>{message.text}</div>
      )}
      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          background: 'white',
          color: '#0f172a',
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? 'wait' : 'pointer'
        }}
      >
        {saving ? 'Saving…' : 'Update password'}
      </button>
    </form>
  )
}

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
            <ChangePasswordForm />
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
