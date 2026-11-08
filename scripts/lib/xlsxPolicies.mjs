/**
 * The chain of policies that stands between a published file and the rows TT
 * stores — and the row count those policies imply.
 *
 * ⚠⚠⚠ EXTRACTED FROM scripts/bulkLoadXLSX.js UNCHANGED, for the reason
 * scripts/lib/xlsxRows.mjs gives: anything measuring the loader must measure
 * THE LOADER. `verifyXlsxRowCoverage` asks "does TT still hold every row its
 * publisher publishes", and for an XLSX source that question has no count
 * endpoint to answer it — the only honest answer is to download the file and
 * run it through the identical chain. A second implementation of this chain
 * would agree with the loader only by luck, and would stop agreeing the first
 * time either side was edited.
 *
 * ⚠⚠ `stored` IS NOT THE FILE'S ROW COUNT, AND MUST NOT BE COMPARED TO IT.
 * Between the file and the database sit five separate reasons a published line
 * is not a stored row:
 *
 *   1. blank rows and header-duplicate rows      (dropped in parseCSV/parseXLSX)
 *   2. the publisher's own grand total           (#336 — doubled three Frisco years)
 *   3. repeated allocation rows                  (Frisco FY2018/19 — ~3x the audited total)
 *   4. identical rows collapsed by content dedup (the default policy)
 *   5. ON CONFLICT (budget_id, source_row_id) DO NOTHING
 *
 * So the number to compare against the database is the count of DISTINCT row
 * keys that survive the chain — `expected` below. Comparing raw file rows
 * instead would report all 22 budgets as short on the first run, and a gate
 * that is red by design is a gate nobody reads.
 *
 * ⚠ This module decides NOTHING. Every stage returns its verdict and the
 * caller chooses what to do with it: the loader aborts, the gate reports.
 * That split is deliberate — a gate that called process.exit() on a publisher's
 * bad file would report "unreachable" for a file it read perfectly well.
 */
import { rowKeys } from './xlsxRows.mjs';
import { parseAmount } from './xlsxRows.mjs';
import {
  findPublisherTotalRow, withoutTotalRow, assertTieToTotal,
} from './publisherTotalRow.mjs';
import { collapseAllocationRows, MIN_SHARE_TO_APPLY } from './allocationRows.mjs';
import { judgeDoubledExportDays } from './doubledExportDays.mjs';

/** The share of rows with unparseable amounts above which a file is refused. */
export const MAX_PARSE_ERROR_SHARE = 0.05;

/**
 * Run every policy the loader runs, in the loader's order, over parsed rows.
 *
 * Returns the rows that would be written, the key for each of them, and the
 * verdict of every stage. `blocked` is the first stage that would make the
 * loader abort, or null.
 *
 * @param {object[]} rows   parsed data rows, straight from parseCSV/parseXLSX
 * @param {object} cm       the source's column_mapping
 */
export function applyRowPolicies(rows, cm = {}) {
  // ⚠ Each stage records the row count AFTER it ran. The loader prints these,
  // and a single "rows now" number would be wrong in both places: the tie line
  // must report the count with only the total row gone, not the count after a
  // later allocation collapse as well.
  const stages = {
    parsedRows: rows.length,
    totalRow: null,
    tie: null,
    afterTotalRow: rows.length,
    parseErrors: 0,
    allocation: null,
    afterAllocation: rows.length,
    doubledDays: null,
  };
  let blocked = null;
  let current = rows;

  // ── 1. The publisher's own grand total is NOT a payment ──────────────────
  //
  // ⭐ Once the row is out it becomes an ORACLE: the remaining rows must sum to
  // it. The thing that broke three Frisco years is the thing that now proves
  // them.
  const totalRow = findPublisherTotalRow(current, {
    amountColumn: cm.amount_column,
    dateColumn: cm.date_column,
    vendorColumn: cm.vendor_column,
    descriptionColumn: cm.description_column,
  });
  stages.totalRow = totalRow;

  if (totalRow.ambiguous) {
    // ⚠ Not "probably the last one". Picking one would delete a real payment.
    blocked = { stage: 'total-row-ambiguous', totalRow };
    return { rows: current, keys: [], expected: 0, expectedAmount: 0, stages, blocked };
  }

  if (totalRow.found) {
    current = withoutTotalRow(current, totalRow);
    stages.afterTotalRow = current.length;
    const tie = assertTieToTotal(current, totalRow, cm.amount_column);
    stages.tie = tie;
    if (!tie.ok) {
      blocked = { stage: 'total-row-does-not-tie', tie };
      return { rows: current, keys: [], expected: 0, expectedAmount: 0, stages, blocked };
    }
  }

  // ── 2. Parse error rate ──────────────────────────────────────────────────
  let parseErrors = 0;
  for (const r of current) {
    if (isNaN(parseAmount(r[cm.amount_column]))) parseErrors++;
  }
  stages.parseErrors = parseErrors;
  if (current.length > 0 && parseErrors / current.length > MAX_PARSE_ERROR_SHARE) {
    blocked = { stage: 'parse-error-rate', parseErrors, of: current.length };
    return { rows: current, keys: [], expected: 0, expectedAmount: 0, stages, blocked };
  }

  // ── 3. Repeated-allocation collapse, opt-in per source ───────────────────
  //
  // ⚠⚠ The share threshold is the real guard. Identical amounts on one day are
  // NOT always a repeated allocation — Frisco FY2026 pays FRISCO STADIUM LLC
  // twice monthly at the same amount, and collapsing there would delete
  // $63,167,944.48 that really moved.
  if (cm.allocation_rows === 'repeat-payment-total') {
    const collapsed = collapseAllocationRows(current, {
      dateColumn: cm.date_column,
      vendorColumn: cm.vendor_column,
      amountColumn: cm.amount_column,
      descriptionColumn: cm.description_column,
    });
    const v = collapsed.verdict;
    stages.allocation = v;
    if (!v.supported) {
      blocked = { stage: 'allocation-unsupported', verdict: v };
      return { rows: current, keys: [], expected: 0, expectedAmount: 0, stages, blocked };
    }
    if (v.share < MIN_SHARE_TO_APPLY) {
      blocked = { stage: 'allocation-below-threshold', verdict: v };
      return { rows: current, keys: [], expected: 0, expectedAmount: 0, stages, blocked };
    }
    current = collapsed.rows;
  }
  // ⚠ Set whether or not the collapse ran, so "rows after allocation" always
  // means what it says — the default must be the count going IN, not the
  // file's original row count.
  stages.afterAllocation = current.length;

  // ── 4. Doubled-export guard, for occurrence-keyed sources only ───────────
  //
  // ⚠⚠ THE PUBLISHER'S TOTAL ROW CANNOT CATCH IT — the same report generates
  // the data rows and the total, so a doubled export doubles both and they
  // still agree to the cent. Only the shape of the counts can tell.
  if (cm.dedup === 'occurrence') {
    const verdict = judgeDoubledExportDays(current, {
      dateColumn: cm.date_column,
      amountColumn: cm.amount_column,
    });
    stages.doubledDays = verdict;
    if (!verdict.supported) {
      blocked = { stage: 'doubled-days-unsupported', verdict };
      return { rows: current, keys: [], expected: 0, expectedAmount: 0, stages, blocked };
    }
    if (verdict.certified.length) {
      blocked = { stage: 'doubled-days-certified', verdict };
      return { rows: current, keys: [], expected: 0, expectedAmount: 0, stages, blocked };
    }
  }

  // ── 5. The keys, over the WHOLE file ─────────────────────────────────────
  //
  // ⚠ Must be computed over every row at once. Counting occurrences inside the
  // loader's 500-row chunk would give two identical rows in different chunks
  // the same key and collapse them anyway.
  const keys = rowKeys(current, cm.dedup);

  // ⚠⚠ DISTINCT, not length. `treasury_sync_transactions` does ON CONFLICT
  // (budget_id, source_row_id) DO NOTHING, so two rows that key alike are ONE
  // row in the database. Under the default 'content' policy that is most of
  // the gap between a file's rows and TT's; under 'occurrence' it is almost
  // none of it, because only exact repeats beyond the first are suffixed.
  const expected = new Set(keys).size;

  // ⚠⚠⚠ AND THE MONEY, over the SAME rows. Row counts can tie while dollars do
  // not — a parsing regression that reads an amount wrong keeps the row and
  // changes the figure, which is the defect a reader would actually notice.
  // Plano is the proven case: 455 FY2024 lines carry an unbalanced inch mark,
  // and before the quote fix those rows survived at $0.00.
  //
  // ⚠ Summed over the FIRST row of each key, because that is the row the
  // database keeps — ON CONFLICT DO NOTHING discards the later copies, so
  // summing every row would count collapsed duplicates the database does not
  // hold.
  const seenKeys = new Set();
  let expectedAmount = 0;
  for (let i = 0; i < current.length; i += 1) {
    if (seenKeys.has(keys[i])) continue;
    seenKeys.add(keys[i]);
    expectedAmount += parseAmount(current[i][cm.amount_column]);
  }
  expectedAmount = Math.round(expectedAmount * 100) / 100;

  return { rows: current, keys, expected, expectedAmount, stages, blocked: null };
}

/** One line per policy that actually did something, for a human reading a gate. */
export function describePolicies({ stages }) {
  const out = [];
  if (stages.totalRow?.found) {
    out.push("excluded the publisher's own grand total row");
  }
  if (stages.allocation?.supported && stages.allocation.share >= MIN_SHARE_TO_APPLY) {
    out.push(`collapsed repeated allocation rows (${(stages.allocation.share * 100).toFixed(1)}% of rows)`);
  }
  if (stages.doubledDays) {
    out.push(`doubled-export check over ${stages.doubledDays.days?.length ?? 0} publication date(s)`);
  }
  return out;
}
