import fs from 'node:fs';
import { request, type FullConfig } from '@playwright/test';
import { apiIsUp, API_DOWN_MARKER, API_DOWN_REASON } from './support';

// Runs once, after the preview server is up and before any journey.
export default async function globalSetup(config: FullConfig) {
  fs.rmSync(API_DOWN_MARKER, { force: true });
  const ctx = await request.newContext({ baseURL: config.projects[0].use.baseURL });
  const up = await apiIsUp(ctx);
  await ctx.dispose();
  if (!up) {
    fs.writeFileSync(API_DOWN_MARKER, `${new Date().toISOString()}\n`);
    console.warn(`Preflight failed: ${API_DOWN_REASON}. Every journey will be skipped.`);
  }
}
