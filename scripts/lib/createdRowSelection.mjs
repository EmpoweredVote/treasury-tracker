/**
 * Choose which unregistered rows a milestone is claiming.
 *
 * NO SHEBANG — a test imports this module.
 *
 * ⚠⚠ WHY THIS IS A SEPARATE MODULE. It used to live inside
 * `registerCreatedRows.mjs`'s `main()`, reading `process.argv` and a live
 * database, so the one piece of arithmetic that decides whether the frozen
 * invariant keeps reconciling had no test at all. It is pure here, and tested
 * without a database.
 *
 * ── THE THREE SELECTORS ─────────────────────────────────────────────────────
 *
 *   --match   a substring of `name, state :: data_source`. Enough for a new
 *             entity or a new source, where the string itself is new.
 *
 *   --ids     exact row ids, for when no substring can isolate the rows.
 *
 *   --fy      NARROWS every --match to one or more fiscal years.
 *
 * ⭐⭐ WHY `--fy` EXISTS. `--match` carries no fiscal year, so it cannot express
 * a load that EXTENDS an existing series by a year: the entity and the source
 * are already there for every prior year. Measured on the live database while
 * sizing the CA FY2025 fleet load (2026-10-31):
 *
 *     CA State Controller - Expenditures          10,453 rows,  10,425 FROZEN
 *     CA State Controller - Revenues              10,453 rows,  10,437 FROZEN
 *     CA State Controller - County Expenditures    1,188 rows,   1,188 FROZEN
 *     CA State Controller - County Revenues        1,188 rows,   1,188 FROZEN
 *
 * `--match "CA State Controller - Expenditures"` therefore selects ~10,900
 * rows against a deficit of ~1,080 and refuses, correctly. The alternative was
 * `--ids` with 1,080 ids — about 39 KB of argv — from a loader that does not
 * emit ids at all: `treasury_sync_city_budget` returns `rows_inserted`, never
 * the row id.
 *
 * ⚠ `--fy` ONLY EVER NARROWS. It is a filter applied to matches, so it cannot
 * select a row that no match already selected, and the reconciliation guard in
 * the caller — the union must equal the deficit exactly — is untouched.
 */

/** The string `--match` substrings are tested against. */
export function rowKey(r) {
  return `${r.name}, ${r.state} :: ${r.data_source}`;
}

/**
 * ⚠⚠ A ROW WITH NO FISCAL YEAR IS NOT A ROW OF EVERY YEAR. The four Virginia
 * APA rows that blocked the LA registration on 2026-10-31 carried NULL on
 * their own axes, and a filter that waved those through would file somebody
 * else's rows under your milestone — the exact warning this tool prints.
 *
 * ⚠ The column is numeric and argv gives a string. Comparing them with ===
 * selects nothing, which looks precisely like "the load wrote no rows".
 */
function inYears(row, years) {
  if (years.length === 0) return true;
  if (row.fiscal_year === null || row.fiscal_year === undefined) return false;
  return years.some((y) => Number(y) === Number(row.fiscal_year));
}

/**
 * @param {{rows: object[], matches: string[], ids: string[], fiscalYears: (string|number)[]}} args
 *   `rows` is the UNREGISTERED set — rows in no exclusion file.
 * @returns {{selected: object[], perMatch: {match: string, count: number}[],
 *            unknownIds: string[], overlap: number}}
 */
export function selectCreatedRows({ rows, matches = [], ids = [], fiscalYears = [] }) {
  const seen = new Map();
  const perMatch = [];

  for (const m of matches) {
    // ⚠ The count reported is the POST-FILTER width, not what the substring
    // hit. Reporting the wider number would hide an over-broad match inside a
    // total that happens to reconcile.
    const hits = rows.filter((r) => rowKey(r).includes(m) && inYears(r, fiscalYears));
    perMatch.push({ match: m, count: hits.length });
    for (const r of hits) seen.set(r.id, r);
  }

  // ⚠⚠ THE YEAR FILTER DOES NOT APPLY TO IDS. An id names a row exactly;
  // dropping one for being out of year would select fewer rows than the
  // operator named, which is the failure `--ids` was added to remove.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const unknownIds = ids.filter((id) => !byId.has(id));
  for (const id of ids) {
    const r = byId.get(id);
    if (r) seen.set(id, r);
  }

  const selected = [...seen.values()];
  const overlap = perMatch.reduce((n, p) => n + p.count, 0) + ids.length - selected.length;
  return { selected, perMatch, unknownIds, overlap };
}
