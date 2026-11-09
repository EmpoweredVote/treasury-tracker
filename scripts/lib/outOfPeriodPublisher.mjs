/**
 * Asking a publisher how many of ITS OWN rows fall outside the fiscal period
 * of the budget they were loaded into.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── ⚠⚠⚠ WHY THIS EXISTS: A FROZEN COUNT IS NOT AN INVARIANT ───────────────
 *
 * `scripts/data/outOfPeriodExceptions.mjs` pins the EXACT number of
 * out-of-period rows expected per budget, and the gate fails when that number
 * moves. That is right for a static published file and WRONG for a live one.
 *
 * West Hollywood's FY2025-26 demand register is the city's CURRENT register:
 * it grew 1,164 → 6,393 out-of-period rows in a single day, and the registry
 * itself predicts roughly 1,500 more a month for as long as the city keeps
 * posting there. Under a frozen count this gate goes red every month on a
 * budget where red means NOTHING NEW — and a gate that cries wolf monthly is
 * a gate nobody reads. That is the precise failure
 * `scripts/lib/rowCoverage.mjs` was designed around, one gate over.
 *
 * ── ⭐⭐ THE FIX IS THE SAME ONE: STOP MEASURING AGAINST A NUMBER, ASK THE
 *        PUBLISHER ────────────────────────────────────────────────────────
 *
 * If TT's out-of-period count for a budget equals what the publisher's own
 * data says, then a moved count is NEWS, not a defect: the city posted more
 * rows and TT kept up. Only a count that DISAGREES with the publisher, or a
 * budget nobody declared at all, is a failure.
 *
 * ⚠ THIS IS NOT A TOLERANCE, and the distinction matters because the registry
 * explicitly refuses tolerances ("a tolerance would let a new defect hide
 * inside an old one's allowance"). Nothing can hide behind "ask the
 * publisher": the comparison is still exact, it is just against the live
 * source rather than a number somebody wrote down once.
 *
 * ── ⚠ WHICH PUBLISHERS CAN BE ASKED, AND WHICH CANNOT ─────────────────────
 *
 * Socrata answers `$select=count(*)` with a `$where` for free, which covers 11
 * of the 12 budgets that currently have hits — including every growing one.
 *
 * An `xlsx_download` publisher answers nothing without downloading the whole
 * file, so those keep the frozen count. ⭐ That is safe for a different
 * reason: a static file's out-of-period count can only move if the FILE
 * changed, and `verify:xlsx-row-coverage` already compares every xlsx budget
 * to its publisher's file on every run. The two gates cover each other.
 */

/**
 * ⚠⚠⚠ A TEXT DATE CANNOT BE COMPARED TO A DATE, AND SOCRATA WILL NOT SAY SO.
 *
 * FOUR of West Hollywood's ten demand registers store `check_date` as TEXT in
 * `MM-DD-YYYY` form — 7kgt-b5t8, yai6-dpmb, e46y-98wp and b8ph-69yc, which are
 * FY2021, FY2022, FY2023 and FY2024. On those, `check_date < '2023-07-01…'` is
 * a LEXICOGRAPHIC comparison: every value begins with a month digit, `0` or
 * `1`, so every value sorts below `2`, so EVERY ROW MATCHES.
 *
 * Asked that question, b8ph-69yc answered 23,553 — the entire file — where TT
 * holds 5,791 out-of-period rows. No error, no warning, just a confident wrong
 * number.
 *
 * ⚠ It fails SAFE, because a wrong count will not equal TT's and the budget
 * stays `mismatched`. But a gate that asks an unanswerable question and prints
 * the answer is worse than one that admits it cannot ask: the operator reads
 * "the publisher holds 23,553" and goes looking for 17,762 missing rows that
 * do not exist. So the type is checked FIRST, and a non-date column returns
 * null — "cannot ask" — which is already a hard failure.
 */
const DATE_TYPES = new Set(['calendar_date', 'date', 'floating_timestamp', 'fixed_timestamp']);

/** Cached per run: one metadata request per dataset, not per budget. */
const typeCache = new Map();

export async function dateColumnIsComparable(source, fetchImpl = fetch) {
  const cm = source.column_mapping || {};
  const key = `${source.base_url}/${source.dataset_id}#${cm.date_column}`;
  if (typeCache.has(key)) return typeCache.get(key);

  let ok = false;
  try {
    const r = await fetchImpl(`${source.base_url}/api/views/${source.dataset_id}.json`, {
      headers: { Accept: 'application/json' },
    });
    if (r.ok) {
      const meta = await r.json();
      const col = (meta.columns || []).find((c) => c.fieldName === cm.date_column);
      // ⚠ An unknown or missing column is NOT comparable. Assuming otherwise
      // is how the 23,553 got printed in the first place.
      ok = !!col && DATE_TYPES.has(col.dataTypeName);
    }
  } catch { ok = false; }

  typeCache.set(key, ok);
  return ok;
}

/** Testing seam: the cache is per process, so a test must be able to clear it. */
export function __resetDateTypeCache() {
  typeCache.clear();
}

/** Socrata wants a bare timestamp literal, not a date and not an ISO zone. */
function stamp(d) {
  const s = String(d ?? '');
  // Accept '2025-07-01', '2025-07-01T00:00:00' and '2025-07-01T00:00:00.000Z'.
  const day = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`not a date: ${s}`);
  return `${day}T00:00:00`;
}

/**
 * The SoQL `$where` that counts rows outside `[periodStart, periodEnd)`.
 *
 * ⚠⚠ HALF-OPEN, matching treasury.out_of_period_transaction_status(). A row
 * dated exactly on `periodEnd` is in the NEXT year, and `<=` here would
 * silently disagree with the database by one day's worth of payments.
 *
 * ⚠ `skipFyFilter` is not a detail. West Hollywood publishes ONE DATASET PER
 * FILE, so the whole dataset belongs to one budget and there is no fiscal-year
 * column to filter on. LA City publishes one dataset for every year and must
 * be filtered, or the count returned would be every out-of-period row in nine
 * years of data.
 */
export function outOfPeriodWhere({
  dateColumn, fiscalYearColumn, fiscalYear, periodStart, periodEnd, skipFyFilter = false,
}) {
  if (!dateColumn) throw new Error('dateColumn is required');
  const clauses = [];
  if (!skipFyFilter && fiscalYearColumn) {
    // ⚠ Quoted. Socrata holds these as text on both hosts; an unquoted number
    // returns zero rows rather than an error, which would read as "the
    // publisher agrees" — the worst possible way to be wrong here.
    clauses.push(`${fiscalYearColumn}='${fiscalYear}'`);
  }
  clauses.push(
    `(${dateColumn} < '${stamp(periodStart)}' OR ${dateColumn} >= '${stamp(periodEnd)}')`,
  );
  return clauses.join(' AND ');
}

/**
 * How many out-of-period rows the publisher itself holds for this budget.
 *
 * Returns `null` when the publisher cannot be asked — a non-Socrata source, a
 * missing date column, an unreachable host, or a response that is not a
 * number. ⚠⚠ `null` NEVER means agreement. The caller must treat "could not
 * ask" as "no corroboration", exactly as the row-coverage gate treats an
 * unreachable publisher.
 */
export async function publisherOutOfPeriodCount(source, hit, fetchImpl = fetch) {
  if (!source || source.api_type !== 'socrata') return null;
  const cm = source.column_mapping || {};
  const dateColumn = cm.date_column;
  if (!dateColumn || !source.base_url || !source.dataset_id) return null;

  // ⚠⚠⚠ BEFORE asking anything. See dateColumnIsComparable — four of West
  // Hollywood's own registers would otherwise answer with the whole file.
  if (!(await dateColumnIsComparable(source, fetchImpl))) return null;

  let where;
  try {
    where = outOfPeriodWhere({
      dateColumn,
      fiscalYearColumn: cm.fiscal_year_column,
      fiscalYear: hit.fiscal_year ?? hit.fiscalYear,
      periodStart: hit.period_start ?? hit.periodStart,
      periodEnd: hit.period_end ?? hit.periodEnd,
      skipFyFilter: cm.skip_fy_filter === true || cm.skip_fy_filter === 'true',
    });
  } catch {
    return null;
  }

  const p = new URLSearchParams({ $select: 'count(*)', $where: where });
  try {
    const r = await fetchImpl(`${source.base_url}/resource/${source.dataset_id}.json?${p}`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const n = Number.parseInt(Object.values(d[0] || {})[0] ?? '', 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}
