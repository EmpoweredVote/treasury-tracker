#!/usr/bin/env node
/**
 * Enrichment Queue Processor
 *
 * Reads pending items from treasury.enrichment_queue, groups them by municipality,
 * calls the same Claude enrichment logic as enrichCategories.js, and updates
 * queue item statuses.
 *
 * Designed to run as a cron job (e.g. via Render scheduled cron).
 *
 * Usage:
 *   node scripts/processEnrichmentQueue.js              # process up to 50 pending items
 *   node scripts/processEnrichmentQueue.js --limit 100  # process up to 100
 *   node scripts/processEnrichmentQueue.js --dry-run    # preview queue without processing
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Env loading ─────────────────────────────────────────────────────────────

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

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? true] : null)
    .filter(Boolean)
);

const LIMIT = parseInt(args.limit || '50');
const DRY_RUN = 'dry-run' in args;
const MAX_ATTEMPTS = 3;

// ─── Clients ──────────────────────────────────────────────────────────────────

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

// ─── Queue helpers ────────────────────────────────────────────────────────────

async function fetchPendingItems(limit) {
  const { data, error } = await supabase
    .from('enrichment_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch queue: ${error.message}`);
  return data || [];
}

async function markProcessing(id) {
  const { error } = await supabase
    .from('enrichment_queue')
    .update({ status: 'processing', last_attempted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn(`  [warn] Failed to mark ${id} as processing: ${error.message}`);
}

async function markDone(id) {
  const { error } = await supabase
    .from('enrichment_queue')
    .update({ status: 'done', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn(`  [warn] Failed to mark ${id} as done: ${error.message}`);
}

async function markSkipped(id) {
  const { error } = await supabase
    .from('enrichment_queue')
    .update({ status: 'skipped', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn(`  [warn] Failed to mark ${id} as skipped: ${error.message}`);
}

async function markFailed(id, currentAttempts, errorMessage) {
  const newAttempts = currentAttempts + 1;
  const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
  const { error } = await supabase
    .from('enrichment_queue')
    .update({
      status: newStatus,
      attempts: newAttempts,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) console.warn(`  [warn] Failed to update failure status for ${id}: ${error.message}`);
  return newStatus;
}

// ─── Enrichment helpers (mirrors enrichCategories.js) ────────────────────────

function normalize(name) {
  return (name || '').toLowerCase().trim();
}

async function getMunicipality(municipalityId) {
  const { data, error } = await supabase
    .from('municipalities')
    .select('id, name, state, population')
    .eq('id', municipalityId)
    .single();
  if (error || !data) throw new Error(`Municipality not found: ${municipalityId}`);
  return data;
}

async function hasUniversalEnrichment(nameKey) {
  const { data } = await supabase
    .from('category_enrichment')
    .select('name_key')
    .eq('name_key', nameKey)
    .is('municipality_id', null)
    .limit(1);
  return (data || []).length > 0;
}

async function getCategoryForNameKey(budgetId, nameKey) {
  const { data } = await supabase
    .from('budget_categories')
    .select('id, name, amount, percentage, parent_id, link_key, budget_id')
    .eq('budget_id', budgetId)
    .is('parent_id', null)
    .limit(50);

  if (!data) return null;
  return data.find(c => normalize(c.name) === nameKey) || null;
}

async function getBudgetInfo(budgetId) {
  const { data } = await supabase
    .from('budgets')
    .select('id, dataset_type, fiscal_year, total_budget')
    .eq('id', budgetId)
    .single();
  return data;
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

async function callClaude(cat, municipality, budget) {
  const lineItems = await getLineItems(cat.id);
  const vendors = await getTopVendors(cat.budget_id, cat.link_key);

  const lineItemSummary = lineItems.length
    ? lineItems.map(li => `  - ${li.description || 'Unnamed'}: $${Number(li.amount).toLocaleString()}`).join('\n')
    : '  (no line item detail available)';

  const vendorSummary = vendors.length
    ? vendors.map(v => `  - ${v.vendor_name}: $${Number(v.total_amount).toLocaleString()}`).join('\n')
    : '  (no transaction data available)';

  const pct = cat.percentage ? `${Number(cat.percentage).toFixed(1)}%` : 'unknown %';
  const amount = cat.amount ? `$${Number(cat.amount).toLocaleString()}` : 'unknown';
  const fiscalYear = budget?.fiscal_year || 'unknown';
  const datasetType = budget?.dataset_type || 'budget';

  const prompt = `You are helping citizens understand their local government budget. A city budget has a fund or department named "${cat.name}" that represents ${amount} (${pct} of the ${datasetType} budget) for ${municipality.name}, ${municipality.state} in fiscal year ${fiscalYear}.

Line items within this fund:
${lineItemSummary}

Top vendors/payees receiving money from this fund:
${vendorSummary}

Based on this evidence, provide a plain-English explanation for a citizen with no government finance knowledge. Be honest about uncertainty — if you can only infer what it is, say so.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "plain_name": "2-5 word citizen-friendly name (not the raw fund name)",
  "short_description": "One sentence. What does this fund pay for?",
  "description": "2-3 sentences. What is this fund, why does it exist, how is it funded? Mention if it was voter-approved, state-mandated, etc.",
  "tags": ["array", "of", "3-6", "topic", "tags"],
  "confidence": "high|medium|low",
  "confidence_reason": "Brief note on why you are or aren't confident"
}`;

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
  const row = {
    name_key: normalize(cat.name),
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nEnrichment Queue Processor');
  console.log('==========================');
  console.log(`Limit: ${LIMIT} | Dry run: ${DRY_RUN} | Max attempts: ${MAX_ATTEMPTS}`);

  const items = await fetchPendingItems(LIMIT);
  console.log(`Fetched ${items.length} pending item(s) from queue\n`);

  if (items.length === 0) {
    console.log('Queue is empty. Nothing to do.');
    return;
  }

  if (DRY_RUN) {
    console.log('DRY RUN — items that would be processed:');
    for (const item of items) {
      console.log(`  [priority=${item.priority}] ${item.name_key} (municipality: ${item.municipality_id}, attempts: ${item.attempts})`);
    }
    return;
  }

  // Group items by municipality_id for efficient processing
  const byMunicipality = new Map();
  for (const item of items) {
    const group = byMunicipality.get(item.municipality_id) || [];
    group.push(item);
    byMunicipality.set(item.municipality_id, group);
  }

  console.log(`Grouped into ${byMunicipality.size} municipality batch(es)\n`);

  let done = 0, skipped = 0, failed = 0;

  for (const [municipalityId, group] of byMunicipality) {
    let municipality;
    try {
      municipality = await getMunicipality(municipalityId);
    } catch (err) {
      console.error(`  [error] Cannot load municipality ${municipalityId}: ${err.message}`);
      for (const item of group) {
        await markFailed(item.id, item.attempts, `Municipality load failed: ${err.message}`);
        failed++;
      }
      continue;
    }

    console.log(`Municipality: ${municipality.name}, ${municipality.state} (${group.length} items)`);

    for (const item of group) {
      process.stdout.write(`  "${item.name_key}" → `);

      // Check for universal enrichment first — skip if it already exists
      const hasUniversal = await hasUniversalEnrichment(item.name_key);
      if (hasUniversal) {
        console.log('skipped (universal enrichment exists)');
        await markSkipped(item.id);
        skipped++;
        continue;
      }

      // Resolve the actual category row from the budget
      const cat = item.budget_id
        ? await getCategoryForNameKey(item.budget_id, item.name_key)
        : null;

      if (!cat) {
        console.log('skipped (category row not found in budget)');
        await markSkipped(item.id);
        skipped++;
        continue;
      }

      // Fetch budget metadata for context
      const budget = await getBudgetInfo(item.budget_id);

      // Skip CAFR datasets — they rely on universal enrichments
      if (budget?.dataset_type === 'CAFR') {
        console.log('skipped (CAFR dataset uses universal enrichments)');
        await markSkipped(item.id);
        skipped++;
        continue;
      }

      await markProcessing(item.id);

      try {
        const result = await callClaude(cat, municipality, budget);
        await saveEnrichment(cat, municipality, result);
        console.log(`done — "${result.plain_name}" [${result.confidence}]`);
        await markDone(item.id);
        done++;

        // Small delay to avoid Claude rate limits
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        const finalStatus = await markFailed(item.id, item.attempts, err.message);
        console.log(`failed (attempt ${item.attempts + 1}/${MAX_ATTEMPTS}, status=${finalStatus}) — ${err.message}`);
        failed++;
      }
    }

    console.log('');
  }

  console.log('==========================');
  console.log(`Done: ${done} enriched | Skipped: ${skipped} | Failed: ${failed}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
