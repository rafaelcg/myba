import { Link } from 'react-router-dom'
import { SeoHead } from '../components/SeoHead'

export function TermsPage() {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '56px 20px 80px', lineHeight: 1.7 }}>
      <SeoHead
        title="Terms of Service | MyBA"
        description="Read the terms that govern access and use of MyBA, the AI ticket generator for product teams."
        path="/terms"
      />
      <h1>Terms of Service</h1>
      <p>By using MyBA, you agree to use the service lawfully and in line with these terms.</p>
      <h2>Service usage</h2>
      <p>You are responsible for the prompts and content you submit. You should review generated output before production use.</p>
      <h2>Accounts and billing</h2>
      <p>Paid usage may require a valid payment method. Fees, usage, and plan limits are shown in product experience where applicable.</p>
      <h2>Availability</h2>
      <p>We aim for reliable service but do not guarantee uninterrupted availability.</p>
      <h2>Contact</h2>
      <p>Questions about terms can be sent via the contact page.</p>
      <p><Link to="/">Back to MyBA</Link></p>
    </main>
  )
}
