/**
 * Empowered Vote Bank Expense Loader (Phase 75 — expense side, pulled forward)
 *
 * Beneficial State Bank is the authoritative source for EV's real expenses:
 * every DEBIT (negative Amount) is money that actually left the account.
 * Reads the bank transaction CSV from data/ev-sources/, classifies each debit
 * by vendor into a 2-level expense tree (category → vendor), and writes the EV
 * `operating` dataset for one fiscal year (calendar year). Idempotent.
 *
 * NOTE: platform processing fees (GiveButter/Patreon/Benevity) are netted out
 * before deposit and never appear as bank debits, so they are not double-counted
 * here (they live as the gross→net story from loadEVDonations, D-09).
 *
 * Deposits (income) are NOT loaded here — income comes from the platform exports
 * via loadEVDonations.js. Balance / runway / deposit↔donation reconciliation are
 * the remaining Phase 75 work.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/loadEVBank.js [--fy 2026] [--dry-run] [--source-dir data/ev-sources]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Expense classification: description keyword → { category, vendor } ────────
const VENDOR_RULES = [
  { re: /ANTHROPIC|CLAUDE/i,        category: 'AI & Research',          vendor: 'Anthropic (Claude)' },
  { re: /OPENAI|CHATGPT/i,          category: 'AI & Research',          vendor: 'OpenAI (ChatGPT)' },
  { re: /FIGMA/i,                   category: 'Design',                 vendor: 'Figma' },
  { re: /NOUN ?PROJECT/i,           category: 'Design',                 vendor: 'The Noun Project' },
  { re: /RENDER/i,                  category: 'Infrastructure & Hosting', vendor: 'Render.com' },
  { re: /SUPABASE/i,                category: 'Infrastructure & Hosting', vendor: 'Supabase' },
  { re: /TECHSOUP/i,                category: 'Infrastructure & Hosting', vendor: 'TechSoup' },
  { re: /AWS|AMAZON WEB/i,          category: 'Infrastructure & Hosting', vendor: 'AWS' },
  { re: /GODADDY|NAMECHEAP/i,       category: 'Domains',                vendor: 'GoDaddy' },
  { re: /INTERNATIONAL FEE/i,       category: 'Bank Fees',              vendor: 'International Fee (foreign txn)' },
];
function classify(description) {
  for (const r of VENDOR_RULES) if (r.re.test(description)) return { category: r.category, vendor: r.vendor };
  return { category: 'Operations', vendor: cleanVendor(description) };
}
function cleanVendor(desc) {
  // strip the "POS Signature Purchase" prefix and the trailing location codes for a readable fallback
  const m = String(desc).replace(/POS Signature Purchase\s*/i, '').trim().split(/\s{2,}/)[0];
  return (m || 'Other').slice(0, 40);
}

const COLORS = {
  'AI & Research': '#EC6B5A', 'Design': '#F07060', 'Infrastructure & Hosting': '#E74C3C',
  'Domains': '#F0B8A8', 'Bank Fees': '#C0392B', 'Operations': '#A93226',
};

// ── Parsing primitives ───────────────────────────────────────────────────────
export function parseCSVLine(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
export function money(str) {
  if (str === null || str === undefined || str === '') return 0;
  return parseFloat(String(str).replace(/[$,()\s]/g, '')) || 0; // keeps leading - ; parseFloat handles sign
}
/** Bank Date is M/D/YYYY → fiscal year (calendar year). */
export function bankYear(str) {
  if (!str) return null;
  const p = String(str).split('/');
  if (p.length === 3) return parseInt(p[2].length === 2 ? '20' + p[2] : p[2], 10);
  return null;
}
export function bankISO(str) {
  if (!str) return null;
  const p = String(str).split('/');
  if (p.length === 3) { const [m, d, y] = p; const yy = y.length === 2 ? '20' + y : y; return `${yy}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; }
  return null;
}
export function readCsvRows(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const f = parseCSVLine(line); const row = {};
    headers.forEach((h, i) => { row[h] = (f[i] || '').replace(/^"|"$/g, '').trim(); });
    return row;
  });
}

// ── Build expense tree (pure) ────────────────────────────────────────────────
/** debits: [{date, desc, amount(+ve magnitude)}] → { categories, total } */
export function buildExpenseTree(debits) {
  const byCat = {};
  for (const d of debits) {
    const { category, vendor } = classify(d.desc);
    byCat[category] = byCat[category] || {};
    byCat[category][vendor] = byCat[category][vendor] || { amount: 0, items: [] };
    byCat[category][vendor].amount += d.amount;
    byCat[category][vendor].items.push(d);
  }
  const total = round2(debits.reduce((s, d) => s + d.amount, 0));
  const categories = Object.entries(byCat).map(([cat, vendors]) => {
    const subs = Object.entries(vendors).map(([vendor, v]) => ({
      name: vendor, amount: round2(v.amount),
      color: COLORS[cat] || '#888888', linkKey: linkKey(vendor),
      lineItems: v.items.map(it => ({ description: `${vendor} — ${it.date}`, amount: round2(it.amount), vendor, date: bankISO(it.date) })),
    })).sort((a, b) => b.amount - a.amount);
    const catAmount = round2(subs.reduce((s, x) => s + x.amount, 0));
    return {
      name: cat, amount: catAmount,
      percentage: total > 0 ? (catAmount / total) * 100 : 0,
      color: COLORS[cat] || '#888888', linkKey: linkKey(cat),
      subcategories: subs.map(s => ({ ...s, percentage: catAmount > 0 ? (s.amount / catAmount) * 100 : 0 })),
    };
  }).sort((a, b) => b.amount - a.amount);
  return { categories, total };
}
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const linkKey = s => s.toLowerCase().replace(/[\s&/().]+/g, '-').replace(/-+$/,'');

/** Extract FY debits as positive magnitudes. */
export function extractDebits(rows, fy) {
  const out = [];
  for (const r of rows) {
    const amt = money(r['Amount']);
    if (amt >= 0) continue;            // skip deposits/credits
    if (bankYear(r['Date']) !== fy) continue;
    out.push({ date: r['Date'], desc: r['Description'] || '', amount: Math.abs(amt) });
  }
  return out;
}
/** Latest balance in the file (top row / max date) — informational for Phase 75. */
export function latestBalance(rows) {
  let best = null;
  for (const r of rows) {
    const iso = bankISO(r['Date']);
    if (iso && (!best || iso > best.iso)) best = { iso, balance: money(r['Balance']) };
  }
  return best;
}

// ── DB layer (lazy) ──────────────────────────────────────────────────────────
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
async function deleteOperatingBudget(sb, muniId, fy) {
  const { data: b } = await sb.from('budgets').select('id').eq('municipality_id', muniId)
    .eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
  if (!b) return;
  const { data: cats } = await sb.from('budget_categories').select('id').eq('budget_id', b.id);
  const ids = (cats || []).map(c => c.id);
  if (ids.length) await sb.from('budget_line_items').delete().in('category_id', ids);
  await sb.from('budget_categories').delete().eq('budget_id', b.id);
  await sb.from('budgets').delete().eq('id', b.id);
}
async function createBudget(sb, muniId, fy, total) {
  const { data, error } = await sb.from('budgets').insert({
    municipality_id: muniId, fiscal_year: fy, dataset_type: 'operating',
    total_budget: total, data_source: 'Beneficial State Bank', hierarchy: ['Category', 'Vendor'],
    fiscal_year_start_month: 1,
  }).select('id').single();
  if (error) throw new Error(`Create budget failed: ${error.message}`);
  return data.id;
}
async function insertCategories(sb, budgetId, categories, parentId = null, depth = 0) {
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const { data: row, error } = await sb.from('budget_categories').insert({
      budget_id: budgetId, parent_id: parentId, name: cat.name, amount: cat.amount,
      percentage: cat.percentage, color: cat.color, depth, sort_order: i,
      link_key: cat.linkKey || null, item_count: cat.lineItems?.length || 0,
    }).select('id').single();
    if (error) throw new Error(`Insert category "${cat.name}": ${error.message}`);
    if (cat.lineItems?.length) {
      const items = cat.lineItems.map(li => ({
        category_id: row.id, description: li.description, approved_amount: li.amount,
        actual_amount: li.amount, vendor: li.vendor || null, date: li.date || null, source: 'bank',
      }));
      const { error: e2 } = await sb.from('budget_line_items').insert(items);
      if (e2) throw new Error(`Insert line items: ${e2.message}`);
    }
    if (cat.subcategories?.length) await insertCategories(sb, budgetId, cat.subcategories, row.id, depth + 1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
function findFile(dir, re) { const f = fs.readdirSync(dir).find(n => re.test(n)); return f ? path.join(dir, f) : null; }

async function main() {
  const args = process.argv.slice(2);
  const fy = args.includes('--fy') ? parseInt(args[args.indexOf('--fy') + 1], 10) : new Date().getFullYear();
  const dryRun = args.includes('--dry-run');
  const dir = args.includes('--source-dir') ? args[args.indexOf('--source-dir') + 1] : path.join(__dirname, '..', 'data', 'ev-sources');

  console.log(`\n🏦 EV Bank Expense Loader — FY${fy}${dryRun ? ' (dry-run)' : ''}\n📂 ${dir}\n`);
  const file = findFile(dir, /beneficial.*state.*bank.*\.csv$/i);
  if (!file) { console.error('Missing Beneficial State Bank export in', dir); process.exit(1); }

  const rows = readCsvRows(file);
  const debits = extractDebits(rows, fy);
  const { categories, total } = buildExpenseTree(debits);
  const bal = latestBalance(rows);

  console.log(`Debits FY${fy}: ${debits.length} charges, total $${total.toFixed(2)}`);
  for (const c of categories) {
    console.log(`  ${c.name}  $${c.amount.toFixed(2)}`);
    for (const s of c.subcategories) console.log(`     • ${s.name}  $${s.amount.toFixed(2)}`);
  }
  if (bal) console.log(`\nLatest balance in export: $${bal.balance.toFixed(2)} (${bal.iso}) — [Phase 75 will surface balance/runway]`);

  if (dryRun) { console.log('\nDry-run — no writes.'); return; }

  const sb = await getSupabase();
  const muniId = await getMunicipalityId(sb);
  await deleteOperatingBudget(sb, muniId, fy);
  const budgetId = await createBudget(sb, muniId, fy, total);
  await insertCategories(sb, budgetId, categories);
  console.log(`\n✅ FY${fy} EV operating (expenses) loaded from Beneficial State Bank: $${total.toFixed(2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('\n❌ Fatal:', err.message); process.exit(1); });
}
