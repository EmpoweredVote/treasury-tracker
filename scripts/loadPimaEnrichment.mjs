#!/usr/bin/env node
/**
 * Phase 132-03 — Pima County cities category enrichment loader (inline, $0; NO paid API).
 *
 * Bleed-safe category_enrichment covering 100% of the GF categories the four Pima
 * cities loaded in 132-02 (Oro Valley, Marana, Sahuarita, South Tucson). The
 * worklist is derived LIVE from production: those cities' loaded `budgets`
 * (operating + revenue, all FYs) -> their `budget_categories` (depth 0/1) AND
 * `budget_line_items` (the icicle-leaf function/source labels) -> the distinct
 * set of keys (link_key, else lowercased trimmed name/description). Not a guessed
 * label list — coverage is provably against what actually loaded, and it covers
 * BOTH the category nodes and the leaf items the icicle expands into.
 *
 * Much is already covered by pre-existing universal rows (Tucson v2.17 + the CA /
 * MN / OH / state loaders). The coverage gate checks the live DB first and only
 * authors keys that are NOT already covered (universal OR one of the four
 * cities). Every key this run authors is a generic, shareable GAAP concept -> all
 * are written UNIVERSAL (municipality_id = NULL); none are city-specific.
 *
 * Write discipline: universal rows are DELETE-THEN-INSERT (the
 * (name_key, municipality_id) index is NULLS DISTINCT — upsert duplicates
 * universal rows). Idempotent: a second --apply nets 0 new rows.
 *
 * Guards before any write: a $-figure leak guard + an AZ locality-name leak guard
 * (universal text must never carry a city name).
 *
 * Usage:
 *   node scripts/loadPimaEnrichment.mjs           # dry-run: worklist + coverage, NO write
 *   node scripts/loadPimaEnrichment.mjs --apply    # write universal rows (delete-then-insert)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}

const CITY_NAMES = ['Oro Valley', 'Marana', 'Sahuarita', 'South Tucson'];
const GENERATED_AT = process.env.PIMA132_TS || '2026-07-17T00:00:00.000Z';
const EVIDENCE = 'Inline-authored plain-language description for a General Fund budget category shared across Pima County, AZ municipalities (Phase 132-03). Generic GAAP/ACFR concepts, authored as universal (bleed-safe, no city text or dollar figures).';

// ── Universal enrichment for the 19 keys not already covered (all generic) ────
const ENRICHMENT = {
  // Revenue-source concepts
  'city sales taxes':        { plain_name: 'City Sales Taxes', short_description: 'Local sales/transaction-privilege tax on retail activity.', description: 'Revenue from the city or town portion of the sales (transaction privilege) tax charged on retail sales and other taxable business activity within the jurisdiction. Often the largest single General Fund revenue source for a municipality.', tags: ['tax', 'sales-tax', 'revenue'], confidence: 0.95 },
  'franchise taxes':         { plain_name: 'Franchise Taxes', short_description: 'Fees paid by utilities to use public rights-of-way.', description: 'Charges paid by utility and cable companies for the privilege of operating and running lines across public streets and rights-of-way. A recurring General Fund revenue source tied to utility activity.', tags: ['tax', 'franchise', 'revenue'], confidence: 0.95 },
  'contributions':           { plain_name: 'Contributions', short_description: 'Money received from outside or private parties.', description: 'Revenue received as contributions from outside sources — donations, developer or private-party contributions, and similar inflows that are not taxes or charges for services.', tags: ['revenue', 'contributions'], confidence: 0.9 },
  'lease income':            { plain_name: 'Lease Income', short_description: 'Rent from leasing government-owned property.', description: 'Revenue earned by leasing or renting government-owned land, buildings, or facilities to tenants. A property-based General Fund revenue source.', tags: ['revenue', 'lease', 'rent'], confidence: 0.92 },
  'investment income':       { plain_name: 'Investment Income', short_description: 'Earnings on invested public funds.', description: 'Income earned on the government’s invested cash and reserves, including interest and other returns from its investment portfolio.', tags: ['revenue', 'investment', 'interest'], confidence: 0.93 },
  'investment earnings':     { plain_name: 'Investment Earnings', short_description: 'Interest and returns on invested funds.', description: 'Earnings on invested public funds, including interest and realized returns from the government’s investment portfolio.', tags: ['revenue', 'investment', 'interest'], confidence: 0.93 },
  'investment earnings (losses)': { plain_name: 'Investment Earnings (Losses)', short_description: 'Net investment return, which can be negative.', description: 'The net return on invested public funds for the year, reported as earnings or losses — the figure can be negative when market values decline.', tags: ['revenue', 'investment'], confidence: 0.9 },
  'change in fair value of investments': { plain_name: 'Change in Investment Value', short_description: 'Unrealized gain or loss on investments.', description: 'The unrealized change in the market (fair) value of the government’s investment holdings during the year, marked to market — a gain when values rise, a loss when they fall.', tags: ['revenue', 'investment', 'fair-value'], confidence: 0.9 },
  'net increase/(decrease) in fair value of investments': { plain_name: 'Net Change in Investment Value', short_description: 'Unrealized market-value change on investments.', description: 'The net unrealized change in the market (fair) value of investment holdings during the year — reported as an increase or decrease depending on how market prices moved.', tags: ['revenue', 'investment', 'fair-value'], confidence: 0.9 },
  'net increase in the fair value of investments': { plain_name: 'Net Increase in Investment Value', short_description: 'Unrealized rise in investment market value.', description: 'The net unrealized increase in the market (fair) value of the government’s investment holdings during the year, reflecting favorable market movement.', tags: ['revenue', 'investment', 'fair-value'], confidence: 0.9 },
  'net (decrease) in fair value of investments': { plain_name: 'Net Decrease in Investment Value', short_description: 'Unrealized decline in investment market value.', description: 'The net unrealized decrease in the market (fair) value of the government’s investment holdings during the year, reflecting unfavorable market movement.', tags: ['revenue', 'investment', 'fair-value'], confidence: 0.9 },
  'fines, forfeitures & penalties': { plain_name: 'Fines, Forfeitures & Penalties', short_description: 'Revenue from citations, court fines, and penalties.', description: 'Revenue from court fines, traffic and code-enforcement citations, forfeited bonds, and other penalties assessed by the jurisdiction.', tags: ['revenue', 'fines', 'court'], confidence: 0.93 },
  'licenses, fees & permits': { plain_name: 'Licenses, Fees & Permits', short_description: 'Charges for licenses, permits, and regulatory fees.', description: 'Revenue from business and regulatory licenses, building and development permits, and related fees charged for the right to conduct a regulated activity.', tags: ['revenue', 'permits', 'licenses'], confidence: 0.93 },
  'licenses, fees and permits': { plain_name: 'Licenses, Fees & Permits', short_description: 'Charges for licenses, permits, and regulatory fees.', description: 'Revenue from business and regulatory licenses, building and development permits, and related fees charged for the right to conduct a regulated activity.', tags: ['revenue', 'permits', 'licenses'], confidence: 0.93 },
  // Expenditure function / component concepts
  'highways and streets':    { plain_name: 'Highways & Streets', short_description: 'Roads, streets, and related infrastructure.', description: 'Spending on building and maintaining public roads, streets, sidewalks, traffic control, and related transportation infrastructure.', tags: ['spending', 'transportation', 'infrastructure'], confidence: 0.94 },
  'culture and recreation':  { plain_name: 'Culture & Recreation', short_description: 'Parks, recreation, and cultural programs.', description: 'Spending on parks, recreation facilities and programs, libraries, and cultural or community activities that serve residents’ quality of life.', tags: ['spending', 'parks', 'recreation', 'culture'], confidence: 0.94 },
  'health and welfare':      { plain_name: 'Health & Welfare', short_description: 'Public health and social-service programs.', description: 'Spending on public health, human services, and social-assistance programs that support residents’ health and welfare.', tags: ['spending', 'health', 'welfare', 'social-services'], confidence: 0.93 },
  'economic and community development': { plain_name: 'Economic & Community Development', short_description: 'Planning, development, and economic programs.', description: 'Spending on community planning, land-use and development services, housing, and programs that support local economic growth and neighborhood improvement.', tags: ['spending', 'development', 'economic-development'], confidence: 0.92 },
  'principal':               { plain_name: 'Principal', short_description: 'Repayment of debt principal.', description: 'The portion of debt-service spending that repays the original amount borrowed (the principal) on the government’s bonds, loans, and other long-term debt, separate from interest.', tags: ['spending', 'debt-service', 'principal'], confidence: 0.93 },
};

export function findDollarLeaks(rows) {
  return rows.filter(r => /\$\s?\d/.test(`${r.plain_name} ${r.short_description} ${r.description}`));
}
export function findLocalityLeaks(rows, localityNames) {
  const names = [...new Set((localityNames || []).map(n => (n || '').toLowerCase().trim()))].filter(Boolean);
  const res = [];
  for (const r of rows.filter(r => r.municipality_id === null)) {
    const text = `${r.plain_name} ${r.short_description} ${r.description}`.toLowerCase();
    for (const n of names) {
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (re.test(text)) { res.push({ name_key: r.name_key, leaked: n }); break; }
    }
  }
  return res;
}

function buildRow(nameKey) {
  const c = ENRICHMENT[nameKey];
  return {
    name_key: nameKey, municipality_id: null,
    plain_name: c.plain_name, short_description: c.short_description, description: c.description,
    tags: c.tags, source: 'ai', confidence: c.confidence, evidence_summary: EVIDENCE, generated_at: GENERATED_AT,
  };
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or service key.'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  // 1. Resolve the four municipality_ids.
  const { data: munis, error: mErr } = await supabase.from('municipalities')
    .select('id,name').eq('state', 'AZ').eq('entity_type', 'city').in('name', CITY_NAMES);
  if (mErr || !munis?.length) { console.error('Pima cities not found:', mErr?.message); process.exit(1); }
  const cityIds = munis.map(m => m.id);
  if (cityIds.length !== CITY_NAMES.length) { console.error(`Expected ${CITY_NAMES.length} cities, found ${cityIds.length} — run 132-01/02 first.`); process.exit(1); }

  // 2. AZ locality names (universal-row bleed guard).
  const { data: azMunis } = await supabase.from('municipalities').select('name').eq('state', 'AZ');
  const localityNames = (azMunis || []).map(m => m.name);

  // 3. Loaded budgets for the four cities.
  const { data: budgets, error: bErr } = await supabase.from('budgets')
    .select('id').in('municipality_id', cityIds).in('dataset_type', ['operating', 'revenue']);
  if (bErr) { console.error('budgets fetch error:', bErr.message); process.exit(1); }
  const bids = (budgets || []).map(b => b.id);
  if (!bids.length) { console.error('No Pima-city operating/revenue budgets found — run 132-02 first.'); process.exit(1); }

  // 4. Distinct live keys: budget_categories (depth 0/1) + budget_line_items (icicle leaves).
  const keys = new Set();
  for (let i = 0; i < bids.length; i += 25) {
    const slice = bids.slice(i, i + 25);
    // categories
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('budget_categories').select('id,name,link_key').in('budget_id', slice).in('depth', [0, 1]).order('id').range(from, from + 999);
      if (error) { console.error('budget_categories error:', error.message); process.exit(1); }
      for (const c of (data || [])) { const k = (c.link_key || (c.name || '').toLowerCase().trim()); if (k) keys.add(k); }
      if (!data || data.length < 1000) break;
    }
    // line items (via their category)
    const { data: cats } = await supabase.from('budget_categories').select('id').in('budget_id', slice);
    const catIds = (cats || []).map(c => c.id);
    for (let j = 0; j < catIds.length; j += 50) {
      const cslice = catIds.slice(j, j + 50);
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('budget_line_items').select('description').in('category_id', cslice).order('id').range(from, from + 999);
        if (error) { console.error('budget_line_items error:', error.message); process.exit(1); }
        for (const li of (data || [])) { const k = (li.description || '').toLowerCase().trim(); if (k) keys.add(k); }
        if (!data || data.length < 1000) break;
      }
    }
  }
  const liveKeys = [...keys].sort();
  if (!liveKeys.length) { console.error('ABORT: 0 live keys found.'); process.exit(1); }

  // 5. Existing coverage (universal OR any of the four cities).
  const orExpr = `municipality_id.is.null,municipality_id.in.(${cityIds.join(',')})`;
  const existingKeys = new Set();
  for (let i = 0; i < liveKeys.length; i += 100) {
    const chunk = liveKeys.slice(i, i + 100);
    const { data, error } = await supabase.from('category_enrichment').select('name_key,municipality_id').in('name_key', chunk).or(orExpr);
    if (error) { console.error('category_enrichment fetch error:', error.message); process.exit(1); }
    for (const e of (data || [])) existingKeys.add(e.name_key);
  }

  // 6. Gap = live keys not covered; each must be in the ENRICHMENT map.
  const toAuthor = [], missing = [];
  for (const k of liveKeys) {
    if (existingKeys.has(k)) continue;
    if (!ENRICHMENT[k]) { missing.push(k); continue; }
    toAuthor.push(k);
  }
  const rows = toAuthor.map(buildRow);
  const dollarLeaks = findDollarLeaks(rows);
  const localityLeaks = findLocalityLeaks(rows, localityNames);
  const covered = liveKeys.length - missing.length;

  console.log('=== Phase 132-03 Pima cities enrichment (live worklist) ===');
  console.log('cities:', munis.map(m => `${m.name}(${m.id.slice(0, 8)})`).join(', '));
  console.log('operating+revenue budgets:', bids.length, '| live distinct keys:', liveKeys.length);
  console.log('already covered (pre-existing universal/city row):', liveKeys.length - toAuthor.length - missing.length);
  console.log('to author this run (all universal):', rows.length);
  console.log(`coverage: ${covered}/${liveKeys.length}`);
  console.log('\n--- keys to author ---');
  for (const k of toAuthor) console.log(`  [universal] ${k} -> "${ENRICHMENT[k].plain_name}"`);
  console.log('\nMISSING (live key, not covered, not in map — must be 0):', missing.length, missing.length ? '\n  ' + missing.join('\n  ') : '');
  console.log('$-leak rows (must be 0):', dollarLeaks.length);
  console.log('AZ locality-leak rows (must be 0):', localityLeaks.length, localityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', '));

  if (missing.length) { console.error(`ABORT: ${missing.length} live key(s) uncovered and not in map.`); process.exit(1); }
  if (dollarLeaks.length) { console.error('ABORT: $-figure leak in authored text'); process.exit(1); }
  if (localityLeaks.length) { console.error('ABORT: AZ locality-name leak in universal text'); process.exit(1); }

  if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply.'); process.exit(0); }
  if (!rows.length) { console.log('\nNothing to write — already 100% covered.'); process.exit(0); }

  // Universal rows: delete-then-insert (NULLS DISTINCT).
  const keysToWrite = rows.map(r => r.name_key);
  for (let i = 0; i < keysToWrite.length; i += 100) {
    const chunk = keysToWrite.slice(i, i + 100);
    const { error } = await supabase.from('category_enrichment').delete().is('municipality_id', null).in('name_key', chunk);
    if (error) { console.error('universal delete error:', error.message); process.exit(1); }
  }
  const { error: insErr } = await supabase.from('category_enrichment').insert(rows);
  if (insErr) { console.error('universal insert error:', insErr.message); process.exit(1); }
  console.log(`\nDone. Wrote ${rows.length} universal category_enrichment row(s) (delete-then-insert).`);
}

const entry = (process.argv[1] || '').replace(/\\/g, '/');
if (entry.endsWith('loadPimaEnrichment.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
