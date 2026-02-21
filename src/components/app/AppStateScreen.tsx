import { ReactNode } from 'react'

interface AppStateScreenProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function AppStateScreen({ title, description, actions }: AppStateScreenProps) {
  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      flexDirection: 'column',
      gap: '14px',
      textAlign: 'center',
      padding: '24px'
    }}>
      <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{title}</h2>
      {description && <p style={{ margin: 0, fontSize: '14px', opacity: 0.92 }}>{description}</p>}
      {actions && <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}
