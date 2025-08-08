import React from 'react'
import ReactDOM from 'react-dom/client'
import { HomePage } from './components/HomePage'
import { ClerkProvider } from './components/ClerkProvider'
import { initAnalytics } from './utils/analytics'

// Initialize PostHog Analytics
initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider>
      <HomePage />
    </ClerkProvider>
  </React.StrictMode>,
)