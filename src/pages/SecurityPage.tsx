import { Link } from 'react-router-dom'
import { SeoHead } from '../components/SeoHead'

export function SecurityPage() {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '56px 20px 80px', lineHeight: 1.7 }}>
      <SeoHead
        title="Security | MyBA"
        description="MyBA security overview: access control, transport security, operational monitoring, and platform safeguards."
        path="/security"
      />
      <h1>Security</h1>
      <p>MyBA is designed with layered controls to protect user data and maintain platform integrity.</p>
      <h2>Platform controls</h2>
      <p>We use secure transport, authentication controls, and request validation to reduce risk across core product flows.</p>
      <h2>Operational monitoring</h2>
      <p>We monitor application health and logs to detect errors and investigate suspicious activity.</p>
      <h2>Responsible usage</h2>
      <p>Users should avoid submitting sensitive personal data unless required and authorized for their workflow.</p>
      <p><Link to="/">Back to MyBA</Link></p>
    </main>
  )
}
