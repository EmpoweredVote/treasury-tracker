/**
 * The gate itself: BOTH write paths into treasury.budgets refuse a row the
 * reader cannot use, and write nothing when they do.
 *
 * ⚠⚠⚠ THERE ARE TWO WRITE PATHS, NOT ONE. The design said "the RPC is the
 * only real chokepoint. Every loader must go through it to write." That was
 * false and nobody measured it:
 *
 *     treasury_sync_budget_tree   262 files   <- the MAJORITY path
 *     treasury_sync_city_budget    65 files
 *
 * The ungated path carried the design's own motivating incidents —
 * processHIAcfr.js (Hawaii, which "shipped exactly this way twice") and
 * scrapeMaDLS.js (15,071 of the 24,947 linkless rows). A gate on one path
 * would not have stopped either.
 *
 * ⚠⚠ NEEDS A DATABASE AND SKIPS LOUDLY WITHOUT ONE. The repo keeps no
 * service-role key in Actions on purpose (PR #90), so these skip in CI:
 *
 *   SUPABASE_SERVICE_KEY=... npx vitest run tests/registryGateRpc.test.mjs
 *
 * ⚠ IT WRITES TO THE LIVE SHARED DATABASE, so everything is hung off a
 * municipality created for this file and deleted with it. An earlier version
 * attached a bogus FY1901 revenue row to a REAL government and relied on
 * afterAll; a crash between the two would have published it.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { classifySyncResult } from '../scripts/lib/rpcResult.mjs';

const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const REASON = 'no SUPABASE_SERVICE_KEY — the gate was not exercised';
if (!KEY) console.warn(`\n  ⚠ registryGateRpc.test.mjs SKIPPED: ${REASON}\n`);

let client = null;
let muniId = null;
let dsId = null;

const UNREGISTERED = 'ZZZ Gate Test Family — not a real publisher';
// Registered AND absent: the NY OSC pattern is `FY\d{4}`, so a year nobody
// has loaded matches the registry while still being a new family. Ohio AOS
// would NOT work here — it has 6,616 rows, so it is grandfathered.
const REGISTERED = 'New York OSC Town Annual Financial Report — Revenues, '
  + 'General Fund (FY1950 actual, self-reported)';
const TEST_FY = 1901;
const TREE = [{ n: 'Taxes', a: 100 }];

async function syncCity(overrides = {}) {
  const { data, error } = await client.rpc('treasury_sync_city_budget', {
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

// ⚠ Each tree call gets its own fiscal year: treasury.budgets has a unique
// index on (municipality_id, fiscal_year, dataset_type), so reusing one year
// across tests makes a later ACCEPT fail on a duplicate left by an earlier
// one — a fixture collision that reads exactly like a gate defect.
let treeFy = TEST_FY + 100;
async function syncTree(name, overrides = {}) {
  await client.schema('treasury').from('data_sources').update({ name }).eq('id', dsId);
  treeFy += 1;
  const { data, error } = await client.rpc('treasury_sync_budget_tree', {
    p_data_source_id: dsId,
    p_fiscal_year: treeFy,
    p_dataset_type: 'operating',
    p_total: 100,
    p_tree: TREE,
    p_row_count: 1,
    p_triggered_by: 'manual',
    ...overrides,
  });
  if (error) throw new Error(`transport: ${error.message}`);
  return data;
}

async function rowsFor(name) {
  const { data, error } = await client.schema('treasury').from('budgets')
    .select('id').eq('data_source', name).eq('municipality_id', muniId);
  if (error) throw new Error(error.message);
  return data.length;
}

beforeAll(async () => {
  if (!KEY) return;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(URL, KEY);

  const { data: m, error: mErr } = await client.schema('treasury').from('municipalities')
    .insert({ name: 'ZZZ Gate Test Municipality', state: 'ZZ', entity_type: 'city' })
    .select('id').single();
  if (mErr) throw new Error(`could not create the test municipality: ${mErr.message}`);
  muniId = m.id;

  const { data: d, error: dErr } = await client.schema('treasury').from('data_sources')
    .insert({
      name: UNREGISTERED, api_type: 'pdf_download', dataset_type: 'operating',
      dataset_id: 'zzz-gate-test', municipality_id: muniId, base_url: 'https://example.invalid',
      fiscal_years: [TEST_FY], fiscal_year_start_month: 7,
    })
    .select('id').single();
  if (dErr) throw new Error(`could not create the test data_source: ${dErr.message}`);
  dsId = d.id;
});

afterAll(async () => {
  if (!client || !muniId) return;
  // Everything hangs off the test municipality, so this cannot strand a row
  // on a real government even if an assertion threw mid-file.
  const { data: budgets } = await client.schema('treasury').from('budgets')
    .select('id').eq('municipality_id', muniId);
  for (const b of budgets ?? []) {
    await client.schema('treasury').from('budget_categories').delete().eq('budget_id', b.id);
  }
  await client.schema('treasury').from('budgets').delete().eq('municipality_id', muniId);
  if (dsId) {
    await client.schema('treasury').from('sync_logs').delete().eq('data_source_id', dsId);
    await client.schema('treasury').from('data_sources').delete().eq('id', dsId);
  }
  await client.schema('treasury').from('municipalities').delete().eq('id', muniId);
});

describe('treasury_sync_city_budget refuses what the reader cannot use', () => {
  it('refuses a family no registry entry matches', { skip: !KEY && REASON }, async () => {
    const r = await syncCity();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/unregistered source family/i);
  });

  it('writes NOTHING when it refuses', { skip: !KEY && REASON }, async () => {
    await syncCity();
    expect(await rowsFor(UNREGISTERED)).toBe(0);
  });

  it('names the unmatched axes, so the message is actionable', { skip: !KEY && REASON }, async () => {
    const r = await syncCity();
    expect(r.message).toMatch(/audit_grade/);
    expect(r.message).toMatch(/fund_scope/);
  });

  // ⚠ Review Focus #3 — a stale mirror is the likeliest way this gate ever
  // refuses something it should not.
  it('tells the reader a stale mirror is a possible cause', { skip: !KEY && REASON }, async () => {
    const r = await syncCity();
    expect(r.message).toMatch(/syncRegisteredFamilies/);
  });

  // ⚠ Whitespace must mean the same thing to the gate and the preflight. This
  // repo has already lost a day to a trailing space (ga_dca_rlgf).
  it('treats a padded family name as the same family', { skip: !KEY && REASON }, async () => {
    const r = await syncCity({ p_data_source_name: `  ${UNREGISTERED}  ` });
    expect(r.ok).toBe(false);
    expect(r.message).toContain(UNREGISTERED);
  });

  it('refuses a blank family name', { skip: !KEY && REASON }, async () => {
    const r = await syncCity({ p_data_source_name: '   ' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/blank|empty/i);
  });

  // ⚠ Review Focus #4 — 24,947 rows are `null OR ''`.
  it('refuses a new row with an empty-string link, not just a null one',
    { skip: !KEY && REASON }, async () => {
      for (const url of [null, '', '   ']) {
        const r = await syncCity({ p_data_source_name: REGISTERED, p_source_url: url });
        expect(r.ok, `source_url ${JSON.stringify(url)}`).toBe(false);
        expect(r.message).toMatch(/source_url/i);
      }
      expect(await rowsFor(REGISTERED)).toBe(0);
    });

  it('accepts a registered family that brings a link', { skip: !KEY && REASON }, async () => {
    const r = await syncCity({ p_data_source_name: REGISTERED });
    expect(r.ok, r.message).toBe(true);
    expect(await rowsFor(REGISTERED)).toBe(1);
  });

  // ⚠⚠ THE ROW-2 HOLE. The link rule was nested inside the grandfather branch,
  // and the family becomes "known" the instant its first row commits — so a
  // loader supplying a URL for row 1 and NULL for rows 2..N walked straight
  // past Goal 2. The rule now keys on whether the family has ever had a
  // LINKLESS row, which is stable across a run.
  it('still demands a link for the SECOND row of a family whose first row had one',
    { skip: !KEY && REASON }, async () => {
      const ok = await syncCity({ p_data_source_name: REGISTERED });
      expect(ok.ok, ok.message).toBe(true);
      const r = await syncCity({
        p_data_source_name: REGISTERED, p_fiscal_year: TEST_FY + 1, p_source_url: null,
      });
      expect(r.ok, 'row 2 with no link must still be refused').toBe(false);
      expect(r.message).toMatch(/source_url/i);
    });

  // ⚠ An empty string must never ERASE a link an earlier load established.
  it('does not let an empty-string link wipe an existing one',
    { skip: !KEY && REASON }, async () => {
      await syncCity({ p_data_source_name: REGISTERED });
      await syncCity({ p_data_source_name: REGISTERED, p_source_url: '' });
      const { data } = await client.schema('treasury').from('budgets')
        .select('source_url').eq('data_source', REGISTERED).eq('municipality_id', muniId);
      for (const row of data ?? []) expect(row.source_url).toBeTruthy();
    });
});

describe('treasury_sync_budget_tree — the majority write path — is gated too', () => {
  it('refuses a family no registry entry matches', { skip: !KEY && REASON }, async () => {
    const r = await syncTree(UNREGISTERED);
    expect(r?.error, JSON.stringify(r)).toMatch(/unregistered source family/i);
  });

  it('writes NOTHING when it refuses', { skip: !KEY && REASON }, async () => {
    await syncTree(UNREGISTERED);
    expect(await rowsFor(UNREGISTERED)).toBe(0);
  });

  // ⚠⚠ RAISE, NOT RETURN, on this path — and the reason is subtler than it
  // looks. A plpgsql block with an EXCEPTION clause is an implicit savepoint,
  // so catching the RAISE rolls back everything the block did INCLUDING the
  // sync_logs INSERT. The log row therefore never exists, rather than being
  // stranded at 'running'. What survives is the handler's own write to
  // data_sources, which is where the operator finds out why.
  //
  // Returning an error object instead would skip the EXCEPTION block
  // altogether and leave sync_logs stuck at 'running' with data_sources
  // reading idle and last_error NULL — the invisible-failure shape PR #86
  // removed. The pre-existing p_basis guard raises for exactly this reason.
  it('leaves no sync_logs row stranded at running, and says why on the source',
    { skip: !KEY && REASON }, async () => {
      await syncTree(UNREGISTERED);

      const { data: logs, error: logErr } = await client.schema('treasury').from('sync_logs')
        .select('status').eq('data_source_id', dsId).eq('status', 'running');
      expect(logErr, logErr ? `sync_logs read failed: ${logErr.message}` : '').toBeNull();
      expect(logs, 'no refusal may leave a sync_logs row at running').toEqual([]);

      const { data: ds } = await client.schema('treasury').from('data_sources')
        .select('sync_status,last_error').eq('id', dsId).single();
      expect(ds?.sync_status).toBe('error');
      expect(ds?.last_error).toMatch(/unregistered source family/i);
    });

  it('accepts a registered family', { skip: !KEY && REASON }, async () => {
    const r = await syncTree(REGISTERED);
    expect(r?.error, JSON.stringify(r)).toBeUndefined();
    expect(r?.status).toBe('success');
  });

  // ⚠ The tree path grandfathers the same way the city path does.
  it('accepts an unregistered family that already exists in the database',
    { skip: !KEY && REASON }, async () => {
      const known = 'Ohio Auditor of State Summarized Annual Financial Reports';
      const r = await syncTree(known);
      expect(r?.error, JSON.stringify(r)).toBeUndefined();
    });
});
