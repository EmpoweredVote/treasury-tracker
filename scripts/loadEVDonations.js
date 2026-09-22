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
import { classifyDeposit, extractDeposits } from './lib/evBankDeposits.js';
import { findFile, reportSourceWarnings } from './lib/evSourceFiles.js';

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

// ── Micro-donation aggregate helpers (pure, Phase 81.5) ─────────────────────
// These derive anonymized recurring-supporter statistics for the Donations
// category display. NO PII (names / emails / addresses) in any return value.

/**
 * Count distinct active recurring GiveButter donors in the target FY.
 * Deduplication key: Contact ID (preferred) falling back to Contact Email.
 * Only rows that have a Plan ID (i.e., a recurring plan charge) are counted.
 * Returns: { count, typicalAmounts }
 *   typicalAmounts = one representative monthly amount per donor (most-recent charge in FY)
 */
export function giveButterRecurringDonors(rows, fy) {
  const fy2026Rows = rows.filter(r =>
    (r['Status Friendly'] || '') === 'Succeeded' &&
    !(r['Refund Date (UTC)'] || '').trim() &&
    isoYear(r['Transaction Date (UTC)']) === fy &&
    (r['Plan ID'] || '').trim() !== ''
  );
  // Sort descending by date so the first occurrence per donor = most recent charge
  fy2026Rows.sort((a, b) =>
    (b['Transaction Date (UTC)'] || '').localeCompare(a['Transaction Date (UTC)'] || '')
  );
  const seen = new Map(); // dedup key → most-recent amount
  for (const r of fy2026Rows) {
    const key = (r['Contact ID'] || '').trim() || (r['Contact Email'] || '').trim();
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, money(r['Amount']));
  }
  return { count: seen.size, typicalAmounts: [...seen.values()] };
}

/**
 * Count distinct active Patreon patrons in the target FY.
 * Deduplication key: Member user ID.
 * Only Payment events are counted (not refunds / adjustments).
 * Returns: { count, typicalAmounts }
 *   typicalAmounts = most-recent Member charge amount per patron in FY
 */
export function patreonDistinctPatrons(rows, fy) {
  const fyRows = rows.filter(r =>
    isoYear(r['Date']) === fy &&
    (r['Event type'] || '').trim() === 'Payment'
  );
  fyRows.sort((a, b) => (b['Date'] || '').localeCompare(a['Date'] || ''));
  const seen = new Map(); // member user ID → most-recent charge amount
  for (const r of fyRows) {
    const id = (r['Member user ID'] || '').trim();
    if (!id) continue;
    if (!seen.has(id)) seen.set(id, money(r['Member charge amount']));
  }
  return { count: seen.size, typicalAmounts: [...seen.values()] };
}

/**
 * Compute median value of a sorted numeric array (ascending).
 * Returns 0 for empty arrays.
 */
export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Assign a monthly gift amount to a size bucket.
 * Buckets: lt5 (<$5), b5to9 ($5–9), b10to24 ($10–24), b25to49 ($25–49), gte50 ($50+)
 */
function sizeBucket(amount) {
  if (amount < 5)  return 'lt5';
  if (amount < 10) return 'b5to9';
  if (amount < 25) return 'b10to24';
  if (amount < 50) return 'b25to49';
  return 'gte50';
}

/**
 * Compute a compact anonymized recurring-supporter aggregate for the target FY.
 *
 * Rules:
 *   - GiveButter: dedup by Contact ID / Contact Email; count donors with Plan ID.
 *   - Patreon: dedup by Member user ID; count Payment events only.
 *   - Benevity: EXACTLY 1 supporter regardless of row count.
 *     (Chris Andrew's company-matched recurring giving — 61 disbursement rows,
 *      one donor. Hard rule per Phase 81.5 CONTEXT.md auto-memory guardrail.)
 *
 * @param {object[]} gbRows   GiveButter transaction CSV rows
 * @param {object[]} patRows  Patreon detailed-earnings CSV rows
 * @param {number}   fy       Fiscal year (calendar year)
 * @returns {{ recurring_supporters: number, typical_monthly: number, buckets: object, as_of_fy: number }}
 *          No PII keys in the returned object.
 */
export function computeRecurringAggregates(gbRows, patRows, fy) {
  const gb  = giveButterRecurringDonors(gbRows, fy);
  const pat = patreonDistinctPatrons(patRows, fy);

  // Benevity: exactly 1 supporter — this is Chris Andrew's company-matched
  // recurring giving via Cisco Benevity. The export contains 61 disbursement
  // rows but represents one real donor. Hard-coded per Phase 81.5 memory guardrail.
  const benevityCount = 1;
  const benevityTypical = 0; // excluded from median (company-match atypical of the micro-donation story)

  const recurring_supporters = gb.count + pat.count + benevityCount;

  // Typical monthly = median over per-supporter representative monthly amounts.
  // GiveButter and Patreon donors contribute their most-recent charge in the FY.
  // Benevity is excluded from the median (see above).
  const allAmounts = [...gb.typicalAmounts, ...pat.typicalAmounts];
  const typical_monthly = round2(median(allAmounts));

  // Size buckets (counts only — no PII)
  const buckets = { lt5: 0, b5to9: 0, b10to24: 0, b25to49: 0, gte50: 0 };
  for (const a of allAmounts) buckets[sizeBucket(a)]++;

  return { recurring_supporters, typical_monthly, buckets, as_of_fy: fy };
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
  // carry-forward parents (Interest, manual/Direct, etc.), grouped by parent name.
  // Each carry-forward record may carry a `tag` ('manual' | 'bank') that becomes the
  // line item's source; platform subs (no tag) default to 'csv'.
  const cfByParent = {};
  for (const c of carryForward) {
    if (!(c.amount > 0)) continue;
    (cfByParent[c.parent] = cfByParent[c.parent] || []).push({ name: c.name, amount: round2(c.amount), tag: c.tag });
  }
  for (const [parent, subs] of Object.entries(cfByParent)) {
    const existing = parents.find(p => p.parent === parent);
    if (existing) {
      // merge into the existing parent (e.g. manual Direct into the Donations parent) — avoids a duplicate parent node
      existing.subs = existing.subs.concat(subs);
      existing.amount = round2(existing.amount + subs.reduce((a, c) => a + c.amount, 0));
    } else {
      parents.push({ parent, amount: round2(subs.reduce((a, c) => a + c.amount, 0)), subs });
    }
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
            description: s.tag ? `FY ${'%FY%'} ${s.name}` : `FY ${'%FY%'} ${s.name} donations (aggregate, gross)`,
            amount: s.amount,
            vendor: s.name,
            source: s.tag || 'csv',
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

/**
 * Get the FY revenue budget row, creating it only if it does not exist yet.
 *
 * ⚠⚠ THE ROW IS UPDATED IN PLACE. IT MUST NEVER BE DELETED AND RECREATED.
 *
 * This loader used to delete the budgets row and insert a replacement, so every
 * refresh minted a NEW uuid. That broke the frozen-figure invariant twice over
 * (measured 2026-09-21):
 *
 *   1. The digest's EV exclusion materialises to a STATIC ID LIST
 *      (scripts/data/liveSyncExcludedIds.json). A new id is not on it, so the
 *      refreshed rows re-entered the digest and the invariant went red -- the
 *      very thing v2.37 believed it had prevented by registering the feeds as
 *      sources. It needed a manual re-snapshot after every refresh.
 *   2. The dead ids stayed in treasury.frozen_excluded_ids as orphans, four of
 *      them by the time this was found, growing with each refresh.
 *
 * ⚠ A stable id matters MORE here than for the bank loader, because the live
 * Givebutter webhook writes into this same budget between refreshes. Recreating
 * the row moved the target out from under it.
 *
 * See scripts/evBudgetInPlace.test.mjs, which fails if a delete against
 * `budgets` ever reappears here.
 */
export async function ensureBudget(sb, muniId, fy, total) {
  const { data: existing } = await sb.from('budgets').select('id')
    .eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();

  if (existing) {
    // Descriptive columns only; total_budget is written LAST by setTotalBudget,
    // BEFORE reapplyWebhookDelta increments it atomically.
    const { error } = await sb.from('budgets').update({
      data_source: 'Empowered Vote — platform exports',
      hierarchy: ['Income Type', 'Source'], fiscal_year_start_month: 1,
    }).eq('id', existing.id);
    if (error) throw new Error(`Update budget failed: ${error.message}`);
    return existing.id;
  }

  const { data, error } = await sb.from('budgets').insert({
    municipality_id: muniId, fiscal_year: fy, dataset_type: 'revenue',
    total_budget: total, data_source: 'Empowered Vote — platform exports',
    hierarchy: ['Income Type', 'Source'], fiscal_year_start_month: 1,
  }).select('id').single();
  if (error) throw new Error(`Create budget failed: ${error.message}`);
  return data.id;
}

/** Remove the budget's tree (line items + categories) WITHOUT touching the budget row. */
export async function clearBudgetChildren(sb, budgetId) {
  if (!budgetId) return;
  const { data: cats } = await sb.from('budget_categories').select('id').eq('budget_id', budgetId);
  const ids = (cats || []).map(c => c.id);
  if (ids.length) await sb.from('budget_line_items').delete().in('category_id', ids);
  await sb.from('budget_categories').delete().eq('budget_id', budgetId);
}

/**
 * Write the BASELINE header total, once the tree beneath it is in place.
 *
 * ⚠⚠ MUST RUN BEFORE reapplyWebhookDelta, NEVER AFTER. That function routes
 * through the same atomic RPC the Givebutter webhook uses
 * (treasury.record_givebutter_donation), which INCREMENTS total_budget and the
 * category amounts together. A plain write afterwards would discard the webhook
 * delta from the header while the tree kept it -- reintroducing exactly the
 * header/tree divergence PR #201 fixed ($4,770.40 header vs $4,990.40 tree).
 */
export async function setTotalBudget(sb, budgetId, total) {
  const { error } = await sb.from('budgets').update({ total_budget: total }).eq('id', budgetId);
  if (error) throw new Error(`Set total_budget failed: ${error.message}`);
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
        vendor: li.vendor || null, source: li.source || 'csv',
      }));
      const { error: liErr } = await sb.from('budget_line_items').insert(items);
      if (liErr) throw new Error(`Insert line items: ${liErr.message}`);
    }
    if (cat.subcategories?.length) {
      await insertCategories(sb, budgetId, cat.subcategories, fy, catRow.id, depth + 1);
    }
  }
}

/**
 * Re-apply post-exportAsOf webhook donations, through the SAME atomic RPC the
 * live webhook uses.
 *
 * ⚠⚠ THIS USED TO BE A READ-MODIFY-WRITE, AND THAT WAS THE BUG. Two writers
 * keep this budget — this loader, and the Givebutter edge function, which calls
 * `treasury.record_givebutter_donation`. The RPC is atomic:
 *
 *     UPDATE treasury.budgets SET total_budget = total_budget + p_amount ...
 *
 * while this function read `total_budget` into JS and wrote back `read + sum`.
 * A webhook donation landing between the read and the write was ERASED FROM THE
 * HEADER, while the category amounts kept it — because the RPC increments those
 * atomically too. The signature is `total_budget` understated relative to the
 * tree by exactly one donation, which is what was seen on 2026-09-20:
 * header $4,770.40, tree $4,990.40, categories correct.
 *
 * ⚠ It also discarded the error on all four writes, which is why that incident
 * left NOTHING to diagnose — no failure, just a number that disagreed with the
 * rows beneath it. Every call here is now checked.
 *
 * ⭐ The fix is not a lock. It is that there is now ONE write path: the loader
 * and the webhook increment through the same function, so concurrency is the
 * database's problem and neither can clobber the other. The RPC is also
 * idempotent on (external_id, source), so a re-run cannot double-count.
 */
export async function reapplyWebhookDelta(sb, budgetId, deltaRows) {
  if (!deltaRows.length) return 0;

  const { data: cats, error: catErr } = await sb
    .from('budget_categories')
    .select('id, name, parent_id, amount')
    .eq('budget_id', budgetId);
  if (catErr) throw new Error(`Fetch categories for webhook delta: ${catErr.message}`);

  const gb = (cats || []).find(c => c.name === 'Give Butter');
  const donations = (cats || []).find(c => c.name === 'Donations');
  if (!gb) throw new Error('Give Butter category missing — cannot reapply webhook delta');
  // ⚠ Required, not optional as before: the RPC bumps leaf AND parent in one
  // statement, so a missing parent would silently leave the tree unbalanced.
  if (!donations) throw new Error('Donations category missing — cannot reapply webhook delta');

  let sum = 0;
  for (const w of deltaRows) {
    const amt = Number(w.actual_amount) || 0;
    const { error } = await sb.rpc('record_givebutter_donation', {
      p_external_id: w.external_id ?? null,
      p_leaf_category_id: gb.id,
      p_parent_category_id: donations.id,
      p_budget_id: budgetId,
      p_description: w.description || 'GiveButter donation',
      p_amount: amt,
      p_date: w.date || null,
      p_vendor: w.vendor || 'GiveButter',
    });
    if (error) {
      throw new Error(`Re-apply webhook donation ${w.external_id ?? '(no external_id)'}: ${error.message}`);
    }
    sum += amt;
  }
  return sum;
}

/**
 * The header-vs-tree invariant: `budgets.total_budget` must equal the sum of the
 * budget's TOP-LEVEL categories.
 *
 * ⚠⚠ TOP-LEVEL ONLY. `budget_categories` holds parents and children in one
 * table, so summing every row double-counts and returns exactly 2x the total —
 * a mistake I made while diagnosing this, and one that reads as a catastrophic
 * mismatch rather than as a bad query.
 *
 * Returns null when they agree, or { expected, actual, diff } when they do not.
 * Exists because the 2026-09-20 divergence was INVISIBLE: no error, no failure,
 * just a headline figure that disagreed with the rows printed beneath it.
 * Whatever the cause, nothing was asserting they matched.
 *
 * @returns {null | { expected: number, actual: number, diff: number }}
 */
export function headerTreeMismatch(totalBudget, topLevelCategories) {
  const expected = round2((topLevelCategories || []).reduce((s, c) => s + Number(c.amount || 0), 0));
  const actual = round2(Number(totalBudget || 0));
  const diff = round2(actual - expected);
  // Half a cent: below any real money difference, above float noise.
  return Math.abs(diff) < 0.005 ? null : { expected, actual, diff };
}

/**
 * Persist anonymized micro-donation aggregates on the Donations budget_category row.
 *
 * Carries data via two existing API-returned fields (no backend schema change):
 *   - item_count       = recurring_supporters (semantic: "N recurring donors")
 *   - description      = compact namespaced JSON carrier for the frontend
 *
 * Idempotency (never-overwrite discipline, per project memory
 * project_sync_city_budget_not_source_safe): reads the current row first;
 * skips the write if item_count and description are already identical.
 *
 * @param {object} sb          Supabase client
 * @param {number} budgetId    The FY revenue budget id
 * @param {object} aggregates  { recurring_supporters, typical_monthly, buckets, as_of_fy }
 * @returns {{ wrote: boolean, reason: string }}
 */
export async function writeDonationsAggregate(sb, budgetId, aggregates) {
  // Fetch the top-level Donations category for this budget
  const { data: cat, error: fetchErr } = await sb
    .from('budget_categories')
    .select('id, item_count, description')
    .eq('budget_id', budgetId)
    .eq('name', 'Donations')
    .is('parent_id', null)
    .maybeSingle();
  if (fetchErr) throw new Error(`Fetch Donations category: ${fetchErr.message}`);
  if (!cat) return { wrote: false, reason: 'Donations category not found in budget' };

  // Privacy: persist only the count + typical monthly + FY. Size-bucket counts are
  // intentionally NOT persisted — for a ~8-person donor pool, a per-bucket distribution
  // in the public API payload (combined with the public gross-by-source figures) is
  // quasi-identifying. Buckets remain available in-memory for future use but never ship.
  const newDescription = JSON.stringify({
    _evMicro: {
      recurring_supporters: aggregates.recurring_supporters,
      typical_monthly:      aggregates.typical_monthly,
      as_of_fy:             aggregates.as_of_fy,
    },
  });

  // Set-if-changed: skip write if already identical (idempotent re-run)
  const unchanged =
    cat.item_count === aggregates.recurring_supporters &&
    cat.description === newDescription;
  if (unchanged) return { wrote: false, reason: 'already up-to-date' };

  const { error: updErr } = await sb
    .from('budget_categories')
    .update({ item_count: aggregates.recurring_supporters, description: newDescription })
    .eq('id', cat.id);
  if (updErr) throw new Error(`Update Donations category: ${updErr.message}`);

  return { wrote: true, reason: `item_count=${aggregates.recurring_supporters}` };
}

/**
 * Manual / off-platform income for the FY from data/ev-sources/manual.csv (D-06/D-08).
 * Header: date,source,amount,note. date = M/D/YYYY or ISO; amount = plain decimal.
 * Cash entries only (checks, grants, unmatched bank deposits) — in-kind deferred (D-10).
 * Returns [{ parent:'Donations', name:<source label or 'Direct'>, amount, tag:'manual' }].
 */
export function carryForwardManual(dir, fy) {
  const file = path.join(dir, 'manual.csv');
  if (!fs.existsSync(file)) return [];
  const rows = readCsvRows(file);
  const out = {};
  for (const r of rows) {
    const date = r['date'] || r['Date'] || '';
    let year = null;
    const m = String(date).match(/^(\d{4})-\d{2}/);
    if (m) year = parseInt(m[1], 10);
    else { const p = String(date).split('/'); if (p.length === 3) year = parseInt(p[2].length === 2 ? '20' + p[2] : p[2], 10); }
    if (year !== fy) continue;
    const amt = Math.abs(money(r['amount'] ?? r['Amount']));
    if (amt === 0) continue;
    const name = (r['source'] || r['Source'] || 'Direct').trim() || 'Direct';
    const k = name;
    out[k] = out[k] || { parent: 'Donations', name, amount: 0, tag: 'manual' };
    out[k].amount += amt;
  }
  return Object.values(out);
}

/**
 * Bank interest for the FY from the Beneficial State Bank export's 'Credit Interest'
 * deposits (D-06). Re-homes interest off the retired sheet onto the bank.
 * Returns [{ parent:'Interest', name:'Bank Interest', amount, tag:'bank' }] (omitted if 0).
 */
export function carryForwardInterest(dir, fy) {
  const f = fs.readdirSync(dir).find(n => /beneficial.*state.*bank.*\.csv$/i.test(n));
  if (!f) return [];
  const rows = readCsvRows(path.join(dir, f));
  const deposits = extractDeposits(rows, fy);
  let sum = 0;
  for (const d of deposits) if (classifyDeposit(d.desc).kind === 'interest') sum += d.amount;
  sum = round2(sum);
  return sum > 0 ? [{ parent: 'Interest', name: 'Bank Interest', amount: sum, tag: 'bank' }] : [];
}

/** @deprecated Phase 75 (D-09): ev-finances.csv retired as an income source. Superseded by
 *  carryForwardManual (manual.csv) + carryForwardInterest (bank). No longer called by main(). */
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
async function main() {
  const args = process.argv.slice(2);
  const fyArg = args.includes('--fy') ? parseInt(args[args.indexOf('--fy') + 1], 10) : new Date().getFullYear();
  const dryRun = args.includes('--dry-run');
  const verifyAggregates = args.includes('--verify-aggregates');
  const dir = args.includes('--source-dir') ? args[args.indexOf('--source-dir') + 1]
    : path.join(__dirname, '..', 'data', 'ev-sources');

  console.log(`\n  EV Donation Loader -- FY${fyArg}${dryRun ? ' (dry-run)' : ''}${verifyAggregates ? ' (verify-aggregates)' : ''}\n  ${dir}\n`);

  const gbFile  = findFile(dir, /givebutter.*transactions.*\.csv$/i, 'Givebutter transactions');
  // Monthly earnings only. Patreon appends a period suffix (…-earnings_092026.csv), so the
  // trailing .* is required — but the split still holds: the detailed file's substring is
  // "analytics-DETAILED-earnings", which "analytics-earnings" cannot match. Verified against
  // all 7 Patreon exports in data/ev-sources/ (payouts and refunds are excluded too).
  const patFile = findFile(dir, /patreon.*analytics-earnings.*\.csv$/i, 'Patreon earnings');
  // detailed earnings — used for distinct patron count (Phase 81.5)
  const patDetailFile = findFile(dir, /patreon.*detailed-earnings.*\.csv$/i, 'Patreon detailed-earnings');
  const benFile = findFile(dir, /benevity.*disbursement.*\.csv$/i, 'Benevity disbursement');
  if (!gbFile || !patFile || !benFile) {
    console.error('Missing export(s):', { gbFile, patFile, benFile });
    process.exit(1);
  }

  const gbRows  = readCsvRows(gbFile);
  const patRows = readCsvRows(patFile);
  const benRows = readCsvRows(benFile);

  const gb  = parseGiveButter(gbRows, fyArg);
  const pat = parsePatreon(patRows, fyArg);
  const ben = parseBenevity(benRows, fyArg, 'Disbursement Date');

  // Recurring-supporter aggregates (Phase 81.5 — anonymized, no PII)
  const patDetailRows = patDetailFile ? readCsvRows(patDetailFile) : [];
  const aggregates = computeRecurringAggregates(gbRows, patDetailRows, fyArg);

  const bySource = {
    'Give Butter': { gross: gb.gross, fee: gb.fee },
    'Patreon':     { gross: pat.gross, fee: pat.fee },
    'Benevity':    { gross: ben.gross, fee: ben.fee },
  };
  // Non-platform income (D-06/D-09): manual.csv (off-platform cash) + bank Credit Interest.
  // ev-finances.csv is retired — no longer read.
  const carry = [...carryForwardManual(dir, fyArg), ...carryForwardInterest(dir, fyArg)];
  const { categories, total } = buildDonationTree(bySource, carry);

  console.log('Per-source GROSS (FY' + fyArg + '):');
  console.log(`  Give Butter $${gb.gross.toFixed(2)}  (fee $${gb.fee.toFixed(2)}, ${gb.count} txns, exportAsOf ${gb.asOf})`);
  console.log(`  Patreon     $${pat.gross.toFixed(2)}  (fee $${pat.fee.toFixed(2)}, ${pat.count} months)`);
  console.log(`  Benevity    $${ben.gross.toFixed(2)}  (fee $${ben.fee.toFixed(2)}, ${ben.count} disbursed rows)`);
  console.log(`  Carry-forward (manual.csv + bank interest): ${carry.map(c => c.parent + '/' + c.name + ' $' + c.amount.toFixed(2) + ' [' + c.tag + ']').join(', ') || 'none'}`);
  console.log(`  -- Revenue total: $${total.toFixed(2)}\n`);
  const totalFees = gb.fee + pat.fee + ben.fee;
  console.log(`Platform fees (gross->net story, D-09): $${totalFees.toFixed(2)} total\n`);

  console.log(`Recurring-supporter aggregates (FY${fyArg}):`);
  console.log(`  ${aggregates.recurring_supporters} recurring supporters, typical $${aggregates.typical_monthly}/month`);
  console.log(`  Buckets: ${JSON.stringify(aggregates.buckets)}\n`);

  if (dryRun) { console.log('Dry-run -- no writes.'); printTree(categories); return; }

  const sb = await getSupabase();
  const muniId = await getMunicipalityId(sb);
  // ⚠ In-place refresh: reuse the existing budget row so its id is stable across
  // refreshes (see ensureBudget). The webhook rows must be read BEFORE the tree
  // is cleared, and the baseline header written BEFORE the delta is re-applied.
  const budgetId = await ensureBudget(sb, muniId, fyArg, total);
  const webhookRows = await fetchWebhookRows(sb, budgetId);
  const { superseded, delta } = giveButterDedup(webhookRows, gb.asOf);
  console.log(`Webhook rows in FY${fyArg}: ${webhookRows.length} (superseded <=${gb.asOf}: ${superseded.length}, live delta >${gb.asOf}: ${delta.length})`);

  await clearBudgetChildren(sb, budgetId);
  await insertCategories(sb, budgetId, categories, fyArg);
  await setTotalBudget(sb, budgetId, total);
  const deltaSum = await reapplyWebhookDelta(sb, budgetId, delta);
  if (deltaSum) console.log(`Re-applied ${delta.length} post-export webhook donation(s): +$${deltaSum.toFixed(2)}`);

  // Write anonymized micro-donation aggregates onto the Donations category (Phase 81.5).
  // Uses set-if-changed: no-op on re-run if already identical.
  const aggResult = await writeDonationsAggregate(sb, budgetId, aggregates);
  console.log(`Donations category aggregate: ${aggResult.wrote ? 'written' : 'skipped'} (${aggResult.reason})`);

  // ── Header-vs-tree invariant ────────────────────────────────────────────────
  // ⚠⚠ THE 2026-09-20 DIVERGENCE WAS INVISIBLE. total_budget read $4,770.40
  // while the categories beneath it summed to $4,990.40, and nothing failed —
  // the writes that should have kept them equal discarded their errors, so the
  // only symptom was a headline figure disagreeing with its own rows. Whether a
  // reader saw the wrong number depended on which of the two the UI happened to
  // read. This asserts they match, and FAILS the load if they do not.
  const { data: headerRow, error: headerErr } = await sb
    .from('budgets').select('total_budget').eq('id', budgetId).single();
  if (headerErr) throw new Error(`Read back total_budget: ${headerErr.message}`);
  // ⚠ parent_id IS NULL — summing every row double-counts parents and children.
  const { data: topLevel, error: topErr } = await sb
    .from('budget_categories').select('name, amount')
    .eq('budget_id', budgetId).is('parent_id', null);
  if (topErr) throw new Error(`Read back top-level categories: ${topErr.message}`);

  const mismatch = headerTreeMismatch(headerRow.total_budget, topLevel);
  if (mismatch) {
    console.error(`\n❌ HEADER/TREE MISMATCH on FY${fyArg} revenue budget ${budgetId}`);
    console.error(`   budgets.total_budget = $${mismatch.actual.toFixed(2)}`);
    console.error(`   top-level categories = $${mismatch.expected.toFixed(2)}  (${topLevel.map(c => c.name).join(', ')})`);
    console.error(`   difference           = $${mismatch.diff.toFixed(2)}`);
    console.error('   The header and the rows beneath it disagree. A reader sees whichever');
    console.error('   one the UI reads. Do NOT publish this — investigate before re-running.');
    throw new Error(`total_budget $${mismatch.actual.toFixed(2)} != top-level sum $${mismatch.expected.toFixed(2)}`);
  }
  console.log(`Header/tree invariant: OK — total_budget $${Number(headerRow.total_budget).toFixed(2)} = Σ ${topLevel.length} top-level categories`);

  console.log(`\n  FY${fyArg} EV revenue loaded: $${(total + deltaSum).toFixed(2)} (baseline $${total.toFixed(2)} + webhook delta $${deltaSum.toFixed(2)})`);
  console.log(`  RECONCILE: ${aggregates.recurring_supporters} supporters, typical $${aggregates.typical_monthly}/month, FY${fyArg}\n`);

  // --verify-aggregates: recompute from raw CSVs and assert they match what was just persisted
  if (verifyAggregates) {
    console.log('--- Aggregate verification (--verify-aggregates) ---');
    const freshAgg = computeRecurringAggregates(gbRows, patDetailRows, fyArg);
    const { data: catCheck } = await sb
      .from('budget_categories')
      .select('item_count, description')
      .eq('budget_id', budgetId)
      .eq('name', 'Donations')
      .is('parent_id', null)
      .maybeSingle();
    const persistedDesc = catCheck ? JSON.parse(catCheck.description || '{}') : {};
    const persistedMicro = persistedDesc._evMicro || {};
    const ok =
      catCheck?.item_count === freshAgg.recurring_supporters &&
      persistedMicro.recurring_supporters === freshAgg.recurring_supporters &&
      persistedMicro.typical_monthly === freshAgg.typical_monthly;
    if (ok) {
      console.log(`  PASS: persisted item_count=${catCheck.item_count}, typical_monthly=${persistedMicro.typical_monthly}`);
      console.log(`  RECONCILED: ${freshAgg.recurring_supporters} supporters, typical $${freshAgg.typical_monthly}/month, FY${freshAgg.as_of_fy}`);
    } else {
      console.error(`  FAIL: mismatch between freshly-computed and persisted aggregates`);
      console.error(`  Fresh:     supporters=${freshAgg.recurring_supporters}, typical=${freshAgg.typical_monthly}`);
      console.error(`  Persisted: item_count=${catCheck?.item_count}, typical_monthly=${persistedMicro.typical_monthly}`);
      process.exit(1);
    }
  }
}

function printTree(categories) {
  for (const c of categories) {
    console.log(`  ${c.name}  $${c.amount.toFixed(2)}`);
    for (const s of c.subcategories || []) console.log(`     • ${s.name}  $${s.amount.toFixed(2)}`);
  }
}

// Run only when invoked directly (not on import for tests)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Source warnings print LAST, after the summary -- a stale or ambiguous export shows up
  // as a plausible number in the summary, so a warning above it would simply scroll away.
  const strictSources = process.argv.includes('--strict-sources');
  main()
    .then(() => reportSourceWarnings(strictSources))
    .catch(err => {
      console.error('\n❌ Fatal:', err.message);
      reportSourceWarnings(false);
      process.exit(1);
    });
}
