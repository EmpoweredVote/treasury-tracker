#!/usr/bin/env node
/**
 * Empowered Vote Donation Loader (Phase 74)
 *
 * Pulls EV's donation INCOME from per-platform CSV exports in data/ev-sources/
 * (GiveButter, Patreon, Benevity), aggregates GROSS by source for one fiscal year
 * (calendar year), and writes the EV `revenue` dataset — idempotently, with no
 * double-count against the live givebutter-webhook rows.
 *
 * This is the single writer of EV donation income. loadEVFinances.js writes
 * expenses only (Phase 74 onward). The bank export is Phase 75.
 *
 * Mapping + merge contract: docs/ev-donation-sources.md
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/loadEVDonations.js [--fy 2026] [--dry-run] [--source-dir data/ev-sources]
 *   (defaults: --fy = current calendar year, --source-dir = data/ev-sources)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Colors (EV brand — mirrors loadEVFinances.js) ────────────────────────────
export const COLORS = {
  Donations:      '#0F9B8E',
  Patreon:        '#14B0A2',
  'Give Butter':  '#19C5B6',
  Benevity:       '#1EDACA',
  Direct:         '#30E8D7',
  Interest:       '#4DE8DA',
  'Bank Interest':'#66EDE0',
};

// ── Parsing primitives ───────────────────────────────────────────────────────
export function parseCSVLine(line) {
  const fields = [];
  let current = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

/** Parse "$1,234.56", "(200)", "-40.70", "10.0000" → Number. parens or leading - = negative. */
export function money(str) {
  if (str === null || str === undefined || str === '') return 0;
  const s = String(str).trim();
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = parseFloat(s.replace(/[$,()\s]/g, '').replace(/^-/, '')) || 0;
  return neg ? -n : n;
}

/** First 4 chars as a year when the string is ISO-ish (YYYY-...); else null. */
export function isoYear(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{4})-\d{2}/);
  return m ? parseInt(m[1], 10) : null;
}

/** ISO-ish date → YYYY-MM-DD (slices the leading date out of "2026-01-16T00:00:00Z" or "2026-06-20 21:35:12"). */
export function isoDate(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Parse a full CSV file into an array of row objects keyed by header. */
export function readCsvRows(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const fields = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (fields[i] || '').replace(/^"|"$/g, '').trim(); });
    return row;
  });
}

// ── Per-platform parsers (pure) ──────────────────────────────────────────────
// Each returns { gross, fee, count, asOf } for the target fiscal year.

export function parseGiveButter(rows, fy) {
  let gross = 0, fee = 0, count = 0, asOf = null;
  for (const r of rows) {
    if ((r['Status Friendly'] || '') !== 'Succeeded') continue;
    if ((r['Refund Date (UTC)'] || '').trim()) continue; // skip refunded
    const d = isoDate(r['Transaction Date (UTC)']);
    if (d && (!asOf || d > asOf)) asOf = d; // export coverage horizon (over all succeeded rows)
    if (isoYear(r['Transaction Date (UTC)']) !== fy) continue;
    gross += money(r['Amount']);
    fee += money(r['Fee']);
    count++;
  }
  return { gross, fee, count, asOf };
}

export function parsePatreon(rows, fy) {
  let gross = 0, fee = 0, count = 0;
  for (const r of rows) {
    if (isoYear(r['Month']) !== fy) continue;
    gross += money(r['Total gross revenue']);
    fee += Math.abs(money(r['Total platform fee'])) + Math.abs(money(r['Total payment fee']));
    count++; // months with activity
  }
  return { gross, fee, count };
}

export function parseBenevity(rows, fy, basisColumn = 'Disbursement Date') {
  let gross = 0, fee = 0, count = 0;
  for (const r of rows) {
    if (isoYear(r[basisColumn]) !== fy) continue;
    gross += money(r['Donation Amount']) + money(r['Match Amount']);
    fee += money(r['Cause Support Fee']) + money(r['Merchant Fee']) + money(r['Check Fee']);
    count++;
  }
  return { gross, fee, count };
}

// ── GiveButter dedup (pure, D-04) ────────────────────────────────────────────
/** Split webhook rows into superseded (<= exportAsOf, already in the export aggregate)
 *  and delta (> exportAsOf, the live tail to keep). */
export function giveButterDedup(webhookRows, exportAsOf) {
  const superseded = [], delta = [];
  for (const w of webhookRows) {
    const d = isoDate(w.date) || w.date;
    if (exportAsOf && d && d > exportAsOf) delta.push(w);
    else superseded.push(w);
  }
  return { superseded, delta };
}

// ── Tree builder (pure) ──────────────────────────────────────────────────────
/**
 * bySource: { 'Give Butter': {gross,fee}, Patreon: {...}, Benevity: {...} }
 * carryForward: [{ parent, name, amount }]  (e.g. Interest → Bank Interest from the sheet)
 * Returns { categories, total } in the shape insertCategories expects.
 */
export function buildDonationTree(bySource, carryForward = []) {
  const SOURCE_ORDER = ['Give Butter', 'Patreon', 'Benevity', 'Direct'];
  const donationSubs = SOURCE_ORDER
    .filter(s => bySource[s] && bySource[s].gross > 0)
    .map(s => ({ name: s, amount: round2(bySource[s].gross) }));
  const donationsTotal = round2(donationSubs.reduce((a, c) => a + c.amount, 0));

  const parents = [];
  if (donationsTotal > 0) {
    parents.push({ parent: 'Donations', amount: donationsTotal, subs: donationSubs });
  }
  // carry-forward parents (Interest, etc.), grouped by parent name
  const cfByParent = {};
  for (const c of carryForward) {
    if (!(c.amount > 0)) continue;
    (cfByParent[c.parent] = cfByParent[c.parent] || []).push({ name: c.name, amount: round2(c.amount) });
  }
  for (const [parent, subs] of Object.entries(cfByParent)) {
    parents.push({ parent, amount: round2(subs.reduce((a, c) => a + c.amount, 0)), subs });
  }

  const total = round2(parents.reduce((a, p) => a + p.amount, 0));
  const categories = parents
    .sort((a, b) => b.amount - a.amount)
    .map(p => ({
      name: p.parent,
      amount: p.amount,
      percentage: total > 0 ? (p.amount / total) * 100 : 0,
      color: COLORS[p.parent] || '#888888',
      linkKey: linkKey(p.parent),
      subcategories: p.subs
        .sort((a, b) => b.amount - a.amount)
        .map(s => ({
          name: s.name,
          amount: s.amount,
          percentage: p.amount > 0 ? (s.amount / p.amount) * 100 : 0,
          color: COLORS[s.name] || COLORS[p.parent] || '#888888',
          linkKey: linkKey(s.name),
          lineItems: [{
            description: `FY ${'%FY%'} ${s.name} donations (aggregate, gross)`,
            amount: s.amount,
            vendor: s.name,
          }],
        })),
    }));
  return { categories, total };
}

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const linkKey = s => s.toLowerCase().replace(/[\s&/]+/g, '-');

// ── DB layer (lazy — not touched by offline tests) ───────────────────────────
async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY env var'); process.exit(1); }
  return createClient(url, key, { db: { schema: 'treasury' } });
}

async function getMunicipalityId(sb) {
  const { data } = await sb.from('municipalities').select('id').eq('name', 'Empowered Vote').maybeSingle();
  if (!data) throw new Error('Empowered Vote municipality not found');
  return data.id;
}

/** Read the FY revenue budget id (or null). */
async function getRevenueBudget(sb, muniId, fy) {
  const { data } = await sb.from('budgets').select('id').eq('municipality_id', muniId)
    .eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
  return data ? data.id : null;
}

/** All givebutter_webhook line items in the FY revenue budget. */
async function fetchWebhookRows(sb, budgetId) {
  if (!budgetId) return [];
  const { data: cats } = await sb.from('budget_categories').select('id').eq('budget_id', budgetId);
  if (!cats?.length) return [];
  const ids = cats.map(c => c.id);
  const { data } = await sb.from('budget_line_items')
    .select('description, actual_amount, vendor, date, external_id')
    .in('category_id', ids).eq('source', 'givebutter_webhook');
  return data || [];
}

/** Delete the entire FY revenue budget (all line items, categories, budget row). */
async function deleteRevenueBudget(sb, budgetId) {
  if (!budgetId) return;
  const { data: cats } = await sb.from('budget_categories').select('id').eq('budget_id', budgetId);
  const ids = (cats || []).map(c => c.id);
  if (ids.length) await sb.from('budget_line_items').delete().in('category_id', ids);
  await sb.from('budget_categories').delete().eq('budget_id', budgetId);
  await sb.from('budgets').delete().eq('id', budgetId);
}

async function createBudget(sb, muniId, fy, total) {
  const { data, error } = await sb.from('budgets').insert({
    municipality_id: muniId, fiscal_year: fy, dataset_type: 'revenue',
    total_budget: total, data_source: 'Empowered Vote — platform exports',
    hierarchy: ['Income Type', 'Source'], fiscal_year_start_month: 1,
  }).select('id').single();
  if (error) throw new Error(`Create budget failed: ${error.message}`);
  return data.id;
}

async function insertCategories(sb, budgetId, categories, fy, parentId = null, depth = 0) {
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const { data: catRow, error } = await sb.from('budget_categories').insert({
      budget_id: budgetId, parent_id: parentId, name: cat.name, amount: cat.amount,
      percentage: cat.percentage, color: cat.color, depth, sort_order: i,
      link_key: cat.linkKey || null, item_count: cat.lineItems?.length || 0,
    }).select('id').single();
    if (error) throw new Error(`Insert category "${cat.name}": ${error.message}`);
    if (cat.lineItems?.length) {
      const items = cat.lineItems.map(li => ({
        category_id: catRow.id,
        description: (li.description || '').replace('%FY%', String(fy)),
        approved_amount: li.amount, actual_amount: li.amount,
        vendor: li.vendor || null, source: 'csv',
      }));
      const { error: liErr } = await sb.from('budget_line_items').insert(items);
      if (liErr) throw new Error(`Insert line items: ${liErr.message}`);
    }
    if (cat.subcategories?.length) {
      await insertCategories(sb, budgetId, cat.subcategories, fy, catRow.id, depth + 1);
    }
  }
}

/** Re-insert post-exportAsOf webhook delta rows under Give Butter and bump totals (mirrors the RPC). */
async function reapplyWebhookDelta(sb, budgetId, deltaRows) {
  if (!deltaRows.length) return 0;
  const { data: cats } = await sb.from('budget_categories').select('id, name, parent_id, amount').eq('budget_id', budgetId);
  const gb = cats.find(c => c.name === 'Give Butter');
  const donations = cats.find(c => c.name === 'Donations');
  if (!gb) throw new Error('Give Butter category missing — cannot reapply webhook delta');
  let sum = 0;
  for (const w of deltaRows) {
    const amt = Number(w.actual_amount) || 0;
    sum += amt;
    await sb.from('budget_line_items').insert({
      category_id: gb.id, description: w.description || 'GiveButter donation',
      approved_amount: amt, actual_amount: amt, vendor: w.vendor || 'GiveButter',
      date: w.date || null, external_id: w.external_id || null, source: 'givebutter_webhook',
    });
  }
  await sb.from('budget_categories').update({ amount: gb_amount(gb) + sum }).eq('id', gb.id);
  if (donations) await sb.from('budget_categories').update({ amount: donations_amount(donations) + sum }).eq('id', donations.id);
  const { data: b } = await sb.from('budgets').select('total_budget').eq('id', budgetId).single();
  await sb.from('budgets').update({ total_budget: Number(b.total_budget) + sum }).eq('id', budgetId);
  return sum;
}
// tiny helpers to read the just-fetched amounts (kept explicit for clarity)
const gb_amount = c => Number(c.amount || 0);
const donations_amount = c => Number(c.amount || 0);

/** Carry forward non-platform income (Direct, Interest) for the FY from the legacy sheet. */
export function carryForwardFromSheet(sheetPath, fy) {
  if (!fs.existsSync(sheetPath)) return [];
  const rows = readCsvRows(sheetPath);
  const out = {};
  for (const r of rows) {
    if ((r['Type (Income/Expense)'] || '') !== 'Income') continue;
    const date = r['Date'] || '';
    const parts = date.split('/');
    let year = null;
    if (parts.length === 3) year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2], 10);
    if (year !== fy) continue;
    const acct = r['Account'] || '';
    const cat = r['Category'] || '';
    const amt = Math.abs(money(r['Amount']));
    if (amt === 0) continue;
    // platform income is owned by the exports — skip it here
    if (acct === 'Patreon' || acct === 'Give Butter' || acct === 'Benevity') continue;
    let parent, name;
    if (cat === 'Interest') { parent = 'Interest'; name = 'Bank Interest'; }
    else { parent = 'Donations'; name = 'Direct'; }
    const k = parent + '|' + name;
    out[k] = out[k] || { parent, name, amount: 0 };
    out[k].amount += amt;
  }
  return Object.values(out);
}

// ── Main ─────────────────────────────────────────────────────────────────────
function findFile(dir, re) {
  const f = fs.readdirSync(dir).find(n => re.test(n));
  return f ? path.join(dir, f) : null;
}

async function main() {
  const args = process.argv.slice(2);
  const fyArg = args.includes('--fy') ? parseInt(args[args.indexOf('--fy') + 1], 10) : new Date().getFullYear();
  const dryRun = args.includes('--dry-run');
  const dir = args.includes('--source-dir') ? args[args.indexOf('--source-dir') + 1]
    : path.join(__dirname, '..', 'data', 'ev-sources');

  console.log(`\n🗳️  EV Donation Loader — FY${fyArg}${dryRun ? ' (dry-run)' : ''}\n📂 ${dir}\n`);

  const gbFile = findFile(dir, /givebutter.*transactions.*\.csv$/i);
  // monthly earnings file only — "analytics-earnings.csv" suffix excludes "...detailed-earnings.csv"
  const patFile = findFile(dir, /patreon.*analytics-earnings\.csv$/i);
  const benFile = findFile(dir, /benevity.*disbursement.*\.csv$/i);
  if (!gbFile || !patFile || !benFile) {
    console.error('Missing export(s):', { gbFile, patFile, benFile });
    process.exit(1);
  }

  const gb = parseGiveButter(readCsvRows(gbFile), fyArg);
  const pat = parsePatreon(readCsvRows(patFile), fyArg);
  const ben = parseBenevity(readCsvRows(benFile), fyArg, 'Disbursement Date');

  const bySource = {
    'Give Butter': { gross: gb.gross, fee: gb.fee },
    'Patreon':     { gross: pat.gross, fee: pat.fee },
    'Benevity':    { gross: ben.gross, fee: ben.fee },
  };
  const carry = carryForwardFromSheet(path.join(__dirname, '..', 'data', 'ev-finances.csv'), fyArg);
  const { categories, total } = buildDonationTree(bySource, carry);

  console.log('Per-source GROSS (FY' + fyArg + '):');
  console.log(`  Give Butter $${gb.gross.toFixed(2)}  (fee $${gb.fee.toFixed(2)}, ${gb.count} txns, exportAsOf ${gb.asOf})`);
  console.log(`  Patreon     $${pat.gross.toFixed(2)}  (fee $${pat.fee.toFixed(2)}, ${pat.count} months)`);
  console.log(`  Benevity    $${ben.gross.toFixed(2)}  (fee $${ben.fee.toFixed(2)}, ${ben.count} disbursed rows)`);
  console.log(`  Carry-forward (sheet): ${carry.map(c => c.parent + '/' + c.name + ' $' + c.amount.toFixed(2)).join(', ') || 'none'}`);
  console.log(`  ── Revenue total: $${total.toFixed(2)}\n`);
  const totalFees = gb.fee + pat.fee + ben.fee;
  console.log(`Platform fees (gross→net story, D-09): $${totalFees.toFixed(2)} total\n`);

  if (dryRun) { console.log('Dry-run — no writes.'); printTree(categories); return; }

  const sb = await getSupabase();
  const muniId = await getMunicipalityId(sb);
  const existingBudgetId = await getRevenueBudget(sb, muniId, fyArg);
  const webhookRows = await fetchWebhookRows(sb, existingBudgetId);
  const { superseded, delta } = giveButterDedup(webhookRows, gb.asOf);
  console.log(`Webhook rows in FY${fyArg}: ${webhookRows.length} (superseded ≤${gb.asOf}: ${superseded.length}, live delta >${gb.asOf}: ${delta.length})`);

  await deleteRevenueBudget(sb, existingBudgetId);
  const budgetId = await createBudget(sb, muniId, fyArg, total);
  await insertCategories(sb, budgetId, categories, fyArg);
  const deltaSum = await reapplyWebhookDelta(sb, budgetId, delta);
  if (deltaSum) console.log(`Re-applied ${delta.length} post-export webhook donation(s): +$${deltaSum.toFixed(2)}`);

  console.log(`\n✅ FY${fyArg} EV revenue loaded: $${(total + deltaSum).toFixed(2)} (baseline $${total.toFixed(2)} + webhook delta $${deltaSum.toFixed(2)})\n`);
}

function printTree(categories) {
  for (const c of categories) {
    console.log(`  ${c.name}  $${c.amount.toFixed(2)}`);
    for (const s of c.subcategories || []) console.log(`     • ${s.name}  $${s.amount.toFixed(2)}`);
  }
}

// Run only when invoked directly (not on import for tests)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('\n❌ Fatal:', err.message); process.exit(1); });
}
