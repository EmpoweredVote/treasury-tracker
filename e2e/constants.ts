// Shared by the Playwright config and the preview server config.
// Not Vite's 4173: Essentials' journeys serve there, and locally Playwright
// reuses whatever already listens on the port. E2E_PORT overrides.
export const PREVIEW_PORT = Number(process.env.E2E_PORT) || 4174;
export const PREVIEW_ORIGIN = `http://localhost:${PREVIEW_PORT}`;
export const QA_USER_AGENT = 'ev-qa-bot/0.1 (+https://github.com/EmpoweredVote/ev-qa)';
