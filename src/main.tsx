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
// Treasury captures pageviews automatically and leaves session replay OFF (the
// package default): rrweb serializes DOM mutations on the main thread and pegged
// it on the jurisdiction picker's large re-rendering lists.
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
