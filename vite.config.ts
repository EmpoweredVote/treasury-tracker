import { defineConfig, loadEnv, type PluginOption } from 'vite'
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
  const apiTarget = env.VITE_API_URL || 'http://localhost:5050'

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
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // 'hidden' emits maps for upload without a sourceMappingURL comment in the
    // shipped bundles; the plugin deletes them after upload by default.
    build: { sourcemap: posthogSourcemapsEnabled ? ('hidden' as const) : false },
  }
})
