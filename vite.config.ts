import { defineConfig, loadEnv, type PluginOption, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// PostHog source-map upload. Inert unless POSTHOG_API_KEY and POSTHOG_PROJECT_ID
// are set at build time (CI / Render build env). See ERROR_TRACKING.md.
const posthogSourcemapsEnabled = Boolean(
  process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID,
)

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev reads the LIVE public API unless told otherwise, so a fresh clone with
  // no .env shows real budgets. In dev the browser always calls same-origin
  // `/api` (src/data/dataLoader.ts); this proxy forwards it. Set VITE_API_URL
  // to aim it at a local ev-accounts (e.g. http://localhost:5050).
  const apiTarget = env.VITE_API_URL || 'https://accounts-api.empowered.vote'

  const apiProxy: ProxyOptions = {
    target: apiTarget,
    changeOrigin: true,
    secure: false,
    // The live API's CORS allow-list excludes localhost and rejects a
    // disallowed Origin, so drop it (same as essentials). Dev only.
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
    },
  }

  const plugins: PluginOption[] = [react(), tailwindcss()]
  if (posthogSourcemapsEnabled) {
    const { default: posthogSourcemaps } = await import('@posthog/rollup-plugin')
    plugins.push(
      posthogSourcemaps({
        personalApiKey: process.env.POSTHOG_API_KEY!,
        projectId: process.env.POSTHOG_PROJECT_ID,
        host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
        sourcemaps: { enabled: true, releaseName: 'treasury-tracker' },
      }) as PluginOption,
    )
  }

  return {
    plugins,
    base: '/', // Root-level deploy (standalone repo)
    server: {
      proxy: {
        '/api': apiProxy,
      },
    },
    // 'hidden' emits maps for upload without a sourceMappingURL comment in the
    // shipped bundles; the plugin deletes them after upload by default.
    build: { sourcemap: posthogSourcemapsEnabled ? ('hidden' as const) : false },
  }
})
