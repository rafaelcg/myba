import React from 'react'
import ReactDOM from 'react-dom/client'
import { HomePage } from './components/HomePage'
import { UserProfilePage } from './components/UserProfilePage'
import { ClerkProvider } from './components/ClerkProvider'
import { initAnalytics } from './utils/analytics'

// Initialize PostHog Analytics
initAnalytics()

const basePath = import.meta.env.DEV ? '/' : '/myba/';
const isUserProfile = window.location.pathname === `${basePath}user-profile` || window.location.pathname === '/user-profile';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider>
      {isUserProfile ? <UserProfilePage /> : <HomePage />}
    </ClerkProvider>
  </React.StrictMode>,
)