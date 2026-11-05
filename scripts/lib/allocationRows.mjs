/**
 * Collapse rows where a publisher wrote the CHECK TOTAL on every GL line.
 *
 * ── ⚠⚠⚠ WHAT WENT WRONG ───────────────────────────────────────────────────
 *
 * Frisco's FY2018 and FY2019 check registers repeat the FULL payment amount on
 * every account-allocation line instead of splitting it across them. TT loaded
 * each line as its own payment, so both years published at roughly THREE TIMES
 * the truth.
 *
 * ⭐ THE PUBLISHER CHANGED FORMAT, and the same vendor proves it:
 *
 *   FY2018, 2017-11-21, North Texas Municipal Water District
 *     11 rows, ONE distinct amount — $4,359,026.75 on every line, including
 *     the balance-sheet lines AR - OTHER and ACCRUED ACCOUNTS PAYABLE.
 *     The check was $4,359,026.75. TT read $47,949,294.25.
 *
 *   FY2020, 2019-11-07, the same vendor
 *     8 rows, EIGHT distinct amounts, including a NEGATIVE AR - OTHER of
 *     -$838,754.28, summing to the net disbursement of $3,669,218.05.
 *
 * ── ⭐⭐ THE ORACLE IS THE AUDITED ACFR, and it sets a BAND ────────────────
 *
 * A check register covers governmental AND enterprise cash, so it should sit a
 * little ABOVE governmental expenditures. From Frisco's FY2025 ACFR,
 * "Changes in Fund Balances of Governmental Funds, Last Ten Fiscal Years":
 *
 *     FY      audited gov't    TT register     ratio
 *     2018     352,020,545   1,081,599,676     3.07x   <- broken
 *     2019     328,138,720     984,351,430     3.00x   <- broken
 *     2020     356,090,005     377,922,892     1.06x
 *     2021     345,843,297     316,736,239     0.92x
 *     2022     397,352,632     439,872,909     1.11x
 *     2023     459,400,825     524,901,563     1.14x
 *     2024     559,518,293     564,849,086     1.01x
 *     2025     724,462,533     807,342,811     1.11x
 *
 * Collapsing puts FY2018 at 1.08x and FY2019 at 1.14x — inside the band six
 * other years hold, reached without tuning anything to the ACFR.
 *
 * ── ⚠⚠ WHY THIS IS OPT-IN AND GUARDED BY A SHARE THRESHOLD ────────────────
 *
 * Identical amounts on one day are NOT always a repeated allocation. Frisco
 * FY2026 pays FRISCO STADIUM LLC twice a month at the same amount, as
 * "CAPITAL EXP-BLDGS/IMPRVMNTS" and "TRANSFER OUT - CAPITAL PROJECT" — an
 * expenditure and the interfund transfer funding it. Both are real.
 *
 * Applying this policy there would delete $63,167,944.48 that was actually
 * moved. So the loader REFUSES unless the file genuinely has the broken shape:
 *
 *     FY2018  22.1% of rows        FY2020  0.3%
 *     FY2019  23.0% of rows        FY2026  0.3%
 *
 * Two orders of magnitude apart, so a 5% floor separates them with room to
 * spare, and nobody can quietly enable this on a healthy file.
 */

/**
 * ⚠ The policy must not fire on a file that merely contains a few same-amount
 * pairs. 5% sits far above every healthy year measured (max 0.3%) and far
 * below both broken ones (22.1%, 23.0%).
 */
export const MIN_SHARE_TO_APPLY = 0.05;

/** How many account names a collapsed row names before it says "+N more". */
export const MAX_DESCRIPTIONS_SHOWN = 3;

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  const neg = /^\(.*\)$/.test(s);
  const n = Number.parseFloat(s.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

function dayKey(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : s.slice(0, 10);
}

/**
 * Find every group of rows sharing date + vendor + an IDENTICAL amount, with
 * more than one distinct description.
 *
 * ⚠ "More than one distinct description" is load-bearing. Rows identical in
 * every column are the row-dedup story (scripts/lib/xlsxRows.mjs), already
 * handled and measured separately. Treating them here would double-count the
 * repair and conflate two different defects.
 */
export function judgeAllocationRows(rows, opts = {}) {
  const { dateColumn, vendorColumn, amountColumn, descriptionColumn } = opts;
  const none = {
    supported: false, reason: '', groups: [], rowsInGroups: 0, share: 0,
    rowsRemoved: 0, moneyRemoved: 0,
  };
  if (!dateColumn || !vendorColumn || !amountColumn || !descriptionColumn) {
    return { ...none, reason: 'needs date, vendor, amount and description columns in column_mapping' };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ...none, supported: true, reason: '' };
  }

  const buckets = new Map();
  rows.forEach((r, i) => {
    const k = `${dayKey(r[dateColumn])}|${String(r[vendorColumn] ?? '')}|${num(r[amountColumn]).toFixed(2)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });

  const groups = [];
  let rowsInGroups = 0;
  let rowsRemoved = 0;
  let moneyRemoved = 0;
  for (const [key, indices] of buckets) {
    // ⚠ No "more than one row" precondition: a lone row has exactly one
    // description, so the next line already rejects it. Mutation testing found
    // the extra check could never fire, and a guard nothing can test is a
    // guard nobody is testing.
    const descriptions = [...new Set(indices.map((i) => String(rows[i][descriptionColumn] ?? '').trim()))];
    if (descriptions.length < 2) continue;
    const amount = num(rows[indices[0]][amountColumn]);
    groups.push({ key, indices, amount, descriptions });
    rowsInGroups += indices.length;
    rowsRemoved += indices.length - 1;
    moneyRemoved += amount * (indices.length - 1);
  }

  return {
    supported: true,
    reason: '',
    groups,
    rowsInGroups,
    share: rows.length ? rowsInGroups / rows.length : 0,
    rowsRemoved,
    moneyRemoved: Math.round(moneyRemoved * 100) / 100,
  };
}

/**
 * The description a collapsed row carries.
 *
 * ⚠⚠ NOT one of the group's descriptions. A single check hitting eleven GL
 * accounts is not "COTTONWOOD CREEK SEWER", and asserting that it is would
 * invent a label the publisher never attached to that amount — the exact
 * defect this whole line of work exists to remove. It names what the file
 * says: the accounts the payment touched, and how many were left out.
 */
export function mergedDescription(descriptions) {
  const kept = descriptions.filter((d) => d !== '');
  if (kept.length === 0) return null;
  if (kept.length === 1) return kept[0];
  const shown = kept.slice(0, MAX_DESCRIPTIONS_SHOWN);
  const rest = kept.length - shown.length;
  return rest > 0 ? `${shown.join(' | ')} +${rest} more` : shown.join(' | ');
}

/**
 * Keep ONE row per group, carrying the check total and the merged description.
 * Row order is preserved; the kept row sits where the group's first row was.
 */
export function collapseAllocationRows(rows, opts = {}) {
  const verdict = judgeAllocationRows(rows, opts);
  if (!verdict.supported || verdict.groups.length === 0) {
    return { rows, removed: 0, money: 0, verdict };
  }
  const { descriptionColumn } = opts;
  const drop = new Set();
  const rewrite = new Map();
  for (const g of verdict.groups) {
    const [keep, ...rest] = g.indices;
    for (const i of rest) drop.add(i);
    rewrite.set(keep, mergedDescription(g.descriptions));
  }
  const out = [];
  rows.forEach((r, i) => {
    if (drop.has(i)) return;
    out.push(rewrite.has(i) ? { ...r, [descriptionColumn]: rewrite.get(i) } : r);
  });
  return { rows: out, removed: verdict.rowsRemoved, money: verdict.moneyRemoved, verdict };
}

export function describeAllocation(verdict) {
  if (!verdict.supported) return [`cannot judge: ${verdict.reason}`];
  if (!verdict.groups.length) return ['no repeated-allocation groups found'];
  const biggest = [...verdict.groups].sort((a, b) => b.indices.length - a.indices.length)[0];
  return [
    `${verdict.groups.length.toLocaleString()} group(s), ${verdict.rowsInGroups.toLocaleString()} row(s) ` +
      `(${(verdict.share * 100).toFixed(1)}% of the file)`,
    `collapsing removes ${verdict.rowsRemoved.toLocaleString()} row(s) and ` +
      `$${verdict.moneyRemoved.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    `largest: ${biggest.indices.length} lines at ` +
      `$${biggest.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} — ${mergedDescription(biggest.descriptions)}`,
  ];
}
