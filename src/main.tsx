import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'
import posthog from 'posthog-js'
import './index.css'
import App from './App.tsx'

posthog.init('phc_kpUWTjEcRRwSn7zdNstbDVYqAMQvEFZ5EgrWFeaAh5mu', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-01-30',
  person_profiles: 'identified_only',
  capture_pageview: true,
  // Session replay (rrweb) serializes DOM mutations on the main thread. On
  // search inputs that re-render large lists (the jurisdiction picker now spans
  // the full multi-state cohort), that work pegs the main thread on every
  // keystroke — felt as typing-freeze + mouse stutter. Event/pageview capture
  // stays on; only the heavy recorder is disabled. (Same fix applies to other
  // EV apps sharing this init, e.g. Essentials.)
  disable_session_recording: true,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </StrictMode>,
)
