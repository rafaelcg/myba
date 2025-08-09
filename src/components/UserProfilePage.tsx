import { UserProfile } from '@clerk/clerk-react'

export function UserProfilePage() {
  const basePath = import.meta.env.DEV ? '/' : '/myba/';
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
        padding: '16px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
      }}>
        <UserProfile
          routing="path"
          path={`${basePath}user-profile`}
          appearance={{
            elements: {
              card: {
                borderRadius: '16px',
                boxShadow: 'none'
              }
            }
          }}
        />
      </div>
    </div>
  )
}
