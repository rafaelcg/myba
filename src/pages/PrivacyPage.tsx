import { Link } from 'react-router-dom'
import { SeoHead } from '../components/SeoHead'

export function PrivacyPage() {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '56px 20px 80px', lineHeight: 1.7 }}>
      <SeoHead
        title="Privacy Policy | MyBA"
        description="Learn how MyBA collects, uses, and protects data when you use our AI ticket generation platform."
        path="/privacy"
      />
      <h1>Privacy Policy</h1>
      <p>MyBA helps teams generate product and engineering tickets from prompts. This page explains what information we process and why.</p>
      <h2>Information we collect</h2>
      <p>We process account details, usage events, and prompt content required to generate ticket output and maintain service quality.</p>
      <h2>How we use information</h2>
      <p>We use data to deliver ticket generation, improve reliability, prevent abuse, and support billing for paid usage.</p>
      <h2>Data protection</h2>
      <p>We use industry-standard controls to protect information in transit and at rest, and limit internal access based on role.</p>
      <h2>Contact</h2>
      <p>If you have privacy questions, contact us via the contact page.</p>
      <p><Link to="/">Back to MyBA</Link></p>
    </main>
  )
}
