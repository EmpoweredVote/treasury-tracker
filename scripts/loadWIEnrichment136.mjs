#!/usr/bin/env node
/**
 * Phase 136 / MAD-07 — Madison + Dane County category enrichment (inline, $0, no paid API).
 *
 * Bleed-safe `category_enrichment` covering 100% of the categories actually
 * loaded for Madison, WI and Dane County, WI. The worklist is derived LIVE from
 * production (their `budgets` -> `budget_categories`), not from a guessed label
 * list, so coverage is provable against what really landed. CMREB is a flat
 * source, so there are no `budget_line_items` to cover (verified: 0 rows).
 *
 * DESCRIPTIONS ARE SOURCED, NOT INVENTED. Every description here is a
 * plain-language rendering of the WI DOR bulletin's OWN §III line definitions
 * (`cmreb2024.pdf`), and each row carries `source='official'` plus a
 * `source_url`/`source_label` pointing at that bulletin. Most existing enrichment
 * in this database is `source='ai'` with no citation; this run does not add to
 * that pile. Relevant to SRCSTD-01.
 *
 * ── Universal vs scoped ──────────────────────────────────────────────────────
 * Universal rows (municipality_id = NULL) are written only where the concept is
 * generic municipal finance and the wording is state-neutral. Wisconsin-specific
 * statutory detail is deliberately left OUT of universal text so it cannot bleed
 * into other states' categories with the same label — the failure mode recorded
 * in auto-memory project_enrichment_scoping_fix.
 *
 * Three keys get ENTITY-SCOPED overrides because a pre-existing universal row
 * says something materially different from what the line means in this source.
 * Scoped rows win over universal ones, so the override is the fix rather than
 * editing a universal row other cities depend on:
 *
 *   conservation and development — universal reads "Sustainability & Environment
 *     … climate, energy, waste reduction". The bulletin defines it as "public
 *     housing, urban development, economic development, forestry". This is
 *     Madison's LARGEST expenditure line, so the wrong text is high-impact.
 *   ambulance — universal reads "Fire & EMS … fire suppression, rescue". Here
 *     Fire and Ambulance are SEPARATE lines, so fire wording on the ambulance
 *     node is wrong and duplicates the Fire node.
 *   parks and recreation — universal covers only park MAINTENANCE ("parks,
 *     landscaping, street trees, open space") and drops the entire recreation
 *     half the bulletin names: recreation programs, events, ice arenas, pools,
 *     sports fields, zoo.
 *
 * Write discipline: DELETE-THEN-INSERT for every row. The
 * UNIQUE (name_key, municipality_id) constraint treats NULLs as DISTINCT, so an
 * upsert would silently duplicate universal rows (auto-memory
 * reference_category_enrichment_nulls_distinct). Idempotent: a second --apply
 * nets 0 new rows.
 *
 * Usage:
 *   node scripts/loadWIEnrichment136.mjs            # dry-run: worklist + coverage, NO writes
 *   node scripts/loadWIEnrichment136.mjs --apply    # write
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const [k, ...v] = l.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* no env file — rely on the environment */ }
}

const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

const ENTITIES = [
  { name: 'Madison',     entity_type: 'city' },
  { name: 'Dane County', entity_type: 'county' },
];

export const SOURCE_URL   = 'https://www.revenue.wi.gov/SLFReportscotvc/cmreb2024.pdf';
export const SOURCE_LABEL = 'WI DOR County and Municipal Revenues and Expenditures, Bulletin 124 §III (Line Definitions)';
const EVIDENCE = 'Plain-language rendering of the Wisconsin DOR bulletin\'s own §III line definition for this reporting line (Phase 136 / MAD-07). Authored inline at $0; no paid API. Universal rows are worded state-neutrally so they cannot carry state-specific statutory detail into other jurisdictions.';
const GENERATED_AT = process.env.WI136_TS || '2026-07-27T00:00:00.000Z';

// ── Universal rows: generic concept, state-neutral wording ────────────────────
export const UNIVERSAL = {
  'tax increments': { plain_name: 'Tax Increment Revenue', short_description: 'Property-tax revenue captured inside a tax increment finance district.', description: 'Property-tax levies collected within a tax incremental finance (TIF) district. The increase in taxable value created by development inside the district is captured to repay the cost of that development rather than flowing to general operations.', tags: ['revenue', 'tax', 'tif', 'development'] },
  'inlieu of taxes': { plain_name: 'Payments In Lieu of Taxes', short_description: 'Payments from tax-exempt entities instead of property tax.', description: 'Payments received from entities that do not pay ordinary property tax — most often government-owned utilities and other exempt organisations — made in place of the tax they would otherwise owe.', tags: ['revenue', 'tax', 'pilot'] },
  'federal aids': { plain_name: 'Federal Aid', short_description: 'Grants and aid received from the federal government.', description: 'Money received from the federal government, typically as grants supporting public safety, transportation, sanitation, public housing and similar programmes. Amounts can swing sharply year to year as individual grant programmes start and finish.', tags: ['revenue', 'intergovernmental', 'federal', 'grants'] },
  'state shared revenues': { plain_name: 'State Shared Revenue', short_description: 'General-purpose revenue shared by the state with local governments.', description: 'Money the state distributes to local governments under a statutory sharing formula, usable for general operations rather than tied to a specific project. For many smaller municipalities it is one of the largest single revenue sources.', tags: ['revenue', 'intergovernmental', 'state'] },
  'state highway aids': { plain_name: 'State Highway Aid', short_description: 'State transportation aid for local roads.', description: 'State aid directed at local transportation — maintaining and improving roads and streets, plus related items such as flood damage repair. Restricted to transportation purposes rather than general operations.', tags: ['revenue', 'intergovernmental', 'state', 'transportation'] },
  'all other state aids': { plain_name: 'Other State Aid', short_description: 'State aid other than shared revenue and highway aid.', description: 'State aid that is not general shared revenue or highway aid — including insurance-tax distributions, other shared taxes, and programme aid for public safety, sanitation, health, human services, public housing, forestry and payments for municipal services.', tags: ['revenue', 'intergovernmental', 'state'] },
  'other local govt aids': { plain_name: 'Aid From Other Local Governments', short_description: 'Money received from neighbouring or overlapping governments.', description: 'Money received from other local governments — commonly shared highway and bridge costs, plus grants and cost-sharing arrangements between neighbouring or overlapping jurisdictions.', tags: ['revenue', 'intergovernmental', 'local'] },
  'public charges for services': { plain_name: 'Charges for Services', short_description: 'Fees paid by users for specific services.', description: 'Fees paid by residents, organisations and businesses for services delivered directly to them — refuse collection, landfill use, fire and ambulance service, snow ploughing, recreation facility and equipment rental, copies and publication charges.', tags: ['revenue', 'charges', 'fees'] },
  'intergovernmental charges for services': { plain_name: 'Charges to Other Governments', short_description: 'Payments from other governments for services delivered to them.', description: 'Money received from federal, state, county or other local governments for services performed on their behalf under contract — for example fire and ambulance coverage or highway maintenance provided to a neighbouring jurisdiction.', tags: ['revenue', 'intergovernmental', 'charges', 'contracts'] },
  'fines, forfeits and penalties': { plain_name: 'Fines & Forfeitures', short_description: 'Revenue from violations, forfeitures and damage awards.', description: 'Revenue from penalties for breaking laws and local ordinances, forfeited contracts and bonds, and judgments or damages awarded to the government.', tags: ['revenue', 'fines', 'court'] },
  'interest income': { plain_name: 'Interest Income', short_description: 'Interest earned on invested cash and receivables.', description: 'Interest earned on the government\'s invested cash and reserves, and on outstanding special assessments. Rises and falls with both interest rates and how much cash the government is holding.', tags: ['revenue', 'interest', 'investment'] },
  'law enforcement': { plain_name: 'Law Enforcement', short_description: 'Policing and law-enforcement services.', description: 'Day-to-day operating cost and equipment purchases for law-enforcement services — patrol, investigation, dispatch of officers and the staff and vehicles supporting them. Typically among the largest spending lines for a municipality.', tags: ['spending', 'public-safety', 'police'] },
  'other public safety': { plain_name: 'Other Public Safety', short_description: 'Public-safety functions besides police, fire and ambulance.', description: 'Public-safety spending outside policing, fire and ambulance — building and code inspection, emergency communications and dispatch, correction and detention, civil defence and emergency management.', tags: ['spending', 'public-safety', 'inspections'] },
  'highway maintainence and administration': { plain_name: 'Road Maintenance & Administration', short_description: 'Maintaining existing roads, plus engineering and equipment.', description: 'Keeping existing roads and streets serviceable — routine maintenance, snow and ice control, engineering, and the garages, buildings and equipment the road crews depend on. Distinct from building new roads.', tags: ['spending', 'transportation', 'roads', 'maintenance'] },
  'highway construction': { plain_name: 'Road Construction', short_description: 'Building and reconstructing roads.', description: 'Building new roads and reconstructing existing ones. Because it is capital work, this line is lumpy — it can jump sharply in a year with a major project and fall away afterwards.', tags: ['spending', 'transportation', 'roads', 'capital'] },
  'road- related facilities': { plain_name: 'Road-Related Facilities', short_description: 'Sidewalks, street lighting, storm sewers and parking.', description: 'Spending on infrastructure alongside the roadway rather than the roadway itself — sidewalks, street lighting, storm sewers, parking facilities and limited-purpose roads.', tags: ['spending', 'transportation', 'infrastructure'] },
  'other transportation': { plain_name: 'Other Transportation', short_description: 'Transit, airports, harbours and other transport facilities.', description: 'Transportation spending other than roads — public and mass transit, airports, docks and harbours, and other transport facilities. Where a government runs transit inside its general operations rather than as a separate utility, this line can be very large.', tags: ['spending', 'transportation', 'transit', 'airport'] },
  'solid waste collection and disposal': { plain_name: 'Trash & Recycling', short_description: 'Refuse collection, recycling and landfill.', description: 'Collecting household and commercial refuse, running recycling programmes, and operating or paying for landfill and other solid-waste disposal.', tags: ['spending', 'sanitation', 'recycling', 'waste'] },
  'other sanitation': { plain_name: 'Other Sanitation', short_description: 'Sewerage, water mains and nuisance control run inside general operations.', description: 'Sanitation work carried out within general government operations rather than as a separate utility — sewage service, water main construction, and weed and nuisance control.', tags: ['spending', 'sanitation', 'sewer', 'water'] },
  'culture and education': { plain_name: 'Libraries & Culture', short_description: 'Libraries, museums, theatres and cultural activity.', description: 'Running libraries, museums, theatres and other cultural facilities and programmes. At county level this line can also carry specialised schools the county operates.', tags: ['spending', 'culture', 'library', 'education'] },
  'debt service - principal interest': { plain_name: 'Debt Principal & Interest', short_description: 'Repaying borrowed money and the interest on it.', description: 'Scheduled repayment of long-term borrowing — the principal originally borrowed together with the interest charged on it. A commitment fixed by past borrowing decisions rather than a discretionary annual choice.', tags: ['spending', 'debt-service', 'principal', 'interest'] },
  'debt service - fiscal changes': { plain_name: 'Debt Fiscal Charges', short_description: 'Administrative costs of carrying debt.', description: 'Fees and fiscal charges incurred in issuing and servicing debt — paying agent and trustee fees, issuance costs and similar administrative charges, separate from principal and interest.', tags: ['spending', 'debt-service', 'fees'] },
};

// ── Entity-scoped overrides: the universal row is wrong for this source ───────
export const SCOPED_OVERRIDES = {
  'conservation and development': { plain_name: 'Housing & Economic Development', short_description: 'Public housing, urban and economic development, and forestry.', description: 'Spending on public housing, urban redevelopment, economic development and forestry, plus other conservation and development activity. Despite the name this line is mainly about housing and development rather than environmental programmes, and it includes capital projects — which can make it one of the largest spending lines in a year with major redevelopment underway.', tags: ['spending', 'housing', 'economic-development', 'forestry'] },
  'ambulance': { plain_name: 'Ambulance & EMS', short_description: 'Ambulance and emergency medical services.', description: 'Operating cost and equipment for ambulance and emergency medical response. Reported separately from fire protection in this source, so a government that runs EMS through its fire department may show little or nothing here.', tags: ['spending', 'public-safety', 'ems', 'ambulance'] },
  'parks and recreation': { plain_name: 'Parks & Recreation', short_description: 'Parks and zoos, plus recreation programmes and facilities.', description: 'Parks, open space and zoos together with the recreation side — programmes such as swimming lessons and youth sport, community events and holiday decorations, and facilities including pools, ice arenas and sports fields.', tags: ['spending', 'parks', 'recreation', 'community'] },
};

// ── Guards ────────────────────────────────────────────────────────────────────
const text = (r) => `${r.plain_name} ${r.short_description} ${r.description}`;
export function findDollarLeaks(rows) {
  return rows.filter((r) => /\$\s?\d|\d[\d,]{5,}/.test(text(r)));
}
/** Universal text must never name a jurisdiction — that is how state text bleeds. */
export function findLocalityLeaks(rows) {
  const banned = /\b(Madison|Dane|Wisconsin|WI DOR)\b/i;
  return rows.filter((r) => r.municipality_id === null && banned.test(text(r)));
}

function row(nameKey, def, municipalityId) {
  return {
    name_key: nameKey,
    municipality_id: municipalityId,
    plain_name: def.plain_name,
    description: def.description,
    short_description: def.short_description,
    tags: def.tags,
    source: 'official',
    source_url: SOURCE_URL,
    source_label: SOURCE_LABEL,
    confidence: 'high',
    evidence_summary: EVIDENCE,
    generated_at: GENERATED_AT,
  };
}

async function main() {
  console.log(`MAD-07 enrichment${APPLY ? '' : ' (dry-run)'}\n`);

  // 1. Live worklist: what actually loaded, per entity.
  const perEntity = new Map();
  const allKeys = new Set();
  for (const e of ENTITIES) {
    const { data: muni, error: mErr } = await db.from('municipalities')
      .select('id').eq('name', e.name).eq('state', 'WI').eq('entity_type', e.entity_type).maybeSingle();
    if (mErr || !muni) { console.error(`  ${e.name} not found — run seedWisconsinMadison.js first`); process.exit(1); }
    const { data: cats, error: cErr } = await db.from('budget_categories')
      .select('name, budget_id, budgets!inner(municipality_id)')
      .eq('budgets.municipality_id', muni.id);
    if (cErr) { console.error(`  category read failed for ${e.name}: ${cErr.message}`); process.exit(1); }
    const keys = new Set(cats.map((c) => c.name.trim().toLowerCase()));
    perEntity.set(e.name, { id: muni.id, keys });
    for (const k of keys) allKeys.add(k);
    console.log(`  ${e.name}: ${keys.size} distinct categories loaded`);
  }
  console.log(`  union: ${allKeys.size} distinct keys\n`);

  // 2. Existing coverage.
  const { data: existing, error: eErr } = await db.from('category_enrichment')
    .select('name_key, municipality_id').in('name_key', [...allKeys]);
  if (eErr) { console.error(`  coverage read failed: ${eErr.message}`); process.exit(1); }
  const universalKeys = new Set(existing.filter((r) => r.municipality_id === null).map((r) => r.name_key));

  // 3. Build the write set.
  const rows = [];
  for (const k of [...allKeys].sort()) {
    if (SCOPED_OVERRIDES[k]) {
      for (const [name, { id, keys }] of perEntity) {
        if (keys.has(k)) rows.push(row(k, SCOPED_OVERRIDES[k], id));
      }
      continue;
    }
    if (universalKeys.has(k)) continue;                  // already covered universally
    if (!UNIVERSAL[k]) { console.error(`  NO TEXT AUTHORED for "${k}"`); process.exitCode = 1; continue; }
    rows.push(row(k, UNIVERSAL[k], null));
  }

  const uni = rows.filter((r) => r.municipality_id === null).length;
  console.log(`  to write: ${rows.length} rows (${uni} universal, ${rows.length - uni} entity-scoped)`);

  // 4. Guards before any write.
  const dollars = findDollarLeaks(rows);
  const locality = findLocalityLeaks(rows);
  if (dollars.length) { console.error(`  GUARD FAIL: ${dollars.length} row(s) contain a $ figure: ${dollars.map(r => r.name_key).join(', ')}`); process.exit(1); }
  if (locality.length) { console.error(`  GUARD FAIL: ${locality.length} universal row(s) name a jurisdiction: ${locality.map(r => r.name_key).join(', ')}`); process.exit(1); }
  console.log('  guards: no $ figures, no jurisdiction names in universal text\n');

  // 5. Coverage proof — every loaded key must end up covered for every entity.
  const willCover = (k, entityId) =>
    universalKeys.has(k) || rows.some((r) => r.name_key === k && (r.municipality_id === null || r.municipality_id === entityId));
  let gaps = 0;
  for (const [name, { id, keys }] of perEntity) {
    const missing = [...keys].filter((k) => !willCover(k, id));
    if (missing.length) { console.error(`  COVERAGE GAP ${name}: ${missing.join(', ')}`); gaps += missing.length; }
  }
  if (gaps) process.exit(1);
  console.log(`  coverage: 100% of loaded categories for both entities\n`);

  if (!APPLY) {
    for (const r of rows) {
      console.log(`  [${r.municipality_id === null ? 'universal' : 'scoped   '}] ${r.name_key} -> ${r.plain_name}`);
    }
    console.log('\n[dry-run] no writes. Re-run with --apply.');
    return;
  }

  // 6. Delete-then-insert (never upsert: NULL municipality_id is DISTINCT in the
  //    unique index, so upsert duplicates universal rows).
  let wrote = 0;
  for (const r of rows) {
    const del = db.from('category_enrichment').delete().eq('name_key', r.name_key);
    const { error: dErr } = await (r.municipality_id === null
      ? del.is('municipality_id', null)
      : del.eq('municipality_id', r.municipality_id));
    if (dErr) { console.error(`  delete failed for ${r.name_key}: ${dErr.message}`); process.exit(1); }
    const { error: iErr } = await db.from('category_enrichment').insert(r);
    if (iErr) { console.error(`  insert failed for ${r.name_key}: ${iErr.message}`); process.exit(1); }
    wrote++;
  }
  console.log(`  wrote ${wrote} rows.`);

  // 7. Verify against the database rather than trusting the loop.
  const { data: after } = await db.from('category_enrichment')
    .select('name_key, municipality_id').in('name_key', [...allKeys]);
  const cover = (k, id) => after.some((r) => r.name_key === k && (r.municipality_id === null || r.municipality_id === id));
  for (const [name, { id, keys }] of perEntity) {
    const missing = [...keys].filter((k) => !cover(k, id));
    console.log(`  verified ${name}: ${keys.size - missing.length}/${keys.size} covered${missing.length ? ` — MISSING ${missing.join(', ')}` : ''}`);
    if (missing.length) process.exitCode = 1;
  }
  const dupes = [...allKeys].filter((k) => after.filter((r) => r.name_key === k && r.municipality_id === null).length > 1);
  console.log(dupes.length ? `  DUPLICATE universal rows: ${dupes.join(', ')}` : '  no duplicate universal rows');
  if (dupes.length) process.exitCode = 1;
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
