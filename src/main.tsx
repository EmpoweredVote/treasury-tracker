import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'
import { init, getClient } from '@empoweredvote/analytics'
import { AppErrorBoundary } from '@empoweredvote/analytics/react'
import './index.css'
import App from './App.tsx'

// Shared analytics: app + environment auto-stamped, key env-gated (unset locally
// = no-op), exception capture + noise filter built in. See @empoweredvote/analytics.
// NOTE: the deployed env MUST set VITE_POSTHOG_KEY, else analytics is a no-op.
//
// capturePageview:true covers the INITIAL load only — PostHog cannot see the
// history.pushState this SPA navigates with, so App.tsx's syncURL captures a
// pageview itself on every real view change. Both halves are needed; dropping
// either loses arrivals or loses navigations. See utils/spaUrl.ts.
//
// Session replay stays OFF (the package default): rrweb serializes DOM
// mutations on the main thread and pegged it on the jurisdiction picker's
// large re-rendering lists.
init({
  app: 'treasury',
  key: import.meta.env.VITE_POSTHOG_KEY,
  capturePageview: true,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={getClient()}>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
)
