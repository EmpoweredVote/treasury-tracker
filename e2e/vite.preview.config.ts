import { defineConfig, type UserConfig } from 'vite';
import baseConfig from '../vite.config';
import { PREVIEW_ORIGIN, PREVIEW_PORT, QA_USER_AGENT } from './constants';

// Serves the built app for the browser journeys with /api proxied to the live
// API. Same-origin on purpose: the live API's CORS allow-list has only the
// production origins, so a build that called it directly from localhost would
// be blocked by the browser.
//
// `npm run e2e:serve` also BUILDS with this config, so the line below aims the
// bundle's API calls at the preview origin, overriding .env.production. Vite
// reads process.env after it loads this file, and process.env beats .env files.
// Set here rather than as `VITE_API_URL=… vite build` in package.json, which
// does not run on Windows.
process.env.VITE_API_URL = PREVIEW_ORIGIN;

export default defineConfig(async (env): Promise<UserConfig> => {
  const base = (typeof baseConfig === 'function' ? await baseConfig(env) : await baseConfig) as UserConfig;
  return {
    ...base,
    preview: {
      port: PREVIEW_PORT,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'https://accounts-api.empowered.vote',
          changeOrigin: true,
          secure: true,
          headers: { 'user-agent': QA_USER_AGENT },
          // Same reason as the dev proxy in vite.config.ts: the live API
          // rejects an Origin that is not on its allow-list.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
          },
        },
      },
    },
  };
});
