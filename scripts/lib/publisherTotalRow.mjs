/**
 * Find the row where a publisher wrote its own grand total.
 *
 * ── ⚠⚠⚠ WHAT WENT WRONG ───────────────────────────────────────────────────
 *
 * Frisco's check registers end with a row carrying no date, no vendor and the
 * description `TOTAL`. TT loaded it as a payment. Because that row equals the
 * sum of every other row, the published figure came out at EXACTLY TWICE the
 * truth, for years, in public:
 *
 *     FY      TT published        Frisco's own TOTAL        phantom
 *     2018  2,163,355,443.22      1,081,755,767.17   1,081,755,767.17
 *     2019  1,985,695,981.21      1,001,344,551.22   1,001,344,551.22
 *     2022    879,807,220.41        439,934,311.30     439,934,311.30
 *                                                   ----------------
 *                                                   2,523,034,629.69
 *
 * ⚠⚠ NO GATE COULD SEE IT. The tree tied to the total, the total tied to the
 * transactions, every row had a real amount, and the duplicate-label and
 * negative-total counters were clean. A self-consistent file loaded
 * self-consistently; it was simply counted twice.
 *
 * ⚠ AND IT IS NOT EVERY YEAR. Frisco published this row in FY2018, FY2019 and
 * FY2022 and NOT in FY2020, FY2021, or FY2023 onward. Reading one year of a
 * series and generalising is exactly how this was missed the first time.
 *
 * ── ⭐⭐ THE TEST IS SELF-PROVING ──────────────────────────────────────────
 *
 * A row is the publisher's total when it equals the sum of all the OTHER rows.
 * Nothing about that depends on a label, a column name or a publisher's habits
 * — it is arithmetic, and it carries its own proof. Equivalently, and this is
 * what the code checks: `2 x amount == grand total`.
 *
 * ⭐ THAT MAKES IT AN ORACLE, NOT JUST A FILTER. A file carrying its own total
 * states what the loader should arrive at. Once the row is excluded, the data
 * rows MUST sum to it, and `assertTieToTotal` turns the trap into a gate.
 *
 * ⚠ A corroborating signal is still required — a missing date, a missing
 * vendor, or a label saying "total". In a two-row file each row trivially
 * equals the other, and arithmetic alone would pick one at random.
 */

/** Cents. Summing 25,000 floats drifts well below this; a real total ties exactly. */
export const TIE_TOLERANCE = 0.01;

/**
 * ⚠ Below this a file is too small for "equals the sum of the others" to mean
 * anything: in a 2-row file both rows satisfy it, and in a 3-row file any row
 * equal to the other two does.
 */
export const MIN_ROWS = 10;

const LABEL = /^\s*(grand\s+)?totals?\s*[:.]?\s*$/i;

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  const neg = /^\(.*\)$/.test(s);
  const n = Number.parseFloat(s.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

/**
 * Why this row looks like a total beyond the arithmetic. Returns the reasons,
 * so a refusal can say what it saw rather than just asserting.
 */
function corroboration(row, { dateColumn, vendorColumn, descriptionColumn }) {
  const reasons = [];
  if (dateColumn && isBlank(row[dateColumn])) reasons.push('no date');
  if (vendorColumn && isBlank(row[vendorColumn])) reasons.push('no vendor');
  for (const col of [descriptionColumn, vendorColumn]) {
    if (col && LABEL.test(String(row[col] ?? ''))) { reasons.push(`labelled "${String(row[col]).trim()}"`); break; }
  }
  return reasons;
}

/**
 * @param {object[]} rows parsed rows, exactly as the loader has them
 * @param {object} opts `{ amountColumn, dateColumn, vendorColumn, descriptionColumn }`
 * @returns {{found: boolean, ambiguous: boolean, index: number|null,
 *            amount: number, dataSum: number, reasons: string[],
 *            candidates: object[]}}
 *
 * ⚠ `ambiguous` is NOT the same as `found: false`. Two rows that each equal the
 * sum of the others means the loader cannot tell which is the publisher's
 * total, and it must refuse rather than pick. Silently guessing here would
 * delete a real payment.
 *
 * ⭐ The algebra says that is almost unreachable: if rows A and B each equal
 * the sum of all the others then A = B = G/2, so every remaining row must net
 * to ZERO. An ordinary register of positive payments cannot do that; it takes
 * offsetting entries, like a file of reversals. Handled anyway, because the
 * cost of handling it is four lines and the cost of guessing is a deleted
 * payment.
 */
export function findPublisherTotalRow(rows, opts = {}) {
  const { amountColumn } = opts;
  const none = { found: false, ambiguous: false, index: null, amount: 0, dataSum: 0, reasons: [], candidates: [] };
  if (!amountColumn || !Array.isArray(rows) || rows.length < MIN_ROWS) return none;

  const amounts = rows.map((r) => num(r[amountColumn]));
  const grand = amounts.reduce((a, n) => a + n, 0);

  const candidates = [];
  for (let i = 0; i < rows.length; i += 1) {
    const amount = amounts[i];
    if (amount <= 0) continue;
    if (Math.abs(2 * amount - grand) > TIE_TOLERANCE) continue;
    const reasons = corroboration(rows[i], opts);
    if (!reasons.length) continue;        // arithmetic alone is not enough
    candidates.push({ index: i, amount, reasons, dataSum: grand - amount });
  }

  if (candidates.length === 0) return none;
  if (candidates.length > 1) {
    return { ...none, ambiguous: true, candidates };
  }
  const [c] = candidates;
  return { found: true, ambiguous: false, index: c.index, amount: c.amount, dataSum: c.dataSum, reasons: c.reasons, candidates };
}

/** The rows to actually load: everything but the publisher's own total. */
export function withoutTotalRow(rows, verdict) {
  if (!verdict || !verdict.found) return rows;
  return rows.filter((_, i) => i !== verdict.index);
}

/**
 * ⭐ The oracle half. Once the total row is out, the remaining rows must sum to
 * it — so a file that carries its own total tells the loader what to arrive at.
 *
 * @returns {{ok: boolean, expected: number, actual: number, difference: number}}
 */
export function assertTieToTotal(rows, verdict, amountColumn) {
  if (!verdict || !verdict.found) return { ok: true, expected: 0, actual: 0, difference: 0 };
  const actual = rows.reduce((a, r) => a + num(r[amountColumn]), 0);
  const difference = Math.round((actual - verdict.amount) * 100) / 100;
  return {
    ok: Math.abs(difference) <= TIE_TOLERANCE,
    expected: verdict.amount,
    actual: Math.round(actual * 100) / 100,
    difference,
  };
}

export function describeTotalRow(verdict) {
  if (verdict.ambiguous) {
    return [`${verdict.candidates.length} rows each equal the sum of all the others:`]
      .concat(verdict.candidates.map((c) => `  row ${c.index}: $${c.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${c.reasons.join(', ')})`));
  }
  if (!verdict.found) return [];
  return [`row ${verdict.index}: $${verdict.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` +
    ` — equals the sum of the other rows (${verdict.reasons.join(', ')})`];
}
