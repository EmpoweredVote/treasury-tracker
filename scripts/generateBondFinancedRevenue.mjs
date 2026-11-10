#!/usr/bin/env node
/**
 * Measure every CA State Controller revenue year whose total is dominated by
 * BOND PROCEEDS, and write the register both the banner and the gate read.
 *
 *   node scripts/generateBondFinancedRevenue.mjs            # rewrite the register
 *   node scripts/generateBondFinancedRevenue.mjs --check    # fail if it has drifted
 *
 * ── ⭐⭐ WHY THIS IS A RULE AND NOT 43 HAND-WRITTEN ENTRIES ─────────────────
 *
 * West Hollywood FY2016 publishes $214,381,292 of "revenue". $85,015,000 of it
 * is a bond issue. A reader watching that series sees revenue jump 87% and then
 * fall 38%, and the cause is borrowing, not income.
 *
 * ⚠⚠⚠ THE POINT IS THAT WeHo WAS NOT SPECIAL — IT WAS VISITED. Every flag in
 * `src/data/figureFlags.ts` exists because a person spent a day on that entity,
 * so "unflagged" has never meant "checked and fine", only "nobody looked".
 * Asking the whole fleet the same question at once finds **43 city-years across
 * 35 entities**, of which West Hollywood is the eleventh largest. That is the
 * same correction this repo applied to row coverage and to out-of-period:
 * ask every publisher, not one.
 *
 * ── ⚠⚠ LEAF ROWS ONLY, OR A PARENT ROLL-UP DOUBLE COUNTS ───────────────────
 *
 * `budget_categories` stores the hierarchy, so "Other Financing Sources" sits
 * above "Revenue Bond Proceeds_Functional Revenues" holding the SAME figure.
 * Summing every matching row would count it twice. ⚠ And the first version of
 * this measurement used `max()` to dodge that, which silently UNDERCOUNTED the
 * years carrying more than one kind of bond: Oakland FY2003 and San Francisco
 * FY2010 both issue revenue AND general-obligation bonds. 41 years became 43.
 * Leaf rows, summed.
 *
 * ── ⭐ VERIFIED AGAINST THE PUBLISHER, NOT TT's OWN COPY ────────────────────
 *
 * A register built from TT's categories always agrees with TT's categories. So
 * eight of the 43 were asked directly of bythenumbers.sco.ca.gov — the four
 * largest shares, and every multi-line year, which is the case the first
 * measurement got wrong:
 *
 *   West Hollywood FY2016  $85,015,000      San Juan Bautista FY2016  $11,640,000
 *   Industry FY2016       $388,030,000      Healdsburg FY2006         $26,150,000
 *   Vernon FY2003         $160,562,761      Oakland FY2003           $635,151,695
 *   San Francisco FY2010  $2,644,050,000    San Mateo FY2004          $46,820,000
 *
 * All eight matched to the dollar.
 *
 * ── ⚠ THE THRESHOLD IS A JUDGEMENT, AND IT IS PUBLISHED ────────────────────
 *
 * 25% is a choice, not a measurement. It lives in ONE place (below), the banner
 * states it in words a reader can check ("more than a quarter"), and changing
 * it is a one-line diff whose blast radius this script prints. That is the
 * whole difference between a threshold and a secret.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/** ⚠ A JUDGEMENT. Stated in the banner so the reader can apply their own. */
export const BOND_SHARE_THRESHOLD = 0.25;

/** The series this rule is defined over. */
export const RULE_SOURCE = 'CA State Controller - Revenues';

const REGISTER = path.join(process.cwd(), 'src', 'data', 'bondFinancedRevenueYears.json');

/**
 * ⚠ The id a reader-facing flag must carry. `tests/figureFlags.test.ts` refuses
 * any flag whose id is absent from an author-facing register, so the id is the
 * join between the two and must be derived, never typed.
 */
export function bondFlagId(entity, state, fiscalYear) {
  const slug = String(entity).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `ca-sco-bond-financed-revenue-${slug}-${state.toLowerCase()}-${fiscalYear}`;
}


/**
 * ⚠⚠ A BANNER IS KEYED entity|state|year|dataset, NOT TO ONE BUDGET.
 *
 * So if an entity-year ever carries two revenue budgets — the Controller's,
 * and a "Treasury Tracker derived: Total Governmental" series that may
 * legitimately exclude bond proceeds — the same banner renders over both, and
 * over the second one the figures it states would not match the total printed
 * beside it. That is the #364 defect in a new costume.
 *
 * Measured 2026-11-09: all 43 flagged years have exactly one. This refuses to
 * write a register where that has stopped being true, rather than letting a
 * reader find out.
 */
export function siblingConflicts(rows) {
  return rows.filter((r) => Number(r.sibling_budgets) > 1);
}

export async function measure(db) {
  const { data, error } = await db.schema('treasury').rpc('bond_financed_revenue_years', {
    p_data_source: RULE_SOURCE,
    p_threshold: BOND_SHARE_THRESHOLD,
  });
  if (error) throw new Error(`bond_financed_revenue_years failed: ${error.message}`);

  const clash = siblingConflicts(data);
  if (clash.length) {
    throw new Error(
      `${clash.length} flagged year(s) now carry more than one revenue budget, so this banner `
      + 'would render over a total it does not describe: '
      + `${clash.map((c) => `${c.entity} ${c.state} FY${c.fiscal_year} (${c.sibling_budgets})`).join(', ')}. `
      + 'Key the flag more narrowly, or exclude these years, before regenerating.');
  }

  return data.map((r) => ({
    id: bondFlagId(r.entity, r.state, r.fiscal_year),
    entity: r.entity,
    state: r.state,
    fiscalYear: r.fiscal_year,
    datasetType: r.dataset_type,
    total: Number(r.total),
    bondAmount: Number(r.bond_amount),
    lines: r.lines,
    sourceUrl: r.source_url,
    // ⚠ Both spellings the flag-parity test accepts. `loaded` because TT holds
    // the publisher's figure exactly as filed — the Milledgeville Rule — and
    // `readerFacing` because this register is promoted by construction: a year
    // only enters it by crossing the threshold.
    loaded: true,
    readerFacing: true,
  }));
}

function readRegister() {
  return JSON.parse(readFileSync(REGISTER, 'utf8'));
}

/** Differences that matter, in the order a reader of the output needs them. */
export function diffRegister(measured, stored) {
  const byId = new Map(stored.rows.map((r) => [r.id, r]));
  const seen = new Set();
  const added = [];
  const changed = [];
  for (const m of measured) {
    seen.add(m.id);
    const s = byId.get(m.id);
    if (!s) { added.push(m); continue; }
    const same = s.total === m.total && s.bondAmount === m.bondAmount
      && s.entity === m.entity && s.state === m.state && s.fiscalYear === m.fiscalYear
      && s.datasetType === m.datasetType
      && JSON.stringify(s.lines) === JSON.stringify(m.lines);
    if (!same) changed.push({ was: s, now: m });
  }
  const removed = stored.rows.filter((r) => !seen.has(r.id));
  return { added, changed, removed, ok: !added.length && !changed.length && !removed.length };
}

async function main(argv = process.argv.slice(2)) {
  const check = argv.includes('--check');
  const db = createClient(
    process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );

  const rows = await measure(db);
  const payload = {
    $comment: 'GENERATED by scripts/generateBondFinancedRevenue.mjs — do not hand-edit. '
      + 'Re-measure with that script; `--check` is the gate.',
    rule: 'ca-sco-bond-financed-revenue',
    dataSource: RULE_SOURCE,
    // ⚠ The date a PERSON can check these against the Controller. It sits on the
    // payload, not on each row, so re-measuring does not churn 43 lines; `diffRegister`
    // compares rows only, so it never fires on the date alone.
    measuredOn: new Date().toISOString().slice(0, 10),
    thresholdShare: BOND_SHARE_THRESHOLD,
    rows,
  };

  if (!check) {
    writeFileSync(REGISTER, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`wrote ${rows.length} year(s) over ${BOND_SHARE_THRESHOLD * 100}% to ${REGISTER}`);
    const entities = new Set(rows.map((r) => `${r.entity}|${r.state}`)).size;
    console.log(`  ${entities} entities, largest share ${(100 * rows[0].bondAmount / rows[0].total).toFixed(1)}% (${rows[0].entity} FY${rows[0].fiscalYear})`);
    return 0;
  }

  const stored = readRegister();
  if (stored.thresholdShare !== BOND_SHARE_THRESHOLD) {
    console.error(`❌ the register was built at ${stored.thresholdShare} but the rule now says ${BOND_SHARE_THRESHOLD}.`);
    console.error('   Re-run without --check, and read the diff: changing the threshold changes who is flagged.');
    return 1;
  }
  const d = diffRegister(rows, stored);
  if (d.ok) {
    console.log(`✅ ${rows.length} bond-financed revenue year(s) — the register matches the database exactly.`);
    return 0;
  }
  console.error('❌ the bond-financed revenue register has drifted from the data it describes.\n');
  for (const r of d.added) {
    console.error(`  + ${r.entity}, ${r.state} FY${r.fiscalYear} now crosses the threshold `
      + `(${(100 * r.bondAmount / r.total).toFixed(1)}%) and has NO banner.`);
  }
  for (const r of d.removed) {
    console.error(`  − ${r.entity}, ${r.state} FY${r.fiscalYear} no longer crosses it. `
      + `⚠ Its banner must be DELETED, not reworded: telling a reader a year is bond-financed when it is not is its own misinformation.`);
  }
  for (const { was, now } of d.changed) {
    console.error(`  ~ ${now.entity}, ${now.state} FY${now.fiscalYear}: `
      + `total ${was.total} → ${now.total}, bond ${was.bondAmount} → ${now.bondAmount}`);
  }
  console.error('\n  Re-run `node scripts/generateBondFinancedRevenue.mjs` and review the diff.');
  return 1;
}

// ⚠⚠ `process.exitCode`, NOT `process.exit()`. Calling process.exit() here
// tore down the loop while a supabase-js keep-alive socket was still closing
// and Node aborted with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`
// — AFTER printing "✅ … matches the database exactly", with exit code 127.
// Deterministic, three runs out of three. A gate whose success exits non-zero
// is a gate that reports nothing, which is the failure shape this repo keeps
// rediscovering (`evaluated = 0` in out_of_period_watchdog.sql). Setting the
// code and letting the loop drain naturally exits 0 and 1 correctly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => { process.exitCode = c; }).catch((e) => {
    console.error(`\n❌ ${e.message}`);
    process.exitCode = 1;
  });
}

