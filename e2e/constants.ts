// Shared by the Playwright config and the preview server config.
// E2E_PORT overrides the port when 4173 is taken (another app's journeys, say).
export const PREVIEW_PORT = Number(process.env.E2E_PORT) || 4173;
export const PREVIEW_ORIGIN = `http://localhost:${PREVIEW_PORT}`;
export const QA_USER_AGENT = 'ev-qa-bot/0.1 (+https://github.com/EmpoweredVote/ev-qa)';
