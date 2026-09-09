/**
 * What the auditor actually said about each Indiana county entity-year loaded.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * `audit_grade = audited_gaap` needs evidence recorded PER DOCUMENT, not the
 * assumption that an ACFR is audited. Wave 1 is the first family in TT where
 * that evidence is not uniform: **eleven of the thirty-one loaded entity-years
 * carry a MODIFIED opinion on some opinion unit.**
 *
 * ⚠⚠ AND `project_audit_grade_reader_facing` RECORDS AN OPEN DEFECT: a
 * QUALIFIED opinion currently grades identically to a CLEAN one. That defect is
 * harmless where every document is clean. It is not harmless here, so the
 * modifications are written down where a reader and a future gate can both find
 * them, rather than being dissolved into a single grade string.
 *
 * Produced by `scripts/verifyInCountyOpinions.py`, which reads the auditor's own
 * section headings out of each document; every entry below was then read in the
 * document by hand, because a heading regex is a locator, not a verdict.
 *
 * ── THE QUESTION EACH ENTRY ANSWERS ────────────────────────────────────────
 *
 * This route loads the **Total Governmental Funds** column of the governmental
 * funds Statement of Revenues, Expenditures and Changes in Fund Balances. So the
 * question is never "is this report clean" — it is "does any modification reach
 * the FUND-LEVEL opinion units that column is built from" (each major fund, plus
 * the Aggregate Remaining Fund Information, which holds the nonmajor
 * governmental funds).
 *
 *   `scope` = 'fund_level'      the loaded figures are themselves modified
 *   `scope` = 'outside'         the modification names a unit this column does
 *                               not report
 *
 * ⚠⚠ ONE ENTITY-YEAR IN WAVE 1 IS `fund_level`: ALLEN COUNTY FY2020.
 */

/** Every loaded entity-year with no modification of any kind. */
export const IN_COUNTY_UNMODIFIED = Object.freeze({
  // Marion — a private firm's ACFR opinion, unmodified in all ten years.
  // ⚠ FY2016 is Marion's FIRST GAAP year: its own notes say "Financial
  // statements for periods prior to 2016 were prepared on the modified cash
  // basis of accounting". That is why the window opens at FY2016 and why the
  // document mentions a special-purpose framework at all.
  marion: Object.freeze([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]),
  // Hamilton — unmodified in all ten years; FAC's `gaap_results` agrees
  // (`unmodified_opinion`, no second token) on every one.
  hamilton: Object.freeze([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]),
});

/**
 * Every loaded entity-year carrying a modified opinion, with the auditor's own
 * words and which opinion units it names.
 *
 * Keyed `<entityKey>-<fiscalYear>`.
 */
export const IN_COUNTY_MODIFIED_OPINIONS = Object.freeze({
  // ── ALLEN COUNTY: A QUALIFICATION IN ALL TEN YEARS, ON THE COMPONENT UNITS ──
  //
  // The county does not present the fire protection districts (and, through
  // FY2017, the Solid Waste District) as discretely presented component units,
  // which GAAP requires. A discretely presented component unit is a LEGALLY
  // SEPARATE organisation shown in a column of its own on the government-wide
  // statements; it appears nowhere in the governmental FUNDS statement, so the
  // figures loaded here are not the ones the auditor took exception to.
  //
  // ⚠ FAC's `gaap_results` records ONLY `qualified_opinion` for FY2016 and
  // FY2017 — it omits the unmodified opinions the document plainly gives on the
  // governmental activities, each major fund and the aggregate remaining fund
  // information. The metadata under-reports; the document is the authority.
  ...Object.fromEntries([2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024].map((fy) => [
    `allen-${fy}`,
    {
      scope: 'outside',
      units: ['Aggregate Discretely Presented Component Units'],
      kind: 'qualified',
      why: 'The County did not present the Southwest / Northeast / Northwest / West Central '
        + 'Allen County Fire Protection Districts (and, through FY2017, the Allen County '
        + 'Solid Waste District) as discretely presented component units, as GAAP requires. '
        + 'A discretely presented component unit is a legally separate organisation shown in '
        + 'its own column on the GOVERNMENT-WIDE statements and appears nowhere in the '
        + 'governmental funds statement this row is built from. Governmental Activities, '
        + 'each major fund and the Aggregate Remaining Fund Information are UNMODIFIED.',
    },
  ])),
  // ⚠⚠ THE ONE THAT REACHES A FUND UNIT.
  'allen-2020': Object.freeze({
    scope: 'fund_level',
    units: ['Discretely Presented Component Unit', 'Aggregate Remaining Fund Information'],
    kind: 'qualified',
    why: 'TWO qualifications, and the second names a FUND-LEVEL unit. The auditor\'s stated '
      + 'basis for it is that "The County has not included a receivable for property taxes to '
      + 'be levied in the subsequent calendar year due to other governmental units IN THE '
      + 'FIDUCIARY FUNDS", nor a receivable for Unified Local Income, Excise and Financial '
      + 'Institution Taxes due to other governmental units in the fiduciary funds. '
      + '⚠ The Aggregate Remaining Fund Information opinion unit spans BOTH the nonmajor '
      + 'governmental funds (which this row reports) AND the fiduciary funds (which it does '
      + 'not), and the defect the auditor names is entirely fiduciary — an omitted receivable '
      + 'of money held FOR OTHER GOVERNMENTS, the same custodial pass-through that made '
      + "Gateway's all-funds figures unusable. It is also a BALANCE SHEET item: a receivable, "
      + 'not a revenue or an expenditure. '
      + '⚠⚠ That reasoning is a judgement, not a proof, so this year is recorded as '
      + '`fund_level` rather than argued down to `outside`. It loads, and it is FLAGGED.',
  }),

  // ── LAKE COUNTY: A DISCLAIMER ON GOVERNMENTAL ACTIVITIES ───────────────────
  ...Object.fromEntries([2020, 2021].map((fy) => [
    `lake-${fy}`,
    {
      scope: 'outside',
      units: ['Governmental Activities', 'Aggregate Discretely Presented Component Units'],
      kind: 'disclaimer + adverse',
      why: 'A DISCLAIMER of opinion on GOVERNMENTAL ACTIVITIES — the County reported '
        + '$288,186,733 of capital assets net of accumulated depreciation and $12,658,380 of '
        + 'depreciation expense "but did not provide documentation to support these amounts" '
        + '(39% of total assets) — plus an ADVERSE opinion on the component units, which the '
        + 'County omitted entirely. '
        + '⚠⚠ GOVERNMENTAL ACTIVITIES IS THE GOVERNMENT-WIDE STATEMENT, full accrual. Capital '
        + 'assets and depreciation are exactly what a modified-accrual governmental FUNDS '
        + 'statement does not report, so the auditor\'s stated basis cannot reach the figures '
        + 'loaded here. The General Fund, the ARP fund and the Aggregate Remaining Fund '
        + 'Information are each UNMODIFIED, and together they are the Total Governmental '
        + 'Funds column. '
        + '⚠ A disclaimer is still the most serious thing any wave-1 document says about its '
        + 'county. It is recorded, reported at load time, and never smoothed away.',
    },
  ])),
});

/** True when this entity-year's modification reaches the loaded figures. */
export function opinionIsFundLevel(entityKey, fiscalYear) {
  const hit = IN_COUNTY_MODIFIED_OPINIONS[`${entityKey}-${fiscalYear}`];
  return Boolean(hit && hit.scope === 'fund_level');
}

/**
 * The recorded opinion for one entity-year, or null when it is unmodified.
 *
 * ⚠⚠ THROWS when an entity-year is recorded NOWHERE. A registry that answers
 * "no modification" for a year nobody looked at is worse than no registry: it
 * launders an absence of evidence into a clean bill. Every loadable entity-year
 * must appear in exactly one of the two maps, and a test asserts it.
 */
export function opinionFor(entityKey, fiscalYear) {
  const key = `${entityKey}-${fiscalYear}`;
  const modified = IN_COUNTY_MODIFIED_OPINIONS[key];
  if (modified) return modified;
  if ((IN_COUNTY_UNMODIFIED[entityKey] || []).includes(Number(fiscalYear))) return null;
  throw new Error(`${key} has no recorded audit opinion. Run `
    + '`python scripts/verifyInCountyOpinions.py`, read the document, and record it in '
    + 'scripts/data/inCountyAcfrOpinions.mjs — silence is not a clean opinion.');
}
