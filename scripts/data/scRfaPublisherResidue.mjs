/**
 * South Carolina RFA — the published-total residue register.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MILLEDGEVILLE RULE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Nothing here is withheld from the product. Both entity-years below are LOADED,
 * carrying the publisher's own detail lines exactly as published. This register
 * exists so a reader can be told WHY the arithmetic does not close, not so TT can
 * quietly decline to show it — and so the loader's `subset+excluded=published`
 * gate can keep REFUSING every discrepancy that is not named here.
 *
 * ── ⚠⚠ AN EXACT REGISTRY, NEVER A TOLERANCE ────────────────────────────────
 *
 * The tempting fix is `tolerance: 5` on the published check. That would silence
 * these two rows and, with them, every future $4 discrepancy anywhere in a
 * 46-county × 13-year × 2-dataset sweep — 1,196 filings whose gate would quietly
 * stop measuring. Each entry below names ONE entity-year and ONE exact amount,
 * and `assertResiduesObserved()` fails if a declared entry is NOT observed, so a
 * residue that gets corrected in a future edition surfaces as a failure rather
 * than lingering as dead permission.
 *
 * ── WHAT WAS ACTUALLY VERIFIED ─────────────────────────────────────────────
 *
 * Bamberg County FY2020 and FY2021: the printed grand total
 * `Total Revenues (County only)` exceeds the sum of its own four depth-1
 * categories by exactly $3.
 *
 *   FY2020  printed total          11,668,263
 *           Σ own four categories  11,668,260   (9,892,188 + 1,772,492 + 3,580 + 0)
 *   FY2021  printed total          12,488,488
 *           Σ own four categories  12,488,485   (10,639,037 + 1,849,448 + 0 + 0)
 *
 * Established, not assumed:
 *
 *   1. **It is in the ORIGINAL FILE, not the conversion.** ExcelJS reading the
 *      converted .xlsx and xlrd reading RFA's original BIFF8 .xls — two readers,
 *      two formats, two algorithms — return byte-identical values for the anchor
 *      row and for every one of the 26 detail rows in the block.
 *   2. **The detail is internally perfect.** Every `parent=Σchildren` check
 *      passes at every depth in both years: Current Property Taxes ties to its
 *      three children, Licenses/Fees/Charges/Bonds to its four, Local Sources to
 *      its six, State Sources to its eight. The $3 is absent from the categories
 *      entirely; it is not a mis-parented or double-counted line.
 *   3. **No unlabeled row hides it.** Every row in the block carrying no label in
 *      columns 0-5 — which `sliceBlock` skips — reads 0.00 in both years.
 *   4. **The publisher's own aggregation sides with the TOTAL.** The statewide
 *      oracle sums the anchor row across all 46 county sheets and ties to RFA's
 *      independently published `State Summary` at $0 in both years. So the
 *      printed total is the figure RFA means; it is the detail that is short.
 *
 * ⚠ OBSERVED, AND OFFERED AS CONTEXT RATHER THAN EXPLANATION: the same county's
 * `Revenues from Other Local Sources` line reads 6,952 in FY2019 and exactly 3 in
 * FY2022, while reading 0 in the two affected years. Whether the missing $3
 * belongs to that line is not something this file can establish, and no
 * allegation is made — a $3 residue on $11.6M is 0.000026% and is far likelier a
 * transcription artifact in a self-reported submission than anything else.
 *
 * ── ⚠ THE CONSEQUENCE A READER SEES ────────────────────────────────────────
 *
 * TT loads the DETAIL, because the detail is what builds the icicle. So Bamberg's
 * loaded FY2020 revenue is $11,540,329 where the publisher's headline less bonds
 * and leases would imply $11,540,332. TT is $3 low against RFA's headline in
 * exactly these two years, by choosing the publisher's own itemisation over the
 * publisher's own total. Inventing a $3 reconciling leaf to close the gap would
 * be fabricating a figure, and is not done.
 */

/** Check ids are `<dataset>:published`, matching `checkTree()`. */
export const SC_RESIDUE_CHECK = 'published';

export const SC_PUBLISHED_TOTAL_RESIDUE = Object.freeze([
  {
    id: 'bamberg-fy2020-revenue-residue',
    entityKey: 'bamberg-county',
    name: 'Bamberg County',
    state: 'SC',
    fiscalYear: 2020,
    dataset: 'revenue',
    /** `actual - expected` from checkTree: Σdetail is $3 BELOW the printed total. */
    residue: -3,
    publishedTotal: 11668263,
    detailTotal: 11668260,
    loaded: true,
  },
  {
    id: 'bamberg-fy2021-revenue-residue',
    entityKey: 'bamberg-county',
    name: 'Bamberg County',
    state: 'SC',
    fiscalYear: 2021,
    dataset: 'revenue',
    residue: -3,
    publishedTotal: 12488488,
    detailTotal: 12488485,
    loaded: true,
  },
]);

/** The key a check failure is reconciled against. */
export function residueKey({ entityKey, fiscalYear, dataset }) {
  return `${entityKey}|${fiscalYear}|${dataset}:${SC_RESIDUE_CHECK}`;
}

const BY_KEY = new Map(SC_PUBLISHED_TOTAL_RESIDUE.map((r) => [residueKey(r), r]));

/**
 * The declared residue for one check failure, or null.
 *
 * ⚠ The amount must match EXACTLY. A declared $3 does not excuse a $4: that is
 * the difference between naming a known publisher defect and installing a
 * tolerance that stops measuring.
 */
export function declaredResidue({ entityKey, fiscalYear, checkId, diff }) {
  const r = BY_KEY.get(`${entityKey}|${fiscalYear}|${checkId}`);
  if (!r) return null;
  return r.residue === diff ? r : null;
}

/**
 * ⚠⚠ A DECLARED EXCEPTION THAT NAMES NOTHING EXCLUDES NOTHING.
 *
 * Pennsylvania shipped an exclusion carrying a wrong id — well-formed, naming a
 * real government, and inert — and only reconciling the drop count against the
 * roster found it. So every declared residue that falls INSIDE the run's scope
 * must actually have been observed, or this throws.
 *
 * @param {Set<string>} observed  residueKey()s that were actually matched
 * @param {(r: object) => boolean} inScope  was this entry's entity-year even read
 */
export function assertResiduesObserved(observed, inScope) {
  const missing = SC_PUBLISHED_TOTAL_RESIDUE
    .filter((r) => inScope(r) && !observed.has(residueKey(r)));
  if (missing.length) {
    throw new Error(`REFUSING: ${missing.length} declared publisher residues were NOT observed `
      + `(${missing.map((r) => r.id).join(', ')}). Either the edition changed and the register is `
      + 'stale, or the check that should have caught them is no longer running.');
  }
  return SC_PUBLISHED_TOTAL_RESIDUE.filter(inScope).length;
}
