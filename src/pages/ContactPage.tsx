import { Link } from 'react-router-dom'
import { SeoHead } from '../components/SeoHead'

export function ContactPage() {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '56px 20px 80px', lineHeight: 1.7 }}>
      <SeoHead
        title="Contact | MyBA"
        description="Contact the MyBA team for product support, partnerships, and enterprise discussions."
        path="/contact"
      />
      <h1>Contact</h1>
      <p>For support, product questions, or partnership inquiries, reach out to the MyBA team.</p>
      <h2>Email</h2>
      <p><a href="mailto:support@myba.app">support@myba.app</a></p>
      <h2>What to include</h2>
      <p>Share your account email, issue context, and expected outcome so we can resolve your request faster.</p>
      <p><Link to="/">Back to MyBA</Link></p>
    </main>
  )
}
