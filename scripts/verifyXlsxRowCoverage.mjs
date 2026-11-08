/**
 * npm run verify:xlsx-row-coverage
 *
 * ⚠⚠⚠ Does TT still hold every row its publisher publishes — for the sources
 * that publish a FILE rather than an API?
 *
 * The sibling gate (verify:source-row-coverage) does `.eq('api_type','socrata')`,
 * so Plano, Frisco and McKinney — 22 budgets — had nothing checking they still
 * hold what their publisher publishes. The transaction-tree gate covers them,
 * but that compares trees to transactions: a tree built from TT's own
 * transactions always ties to TT's own transactions. Only a publisher can say
 * whether TT is short.
 *
 * ── ⚠⚠⚠ WHY THIS COULD NOT JUST CALL THE SOCRATA GATE ──────────────────────
 *
 * Two things are different, and both of them are the whole problem.
 *
 * 1. THERE IS NO COUNT ENDPOINT. Socrata answers `$select=count(*)` for free.
 *    A file publisher answers nothing: the only way to learn what they
 *    published is to download the file. So this gate downloads all 22 every
 *    run. That is the cost of the question, and it is the only honest way to
 *    ask it.
 *
 * 2. `stored` IS NOT THE FILE'S ROW COUNT, BY DESIGN. Five separate policies
 *    sit between a published line and a stored row — the publisher's own grand
 *    total (#336), Frisco's repeated allocation rows, blank and header-dupe
 *    rows, the dedup key, and ON CONFLICT DO NOTHING. Comparing stored rows to
 *    file rows would report every one of these budgets as short on the first
 *    run, and a gate that is red by design is a gate nobody reads.
 *
 *    So `published` here means: the number of rows THIS PUBLISHER'S FILE
 *    implies, run through the loader's own policy chain — scripts/lib/
 *    xlsxPolicies.mjs, the same module scripts/bulkLoadXLSX.js calls. Not a
 *    second implementation of it. A re-implementation would agree with the
 *    loader by luck and stop agreeing the first time either was edited.
 *
 * ── ⚠⚠ WHAT THIS GATE CANNOT SEE ───────────────────────────────────────────
 *
 * It iterates the sources TT has declared. A fiscal year the publisher has
 * served but TT never created a data_source for is INVISIBLE to it — the same
 * blind spot that hid eight LA years and two West Hollywood years, because a
 * `fiscal_years` array measures a DECLARATION, not a publisher. Asking what
 * McKinney and Frisco have EVER served means reading their Archive.aspx
 * listings, which is a separate piece of work. This gate watches the years TT
 * claims; it does not discover new ones, and must never be read as saying
 * there are none.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import { classifyCoverage, isClean } from './lib/rowCoverage.mjs';
import { applyRowPolicies } from './lib/xlsxPolicies.mjs';
import { parseCSV, parseXLSX, downloadXLSX, looksLikeXlsx, looksLikeHtml } from './lib/xlsxRows.mjs';
import { XLSX_ROW_COVERAGE } from './data/xlsxRowCoverage.mjs';

// ⚠ Lazy: importing this module must not require credentials, so the tests and
// the --help path work with nothing set.
let _db = null;
function db() {
  if (_db) return _db;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and a service key are required');
  _db = createClient(url, key);
  return _db;
}

/**
 * What this publisher's file implies TT should hold.
 *
 * Returns `{ published, blocked, stages }`. `published` is null when the
 * publisher could not be reached OR served something that is not data — a
 * WAF block page, an error page, a login wall. `blocked` is set when the file
 * downloaded and parsed perfectly well but a policy refuses it; that is a
 * finding about the FILE, and it must never read as "we could not look".
 */
export async function publishedRowCount(ds) {
  const cm = ds.column_mapping || {};
  let buffer;
  try {
    buffer = await downloadXLSX(ds.base_url);
  } catch (e) {
    return { published: null, blocked: null, unreachableReason: e.message, stages: null };
  }
  if (looksLikeHtml(buffer)) {
    return {
      published: null, blocked: null, stages: null,
      unreachableReason: 'the publisher returned HTML, not a workbook or CSV (a block page or an error page served as 200)',
    };
  }

  let parsed;
  try {
    // ⚠⚠ Pick the parser by CONTENT, not by the URL's suffix — Plano serves
    // CSV from `ReportExport.aspx?...` with no suffix at all.
    parsed = looksLikeXlsx(buffer) ? await parseXLSX(buffer, cm) : parseCSV(buffer);
  } catch (e) {
    return { published: null, blocked: null, unreachableReason: `could not parse: ${e.message}`, stages: null };
  }

  const policy = applyRowPolicies(parsed.rows, cm);
  if (policy.blocked) {
    return { published: null, publishedAmount: null, blocked: policy.blocked, stages: policy.stages, parsed };
  }
  return {
    published: policy.expected,
    publishedAmount: policy.expectedAmount,
    blocked: null,
    stages: policy.stages,
    parsed,
  };
}

/**
 * ⚠ `budgets.total_budget` IS the figure readers see, and
 * `treasury_sync_transactions` recomputes it from the rows that survived —
 * verified 2026-11-08 to equal SUM(transactions.amount) to the cent on all of
 * Frisco FY2018/FY2024, Plano FY2018/FY2024 and McKinney FY2024. Comparing it
 * against the publisher therefore checks the published number itself, not a
 * private intermediate.
 *
 * ⚠⚠ ONE CENT OF TOLERANCE, because `total_budget` is held as a float and
 * reads back as e.g. 379429772.1000000000043. Anything larger than a cent is
 * a real disagreement.
 */
export const AMOUNT_TOLERANCE = 0.01;

/**
 * Budgets whose DOLLARS disagree with the publisher's file.
 *
 * ⚠⚠⚠ ROWS CAN TIE WHILE MONEY DOES NOT, and that is the failure a reader
 * would actually see. Plano is the proven case: 455 FY2024 lines carry an
 * unbalanced inch mark, and before the quote fix every one of those rows was
 * still stored — at $0.00. A row-count check alone would have called that
 * year whole.
 *
 * ⚠ Only budgets whose rows already agree are reported here. When rows are
 * short the money is short as a consequence, and saying so twice would make
 * one defect look like two.
 */
export function amountDisagreements(observations) {
  const out = [];
  for (const o of observations) {
    if (o.published == null || o.publishedAmount == null) continue;
    if (Number(o.stored) !== Number(o.published)) continue;
    const difference = Math.round((Number(o.storedAmount) - Number(o.publishedAmount)) * 100) / 100;
    if (Math.abs(difference) > AMOUNT_TOLERANCE) {
      out.push({ obs: o, stored: o.storedAmount, published: o.publishedAmount, difference });
    }
  }
  return out;
}

const money = (v) => '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function observe({ filter } = {}) {
  let q = db().schema('treasury')
    .from('data_sources')
    .select('id, name, base_url, dataset_type, api_type, fiscal_years, column_mapping, municipality_id')
    .eq('api_type', 'xlsx_download').eq('dataset_type', 'transactions').eq('is_enabled', true);
  const { data: sources, error } = await q;
  if (error) throw new Error(`listing sources failed: ${error.message}`);

  const targets = (sources || [])
    .filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()))
    // ⚠ A stable order so two runs are diffable. The publisher's order is not.
    .sort((a, b) => a.name.localeCompare(b.name));

  const observations = [];
  for (const ds of targets) {
    // ⚠ An XLSX source is ONE fiscal year — `fiscal_years` is a single-element
    // array here, unlike the Socrata sources where one dataset spans several.
    const fy = Array.isArray(ds.fiscal_years) ? ds.fiscal_years[0] : ds.fiscal_years;

    // ⚠⚠ The budget is resolved the way treasury_sync_transactions resolves it
    // — municipality_id + fiscal_year + dataset_type — NOT by data_source, and
    // never by budgets.data_source_id, which is a dangling reference on these
    // rows.
    const { data: budgets, error: bErr } = await db().schema('treasury')
      .from('budgets').select('id, total_budget')
      .eq('municipality_id', ds.municipality_id)
      .eq('dataset_type', ds.dataset_type)
      .eq('fiscal_year', fy);
    if (bErr) throw new Error(`budget lookup failed for ${ds.name}: ${bErr.message}`);

    let stored = 0;
    let storedAmount = 0;
    for (const b of budgets || []) {
      storedAmount += Number(b.total_budget ?? 0);
      const { count, error: cErr } = await db().schema('treasury')
        .from('transactions').select('id', { count: 'exact', head: true })
        .eq('budget_id', b.id);
      if (cErr) throw new Error(`counting ${ds.name} failed: ${cErr.message}`);
      stored += count ?? 0;
    }

    process.stderr.write(`  …${ds.name}\r`);
    const p = await publishedRowCount(ds);
    observations.push({
      source: ds.name,
      fiscalYear: fy,
      stored,
      published: p.published,
      // ⚠ Carried alongside, NOT folded into `published`. The row count and
      // the money are two independent questions, and a gate that merged them
      // could not say which one disagreed.
      storedAmount: Math.round(storedAmount * 100) / 100,
      publishedAmount: p.publishedAmount ?? null,
      blocked: p.blocked,
      unreachableReason: p.unreachableReason ?? null,
      fileRows: p.stages?.parsedRows ?? null,
    });
  }
  return observations;
}

const n = (v) => Number(v).toLocaleString();

/**
 * Split `classifyCoverage`'s `unreachable` bucket back into the two things it
 * conflates.
 *
 * ⚠⚠ `published: null` means "no number", and there are two very different
 * reasons for that: the publisher could not be reached, or the file was read
 * in full and a policy refuses it. Both FAIL — "could not look" must never
 * read as "looked and agreed" — but an operator acts on them differently, and
 * a gate that printed "unreachable" for a file it had just parsed would send
 * someone to check a network problem that does not exist.
 */
export function splitUnreachable(unreachable) {
  return {
    blocked: unreachable.filter((u) => u.obs.blocked),
    unreachable: unreachable.filter((u) => !u.obs.blocked),
  };
}

/**
 * Why a file is unloadable, in one line a human can act on.
 *
 * ⚠ Every stage scripts/lib/xlsxPolicies.mjs can block on needs a case here.
 * tests/xlsxRowCoverage.test.mjs enumerates them, so adding a stage without a
 * line fails the suite rather than printing a bare slug to an operator.
 */
export function describeBlocked(blocked) {
  switch (blocked.stage) {
    case 'total-row-ambiguous':
      return 'two rows could each be the publisher\'s grand total — picking one would delete a real payment';
    case 'total-row-does-not-tie':
      return `the remaining rows do not sum to the publisher's own total (off by $${n(blocked.tie.difference)})`;
    case 'parse-error-rate':
      return `${blocked.parseErrors} of ${blocked.of} rows have unparseable amounts`;
    case 'allocation-unsupported':
      return `repeated allocations cannot be judged — ${blocked.verdict.reason}`;
    case 'allocation-below-threshold':
      return `only ${(blocked.verdict.share * 100).toFixed(1)}% of rows are in identical-amount groups — this file does NOT have the repeated-allocation shape, and collapsing would delete $${n(blocked.verdict.moneyRemoved)} that really moved`;
    case 'doubled-days-unsupported':
      return `doubled-export days cannot be checked — ${blocked.verdict.reason}`;
    case 'doubled-days-certified':
      return `${blocked.verdict.certified.length} day(s) appear to have been EXPORTED TWICE — loading would add ${n(blocked.verdict.rowsDoubled)} rows worth $${n(blocked.verdict.amountDoubled)} that was never spent`;
    default:
      return blocked.stage;
  }
}

async function main() {
  const { values } = parseArgs({
    options: { source: { type: 'string' }, help: { type: 'boolean' } },
    allowPositionals: true,
  });
  if (values.help) {
    console.log('Usage: node scripts/verifyXlsxRowCoverage.mjs [--source <substring>]');
    console.log('\nDownloads every enabled xlsx_download transaction source and compares the');
    console.log("rows its file implies against the rows TT holds. Talks to the publishers.");
    return 0;
  }

  console.log('Downloading every XLSX publisher file — this gate has no count endpoint to ask.\n');
  const observations = await observe({ filter: values.source });
  process.stderr.write(' '.repeat(72) + '\r');

  // ⚠ A blocked file is NOT an unreachable publisher. classifyCoverage sees
  // `published: null` for both, so they are split back apart here: "we read
  // the file and it is unloadable" and "we could not look" are different
  // findings, and an operator needs to know which one they have.
  // ⚠⚠ THE REGISTRY MUST BE SCOPED THE SAME WAY THE RUN IS. `stale` means "the
  // registry names a budget that no longer exists", and a filtered run observes
  // only one budget — so without this every OTHER entry reads as stale and a
  // perfectly good `--source` run exits 1 with 21 invented findings. Scoping
  // the registry by the same substring keeps a filtered run honest about the
  // part of the world it actually looked at.
  const registry = values.source
    ? XLSX_ROW_COVERAGE.filter((e) => e.source.toLowerCase().includes(values.source.toLowerCase()))
    : XLSX_ROW_COVERAGE;
  const r = classifyCoverage(observations, registry);
  const { blocked, unreachable } = splitUnreachable(r.unreachable);
  const moneyOff = amountDisagreements(observations);

  const totalStored = observations.reduce((a, o) => a + Number(o.stored || 0), 0);
  console.log(`XLSX transaction budgets evaluated: ${observations.length}`);
  console.log(`Rows held: ${n(totalStored)}`);
  console.log(`Holding exactly what their publisher publishes: ${r.ok.length}`);

  // ⚠ A NOTICE, NOT A FAILURE — the same bargain the Socrata gate strikes.
  // Frisco's FY2026 file and Plano's live ReportExport both grow, and failing
  // on a baseline that merely went stale would make this gate cry wolf.
  if (r.baselineMoved.length) {
    console.log(`\nℹ️  Baseline moved on ${r.baselineMoved.length} budget(s) — TT matches the publisher, refresh scripts/data/xlsxRowCoverage.mjs when convenient:`);
    for (const b of r.baselineMoved) {
      console.log(`  ${b.obs.source}: ${n(b.baseline)} → ${n(b.now)}`);
    }
  }

  if (isClean(r) && moneyOff.length === 0) {
    console.log(`Dollars matching their publisher's file: ${observations.filter((o) => o.publishedAmount != null).length}`);
    console.log('\n✅ Every registered budget holds exactly what its publisher publishes — rows and dollars.');
    return 0;
  }

  console.error('\n❌ Coverage is wrong.\n');

  // ⚠⚠⚠ Reported FIRST when the rows agree, because it is the quieter defect:
  // every count ties, every total is self-consistent, and the figure is still
  // wrong. That is the same self-consistency blindness as the publisher TOTAL
  // row (#336) and the stray 2009 date (#343).
  if (moneyOff.length) {
    console.error(`⚠⚠⚠ THE ROWS TIE BUT THE MONEY DOES NOT (${moneyOff.length}):`);
    for (const d of moneyOff) {
      console.error(`  ${d.obs.source}: TT publishes ${money(d.stored)}, the publisher's file implies ${money(d.published)} — off by ${money(d.difference)}`);
    }
    console.error('  Every row is present, so this is not a dropped load. Suspect the parse:');
    console.error('  a column read wrong keeps the row and changes the figure.\n');
  }
  if (r.duplicates.length) {
    console.error(`Duplicate registry keys (${r.duplicates.length}):`);
    for (const k of r.duplicates) console.error(`  ${k}`);
  }
  if (r.undeclared.length) {
    console.error(`\nUndeclared budgets (${r.undeclared.length}) — add them to scripts/data/xlsxRowCoverage.mjs:`);
    for (const o of r.undeclared) {
      console.error(`  ${o.source}: stored ${n(o.stored)}, publisher implies ${o.published == null ? 'UNKNOWN' : n(o.published)}` +
        (o.fileRows ? ` (${n(o.fileRows)} rows in the file)` : ''));
    }
  }
  if (r.shortfall.length) {
    console.error(`\n⚠⚠⚠ TT IS DROPPING ROWS (${r.shortfall.length}) — this is the defect this gate exists for:`);
    for (const d of r.shortfall) {
      console.error(`  ${d.obs.source}: holds ${n(d.stored)} of ${n(d.published)} the file implies — ${n(d.missing)} MISSING`);
    }
  }
  if (r.surplus.length) {
    console.error(`\n⚠⚠ TT HOLDS MORE THAN THE FILE IMPLIES (${r.surplus.length}) — duplication, or the publisher withdrew rows TT already loaded:`);
    for (const d of r.surplus) {
      console.error(`  ${d.obs.source}: holds ${n(d.stored)} of ${n(d.published)} the file implies — ${n(d.extra)} EXTRA`);
    }
  }
  if (blocked.length) {
    console.error(`\n⛔ The publisher's file is UNLOADABLE (${blocked.length}) — read in full, and refused by a policy:`);
    for (const b of blocked) {
      console.error(`  ${b.obs.source}: ${describeBlocked(b.obs.blocked)}`);
    }
    console.error('  These files were READ, not missed. TT\'s stored rows may still be correct —');
    console.error('  what is certain is that this gate cannot confirm them until the file is loadable.');
  }
  if (unreachable.length) {
    console.error(`\nPublisher unreachable (${unreachable.length}) — NOT treated as agreement:`);
    for (const u of unreachable) console.error(`  ${u.obs.source}: ${u.obs.unreachableReason ?? 'no reason recorded'}`);
  }
  if (r.stale.length) {
    console.error(`\nStale registry entries (${r.stale.length}) — no such enabled source any more:`);
    for (const e of r.stale) console.error(`  ${e.source} FY${e.fiscalYear}`);
  }
  return 1;
}

// ⚠ `process.argv[1]` is undefined under `node -e`, and pathToFileURL throws on
// undefined — which turns "imported, not run" into a crash.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c)).catch((e) => {
    console.error(`\n❌ ${e.message}`);
    process.exit(1);
  });
}
