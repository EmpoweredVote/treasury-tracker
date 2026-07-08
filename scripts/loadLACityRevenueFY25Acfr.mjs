#!/usr/bin/env node
/**
 * Los Angeles CITY Revenue — FY2025 ACFR (GAAP) one-off loader.
 *
 * WHY THIS EXISTS: LA City's revenue series (FY2003–2024) comes from the CA State
 * Controller ByTheNumbers "Revenues" dataset (rrtv-rsj9), which as of mid-2026 has
 * NOT published FY2025. To fill FY2025 "Money In", this loads the figures directly
 * from the City of Los Angeles FY2025 Annual Comprehensive Financial Report.
 *
 * ⚠ METHODOLOGY SEAM: this is the City's own ACFR (GAAP), NOT the CA-SCO taxonomy
 * used FY2003–2024. Totals are close and the trend is sensible ($21.6B FY24 →
 * $23.46B FY25), but sub-category structure differs slightly. Confidence: actual (GAAP).
 *
 * SOURCE: https://pafr25.lacontroller.app/documents/City_of_LA_-_FY25_ACFR_Final.pdf
 *   - Governmental: "Total Governmental Funds" column, Statement of Revenues,
 *     Expenditures & Changes in Fund Balances → TOTAL REVENUES $11,449,614K
 *     (every line reconciled to the printed total).
 *   - Enterprise: Proprietary Funds Statement of Revenues, Expenses & Changes in
 *     Fund Net Position → operating revenues $10,976,493K + gross nonoperating
 *     revenue $1,038,670K (investment income + interest income from leases + grant
 *     revenues + other income; EXCLUDES interest expense, mirroring the prior
 *     series' gross-nonoperating convention).
 *
 * All amounts below are in $THOUSANDS (as printed in the ACFR); loader ×1000 → dollars.
 *
 * Usage: node scripts/loadLACityRevenueFY25Acfr.mjs [--dry-run]
 *   (Requires SUPABASE_SERVICE_KEY. The production load on 2026-07-08 was performed
 *    via the treasury_sync_budget_tree RPC; re-running is idempotent for (muni,FY2025,revenue).)
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const MUNI_ID = '391bf791-1c1f-424f-a7a5-1b698c79093f'; // Los Angeles, CA (city)
const FY = 2025;
const SOURCE_NAME = 'LA City Revenue (ACFR)';
const SOURCE_URL = 'https://pafr25.lacontroller.app/documents/City_of_LA_-_FY25_ACFR_Final.pdf';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Governmental funds (Total Governmental Funds column) — $K ──
const GOV = [
  { n: 'Taxes', c: [
    { n: 'Property Taxes', a: 3063355 }, { n: 'Other Taxes', a: 1317385 },
    { n: 'Business Taxes', a: 849091 }, { n: 'Utility Users Taxes', a: 701237 },
    { n: 'Sales Taxes', a: 662059 } ] },
  { n: 'Intergovernmental', a: 1840389 },
  { n: 'Charges for Services', a: 1601924 },
  { n: 'Investment Earnings', c: [
    { n: 'Investment Earnings', a: 259890 },
    { n: 'Change in Fair Value of Investments', a: 182362 } ] },
  { n: 'Services to Enterprise Funds', a: 415019 },
  { n: 'Special Assessments', a: 172473 },
  { n: 'Other', a: 154350 },
  { n: 'Fines', a: 120638 },
  { n: 'Licenses and Permits', a: 84090 },
  { n: 'Program Income', a: 25352 },
];
const GOV_TOTAL = 11449614;
// ── Enterprise (proprietary) funds — operating + gross nonoperating, $K ──
const ENT = [
  { n: 'Power Enterprise Fund (LADWP)', op: 5308300, nonop: 348372 },
  { n: 'Airport Enterprise Fund (LAWA)', op: 2074058, nonop: 378006 },
  { n: 'Water Enterprise Fund (LADWP)', op: 1891550, nonop: 58245 },
  { n: 'Sewer Enterprise Fund', op: 848094, nonop: 132594 },
  { n: 'Harbor and Port Enterprise Fund', op: 798686, nonop: 120636 },
  { n: 'Convention Center Enterprise Fund', op: 55805, nonop: 817 },
];
const ENT_OP_TOTAL = 10976493, ENT_NONOP_TOTAL = 1038670;
const K = 1000;

function build() {
  let govSum = 0;
  for (const c of GOV) { if (c.c) c.a = c.c.reduce((s, x) => s + x.a, 0); govSum += c.a; }
  if (govSum !== GOV_TOTAL) throw new Error(`GOV ${govSum} != ${GOV_TOTAL}`);
  const op = ENT.reduce((s, e) => s + e.op, 0), nonop = ENT.reduce((s, e) => s + e.nonop, 0);
  if (op !== ENT_OP_TOTAL) throw new Error(`ENT op ${op} != ${ENT_OP_TOTAL}`);
  if (nonop !== ENT_NONOP_TOTAL) throw new Error(`ENT nonop ${nonop} != ${ENT_NONOP_TOTAL}`);
  const govNodes = GOV.map(c => ({ n: c.n, a: c.a * K, ...(c.c ? { c: c.c.map(x => ({ n: x.n, a: x.a * K })) } : {}) }));
  const entNodes = ENT.map(e => ({ n: e.n, a: (e.op + e.nonop) * K,
    c: [{ n: 'Operating Revenues', a: e.op * K }, { n: 'Nonoperating Revenues', a: e.nonop * K }] }));
  const tree = [...govNodes, ...entNodes].sort((a, b) => b.a - a.a);
  return { tree, total: (GOV_TOTAL + ENT_OP_TOTAL + ENT_NONOP_TOTAL) * K };
}

async function main() {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } }, strict: false });
  const { tree, total } = build();
  console.log(`LA City FY${FY} revenue (ACFR): $${(total / 1e9).toFixed(3)}B across ${tree.length} categories`);
  if (values['dry-run']) { console.log(JSON.stringify(tree, null, 2)); return; }
  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: src } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('name', SOURCE_NAME).eq('municipality_id', MUNI_ID).maybeSingle();
  let dsId = src?.id;
  if (!dsId) {
    const { data, error } = await supabase.schema('treasury').from('data_sources').insert({
      municipality_id: MUNI_ID, name: SOURCE_NAME, api_type: 'pdf', dataset_type: 'revenue',
      dataset_id: 'la-city-fy25-acfr-revenue', base_url: SOURCE_URL, fiscal_years: [FY], is_enabled: false,
      description: `City of Los Angeles FY${FY} ACFR (GAAP). Manual one-off — CA-SCO rrtv-rsj9 has no FY${FY} yet. Methodology seam vs FY2003-2024 SCO series.`,
    }).select('id').single();
    if (error) { console.error(error.message); process.exit(2); }
    dsId = data.id;
  }
  const { data: r, error } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: dsId, p_fiscal_year: FY, p_dataset_type: 'revenue',
    p_total: total, p_tree: tree, p_row_count: tree.length, p_triggered_by: 'bulk_load',
  });
  if (error || r?.error) { console.error('RPC error:', error?.message || r.error); process.exit(2); }
  console.log(`Loaded FY${FY}: budget ${r.budget_id}, total $${Number(r.total_budget).toLocaleString()}`);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
