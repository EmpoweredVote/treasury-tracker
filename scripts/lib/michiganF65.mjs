/**
 * Michigan Department of Treasury Form F-65 (Annual Local Unit Fiscal Report)
 * — parsing and tree building.
 *
 * NO SHEBANG — tests import this module.
 *
 * The F-65 is published on the state's Socrata portal as one dataset per fiscal
 * year per unit type, in LONG form: one row per (form cell). The columns that
 * matter:
 *
 *   municode      the unit's stable 6-digit key   ⚠ `lu_name` is NOT stable
 *   fy            fiscal year
 *   fiscalendmonth the ENDING month of that unit's fiscal year (6 => starts 7)
 *   category      Revenue | Expenditure | Capital | Position | Other | ...
 *   group         General Fund | All Other Governmental Funds | Enterprise
 *                 Funds | Internal Service Funds | Component Units | Total |
 *                 General Fund Final Amended Budget | ...
 *   field_name    T{table}R{row}C{column} — the printed form's grid coordinate
 *   notes         Number | Total | Sum | Sum - Total | Summary - Number | Y/N
 *   account_number the state Uniform Chart of Accounts range, blank on subtotals
 *   description   the printed line label
 *   field_data    the amount
 *
 * ── ⚠⚠ THE STRUCTURE IS PUBLISHED, NOT INFERRED ─────────────────────────────
 *
 * `notes` states each row's ROLE and `field_name` gives its position, so the
 * leaf/subtotal split is read from the source rather than guessed. Two
 * independent signals agree on every row checked: `notes === 'Number'` iff
 * `account_number` is non-blank, and `notes === 'Total'` iff it is blank.
 * Both are asserted per filing — a source that stops agreeing must fail loudly.
 *
 * ⚠⚠ `Summary - Number` ROWS HAVE A BLANK `account_number` AND ARE NOT
 * SUBTOTALS. They are balance-sheet lines — `Net Change in Fund Balances`,
 * `Fund Balance Beginning`, `Fund Balance Ending`. A "blank account number means
 * subtotal" rule would file FUND BALANCES as expenditure categories: Detroit
 * FY2024 would have gained a $1,197,106,602 "category". Both signals are
 * required, which is why neither is trusted alone.
 *
 * ── ⚠⚠ COLUMN NUMBERS IN `field_name` ARE TABLE-RELATIVE. DO NOT KEY ON THEM ─
 *
 * `General Fund` is C2 in the Revenue table (where `General Fund Final Amended
 * Budget` occupies C1) and C1 in the Expenditure table. Key on the `group`
 * string, which is unambiguous; use T and R only for ORDER.
 *
 * ── ⚠⚠ A BUDGET COLUMN SITS IN THE SAME TABLE AS THE ACTUALS ────────────────
 *
 * `General Fund Final Amended Budget` is a group like any other. Including it
 * would mix appropriations into an actuals series — the v2.28 defect. Only the
 * groups named by the caller are ever read.
 */

/** The two governmental-fund groups, per the F-65 instructions' own columns. */
export const GROUP_GENERAL_FUND = 'General Fund';
export const GROUP_OTHER_GOVERNMENTAL = 'All Other Governmental Funds';

/**
 * ⚠ Total Governmental = column a + column b, and that is the publisher's OWN
 * partition, not our invention. The instructions enumerate what column b holds:
 *
 *   "General Fund--(column a) / All Other Governmental Funds--(column b) /
 *    Permanent Funds (Combine as part of column b) / Special Revenue Funds
 *    (Combine as part of column b) / Debt Service Funds (Combine as part of
 *    column b) / Capital Project Funds (Combine as part of column b) /
 *    Enterprise Fund Type--(column c) / Discretely Presented Component Unit
 *    Funds--(column d) / Total--(column e)"
 *
 * a + b is therefore exactly GASB's governmental-funds set. The form publishes
 * no governmental-funds subtotal of its own, so the row is `derived`.
 *
 * ⚠ The form's `Total` (column e) is NOT this: it is a+b+c+d, so it folds in
 * enterprise, internal service AND discretely presented component units.
 * Verified on Detroit FY2024, every line: e.g. All Other Federal Aid Grants,
 * gov+CU 112,631,465 + enterprise 56,516,497 = 169,147,962 = the published Total.
 */
export const SCOPES = Object.freeze({
  general_fund: Object.freeze({
    id: 'general_fund',
    groups: Object.freeze([GROUP_GENERAL_FUND]),
    derivation: 'published',
    label: 'general fund',
  }),
  total_governmental: Object.freeze({
    id: 'total_governmental',
    groups: Object.freeze([GROUP_GENERAL_FUND, GROUP_OTHER_GOVERNMENTAL]),
    derivation: 'derived',
    label: 'governmental funds',
  }),
});

/** Revenue lives in table 1, expenditure in table 2. Verified across the corpus. */
export const CATEGORY_REVENUE = 'Revenue';
export const CATEGORY_EXPENDITURE = 'Expenditure';

/** The grand-total line of each table. */
const GRAND_TOTAL = /^TOTAL (REVENUES|EXPENDITURES)$/;

/**
 * ⚠⚠ FINANCING IS EXCLUDED FROM BOTH SIDES, AND FOR MICHIGAN THAT IS SYMMETRIC.
 *
 * `TOTAL OTHER FINANCING SOURCES` (revenue) and `TOTAL OTHER FINANCING USES`
 * (expenditure) are removable subtotals on both faces of the form — which is
 * exactly what South Carolina lacked, and why PR #115 had to ship an
 * acknowledged asymmetry. Michigan can do what SC structurally could not.
 *
 * Two reasons, and the second is arithmetic rather than conventional:
 *
 * 1. TT normalises to OPERATING flows — FL excludes revenue 38x Debt Proceeds,
 *    PA excludes financing sources, SC excludes bond and lease proceeds. These
 *    subtotals hold `696-698 Proceeds from Bond/Note Issuance` (Detroit FY2020)
 *    and `699 Transfers In` / `995 Transfers (Out)`.
 * 2. ⚠⚠ FOR THE TOTAL GOVERNMENTAL SCOPE THEY WOULD DOUBLE-COUNT. A transfer
 *    from the General Fund to a special revenue fund is an expenditure in
 *    column a AND a revenue in column b — both INSIDE the same derived scope.
 *    Wayne County FY2023 alone moves $330,326,239 that way. Leaving transfers in
 *    would inflate both faces of Total Governmental by the same internal money.
 */
const FINANCING_ROOT = /OTHER FINANCING (SOURCES|USES)$/;

/**
 * Strict money parser.
 *
 * ⚠⚠ THIS IS THE MOST IMPORTANT FUNCTION IN THIS FILE. Detroit FY2020 — and ONLY
 * Detroit FY2020, 517 of its 537 rows — publishes `field_data` as a FORMATTED
 * string, `"$290,017,002.00"`, where every other filing in the corpus emits a
 * bare `"290017002.00"`. Wayne FY2020 is clean, so this is a one-off defect in a
 * single upload, not an era.
 *
 * A `parseFloat` would return NaN and a `Number(x) || 0` would return ZERO, and
 * the zero is the dangerous one: the whole filing would load as $0 and EVERY
 * internal check would still pass, because a sum of zeros ties a total of zero.
 * "Any gate that can measure nothing must fail, not pass" — session 3's
 * zero-row parse, wearing a new costume.
 *
 * So: accept `$`, thousands separators and a leading minus; accept an empty cell
 * ONLY as an explicit null; and THROW on anything else rather than coerce.
 *
 * ⚠ Negatives are a LEADING minus in this corpus (290 observed), never
 * parentheses — checked, not assumed, after Nashville's trailing-paren inversion.
 * Parenthesised negatives are still accepted defensively.
 */
export function parseAmount(raw, context = '') {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const paren = /^\((.*)\)$/.exec(s);
  const body = paren ? paren[1] : s;
  const cleaned = body.replace(/\$/g, '').replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Unparseable F-65 amount ${JSON.stringify(raw)}${context ? ` (${context})` : ''}`);
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new Error(`Non-finite F-65 amount ${JSON.stringify(raw)}${context ? ` (${context})` : ''}`);
  }
  return paren ? -n : n;
}

/**
 * ⚠⚠ DECLARED PUBLISHER DEFECTS — AN EXACT REGISTRY, NEVER A TOLERANCE.
 *
 * Detroit's FY2015 filing writes three values onto TWO account lines each, while
 * its own subtotal counts each ONCE. The subtotals are right — they reconcile to
 * the grand total, which in turn reconciles to operating + financing — so the
 * CATEGORY figures are sound and only the within-category detail is corrupt:
 *
 *   Revenue     TOTAL CHARGES FOR SERVICES    86,783,156 on `626-637` AND on
 *                                             `638-642, 651, 653, 654`
 *   Expenditure TOTAL HEALTH AND WELFARE      32,630,225 on `601, 605, 610, 611`
 *                                             AND on `600-699 Except Above`
 *   Expenditure TOTAL RECREATION AND CULTURE  12,439,661 on `751-752, ...` AND
 *                                             on `803-805`
 *
 * This is Georgia's LOAD1 defect class — real money on the wrong account while
 * the subtotal stays correct — and it is INVISIBLE to a grand-total check,
 * because the grand total sums the (correct) subtotals. Only asserting each root
 * against its OWN leaves finds it. Session 4 proved subtotal ties are necessary
 * but not sufficient; this is the mirror image, and the same assertion catches
 * both.
 *
 * ⚠ WHICH line of each pair is the stray copy CANNOT be determined from the
 * extract. In each case the specific line looks plausible and the catch-all
 * duplicate does not — but "looks plausible" is not evidence, and dropping the
 * one that makes the arithmetic work is the curve-fitting error that LA-01 and
 * session 6a's reader choice both warn about. So the DETAIL IS SUPPRESSED and
 * the verified subtotal is loaded: TT publishes the category total it can prove
 * and declines to assert a breakdown the publisher's own subtotal contradicts.
 *
 * ⭐ FOLLOW-UP: Detroit's own FY2015 ACFR would arbitrate all three. Until then
 * these roots render without children, which is a visible, honest gap.
 *
 * Nothing here is a tolerance: the entry must name the exact entity, year,
 * category and root, and the observed leaf total must equal the declared
 * `leafTotal` EXACTLY. Any other mismatch still throws.
 */
export const KNOWN_DUPLICATED_DETAIL = Object.freeze([
  Object.freeze({
    municode: '822050', fiscalYear: 2015, category: 'Revenue',
    root: 'TOTAL CHARGES FOR SERVICES', published: 86783156, leafTotal: 173566312,
  }),
  Object.freeze({
    municode: '822050', fiscalYear: 2015, category: 'Expenditure',
    root: 'TOTAL HEALTH AND WELFARE', published: 32630225, leafTotal: 65260450,
  }),
  Object.freeze({
    municode: '822050', fiscalYear: 2015, category: 'Expenditure',
    root: 'TOTAL RECREATION AND CULTURE', published: 12439661, leafTotal: 24879322,
  }),

  // ⚠⚠ THE STATEWIDE SWEEP ADDED NOTHING HERE, AND THAT IS THE FINDING.
  //
  // Six of the 5,775 city and county filings first LOOKED like this defect —
  // leaves exactly 2.000x the published subtotal. They are not. Every
  // `field_name` in those filings appears TWICE, subtotals included, so the
  // whole filing is emitted twice and the leaf sum doubles while each published
  // subtotal stays correct. The detail is not contradicted; it is repeated.
  //
  // Declaring them here would have SUPPRESSED A COMPLETE AND CORRECT BREAKDOWN
  // on the strength of a ratio that matched. They are deduplicated instead — see
  // dedupeFilingRows() below — and the two whose duplicate copies DISAGREE are
  // excluded rather than deduplicated.
  //
  // ⚠ Detroit FY2015 above is genuinely the other thing: 620 keys, none
  // repeated. Checked, not assumed, when the sweep made the distinction matter.
]);

function declaredDefect({ municode, fiscalYear, category, root, published, leafTotal }) {
  return KNOWN_DUPLICATED_DETAIL.find((d) => d.municode === municode
    && d.fiscalYear === Number(fiscalYear)
    && d.category === category
    && d.root === root
    && Math.abs(d.published - published) <= 0.005
    && Math.abs(d.leafTotal - leafTotal) <= 0.005) ?? null;
}

/**
 * Collapse a filing that the portal emitted TWICE.
 *
 * ⚠⚠ WHY THIS IS NOT THE `KNOWN_DUPLICATED_DETAIL` DEFECT, THOUGH IT LOOKS LIKE
 * IT. Both produce leaves exactly 2.000x a published subtotal, and the ratio is
 * where the resemblance ends. In Detroit FY2015 three VALUES were written onto
 * two account lines each while the subtotal counted them once: the detail
 * contradicts the subtotal, nobody can tell which line is the stray, and the
 * only honest answer is to publish the subtotal and suppress the breakdown.
 *
 * Here EVERY `field_name` in the filing appears twice — leaves and subtotals
 * alike — with identical values. Nothing is contradicted; the response was
 * repeated. Treating it as the Detroit case would throw away a complete and
 * correct breakdown because a ratio matched, which is the more expensive
 * mistake: it is silent, and it looks like diligence.
 *
 * ⚠⚠ A REPEAT WHOSE COPIES DISAGREE IS NOT A REPEAT. Farmington Hills FY2018
 * has 3 keys and Keweenaw County FY2016 has 21 where the two copies carry
 * DIFFERENT amounts. There is no basis for preferring either, so this THROWS and
 * those entity-years are excluded upstream. Keeping the first, or the larger, or
 * the last, would be curve-fitting dressed as a tie-break.
 *
 * @param {object[]} rows raw F-65 rows
 * @param {string} context for the error message
 * @returns {{rows: object[], removed: number}}
 */
export function dedupeFilingRows(rows, context = '') {
  const byKey = new Map();
  for (const r of rows) {
    const key = `${r.field_name}|${r.group ?? ''}`;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, r); continue; }
    // ⚠ Compare the VALUE, not the object — the portal varies field order.
    if (String(prev.field_data) !== String(r.field_data)) {
      throw new Error(`F-65 duplicate row with CONFLICTING values${context ? ` in ${context}` : ''}: `
        + `${r.field_name} [${r.group ?? ''}] has ${prev.field_data} and ${r.field_data}. `
        + 'No basis exists for choosing between them; exclude the entity-year.');
    }
  }
  return { rows: [...byKey.values()], removed: rows.length - byKey.size };
}

/** `T1R10C2` -> `{ table: 1, row: 10, column: 2 }`. */
export function gridKey(fieldName) {
  const m = /^T(\d+)R(\d+)C(\d+)$/.exec(String(fieldName ?? '').trim());
  if (!m) return null;
  return { table: Number(m[1]), row: Number(m[2]), column: Number(m[3]) };
}

/** Source order within a table, from the printed form's own coordinates. */
function byGrid(a, b) {
  const A = gridKey(a.field_name);
  const B = gridKey(b.field_name);
  if (!A || !B) throw new Error(`F-65 row without a grid coordinate: ${JSON.stringify(a.field_name)} / ${JSON.stringify(b.field_name)}`);
  return A.table - B.table || A.row - B.row || A.column - B.column;
}

/** `TOTAL TAX REVENUES` -> `Tax Revenues`. Labels only; no amount is touched. */
export function rootLabel(description) {
  const stripped = String(description).trim().replace(/^TOTAL\s+/i, '');
  return stripped
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    // Minor words stay lowercase, except as the first word of the label.
    .replace(/(?!^)\b(And|Or|Of|For|From|To|The|In|On)\b/g, (w) => w.toLowerCase());
}

/**
 * Walk ONE group's rows for ONE category and return its roots.
 *
 * Structure comes from `notes`, order from `field_name`. Leaves accumulate until
 * a `Total` row closes them.
 */
function readGroup(rows, { category, group, context, municode, fiscalYear }) {
  const scoped = rows
    .filter((r) => r.category === category && r.group === group)
    .filter((r) => r.notes === 'Number' || r.notes === 'Total')
    .sort(byGrid);

  const roots = [];
  let published = null;
  let buffer = [];

  for (const r of scoped) {
    const hasAccount = String(r.account_number ?? '').trim() !== '';
    const where = `${context} ${category} ${r.field_name} ${r.description}`;
    const amount = parseAmount(r.field_data, where);

    if (r.notes === 'Number') {
      // ⚠ Both signals must agree. A `Number` row without an account range means
      // the publisher changed the form's contract.
      if (!hasAccount) {
        throw new Error(`F-65 leaf without an account_number: ${where}`);
      }
      buffer.push({ n: String(r.description).trim(), a: amount ?? 0, account: String(r.account_number).trim() });
      continue;
    }

    // notes === 'Total'
    if (hasAccount) throw new Error(`F-65 subtotal WITH an account_number: ${where}`);
    const label = String(r.description).trim();

    if (GRAND_TOTAL.test(label)) {
      published = (published ?? 0) + (amount ?? 0);
      buffer = [];
      continue;
    }

    const children = buffer;
    buffer = [];
    const sum = children.reduce((acc, c) => acc + c.a, 0);
    const subtotal = amount ?? 0;
    // ⚠⚠ ASSERT PER CATEGORY, NEVER ONLY ON THE GRAND TOTAL. Pennsylvania's
    // `Total Miscellaneous Revenues` excluded a sibling that sat above it and
    // misparented $13.3M while the grand total still tied.
    if (Math.abs(sum - subtotal) > 0.005) {
      // ⚠ A DECLARED defect suppresses the contradicted DETAIL and keeps the
      // verified subtotal. Anything undeclared is a new defect and must stop the
      // load — that is the gate working, not an obstacle.
      const known = declaredDefect({ municode, fiscalYear, category, root: label, published: subtotal, leafTotal: sum });
      if (!known) {
        throw new Error(`F-65 subtotal does not equal its own leaves: ${where} — leaves ${sum.toFixed(2)} vs published ${subtotal.toFixed(2)}`);
      }
      roots.push({ n: label, a: subtotal, financing: FINANCING_ROOT.test(label), c: [], suppressed: true });
      continue;
    }
    roots.push({ n: label, a: subtotal, financing: FINANCING_ROOT.test(label), c: children });
  }

  if (buffer.length) {
    throw new Error(`F-65 leaves with no closing subtotal: ${context} ${category} (${buffer.map((c) => c.n).join(', ')})`);
  }
  return { roots, published };
}

/**
 * Build one scope's tree for one filing.
 *
 * Returns the operating tree (financing removed), the operating total, the
 * financing total that was removed, and the publisher's own grand total — so a
 * caller can prove `operating + financing === published` rather than assume it.
 */
export function buildFiling(rows, { category, scope, context = '', municode, fiscalYear }) {
  const merged = new Map();
  let published = null;
  let financing = 0;
  const suppressed = [];

  for (const group of scope.groups) {
    const { roots, published: pub } = readGroup(rows, {
      category, group, municode, fiscalYear, context: `${context} [${group}]`,
    });
    if (pub !== null) published = (published ?? 0) + pub;
    for (const root of roots) {
      if (root.financing) { financing += root.a; continue; }
      const label = rootLabel(root.n);
      const slot = merged.get(label) ?? { n: label, a: 0, children: new Map(), suppressed: false };
      slot.a += root.a;
      // ⚠ Suppression is STICKY across groups. If either column's detail is
      // contradicted, the merged root cannot claim a trustworthy breakdown.
      if (root.suppressed) { slot.suppressed = true; suppressed.push(`${category}:${label}`); }
      for (const child of root.c) {
        const prev = slot.children.get(child.n) ?? 0;
        slot.children.set(child.n, prev + child.a);
      }
      merged.set(label, slot);
    }
  }

  // ⚠ Zero lines are dropped from the RENDERED tree, never from the arithmetic.
  // The FY2010-2015 template emits every form cell whether or not it holds data
  // (~765 zero rows per filing), so keeping them would bury the icicle. Dropping
  // them cannot move a total: they contribute exactly 0.
  const roots = [];
  const zeroRoots = [];
  for (const slot of merged.values()) {
    const children = slot.suppressed ? [] : [...slot.children.entries()]
      .filter(([, a]) => a !== 0)
      .map(([n, a]) => ({ n, a }));
    if (slot.a === 0 && children.length === 0 && !slot.suppressed) { zeroRoots.push(slot.n); continue; }
    roots.push(children.length ? { n: slot.n, a: slot.a, c: children } : { n: slot.n, a: slot.a });
  }

  const operating = roots.reduce((acc, r) => acc + r.a, 0);
  return { roots, operating, financing, published, zeroRoots, suppressed };
}

/**
 * The per-filing checks a loader must run. Every one is an EXACT equality — no
 * tolerance anywhere. An OCR'd South Carolina statement missed by exactly $1
 * while fusing four line items into one; a tolerance would have shipped it.
 */
export function filingChecks({ category, scope, built, context }) {
  const checks = [];
  const add = (id, kind, expected, actual) => checks.push({
    id: `${context} ${category} ${scope.id} ${id}`,
    kind,
    expected,
    actual,
    diff: actual - expected,
    ok: Math.abs(actual - expected) <= 0.005,
  });

  // The publisher's own grand total must equal what we kept plus what we removed.
  if (built.published === null) {
    checks.push({ id: `${context} ${category} ${scope.id} published-total`, kind: 'missing', expected: 0, actual: 0, diff: 0, ok: false });
  } else {
    add('operating+financing=published', 'reconciliation', built.published, built.operating + built.financing);
  }

  // Every root must equal the sum of the children we render under it.
  for (const root of built.roots) {
    if (!root.c) continue;
    add(`root:${root.n}`, 'root-sum', root.a, root.c.reduce((a, c) => a + c.a, 0));
  }
  return checks;
}
