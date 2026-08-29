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
]);

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
]);
