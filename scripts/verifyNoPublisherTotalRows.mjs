#!/usr/bin/env node
/**
 * Refuse any budget holding a transaction equal to HALF its own headline total.
 *
 *   npm run verify:total-rows
 *
 * ── ⚠⚠⚠ WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * Frisco's check registers end with a row carrying no date, no vendor and the
 * description `TOTAL`. TT loaded it as a payment, so three years published at
 * EXACTLY TWICE the truth — $2,523,034,629.69 of money nobody spent — in
 * public, for years:
 *
 *     FY      TT published        Frisco's own TOTAL
 *     2018  2,163,355,443.22      1,081,755,767.17
 *     2019  1,985,695,981.21      1,001,344,551.22
 *     2022    879,807,220.41        439,934,311.30
 *
 * ⚠⚠ NOT ONE EXISTING GATE COULD SEE IT. The tree tied to the total, the total
 * tied to the transactions, every row carried a real amount, and the
 * duplicate-label and negative-total counters were clean. A self-consistent
 * file had simply been counted twice — and self-consistency is exactly what
 * every other gate measures.
 *
 * ── WHY A SEPARATE GATE FROM THE LOADER'S ─────────────────────────────────
 *
 * scripts/lib/publisherTotalRow.mjs stops this at parse time, but it only
 * protects budgets somebody RELOADS. A budget loaded before that guard existed
 * keeps its phantom row forever. This reads what is STORED, so it covers the
 * back catalogue.
 *
 * ⚠ The work is one indexed query inside
 * treasury.publisher_total_row_status(). An earlier version of this script did
 * it client-side, one probe per budget, and had to be killed after ten
 * minutes: a gate nobody can afford to run is a gate nobody runs.
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const money = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

async function main() {
  // ⚠⚠ Count the subject FIRST. A gate that finds nothing because it looked at
  // nothing reports a perfect pass — the failure mode that looks like success.
  const { count: budgets, error: cErr } = await db.schema('treasury').from('budgets')
    .select('id', { count: 'exact', head: true }).gt('total_budget', 0);
  if (cErr) throw new Error(`budget count failed: ${cErr.message}`);
  if (!budgets) {
    console.error('✗ no budget has a positive headline total — this gate measured nothing.');
    process.exitCode = 1;
    return;
  }

  const { data, error } = await db.schema('treasury').rpc('publisher_total_row_status');
  if (error) {
    console.error(`✗ publisher_total_row_status() failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const hits = data || [];
  console.log(`checked ${budgets.toLocaleString()} budget(s) with a positive headline total`);

  if (hits.length) {
    console.error(`\n⛔ ${hits.length} transaction(s) equal HALF their budget's headline total.`);
    console.error("   That is the signature of a publisher's own grand total loaded as a");
    console.error('   payment, which doubles the published figure. Reload the source: the');
    console.error('   loader now excludes the total row and asserts the rest tie to it.\n');
    for (const r of hits) {
      console.error(`   ${r.municipality} FY${r.fiscal_year} ${r.dataset_type} — headline ${money(r.total_budget)}, ` +
        `row ${money(r.amount)} ${r.description ? `(${r.description})` : '(no description)'}`);
      console.error(`      source: ${r.data_source}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ no budget holds a transaction worth half its own headline total.');
}

await main();
