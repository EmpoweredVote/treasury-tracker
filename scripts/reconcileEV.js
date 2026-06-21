#!/usr/bin/env node
/**
 * Empowered Vote Reconciliation + Summary Loader (Phase 75)
 *
 * Turns the Beneficial State Bank export + the platform exports into EV's
 * reconciled FY summary and upserts it into treasury.org_financial_summary
 * (one row per municipality+FY, idempotent):
 *
 *   1. Cash BALANCE + as-of date (bank-authoritative) and trailing-3-complete-month
 *      BURN → RUNWAY (D-01/02/03).
 *   2. Per-source GROSS → FEE → NET from the platform exports (D-11) — fees are a
 *      reduction of income, NOT an operating expense.
 *   3. RECONCILIATION variance per source: platform net (gross−fee) vs. the matched
 *      bank payout deposits, with an explanation (D-05). Bank payout deposits are
 *      matched-and-excluded — NEVER re-added as income.
 *   4. UNMATCHED deposits (not a platform payout, not interest) flagged for manual
 *      entry (D-07). Interest is re-homed into the revenue tree by loadEVDonations.js
 *      (75-03), not here — but it is reported in the dry-run for transparency.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/reconcileEV.js [--fy 2026] [--dry-run] [--source-dir data/ev-sources]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readCsvRows, extractDebits, latestBalance } from './loadEVBank.js';
import { parseGiveButter, parsePatreon, parseBenevity } from './loadEVDonations.js';
import { classifyDeposit, extractDeposits } from './lib/evBankDeposits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const round1 = n => Math.round((n + Number.EPSILON) * 10) / 10;

// ── Burn / runway (pure) ──────────────────────────────────────────────────────
/**
 * Average monthly burn over the last `window` COMPLETE calendar months strictly
 * before the as-of month (the in-progress month is excluded) — D-01.
 * @param debits [{date:'M/D/YYYY', amount:+ve}]
 * @param asOfIso 'YYYY-MM-DD'
 */
export function monthlyBurn(debits, asOfIso, window = 3) {
  if (!asOfIso) return 0;
  const [ay, am] = asOfIso.split('-').map(Number); // as-of year, month (1-12)
  // The N complete months are am-1, am-2, ... am-window (wrapping years).
  const wanted = new Set();
  for (let k = 1; k <= window; k++) {
    let m = am - k, y = ay;
    while (m <= 0) { m += 12; y -= 1; }
    wanted.add(`${y}-${String(m).padStart(2, '0')}`);
  }
  let sum = 0;
  for (const d of debits) {
    const p = String(d.date).split('/'); // M/D/YYYY
    if (p.length !== 3) continue;
    const y = p[2].length === 2 ? '20' + p[2] : p[2];
    const key = `${y}-${String(p[0]).padStart(2, '0')}`;
    if (wanted.has(key)) sum += d.amount;
  }
  return round2(sum / window);
}

/** balance / burn, 1 dp. NULL when burn rounds to ~0 (never Infinity) — D-03. */
export function runway(balance, burn) {
  if (round2(burn) === 0) return null;
  return round1(balance / burn);
}

// ── Income gross→net (pure, D-11) ─────────────────────────────────────────────
/** bySource: {'Give Butter':{gross,fee}, ...} → {income_by_source, income_gross, income_fees, income_net} */
export function buildIncome(bySource) {
  const ORDER = ['Give Butter', 'Patreon', 'Benevity'];
  const income_by_source = ORDER
    .filter(s => bySource[s] && bySource[s].gross > 0)
    .map(s => {
      const gross = round2(bySource[s].gross);
      const fee = round2(bySource[s].fee);
      return { source: s, gross, fee, net: round2(gross - fee) };
    });
  const income_gross = round2(income_by_source.reduce((a, c) => a + c.gross, 0));
  const income_fees = round2(income_by_source.reduce((a, c) => a + c.fee, 0));
  const income_net = round2(income_by_source.reduce((a, c) => a + c.net, 0));
  return { income_by_source, income_gross, income_fees, income_net };
}

// ── Reconciliation (pure, D-05/07) ────────────────────────────────────────────
/**
 * income_by_source [{source,gross,fee,net}] + classified deposits → recon result.
 * Platform payout deposits are matched per source and compared to platform net;
 * they are NEVER added to income.
 */
export function reconcile(income_by_source, deposits) {
  // sum matched platform deposits per source
  const bankBySource = {};
  const unmatched_deposits = [];
  let interest = 0;
  for (const d of deposits) {
    const c = classifyDeposit(d.desc);
    if (c.kind === 'platform') bankBySource[c.source] = round2((bankBySource[c.source] || 0) + d.amount);
    else if (c.kind === 'interest') interest = round2(interest + d.amount);
    else unmatched_deposits.push({ date: d.iso || d.date, amount: round2(d.amount), description: d.desc });
  }
  const recon_by_source = income_by_source.map(s => {
    const platform_net = s.net;
    const bank_deposits = round2(bankBySource[s.source] || 0);
    return { source: s.source, platform_net, bank_deposits, variance: round2(platform_net - bank_deposits) };
  });
  const totalNet = round2(recon_by_source.reduce((a, c) => a + c.platform_net, 0));
  const totalBank = round2(recon_by_source.reduce((a, c) => a + c.bank_deposits, 0));
  const recon_variance = round2(totalNet - totalBank);
  // Largest single-source absolute variance, for an honest, direction-neutral explanation.
  const worst = recon_by_source.reduce((a, c) => (Math.abs(c.variance) > Math.abs(a.variance) ? c : a), { variance: 0, source: null });
  const driver = worst.source && Math.abs(worst.variance) >= 1
    ? ` Largest gap is ${worst.source} (Δ $${worst.variance.toFixed(2)}) — likely the platform export's FY window and the bank payout batch cover slightly different donation sets; refresh that export if the gap is unexpected.`
    : '';
  const recon_explanation =
    `Platform net (gross − fees) $${totalNet.toFixed(2)} vs. matched bank payout deposits $${totalBank.toFixed(2)} ` +
    `(Δ $${recon_variance.toFixed(2)}). Variance reflects payout timing (export FY window vs. bank deposit timing) ` +
    `plus fee-estimation differences; bank payout deposits are matched-and-excluded, never re-added as income.${driver}`;
  return { recon_by_source, recon_variance, recon_explanation, unmatched_deposits, interest };
}

// ── File discovery ────────────────────────────────────────────────────────────
function findFile(dir, re) { const f = fs.readdirSync(dir).find(n => re.test(n)); return f ? path.join(dir, f) : null; }

// ── DB layer (lazy) ───────────────────────────────────────────────────────────
async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  return createClient(url, key, { db: { schema: 'treasury' } });
}
async function getMunicipalityId(sb) {
  const { data } = await sb.from('municipalities').select('id').eq('name', 'Empowered Vote').maybeSingle();
  if (!data) throw new Error('Empowered Vote municipality not found');
  return data.id;
}

// ── Compute the full summary from the source files (pure orchestration) ────────
export function computeSummary(dir, fy) {
  const bankFile = findFile(dir, /beneficial.*state.*bank.*\.csv$/i);
  if (!bankFile) throw new Error('Missing Beneficial State Bank export in ' + dir);
  const gbFile = findFile(dir, /givebutter.*transactions.*\.csv$/i);
  const patFile = findFile(dir, /patreon.*analytics-earnings\.csv$/i);
  const benFile = findFile(dir, /benevity.*disbursement.*\.csv$/i);
  if (!gbFile || !patFile || !benFile) throw new Error('Missing platform export(s): ' + JSON.stringify({ gbFile, patFile, benFile }));

  const bankRows = readCsvRows(bankFile);
  const debits = extractDebits(bankRows, fy);
  const deposits = extractDeposits(bankRows, fy);
  const bal = latestBalance(bankRows);

  const gb = parseGiveButter(readCsvRows(gbFile), fy);
  const pat = parsePatreon(readCsvRows(patFile), fy);
  const ben = parseBenevity(readCsvRows(benFile), fy, 'Disbursement Date');
  const bySource = { 'Give Butter': { gross: gb.gross, fee: gb.fee }, 'Patreon': { gross: pat.gross, fee: pat.fee }, 'Benevity': { gross: ben.gross, fee: ben.fee } };

  const income = buildIncome(bySource);
  const recon = reconcile(income.income_by_source, deposits);
  const burn = monthlyBurn(debits, bal && bal.iso, 3);

  return {
    fiscal_year: fy,
    balance: round2(bal ? bal.balance : 0),
    balance_as_of: bal ? bal.iso : null,
    monthly_burn: burn,
    burn_window_months: 3,
    runway_months: runway(round2(bal ? bal.balance : 0), burn),
    ...income,
    recon_variance: recon.recon_variance,
    recon_explanation: recon.recon_explanation,
    recon_by_source: recon.recon_by_source,
    unmatched_deposits: recon.unmatched_deposits,
    _interest: recon.interest, // dry-run only; not persisted (75-03 re-homes interest to the revenue tree)
  };
}

function printSummary(s) {
  console.log(`Balance: $${s.balance.toFixed(2)} (as of ${s.balance_as_of})`);
  console.log(`Trailing ${s.burn_window_months}-complete-month burn: $${s.monthly_burn.toFixed(2)}/mo  →  runway: ${s.runway_months == null ? 'N/A' : s.runway_months + ' months'}`);
  console.log('\nIncome (gross → fee → net), per source:');
  for (const r of s.income_by_source) console.log(`  ${r.source.padEnd(12)} gross $${r.gross.toFixed(2)}  − fee $${r.fee.toFixed(2)}  = net $${r.net.toFixed(2)}`);
  console.log(`  ── totals: gross $${s.income_gross.toFixed(2)}  fees $${s.income_fees.toFixed(2)}  net $${s.income_net.toFixed(2)}`);
  console.log('\nReconciliation (platform net vs. matched bank payout deposits):');
  for (const r of s.recon_by_source) console.log(`  ${r.source.padEnd(12)} net $${r.platform_net.toFixed(2)}  vs bank $${r.bank_deposits.toFixed(2)}  Δ $${r.variance.toFixed(2)}`);
  console.log(`  total variance: $${s.recon_variance.toFixed(2)}`);
  console.log(`  ${s.recon_explanation}`);
  console.log(`\nBank interest (re-homed to revenue by loadEVDonations in 75-03): $${(s._interest || 0).toFixed(2)}`);
  if (s.unmatched_deposits.length) {
    console.log('\n⚠ Unmatched deposits (flag for manual entry, D-07):');
    for (const u of s.unmatched_deposits) console.log(`  ${u.date}  $${u.amount.toFixed(2)}  ${u.description}`);
  } else console.log('\nUnmatched deposits: none');
}

async function upsertSummary(sb, muniId, s) {
  const row = {
    municipality_id: muniId, fiscal_year: s.fiscal_year,
    balance: s.balance, balance_as_of: s.balance_as_of,
    monthly_burn: s.monthly_burn, burn_window_months: s.burn_window_months, runway_months: s.runway_months,
    income_gross: s.income_gross, income_fees: s.income_fees, income_net: s.income_net,
    income_by_source: s.income_by_source,
    recon_variance: s.recon_variance, recon_explanation: s.recon_explanation,
    recon_by_source: s.recon_by_source, unmatched_deposits: s.unmatched_deposits,
    source_name: 'Beneficial State Bank + platform exports', source_url: null,
    source_date: s.balance_as_of, updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('org_financial_summary').upsert(row, { onConflict: 'municipality_id,fiscal_year' });
  if (error) throw new Error('Upsert failed: ' + error.message);
}

async function main() {
  const args = process.argv.slice(2);
  const fy = args.includes('--fy') ? parseInt(args[args.indexOf('--fy') + 1], 10) : new Date().getFullYear();
  const dryRun = args.includes('--dry-run');
  const dir = args.includes('--source-dir') ? args[args.indexOf('--source-dir') + 1] : path.join(__dirname, '..', 'data', 'ev-sources');

  console.log(`\n🔁 EV Reconcile — FY${fy}${dryRun ? ' (dry-run)' : ''}\n📂 ${dir}\n`);
  const s = computeSummary(dir, fy);
  printSummary(s);

  if (dryRun) { console.log('\nDry-run — no writes.'); return; }
  const sb = await getSupabase();
  const muniId = await getMunicipalityId(sb);
  await upsertSummary(sb, muniId, s);
  console.log(`\n✅ FY${fy} org_financial_summary upserted for Empowered Vote.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('\n❌ Fatal:', err.message); process.exit(1); });
}
