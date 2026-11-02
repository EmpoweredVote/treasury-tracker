/**
 * The gate itself: treasury_sync_city_budget refuses an unregistered family
 * and a new row with no link, and writes nothing when it does.
 *
 * ⚠⚠ THIS NEEDS A DATABASE AND SKIPS LOUDLY WITHOUT ONE. The repo keeps no
 * service-role key in Actions on purpose (PR #90 — such a key bypasses RLS),
 * so in CI these skip. Run locally with the key exported:
 *
 *   SUPABASE_SERVICE_KEY=... npx vitest run tests/registryGateRpc.test.mjs
 *
 * ⚠ The RPC is the only chokepoint 34 call sites share, so this is where the
 * gate has to live. A JS-side guard would be 34 edits with nothing stopping
 * the 35th loader.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { classifySyncResult } from '../scripts/lib/rpcResult.mjs';

const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const REASON = 'no SUPABASE_SERVICE_KEY — the gate was not exercised';

// A municipality that exists, so the only thing under test is the gate.
let client = null;
let muniId = null;

const UNREGISTERED = 'ZZZ Gate Test Family — not a real publisher';
// ⚠ Must be registered AND ABSENT from the database. Ohio AOS is registered
// but has 6,616 rows, so it is grandfathered and the link rule does not reach
// it — using it here tested nothing. The NY OSC pattern is `FY\d{4}`, so a
// year nobody has ever loaded matches the registry while being a new family.
const REGISTERED = 'New York OSC Town Annual Financial Report — Revenues, '
  + 'General Fund (FY1950 actual, self-reported)';
const TEST_FY = 1901;   // far outside any real series
const TREE = [{ n: 'Taxes', a: 100 }];

async function sync(client_, overrides = {}) {
  const { data, error } = await client_.rpc('treasury_sync_city_budget', {
    p_municipality_id: muniId,
    p_fiscal_year: TEST_FY,
    p_dataset_type: 'revenue',
    p_total: 100,
    p_tree: TREE,
    p_row_count: 1,
    p_data_source_name: UNREGISTERED,
    p_source_url: 'https://example.invalid/report.pdf',
    p_source_date: '2026-11-02',
    p_fund_scope: 'general_fund',
    p_basis: 'actual',
    p_fiscal_year_start_month: 7,
    ...overrides,
  });
  if (error) throw new Error(`transport: ${error.message}`);
  return classifySyncResult(data);
}

async function rowsFor(name) {
  const { data, error } = await client.schema('treasury').from('budgets')
    .select('id').eq('data_source', name).eq('fiscal_year', TEST_FY);
  if (error) throw new Error(error.message);
  return data.length;
}

beforeAll(async () => {
  if (!KEY) return;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(URL, KEY);
  const { data } = await client.schema('treasury').from('municipalities')
    .select('id').limit(1);
  muniId = data?.[0]?.id ?? null;
});

afterAll(async () => {
  // Leave nothing behind, whatever the outcome.
  if (!client || !muniId) return;
  for (const name of [UNREGISTERED, REGISTERED]) {
    await client.schema('treasury').from('budgets')
      .delete().eq('data_source', name).eq('fiscal_year', TEST_FY);
  }
});

describe('treasury_sync_city_budget refuses what the reader cannot use', () => {
  it('refuses a family no registry entry matches', { skip: !KEY && REASON }, async () => {
    const r = await sync(client);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/unregistered source family/i);
  });

  it('writes NOTHING when it refuses', { skip: !KEY && REASON }, async () => {
    await sync(client);
    expect(await rowsFor(UNREGISTERED)).toBe(0);
  });

  it('names the unmatched axes, so the message is actionable', { skip: !KEY && REASON }, async () => {
    const r = await sync(client);
    expect(r.message).toMatch(/audit_grade/);
    expect(r.message).toMatch(/fund_scope/);
  });

  // ⚠ Review Focus #3 — a STALE MIRROR is the most likely way this gate ever
  // refuses something it should not: someone adds a registry entry and
  // forgets to sync. If the message only says "unregistered", they will go
  // looking for a classification that already exists. It must name the sync.
  it('tells the reader a stale mirror is a possible cause', { skip: !KEY && REASON }, async () => {
    const r = await sync(client);
    expect(r.message).toMatch(/syncRegisteredFamilies/);
  });

  // ⚠ Review Focus #4 — 24,947 rows are `source_url is null OR = ''`. A NOT
  // NULL check alone misses half the shape.
  it('refuses a NEW row with an empty-string link, not just a null one',
    { skip: !KEY && REASON }, async () => {
      for (const url of [null, '', '   ']) {
        const r = await sync(client, { p_data_source_name: REGISTERED, p_source_url: url });
        expect(r.ok, `source_url ${JSON.stringify(url)}`).toBe(false);
        expect(r.message).toMatch(/source_url/i);
      }
      expect(await rowsFor(REGISTERED)).toBe(0);
    });

  it('accepts a registered family that brings a link', { skip: !KEY && REASON }, async () => {
    const r = await sync(client, { p_data_source_name: REGISTERED });
    expect(r.ok, r.message).toBe(true);
    expect(await rowsFor(REGISTERED)).toBe(1);
  });
});
