/**
 * Georgia RLGF — the anomaly register.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MILLEDGEVILLE RULE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Chris, 2026-08-29: *"It is not our job to hide bad data"* — reflect what is
 * ACCURATE, and flag what looks inconsistent, saying why.
 *
 * **Nothing in this file is withheld from the product.** Every figure recorded
 * here is LOADED exactly as the government published it. Editing or dropping a
 * verified figure because it looks outlandish would create a blind spot for
 * legitimate fraud — an outlier is a FINDING, not noise to be cleaned up. This
 * register exists so a reader can be told WHY a figure looks inconsistent, not
 * so TT can quietly decline to show it.
 *
 * ⚠ Every entry below was CORROBORATED BY INDEPENDENT AGENTS working from the
 * raw source files with neutral prompts, before being recorded — Chris's
 * standing requirement for any flag of this nature. Agents that were told only
 * the file layout and asked a question, never the conclusion.
 */

/**
 * ── FLAG 1: an implausible figure that is genuinely what was filed ──────────
 *
 * ⚠⚠ THIS IS LOADED AS PUBLISHED. It is not suppressed, capped, or corrected.
 */
export const GA_FIGURE_FLAGS = Object.freeze([
  {
    id: 'milledgeville-fy2025-rents-royalties',
    entity: 'Milledgeville',
    state: 'GA',
    fiscalYear: 2025,
    dataset: 'revenue',
    section: '3B',
    ucoa: '38.1000',
    label: 'Rents and Royalties',
    amount: 7176532550.32,
    loaded: true,
    severity: 'extreme-outlier',
    what:
      'Milledgeville (population 16,664) reported Rents and Royalties of '
      + '$7,176,532,550.32 for FY2025 — 99.57% of its own reported own-source '
      + 'revenue for the year.',
    magnitude: [
      'Roughly 18,300x the entity\'s own prior maximum for this line ($391,806.73, FY2021).',
      'The entity reported $0.00 on this same line in BOTH FY2023 and FY2024.',
      '~1,100x the largest peer figure in the same filing year: Columbus-Muscogee '
        + '$6,473,714.63 (pop ~206k), Macon-Bibb $2,144,388.00 (pop ~157k), Baldwin County $93,154.08.',
      '578x Atlanta\'s FY2025 rents and royalties ($12,406,000), and 2.2x Atlanta\'s '
        + 'ENTIRE FY2025 revenue ($3,224,314,000).',
      '~$420,000 per resident per year from this line alone.',
      '~100x the city\'s entire net position at 6/30/2024 ($71,641,244, audited).',
      'Creates a 199x revenue-to-expenditure ratio for the filing.',
    ],
    verifiedBecause: [
      'It is a LITERAL VALUE in the published file, not a read artifact. A raw BIFF8 '
        + 'record walk of the OLE stream finds the IEEE-754 double at offset 190708 as a '
        + 'type-0x0203 NUMBER record at Page 2!J49 — a hard-keyed constant. DCA\'s LOAD1 '
        + 'extract reaches it by tRef3d formula reference to that same cell.',
      'The filing\'s own arithmetic ties to the penny WITH the figure included: Section 3B, '
        + 'Total Part III and TOTAL "Own Source Revenues" all reconcile exactly.',
      'It reproduces from a SEPARATE publisher pipeline — the UGA Carl Vinson Institute '
        + 'TED Center export (ted.cviog.uga.edu/FileExport) returns the identical figure.',
    ],
    // ⚠ NO ALLEGATION IS MADE OR IMPLIED. Both corroborating agents were asked
    // for benign explanations and independently reached the same one.
    benignExplanations: [
      'A non-dollar value keyed into a dollar cell. `7176532550` is EXACTLY TEN DIGITS — '
        + 'the signature of a phone number, account number or parcel ID.',
      'A stray digit prefix: dropping the leading `7176` leaves $532,550, an entirely '
        + 'ordinary figure for this city.',
      'A units/decimal error fits POORLY — no clean power-of-ten shift lands in the '
        + 'historical range (/100 = $71.8M, /1,000 = $7.18M, /10,000 = $717K).',
    ],
    supportingContext:
      'Removing this one cell leaves FY2025 total revenue of $31,163,583, which matches the '
      + 'city\'s own FY2025 adopted budget (~$30.1M across all funds) and sits inside its '
      + 'FY2016-FY2024 range ($19.9M-$30.4M). Every other line in the filing is in trend. '
      + '⚠ The FY2025 AUDIT was not yet published at the time of loading, so the figure '
      + 'could not be checked against audited statements. The filing itself is marked '
      + '`Audited = YES` by its preparer.',
    corroboration: '2 independent agents, neutral prompts, raw files — one auditing the '
      + 'file\'s internal arithmetic and BIFF8 records, one seeking external evidence of '
      + 'the city\'s real budget size. Both confirmed the figure is genuinely published.',
  },
]);

/**
 * ── FLAG 2: the publisher's machine extract is defective ───────────────────
 *
 * ⚠⚠ THIS DOES NOT AFFECT LOADED FIGURES. TT reads the PRINTED FORM, which
 * reconciles to its own subtotals in 1,672 of 1,672 tests. These are recorded
 * because anyone else using Georgia's RLGF `LOAD1` sheet will hit them.
 *
 * MECHANISM: `LOAD1` is a formula layer over the printed Page sheets. Where a
 * form row was renumbered or moved, the reference snapped to `#REF!` and its
 * NEIGHBOUR's formula picked up the displaced value — so a real dollar amount
 * is attached to the WRONG UCOA account.
 *
 * ⚠⚠ THE SUBTOTALS STILL TIE. `LOAD1`'s `TTL_*` cells remain correct even where
 * its line items are wrong, so **a control-total check passes over misattributed
 * detail**. Three of the cases below disturb no subtotal at all. Subtotal ties
 * are NECESSARY BUT DEMONSTRABLY NOT SUFFICIENT for this source.
 *
 * ⚠ A naive reader sees these as SMALL PLAUSIBLE NUMBERS, not as errors: in the
 * raw .xls an error cell's "value" is its error CODE, so `#REF!` reads as the
 * integer **23**. That is how this hid until an independent audit named it.
 */
export const GA_EXTRACT_DEFECTS = Object.freeze([
  { entity: 'Baldwin County', fiscalYear: 2017, section: '3A', refCell: '34_2500',
    displacedTo: '34_2510', amount: 563954.00, label: 'Public Safety - E-911 Fees',
    droppedAmount: 69398.72, breaksSubtotal: true },
  { entity: 'Milledgeville', fiscalYear: 2023, section: '1C', refCell: '31_4200A',
    displacedTo: '31_4200B', amount: 458391.85, label: 'Alcoholic Beverage Excise Taxes - Beer & Wine',
    droppedAmount: 163437.00, breaksSubtotal: true },
  { entity: 'Macon-Bibb County', fiscalYear: 2020, section: '5B', refCell: '2150A',
    displacedTo: '2100A', amount: 2487618.71, label: 'Judicial Admin. - Superior Court',
    droppedAmount: 0, breaksSubtotal: false },
  { entity: 'Macon-Bibb County', fiscalYear: 2020, section: '5B', refCell: '2300C/2400C',
    displacedTo: '2300B/2400B', amount: 57140.20, label: 'State Court + Magistrate Court, machinery column',
    droppedAmount: 0, breaksSubtotal: true },
  { entity: 'Macon-Bibb County', fiscalYear: 2020, section: '5C', refCell: '3326A',
    displacedTo: '3226A', amount: 18130069.97, label: 'Jail Operations',
    droppedAmount: 0, breaksSubtotal: false,
    note: '⚠ THE LARGEST: $18.13M of jail spending filed under "Prisoner Custody". '
      + 'Disturbs no subtotal — invisible to a control-total check.' },
  { entity: 'Macon-Bibb County', fiscalYear: 2020, section: '1D', refCell: '32_3100',
    displacedTo: '32_3900', amount: 10300.00, label: 'Regulatory Building Permits / Inspection Fees',
    droppedAmount: 0, breaksSubtotal: false },
  { entity: 'Macon-Bibb County', fiscalYear: 2021, section: '2', refCell: '33_1000C',
    displacedTo: '33_6103C', amount: 475901.28, label: 'Crime and Corrections Grants (federal)',
    droppedAmount: 475901.28, breaksSubtotal: true },
  { entity: 'Macon-Bibb County', fiscalYear: 2022, section: '2', refCell: '33_1000C',
    displacedTo: '33_6103C', amount: 524257.00, label: 'Crime and Corrections Grants (federal)',
    droppedAmount: 524257.00, breaksSubtotal: true },
  { entity: 'Macon-Bibb County', fiscalYear: 2023, section: '2', refCell: '33_1000C',
    displacedTo: '33_6103C', amount: 793967.00, label: 'Crime and Corrections Grants (federal)',
    droppedAmount: 793967.00, breaksSubtotal: true },
  // ── wave 2 ───────────────────────────────────────────────────────────────
  // ⚠⚠ THE ONLY ONE WHOSE PRINTED TOTAL ALSO BROKE. Every entry above leaves
  // the printed form intact, which is why "read the page" rescued them. Here
  // the same editing gesture shortened the page's own SUM range too, so this
  // row has a GA_FORM_TOTAL_DEFECTS entry as well — and it is the reason that
  // register had to exist at all.
  { entity: 'DeKalb County', fiscalYear: 2020, section: '5B', refCell: '2200A',
    displacedTo: '2800A', amount: 20335770.45, label: 'District Attorney',
    droppedAmount: 9479440.83, breaksSubtotal: true,
    note: '⚠ 2800A is a tRef3d pointing at Page 3 row 33 (the DISTRICT ATTORNEY\'s '
      + 'row), not row 42. So the DA\'s figure appears TWICE in the extract and the '
      + 'Public Defender\'s $9,479,440.83 is carried by no LOAD1 key at all. '
      + 'See GA_FORM_TOTAL_DEFECTS: the printed Total Section 5B is short by that '
      + 'same amount, so this filing loads from its line items.' },
]);

/**
 * ── FLAG 3: the PRINTED FORM's own total contradicts its own line items ────
 *
 * ⚠⚠ THIS IS THE EXCEPTION TO "THE PRINTED FORM IS AUTHORITATIVE", INSIDE THE
 * LOADED SCOPE. Flag 2's header says TT reads the printed form because it
 * reconciles where `LOAD1` does not. The Macon-Bibb FY2016 Part XII entry in
 * GA_OUT_OF_SCOPE_FINDINGS already showed a printed total that was wrong — but
 * that was Part XII, outside the loaded trees. These entries are inside
 * Parts I-V, so "prefer the printed page" is now measured as a strong rule with
 * named exceptions rather than a law.
 *
 * MECHANISM: the section's printed `Total Section` cell is a live SUM formula
 * whose RANGE was never extended when a line was added to the form, so the
 * total silently omits its own last row(s). The float tail on the stored result
 * (`76597267.89000002`) is the signature of a computed sum, not a typed
 * constant.
 *
 * ⚠⚠ WHAT TT LOADS, AND WHY. The LINE ITEMS load; the form's broken total does
 * not. Both figures are the government's, and the document contradicts itself —
 * so this is NOT the Milledgeville case (a verified figure that merely looks
 * wrong) and NOT a read-fidelity failure (we reproduce both numbers exactly).
 * When a document disagrees with itself, the sum of its own detail is the
 * better reading, and BOTH numbers are recorded here so the choice is visible
 * and reversible. Nothing is hidden: the omitted line is published money.
 *
 * ⚠ THE GATE IS NOT WEAKENED. `loadGeorgiaRLGF.mjs` still refuses any filing
 * whose sections do not tie, UNLESS an entry below pins ALL THREE of the
 * form's total, the items' total and the shortfall to the cent. A defect of a
 * different size, in a different section, or in a different year still refuses.
 */
export const GA_FORM_TOTAL_DEFECTS = Object.freeze([
  {
    id: 'dekalb-fy2020-5b-total-omits-public-defender',
    cicoid: '1044044',
    entity: 'DeKalb County',
    state: 'GA',
    fiscalYear: 2020,
    dataset: 'operating',
    section: '5B',
    sectionLabel: 'Judicial',
    // All three are pinned by the loader. A mismatch in any of them refuses.
    formTotal: 76597267.89,
    itemsTotal: 86076708.72,
    shortfall: 9479440.83,
    omittedCode: '2800',
    omittedLabel: 'Public Defender Administration',
    loaded: 'items',
    what:
      'DeKalb County FY2020, Page 3, Part V Section B (Judicial): the printed '
      + '"Total Section 5B" row reads $76,597,267.89 while the FOURTEEN line rows '
      + 'printed directly above it sum to $86,076,708.72. The total omits exactly '
      + 'its own last line, Public Defender Administration (UCOA 2800), '
      + '$9,479,440.83. The Part V grand total correctly sums the SECTION totals, '
      + 'so it inherits the shortfall rather than compounding it: $1,056,796,376.16 '
      + 'printed against $1,066,275,816.99 of line rows, 0.889% low.',
    verifiedBecause: [
      '⚠⚠ THE STORED FORMULA SAYS SO — this does not rest on a subset-sum search. '
        + 'Disassembling the BIFF8 token stream of the Total Section 5B row gives '
        + 'column (a) as tArea (29,2)..(41,2) = SUM(C30:C42), while its OWN sibling '
        + 'columns (b), (c) and (d) are (29,c)..(42,c) = SUM(D30:D43). Column (a) '
        + 'stops one row short. In FY2016-2019 and FY2021-2023 all four columns '
        + 'span (29,c)..(42,c); FY2020 column (a) is the sole outlier in eight years.',
      '⚠ It is invisible on the printed page BECAUSE columns (b), (c) and (d) are '
        + 'all $0.00 — the three correct ranges and the one short range produce the '
        + 'same visible result, so nothing looks out of place.',
      'Reproduced to the cent from the printed page itself: rows 30-43 of "Page 3" '
        + 'sum to 86,076,708.72 against a printed total row of 76,597,267.89, a '
        + 'difference of 9,479,440.83 = the Public Defender line exactly.',
      'The stored total is 76597267.89000002 — a float tail only a live SUM '
        + 'produces, consistent with a formula over a range, not a keyed constant.',
      'DCA\'s LOAD1 extract breaks a second way from the same editing gesture: '
        + '2200A (District Attorney) is a tRefErr3d #REF! token, and 2800A is a '
        + 'tRef3d pointing at Page 3 ROW 33 — the District Attorney\'s row, not the '
        + 'Public Defender\'s row 42. So the Public Defender\'s $9,479,440.83 is '
        + 'carried by NO LOAD1 key at all and the DA\'s figure appears twice. '
        + 'Summing the broken extract reproduces the printed total EXACTLY: '
        + '56,261,497.44 + 20,335,770.45 = 76,597,267.89.',
      '⚠ In the raw .xls the #REF! cell\'s stored "value" reads back as the integer '
        + '23 — the error CODE. A value-only read sees a small plausible number; '
        + 'only a cell-TYPE check catches it.',
      'Independently reproduced in both representations: all 10,750 numeric cells '
        + 'across Page 3, Page 4 and LOAD1 for all eight DeKalb years agree exactly '
        + 'between the publisher\'s .xls and TT\'s .xlsx conversion, and the LOAD1 '
        + 'Part V key set is a perfect bijection with the page key set in every '
        + 'year — so no line row was dropped by either parser.',
      '223 of the 224 section-column checks across DeKalb\'s eight filings (7 '
        + 'sections x 4 object columns x 8 years) tie exactly. This is the only one '
        + 'that does not.',
      'EXTERNAL: DeKalb County\'s own 2020 CAFR (p. 36, General Fund, budget basis, '
        + 'stated in thousands) publishes Public defender actual $11,038,000 and '
        + 'District attorney actual $19,111,000, its twelve office lines summing '
        + 'exactly to the published total. The Public Defender is a real, material, '
        + 'recurring line — $9,447K (2018), $10,355K (2019), $11,038K (2020), '
        + '$9,979K (2021), $12,447K (2022) — so a Judicial total that excludes it '
        + 'is understated, not merely differently scoped.',
      'EXTERNAL, magnitude: DeKalb reports its court function as "Civil and '
        + 'criminal court system", which uniquely INCLUDES the Sheriff\'s Office '
        + '($85,624K) and Medical Examiner ($4,712K). Removing those from the '
        + 'FY2020 General Fund actual leaves $90,354K — near the RLGF line-item '
        + 'sum of $86.08M and far from the broken $76.60M.',
    ],
    // ⚠ NO ALLEGATION. This is routine spreadsheet mechanics on a form that is
    // revised year to year, and it understates a figure rather than inflating it.
    benignExplanations: [
      'A SUM range that was not extended, or was re-typed or dragged by hand in '
        + 'ONE column while the other three kept the original — the single most '
        + 'common spreadsheet defect there is.',
      'A row cut, deleted or dragged on Page 3 while the form was being filled in. '
        + 'Formulas pointing AT a moved row either follow it or collapse to #REF!, '
        + 'and FY2020 shows exactly one of each (2800A followed a row to position '
        + '33, 2200A collapsed). ONE editing gesture explains the shortened range, '
        + 'the orphaned reference and the shifted reference together.',
      'The same fingerprint appears in the Part IV block on Page 2 of the same '
        + 'workbook, suggesting one tidying pass touched both pages of that year.',
      '⚠ It UNDERSTATES a figure rather than inflating one, and the other seven '
        + 'years of the same form are internally flawless.',
    ],
    corroboration:
      '2 independent agents, neutral prompts, raw sources, neither told the '
      + 'conclusion nor shown the other\'s work — one auditing the workbooks\' '
      + 'internal arithmetic across all eight DeKalb filings in Decimal and '
      + 'disassembling the BIFF8 formula tokens, one seeking DeKalb\'s own '
      + 'published judicial figures from the county\'s CAFRs. They converged. '
      + 'Chris\'s standing requirement for any flag of this nature.',
  },
]);

/** Look up a form-total defect. All four coordinates must match. */
export function formTotalDefect(cicoid, fiscalYear, section) {
  return GA_FORM_TOTAL_DEFECTS.find(
    (d) => d.cicoid === String(cicoid)
      && d.fiscalYear === Number(fiscalYear)
      && d.section === section,
  ) || null;
}

/**
 * ── Recorded but OUTSIDE the loaded trees ──────────────────────────────────
 *
 * Kept so the FY2009-2015 follow-up and the statewide sweep inherit them rather
 * than rediscovering them.
 *
 * ⚠⚠ THE SECOND ENTRY QUALIFIES "THE PRINTED FORM IS AUTHORITATIVE". That claim
 * is measured and holds for Parts I-V — the loaded scope, 1,672/1,672. It does
 * NOT hold universally: on one filing the printed form's own total formula
 * contradicts its own printed caption. Verified directly, not taken on report.
 */
export const GA_OUT_OF_SCOPE_FINDINGS = Object.freeze([
  {
    what: 'Baldwin County FY2019 Part XII (cash and investments): $1,721,990 displaced '
      + 'from column (c) into column (b) by a #REF!.',
    why: 'Part XII is a balance-sheet table, not a revenue or expenditure flow. Not loaded.',
  },
  {
    what: 'Macon-Bibb FY2016 Part XII: the printed total row is captioned "TOTAL PART XII '
      + '(excl. Held Prev. Yr)" but its formula INCLUDES the prior-year row. Verified '
      + 'directly: TTL_12x == items + PY_x in all four columns (A, C, D, E). Aggregate '
      + 'overstatement $99,304,981. The same government\'s FY2017 filing computes it correctly.',
    why: 'Not loaded. ⚠ But it is the one measured case where THE PRINTED FORM ITSELF is '
      + 'wrong, so "prefer the printed page" is a finding about Parts I-V, not a law.',
  },
  {
    what: 'Macon-Bibb FY2016 carries 921 LOAD1 keys where every other filing has 924. '
      + 'Verified: the difference is exactly `_D4` lacking SF_ODC_A/B/C (other debt costs).',
    why: 'Resolves the "unexplained variant" follow-up from recon. _D4 is a debt schedule, '
      + 'outside the loaded trees, so the filing loads normally.',
  },
  {
    what: 'The pre-FY2016 workbooks carry 1,393 #REF! cells across their `Data` / '
      + '`Exportable Data` sheets and have no LOAD1 layer at all.',
    why: '⚠ A live hazard for the FY2009-2015 follow-up: that generation is MORE '
      + 'error-ridden than the one loaded here, not less.',
  },
  {
    what: 'Columbus-Muscogee carries 447 FY2016+ error cells, but every one is in a debt or '
      + 'attachment sheet (`Bonded Debt Schedules`, `Debt Schedule`). None in LOAD1 or Pages 1-6.',
    why: 'Its ten loaded years are clean in the audited surface — the one entity with no '
      + 'extract defect at all.',
  },
  // ── wave 2 (2026-10-17) ──────────────────────────────────────────────────
  {
    what: 'DeKalb FY2020 Part IV carries the SAME fingerprint as its Part V defect: LOAD1 '
      + 'key `34_4160` ("Sanitation Fees - Solid Waste Recycling Fees") is a tRefErr3d '
      + '#REF!, while its neighbour `34_4130` ("Sale of Recycled Materials") points at '
      + 'Page 2 row 63 — which IS the 34.4160 row ($310,830.06). Page 2 row 61, the real '
      + '34.4130, is blank. One key re-pointed at a neighbour, one orphaned.',
    why: 'Part IV is public utility / enterprise REVENUE, excluded from the loaded trees by '
      + 'the form\'s own scope statement. ⚠ Recorded because it corroborates that ONE '
      + 'editing pass touched both pages of that workbook, and because the FY2009-2015 '
      + 'follow-up and the statewide sweep will meet this shape again.',
  },
  {
    what: '⚠⚠ A LOAD1 PARSER TRAP: the sheet REUSES bare UCOA key names (`3200A`, `4400A`, '
      + '`5100A`, ...) in block `_E9`, which is PART X (intergovernmental expenditures, '
      + '`TTL_Part10`) — not Part V. A flat key->value dict over the whole sheet collides '
      + 'and manufactures roughly 12 spurious "LOAD1 says $0" mismatches per filing.',
    why: 'Not a defect in the source — a defect in any naive reader of it. TT already '
      + 'scopes lookups per block via SECTION_BLOCKS/scopedLookup, so it is immune; this '
      + 'is recorded for anyone else reading Georgia\'s LOAD1, and as the reason that '
      + 'scoping must never be flattened for convenience.',
  },
  {
    what: '⚠ NOT YET CORROBORATED — DO NOT PUBLISH AS A FLAG. DeKalb County FY2018 reports a '
      + 'Part V total of $92,044,262.00, an ORDER OF MAGNITUDE below its own neighbours '
      + '(FY2017 $618,046,436, FY2019 $891,430,960.59), while its FY2018 revenue '
      + '($921,906,986) stays in trend. The filing is internally flawless: every section '
      + 'ties in all four columns and LOAD1 agrees throughout, so it is NOT an arithmetic '
      + 'defect. It has the shape of a filing made on a much narrower fund scope.',
    why: 'Surfaced unprompted by the FY2020 arithmetic audit, from the raw files. It is '
      + 'LOADED either way — the Milledgeville Rule — but a claim that a government\'s '
      + 'filing is scoped wrongly is exactly the class that Chris requires independent '
      + 'agents to reach on their own before TT records it. ONE chain of reasoning has '
      + 'seen this. Promote it to GA_FIGURE_FLAGS only after corroboration; until then '
      + 'it is an open observation, not a finding TT asserts.',
  },
]);
