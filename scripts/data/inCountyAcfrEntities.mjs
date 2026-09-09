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

  // ── WAVE 2 — counties five to eight by PEP-2024 population ────────────────
  //
  // ⭐ THE WAVE-1 QUESTION ANSWERED: THE PATTERN GENERALISES, AND THE GAAP
  // WINDOW IS THE REAL CONSTRAINT. Only Marion, Allen and Hamilton reach back to
  // FY2016. All four counties here open at **FY2019** and not one of them files
  // GAAP before it: every FY2016-FY2018 filing they have is an SBOA
  // REGULATORY-BASIS report. That is not a coincidence of four counties — it is
  // the shape of the 17-county ceiling, measured in `IN_COUNTY_BASIS_GAPS`.
  {
    key: 'st-joseph',
    /** ⚠ THE PERIOD IS PART OF THE NAME. FAC writes `ST JOSEPH` without one, and
     * a name normaliser that did not strip periods reported this county as
     * having NO filings when it has eight — see `countyKey` in
     * scripts/buildInCountyFacRoster.mjs. Nothing here matches on the name. */
    name: 'St. Joseph County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractStJosephCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 273744,
    censusName: 'St. Joseph County',
    facEin: '356000194',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
  {
    key: 'elkhart',
    name: 'Elkhart County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractElkhartCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 207436,
    censusName: 'Elkhart County',
    facEin: '356000142',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
  {
    key: 'tippecanoe',
    name: 'Tippecanoe County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractTippecanoeCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 191650,
    censusName: 'Tippecanoe County',
    facEin: '356000202',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    /** ⚠⚠ FY2024 carries TWO accepted filings — see IN_COUNTY_FILING_CHOICES. */
    note: 'two accepted FAC filings for FY2024',
  },
  {
    key: 'hendricks',
    name: 'Hendricks County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractHendricksCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 190629,
    censusName: 'Hendricks County',
    facEin: '356000154',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },

  // ── WAVE 3 — counties nine to twelve by PEP-2024 population ───────────────
  //
  // ⭐ THE FY2019 GAAP WINDOW HELD A THIRD TIME, AND IT WAS MEASURED BEFORE A
  // BYTE WAS FETCHED: every FY2016-FY2018 filing these four counties have
  // carries `sp_framework_basis=regulatory_basis` and `gaap_results=not_gaap`,
  // and every FY2019-onward one carries a GAAP opinion and an empty
  // `sp_framework_basis`. Six loadable years each, FY2019-FY2024.
  //
  // ⚠ The wave is the next four of the SEVENTEEN GAAP counties by population —
  // Vanderburgh 180,387 · Porter 175,860 · Johnson 170,614 · Monroe 140,702,
  // ahead of Madison 134,222 and Clark 127,479. The ranking is over the 17, not
  // over the 92: population does not decide whether a county files GAAP.
  {
    key: 'vanderburgh',
    name: 'Vanderburgh County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractVanderburghCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 180387,
    censusName: 'Vanderburgh County',
    facEin: '356000205',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
  {
    key: 'porter',
    name: 'Porter County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractPorterCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 175860,
    censusName: 'Porter County',
    facEin: '356000187',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
  {
    key: 'johnson',
    name: 'Johnson County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractJohnsonCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 170614,
    censusName: 'Johnson County',
    facEin: '356000164',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    /** ⚠ No FY2018 filing at all — a coverage gap OUTSIDE the GAAP window. */
    note: 'no FY2018 filing at FAC',
  },
  {
    key: 'monroe',
    /**
     * ⚠⚠ MONROE IS THE EIN-CHANGE COUNTY THIS ROUTE WAS BUILT TO SURVIVE. Its
     * FY2016 filing is under EIN 351732465 and every filing from FY2017 is under
     * 351732462 — ONE GOVERNMENT, TWO EINs, the Indiana shape that SPLITS a
     * series if anything joins on it. Nothing here does: identity is the ROSTER
     * COUNTY and `facEin` is evidence. The value below is the one that covers
     * the loadable window (FY2019-FY2024); the FY2016 filing it does not name is
     * a REGULATORY-BASIS report this route cannot read anyway.
     */
    name: 'Monroe County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractMonroeCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 140702,
    censusName: 'Monroe County',
    facEin: '351732462',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    note: 'files under two EINs across its FAC history (351732465 -> 351732462)',
  },

  // ── WAVE 4 — THE LAST FIVE OF THE SEVENTEEN ───────────────────────────────
  //
  // ⭐⭐ THIS COMPLETES THE CEILING. After this wave every Indiana county that
  // has ever filed a GAAP audit with the Federal Audit Clearinghouse is loaded,
  // and the remaining 75 counties are not a backlog — they file on a
  // special-purpose framework and there is no governmental-funds statement in
  // their documents to read.
  //
  // ⚠⚠⚠ AND THE FY2019 WINDOW BREAKS HERE, IN THREE DIFFERENT DIRECTIONS. Waves
  // 2 and 3 found eight counties whose GAAP run opens at FY2019 and continues.
  // Not one of these five does that:
  //
  //     Madison    FY2019-FY2024   the wave-2/3 pattern, and the only one
  //     Clark      FY2021-FY2024   opens LATE — FY2019/FY2020 are CASH BASIS
  //     Delaware   FY2020-FY2024   opens one year late
  //     LaPorte    FY2019-FY2020   TWO YEARS, THEN REVERTS to other_basis
  //     Vigo       FY2019-FY2022   FOUR YEARS, THEN REVERTS to other_basis
  //
  // ⚠⚠ A REVERSION IS THE SHAPE THAT BREAKS AN ASSUMPTION NOBODY WROTE DOWN:
  // that basis moves one way. Two of these five went back. A route that fetched
  // "FY2019 onward" for a county it had seen file GAAP once would have loaded
  // five all-funds cash documents under an `audited_gaap` label.
  {
    key: 'madison',
    name: 'Madison County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractMadisonCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 134222,
    censusName: 'Madison County',
    facEin: '356000171',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
  {
    key: 'clark',
    name: 'Clark County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractClarkCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 127479,
    censusName: 'Clark County',
    facEin: '356000132',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    /** ⚠⚠ Its FY2019 and FY2020 filings are the ONLY TWO `cash_basis` filings
     * among all 562 Indiana county filings. Its GAAP run opens at FY2021. */
    note: 'the statewide cash_basis pair (FY2019, FY2020); GAAP opens FY2021',
  },
  {
    key: 'delaware',
    name: 'Delaware County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractDelawareCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 112951,
    censusName: 'Delaware County',
    facEin: '356000140',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
  },
  {
    key: 'laporte',
    /** ⚠ FAC writes `LAPORTE`; the county writes `LaPorte`. The roster's own
     * key normaliser handles the case, and nothing here matches on the name. */
    name: 'LaPorte County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractLaPorteCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 111348,
    censusName: 'LaPorte County',
    facEin: '356000169',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    /** ⚠⚠ TWO GAAP YEARS AND THEN BACK — the Lake County shape in a second
     * county, and the reason a basis gap is checked per FILING, not per era. */
    note: 'GAAP FY2019-FY2020 only, then reverts to other_basis; no FY2024 filing',
  },
  {
    key: 'vigo',
    name: 'Vigo County',
    entityType: IN_COUNTY_ENTITY_TYPE,
    extractor: 'scripts/extractVigoCountyIN.py',
    state: IN_COUNTY_STATE,
    population: 106166,
    censusName: 'Vigo County',
    facEin: '356000207',
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    /** ⚠⚠ FY2022 carries TWO accepted filings — see IN_COUNTY_FILING_CHOICES.
     * The third such county-year in this family, after Allen FY2023 and
     * Tippecanoe FY2024. */
    note: 'two accepted FAC filings for FY2022; GAAP FY2019-FY2022 then reverts',
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
  // ── ⚠⚠⚠ A DEFECTIVE PAGE, FIXED BY THE RESUBMISSION ──────────────────────
  //
  // Allen FY2023's two filings were IDENTICAL on the statement this route reads
  // and had to be separated on completeness elsewhere in the document.
  // Tippecanoe FY2024's are not identical: **the earlier filing's copy of the
  // statement is BROKEN, and it is broken on the page this family loads.**
  'tippecanoe-2024': Object.freeze({
    reportId: '2024-12-GSAFAC-0000397320',
    why: 'BOTH filings were fetched, rendered and compared. After whitespace normalisation '
      + 'the two documents differ by EXACTLY EIGHT LINES out of ~5,390, and all eight are '
      + 'missing from 0000384819 on page 25 — THE GOVERNMENTAL FUNDS STATEMENT ITSELF: the '
      + 'sub-title `Governmental Funds`, the `Year Ended December 31, 2024` line, all three '
      + 'rows of column headings (General Fund / TIF Capital Projects-Southeast / American '
      + 'Rescue Plan / Other Governmental Funds / Total Governmental Funds), the `Revenues` '
      + 'and `Taxes:` headings, and THE ENTIRE PROPERTY TAX ROW — $31,749,201 general fund, '
      + '$54,149,405 total governmental. '
      + '⚠⚠ THE INK IS GENUINELY ABSENT, not merely unextractable: page 25 was RENDERED TO '
      + 'AN IMAGE from both PDFs and read. 0000384819 prints a statement that begins at '
      + '`Income`, under no column headings at all, while still printing `Total revenues '
      + '157,570,713`. Every other line in the two documents is identical. '
      + '0000397320 is therefore both the LATER filing (fac_accepted_date 2026-01-09 against '
      + '2025-12-16) and the only COMPLETE one. '
      + '⭐ The tie gate would have caught this one — the leaves would have come up '
      + '$54,149,405 short of the printed total — but a route that relies on the safety net '
      + 'to make a choice it declined to make is one identical-total pair away from loading '
      + 'the wrong document. Compare, then record. '
      + '⚠⚠ `resubmission_status` says `most_recent` on BOTH here too.',
  }),
  // ── ⭐ A THIRD FLAVOUR: THE FINANCIAL STATEMENTS NEVER CHANGED AT ALL ─────
  //
  // Allen FY2023's pair were identical on this statement and had to be
  // separated on completeness elsewhere. Tippecanoe FY2024's earlier copy was
  // PHYSICALLY BROKEN on the page this family loads. Vigo FY2022's pair are
  // neither: the resubmission exists because a FEDERAL PROGRAM opinion in the
  // SINGLE AUDIT was revised, and the financial statements were never in
  // question.
  //
  // ⚠⚠ WHICH IS EXACTLY THE CASE THE acfrGF HOW-TO WARNS ABOUT — "a genuine
  // Qualified Opinion is usually about a FEDERAL PROGRAM in the Single Audit,
  // not the financial statements; report, never auto-downgrade." Here it is,
  // and it is also the reason the two documents exist.
  'vigo-2022': Object.freeze({
    reportId: '2022-12-GSAFAC-0000049327',
    why: 'BOTH filings were fetched and compared. THE STATEMENT THIS ROUTE READS IS IDENTICAL '
      + 'IN BOTH — same physical page 23, and byte-identical after whitespace normalisation, so '
      + 'the loaded figures cannot depend on the choice. '
      + 'The two documents differ on 289 of ~6,186 normalised lines and EVERY ONE of them is in '
      + 'the SINGLE AUDIT half: the earlier filing reports `93.563 Child Support Enforcement` as '
      + 'QUALIFIED with a `Basis for Qualified Opinion` and a finding 2022-002 for Activities '
      + 'Allowed or Unallowed; the later one reports it UNMODIFIED and says why in its own '
      + 'words — "2022-002, was revised to unmodified as a result of the additional audit '
      + 'evidence obtained". It also adds a Corrective Action Plan and an Auditor\'s Response. '
      + '0000049327 is therefore both the LATER filing (fac_accepted_date 2024-09-27 against '
      + '2023-09-28) and the SUPERSEDING one — the revision is the reason it exists. '
      + '⚠ FAC records `gaap_results=unmodified_opinion` on BOTH, which is correct and is the '
      + 'point: the revision was FEDERAL, not financial, and never touched the governmental '
      + 'funds. '
      + '⚠⚠ `resubmission_status` says `most_recent` on BOTH, a fourth time.',
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
const SBOA_REGULATORY = (which) => 'Indiana State Board of Accounts REGULATORY-BASIS report '
  + '(Statement of Receipts, Disbursements, and Cash and Investment Balances). No '
  + 'governmental-funds statement exists in this document. FAC records '
  + `\`sp_framework_basis=regulatory_basis\` and \`gaap_results=not_gaap\`. ${which}`;

/**
 * ⚠⚠ WAVE 4: `regulatory_basis` IS NOT THE ONLY WAY TO BE NOT-GAAP, AND THE
 * HELPER ABOVE HARD-CODES THE VALUE IT ASSERTS.
 *
 * Waves 1-3 met exactly one special-purpose framework, so `SBOA_REGULATORY`
 * could state `sp_framework_basis=regulatory_basis` as a constant. Wave 4 meets
 * both of the others FAC records, and a gap reason that named the wrong one
 * would be a citation to a value the filing does not carry — plausible, inert,
 * and wrong in the one field a reader would check.
 *
 *     regulatory_basis   342 of Indiana's 562 county filings
 *     other_basis        115   <- LaPorte FY2021-FY2023, Vigo FY2023-FY2024
 *     cash_basis           2   <- BOTH ARE CLARK COUNTY, FY2019 and FY2020
 *
 * ⭐ Clark's two ARE the entire statewide `cash_basis` population. That is not a
 * coincidence worth admiring — it is why the value is passed in rather than
 * assumed.
 */
const NOT_GAAP = (framework, gaapResults, which) => 'AUDITED, and NOT GAAP: a special-purpose '
  + `framework report carrying no governmental-funds statement. FAC records \`sp_framework_basis=${framework}\` `
  + `and \`gaap_results=${gaapResults}\`. ${which}`;

export const IN_COUNTY_BASIS_GAPS = Object.freeze({
  lake: Object.freeze(Object.fromEntries([2016, 2017, 2018, 2022, 2023, 2024].map((fy) => [
    fy, SBOA_REGULATORY("Only Lake's FY2020 and FY2021 filings are GAAP."),
  ]))),

  // ── ⚠⚠ WAVE 2: THE SAME THREE YEARS, IN ALL FOUR COUNTIES ─────────────────
  //
  // ⭐ THIS IS THE FINDING OF WAVE 2, AND IT WAS MEASURED, NOT GUESSED. Every
  // FY2016-FY2018 filing these four counties have is an SBOA regulatory-basis
  // report, and every FY2019-onward filing is GAAP. The transition is a
  // PUBLISHING CHANGE, not a coverage change: the counties were filing all
  // along, and what changed in FY2019 is the basis they filed on.
  //
  // ⚠⚠ SO "THE GAAP WINDOW OPENS AT FY2019" IS A STATEMENT ABOUT THE DOCUMENTS,
  // NOT ABOUT FAC'S COVERAGE. St. Joseph's FY2017 and FY2018 filings EXIST and
  // are AUDITED and are unusable here; a route that measured coverage would have
  // read them as loadable and produced the exact all-funds cash figures this
  // family exists to escape, under an `audited_gaap` label.
  //
  // Marion, Allen and Hamilton reaching FY2016 is the exception among Indiana's
  // seventeen GAAP counties, not the rule.
  'st-joseph': Object.freeze(Object.fromEntries([2017, 2018].map((fy) => [
    fy, SBOA_REGULATORY("St. Joseph's GAAP filings begin at FY2019."),
  ]))),
  elkhart: Object.freeze(Object.fromEntries([2016, 2017, 2018].map((fy) => [
    fy, SBOA_REGULATORY("Elkhart's GAAP filings begin at FY2019."),
  ]))),
  tippecanoe: Object.freeze(Object.fromEntries([2016, 2017, 2018].map((fy) => [
    fy, SBOA_REGULATORY("Tippecanoe's GAAP filings begin at FY2019."),
  ]))),
  hendricks: Object.freeze(Object.fromEntries([2016, 2017, 2018].map((fy) => [
    fy, SBOA_REGULATORY("Hendricks's GAAP filings begin at FY2019."),
  ]))),

  // ── ⭐ WAVE 3: THE FY2019 WINDOW HOLDS IN A THIRD SET OF FOUR ─────────────
  //
  // Twelve counties now, and outside Marion/Allen/Hamilton not ONE of them
  // files GAAP before FY2019. Wave 2 could still have been four counties that
  // happened to move together; three waves and eight counties is the shape of
  // the ceiling. ⚠ Johnson's FY2018 is a COVERAGE gap, not a basis one — it has
  // no filing at all — so it is declared once, below, and not twice.
  vanderburgh: Object.freeze(Object.fromEntries([2016, 2017, 2018].map((fy) => [
    fy, SBOA_REGULATORY("Vanderburgh's GAAP filings begin at FY2019."),
  ]))),
  porter: Object.freeze(Object.fromEntries([2016, 2017, 2018].map((fy) => [
    fy, SBOA_REGULATORY("Porter's GAAP filings begin at FY2019."),
  ]))),
  johnson: Object.freeze(Object.fromEntries([2016, 2017].map((fy) => [
    fy, SBOA_REGULATORY("Johnson's GAAP filings begin at FY2019, and it has no FY2018 filing."),
  ]))),
  monroe: Object.freeze(Object.fromEntries([2016, 2017, 2018].map((fy) => [
    fy, SBOA_REGULATORY("Monroe's GAAP filings begin at FY2019. ⚠ Its FY2016 filing is under a "
      + 'DIFFERENT EIN (351732465) from every later one (351732462).'),
  ]))),

  // ── ⚠⚠⚠ WAVE 4: THREE FRAMEWORKS, AND TWO COUNTIES THAT GO BACK ──────────
  //
  // Every basis gap in waves 1-3 was `regulatory_basis`, and every one of them
  // sat BEFORE the county's GAAP run. Wave 4 breaks both halves of that.
  madison: Object.freeze(Object.fromEntries([2016, 2017, 2018].map((fy) => [
    fy, SBOA_REGULATORY("Madison's GAAP filings begin at FY2019."),
  ]))),

  // ⚠⚠ CLARK OPENS AT FY2021, AND ITS TWO PRE-GAAP YEARS ARE A FRAMEWORK THIS
  // ROUTE HAD NOT MET. FY2019 and FY2020 are `cash_basis` — and they are the
  // ONLY TWO `cash_basis` filings among all 562 Indiana county filings.
  clark: Object.freeze({
    ...Object.fromEntries([2016, 2017, 2018].map((fy) => [
      fy, SBOA_REGULATORY("Clark's GAAP filings begin at FY2021."),
    ])),
    ...Object.fromEntries([2019, 2020].map((fy) => [
      fy, NOT_GAAP('cash_basis', 'not_gaap',
        'These are the ONLY TWO `cash_basis` filings in the whole 562-filing Indiana county '
        + "roster, and they are both Clark's. Clark's GAAP run opens at FY2021, so an FY2019 "
        + 'window carried over from waves 2 and 3 would have read two cash-basis documents '
        + 'here.'),
    ])),
  }),

  // ⚠ DELAWARE OPENS AT FY2020, ONE YEAR LATE. Its FY2019 filing is regulatory
  // basis AND carries an adverse opinion on GAAP — the SBOA dual-opinion
  // signature, which is what makes a regulatory-basis report what it is.
  delaware: Object.freeze({
    ...Object.fromEntries([2016, 2017, 2018].map((fy) => [
      fy, SBOA_REGULATORY("Delaware's GAAP filings begin at FY2020."),
    ])),
    2019: NOT_GAAP('regulatory_basis', 'adverse_opinion,not_gaap',
      "⚠ ONE YEAR LATER THAN THE WAVE-2/3 PATTERN. Delaware's GAAP run opens at FY2020, not "
      + 'FY2019, and this filing records the ADVERSE-ON-GAAP opinion explicitly — the SBOA '
      + 'dual-opinion signature that defines a regulatory-basis report.'),
  }),

  // ⚠⚠⚠ LAPORTE FILES GAAP FOR TWO YEARS AND GOES BACK. FY2019 and FY2020 are
  // GAAP; FY2021, FY2022 and FY2023 are `other_basis`. A basis gap AFTER the
  // GAAP run, not before it — the Lake County shape in a second county, and the
  // reason basis is checked per FILING rather than per era.
  laporte: Object.freeze({
    ...Object.fromEntries([2016, 2017, 2018].map((fy) => [
      fy, SBOA_REGULATORY("LaPorte files GAAP for FY2019 and FY2020 ONLY."),
    ])),
    ...Object.fromEntries([2021, 2022, 2023].map((fy) => [
      fy, NOT_GAAP('other_basis', 'adverse_opinion,not_gaap',
        '⚠⚠ A REVERSION, NOT A RUN-UP: LaPorte filed GAAP for FY2019 and FY2020 and then went '
        + 'BACK to a special-purpose framework. A rule of the form "GAAP from FY2019 onward" '
        + 'would have loaded three all-funds cash documents under an `audited_gaap` label.'),
    ])),
  }),

  // ⚠⚠⚠ VIGO REVERTS TOO, after four years rather than two.
  vigo: Object.freeze({
    ...Object.fromEntries([2016, 2017].map((fy) => [
      fy, SBOA_REGULATORY("Vigo files GAAP for FY2019-FY2022 ONLY."),
    ])),
    ...Object.fromEntries([2023, 2024].map((fy) => [
      fy, NOT_GAAP('other_basis', 'adverse_opinion,not_gaap',
        '⚠⚠ THE SECOND REVERSION IN THIS WAVE. Vigo filed GAAP for FY2019-FY2022 and then went '
        + 'back for FY2023 and FY2024. Both were accepted on the same day (2025-09-25).'),
    ])),
  }),
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

  // ── WAVE 2 ────────────────────────────────────────────────────────────────
  //
  // ⚠ St. Joseph's FY2023 is a HOLE INSIDE ITS OWN GAAP RUN — FY2019-FY2022 and
  // FY2024-FY2025 file, FY2023 does not. That is a coverage gap in the middle of
  // a series and it is REPORTED, never interpolated and never a $0. The county
  // is under no obligation to file a Single Audit in a year it spent less than
  // $750k of federal awards, and FY2023 is the year federal relief unwound.
  'st-joseph': Object.freeze({
    2016: 'No FY2016 filing at FAC for EIN 356000194. 44 of 92 Indiana counties filed for '
      + 'FY2016, against 86 for FY2020 — the $750k Single Audit threshold, not a publishing '
      + 'decision. (FY2016 would be a basis gap anyway: FY2017 and FY2018 are both '
      + 'regulatory basis and the GAAP run starts at FY2019.)',
    2023: 'No FY2023 filing at FAC for EIN 356000194, between GAAP filings either side of it. '
      + '⚠ A HOLE INSIDE THE SERIES, reported rather than interpolated.',
  }),
  elkhart: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  tippecanoe: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  hendricks: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),

  // ── WAVE 3 ────────────────────────────────────────────────────────────────
  vanderburgh: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  porter: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  johnson: Object.freeze({
    2018: 'No FY2018 filing at FAC for EIN 356000164 — Johnson files for FY2016, FY2017 and '
      + 'then FY2019 onward. The $750k Single Audit threshold, not a publishing decision. '
      + '⚠ It is OUTSIDE the GAAP window either way: FY2016 and FY2017 are both regulatory '
      + 'basis, so no loadable year is lost to it.',
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  monroe: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),

  // ── WAVE 4 ────────────────────────────────────────────────────────────────
  madison: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  clark: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  delaware: Object.freeze({
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  laporte: Object.freeze({
    2024: 'No FY2024 filing at FAC for EIN 356000169 — LaPorte\'s filings stop at FY2023. '
      + '⚠ It is OUTSIDE the GAAP window either way: FY2021-FY2023 are all `other_basis`, so '
      + 'no loadable year is lost to it.',
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
  }),
  vigo: Object.freeze({
    2018: 'No FY2018 filing at FAC for EIN 356000207 — Vigo files for FY2016, FY2017 and then '
      + 'FY2019 onward. The $750k Single Audit threshold, not a publishing decision. '
      + '⚠ Outside the GAAP window either way: FY2016 and FY2017 are both regulatory basis.',
    2025: 'No FY2025 filing at FAC yet — FY2025 is still arriving.',
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
 * explain every big move before shipping. Eight moves in wave 1's eight series
 * exceed 20%, NINE MORE in wave 2's eight, SIX MORE in wave 3's eight and SEVEN
 * MORE in wave 4's ten. All thirty were decomposed by root category — and, where
 * the issuer says something, traced to the issuer's own words.
 *
 * ⭐ WAVE 4 IS DRIVEN BY CONSTRUCTION, NOT BY REVENUE, and six of its seven
 * moves are one capital project going up and coming down. Vigo's FY2020, FY2021
 * and FY2022 movements are all explained by a single sentence the county
 * published — a new jail and a new convention centre, started in 2020 and
 * "expected to be completed in 2022" — and Delaware's FY2021/FY2022 pair is the
 * Fountain Square Project doing the same thing.
 *
 * ⚠⚠ AND ONE MOVE IS DELIBERATELY LEFT UNQUOTED. Madison's FY2020 MD&A narrative
 * is OFF BY ONE ROW against its own table, so every figure in it names the wrong
 * function. That note decomposes from the printed statement instead and says
 * why. An issuer narrative is evidence only while it agrees with the issuer's
 * own numbers.
 *
 * ⚠⚠ WAVE 3 ADDS A SECOND WAY A PERCENTAGE CAN MISLEAD. Wave 2 found one that
 * spanned TWO YEARS because of a missing filing (St. Joseph). Porter's spans two
 * years AND a change of chart of accounts inside the gap, so its leaf-level
 * diff shows a 44.8M line vanishing and a 48.9M line appearing where the real
 * move is +5.0M. A movement report that trusted labels across that break would
 * have described a rename as a collapse.
 *
 * ⚠⚠ ONE OF WAVE 2's IS NOT A ONE-YEAR MOVE AT ALL. St. Joseph has NO FY2023
 * filing, so its FY2024 row's neighbour in the series is FY2022 and the
 * percentage spans TWO YEARS. A movement report that assumed consecutive years
 * would describe a two-year change as a one-year one. The gap is a coverage gap
 * (`IN_COUNTY_COVERAGE_GAPS`), never interpolated and never a $0.
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
  // ══ WAVE 2 ═══════════════════════════════════════════════════════════════
  //
  // ⭐ A PATTERN ACROSS ALL FOUR COUNTIES, worth stating once rather than four
  // times: the two biggest recurring drivers are LOCAL INCOME TAX and
  // INVESTMENT EARNINGS. Indiana's LIT is distributed by the STATE on a
  // certified estimate, so a distribution change moves every county in the same
  // direction in the same year, and the 2022-2024 interest-rate environment
  // moved investment earnings the same way. Neither is a change in what a county
  // collects locally. Where a county says so itself, it is quoted.

  // ── ST. JOSEPH: THE GM/SAMSUNG BATTERY PLANT AND AWS AT NEW CARLISLE ─────
  'st-joseph-2024': 'Revenue +27.5% and operating +31.5% — ⚠⚠ ACROSS TWO YEARS, NOT ONE: '
    + 'St. Joseph has no FY2023 filing, so FY2024\'s neighbour in the series is FY2022. '
    + 'Revenue: Taxes +43,950,955 and Other revenue +43,447,734 against Intergovernmental '
    + '-27,773,531. Operating: Capital outlay +45,854,744 and Economic development +26,657,899. '
    + 'THE COUNTY NAMES THE CAUSE: its MD&A attributes the rise to "higher property tax revenue '
    + '(higher housing assessments), higher local income tax revenue, and the reimbursement from '
    + 'Amazon Web Servies (AWS) for expenses paid by the County in the New Carlisle Tax '
    + 'Increment Financing (TIF) funds", and the fall in grant revenue to "less spending on the '
    + 'American Rescue Plan grant". The statement shows it column by column: FY2024 opens TWO '
    + 'NEW MAJOR FUNDS — `New Carlisle Development Area TIF #1` (Economic development '
    + '15,988,141, Other revenue 12,913,117) and `RDA 2024B GM-Samsung Bond Capital` (Capital '
    + 'outlay 34,399,926). '
    + '⚠ The $40,000,000 of debt issued into that fund is an OTHER FINANCING SOURCE and is '
    + 'correctly NOT in the revenue figure — the LA TRAN defect, avoided by reading the printed '
    + '`Total revenues` row.',

  // ── ELKHART ──────────────────────────────────────────────────────────────
  'elkhart-2023': 'Revenue +25.7% (161,180,380 -> 202,656,239): Taxes > Income +26,019,176 and '
    + 'Investment earnings +12,552,361 — the two statewide drivers, and between them 93% of the '
    + 'move. Charges for services FELL 4,580,236 in the same year.',
  'elkhart-2024': 'Revenue +22.5% and operating +21.8%, and BOTH SIDES ARE THE SAME MONEY '
    + 'PASSING THROUGH ONE FUND. The `ARP Coronavirus LFR` column takes in 27,966,688 of '
    + 'Intergovernmental revenue and pays out 27,970,691 of Capital outlay > Health and welfare '
    + '— its whole revenue and its whole expenditure, to the dollar either side. On the revenue '
    + 'side Intergovernmental is +22,713,438 of the +45,581,978; on the expenditure side Capital '
    + 'outlay > Health and welfare is +20,705,967, alongside Current > Public safety +24,501,359 '
    + 'and Capital outlay > Highways and streets +14,123,862 against Capital outlay > General '
    + 'government -18,420,784. ⚠ The county\'s own MD&A discusses only the General Fund here '
    + '("an increase in income tax of $2,009" — in THOUSANDS, that fund\'s presentation), which '
    + 'is why the decomposition is taken from the statement rather than the narrative.',
  'elkhart-2022': 'Operating +22.2% (139,694,863 -> 170,652,616): Capital outlay > General '
    + 'government +17,336,873 and Current > General government +12,656,864, partly offset by '
    + 'Current > Public safety -6,296,248. A capital programme, not a growth in operations.',

  // ── TIPPECANOE ───────────────────────────────────────────────────────────
  'tippecanoe-2023': 'Revenue +24.6% (117,359,313 -> 146,250,929): Investment earnings (loss) '
    + '+8,564,542, Taxes > Income +7,555,468, Other > Miscellaneous +7,384,856 and Taxes > '
    + 'Property +5,594,802. The county names two of them: its MD&A records that "Income taxes '
    + 'increased by $4,185,175 mainly due to an increase in amounts distributed by the state" '
    + 'and, for the General Fund, "an increase in property taxes of $1,687,259, income taxes of '
    + '$3,464,308 and investment earnings of $4,121,772". ⚠ Those are the GOVERNMENT-WIDE and '
    + 'GENERAL FUND figures respectively; this row is TOTAL GOVERNMENTAL FUNDS, so they '
    + 'corroborate the direction and the drivers, never the total.',

  // ── HENDRICKS ────────────────────────────────────────────────────────────
  'hendricks-2020': 'Revenue +21.3% (96,592,901 -> 117,154,371): Taxes > Income +10,765,816 and '
    + 'Intergovernmental +6,446,873 — the first pandemic year. '
    + '⚠ THE DECOMPOSITION LOOKS LIKE A THIRD MOVE AND IS NOT ONE: the county relabelled '
    + '`Investment Income` to `Investment income` between the two years, so a naive label diff '
    + 'shows -3,094,156 and +2,872,463 as separate lines where the real change is -221,693. '
    + 'Both are loaded IN THE CASE THE ISSUER PRINTED — case-folding one onto the other would be '
    + 'normalising two presentations onto one another.',
  'hendricks-2023': 'Revenue +30.2% (126,787,116 -> 165,034,917): Taxes > Income +15,820,674, '
    + 'Investment earnings +12,537,753 and Intergovernmental +7,345,947. ⭐ THE COUNTY GIVES THE '
    + 'MECHANISM FOR THE LARGEST PIECE IN ITS OWN WORDS: "Income taxes increased by $12,712,833 '
    + 'due to the change in estimating local income taxes" — a change in the STATE\'S '
    + 'CERTIFICATION METHOD, not in what Hendricks County collects.',

  // ══ WAVE 3 ═══════════════════════════════════════════════════════════════
  //
  // ⭐ SIX MOVES IN EIGHT SERIES, AND THE SAME TWO STATEWIDE DRIVERS AGAIN —
  // LOCAL INCOME TAX and INVESTMENT EARNINGS. ⚠⚠ TWO OF THE SIX ARE NOT WHAT A
  // NAIVE DECOMPOSITION SAYS THEY ARE: Porter's spans two years AND a change of
  // chart of accounts, and Johnson's FY2020 expenditure move crosses the year
  // its own headings moved.

  'vanderburgh-2023': 'Revenue +20.6% (160,303,547 -> 193,255,278): Intergovernmental '
    + '+13,138,701, Investment earnings +6,181,195, Taxes > Income +5,774,136 and Taxes > '
    + 'Property +4,851,638. ⭐ THE COUNTY NAMES THE SAME MECHANISM HENDRICKS DID, in the same '
    + 'year and in almost the same words: "Income taxes increased by $3,177,626 due to the '
    + 'change in estimating local income taxes receivable" and "Property tax revenues increase '
    + 'in 2023 by $1,991,829 due to the increase in statewide property tax growth rate" — a '
    + 'change in the STATE\'S certification method and in a STATEWIDE rate, not in what '
    + 'Vanderburgh collects locally. ⚠ Those two figures are GOVERNMENT-WIDE (full accrual); '
    + 'this row is total governmental FUNDS, so they corroborate the drivers, never the total. '
    + '⭐ A free check on the READ, correctly scoped: the MD&A states that revenues exceeded '
    + 'expenditures by $10,220,242 excluding other financing sources, and 10,220,242 is exactly '
    + 'what the statement prints in the GENERAL FUND column of that row — the leftmost column, '
    + 'not the one this route loads.',

  // ── ⚠⚠ PORTER: TWO YEARS, TWO CHARTS OF ACCOUNTS, ONE PERCENTAGE ────────
  'porter-2023': 'Revenue +27.9% — ⚠⚠ ACROSS TWO YEARS, NOT ONE: Porter FY2022 is a DOCUMENT '
    + 'GAP (image-only statements at all three publishers), so FY2023\'s neighbour in the '
    + 'series is FY2021. ⚠⚠ AND THE COUNTY CHANGED ITS CHART OF ACCOUNTS IN THE SAME GAP, so a '
    + 'leaf-level diff is meaningless: FY2021 prints eight flat revenue lines and FY2023 prints '
    + 'two groups over six. Decomposed by CATEGORY across the rename: taxes 55,734,152 '
    + '(Property Taxes + Other taxes) -> 60,761,725 (Taxes > Property + Income + Other) = '
    + '+5,027,573; Intergovernmental 14,929,467 -> 27,187,546 = +12,258,079; the residual '
    + 'category, `Other receipts` -> `Other > Miscellaneous`, 21,348,032 -> 36,616,352 = '
    + '+15,268,320. Charges for services, licenses, assessments and fines all FELL slightly. '
    + '⭐ THE RESIDUAL IS AN ENDOWMENT, NOT COUNTY REVENUE IN THE ORDINARY SENSE: 23,082,699 of '
    + 'that 36,616,352 is the whole revenue of the PORTER COUNTY GOVERNMENT CHARITABLE '
    + 'NONPROFIT FOUNDATION, which the county reports as a governmental fund of its own and '
    + 'whose income is investment return. ⚠ In FY2024 the county BROKE THAT OUT as `Investment '
    + 'earnings` (25,241,235 total, of which 17,312,319 is the Foundation), leaving `Other > '
    + 'Miscellaneous` at 8,372,626 — a RECLASSIFICATION inside a +2.3% year, which is exactly '
    + 'the shape that reads as a collapse and a new source if the labels are trusted over the '
    + 'columns. The county\'s own MD&A corroborates the intergovernmental direction only '
    + '("Operating grants and contributions increased by $12,046,521") and says property and '
    + 'income taxes FELL on the government-wide basis — a different basis and a different year '
    + 'pair. Loaded as published in both charts and flagged here.',

  // ── JOHNSON ──────────────────────────────────────────────────────────────
  'johnson-2020': 'Revenue +31.1% (69,475,062 -> 91,115,244) and operating +38.7% '
    + '(68,677,440 -> 95,254,932), and the county gives the mechanism for both sides of the '
    + 'revenue move in its own words: "Local income taxes increased by $10,597,693, due to a '
    + 'NEW PUBLIC SAFETY LOCAL INCOME TAX in 2020 in the amount of $11,823,669" and "Program '
    + 'revenues (operating grants and contributions) reported an increase of $12,719,375 ... '
    + 'partially the result of $6,105,448 of funds received from the CARES Act". The statement '
    + 'agrees: Income taxes +9,461,336 and Intergovernmental +8,528,848 are 83% of the move. '
    + 'On the expenditure side Capital outlay +18,716,447 is 70% of it, alongside Public safety '
    + '+8,199,202 — the new public-safety tax being spent. '
    + '⚠⚠ THE EXPENDITURE DECOMPOSITION CROSSES A HEADING CHANGE AND MUST BE READ AS SUCH: '
    + 'FY2019 prints `Debt Service` and FY2020 `Debt service:`, so a naive label diff shows '
    + 'Principal as -2,915,000 and +5,310,000 on two separate lines where the real change is '
    + '+2,395,000. Both are loaded IN THE CASE THE ISSUER PRINTED — see the wrapper docstring '
    + 'for why Johnson\'s expenditure hierarchy needs saying out loud.',
  'johnson-2023': 'Revenue +28.2% (92,479,106 -> 118,569,544): Taxes > Income +12,158,034, '
    + 'Investment earnings +4,486,285, Taxes > Property +4,255,372 and Intergovernmental '
    + '+2,528,570 — the two statewide drivers again, and between them 63% of the move. The '
    + 'county names the first two: "Property tax revenues increased by $7,181,362 in comparison '
    + 'to the prior year due to the increase in the net levy" and "Income taxes increased by '
    + '$6,570,107", plus, for the General Fund alone, "an increase in income tax by $4,484,423 '
    + '... and an increase in revenues from investment earnings of $4,599,512". '
    + '⚠ The first two figures are GOVERNMENT-WIDE and the third GENERAL FUND; this row is '
    + 'total governmental funds. They corroborate the drivers, never the total.',

  // ── MONROE ───────────────────────────────────────────────────────────────
  'monroe-2024': 'Operating +49.2% (101,998,374 -> 152,197,987), and the largest single piece '
    + 'is NOT a programme: Debt Service > Principal Retirement +14,996,040. ⭐ THE COUNTY GIVES '
    + 'THE MECHANISM: "During 2024, the County\'s total debt decreased by $15.1 million or '
    + '36.6%. The decrease is attributed to regularly scheduled AND PREPAYMENT of debt service '
    + 'payments offset by the issuance of $3.1 million in general obligation bonds." A '
    + 'PREPAYMENT retires debt early and shows up as one year of unusually large principal '
    + 'expenditure; it is not a rise in the cost of running the county. The rest is spread: '
    + 'Current > Highway and Streets +11,740,169, Current > General Government +7,627,393, '
    + 'Capital Outlay > Highway and Streets +6,797,099, Current > Public Safety +4,109,390. '
    + '⚠ The $3.1M of bonds issued in the same year is an OTHER FINANCING SOURCE and is '
    + 'correctly NOT in the revenue figure — the LA TRAN defect, avoided by reading the printed '
    + '`Total Revenues` row rather than everything above `Net Change in Fund Balance`. '
    + '⚠ Monroe\'s revenue side moved +16.4% in the same year, under the 20% threshold, so the '
    + 'two sides of this county diverge in FY2024 by design of the prepayment.',

  // ══ WAVE 4 ═══════════════════════════════════════════════════════════════
  //
  // ⚠⚠ SEVEN MOVES, AND SIX OF THE SEVEN ARE ONE CAPITAL PROJECT GOING UP AND
  // COMING DOWN. Waves 2 and 3 were driven by REVENUE — local income tax and
  // investment earnings, statewide. Wave 4 is driven by CONSTRUCTION, and in two
  // counties the issuer names the buildings.

  // ── VIGO: A JAIL AND A CONVENTION CENTRE, IN THE COUNTY'S OWN WORDS ──────
  //
  // ⭐ ONE QUOTED SENTENCE EXPLAINS THREE OF THIS WAVE'S SEVEN MOVES, which is
  // the best return the "explain every 20% move from the issuer's own words"
  // rule has yet produced.
  'vigo-2020': 'Operating +21.1% (85,888,196 -> 104,029,618), and Capital outlay > General '
    + 'government alone is +23,341,397 of it while Current > General government FELL 6,303,697. '
    + '⭐ THE COUNTY NAMES THE CAUSE: "During 2020, Vigo County started TWO LARGE CONSTRUCTION '
    + 'PROJECTS, construction on a NEW JAIL and construction on a NEW CONVENTION CENTER, which '
    + 'resulted in the large increase in construction in progress amounts being reported. Both '
    + 'of these projects continue in 2021 and are expected to be completed in 2022." A '
    + 'construction programme, not a growth in operations.',
  'vigo-2021': 'Operating +30.4% (104,029,618 -> 135,642,012) — the SAME TWO PROJECTS at full '
    + 'height, exactly as the county said they would be. Capital outlay > General government '
    + '+18,107,129 and Capital outlay > Highways and streets +12,581,825 are 97% of the move. '
    + '⚠ Revenue moved +5.9% in the same year, so this is spending against accumulated fund '
    + 'balance and debt already issued, not a matching rise in what the county collects.',
  'vigo-2022': 'Operating -22.2% (135,642,012 -> 105,519,915) as the jail and convention centre '
    + 'COMPLETE, on the county\'s own published schedule: Capital outlay > General government '
    + '-22,414,481 and Capital outlay > Highways and streets -10,581,971, partly offset by '
    + 'Current > Culture and recreation +2,773,763. ⭐ Three consecutive movements — up, up, '
    + 'down — all three traced to one sentence the county published in FY2021.',

  // ── DELAWARE: THE FOUNTAIN SQUARE PROJECT, UP AND DOWN ──────────────────
  'delaware-2021': 'Operating +38.7% (67,194,011 -> 93,195,234), of which Capital outlay > '
    + 'General government is +17,684,088 — and the county names it: "The County issued economic '
    + 'development bonds to pay for the FOUNTAIN SQUARE PROJECT of $18,070" (⚠ the MD&A is in '
    + 'THOUSANDS, so $18.07M, which matches the capital-outlay move almost to the dollar). '
    + 'FY2021\'s statement shows it as a major fund of its own — the `Fountain Square '
    + 'Construction Fund` column. Also Current > Highways and streets +5,364,744 and Debt '
    + 'service > Principal +5,145,795. '
    + '⚠ THE $29,910 (thousand) OF BONDS ISSUED THAT YEAR IS AN OTHER FINANCING SOURCE and is '
    + 'correctly NOT in the revenue figure — revenue moved -6.0% in the same year, which is what '
    + 'a bond-funded project looks like when the borrowing is kept out of revenue. The LA TRAN '
    + 'defect, avoided by reading the printed `Total revenues` row.',
  'delaware-2022': 'Operating -27.0% (93,195,234 -> 68,039,900) — THE SAME PROJECT UNWINDING, '
    + 'and the decomposition is the FY2021 note in reverse: Capital outlay > General government '
    + '-17,742,900 (against +17,684,088 the year before), Current > Highways and streets '
    + '-4,542,799 and Current > Economic development -2,869,981. Nothing about the county\'s '
    + 'ordinary operations changed by a quarter; one construction fund emptied.',

  // ── MADISON ──────────────────────────────────────────────────────────────
  'madison-2020': 'Operating -22.1% (87,592,828 -> 68,275,571), and it is ALMOST ENTIRELY ONE '
    + 'CATEGORY IN ONE COLUMN: Current > General government -19,609,977 of a -19,317,257 total '
    + 'move. ⭐ LOCATED RATHER THAN INFERRED, by reading the printed columns: FY2019 prints '
    + 'General government 48,282,266, of which the NONMAJOR GOVERNMENTAL FUNDS column alone is '
    + '24,865,743 and County General is 23,085,588; FY2020 prints 28,672,289, of which nonmajor '
    + 'is 5,711,479 and County General 22,960,810. The County General column barely moves '
    + '(-124,778). The whole change is in the nonmajor funds. '
    + '⚠⚠ NO ISSUER NARRATIVE IS QUOTED HERE, AND THAT IS DELIBERATE: MADISON\'S OWN FY2020 '
    + 'MD&A IS OFF BY ONE ROW AGAINST ITS OWN TABLE. The table lists Expenses 36,425 / General '
    + 'government 21,547 / Public safety 19,060 (thousands); the narrative beneath it says '
    + '"General government expenses reported a total amount of $36,425. Public safety expenses '
    + 'reported a total amount of $21,547. Highway and streets expenses reported a total amount '
    + 'of $19,060." Each sentence names the row ABOVE the figure it quotes. It is also '
    + 'GOVERNMENT-WIDE accrual, not the funds statement. A future reader should not use it as '
    + 'an oracle for this county.',
  'madison-2024': 'Revenue +20.3% (92,311,047 -> 111,030,864), spread rather than concentrated: '
    + 'Other > Miscellaneous +6,020,554, Intergovernmental +4,766,790, Taxes > Income '
    + '+4,385,678, Taxes > Property +1,666,886 and Investment earnings +1,367,747. '
    + '⚠ THE COUNTY ISSUED $77,283,558 OF BONDS IN THE SAME YEAR ("The County\'s total amount '
    + 'of bonds increased by $77,283,558 during the current fiscal year") and FY2024 opens a '
    + 'BUILDING CORPORATION CAPITAL PROJECTS FUND as a major fund. NONE of that borrowing is in '
    + 'this figure — it is an OTHER FINANCING SOURCE, below the printed `Total revenues` row. '
    + 'A revenue series that swept up everything above `Net change in fund balances` would show '
    + 'this county nearly doubling its revenue in one year. It did not.',

  'allen-2024': 'Revenue +24.2% (260,926,477 -> 324,150,411): Intergovernmental +34,375,899 and '
    + 'Taxes +24,504,788. Both are named by the county — the MD&A cites "the new Local Income '
    + 'Tax (LIT) correctional facility rate", and the statement shows the ARP Coronavirus Local '
    + 'Recovery Fund drawing 44,862,858 of intergovernmental revenue in its own major-fund '
    + 'column. ⚠ The $203,655,000 of bonds issued the same year is an OTHER FINANCING SOURCE and '
    + 'is correctly NOT in this figure — the LA TRAN defect, avoided by reading the printed '
    + '`Total revenues` row rather than everything above `Net change in fund balances`.',
});
