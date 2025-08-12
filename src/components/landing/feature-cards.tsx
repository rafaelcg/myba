export function FeatureCards() {
  return (
    <section id="features" style={{ maxWidth: 1100, margin: '40px auto 120px', padding: '0 20px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20
      }}>
        <Card title="Backlog-ready in seconds" description="Start with a brief and get a well‑formed user story." />
        <Card title="Testable acceptance criteria" description="Clear, verifiable conditions for dev and QA." />
        <Card title="Points and priority suggestions" description="AI-recommended story points and priority to triage faster." />
      </div>
      <style>
        {`
          @media (min-width: 640px) {
            #features { margin: 56px auto 140px; }
          }
          @media (min-width: 1024px) {
            #features { margin: 72px auto 180px; }
          }
        `}
      </style>
    </section>
  )
}

interface CardProps {
  title: string;
  description: string;
}

function Card({ title, description }: CardProps) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 6px 20px rgba(2,6,23,0.04)'
    }}>
      <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#475569', fontSize: 14 }}>{description}</div>
    </div>
  )
}


