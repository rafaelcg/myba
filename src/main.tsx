import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { UserProfilePage } from './components/UserProfilePage'
import { ClerkProvider } from './components/ClerkProvider'
import { AppShellSkeleton } from './components/app/AppShellSkeleton'
import { initAnalytics } from './utils/analytics'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { SecurityPage } from './pages/SecurityPage'
import { ContactPage } from './pages/ContactPage'
import './index.css'

const AppPage = lazy(async () => {
  const module = await import('./pages/AppPage')
  return { default: module.AppPage }
})

// Initialize PostHog Analytics
initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider>
      <BrowserRouter>
        <Suspense fallback={<AppShellSkeleton message='Opening workspace...' />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/user-profile" element={<UserProfilePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)
