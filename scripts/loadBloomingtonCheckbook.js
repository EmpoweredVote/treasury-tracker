#!/usr/bin/env node
/**
 * Load Bloomington checkbook data from local CSV into Supabase.
 * The CSV was manually downloaded from the Bloomington Socrata portal.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// First ensure we have a proper data source for Bloomington checkbook
async function ensureDataSource() {
  const { data: sources } = await supabase.rpc('treasury_list_source_ids');
  const existing = sources?.find(s => s.name.includes('Bloomington') && s.dataset_type === 'transactions' && s.name.includes('Checkbook'));
  if (existing) return existing.id;

  // Use the contracts source as fallback (same municipality)
  const contracts = sources?.find(s => s.name.includes('Bloomington') && s.dataset_type === 'transactions');
  return contracts?.id;
}

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

async function main() {
  const csvPath = process.argv[2] || '.claude/worktrees/agent-a30f27a2/data/payroll-all.csv';
  console.log(`\n📂 Reading: ${csvPath}`);

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);

  console.log(`   Headers: ${headers.slice(0, 8).join(', ')}...`);
  console.log(`   Total rows: ${(lines.length - 1).toLocaleString()}\n`);

  const dsId = await ensureDataSource();
  if (!dsId) { console.error('No Bloomington transaction data source found'); process.exit(1); }
  console.log(`   Data source ID: ${dsId}\n`);

  // Group by fiscal year
  const byYear = {};
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => row[h] = fields[j] || '');
    const fy = row.Fiscal_Year;
    if (!fy) continue;
    if (!byYear[fy]) byYear[fy] = [];
    byYear[fy].push(row);
  }

  let grandTotal = 0;
  for (const [fy, rows] of Object.entries(byYear).sort()) {
    const vendors = new Set();
    const txns = rows.map(r => {
      const vn = r.Vendor || 'Unknown';
      vendors.add(vn);
      return {
        a: parseFloat(r.Amount) || 0,
        d: r.Description || null,
        dt: r['Payment Date'] ? r['Payment Date'].split('T')[0] : null,
        pm: r.Payment_Method || null,
        inv: r.InvoiceNumber || null,
        f: r.Fund || null,
        ec: r['Expense Category'] || null,
        dept: r.Department || null,
        prog: r.Program || null,
        vn,
        lk: [r.Priority, r.Service, r.Fund, r['Expense Category']].filter(Boolean).join('|') || null,
        rid: r.Payment_Id || null,
      };
    });

    // Send in chunks of 5K
    const CHUNK = 5000;
    let inserted = 0, skipped = 0;
    for (let i = 0; i < txns.length; i += CHUNK) {
      const chunk = txns.slice(i, i + CHUNK);
      const chunkVendors = [...new Set(chunk.map(t => t.vn))].map(n => ({ n }));

      const { data, error } = await supabase.rpc('treasury_sync_transactions', {
        p_data_source_id: dsId,
        p_fiscal_year: parseInt(fy),
        p_vendors: chunkVendors,
        p_transactions: chunk,
        p_row_count: chunk.length,
        p_triggered_by: 'bulk_load',
      });

      if (error) {
        console.error(`  FY${fy} chunk error: ${error.message}`);
        break;
      }
      inserted += data?.rows_inserted || 0;
      skipped += data?.rows_skipped || 0;
    }

    const total = txns.reduce((s, t) => s + t.a, 0);
    grandTotal += total;
    console.log(`  FY${fy}: ${rows.length.toLocaleString()} txns → ${inserted.toLocaleString()} new, ${skipped.toLocaleString()} skipped | $${Math.round(total).toLocaleString()}`);
  }

  console.log(`\n🎉 Bloomington checkbook loaded! Grand total: $${Math.round(grandTotal).toLocaleString()}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
