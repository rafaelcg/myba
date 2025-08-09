export function Hero() {
  return (
    <section style={{
      width: '100%',
      background: 'linear-gradient(to bottom, rgba(16,185,129,0.12), rgba(16,185,129,0))',
      padding: 'clamp(80px, 12vw, 200px) 20px clamp(40px, 6vw, 96px) 20px'
    }}>
      <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{
          fontSize: 'clamp(28px, 4.2vw, 48px)',
          lineHeight: 1.1,
          margin: 0,
          color: '#0f172a'
        }}>
          Generate clear Agile tickets with AI
        </h1>
        <p style={{
          color: '#475569',
          marginTop: 12,
          fontSize: 'clamp(14px, 1.6vw, 16px)'
        }}>
          Describe the work. Get a crisp user story, acceptance criteria, and estimates.
        </p>
      </div>
    </section>
  )
}


