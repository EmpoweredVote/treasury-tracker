/**
 * SCOPE-02 source→reporting_entity registry.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * ⚠ EXPECTED IS NOT EVIDENCED. Ohio AOS is expected to be primary_government —
 * each tab restates the entity's own governmental-funds statement rather than
 * re-aggregating from a state chart of accounts the way MN OSA does — but
 * columbus.gov returned HTTP 403 to a scripted ACFR fetch, so there is no
 * document and therefore no entry. Same for CA SCO and VA APA.
 *
 * Spec: docs/superpowers/specs/2026-08-17-scope-02-design.md §1
 */

import { REPORTING_ENTITY } from '../lib/budgetAxes.mjs';

/** @type {import('../lib/budgetAxes.mjs').AxisEntry[]} */
export const REPORTING_ENTITY_REGISTRY = [
  {
    id: 'mn-osa',
    match: /^Minnesota Office of the State Auditor/,
    value: REPORTING_ENTITY.INCL_COMPONENT_UNITS,
    evidence: {
      document: 'City of Bloomington MN FY2022 ACFR vs MN OSA cired_22_data.xlsx (SCOPE-01-RECON §4.7)',
      figures: 'OSA revenue $148,267,637 vs ACFR total governmental $121,826,437 (+21.7%); the gap is HRA/EDA/TIF component units the ACFR presents separately. Systematic: 514 of 852 MN cities carry nonzero TIF/HRA/EDA; ~7% of statewide expenditures, ~17-22% for TIF-heavy cities.',
    },
  },
  {
    id: 'state-acfr-gf',
    match: / State ACFR — General Fund/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'State ACFRs; Utah FY2024 p.43, Connecticut FY2024 p.36 (SCOPE-01-RECON §4.5)',
      figures: 'The figure read is the printed General Fund column of the primary government\'s governmental-funds statement; component units are presented discretely elsewhere in the same document.',
    },
  },
  // ── The sixteen entity-published city/state ACFR families ─────────────────
  // 260 rows. Evidence: ACFR-GF-CLASSIFICATION-RECON.md §3.
  //
  // Shared argument, the same one the three entries below rest on: the stored
  // figure is a column of the FUND financial statements, and under GASB 34
  // discretely presented component units appear only in the government-wide
  // statements, in their own separate column — never in a governmental-funds
  // column. Every statement read across the 54 probes is titled "Governmental
  // Funds", so none of these figures can contain a discrete component unit.
  //
  // ⚠ This is a STANDARDS-level property of the statement, not 16 separate
  // readings of 16 Note 1 sections — stated plainly in RECON §4 so a future
  // reader can raise the bar. Spot-verified in detail for Austin and Travis,
  // where each blended unit's own "Reporting Fund" designation put it in a
  // proprietary or nonmajor special revenue fund, never the General Fund.
  //
  // Note the contrast that makes this axis meaningful: `mn-osa` is
  // incl_component_units because the Minnesota STATE AUDITOR re-aggregates
  // HRA/EDA/TIF activity a city's ACFR presents separately (+21.7% on
  // Bloomington FY2022). The `State of Minnesota` rows claimed below are a
  // different thing entirely — the state's own ACFR, read from its own fund
  // statement — and are primary_government.
  {
    id: 'or-city-acfr-gf',
    match: /^City of (Bend|Sherwood|Beaverton|Hillsboro|Tualatin|Cornelius|Tigard) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'Seven Oregon cities\' own ACFR governmental-funds statements '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §3)',
      figures: 'The stored figure is the printed General Fund column of the "Governmental Funds" '
             + 'statement in each city\'s own ACFR, verified exactly across 15 entity-years. Under '
             + 'GASB 34 that column cannot contain a discretely presented component unit.',
    },
  },
  {
    id: 'az-muni-acfr-gf',
    match: /^(City of Tucson|Marana|Oro Valley|Sahuarita|South Tucson) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'Five Arizona municipalities\' own ACFR governmental-funds statements '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §3)',
      figures: 'The stored figure is the printed General Fund column of the "Governmental Funds" '
             + 'statement, verified exactly across 10 entity-years. Discrete component units appear '
             + 'only in these documents\' government-wide statements.',
    },
  },
  {
    id: 'seattle-city-acfr-gf',
    match: /^City of Seattle ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'City of Seattle ACFRs FY2024, FY2025 (ACFR-GF-CLASSIFICATION-RECON.md §1.2, §3)',
      figures: 'The stored $2,407,090,000 / $2,300,612,000 is the printed General Fund column of '
             + 'the FY2025 governmental-funds statement (62.9% / 62.2% of total governmental).',
    },
  },
  {
    id: 'state-acfr-gf-by-name',
    match: /^State of (Minnesota|Ohio|Virginia) ACFR — General Fund/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'Minnesota, Ohio and Virginia state ACFRs '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §3)',
      figures: 'The figure read is the printed General Fund column of each state primary '
             + 'government\'s governmental-funds statement — Minnesota\'s columns are literally '
             + 'headed GENERAL | FEDERAL | NONMAJOR | TOTAL. Component units are presented '
             + 'discretely elsewhere in the same documents. Same conclusion, and the same reasoning, '
             + 'as the existing state-acfr-gf entry.',
    },
  },
  {
    // AUSTIN-TRAVIS-01. 76 rows, measured 2026-08-19. Anchored to the two entity
    // names — see the fund-scope entry of the same id.
    id: 'tx-local-acfr-gf',
    match: /^(City of Austin|Travis County) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'Note 1 (Reporting Entity) and the Overview of the Financial Statements in the '
              + 'City of Austin FY2024 and Travis County FY2024 ACFRs '
              + '(AUSTIN-TRAVIS-01-SCOPE-RECON.md §3)',
      figures: 'The stored figure is the printed General Fund column of the FUND financial '
             + 'statements. Under GASB 34 discretely presented component units appear only in the '
             + 'government-wide statements, in their own separate column, so they cannot be in it. '
             + 'Austin states this outright for its NINE discrete units (ABLE, ACE, Austin Transit '
             + 'Partnership, Sobriety Center, Rally Austin, three housing LPs, Waller Creek LGC): '
             + '"data from these units are shown separately from data of the City". Corroboration '
             + 'on the BLENDED units, which are inside the primary government\'s funds by GASB 34 '
             + 'exactly as they are for wa-sao and state-acfr-gf: Austin\'s Note 1 names a '
             + '"Reporting Fund" per blended unit and none of the named ones is the General Fund — '
             + 'Austin Energy (major PROPRIETARY fund), Austin Housing Finance Corporation '
             + '(nonmajor SPECIAL REVENUE fund), Urban Renewal Agency (nonmajor SPECIAL REVENUE '
             + 'fund). Travis\'s blended units are eight governmental entities plus TCHFC, reported '
             + 'in BUSINESS-TYPE activities via an enterprise fund; its General Fund is one of six '
             + 'major governmental funds. Contrast mn-osa, which is incl_component_units because '
             + 'the OSA re-aggregates HRA/EDA/TIF the city ACFR presents separately (+21.7% on '
             + 'Bloomington FY2022) — nothing of that kind happens here, the figure is read FROM '
             + 'the ACFR\'s own fund statement.',
    },
  },
  {
    // CO-SPRINGS-EPC-01. 64 rows, measured 2026-08-21. Anchored to the two
    // entity names - see the fund-scope entry of the same id.
    id: 'co-local-acfr-gf',
    match: /^(City of Colorado Springs|El Paso County) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'Note I.A (Reporting Entity) of the City of Colorado Springs FY2024 ACFR and '
              + 'Note A.1 (Reporting entity) of the El Paso County FY2024 ACFR '
              + '(CO-SPRINGS-EPC-01-CLOSEOUT.md section 6)',
      figures: 'The stored figure is the printed General Fund column of the FUND financial '
             + 'statements. Under GASB 34 discretely presented component units appear only in the '
             + 'government-wide statements, in their own separate column, so they cannot be in it '
             + '- El Paso states exactly that: "Each discretely presented component unit ... is '
             + 'reported in a single column in the government-wide financial statements" (its one '
             + 'discrete unit is El Paso County Public Health). Colorado Springs states the '
             + 'counterpart: "Discretely presented component units are legally separate entities '
             + 'for which the financial data are presented separately from the financial data of '
             + 'the City", and it presents them in their own combining exhibits (GOVERNMENTAL and '
             + 'PROPRIETARY FUND COMPONENT UNITS COMBINING statements). '
             + 'Corroboration on the BLENDED units, which are inside the primary government by '
             + 'GASB 34 exactly as for wa-sao, state-acfr-gf and tx-local-acfr-gf - in both cases '
             + 'none of them is the General Fund. Colorado Springs blends exactly two: the General '
             + 'Improvement Districts (special districts, reported in special revenue and debt '
             + 'service funds) and the Public Authority for Colorado Energy (a gas-supply '
             + 'financing authority, proprietary); "All other component units are discretely '
             + 'presented". El Paso blends exactly two: the El Paso County Retirement Plan, a '
             + 'cost-sharing defined benefit plan and therefore FIDUCIARY - excluded from the '
             + 'governmental-funds statement altogether - and the El Paso County Facilities '
             + 'Corporation, a lease-financing nonprofit whose activity is debt service and '
             + 'capital acquisition. Arithmetic corroboration: in all five probes the printed fund '
             + 'columns sum EXACTLY to the Total Governmental Funds column, so no component-unit '
             + 'column is inside the General Fund figure. Contrast mn-osa, which is '
             + 'incl_component_units because the OSA re-aggregates units the city ACFR presents '
             + 'separately; nothing of that kind happens here - the figure is read FROM the '
             + 'ACFR own fund statement.',
    },
  },
  {
    // NC-DURHAM-AVL-01, measured 2026-08-24: City of Durham 32 + Durham County 42
    // + City of Asheville 28 + Buncombe County 36 = 138. A NEW family, so no
    // pre-existing count moved. (Asheville was 10 rows at first load; nine
    // DELINKED-but-not-deleted years were later recovered from Wayback
    // snapshots of the city's own page, and Buncombe was 32 until FY2009/FY2010
    // were found under a fourth naming convention on its own live host.)
    //
    // WARNING ANCHORED TO THE FOUR ENTITY NAMES, for the same reason
    // tx-local-acfr-gf and co-local-acfr-gf are: the general /ACFR - General
    // Fund/ pattern claims ~1,850 rows across families nobody has reconciled. A
    // future North Carolina ACFR load therefore lands `unknown` until it is
    // evidenced, which is the correct failure direction.
    //
    // WARNING this matches the DATA_SOURCE STRING, and "Durham" is also a town
    // in CONNECTICUT and NEW HAMPSHIRE - TT already carries CT entities. The
    // string written here is "City of Durham", which neither town would use,
    // and no such rows exist today; were they loaded later under a colliding
    // label they would need splitting by municipality_id rather than by this
    // string.
    id: 'nc-local-acfr-gf',
    match: /^(City of Durham|Durham County|City of Asheville|Buncombe County) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'The Reporting Entity / Summary of Significant Accounting Policies notes of the '
              + 'FY2024 ACFRs of all four entities.',
      figures: 'The stored figure is the printed General Fund column of the FUND financial '
             + 'statements. Under GASB 34 discretely presented component units appear only in the '
             + 'government-wide statements, in their own separate column, so they cannot be in it '
             + '- and each issuer states exactly that. '
             + 'DURHAM COUNTY: "The Durham County Board of Alcoholic Beverage Control (ABC Board) '
             + 'is a discretely presented component unit"; "The discretely presented component '
             + 'unit below is reported in a separate column in the County government-wide '
             + 'financial statements to emphasize that it is legally separate from the County." '
             + 'CITY OF ASHEVILLE: the ABC Board is likewise discrete - "The City discretely '
             + 'presented component unit is reported in a separate column ... in order to '
             + 'emphasize that it is legally separate from the City", and the auditor records it '
             + 'as "100% of the assets, net position and revenues of the City discretely '
             + 'presented component unit". '
             + 'BUNCOMBE COUNTY: "The discretely presented component units listed below are '
             + 'reported in separate columns in the financial statements of the County." '
             + 'CITY OF DURHAM is the cleanest case of all: "Based on these criteria the City does '
             + 'not have any discretely presented component units." '
             + 'Corroboration on the BLENDED units, which are inside the primary government by '
             + 'GASB 34 exactly as for wa-sao, state-acfr-gf, tx-local-acfr-gf and '
             + 'co-local-acfr-gf - in every case none of them IS the General Fund. City of Durham '
             + 'blends the New Durham Corporation, "reported as a blended component unit because '
             + 'its purpose is to finance City revitalization projects and purchases of capital '
             + 'equipment", and the city lists it among its GOVERNMENTAL ACTIVITIES rather than in '
             + 'the General Fund. Buncombe County blends the Buncombe County Service Foundation, '
             + 'and the county states where it lands: it is listed among the NON-MAJOR legally '
             + 'budgeted special revenue funds as "the Buncombe County Service Foundation blended '
             + 'component unit presented as a fund" - a nonmajor special revenue fund, not the '
             + 'General Fund column.',
    },
  },
  {
    id: 'wa-sao',
    match: /^WA State Auditor — /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'WA SAO filings; Spokane FY2019, Tacoma FY2019 (SCOPE-01-RECON §4.6)',
      figures: 'The stored figure equals the printed General Fund column of the primary government\'s governmental-funds statement, tied exactly on both sides in two different units.',
    },
  },
];
