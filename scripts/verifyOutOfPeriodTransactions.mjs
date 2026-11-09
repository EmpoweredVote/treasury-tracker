#!/usr/bin/env node
/**
 * Refuse any transaction dated outside the fiscal period of its own budget,
 * unless that budget is declared in scripts/data/outOfPeriodExceptions.mjs.
 *
 *   npm run verify:out-of-period
 *
 * ── ⚠⚠ WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * Frisco's FY2019 check register opens with a row dated 2009-04-05 for
 * $2,556,546.04. TT read the file correctly — the publisher typed 2009 for
 * 2019 — and NOTHING NOTICED, because the amount is right and therefore every
 * total ties: the tree ties to the budget, the budget ties to its
 * transactions, and the row is a real payment the city really made. Only the
 * date was wrong, and nothing was measuring dates.
 *
 * That is the same shape as the publisher TOTAL row (#336): a file that is
 * perfectly self-consistent and still says something untrue. Self-consistency
 * is what almost every other gate measures, so it is precisely the defect
 * class they are all blind to.
 *
 * ── ⚠ THIS GATE IS NOT HELD AT ZERO, AND CANNOT BE ──────────────────────
 *
 * Under the Milledgeville rule TT keeps the publisher's date rather than
 * repairing it, so a correct TT still has out-of-period rows. The registry
 * names every tolerated budget and the EXACT row count expected, and this
 * fails on anything that is not in it, on any count that has MOVED, and on
 * any entry that has gone stale. See scripts/lib/outOfPeriodRows.mjs for why
 * all three directions matter.
 */
import { createClient } from '@supabase/supabase-js';
import { classifyOutOfPeriod, isClean, periodKey } from './lib/outOfPeriodRows.mjs';
import { publisherOutOfPeriodCount } from './lib/outOfPeriodPublisher.mjs';
import { OUT_OF_PERIOD_EXCEPTIONS } from './data/outOfPeriodExceptions.mjs';

// ⚠ Lazy, not module scope. A client built at import time throws without a
// key, which breaks every test that imports this file. See #340.
let _db = null;
function db() {
  if (_db) return _db;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    console.error('✗ SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required.');
    process.exit(1);
  }
  _db = createClient(process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key);
  return _db;
}

const money = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const where = (h) => `${h.municipality}, ${h.state} FY${h.fiscal_year}`;

async function main() {
  // ⚠⚠ Count the subject FIRST. A gate that finds nothing because it looked at
  // nothing reports a perfect pass — the failure mode that looks like success.
  const { data: cov, error: cErr } = await db().schema('treasury').rpc('out_of_period_coverage');
  if (cErr) {
    console.error(`✗ out_of_period_coverage() failed: ${cErr.message}`);
    process.exitCode = 1;
    return;
  }
  const { evaluated = 0, skipped_no_start_month: skipped = 0 } = (cov && cov[0]) || {};
  if (!evaluated) {
    console.error('✗ no transaction budget could be evaluated — this gate measured nothing.');
    process.exitCode = 1;
    return;
  }

  const { data, error } = await db().schema('treasury').rpc('out_of_period_transaction_status');
  if (error) {
    console.error(`✗ out_of_period_transaction_status() failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const hits = data || [];

  // ⭐⭐ ASK THE PUBLISHERS, but only about budgets whose count has actually
  // MOVED. A count that still matches its registry entry needs no network
  // call, so a steady run makes none at all — and the budgets that do move are
  // exactly the ones worth a question.
  const moved = hits.filter((h) => {
    const e = OUT_OF_PERIOD_EXCEPTIONS.find((x) => periodKey(x) === periodKey(h));
    return e && Number(e.outRows) !== Number(h.out_rows);
  });
  const publisherCounts = new Map();
  if (moved.length) {
    console.log(`asking ${moved.length} publisher(s) about a count that moved…`);
    const { data: sources, error: sErr } = await db().schema('treasury')
      .from('data_sources')
      .select('name, api_type, base_url, dataset_id, column_mapping')
      .in('name', [...new Set(moved.map((h) => h.data_source))]);
    if (sErr) {
      // ⚠ NOT fatal and NOT agreement: leaving publisherCounts empty makes
      // every moved count fail, which is the safe direction.
      console.error(`   could not load source config: ${sErr.message}`);
    }
    const byName = new Map((sources || []).map((s) => [s.name, s]));
    for (const h of moved) {
      publisherCounts.set(
        periodKey(h),
        await publisherOutOfPeriodCount(byName.get(h.data_source), h),
      );
    }
  }

  const result = classifyOutOfPeriod(hits, OUT_OF_PERIOD_EXCEPTIONS, publisherCounts);
  const rows = hits.reduce((n, h) => n + Number(h.out_rows), 0);

  console.log(`checked ${evaluated} transaction budget(s); ${hits.length} hold `
    + `${rows} row(s) dated outside their own fiscal period`);
  if (skipped) {
    // ⚠ Not a pass. We cannot judge a period we do not know.
    console.error(`\n⛔ ${skipped} transaction budget(s) have no fiscal_year_start_month `
      + 'and could NOT be evaluated. Their period is unknown, so out-of-period rows in them '
      + 'are invisible to this gate.');
    process.exitCode = 1;
  }

  if (result.duplicates.length) {
    console.error(`\n⛔ ${result.duplicates.length} budget(s) claimed by MORE THAN ONE registry entry:`);
    for (const k of result.duplicates) console.error(`   ${k}`);
    console.error('   Two entries make the expected row count ambiguous. Merge them.');
  }

  if (result.undeclared.length) {
    console.error(`\n⛔ ${result.undeclared.length} budget(s) hold out-of-period rows that nobody has written down:`);
    for (const h of result.undeclared) {
      console.error(`   ${where(h)} — ${h.out_rows} row(s), ${money(h.out_amount)}, `
        + `${h.earliest} … ${h.latest} (period ${h.period_start} … ${h.period_end})`);
      console.error(`      source: ${h.data_source}`);
      for (const s of (h.sample || []).slice(0, 3)) {
        console.error(`      ${s.payment_date}  ${money(s.amount)}  ${s.description ?? ''}`);
      }
    }
    console.error('\n   Read the rows before declaring them. If TT should keep the publisher’s');
    console.error('   date, add an entry to scripts/data/outOfPeriodExceptions.mjs with the');
    console.error('   evidence. If TT binned them into the wrong year, that is TT’s bug to fix.');
  }

  // ⭐ A NOTICE, NOT A FAILURE. The publisher restated and TT kept up; only
  // the recorded baseline is stale. Failing here would turn West Hollywood's
  // live register into a monthly red gate, and a gate that cries wolf is not a
  // gate. See scripts/lib/outOfPeriodPublisher.mjs for why this is not a
  // tolerance.
  if (result.publisherConfirmed.length) {
    console.log(`\nℹ️  ${result.publisherConfirmed.length} declared budget(s) moved and the PUBLISHER AGREES `
      + '— refresh scripts/data/outOfPeriodExceptions.mjs when convenient:');
    for (const p of result.publisherConfirmed) {
      console.log(`   ${where(p.hit)} — registry says ${p.expected}, TT and the publisher both hold ${p.actual}`);
    }
  }

  if (result.mismatched.length) {
    console.error(`\n⛔ ${result.mismatched.length} declared budget(s) whose row count has MOVED `
      + 'without the publisher confirming it:');
    for (const m of result.mismatched) {
      console.error(`   ${where(m.hit)} — registry says ${m.expected}, found ${m.actual} `
        + `(${m.entry.key})`);
      console.error(m.published === null
        // ⚠⚠ "Could not look" is NOT "looked and agreed", and this line has to
        // say which one happened or an operator will assume the wrong one.
        ? '      the publisher could NOT be asked, so this is unconfirmed — not agreed'
        : `      the publisher holds ${m.published}, which is neither figure`);
    }
    console.error('   A budget already on the list is not permission for a NEW defect in it.');
  }

  if (result.stale.length) {
    console.error(`\n⛔ ${result.stale.length} registry entr(ies) match nothing in the database:`);
    for (const e of result.stale) {
      console.error(`   ${e.municipality}, ${e.state} FY${e.fiscalYear} (${e.key})`);
    }
    console.error('   The defect is gone or the budget is. Either way the registry now');
    console.error('   describes a TT that does not exist — remove the entry.');
  }

  if (!isClean(result) || skipped) {
    process.exitCode = 1;
    return;
  }

  console.log(`✓ all ${result.declared.length} budget(s) with out-of-period rows are declared, `
    + 'with the expected counts');
  for (const d of result.declared) {
    console.log(`   ${where(d.hit)} — ${d.hit.out_rows} row(s), ${money(d.hit.out_amount)} `
      + `— ${d.entry.disposition}`);
  }
}

const { pathToFileURL } = await import('node:url');
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
}
