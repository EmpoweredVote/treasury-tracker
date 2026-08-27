import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ── Port of checkAuth() as it ships in both sync edge functions ──
 *
 * `supabase/functions/treasury-sync/index.ts` and
 * `supabase/functions/treasury-sync-orchestrator/index.ts` carry byte-identical
 * copies. They are Deno TS and call Deno.serve() at import time, so they cannot be
 * imported here; this mirror exists so the logic cannot drift unnoticed — the same
 * arrangement tests/socrataFilter.test.mjs uses.
 *
 * ── Why this file exists at all ──
 *
 * These functions used to compute their credential as
 *
 *     const SYNC_API_KEY = Deno.env.get("TREASURY_SYNC_API_KEY") || SUPABASE_SERVICE_ROLE_KEY;
 *
 * TREASURY_SYNC_API_KEY is unset on this project, so the service-role key was a
 * valid sync key. Removing that fallback is correct — but doing it naively creates
 * something far worse than what it fixes:
 *
 *     const k = req.headers.get("x-api-key") || "";     // "" when absent
 *     if (k === SYNC_API_KEY) return true;              // "" === "" -> TRUE
 *
 * With no key configured, an anonymous request with NO headers authenticates. That
 * turns a tidy-up into a full auth bypass on an endpoint that writes budget data.
 * The guard is cheap and the failure is catastrophic, so it gets a test.
 */
function makeCheckAuth({ envKey = '', dbKey = '' } = {}) {
  return function checkAuth(headers = {}) {
    const k = headers['x-api-key'] || '';
    const b = (headers['Authorization'] || '').replace('Bearer ', '');
    if (!k && !b) return false;
    if (envKey && (k === envKey || b === envKey)) return true;
    return !!dbKey && (k === dbKey || b === dbKey);
  };
}

describe('sync edge function auth', () => {
  // ── The bypass this guard exists to prevent ──
  it('REFUSES a request with no credentials when no key is configured', () => {
    const auth = makeCheckAuth({ envKey: '', dbKey: '' });
    expect(auth({})).toBe(false);
    expect(auth({ 'x-api-key': '' })).toBe(false);
    expect(auth({ Authorization: '' })).toBe(false);
    expect(auth({ Authorization: 'Bearer ' })).toBe(false);
  });

  it('REFUSES a request with no credentials even when keys ARE configured', () => {
    const auth = makeCheckAuth({ envKey: 'env-key', dbKey: 'vault-key' });
    expect(auth({})).toBe(false);
  });

  it('REFUSES an empty presented key against a configured one', () => {
    const auth = makeCheckAuth({ envKey: 'env-key', dbKey: 'vault-key' });
    expect(auth({ 'x-api-key': '' })).toBe(false);
  });

  // ── The Vault key: the credential that actually matters now ──
  it('accepts the DB (Vault) key via x-api-key', () => {
    const auth = makeCheckAuth({ dbKey: 'vault-key' });
    expect(auth({ 'x-api-key': 'vault-key' })).toBe(true);
  });

  it('accepts the DB (Vault) key via a Bearer token', () => {
    const auth = makeCheckAuth({ dbKey: 'vault-key' });
    expect(auth({ Authorization: 'Bearer vault-key' })).toBe(true);
  });

  it('rejects a wrong key when only the DB key is configured', () => {
    const auth = makeCheckAuth({ dbKey: 'vault-key' });
    expect(auth({ 'x-api-key': 'not-the-key' })).toBe(false);
  });

  // ── The env override ──
  it('accepts the env key when one is set', () => {
    const auth = makeCheckAuth({ envKey: 'env-key', dbKey: 'vault-key' });
    expect(auth({ 'x-api-key': 'env-key' })).toBe(true);
  });

  it('still accepts the DB key when an env key is also set', () => {
    const auth = makeCheckAuth({ envKey: 'env-key', dbKey: 'vault-key' });
    expect(auth({ 'x-api-key': 'vault-key' })).toBe(true);
  });

  it('checks BOTH headers, not just whichever is present first', () => {
    const auth = makeCheckAuth({ envKey: 'env-key', dbKey: 'vault-key' });
    // A wrong x-api-key must not mask a correct Bearer token.
    expect(auth({ 'x-api-key': 'wrong', Authorization: 'Bearer vault-key' })).toBe(true);
    expect(auth({ 'x-api-key': 'wrong', Authorization: 'Bearer env-key' })).toBe(true);
  });

  // ── The old behaviour, now gone ──
  it('does NOT accept the service-role key', () => {
    // Before this change the credential was `TREASURY_SYNC_API_KEY || SERVICE_ROLE_KEY`,
    // so the service-role key authenticated. With the env var unset it now grants
    // nothing: only the Vault key works.
    const auth = makeCheckAuth({ envKey: '', dbKey: 'vault-key' });
    expect(auth({ 'x-api-key': 'service-role-jwt' })).toBe(false);
  });

  it('grants nothing at all when the DB lookup comes back empty', () => {
    // treasury_get_sync_key() returning '' (Vault secret missing) must fail closed.
    const auth = makeCheckAuth({ envKey: '', dbKey: '' });
    expect(auth({ 'x-api-key': 'anything' })).toBe(false);
    expect(auth({ Authorization: 'Bearer anything' })).toBe(false);
  });
});

/**
 * The mirror above is hand-written, so it can drift from the shipped functions.
 * These read the real sources and assert the two properties that matter.
 */
describe('deployed edge functions match this mirror', () => {
  const SOURCES = [
    'supabase/functions/treasury-sync/index.ts',
    'supabase/functions/treasury-sync-orchestrator/index.ts',
  ];

  it.each(SOURCES)('%s has NO service-role fallback for the sync key', (path) => {
    const src = readFileSync(path, 'utf8');
    // The old line, which must never come back:
    //   Deno.env.get("TREASURY_SYNC_API_KEY") || SUPABASE_SERVICE_ROLE_KEY
    const fallback = /Deno\.env\.get\(\s*["']TREASURY_SYNC_API_KEY["']\s*\)\s*\|\|\s*SUPABASE_SERVICE_ROLE_KEY/;
    expect(src).not.toMatch(fallback);
    expect(src).toContain('const ENV_SYNC_KEY = Deno.env.get("TREASURY_SYNC_API_KEY") || "";');
  });

  it.each(SOURCES)('%s refuses empty credentials before comparing', (path) => {
    const src = readFileSync(path, 'utf8');
    expect(src).toContain('if (!k && !b) return false;');
    expect(src).toContain('if (ENV_SYNC_KEY && (k === ENV_SYNC_KEY || b === ENV_SYNC_KEY)) return true;');
    expect(src).toContain('return !!dbKey && (k === dbKey || b === dbKey);');
  });
});
