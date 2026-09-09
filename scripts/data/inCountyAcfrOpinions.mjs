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
 * ⚠⚠ WAVE 2 ADDS SEVEN MORE, AND STILL NOT ONE OF THEM IS FUND-LEVEL. Across
 * both waves: 55 loaded entity-years, 18 carrying a modification, and ALLEN
 * COUNTY FY2020 remains the ONLY one that names an opinion unit this column is
 * built from. The other seventeen name a DISCRETELY PRESENTED COMPONENT UNIT,
 * GOVERNMENTAL ACTIVITIES, or BUSINESS-TYPE ACTIVITIES — three things a
 * governmental-FUNDS total does not report.
 *
 * ⭐ THAT IS A FINDING ABOUT INDIANA, NOT A COINCIDENCE. Every one of the
 * seventeen is a boundary or full-accrual problem: a county that left a library
 * or a fire district out of its component units, or could not evidence capital
 * assets and depreciation. Modified-accrual fund statements report neither
 * component units nor capital assets, so the auditors' exceptions keep landing
 * exactly outside what this route loads.
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
 * ⚠⚠ ONE ENTITY-YEAR IN FIFTY-FIVE IS `fund_level`, AND IT IS STILL ALLEN
 * COUNTY FY2020. Wave 2 added twenty-four more loaded years and seven more
 * modifications without adding a second one.
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

  // ── WAVE 2 ──────────────────────────────────────────────────────────────
  // ⚠ FY2023 is ABSENT from St. Joseph deliberately — it has no FAC filing at
  // all and is a COVERAGE gap, not a clean year. A registry that listed it here
  // would be answering "unmodified" about a document nobody read.
  'st-joseph': Object.freeze([2019, 2022, 2024, 2025]),
  elkhart: Object.freeze([2019, 2022, 2023, 2024]),
  // ⭐ TIPPECANOE IS CLEAN IN ALL SIX LOADED YEARS — the only wave-2 county
  // that is, and FAC's `gaap_results` says `unmodified_opinion` on every one.
  // ⚠ FY2019's opinion paragraph reads "the financial statements referred to
  // above PRESENTS fairly" — the AUDITOR'S OWN GRAMMAR, not a qualification.
  // It made the fair-presentation phrase check report `fair=0` on a clean
  // report until `scripts/verifyInCountyOpinions.py` learned the singular.
  tippecanoe: Object.freeze([2019, 2020, 2021, 2022, 2023, 2024]),
  hendricks: Object.freeze([2019, 2023, 2024]),
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

  // ══ WAVE 2 ═══════════════════════════════════════════════════════════════
  //
  // ⚠⚠ TWO OF THESE ARRIVED AS BARE VERDICT HEADINGS. St. Joseph FY2020 prints
  // `Adverse Opinion` and Elkhart FY2020 `Qualified Opinion` with NO unit on the
  // heading line — and the gate's conservative default (a modification naming no
  // unit modifies everything) reported both as FUND-LEVEL. Reading the documents
  // showed each sits directly beneath its own `Basis for <kind> Opinion on
  // <unit>` heading, which names a DISCRETELY PRESENTED COMPONENT UNIT in both
  // cases. `scripts/verifyInCountyOpinions.py` now reads that heading, so the two
  // false positives no longer stand beside the one real fund-level hit.

  // ── ST. JOSEPH: THE COUNTY LEFT ITS TWO PUBLIC LIBRARIES OUT ─────────────
  'st-joseph-2020': Object.freeze({
    scope: 'outside',
    units: ['Aggregate Discretely Presented Component Units'],
    kind: 'adverse',
    why: 'ADVERSE on the aggregate discretely presented component units: management did not '
      + 'include the St. Joseph Public Library and the Mishawaka-Penn-Harris Public Library as '
      + 'discretely presented component units, as GAAP requires, and "the amount by which this '
      + 'departure would affect the assets, net position, and expenses of the governmental '
      + 'activities has not been determined". '
      + '⚠ ADVERSE is a heavier verdict than QUALIFIED and it is still about a column the '
      + 'governmental-funds statement does not print: a discretely presented component unit '
      + 'appears only on the GOVERNMENT-WIDE statements. The auditor gives UNMODIFIED opinions '
      + 'on the governmental activities, each major fund and the aggregate remaining fund '
      + 'information in the same report, and those three ARE the Total Governmental Funds '
      + 'column. '
      + '⚠ The heading is the bare word `Adverse Opinion`; the unit is named by the '
      + '`Basis for Adverse Opinion on Aggregate Discretely Presented Component Units` heading '
      + 'directly above it and by the opinion paragraph itself.',
  }),
  'st-joseph-2021': Object.freeze({
    scope: 'outside',
    units: ['Aggregate Discretely Presented Component Units'],
    kind: 'disclaimer',
    why: 'DISCLAIMER on the aggregate discretely presented component units: the St. Joseph '
      + 'County Library and the Mishawaka-Penn-Harris Public Library "were unable to provide '
      + 'sufficient information for the year ended December 31, 2021" and the auditor "was '
      + 'unable to confirm or verify by alternative means the financial statement amounts". The '
      + 'two libraries are 43%, 31% and 61% of the assets, net position and revenues of the '
      + "county's aggregate discretely presented component units. "
      + '⚠ THE SAME TWO LIBRARIES AS FY2020, one year on and one degree worse — FY2020 could '
      + 'measure the omission and give an adverse opinion, FY2021 could not obtain the evidence '
      + 'at all. Both are about the same column, and neither is in this one. The heading here '
      + 'names the unit: `Unmodified Opinions on Governmental Activities, Each Major Fund and '
      + 'Aggregate Remaining Fund Information` covers what this row is built from.',
  }),

  // ── ELKHART: FOUR PUBLIC LIBRARIES, INCOMPLETELY PRESENTED ───────────────
  'elkhart-2020': Object.freeze({
    scope: 'outside',
    units: ['Discretely Presented Component Units'],
    kind: 'qualified',
    why: 'QUALIFIED on the discretely presented component units: accumulated depreciation, '
      + 'accrued wages and withholdings payable and compensated absences were not presented for '
      + 'the Middlebury Community, Nappanee, and Wakarusa-Olive and Harrison Township public '
      + 'libraries, beginning capital asset balances did not agree with the libraries\' own '
      + 'subsidiary records, and there was insufficient evidence for the beginning balance of '
      + "books at Elkhart Public Library. The auditor's UNMODIFIED opinions cover the "
      + 'governmental activities, the business-type activities, each major fund and the '
      + 'aggregate remaining fund information. '
      + '⚠ The verdict heading is the bare `Qualified Opinion`; the unit comes from the '
      + '`Basis for Qualified Opinion on the Discretely Presented Component Units` heading.',
  }),
  'elkhart-2021': Object.freeze({
    scope: 'outside',
    units: ['Aggregate Discretely Presented Component Units'],
    kind: 'qualified',
    why: 'QUALIFIED on the aggregate discretely presented component units: compensated absences '
      + 'were not accrued as liabilities and expenses of the component units, and the county\'s '
      + 'records "did not permit us to extend our audit procedures over the beginning balance of '
      + 'books and materials for Elkhart Public Library ... stated as $2,031,982". '
      + 'UNMODIFIED on the governmental activities, the business-type activities, each major '
      + 'fund and the aggregate remaining fund information. '
      + '⚠⚠ FAC\'s `gaap_results` for this year records `qualified_opinion` AND NOTHING ELSE, '
      + 'omitting the four unmodified opinions the document plainly gives — the Allen County '
      + 'FY2016/FY2017 under-reporting shape, in a second county. THE DOCUMENT IS THE AUTHORITY.',
  }),

  // ── HENDRICKS: A SEWER DISTRICT, WHICH IS A MAJOR **ENTERPRISE** FUND ────
  //
  // ⚠⚠ THE ONLY WAVE-2 MODIFICATION THAT NAMES A "MAJOR FUND" AT ALL, and it is
  // still out of scope — because the fund is a BUSINESS-TYPE one. The auditor
  // pairs it with `Business-Type Activities` in every heading and the county's
  // own governmental-funds statement confirms it: the FY2020 column captions are
  // County General, Jail Building Corporation, Cumulative Bridge, EDIT Project,
  // Nonmajor Governmental and Total Governmental. THE SEWER DISTRICT IS NOT A
  // COLUMN ON THE PAGE THIS ROUTE READS — checked on the statement, not inferred
  // from the word "business-type".
  ...Object.fromEntries([2020, 2021].map((fy) => [
    `hendricks-${fy}`,
    {
      scope: 'outside',
      units: ['Business-Type Activities', 'Hendricks County Regional Sewer District'],
      kind: 'disclaimer',
      why: 'DISCLAIMER on the business-type activities and the Hendricks County Regional Sewer '
        + 'District: "because of the inadequacy of accounting records ... we were unable to '
        + 'obtain sufficient appropriate audit evidence regarding capital asset balances and '
        + 'activity". The auditor gives UNMODIFIED opinions on the governmental activities, the '
        + 'major discretely presented component unit, the aggregate remaining discretely '
        + 'presented component units, EACH MAJOR FUND EXCEPT FOR THE SEWER DISTRICT, and the '
        + 'aggregate remaining fund information. '
        + '⚠⚠ THE EXCEPTION IS EXPLICITLY FUND-LEVEL, WHICH IS WHY IT WAS CHECKED AGAINST THE '
        + 'STATEMENT RATHER THAN ARGUED FROM THE WORDS. The Sewer District is a major '
        + 'ENTERPRISE fund and appears in no column of the governmental funds statement; '
        + 'capital assets and depreciation, the auditor\'s stated subject, are not reported by '
        + 'a modified-accrual funds statement in any event. '
        + '⚠ FAC\'s `gaap_results` records `disclaimer_of_opinion` and nothing else for both '
        + 'years, omitting every unmodified opinion — the under-reporting shape again.',
    },
  ])),
  'hendricks-2022': Object.freeze({
    scope: 'outside',
    units: ['Business-Type Activities', 'Hendricks County Regional Sewer District'],
    kind: 'qualified',
    why: 'QUALIFIED on the business-type activities and the Hendricks County Regional Sewer '
      + 'District — the same defect as FY2020 and FY2021, one degree lighter: "the County did '
      + 'not maintain accounting records regarding capital asset activity for the year ended '
      + 'December 31, 2022, related to the Hendricks County Regional Sewer District, a major '
      + "fund of the County and the County's business-type activities\". UNMODIFIED on the "
      + 'Governmental Activities, Aggregate Discretely Presented Component Units, County '
      + 'General Fund, Jail Building Corporation Fund, ARP Coronavirus Local Fiscal Rescue Fund '
      + 'and the Aggregate Remaining Fund Information — which, named one by one, are every '
      + 'column of the statement this row is built from.',
  }),
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
