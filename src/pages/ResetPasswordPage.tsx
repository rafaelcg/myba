import { FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authClient } from '../lib/auth'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const linkError = searchParams.get('error')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const invalidLink = useMemo(() => Boolean(linkError) || !token, [linkError, token])

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
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    setError('')
    const result = await authClient.resetPassword({ newPassword, token: token! })
    if (result.error) {
      setError(result.error.message || 'Could not reset the password. The link may have expired.')
    } else {
      setDone(true)
    }
    setSaving(false)
  }

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
        maxWidth: '400px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        <h2 style={{ margin: '0 0 8px', color: '#2c3e50', fontSize: 22, fontWeight: 600 }}>
          {done ? 'Password updated' : 'Choose a new password'}
        </h2>
        {invalidLink ? (
          <p style={{ color: '#e74c3c', fontSize: 14, lineHeight: 1.6 }}>
            This reset link is invalid or has expired. Head back to the{' '}
            <Link to="/">home page</Link> and request a new one via “Forgot password?”.
          </p>
        ) : done ? (
          <>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
              Your password has been changed. You can now sign in with it.
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                marginTop: 8,
                padding: '10px 20px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              Go to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
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
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Confirm new password"
              required
              minLength={8}
              autoComplete="new-password"
              style={inputStyle}
            />
            {error && <div style={{ fontSize: 13, color: '#e74c3c' }}>{error}</div>}
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '11px 12px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
