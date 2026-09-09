/**
 * Indiana counties — the audited ACFR route, WAVE 1 (the four largest).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── WHY INDIANA'S COUNTIES NEED THIS AT ALL ────────────────────────────────
 *
 * TT's statewide Indiana source is the Gateway AFR, and the Gateway AFR is an
 * ALL-FUNDS TREASURY CASH REPORT. A county auditor is the collection point for
 * property tax settled and local income tax distributed to every OTHER taxing
 * unit in the county, so that custodial money is inside the county's own filing.
 * Marion County FY2023 loads at **3.3x the county's own audited
 * governmental-funds revenue** because of it, and a true own-funds scope was
 * MEASURED not to be derivable from the extract — the best principled rule still
 * left Marion at 1.87x AND deleted real county taxes.
 *
 * Chris's call, 2026-09-08: the counties come from their own audited ACFRs. The
 * Gateway rows stay alongside, flagged and honestly labelled `all_funds`.
 *
 * ── ⚠⚠ SCOPE IS TOTAL GOVERNMENTAL FUNDS, NOT THE GENERAL FUND ─────────────
 *
 * Every other member of the acfrGF corpus reads the General Fund. These read the
 * `Total Governmental Funds` column (`CityConfig(target_column='last')`), because
 * the General Fund is not the figure in dispute: Gateway's General Fund receipts
 * for Marion FY2025 are $302,836,808.87 against the ACFR's $304,421,719 — 0.5%
 * apart. The inflation lives entirely in the non-General funds, so the
 * governmental-funds total is the number that answers the question.
 *
 * ── ⚠⚠ IDENTITY IS THE COUNTY. THE EIN IS AN ATTRIBUTE OF A FILING. ────────
 *
 * South Carolina taught that ONE EIN can cover TWO governments, so an EIN join
 * MERGES two entities. Indiana breaks the same rule in the OPPOSITE direction:
 * ONE GOVERNMENT FILES UNDER TWO EINs, so an EIN join SPLITS one series.
 *
 *     Clinton  356000134 -> 356000135 (FY2024)
 *     Monroe   351732465 (FY2016) -> 351732462
 *     Sullivan 366000200 -> 356000200 (FY2024)
 *     Fayette  356000143 -> 873842728 (FY2024)
 *
 * None of the four wave-1 counties changes EIN inside the window — but the join
 * is the ROSTER COUNTY regardless, so a future wave cannot be broken by one.
 * `facEin` below is recorded as EVIDENCE of which government was resolved, and
 * a test asserts it against the roster; nothing joins on it.
 *
 * ── ⚠ THE YEAR LIST COMES FROM THE ROSTER, NEVER FROM AN ASSUMPTION ────────
 *
 * FAC coverage of Indiana's counties runs from **86 counties in FY2020 down to
 * 44 in FY2016**, because federal relief pushed counties over the $750k Single
 * Audit threshold and then back under it. Absence is a statement about the
 * THRESHOLD, not about whether a county publishes an ACFR. Lake County has no
 * FY2019 filing and no FY2025 filing yet; that is a coverage gap to REPORT, not
 * a year to invent and never a $0.
 *
 * ── ⚠⚠ ONE COUNTY-YEAR CAN CARRY TWO ACCEPTED FILINGS ──────────────────────
 *
 * Three do statewide — Allen FY2023, Tippecanoe FY2024, Vigo FY2022 — and
 * `resubmission_status` says `most_recent` on BOTH, exactly as Sumter SC's did.
 * Precedence order must never pick. `IN_COUNTY_FILING_CHOICES` records the
 * decision and the evidence for it, and `inCountyFilingsFor` REFUSES a year with
 * two filings and no recorded choice.
 *
 * ── THE FISCAL CALENDAR — CONFIRMED TWICE, NOT ASSUMED ─────────────────────
 *
 * Every Indiana county filing in the roster reports `fy_end_date` 12-31, and the
 * FAC fiscal-year census independently records month 1 for all four of these
 * counties. `censusGuard` is called per entity-year at load time so a
 * contradiction FAILS rather than being carried.
 *
 * ⭐ MEASURED: all 31 loadable entity-years come back ACTIVELY CONFIRMED, month
 * 1 — the census reaches FY2025 for both counties that filed one. (Lake FY2025
 * and Allen FY2025 are uncovered, and neither is loadable: no filing exists.)
 * The uncovered branch is still handled and still asserted at zero, because
 * silence is not disagreement and the first year the census cannot reach must
 * show up as a report rather than as a confirmation.
 *
 * ── POPULATIONS ────────────────────────────────────────────────────────────
 *
 * US Census Bureau PEP vintage 2024 (`POPESTIMATE2024`) from
 * `co-est2024-alldata.csv`, SUMLEV 050 (county). These four are Indiana's
 * largest, in this order, and the wave was chosen on that measured ranking.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

/** `https://app.fac.gov/dissemination/report/pdf/<id>` — no key, no auth. */
export const FAC_PDF_BASE = 'https://app.fac.gov/dissemination/report/pdf';

/**
 * The reader-facing `source_url` for one entity-year: the exact filing.
 *
 * ── ⚠ A DELIBERATE DEPARTURE FROM THE SOUTH CAROLINA CONVENTION ────────────
 *
 * Every other ACFR family in TT stamps the ISSUER'S PUBLICATION PAGE, because
 * that is where a reader goes. Indiana's counties get the FEDERAL AUDIT
 * CLEARINGHOUSE report URL instead, and the reason is that the alternative could
 * not be verified:
 *
 *   Marion    indy.gov's ACFR page resolves (HTTP 200) — an Indianapolis page
 *             for a consolidated city-county
 *   Lake      lakecountyin.gov/departments/auditor resolves
 *   Hamilton  no financial-reports page found; /399/ is the COURTS page
 *   Allen     allencounty.in.gov serves an INCOMPLETE TLS CHAIN to this
 *             toolchain (the Ohio AOS shape) and no auditor path under it
 *             answers 200
 *
 * ⚠⚠ AND A LANDING PAGE IS WEAKER PROVENANCE THAN A DOCUMENT ANYWAY. A county
 * that reorganises its site breaks the link for every year at once, whereas a
 * FAC report id is permanent and resolves to the EXACT audited package the
 * figures were parsed from — free, no key, no WAF, and the auditee's own
 * submission filed under federal penalty. Stamping a page nobody verified, so
 * that the field looks conventional, is how a plausible-and-inert value gets
 * shipped.
 */
export function sourceUrlFor(entity, fiscalYear) {
  const hit = inCountyFilingsFor(entity).find((f) => f.fy === Number(fiscalYear));
  if (!hit) {
    throw new Error(`${entity.name} has no FAC filing for FY${fiscalYear}, so there is no `
      + 'document to cite. A row must never carry a source_url for a year it did not read.');
  }
  return `${FAC_PDF_BASE}/${hit.reportId}`;
}

export const IN_COUNTY_STATE = 'IN';

/** ⚠ Not `city`. `treasury_ensure_municipality` keys on (name, state, entity_type). */
export const IN_COUNTY_ENTITY_TYPE = 'county';

/** The committed roster PR #154 built from the FAC bulk CSV. */
export const ROSTER_PATH = path.join(HERE, 'inCountyFacRoster.json');

let rosterCache = null;

/** The whole roster, parsed once. */
export function inCountyRoster() {
  if (!rosterCache) rosterCache = JSON.parse(readFileSync(ROSTER_PATH, 'utf8'));
  return rosterCache;
}

/** The roster entry for one county, by its full name (`Marion County`). */
export function rosterEntryFor(countyName) {
  const hit = inCountyRoster().entities.find((e) => e.name === countyName);
  if (!hit) throw new Error(`${countyName} is not in scripts/data/inCountyFacRoster.json`);
  return hit;
}

/**
 * Wave 1. Each entry is one government.
 *
 * ⚠ `facReports` is DELIBERATELY ABSENT. Recording forty report ids a second
 * time, beside a committed roster that already holds them, creates two files
 * that can disagree — and the one a reader checks would not be the one the
 * fetcher reads. The roster is the record; `inCountyFilingsFor` reads it.
 */
export const IN_COUNTY_ENTITIES = Object.freeze([
  {
    key: 'marion',
    /** ⚠ The government's name INCLUDES "County" — it is not a decoration. */
    name: 'Marion County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractMarionCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 981628,
    /** ⚠ Join key for the FAC fiscal-year census — the full name, with State. */
    censusName: 'Marion County',
    /** Evidence of which government was resolved; nothing joins on it. */
    facEin: '356000172',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    /**
     * ⚠⚠ MARION IS A CONSOLIDATED CITY-COUNTY (Indianapolis/Marion County
     * UniGov) and may be structurally unusual among the 92. It is in wave 1
     * because it is the county the whole route was justified by — but counties
     * two, three and four are the real test of whether the pattern generalises.
     */
    note: 'consolidated city-county (UniGov)',
  },
  {
    key: 'lake',
    name: 'Lake County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractLakeCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 502955,
    censusName: 'Lake County',
    facEin: '356000168',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
  {
    key: 'allen',
    name: 'Allen County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractAllenCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 399295,
    censusName: 'Allen County',
    facEin: '356000124',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
  {
    key: 'hamilton',
    name: 'Hamilton County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractHamiltonCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 379704,
    censusName: 'Hamilton County',
    facEin: '356000151',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
]);

/**
 * County-years where FAC accepted TWO filings, and which one this route reads.
 *
 * ⚠⚠ `resubmission_status` is `most_recent` on BOTH, so it cannot decide — this
 * is Sumter SC FY2024 in a second state. The rule adopted there and kept here:
 * REFUSE until the two documents have actually been compared, then record the
 * choice WITH the comparison, so a reader can see that a decision was made
 * rather than that an ordering happened to fall one way.
 *
 * Keyed `<entityKey>-<fiscalYear>`.
 */
export const IN_COUNTY_FILING_CHOICES = Object.freeze({
  'allen-2023': Object.freeze({
    reportId: '2023-12-GSAFAC-0000068814',
    why: 'BOTH filings were compared before choosing, and the STATEMENT THIS ROUTE READS '
      + 'IS IDENTICAL IN BOTH: revenue 260,926,477 and expenditure 239,548,661, every one of '
      + 'the 7 revenue roots and 14 expenditure leaves equal to the dollar, both tying at $0. '
      + 'The two documents differ on 286 lines of `pdftotext -table` output, ALL of them in '
      + 'the FIDUCIARY combining schedules: 0000055178 prints only a COMBINING STATEMENT OF '
      + 'CHANGES IN NET POSITION for the custodial funds, while 0000068814 adds the COMBINING '
      + 'STATEMENT OF FIDUCIARY NET POSITION the first one omits. '
      + '0000068814 is therefore both the LATER filing (fac_accepted_date 2024-12-05 against '
      + '2024-09-30) and the more complete one. '
      + '⚠⚠ `resubmission_status` says `most_recent` on BOTH and cannot decide — the Sumter SC '
      + 'FY2024 defect in a second state.',
  }),
});

/**
 * ⚠⚠ A THIRD CLASS OF GAP: THE FILING EXISTS, IS AUDITED AND IS NOT GAAP.
 *
 * This is the finding that resizes the whole route, and it was measured, not
 * assumed. Of the **562 Indiana county filings** on FAC, only **103 are GAAP**.
 * The other 459 are Indiana State Board of Accounts REGULATORY-BASIS reports —
 * `Statement of Receipts, Disbursements, and Cash and Investment Balances -
 * Regulatory Basis` — which is the Gateway AFR's own cash data with an audit
 * opinion on it. There is no governmental-funds statement in them to read, and
 * loading one would reproduce the exact all-funds custodial inflation this route
 * exists to escape, while calling it `audited_gaap`.
 *
 *     Indiana counties with >= 1 FAC filing                     89
 *     Indiana counties with >= 1 GAAP filing                    17   <- the ceiling
 *     GAAP county-years of 562                                 103
 *     population of the 17 (PEP 2024)                    4,386,770   = 63.4% of the state's
 *
 * ⚠⚠ SO "89 OF 92 COUNTIES FILE" WAS NEVER "89 COUNTIES CAN BE LOADED". A
 * coverage figure measured the PUBLISHER (SC wave 5); this one measured the
 * FILING OBLIGATION. Neither measures the document.
 *
 * ⭐ TWO INDEPENDENT SIGNALS AGREE ON ALL 562, with zero disagreements:
 * `gaap_results` contains `not_gaap` exactly when `sp_framework_basis` is
 * non-empty (`regulatory_basis` 342, `other_basis` 115, `cash_basis` 2). Both
 * were then confirmed against the documents themselves for wave 1.
 *
 * ⚠⚠ AND THE COVER TITLE IS NOT THE TEST. Allen County's GAAP filings carry a
 * plain SBOA `ANNUAL FINANCIAL REPORT` cover, not `Annual Comprehensive
 * Financial Report`; Lake County's REGULATORY-BASIS ones carry a `FINANCIAL
 * STATEMENT AUDIT REPORT` cover. Read the statements.
 *
 * ⭐ The 459 regulatory-basis reports are not worthless — they are an AUDIT of
 * figures TT already holds from Gateway, and could support raising those rows
 * from `self_reported_unaudited` to `audited_ocboa`. That is a separate piece of
 * work and is deliberately NOT done here.
 *
 * Keyed by entity, then fiscal year.
 */
export const IN_COUNTY_BASIS_GAPS = Object.freeze({
  lake: Object.freeze(Object.fromEntries([2016, 2017, 2018, 2022, 2023, 2024].map((fy) => [
    fy,
    'Indiana State Board of Accounts REGULATORY-BASIS report (Statement of Receipts, '
    + 'Disbursements, and Cash and Investment Balances). No governmental-funds statement '
    + 'exists in this document. FAC records `sp_framework_basis=regulatory_basis`. Only '
    + "Lake's FY2020 and FY2021 filings are GAAP.",
  ]))),
});

/**
 * Years inside the window that have NO filing at this publisher, with the cause.
 *
 * ⚠ A coverage gap is not a document-quality gap, neither is a basis gap, and
 * none of the three is ever a $0. All are reported at extract time and at load
 * time.
 */
export const IN_COUNTY_COVERAGE_GAPS = Object.freeze({
  lake: Object.freeze({
    2019: 'No FY2019 filing at FAC for EIN 356000168. Indiana county coverage is a '
      + 'property of the $750k Single Audit threshold, not of whether the county '
      + 'publishes an ACFR — 44 counties file for FY2016 and 86 for FY2020.',
    2025: 'No FY2025 filing at FAC yet. FY2025 is still arriving — 14 of 92 counties '
      + 'had filed when the roster was built (2026-09-08).',
  }),
  allen: Object.freeze({
    2025: 'No FY2025 filing at FAC yet (see above).',
  }),
});

/** Entities this wave intends to load. Kept as a function so a deferral is one line. */
export function inCountyLoadableEntities() {
  return IN_COUNTY_ENTITIES.filter((e) => !IN_COUNTY_DEFERRED[e.key]);
}

/** Entities present in the registry but deliberately NOT loaded, with the reason. */
export const IN_COUNTY_DEFERRED = Object.freeze({});

/**
 * The filings to read for one entity, one per fiscal year, ascending.
 *
 * ⚠⚠ REFUSES a year carrying two accepted filings unless the choice is recorded
 * in `IN_COUNTY_FILING_CHOICES`. Letting `[0]` decide is how a reissued audit
 * silently becomes the source.
 */
export function inCountyFilingsFor(entity) {
  const roster = rosterEntryFor(entity.name);
  return roster.years.map((y) => {
    const { year, filings } = y;
    if (filings.length === 1) {
      return { fy: year, reportId: filings[0].reportId, ein: filings[0].ein };
    }
    const chosen = IN_COUNTY_FILING_CHOICES[`${entity.key}-${year}`];
    if (!chosen) {
      throw new Error(`${entity.name} FY${year} has ${filings.length} accepted FAC filings `
        + `(${filings.map((f) => f.reportId).join(', ')}) and no recorded choice. `
        + 'FAC marks BOTH `most_recent`, so nothing here may pick by order — compare the '
        + 'two documents and record the decision in IN_COUNTY_FILING_CHOICES.');
    }
    const hit = filings.find((f) => f.reportId === chosen.reportId);
    if (!hit) {
      throw new Error(`${entity.name} FY${year}: the recorded choice ${chosen.reportId} is not `
        + `one of the filings FAC serves (${filings.map((f) => f.reportId).join(', ')}). `
        + 'A declared exception that names nothing excludes nothing.');
    }
    return { fy: year, reportId: hit.reportId, ein: hit.ein, why: chosen.why };
  }).sort((a, b) => a.fy - b.fy);
}

/** Just the fiscal years, ascending. */
export function inCountyYearsFor(entity) {
  return inCountyFilingsFor(entity).map((f) => f.fy);
}

/**
 * The fiscal year start month for one entity-year.
 *
 * ⚠ Per ENTITY-YEAR, not per entity — Summerville SC changed month inside its
 * window and only a per-year lookup caught it. No Indiana county in this wave
 * does, and the shape is kept so that the first one that does cannot slip
 * through as a constant.
 */
export function fiscalMonthFor(entity, _fiscalYear) {
  return entity.fiscalYearStartMonth;
}

/**
 * Movements of 20% or more in a loaded series, each explained from the ISSUER'S
 * OWN WORDS or from the printed statement itself.
 *
 * ── WHY THIS IS PART OF THE DELIVERABLE, NOT A NOTE ────────────────────────
 *
 * The tie gate proves the READ. It says nothing about whether a series is
 * comparable year to year, and the acfrGF how-to's own sanity check is to
 * explain every big move before shipping. Eight moves in these eight series
 * exceed 20%; all eight were decomposed by root category and traced.
 *
 * ⚠⚠ AND ONE OF THEM IS NOT A SPENDING CHANGE AT ALL — see `marion-2023`.
 *
 * Keyed `<entityKey>-<fiscalYear>`, naming the year the move lands in.
 */
export const IN_COUNTY_SERIES_NOTES = Object.freeze({
  'marion-2019': 'Operating +51.1% (295,286,654 -> 459,286,507). Capital outlays alone account '
    + 'for +97,767,127 of it, with Public safety +36,978,974 and General government +20,502,583 '
    + '— the county\'s capital programme, which continues into FY2020.',
  'marion-2020': 'Operating +31.4% (459,286,507 -> 603,393,428) and CAPITAL OUTLAYS +193,967,673 '
    + 'while Public safety FELL 30,674,625 and General government 19,593,681. A construction '
    + 'peak, not a growth in operations.',
  'marion-2022': 'Two moves in one year, in opposite directions and from different causes. '
    + 'Operating -26.6% as capital outlays unwind by 181,956,357 (the programme completing), '
    + 'partly offset by Debt service interest +31,800,903. Revenue +24.1%, driven by '
    + 'Intergovernmental +48,221,976 (federal pandemic relief) and Taxes +28,682,605.',
  // ⚠⚠ THE ONE THAT IS NOT A SPENDING CHANGE.
  'marion-2023': 'Operating +36.4%, and the CATEGORY SHAPE CHANGED IN THE SAME YEAR. Marion '
    + 'RECLASSIFIED its expenditure functions: FY2016-FY2022 print three `Current` categories '
    + '(General government, Public safety, Culture and recreation) and FY2023-FY2025 print '
    + 'SEVEN (Administration and finance, Protection of people and property, Corrections, '
    + 'Judicial, Culture and recreation, Real estate and assessments, Health and welfare). '
    + 'General government -158,914,868 and Public safety -160,327,166 against Corrections '
    + '+141,746,632 and Judicial +129,480,926 are the SAME MONEY UNDER NEW NAMES. The county '
    + 'also relabelled `Capital outlays` -> `Capital outlay` and `Redemption of notes and '
    + 'financed purchase obligations` -> `... and subscription obligations` (GASB 96). '
    + '⚠⚠ THE TOTALS REMAIN COMPARABLE ACROSS THE BREAK; THE CATEGORIES DO NOT. Loaded as '
    + 'published in both eras and flagged here. Normalising the two charts of accounts onto one '
    + 'another would be inferring intent — the Milledgeville rule.',
  'hamilton-2023': 'Operating +52.8% (214,013,913 -> 326,908,212), of which Capital outlay > '
    + 'General government is +78,075,613 and Capital outlay > Highways and streets +12,330,747. '
    + 'The FY2024 statement shows the funding side: $157,500,000 of bond proceeds and '
    + '$10,674,968 of premium as OTHER FINANCING SOURCES, which are correctly outside the '
    + 'revenue total this route loads.',
  'allen-2023': 'Revenue +22.2% (213,482,994 -> 260,926,477): Taxes +20,857,376, '
    + 'Intergovernmental +16,228,829 and Other +9,878,856. The county\'s own MD&A attributes '
    + 'the general-fund part to property (+$5.2M) and income (+$6.3M) tax and to a $5.1M rise in '
    + 'interest revenue.',
  'allen-2024': 'Revenue +24.2% (260,926,477 -> 324,150,411): Intergovernmental +34,375,899 and '
    + 'Taxes +24,504,788. Both are named by the county — the MD&A cites "the new Local Income '
    + 'Tax (LIT) correctional facility rate", and the statement shows the ARP Coronavirus Local '
    + 'Recovery Fund drawing 44,862,858 of intergovernmental revenue in its own major-fund '
    + 'column. ⚠ The $203,655,000 of bonds issued the same year is an OTHER FINANCING SOURCE and '
    + 'is correctly NOT in this figure — the LA TRAN defect, avoided by reading the printed '
    + '`Total revenues` row rather than everything above `Net change in fund balances`.',
});
