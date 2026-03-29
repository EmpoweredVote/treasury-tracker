#!/usr/bin/env node
/**
 * Category Enrichment Pipeline
 *
 * Generates plain-language descriptions for opaque budget fund/category names
 * using Claude API + transactional evidence from the database.
 *
 * For each unenriched category:
 *   1. Fetch line item names + amounts
 *   2. Fetch top vendor/payee names from linked transactions
 *   3. Call Claude with context → get plain_name, description, tags, confidence
 *   4. Store result in treasury.category_enrichment
 *
 * Usage:
 *   node scripts/enrichCategories.js --city "Bloomington" --state "IN"
 *   node scripts/enrichCategories.js --all
 *   node scripts/enrichCategories.js --state IN --entity-type city
 *   node scripts/enrichCategories.js --city "Bloomington" --state "IN" --dry-run
 *   node scripts/enrichCategories.js --all --concurrency 5 --limit 100
 *   node scripts/enrichCategories.js --all --skip-universal --dataset-format gateway
 *   node scripts/enrichCategories.js --city "Bloomington" --state "IN" --depth 1
 *   node scripts/enrichCategories.js --city "Bloomington" --state "IN" --depth all
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Env Loading ─────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env.local');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    }
  } catch {}
  try {
    const envPath = resolve(__dirname, '../.env');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch {}
}

loadEnv();

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? true] : null)
    .filter(Boolean)
);

const CITY = args.city || null;
const STATE = args.state || null;
const YEAR = parseInt(args.year || '2025');
const DRY_RUN = 'dry-run' in args;
const FORCE = 'force' in args;
const ALL_MODE = 'all' in args;
const ENTITY_TYPE = args['entity-type'] || null;
const DATASET_FORMAT = args['dataset-format'] || 'auto'; // gateway | cafr | auto
const CONCURRENCY = parseInt(args.concurrency || '3');
const SKIP_UNIVERSAL = 'skip-universal' in args;
const LIMIT = args.limit ? parseInt(args.limit) : null;
const DEPTH = args.depth || '0'; // '0' = top-level only (default), '1' = depth 1, 'all' = all depths

// Validate args
if (!ALL_MODE && !CITY) {
  // Default to single-city mode requiring --city
  console.error('Usage: --city "Name" --state "IN" OR --all [--state IN] [--entity-type city|township|county]');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error('Missing ANTHROPIC_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'treasury' }
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ─── Progress File ────────────────────────────────────────────────────────────

const PROGRESS_FILE = resolve(__dirname, '.enrichment-progress.json');

function loadProgress() {
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { processed: [], failed: [] }; }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ─── Format Detection ─────────────────────────────────────────────────────────

/**
 * Auto-detect dataset format from fund/category names.
 * Returns 'cafr' | 'gateway' | 'unknown'
 */
function detectFormat(categoryNames) {
  const cafrPatterns = [
    'general government and public safety',
    'electric enterprise fund',
    'transportation and community development',
    'taxes',
    'charges for current services',
  ];
  const gatewayPatterns = [
    /^[A-Z\s&\-#()]+$/,      // ALL_CAPS names
    /motor vehicle highway/i,
    /local road/i,
    /cumulative capital/i,
  ];

  const names = categoryNames.map(n => n.toLowerCase());
  const cafrScore = cafrPatterns.filter(p => names.some(n => n.includes(p))).length;
  const gatewayScore = categoryNames.filter(n => /^[A-Z\s&\-#()]+$/.test(n)).length;

  if (cafrScore >= 2) return 'cafr';
  if (gatewayScore >= 3) return 'gateway';
  return 'unknown';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(name) {
  return (name || '').toLowerCase().trim();
}

async function getMunicipality(city, state) {
  const { data, error } = await supabase
    .from('municipalities')
    .select('id, name, state, entity_type, population')
    .ilike('name', city)
    .eq('state', state)
    .single();
  if (error || !data) throw new Error(`Municipality not found: ${city}, ${state}`);
  return data;
}

async function getAllMunicipalities({ state, entityType } = {}) {
  let query = supabase
    .from('municipalities')
    .select('id, name, state, entity_type, population')
    .order('name');

  if (state) query = query.eq('state', state);
  if (entityType) query = query.eq('entity_type', entityType);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch municipalities: ${error.message}`);
  return data || [];
}

async function getBudgetCategories(municipalityId) {
  const { data: budgets } = await supabase
    .from('budgets')
    .select('id, dataset_type, fiscal_year, total_budget')
    .eq('municipality_id', municipalityId)
    .eq('fiscal_year', YEAR);

  if (!budgets?.length) return [];

  const allCategories = [];
  for (const budget of budgets) {
    let query = supabase
      .from('budget_categories')
      .select('id, name, amount, percentage, parent_id, link_key, depth')
      .eq('budget_id', budget.id)
      .order('amount', { ascending: false });

    if (DEPTH === '0') {
      query = query.is('parent_id', null);
    } else if (DEPTH !== 'all') {
      query = query.eq('depth', parseInt(DEPTH));
    }
    // 'all' = no depth filter

    const { data: cats } = await query;

    if (cats) {
      // For subcategories, fetch parent name for context
      const parentIds = [...new Set(cats.filter(c => c.parent_id).map(c => c.parent_id))];
      let parentMap = {};
      if (parentIds.length > 0) {
        const { data: parents } = await supabase
          .from('budget_categories')
          .select('id, name')
          .in('id', parentIds);
        if (parents) {
          parentMap = Object.fromEntries(parents.map(p => [p.id, p.name]));
        }
      }

      allCategories.push(...cats.map(c => ({
        ...c,
        budget_id: budget.id,
        dataset_type: budget.dataset_type,
        total_budget: budget.total_budget,
        parent_name: c.parent_id ? (parentMap[c.parent_id] || null) : null,
      })));
    }
  }
  return allCategories;
}

/**
 * Returns a Set of name_keys that are already enriched (universal OR municipality-specific).
 */
async function getExistingEnrichments(municipalityId) {
  const { data } = await supabase
    .from('category_enrichment')
    .select('name_key, municipality_id')
    .or(`municipality_id.eq.${municipalityId},municipality_id.is.null`);
  return new Set((data || []).map(e => e.name_key));
}

/**
 * Returns a Set of name_keys that have universal enrichments (municipality_id IS NULL).
 */
async function getUniversalEnrichments() {
  const { data } = await supabase
    .from('category_enrichment')
    .select('name_key')
    .is('municipality_id', null);
  return new Set((data || []).map(e => e.name_key));
}

async function getLineItems(categoryId) {
  const { data } = await supabase
    .from('budget_line_items')
    .select('description, amount')
    .eq('category_id', categoryId)
    .order('amount', { ascending: false })
    .limit(10);
  return data || [];
}

async function getTopVendors(budgetId, linkKey) {
  if (!linkKey) return [];
  try {
    const { data } = await supabase.rpc('get_top_vendors_for_category', {
      p_budget_id: budgetId,
      p_link_key: linkKey,
      p_limit: 8,
    });
    return data || [];
  } catch {
    return [];
  }
}

// ─── Concurrency Limiter ──────────────────────────────────────────────────────

async function processWithConcurrency(items, processor, concurrency = 3) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, 1000)); // 1s between batches
    }
  }
  return results;
}

// ─── Entity-Type-Aware Prompts ────────────────────────────────────────────────

function buildEntityContext(municipality) {
  const entityType = municipality.entity_type || 'city';
  switch (entityType) {
    case 'township':
      return `This is a township government. Township governments in Indiana are administered by a township trustee. They commonly fund township assistance (poor relief), fire protection districts, cemetery maintenance, and general township administration.`;
    case 'county':
      return `This is a county government. County governments are overseen by a county council and board of commissioners. They commonly fund the county sheriff, county health department, courts, county clerk, assessor, recorder, and public works.`;
    case 'school_district':
      return `This is a school district. School districts focus on per-pupil spending, state tuition support (basic grant), debt service on building bonds, referendum levies, extracurricular activities, and special education.`;
    case 'city':
    default:
      return `This is a city government with a mayor and city council.`;
  }
}

function buildPrompt(cat, municipality, lineItemSummary, vendorSummary, existingResearch = '') {
  const entityContext = buildEntityContext(municipality);
  const pct = cat.percentage ? `${cat.percentage.toFixed(1)}%` : 'unknown %';
  const amount = cat.amount ? `$${Number(cat.amount).toLocaleString()}` : 'unknown';

  return `You are helping citizens understand their local government budget. A government budget has a fund or department named "${cat.name}" that represents ${amount} (${pct} of the ${cat.dataset_type} budget) for ${municipality.name}, ${municipality.state} in fiscal year ${YEAR}.

${entityContext}
${cat.parent_name ? `\nThis is a subcategory under "${cat.parent_name}".\n` : ''}
Line items within this fund:
${lineItemSummary}

Top vendors/payees receiving money from this fund:
${vendorSummary}

${existingResearch ? `Additional research context:\n${existingResearch}\n` : ''}

Based on this evidence, provide a plain-English explanation for a citizen with no government finance knowledge. Be honest about uncertainty — if you can only infer what it is, say so.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "plain_name": "2-5 word citizen-friendly name (not the raw fund name)",
  "short_description": "One sentence. What does this fund pay for?",
  "description": "2-3 sentences. What is this fund, why does it exist, how is it funded? Mention if it was voter-approved, state-mandated, etc.",
  "tags": ["array", "of", "3-6", "topic", "tags"],
  "confidence": "high|medium|low",
  "confidence_reason": "Brief note on why you are or aren't confident (e.g. 'vendor names clearly indicate bond payments' or 'limited evidence, inferred from name only')"
}`;
}

// ─── Claude enrichment ────────────────────────────────────────────────────────

async function enrichCategory(cat, municipality, existingResearch = '') {
  const lineItems = await getLineItems(cat.id);
  const vendors = await getTopVendors(cat.budget_id, cat.link_key);

  const lineItemSummary = lineItems.length
    ? lineItems.map(li => `  - ${li.description || 'Unnamed'}: $${Number(li.amount).toLocaleString()}`).join('\n')
    : '  (no line item detail available)';

  const vendorSummary = vendors.length
    ? vendors.map(v => `  - ${v.vendor_name}: $${Number(v.total_amount).toLocaleString()}`).join('\n')
    : '  (no transaction data available)';

  const prompt = buildPrompt(cat, municipality, lineItemSummary, vendorSummary, existingResearch);

  const response = await anthropic.messages.create({
    model: process.env.ENRICHMENT_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Failed to parse Claude response: ${text.slice(0, 200)}`);
  }
}

async function saveEnrichment(cat, municipality, result) {
  const nameKey = cat.parent_name
    ? `${normalize(cat.parent_name)}|${normalize(cat.name)}`
    : normalize(cat.name);
  const row = {
    name_key: nameKey,
    municipality_id: municipality.id,
    plain_name: result.plain_name,
    description: result.description,
    short_description: result.short_description,
    tags: result.tags || [],
    source: 'ai',
    confidence: result.confidence,
    evidence_summary: result.confidence_reason,
    generated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('category_enrichment')
    .upsert(row, { onConflict: 'name_key,municipality_id' });

  if (error) throw error;
}

// ─── Per-Municipality Processing ──────────────────────────────────────────────

async function processMunicipality(municipality, universalKeys, progress, runStats) {
  const categories = await getBudgetCategories(municipality.id);
  if (!categories.length) {
    console.log(`  [${municipality.name}] No budget categories for year ${YEAR} — skipping`);
    return { enriched: 0, skippedUniversal: 0, skippedCafr: 0, failed: 0 };
  }

  // Detect format
  const categoryNames = categories.map(c => c.name);
  const detectedFormat = DATASET_FORMAT === 'auto'
    ? detectFormat(categoryNames)
    : DATASET_FORMAT;

  // If CAFR, skip all (universals cover CAFR funds)
  if (detectedFormat === 'cafr') {
    const skippedCafr = categories.length;
    console.log(`  [${municipality.name}] CAFR format detected — skipping all ${skippedCafr} categories (covered by universals)`);
    runStats.skippedCafr += skippedCafr;
    return { enriched: 0, skippedUniversal: 0, skippedCafr, failed: 0 };
  }

  const existingKeys = FORCE ? new Set() : await getExistingEnrichments(municipality.id);

  // Determine which categories to process
  const toEnrich = [];
  let skippedUniversal = 0;

  for (const cat of categories) {
    const key = cat.parent_name
      ? `${normalize(cat.parent_name)}|${normalize(cat.name)}`
      : normalize(cat.name);

    // Skip if already in progress file
    if (progress.processed.includes(`${municipality.id}::${key}`)) continue;

    // Skip if universal enrichment exists (and --skip-universal is set)
    if (SKIP_UNIVERSAL && universalKeys.has(key)) {
      skippedUniversal++;
      continue;
    }

    // Skip if already enriched (universal or municipal)
    if (!FORCE && existingKeys.has(key)) continue;

    toEnrich.push(cat);
  }

  // Apply global limit
  const remaining = LIMIT ? Math.max(0, LIMIT - runStats.totalEnriched) : Infinity;
  const batch = toEnrich.slice(0, remaining);

  if (!batch.length) {
    console.log(`  [${municipality.name}] Nothing new to enrich`);
    return { enriched: 0, skippedUniversal, skippedCafr: 0, failed: 0 };
  }

  console.log(`  [${municipality.name}] ${batch.length} to enrich | format: ${detectedFormat} | entity: ${municipality.entity_type || 'city'}`);

  let enriched = 0;
  let failed = 0;
  const failedDetails = [];

  const processor = async (cat) => {
    const pct = cat.percentage ? `${cat.percentage.toFixed(1)}%` : '?%';
    const amount = cat.amount ? `$${(cat.amount / 1_000_000).toFixed(1)}M` : '?';
    process.stdout.write(`    [${cat.dataset_type}] ${cat.name} (${amount}, ${pct}) → `);

    try {
      const result = await enrichCategory(cat, municipality);

      if (DRY_RUN) {
        console.log(`\n      plain_name: ${result.plain_name}`);
        console.log(`      description: ${result.short_description}`);
        console.log(`      tags: ${result.tags?.join(', ')}`);
        console.log(`      confidence: ${result.confidence} — ${result.confidence_reason}\n`);
      } else {
        await saveEnrichment(cat, municipality, result);
        console.log(`ok "${result.plain_name}" [${result.confidence}]`);
      }

      // Record progress
      const nameKey = cat.parent_name
        ? `${normalize(cat.parent_name)}|${normalize(cat.name)}`
        : normalize(cat.name);
      const progressKey = `${municipality.id}::${nameKey}`;
      progress.processed.push(progressKey);
      saveProgress(progress);

      enriched++;
      runStats.totalEnriched++;
    } catch (err) {
      console.log(`FAIL ${err.message}`);
      failed++;
      failedDetails.push({ municipality: municipality.name, category: cat.name, error: err.message });
      progress.failed.push({ municipality: municipality.name, category: cat.name, error: err.message });
      saveProgress(progress);
    }
  };

  await processWithConcurrency(batch, processor, CONCURRENCY);

  return { enriched, skippedUniversal, skippedCafr: 0, failed, failedDetails: failedDetails };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nCategory Enrichment Pipeline`);
  console.log(`============================`);

  const modeDesc = ALL_MODE
    ? `All municipalities${STATE ? ` in ${STATE}` : ''}${ENTITY_TYPE ? ` (${ENTITY_TYPE})` : ''}`
    : `${CITY}, ${STATE}`;

  console.log(`Mode: ${modeDesc} | Year: ${YEAR} | Format: ${DATASET_FORMAT} | Dry run: ${DRY_RUN}`);
  if (CONCURRENCY > 1) console.log(`Concurrency: ${CONCURRENCY} | Skip universal: ${SKIP_UNIVERSAL}`);
  if (LIMIT) console.log(`Limit: ${LIMIT} categories`);
  console.log('');

  // Load progress for --all runs
  const progress = ALL_MODE ? loadProgress() : { processed: [], failed: [] };
  if (ALL_MODE && progress.processed.length > 0) {
    console.log(`Resuming from previous run: ${progress.processed.length} already processed\n`);
  }

  // Load universal enrichments once
  const universalKeys = SKIP_UNIVERSAL ? await getUniversalEnrichments() : new Set();
  if (SKIP_UNIVERSAL) console.log(`Universal enrichments loaded: ${universalKeys.size} keys\n`);

  // Resolve municipality list
  let municipalities = [];

  if (ALL_MODE) {
    municipalities = await getAllMunicipalities({ state: STATE, entityType: ENTITY_TYPE });
    console.log(`Found ${municipalities.length} municipalities to check\n`);
  } else {
    // Single-city mode (backward compatible)
    const m = await getMunicipality(CITY, STATE);
    console.log(`Municipality ID: ${m.id} | Population: ${m.population?.toLocaleString()} | Entity: ${m.entity_type || 'city'}\n`);
    municipalities = [m];
  }

  if (!municipalities.length) {
    console.log('No municipalities found matching criteria.');
    return;
  }

  // Run stats
  const runStats = {
    totalEnriched: 0,
    totalSkippedUniversal: 0,
    totalSkippedCafr: 0,
    totalFailed: 0,
    municipalitiesProcessed: 0,
    failedDetails: [],
  };

  for (const municipality of municipalities) {
    // Check global limit
    if (LIMIT && runStats.totalEnriched >= LIMIT) {
      console.log(`\nReached --limit of ${LIMIT} categories. Stopping.`);
      break;
    }

    runStats.municipalitiesProcessed++;
    const result = await processMunicipality(municipality, universalKeys, progress, runStats);

    runStats.totalSkippedUniversal += result.skippedUniversal || 0;
    runStats.totalSkippedCafr += result.skippedCafr || 0;
    runStats.totalFailed += result.failed || 0;
    if (result.failedDetails?.length) {
      runStats.failedDetails.push(...result.failedDetails);
    }
  }

  // Remaining municipalities count (only relevant for --all)
  const remainingCount = municipalities.length - runStats.municipalitiesProcessed;

  // Print summary
  console.log(`\n=== Enrichment Run Summary ===`);
  console.log(`Municipalities processed: ${runStats.municipalitiesProcessed}`);
  console.log(`Categories enriched: ${runStats.totalEnriched}`);
  console.log(`  Already covered (universal): ${runStats.totalSkippedUniversal}`);
  console.log(`  Skipped (CAFR format): ${runStats.totalSkippedCafr}`);
  console.log(`  AI-enriched: ${runStats.totalEnriched}`);
  console.log(`  Failed: ${runStats.totalFailed}`);

  if (runStats.failedDetails.length) {
    console.log(`\nFailed categories:`);
    for (const f of runStats.failedDetails) {
      console.log(`  ${f.municipality} - "${f.category}" - Error: ${f.error}`);
    }
  }

  if (ALL_MODE && remainingCount > 0) {
    console.log(`\nNext run: ${remainingCount} municipalities remaining (use --all to continue)`);
  }

  if (!DRY_RUN && runStats.totalEnriched > 0 && municipalities.length === 1) {
    const m = municipalities[0];
    console.log(`\nView results:`);
    console.log(`  SELECT name_key, plain_name, confidence FROM treasury.category_enrichment WHERE municipality_id = '${m.id}' ORDER BY name_key;`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
