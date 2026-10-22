import fs from 'node:fs';
import { request, type FullConfig } from '@playwright/test';
import { apiIsUp, API_DOWN_MARKER, API_DOWN_REASON } from './support';

// Runs once, after the preview server is up and before any journey.
export default async function globalSetup(config: FullConfig) {
  fs.rmSync(API_DOWN_MARKER, { force: true });
  const ctx = await request.newContext({ baseURL: config.projects[0].use.baseURL });
  // Locally Playwright reuses any server already on the port. If that is some
  // other app, every journey would skip as "API down" and the run would look
  // green, so stop loudly instead.
  const home = await (await ctx.get('/')).text();
  if (!home.includes('<title>Treasury Tracker')) {
    await ctx.dispose();
    throw new Error(`${config.projects[0].use.baseURL} is not serving Treasury Tracker. Stop that server or set E2E_PORT.`);
  }
  const up = await apiIsUp(ctx);
  await ctx.dispose();
  if (!up) {
    fs.writeFileSync(API_DOWN_MARKER, `${new Date().toISOString()}\n`);
    console.warn(`Preflight failed: ${API_DOWN_REASON}. Every journey will be skipped.`);
  }
}
