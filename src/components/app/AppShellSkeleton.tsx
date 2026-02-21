interface AppShellSkeletonProps {
  message?: string
}

const shimmerBlock = (width: string | number, height: string | number, radius = 10) => ({
  width,
  height,
  borderRadius: radius,
  background: 'linear-gradient(90deg, var(--glass-highlight), rgba(128,128,128,0.15), var(--glass-highlight))',
  backgroundSize: '220% 100%',
  animation: 'skeletonShimmer 1.35s ease-in-out infinite'
})

export function AppShellSkeleton({ message = 'Loading workspace...' }: AppShellSkeletonProps) {
  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
      background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)'
    }}>
      <aside style={{
        width: '280px',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={shimmerBlock(36, 36, 10)} />
          <div style={shimmerBlock(130, 18, 8)} />
        </div>
        <div style={shimmerBlock(88, 12, 6)} />
        <div style={shimmerBlock('100%', 36, 10)} />
        <div style={shimmerBlock('100%', 36, 10)} />
        <div style={shimmerBlock('100%', 36, 10)} />
        <div style={{ marginTop: 'auto' }}>
          <div style={shimmerBlock('100%', 92, 14)} />
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <header style={{
          background: 'var(--surface-dark)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--glass-border)',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={shimmerBlock(210, 24, 8)} />
            <div style={shimmerBlock(120, 12, 6)} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={shimmerBlock(240, 38, 10)} />
            <div style={shimmerBlock(120, 38, 10)} />
            <div style={shimmerBlock(36, 36, 999)} />
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'hidden', padding: '24px', display: 'flex', gap: '16px' }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <section key={index} style={{
              width: '320px',
              minWidth: '280px',
              borderRadius: '20px',
              padding: '16px',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={shimmerBlock(120, 16, 8)} />
                <div style={shimmerBlock(28, 20, 999)} />
              </div>
              <div style={shimmerBlock('100%', 100, 14)} />
              <div style={shimmerBlock('100%', 100, 14)} />
              <div style={shimmerBlock('100%', 100, 14)} />
            </section>
          ))}
        </div>

        <div style={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 18px',
          borderRadius: '999px',
          background: 'var(--sidebar-active-bg)',
          color: 'var(--sidebar-active-text)',
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0.2px',
          border: '1px solid var(--glass-border)'
        }}>
          {message}
        </div>
      </main>
    </div>
  )
}
