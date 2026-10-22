import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type APIRequestContext } from '@playwright/test';

// Pinned inputs. "Atlanta" matches two places, Atlanta, GA and Atlanta, IN
// (see EmpoweredVote/treasury-tracker#280). Atlanta, GA is the city journeys
// open: its index row has data and 17 fiscal years (2009-2025, checked
// 2026-10-21), so the year journey always has another year to switch to.
export const PINNED_SEARCH = 'Atlanta';
export const PINNED_CITY = { name: 'Atlanta', state: 'GA' } as const;

// Written by global-setup.ts when the preflight fails. Its presence turns every
// journey into a skip ("couldn't run"), so a live-API outage does not block a PR.
export const API_DOWN_MARKER = path.join(path.dirname(fileURLToPath(import.meta.url)), '.api-down');
export const API_DOWN_REASON = "couldn't run — live API down";

// True when the live API, reached through the preview proxy, returns the place
// index (thousands of rows; fewer means the API or its data is broken).
export async function apiIsUp(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get('/api/treasury/cities?fields=index&datasets=summary', {
      timeout: 30_000,
    });
    if (res.status() !== 200) return false;
    const body = await res.json();
    return Array.isArray(body) && body.length > 1000;
  } catch {
    return false;
  }
}

export const test = base.extend<{ guard: void }>({
  // Runs around every test: skips when the preflight failed, blocks analytics,
  // and fails the test on an uncaught page error or a 5xx from our own API —
  // breaks a user would see even when every assertion passed.
  guard: [async ({ page }, use, testInfo) => {
    testInfo.skip(fs.existsSync(API_DOWN_MARKER), API_DOWN_REASON);

    await page.route(/posthog/, (route) => route.abort());

    const problems: string[] = [];
    page.on('pageerror', (err) => problems.push(`Page error: ${err.message}`));
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        problems.push(`API ${res.status()} on ${res.request().method()} ${res.url()}`);
      }
    });

    await use();

    expect(problems, 'The page threw an error or our API failed').toEqual([]);
  }, { auto: true }],
});

export { expect };
