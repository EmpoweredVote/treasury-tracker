#!/usr/bin/env node
/**
 * Empowered Vote Finance Loader — RETIRED (Phase 75, D-08/D-09).
 *
 * This loader no longer writes any budget dataset. `data/ev-finances.csv` is fully
 * retired as a data source. EV financials now load from three current sources:
 *   - EXPENSES (operating)      → scripts/loadEVBank.js          (Beneficial State Bank, source='bank')
 *   - DONATION INCOME (revenue) → scripts/loadEVDonations.js     (platform exports, source='csv')
 *   - MANUAL / off-platform     → scripts/loadEVDonations.js     (data/ev-sources/manual.csv, source='manual')
 *   - RECONCILED SUMMARY        → scripts/reconcileEV.js         (treasury.org_financial_summary)
 *
 * Income was removed in Phase 74 (D-08); the operating/expense write is removed here in
 * Phase 75 (D-09) because the bank is the authoritative expense source (loadEVBank.js).
 * The CSV parsing / classification helpers are kept import-safe in case other tooling
 * references them, but main() is a no-op that prints this retirement notice.
 *
 * Usage: node scripts/loadEVFinances.js   (prints the retirement notice; writes nothing)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Retired: no DB writes remain, so the service key is not required to run this script.
// The client is created lazily (null without a key) so the helpers below stay import-safe.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } }) : null;

// ── Color palette ──────────────────────────────────────────────────────────────

const COLORS = {
  // Income (teal family — EV brand)
  Donations:      '#0F9B8E',
  Patreon:        '#14B0A2',
  'Give Butter':  '#19C5B6',
  Benevity:       '#1EDACA',
  Direct:         '#30E8D7',
  Interest:       '#4DE8DA',
  'Bank Interest':'#66EDE0',
  // Expense (warm coral family)
  'Platform Fees':     '#C0392B',
  'Software & Tools':  '#E74C3C',
  'AI & Research':     '#EC6B5A',
  Design:              '#F07060',
  Productivity:        '#F08878',
  Infrastructure:      '#F0A090',
  'Website & Domain':  '#F0B8A8',
  Operations:          '#A93226',
  'Government Filings':'#C0392B',
};

// ── CSV parsing ────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  fields.push(current.trim());
  return fields;
}

function parseAmount(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[$,\s]/g, '')) || 0;
}

function parseDate(str) {
  if (!str) return null;
  // Handle M/D/YYYY or MM/DD/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function getYear(dateStr) {
  const d = parseDate(dateStr);
  return d ? parseInt(d.slice(0, 4)) : null;
}

// ── Category mapping ───────────────────────────────────────────────────────────

function classifyIncome(row) {
  const acct = row.Account || '';
  const cat  = row.Category || '';
  if (acct === 'Patreon')      return { top: 'Donations', sub: 'Patreon' };
  if (acct === 'Give Butter')  return { top: 'Donations', sub: 'Give Butter' };
  if (acct === 'Benevity')     return { top: 'Donations', sub: 'Benevity' };
  if (cat  === 'Interest')     return { top: 'Interest',  sub: 'Bank Interest' };
  return { top: 'Donations', sub: 'Direct' };
}

function classifyExpense(row) {
  const cat  = (row.Category || '').toLowerCase();
  const payee = row.Payee || '';
  const desc  = (row.Description || '').toLowerCase();

  if (cat === 'fee') {
    const acct = row.Account || 'Platform';
    return { top: 'Platform Fees', sub: acct, vendor: payee };
  }

  if (cat === 'office') {
    return { top: 'Operations', sub: 'Government Filings', vendor: payee };
  }

  if (cat === 'software/subscriptions') {
    const combined = payee.toLowerCase() + ' ' + desc;

    if (combined.includes('anthropic') || combined.includes('claude')) {
      return { top: 'Software & Tools', sub: 'AI & Research', vendor: 'Anthropic (Claude)' };
    }
    if (combined.includes('openai') || combined.includes('chatgpt')) {
      return { top: 'Software & Tools', sub: 'AI & Research', vendor: 'OpenAI (ChatGPT)' };
    }
    if (combined.includes('figma')) {
      return { top: 'Software & Tools', sub: 'Design', vendor: 'Figma' };
    }
    if (combined.includes('read') && (combined.includes('ai') || combined.includes('meeting'))) {
      return { top: 'Software & Tools', sub: 'Productivity', vendor: 'Read.AI' };
    }
    if (combined.includes('meister') || combined.includes('mindmeister')) {
      return { top: 'Software & Tools', sub: 'Productivity', vendor: 'MindMeister' };
    }
    if (combined.includes('supabase')) {
      return { top: 'Software & Tools', sub: 'Infrastructure', vendor: 'Supabase' };
    }
    if (combined.includes('techsoup') || combined.includes('tech soup')) {
      return { top: 'Software & Tools', sub: 'Infrastructure', vendor: 'TechSoup (AWS Credits)' };
    }
    if (combined.includes('aws') || combined.includes('amazon web')) {
      return { top: 'Software & Tools', sub: 'Infrastructure', vendor: 'AWS' };
    }
    if (combined.includes('godaddy')) {
      return { top: 'Software & Tools', sub: 'Website & Domain', vendor: 'GoDaddy' };
    }
    return { top: 'Software & Tools', sub: 'Other', vendor: payee };
  }

  return { top: 'Operations', sub: row.Category || 'Other', vendor: payee };
}

// ── Tree building ──────────────────────────────────────────────────────────────

function buildTree(rows, classifyFn) {
  // groups: { topName: { subName: [rows] } }
  const groups = {};
  for (const row of rows) {
    const { top, sub, vendor } = classifyFn(row);
    const subKey = vendor || sub;
    if (!groups[top]) groups[top] = {};
    if (!groups[top][subKey]) groups[top][subKey] = [];
    groups[top][subKey].push(row);
  }

  const total = rows.reduce((s, r) => s + Math.abs(parseAmount(r.Amount)), 0);
  const categories = [];

  for (const [topName, subs] of Object.entries(groups)) {
    const topAmount = Object.values(subs).reduce(
      (s, rs) => s + rs.reduce((ss, r) => ss + Math.abs(parseAmount(r.Amount)), 0), 0
    );
    const subcategories = [];

    for (const [subName, subRows] of Object.entries(subs)) {
      const subAmount = subRows.reduce((s, r) => s + Math.abs(parseAmount(r.Amount)), 0);
      subcategories.push({
        name: subName,
        amount: subAmount,
        percentage: topAmount > 0 ? (subAmount / topAmount) * 100 : 0,
        color: COLORS[subName] || COLORS[topName] || '#888888',
        linkKey: subName.toLowerCase().replace(/[\s&/]+/g, '-'),
        lineItems: subRows.map(r => ({
          description: r.Description || r.Payee || 'No description',
          amount: Math.abs(parseAmount(r.Amount)),
          vendor: r.Payee || null,
          date: parseDate(r.Date),
          paymentMethod: r['Payment Method'] || null,
          platform: r.Account || null,
          expenseCategory: r.Category || null,
        })),
      });
    }

    subcategories.sort((a, b) => b.amount - a.amount);
    categories.push({
      name: topName,
      amount: topAmount,
      percentage: total > 0 ? (topAmount / total) * 100 : 0,
      color: COLORS[topName] || '#888888',
      linkKey: topName.toLowerCase().replace(/[\s&/]+/g, '-'),
      subcategories,
    });
  }

  categories.sort((a, b) => b.amount - a.amount);
  return { categories, total };
}

// ── Supabase helpers ───────────────────────────────────────────────────────────

async function getMunicipalityId() {
  const { data: existing } = await supabase
    .from('municipalities')
    .select('id')
    .eq('name', 'Empowered Vote')
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('municipalities')
    .insert({ name: 'Empowered Vote', state: 'CA', entity_type: 'nonprofit' })
    .select('id')
    .single();

  if (error) throw new Error(`Create municipality failed: ${error.message}`);
  console.log(`   Created municipality: ${data.id}`);
  return data.id;
}

async function clearExistingBudget(municipalityId, fiscalYear, datasetType) {
  const { data: existing } = await supabase
    .from('budgets')
    .select('id')
    .eq('municipality_id', municipalityId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType)
    .maybeSingle();

  if (!existing) return;

  // Delete line items → categories → budget in order
  const { data: catIds } = await supabase
    .from('budget_categories')
    .select('id')
    .eq('budget_id', existing.id);

  if (catIds?.length) {
    const ids = catIds.map(c => c.id);
    await supabase
      .from('budget_line_items')
      .delete()
      .in('category_id', ids)
      .neq('source', 'givebutter_webhook');
  }

  await supabase.from('budget_categories').delete().eq('budget_id', existing.id);
  await supabase.from('budgets').delete().eq('id', existing.id);
  console.log(`   Cleared existing ${datasetType} budget for FY${fiscalYear}`);
}

async function createBudget(municipalityId, fiscalYear, datasetType, total, hierarchy) {
  const { data, error } = await supabase
    .from('budgets')
    .insert({
      municipality_id: municipalityId,
      fiscal_year: fiscalYear,
      dataset_type: datasetType,
      total_budget: total,
      data_source: 'Empowered Vote Financial Records',
      hierarchy,
      fiscal_year_start_month: 1,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Create budget failed: ${error.message}`);
  return data.id;
}

async function insertCategories(budgetId, categories, parentId = null, depth = 0) {
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];

    const { data: catRow, error } = await supabase
      .from('budget_categories')
      .insert({
        budget_id: budgetId,
        parent_id: parentId,
        name: cat.name,
        amount: cat.amount,
        percentage: cat.percentage,
        color: cat.color,
        depth,
        sort_order: i,
        link_key: cat.linkKey || null,
        item_count: cat.lineItems?.length || 0,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Insert category "${cat.name}": ${error.message}`);

    if (cat.lineItems?.length) {
      const items = cat.lineItems.map(li => ({
        category_id: catRow.id,
        description: li.description,
        approved_amount: li.amount,
        actual_amount: li.amount,
        vendor: li.vendor || null,
        date: li.date || null,
        payment_method: li.paymentMethod || null,
        fund: li.platform || null,
        expense_category: li.expenseCategory || null,
        source: 'csv',
      }));
      const { error: liErr } = await supabase.from('budget_line_items').insert(items);
      if (liErr) throw new Error(`Insert line items: ${liErr.message}`);
    }

    if (cat.subcategories?.length) {
      await insertCategories(budgetId, cat.subcategories, catRow.id, depth + 1);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // RETIRED (Phase 75, D-09): this loader no longer writes any budget dataset.
  console.log('\n🗳️  Empowered Vote Finance Loader — RETIRED (Phase 75)\n');
  console.log('This script no longer writes to the database. EV financials now load from:');
  console.log('  • Expenses (operating)      → scripts/loadEVBank.js      (Beneficial State Bank)');
  console.log('  • Donation income (revenue) → scripts/loadEVDonations.js (platform exports)');
  console.log('  • Manual / off-platform     → scripts/loadEVDonations.js (data/ev-sources/manual.csv)');
  console.log('  • Reconciled summary        → scripts/reconcileEV.js     (treasury.org_financial_summary)');
  console.log('\n`data/ev-finances.csv` is fully retired as a data source. No action taken.\n');
}

main().catch(err => { console.error('\n❌ Fatal:', err.message); process.exit(1); });
