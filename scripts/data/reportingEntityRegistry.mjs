/**
 * SCOPE-02 source→reporting_entity registry.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * ⚠ THIS FILE USED TO SAY "EXPECTED IS NOT EVIDENCED" OF THREE FAMILIES — Ohio
 * AOS, CA SCO and VA APA — each expected to be primary_government but with "no
 * document and therefore no entry", because columbus.gov had returned HTTP 403
 * to a scripted ACFR fetch. ALL THREE WERE CLEARED ON 2026-11-02/03, and not
 * one of them needed new reasoning. They needed the document, and in every case
 * the document existed somewhere nobody had looked:
 *
 *   VA APA   the APA republishes localities' own ACFRs, so Virginia Beach's
 *            came from the same blob store as the Comparative Report itself.
 *   Ohio AOS columbus.gov simply ANSWERED this time. The 403 that stopped this
 *            entry was transient and was recorded as though it were permanent.
 *            (ohioauditor.gov, which also hosts it, is still down.)
 *   CA SCO   docs/Modesto/modesto-fy2024.pdf was IN THE REPO, on the path the
 *            fund-scope entry already cited. It was re-fetched from the Federal
 *            Audit Clearinghouse before anyone checked — wasted work, and the
 *            cheapest lesson here.
 *
 * ⭐⭐ SO: BEFORE RECORDING "NO DOCUMENT", (1) look in docs/, (2) retry the
 * host, (3) ask who else republishes it — a state auditor, the FAC, or the bond
 * market are all second homes for the same PDF. "No document" is a claim with a
 * date on it, like a partition count, and this file carried three stale ones.
 *
 * ⚠⚠ A FOURTH GAP WAS CLEARED ON 2026-11-03, AND IT WAS A DIFFERENT FAILURE
 * MODE ENTIRELY — worth knowing, because nothing in this repo can see it.
 * `mn-osa` LOOKED complete: every MN row carried a value, every gate was green,
 * and no file anywhere said "unevidenced". But MN cities and MN counties share
 * ONE `data_source` string, so one `match` regex stamped 1,380 county rows from
 * a CITY reconciliation. A missing entry is visible as `unknown`. An entry whose
 * evidence does not reach half the rows it stamps is visible as NOTHING.
 * ⭐ So: when one entry spans two populations the publisher serves in two
 * different files, evidence BOTH, and say in the entry that it cannot be split.
 * Counties are now evidenced to the dollar on both sides — see `mn-osa` below.
 *
 * ✅ EVERY FAMILY IN THIS REGISTRY IS NOW EVIDENCED. The last deliberate hole,
 * `ca-sco-county-rev`, closed on 2026-11-03 — and it closed the way its own
 * note asked for, by finding a county whose discretely presented unit is large
 * relative to the residue, NOT by arguing the Stanislaus residue down. The
 * ratio went from 1.36 (ambiguous) to 3,873 (decisive). See the entry at the
 * bottom of this file for the method, which is the reusable part: the county
 * was chosen from TT's OWN stored SCO trees, before anything was downloaded.
 *
 * ⚠ "Deliberately unknown" earned its keep here — it held for exactly as long
 * as the evidence was genuinely ambiguous, and it named the measurement that
 * would settle it. That is what made it closable by someone who had not been
 * in the original conversation. An honest `unknown` is a TODO with a spec, not
 * a shrug.
 *
 * Spec: docs/superpowers/specs/2026-08-17-scope-02-design.md §1
 */

import { REPORTING_ENTITY } from '../lib/budgetAxes.mjs';

/** @type {import('../lib/budgetAxes.mjs').AxisEntry[]} */
export const REPORTING_ENTITY_REGISTRY = [
  {
    id: 'hi-local-acfr-gf',
    // ⚠ Byte-identical to this id's pattern in fundScopeRegistry.mjs and
    // basisRegistry.mjs.
    match: /^(Honolulu|Hawaii County|Maui County|Kauai County) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'The Reporting Entity note (Note 1, variously headed "REPORTING ENTITY" or '
              + '"THE REPORTING ENTITY AND ITS SERVICES") of one filing per county: '
              + 'honolulu-2025, maui-2024, hawaii-2024 and kauai-2024. Read 2026-10-29 — the '
              + 'same read that confirmed the entity typing before seeding.',
      figures: 'Each note names the primary government and lists its component units '
             + 'separately. Honolulu: "The ACFR presents the financial status of the City (the '
             + 'primary government) and its discretely presented component units, the Board of '
             + 'Water Supply (BWS) and Oahu Transit Services, Inc. (OTS)", reported "in a '
             + 'single column in the government-wide financial statements to emphasize their '
             + 'legal separation from the primary government". Kaua\'i names its Board of Water '
             + 'Supply as a component unit — the same body that files its own Single Audit '
             + 'under EIN 472810526, which this family deliberately excludes. '
             + 'Under GASB 34 a discretely presented component unit appears only in the '
             + 'GOVERNMENT-WIDE statements, in its own column, so it cannot be inside the '
             + 'stored figure, which is the General Fund column of the FUND statements. '
             + 'The stored figure is therefore the primary government\'s own General Fund.',
    },
  },
  {
    // ⭐⭐ THE ONE `incl_component_units` ENTRY, AND IT COVERS TWO FILE FORMATS.
    //
    // ⚠⚠ THIS ENTRY CANNOT BE SPLIT CITY/COUNTY, and that is the trap it was
    // carrying. MN cities and MN counties share ONE `data_source` string —
    // 'Minnesota Office of the State Auditor City/County Finances Report' — so
    // a `match` regex cannot tell them apart. From 2026-08 until 2026-11-03
    // this entry stamped 1,380 county rows (87 counties, FY2013-2021) on the
    // strength of a CITY reconciliation and nothing else, because one regex
    // silently covered both. Same publisher, two workbooks, two different
    // layouts (the county file prints no `GovEntityID` at all) — and the city
    // evidence does not reach the county file. Both branches are evidenced
    // below; if you add a third branch, evidence it here too, because nothing
    // in the stamper will notice that you did not.
    //
    // ⭐ The two branches reach the same value by DIFFERENT mechanisms:
    //    cities   OSA consolidates HRA/EDA/TIF activity the city's own ACFR
    //             presents outside the primary government (+21.7% Bloomington).
    //    counties OSA adds the county's DISCRETELY PRESENTED GOVERNMENTAL
    //             component units, and leaves the business-type ones out.
    id: 'mn-osa',
    match: /^Minnesota Office of the State Auditor/,
    value: REPORTING_ENTITY.INCL_COMPONENT_UNITS,
    evidence: {
      document: 'CITIES: City of Bloomington MN FY2022 ACFR vs MN OSA cired_22_data.xlsx '
              + '(SCOPE-01-RECON §4.7). '
              + 'COUNTIES, added 2026-11-03: Dakota County MN FY2021 ACFR '
              + '(docs/DakotaCountyMN/dakota-county-mn-fy2021-acfr.pdf) and Hennepin County MN '
              + 'FY2021 ACFR (docs/HennepinCountyMN/hennepin-county-mn-fy2021-acfr.pdf), both '
              + 'read against docs/MN/county_21_data.xlsx — the county workbook, NOT the cired_* '
              + 'city workbook. Both ACFRs came from the Federal Audit Clearinghouse '
              + '(report ids 2021-12-CENSUS-0000150696 and 2021-12-CENSUS-0000150704), which '
              + 'serves them free and without a key.',
      figures: 'CITIES: OSA revenue $148,267,637 vs ACFR total governmental $121,826,437 '
             + '(+21.7%); the gap is HRA/EDA/TIF component units the ACFR presents separately. '
             + 'Systematic: 514 of 852 MN cities carry nonzero TIF/HRA/EDA; ~7% of statewide '
             + 'expenditures, ~17-22% for TIF-heavy cities. '
             + '⭐⭐ COUNTIES — THE INCLUSION IS OBSERVED ON BOTH SIDES AT EXACTLY $0, which is '
             + 'stronger than anything else on this axis. Dakota County FY2021 has TWO '
             + 'discretely presented component units, and the arithmetic puts one IN and the '
             + 'other OUT. Its governmental-funds statement (printed p.34-35) totals '
             + '396,557,509 revenue and 428,973,445 expenditure, excess (32,415,936). The '
             + 'Vermillion River Watershed District — a discretely presented unit whose own '
             + 'fund statement is printed at p.127 — totals 1,660,810 revenue and 1,557,495 '
             + 'expenditure, net change 103,315. Add them: '
             + '396,557,509 + 1,660,810 = 398,218,319, and 428,973,445 + 1,557,495 = '
             + '430,530,940. The stored figures are 398,218,319 and 430,530,940. Three ties at '
             + 'exactly $0 — revenue, expenditure, and the excess (32,415,936 + 103,315 = '
             + '32,312,621). '
             + '⚠ THE OTHER DISCRETE UNIT IS OUT, and it is out by exhaustion rather than by '
             + 'a ratio: the residue is EXACTLY the Watershed on both sides, so there is $0 '
             + 'left over for anything else. The Dakota County Community Development Agency, '
             + 'expenses 59,587,281 in the same Statement of Activities, is 38 times the whole '
             + 'expenditure residue it would have to hide inside. So OSA\'s '
             + 'county boundary is the primary government plus GOVERNMENTAL discrete units; '
             + 'business-type discrete units stay out. `incl_component_units` is right, but it '
             + 'is not unconditional, and a future county reconciliation should expect the '
             + 'business-type half to be missing. '
             + 'HENNEPIN IS THE CONTROL, and it is why the Dakota tie means what it says. '
             + 'Hennepin has NO discretely presented component unit at all — GASB 80 moved '
             + 'Hennepin Healthcare to a BLENDED proprietary fund in 2017, and the RRA and HRA '
             + 'are blended governmental funds — so with nothing to add, OSA should equal the '
             + 'county\'s own governmental funds outright, and it does: FY2020 revenue '
             + '1,897,570,230 against the ACFR\'s 1,897,570,230, exactly $0. '
             + '⚠ TWO RESIDUES ARE DECLARED, NOT EXPLAINED. Hennepin FY2020 expenditure is '
             + '2,229,604,721 stored against 2,229,604,361 printed — $360 on $2.23bn. Hennepin '
             + 'FY2021 does NOT tie: stored 1,851,255,583 / 1,834,835,822 against printed '
             + '1,852,541,519 / 1,833,705,402, i.e. OSA is 1,285,936 LOW on revenue and '
             + '1,130,420 HIGH on expenditure (±0.07%). The signs are OPPOSITE, so it is not an '
             + 'added entity; it looks like taxonomy or a pre-final submission, and it is '
             + 'recorded here unexplained rather than argued away. Neither residue is near the '
             + 'size of any component unit, so neither touches the claim above. '
             + '⚠⚠ The FY2020 Hennepin ACFR could NOT be used to settle the $360: its PDF text '
             + 'layer is CIPHERED (a custom font with no ToUnicode map), and both pdftotext 4.00 '
             + 'and poppler 25.07 return garbage for every page. The FY2021 ACFR carries FY2020 '
             + 'as a comparative column and reads clean, which is where the FY2020 figures above '
             + 'come from. See the WA SAO text-layer defects for why a ciphered page must never '
             + 'be read as though it were merely an empty one. '
             + 'PROVENANCE, verified for both counties and both years: the stored figures are '
             + 'the workbook\'s `Total Revenues` and `Total Expenditures` columns exactly. The '
             + 'loader correctly avoids `Total Revenues & Other Sources` and `Total Expenditures '
             + '& Other Uses`, which sit beside them and read 2,374,376,941 and 2,378,981,132 '
             + 'for Hennepin FY2020 — taking those would have overstated the county by 6.7%.',
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
    // ⚠ EXTENDED by Knight session 7b with City of Boulder and Boulder County.
    match: /^(City of Colorado Springs|El Paso County|City of Boulder|Boulder County) ACFR — General Fund /,
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
    // EXTENDED by the Knight campaign session 2, measured 2026-08-28:
    // + City of Charlotte 30 (FY2011-FY2025) + Mecklenburg County 42
    // (FY2005-FY2025) = 210. Same family on the merits — a General Fund column
    // read directly from each government's own audited ACFR — so the entry is
    // extended rather than duplicated.
    //
    // ⚠⚠ THE "Durham" COLLISION WARNING BELOW IS NO LONGER HYPOTHETICAL.
    // `Mecklenburg County` ALREADY EXISTS IN TT AS A VIRGINIA COUNTY, and so do
    // `Charlotte County, VA` and `Charlottesville, VA`. Checked 2026-08-28: all
    // three carry `data_source = 'Virginia APA Comparative Report'`, which this
    // anchored pattern cannot match, so nothing is mis-claimed today. But if a
    // Virginia ACFR load ever labels its rows `Mecklenburg County ACFR — General
    // Fund …` the string would be IDENTICAL to North Carolina's and this entry
    // would silently claim them. Split by municipality_id at that point; do not
    // widen the string.
    //
    // WARNING ANCHORED TO THE FOUR ENTITY NAMES, for the same reason
    // tx-local-acfr-gf and co-local-acfr-gf are: the general /ACFR - General
    // Fund/ pattern claims ~1,850 rows across families nobody has reconciled. A
    // future North Carolina ACFR load therefore lands `unknown` until it is
    // evidenced, which is the correct failure direction.
    //
    // Alaska — Anchorage (#298) and the six largest boroughs (#299). 139 rows,
    // measured 2026-10-28. ⚠ Added two PRs after the family loaded, with its
    // basis twin: the family went into fundScopeRegistry.mjs and into no
    // sibling registry, which is the "widened one registry of four" shape the
    // note on in-gateway-afr below describes for the fifth time.
    //
    // ⚠ ANCHORED TO THE SEVEN ENTITY NAMES and byte-identical to the patterns
    // of this id in fundScopeRegistry.mjs and basisRegistry.mjs, so the three
    // registries cannot disagree about who is in the family.
    id: 'ak-local-acfr-gf',
    // ⚠ EXTENDED 2026-10-28 with the six WAVE 1 boroughs, byte-identical to the
    // same id's pattern in fundScopeRegistry.mjs and basisRegistry.mjs.
    match: /^(Municipality of Anchorage|Matanuska-Susitna Borough|Fairbanks North Star Borough|Kenai Peninsula Borough|City and Borough of Juneau|Ketchikan Gateway Borough|Kodiak Island Borough|North Slope Borough|Northwest Arctic Borough|Petersburg Borough|City and Borough of Sitka|City and Borough of Wrangell|Aleutians East Borough|Bristol Bay Borough|Haines Borough|City and Borough of Yakutat|Lake and Peninsula Borough) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'The Reporting Entity note (Note 1.A, variously headed "REPORTING ENTITY" or '
              + '"Reporting Entity") of all seven FY2024 filings — docs/Anchorage/'
              + 'anchorage-2024-acfr.pdf and docs/AkBoroughs/{matsu,fnsb,kpb,juneau,kgb,kodiak}/'
              + '*-2024-acfr.pdf. Read 2026-10-28.',
      figures: 'The stored figure is the printed General Fund column of the FUND financial '
             + 'statements. Under GASB 34 a discretely presented component unit appears only in '
             + 'the government-wide statements, in its own column, so it cannot be inside that '
             + 'figure — and six of the seven say so in their own words. Matanuska-Susitna: "The '
             + 'School District is reported in a separate column of the government-wide '
             + 'financial statements to emphasize..."; Fairbanks North Star, of BOTH its units: '
             + '"The School District is reported in a separate column in the government-wide '
             + 'financial statements" and "The IGU is reported in a separate column in the '
             + 'government-wide financial statements"; Kodiak Island: "The discretely presented '
             + 'component unit is reported in a separate column in basic financial statements"; '
             + 'Juneau, of JSD: "It is reported in a separate column to emphasize that it is '
             + 'legally separate from CBJ"; Kenai Peninsula: "The School District, SPH and CPH '
             + 'are each discretely presented in a separate column in the basic [statements]". '
             + '⭐ THE BLENDED SIDE IS WHAT USUALLY NEEDS CHECKING, AND HERE IT BARELY EXISTS. '
             + 'A blended unit IS a fund of the primary government under GASB 34, so the '
             + 'question is always whether any of them is the General Fund. FOUR of the seven — '
             + 'Fairbanks North Star, Juneau, Ketchikan Gateway and Kodiak Island — report ZERO '
             + 'blended component units; every unit they have is discretely presented. Of the '
             + 'other three: Anchorage blends exactly one, CIVICVentures (the Dena\'ina and Egan '
             + 'convention centers), and its own note says "CIVICVentures is accounted for as a '
             + 'DEBT SERVICE FUND" — not the General Fund. Kenai Peninsula\'s single blended '
             + 'unit is blended into THE HOSPITAL, itself a discretely presented component unit, '
             + 'so it is two removes from the primary government\'s General Fund. '
             + 'Matanuska-Susitna reports none. '
             + '⭐ ARITHMETIC CORROBORATION, already measured for the fund-scope entry of this '
             + 'id and re-used here because it answers exactly this question: in every probe the '
             + 'printed fund columns sum EXACTLY to the printed Total Governmental Funds column '
             + '(Anchorage FY2024 803,259,435 + 38,362,806 + 1,879,859 + 127,780,750 = '
             + '971,282,850, and the same at FY2017 and FY2012). A component-unit column inside '
             + 'the General Fund figure would break that identity. '
             + '⚠⚠ ANCHORAGE LOOKS LIKE THE EXCEPTION AND IS NOT. Its General Fund carries '
             + 'Education at 263,714,389 in FY2024, about a third of the fund, which reads like '
             + 'a consolidated school district. It is the MUNICIPALITY\'S OWN APPROPRIATION to '
             + 'the Anchorage School District — what the Municipality spends — not ASD\'s '
             + 'revenues and expenditures, which are discretely presented in their own column. '
             + 'The same relationship holds at every borough here: each levies the taxes and '
             + 'appropriates to a school district it does not consolidate. '
             + '⚠ Contrast mn-osa, the one incl_component_units entry in this registry, where '
             + 'the OSA RE-AGGREGATES units the city ACFR presents separately (+21.7% on '
             + 'Bloomington FY2022). Nothing of that kind happens here: the figure is read FROM '
             + 'the government\'s own fund statement, by TT, with no intermediary. '
             + '── WAVE 1 (added 2026-10-28) — Note 1 Reporting Entity of all six FY2024 '
             + 'filings, docs/AkBoroughs/{northslope,nwarctic,petersburg,sitka,wrangell,'
             + 'aleutianseast}/*-2024-acfr.pdf, read 2026-10-28. '
             + '⭐ THE BLENDED SIDE IS EMPTY ON ALL SIX, and this time the documents were '
             + 'searched for the word rather than read for a summary: the string "blended" '
             + 'appears ZERO times in five of the six filings, and exactly ONCE in Sitka\'s — '
             + 'in the sentence "The City and Borough has no blended component units." Since a '
             + 'blended unit IS a fund of the primary government under GASB 34, an empty '
             + 'blended list closes the only route by which a component unit could be inside a '
             + 'General Fund column. '
             + 'Every component unit these six report is DISCRETELY PRESENTED, i.e. a separate '
             + 'column of the government-wide statements and therefore structurally outside the '
             + 'fund statement the stored figure comes from: North Slope — the North Slope '
             + 'Borough School District and Ilisagvik College, which its auditor states are '
             + '"100% of the aggregate discretely presented component units"; Petersburg — the '
             + 'Petersburg School District and Petersburg Medical Center; Sitka — the Sitka '
             + 'School District; Wrangell — Wrangell Public Schools, "the Borough\'s only '
             + 'discretely presented component unit"; Northwest Arctic — the Northwest Arctic '
             + 'Borough School District; Aleutians East — the Aleutians East Borough School '
             + 'District. '
             + '⭐ ARITHMETIC CORROBORATION, measured for the fund-scope entry of this id and '
             + 're-used because it answers this question too: on all six the printed FUND '
             + 'columns sum EXACTLY to the printed Total column on both sides (Aleutians East '
             + 'FY2024 revenue 8,477,244 + 4,447,626 + 1,098,921 + 2,530,976 + 172,642 + '
             + '190,259 = 16,917,668). A component-unit column folded into the General Fund '
             + 'figure would break that identity. '
             + '⚠ Several of these boroughs appropriate to their school district out of the '
             + 'General Fund — Petersburg prints "Education - contribution to school district" '
             + 'at 3,000,000 in FY2024 — and that is the BOROUGH\'S OWN SPENDING, not the '
             + 'district\'s revenues and expenditures, which sit in the district\'s own '
             + 'discretely presented column. Same relationship Anchorage\'s Education line has, '
             + 'described above. '
             + '── WAVE 2 (added 2026-10-29) — Note 1 of Bristol Bay FY2023, Haines FY2024, '
             + 'Yakutat FY2024 and Lake and Peninsula FY2023, read 2026-10-29. '
             + '⭐ THE BLENDED SIDE IS EMPTY ON ALL FOUR, and again the documents were searched '
             + 'for the word rather than read for a summary: "blended" appears ZERO times in '
             + 'every one of them. A blended unit IS a fund of the primary government under '
             + 'GASB 34, so an empty blended list closes the only route by which a component '
             + 'unit could sit inside a General Fund column. '
             + 'Every unit these four report is DISCRETELY PRESENTED: Bristol Bay — the Bristol '
             + 'Bay Borough School District; Yakutat — the Yakutat School District; Lake and '
             + 'Peninsula — the school district it is required to operate under Alaska Statute '
             + '29.43.030, "reported in a separate column in the basic financial statements to '
             + 'emphasize that it is legally separate from the government"; Haines — TWO units, '
             + 'the Haines Borough School District AND the Klehini Valley Volunteer Fire '
             + 'Department, both presented in its Component Units Combining Statement of Net '
             + 'Position. '
             + '⭐ ARITHMETIC CORROBORATION, measured for the fund-scope entry of this id: on '
             + 'all four the printed FUND columns sum EXACTLY to the printed Total column on '
             + 'both sides (Bristol Bay FY2023 revenue 17,885,914 + 33,087 + 42,828 + 1,873,395 '
             + '+ 52,374 = 19,887,598). A component-unit column folded into the General Fund '
             + 'figure would break that identity. '
             + '⚠ HAINES IS THE ONE TO RE-CHECK IF ITS SHAPE EVER CHANGES: a volunteer fire '
             + 'department is exactly the kind of small, service-providing unit an issuer could '
             + 'later decide to BLEND. Today it is discrete and named as such.',
    },
  },
  {
    // WARNING this matches the DATA_SOURCE STRING, and "Durham" is also a town
    // in CONNECTICUT and NEW HAMPSHIRE - TT already carries CT entities. The
    // string written here is "City of Durham", which neither town would use,
    // and no such rows exist today; were they loaded later under a colliding
    // label they would need splitting by municipality_id rather than by this
    // string.
    id: 'nc-local-acfr-gf',
    match: /^(City of Durham|Durham County|City of Asheville|Buncombe County|City of Charlotte|Mecklenburg County) ACFR — General Fund /,
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
    // Pennsylvania DCED form DCED-CLGS-30, both reports.
    id: 'pa-dced-clgs30',
    match: /^Pennsylvania DCED Municipal Annual Audit and Financial Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[5-9]|2[0-5]) actual, cash basis, (?:all funds|governmental funds), excl\. financing sources\)$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'Form DCED-CLGS-30 is filed BY the municipality or county for ITSELF. Neither '
              + 'statewide extract publishes a component-unit column, and neither carries a '
              + 'consolidated or blended total.',
      figures: '⚠ The county report separates Proprietary, Internal Service and Fiduciary funds '
             + 'into their own column blocks, none of which TT reads, so component activity is '
             + 'excluded by construction. The municipal report is all-funds for the FILING '
             + 'ENTITY: enterprise activity it runs itself (its own water, sewer, parking) is '
             + 'inside the total, which is the primary government operating a utility — not a '
             + 'discretely presented component unit. ⚠ Contrast mn-osa, which consolidates '
             + 'component units into the same columns and is therefore incl_component_units.',
    },
  },

  // ── ⚠ SOUTH CAROLINA RFA IS DELIBERATELY ABSENT FROM THIS REGISTRY ────────
  //
  // Not an oversight and not a pending gap. The statewide sweep registered
  // `sc-rfa-lgf` on basisRegistry, and the question was asked here too:
  //
  //   FOR `primary_government`: each county sheet partitions the four government
  //   types into separate blocks — School District only, County only, Cities
  //   only, and Special Purpose District only — so the block TT reads excludes
  //   South Carolina's special purpose districts by construction. That is the
  //   same SHAPE of evidence pa-dced-clgs30 relies on.
  //
  //   ⚠⚠ AND IT STILL DOES NOT ANSWER THIS AXIS. A South Carolina special
  //   purpose district is an INDEPENDENT political subdivision, which is not the
  //   same question as whether a county's OWN blended component units sit inside
  //   its County-only figures. The form never says, and no block boundary
  //   settles it. Asserting `primary_government` from the SPD split would be
  //   reasoning from adjacent evidence to a conclusion it does not reach.
  //
  // So these rows stay `unknown`, which is the honest value, on the same footing
  // as Georgia's. ⚠ An explicit `value: REPORTING_ENTITY.UNKNOWN` entry was
  // considered and is pointless: `classifyAxis()` returns `none` for an
  // unknown-valued entry, so it would claim nothing while LOOKING like coverage.
  // An entry is created when its evidence is, never before.

  {
    // Knight campaign, session 3 — Florida DFS LOGERx Annual Financial Reports.
    id: 'fl-dfs-afr',
    match: /^Florida DFS Annual Financial Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[2-9]|2[0-5]) actual, (?:audit-reconciled|DEW-reconciled|branch-unrecorded)\)$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'The source workbooks, cached under docs/fl-dfs/. As with fund_scope, the entity '
              + 'boundary here is a FACT read off a column header rather than an inference about '
              + 'a publisher\'s conventions: DFS publishes "Component Units" as its own twelfth '
              + 'fund column, alongside the five governmental, two proprietary and four fiduciary '
              + 'columns.',
      figures: 'TT sums the five GOVERNMENTAL columns only, so the discretely presented component '
             + 'units in that twelfth column are excluded by construction — there is no judgment '
             + 'call to get wrong. That the column is real and material is visible in the figures: '
             + 'at Miami-Dade County FY2023 the difference between summing with and without it is '
             + 'billions of dollars, and City of Miami FY2023 has a non-zero Component Units '
             + 'column that TT does not read. '
             + 'Blended component units are, by GASB 34, reported inside the primary government\'s '
             + 'own funds and are therefore inside these figures — the same treatment as wa-sao, '
             + 'state-acfr-gf, tx-local-acfr-gf and co-local-acfr-gf. '
             + '⚠ Unlike mn-osa, which is KNOWN to consolidate HRA/EDA/TIF units and is therefore '
             + 'incl_component_units, Florida keeps them in a separate column that TT never sums, '
             + 'so primary_government is the accurate label rather than the convenient one.',
    },
  },
  {
    // Indiana's counties via their own audited ACFRs, wave 1.
    //
    // ⚠⚠ THE ONLY FAMILY IN THIS REGISTRY WHOSE ENTITY BOUNDARY IS ITSELF THE
    // SUBJECT OF AN AUDIT MODIFICATION, which makes it the best-evidenced entry
    // here rather than the weakest: Allen County carries a QUALIFIED opinion in
    // all nine loaded years FOR OMITTING four fire protection districts from its
    // discretely presented component units, and Lake County an ADVERSE one for
    // omitting its component units entirely. The auditor is telling us, in the
    // document, exactly where the boundary is and that the county drew it wrong
    // — on a COLUMN THIS SCOPE DOES NOT REPORT.
    id: 'in-county-acfr-tg',
    match: /^(Marion County|Lake County|Allen County|Hamilton County|St\. Joseph County|Elkhart County|Tippecanoe County|Hendricks County|Vanderburgh County|Porter County|Johnson County|Monroe County|Madison County|Clark County|Delaware County|LaPorte County|Vigo County) ACFR — Total Governmental Funds (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[6-9]|2[0-5]) actual, GAAP basis\)$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'The governmental-funds Statement of Revenues, Expenditures and Changes in Fund '
              + 'Balances of each county ACFR, plus each auditor\'s own Summary of Opinions — '
              + 'read in all 31 loaded documents by scripts/verifyInCountyOpinions.py and '
              + 'recorded per entity-year in scripts/data/inCountyAcfrOpinions.mjs.',
      figures: 'Under GASB 34 a DISCRETELY PRESENTED component unit appears only in the '
             + 'GOVERNMENT-WIDE statements, in its own column, so it cannot be inside a '
             + 'governmental-FUNDS total; a BLENDED one is presented as a fund of the primary '
             + 'government and therefore is. Allen County FY2024 makes both halves visible on '
             + 'the very page read here: `Allen County, Indiana Building Corporation` is printed '
             + 'as a MAJOR FUND COLUMN (blended, inside), while the Summary of Opinions on the '
             + 'auditor\'s page lists `Aggregate Discretely Presented Component Units` as a '
             + 'SEPARATE OPINION UNIT and marks it QUALIFIED (discrete, outside). '
             + '⚠ NARROWER than mn-osa, which consolidates HRA/EDA/TIF component units that city '
             + 'ACFRs present separately; identical in kind to every other issuer-published ACFR '
             + 'family here.',
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
  {
    // Knight campaign, session 7b — Kansas's first local entities.
    id: 'ks-local-acfr-gf',
    match: /^(City of Wichita|Sedgwick County) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'City of Wichita FY2000-FY2025 and Sedgwick County FY2006-FY2024 ACFRs, '
              + 'governmental-funds Statement of Revenues, Expenditures and Changes in Fund '
              + 'Balances.',
      figures: 'The stored figure is the printed GENERAL FUND column of the PRIMARY government\'s '
             + 'governmental-funds statement. Discretely presented component units appear in '
             + 'their own columns elsewhere in each statement set and are never inside this '
             + 'column — Wichita\'s own auditor\'s report names "the discretely presented '
             + 'component unit" as a separate opinion unit. Blended units sit inside the primary '
             + 'government\'s own funds by GASB 34 and are therefore inside these figures, the '
             + 'same treatment as co-local-acfr-gf and oh-aos.',
    },
  },
  {
    // Knight campaign, session 7a — Michigan Treasury Form F-65.
    // ⚠ ONE entry covers BOTH fund scopes: general_fund reads column a and
    // total_governmental reads columns a + b, and component units are column d
    // in either case, so the entity boundary is identical for the two series.
    id: 'mi-treasury-f65',
    match: /^Michigan Treasury Form F-65 Annual Local Unit Fiscal Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[0-9]|2[0-5]) actual, (?:general fund|governmental funds), excl\. financing sources and uses\)$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'The source rows, fetched from https://data.michigan.gov and cached under '
              + '_acfr-work/mi/. As with fund_scope, the entity boundary is a FACT read off the '
              + 'publisher\'s own column labelling rather than an inference: the Form F-65 '
              + 'instructions enumerate "Discretely Presented Component Unit Funds--(column d)" '
              + 'as a column of its own, distinct from "General Fund--(column a)" and "All Other '
              + 'Governmental Funds--(column b)".',
      figures: 'TT reads columns a and b only, so discretely presented component units are '
             + 'excluded by construction — the same route as fl-dfs-afr, and there is no '
             + 'judgment call to record. Blended component units are inside the primary '
             + 'government\'s own funds by GASB 34 and are therefore inside these figures, as '
             + 'with oh-aos. '
             + 'CORROBORATED ARITHMETICALLY: on Detroit FY2024 the published `Total` (column e) '
             + 'exceeds governmental+component-unit by exactly the enterprise column on every '
             + 'line — e.g. All Other Federal Aid Grants, 112,631,465 + 56,516,497 = 169,147,962 '
             + '— which is how the column partition was verified rather than assumed. '
             + '⚠ This is the OPPOSITE of mn-osa, which consolidates HRA/EDA/TIF component units '
             + 'into the same columns and is incl_component_units for that reason.',
    },
  },
  {
    // ⚠⚠ ADDED 2026-09-11. Until then this family matched NOTHING here and every
    // one of its 106 loaded rows carried `reporting_entity = 'unknown'` — the
    // reader-facing consequence of widening one registry of four. See the
    // fundScopeRegistry entry of the same id for the full note.
    id: 'in-gateway-afr',
    match: /^Indiana Gateway Annual Financial Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[2-9]|2[0-5]) actual, unaudited, all funds excl\. settlement and payroll clearing\)$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'Gateway\'s own AFR extracts (`_acfr-work/in`), whose `ent_name` column is the '
              + 'publisher\'s own partition of a filing into the unit proper and its related '
              + 'entities. Corroborated against the SBOA\'s audited regulatory-basis report for '
              + 'the same entity-year (City of Gary FY2020, FAC report_id '
              + '2020-12-CENSUS-0000191896). Read 2026-09-11.',
      figures: 'The boundary is a FACT READ OFF THE PUBLISHER\'S OWN COLUMN, not an inference. '
             + 'TT reads only rows whose `ent_name` is `Governmental Activities` '
             + '(scripts/lib/inGateway.mjs, GOVERNMENTAL_ENT_NAME) — 290,665 of the 291,100 '
             + 'county receipt rows, the remainder being the unit\'s separately-reported '
             + 'LANDFILL, MEMORIAL COLISEUM, STORMWATER UTILITY, SOLID WASTE and similar '
             + 'entities. Component units therefore cannot be inside these figures: they are '
             + 'in sibling ent_name blocks this loader never reads. '
             + '⚠⚠ MEASURED, ON THE ONE ENTITY WHERE THE DIFFERENCE IS LARGE ENOUGH TO SEE. '
             + 'City of Gary\'s Gateway filing carries exactly three ent_names — '
             + '`Governmental Activities`, `GSD` (the Gary Sanitary District) and `STORM WATER '
             + 'MANAGEMENT DISTRICT`. The SBOA\'s AUDITED statement for FY2020 consolidates '
             + 'all three and totals $228,714,206 of receipts; TT loads $127,292,307. So the '
             + 'audited document uses a WIDER reporting entity than TT does, and TT\'s is the '
             + 'narrower one — which is the direction that makes primary_government safe to '
             + 'claim. '
             + '⚠ STATED PRECISELY: this value asserts that the figure does NOT consolidate '
             + 'component units, which is what the axis exists to distinguish and what the '
             + 'ent_name filter proves. It does not assert that the figure is the primary '
             + 'government EXACTLY — a blended component unit that Gateway happens to report '
             + 'inside `Governmental Activities` would be inside it, and one reported in its '
             + 'own ent_name block (as Gary\'s GSD is) is outside it. The alternative value, '
             + 'incl_component_units, is affirmatively false; `unknown` claims nobody looked. '
             + '⚠ This is the OPPOSITE of mn-osa on the same axis, and for a reason worth '
             + 'keeping: mn-osa is a STATE AUDITOR re-aggregating what a city presents '
             + 'separately, whereas Gateway is a collection system that preserves the unit\'s '
             + 'own filed partition unchanged.',
    },
  },
  {
    // ⭐ VIRGINIA APA COMPARATIVE REPORT — the third axis for this family, and
    // the last one it was missing. Added 2026-11-03. 608 rows, 161 entities.
    //
    // ⚠ THE HEADER OF THIS FILE LISTED VA APA UNDER "EXPECTED IS NOT EVIDENCED"
    // — "no document and therefore no entry". There is a document now: the
    // Virginia Beach FY2023 ACFR, which the APA itself hosts, read against the
    // APA's own FY2023 workbook for the same city and year.
    //
    // ⚠⚠ `incl_component_units` HERE MEANS "the figure demonstrably exceeds the
    // primary government by a consolidated component unit", NOT "the whole GASB
    // reporting entity". The APA consolidates the SCHOOL DIVISION and does not
    // consolidate authorities it does not manage — Note 2 (Exhibit F) reports
    // those only as "Payments to Enterprise Type Activities … organized and
    // operated as an authority and not managed by the locality". Virginia
    // Beach's CDC is a component unit of the City that this figure does not
    // carry. The value is still right: it is what the axis exists to flag, and
    // `primary_government` would be false by 48% on the total and 123% on
    // Education. This is the same reading mn-osa uses for HRA/EDA/TIF.
    id: 'va-apa-comparative-report',
    match: /^Virginia APA Comparative Report$/,
    value: REPORTING_ENTITY.INCL_COMPONENT_UNITS,
    evidence: {
      document: 'City of Virginia Beach FY2023 ACFR (406pp, hosted by the APA at '
              + 'dlasprodpublic.blob.core.windows.net/apa/015A9CB6-DE37-40C9-9A96-6B30618ACD57.pdf) '
              + 'read against the APA 2023 Comparative Report workbook for the same city and '
              + 'year (data.virginia.gov resource 102f7b9e-4e65-467f-b38c-75edd78dbbe9), plus '
              + 'the 2024 Notes to the Comparative Report. All fetched 2026-11-02/03.',
      figures: 'THE SCHOOL DIVISION IS A DISCRETELY PRESENTED COMPONENT UNIT AND THE APA '
             + 'CONSOLIDATES IT. The ACFR says so in terms (Note 1): the Schools are "a legally '
             + 'separate entity", component units are "reported in separate columns to emphasize '
             + 'that they are legally separate from the City". Under GASB 34 a discretely '
             + 'presented component unit therefore appears only in the GOVERNMENT-WIDE '
             + 'statements, never in the governmental-FUND statements. '
             + 'Virginia Beach FY2023, the three figures that settle it: '
             + 'APA Exhibit C-6 Education 1,017,649,747 · ACFR governmental funds Education '
             + '456,472,085 (p.76, General Fund; nonmajor nil) · ACFR government-wide Total '
             + 'Component Units expenses 995,286,575 (p.72). The APA figure is 2.23x the '
             + 'primary government\'s and sits in the component units\' range, so it is the '
             + 'School Board\'s own operations, not the City\'s appropriation to them. '
             + 'WHOLE-ENTITY CHECK: APA Exhibit C total M&O 1,962,644,100 vs ACFR governmental '
             + 'funds current operating 1,324,914,972 (total expenditures 1,733,646,370 less '
             + 'capital outlay 254,026,978, leases 4,133,722, subscriptions 5,400,148, principal '
             + '106,318,292 and interest 38,852,258 — the categories Exhibits D and E carry '
             + 'instead). Gap 637,729,128, i.e. the APA reports 48.1% MORE operating than the '
             + 'city\'s own funds do, and the Education gap of 561,177,662 is 88% of it. '
             + '⚠ The remaining ~76.5M is NOT attributed. State "expenditures made on behalf of '
             + 'the local government" (Note 1.B, inside Exhibits C-4/C-5/C-6) are only 7,063,221 '
             + 'for this city, so they do not explain it; the rest is presumed chart-of-accounts '
             + 'and measurement-basis difference and was not chased. Said rather than rounded '
             + 'away: 88% attributed is the claim, not 100%. '
             + 'SYSTEMATIC, NOT ONE CITY — measured over all 304 loaded operating rows: 245 '
             + 'carry a top-level Education node (64 city-years, 177 county-years, 4 town-years) '
             + 'averaging 44.3% of a city\'s total, 55.5% of a county\'s, up to 70.9%. The 59 '
             + 'rows with NO Education node are ALL towns, which is correct rather than a gap: '
             + 'Virginia towns are served by their county\'s school division except for the '
             + 'handful that run their own, which are exactly the 4 town-years that do carry it.',
    },
  },
  {
    // ⭐ OHIO AOS — 6,616 rows / 341 entities / FY2016-FY2025. Added 2026-11-03,
    // retiring the second of this file's three "no document" entries.
    //
    // ⚠ THE STORED FIGURE IS A FUND STATEMENT, WHICH IS THE WHOLE ARGUMENT.
    // loadOhioAOS.js reads `SOREACIFB_TotalGov` (GAAP) / `SORDACIFB_TotalGov`
    // (CASH/MOD) — the Statement of Revenues, Expenditures and Changes in Fund
    // Balances, governmental funds, Total column. Under GASB 34 a DISCRETELY
    // PRESENTED component unit appears only in the GOVERNMENT-WIDE statements,
    // in its own column, so it cannot be inside a fund-statement figure. This
    // is the same reasoning hi-local-acfr-gf rests on.
    // ⭐ The AOS workbook ALSO carries `SOA_Gov`, the government-wide Statement
    // of Activities, as a separate tab with different (accrual) figures — and
    // the loader does not read it. The publisher distinguishes the two
    // presentations and TT took the fund one; that is a structural fact about
    // the source, not an inference.
    // ⚠ Blended component units ARE inside this figure, as they are inside any
    // primary-government fund statement — Columbus blends the RiverSouth
    // Authority, Columbus Next Generation Corporation, the Recreation and Parks
    // Foundation and the Board of Health. That is what primary_government
    // means here, the same caveat in-gateway-afr records.
    id: 'oh-aos',
    // ⚠ Byte-identical to this id's pattern in fundScopeRegistry.mjs.
    match: /^Ohio Auditor of State/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'City of Columbus FY2025 ACFR (372pp, columbus.gov/files/sharedassets/city/v/1/'
              + 'city-auditor/acfr/2025-city-of-columbus-acfr-final.pdf) read against the AOS '
              + 'City_2025_GAAP_Summarized.XLSX and City_2024_GAAP_Summarized.XLSX workbooks in '
              + '_oh-recon/. Fetched 2026-11-03. ⚠ ohioauditor.gov, which hosts the same ACFR, '
              + 'was still unreachable from the October 2026 outage; columbus.gov served it, '
              + 'having previously returned 403 to the fetch that made this entry impossible.',
      figures: 'THE AOS TAB IS THE CITY\'S OWN AUDITED FUND STATEMENT, TO THE DOLLAR, IN BOTH '
             + 'YEARS CHECKED. Columbus files in thousands. FY2025 — AOS total revenues '
             + '2,281,078,000 and total expenditures 2,548,162,000; ACFR governmental funds '
             + '2,281,078 and 2,548,162. FY2024 — AOS 2,166,549,000 and 2,477,440,000; the '
             + 'ACFR\'s ten-year statistical table carries 2,166,549 and 2,477,440 for the same '
             + 'year. Four figures, four exact matches, no residue. '
             + '⚠ COLUMBUS HAS NO DISCRETELY PRESENTED COMPONENT UNITS — its reporting-entity '
             + 'note lists only BLENDED ones (RiverSouth Authority, Columbus Next Generation '
             + 'Corporation, Columbus Recreation and Parks Foundation, Columbus Board of '
             + 'Health), plus related organizations and joint ventures which it states are not '
             + 'part of the reporting entity. So this city PROVES the figure is the audited '
             + 'fund statement; it cannot by itself prove a discretely presented unit would be '
             + 'excluded, and that half rests on the GASB 34 construction above. The entry '
             + 'ca-sco-county-exp below is where the exclusion is actually OBSERVED.',
    },
  },
  {
    // ⭐ CA SCO — CITIES. Two entries, one per report half, because the fund-scope
    // registry evidenced them separately and each has its own dollar tie.
    // Added 2026-11-03, retiring the last of the "no document" three.
    //
    // ⚠ THE DOCUMENT WAS IN THE REPO ALL ALONG — docs/Modesto/modesto-fy2024.pdf,
    // the path the fund-scope entry already cited. It was fetched again from the
    // Federal Audit Clearinghouse before anyone looked, which was waste: FAC is
    // the right fallback when a city site is down (www.modesto.gov is), but
    // `docs/` is the first place to check, not the last.
    id: 'ca-sco-city-exp',
    match: /^CA State Controller - Expenditures$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'City of Modesto FY2024 ACFR (docs/Modesto/modesto-fy2024.pdf), reporting-entity '
              + 'note read 2026-11-03; the arithmetic is the CA-CITIES-01 reconciliation already '
              + 'recorded against this id in fundScopeRegistry.mjs.',
      figures: 'THE SCO TOTAL IS A SUM OF PRIMARY-GOVERNMENT FUND STATEMENTS, TO THE DOLLAR. '
             + 'ACFR Total Governmental 291,641,122 + SCO enterprise & ISF 296,400,946 = '
             + '588,042,068, equal to SCO\'s reported 588,042,068. Governmental funds, '
             + 'enterprise funds and internal service funds are ALL primary government; a '
             + 'discretely presented component unit is in none of them. '
             + '⚠ MODESTO HAS NO DISCRETELY PRESENTED COMPONENT UNITS. Its note: the component '
             + 'units "are blended into the City\'s funds" — the Modesto Public Financing '
             + 'Authority and thirteen Community Facilities Districts, "reported on a blended '
             + 'basis as part of the primary government". The Redevelopment Successor Agency is '
             + 'a private-purpose TRUST fund, i.e. fiduciary and outside the tie entirely, and '
             + 'the joint ventures are stated not to be part of the reporting entity. So the '
             + 'exclusion of a discretely presented unit is structural here (GASB 34), not '
             + 'observed — see ca-sco-county-exp, where it is observed.',
    },
  },
  {
    id: 'ca-sco-city-rev',
    match: /^CA State Controller - Revenues$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'City of Modesto FY2024 ACFR (docs/Modesto/modesto-fy2024.pdf), same '
              + 'reporting-entity note as ca-sco-city-exp; the arithmetic is this id\'s own '
              + 'revenue reconciliation in fundScopeRegistry.mjs.',
      figures: 'ACFR Total Governmental revenue 322,089,879 + SCO enterprise & ISF revenue '
             + '321,804,947 = 643,894,826, equal to SCO\'s reported 643,894,826 — its own dollar '
             + 'tie, not a read-across from the expenditure half. Same reporting entity, so the '
             + 'same conclusion and the same caveat: Modesto has only BLENDED component units, '
             + 'so exclusion of a discretely presented one is structural rather than observed.',
    },
  },
  {
    // ⭐⭐ CA SCO — COUNTIES, EXPENDITURES. The strongest of the four, because
    // Stanislaus HAS a discretely presented component unit and the arithmetic
    // shows it is OUT. This is the entry the three above lean on.
    id: 'ca-sco-county-exp',
    match: /^CA State Controller - County Expenditures$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'County of Stanislaus FY2024 ACFR '
              + '(docs/StanislausCounty/stanislaus-county-fy2024.pdf), reporting-entity note and '
              + 'government-wide Statement of Activities read 2026-11-03; the arithmetic is the '
              + 'reconciliation already recorded against this id in fundScopeRegistry.mjs.',
      figures: 'THE EXCLUSION IS OBSERVED, NOT ARGUED. Stanislaus is the one reconciled entity '
             + 'in this group that HAS a discretely presented component unit: First 5 '
             + 'Stanislaus, which the ACFR says "is presented separately from the primary '
             + 'government statements" and whose government-wide expenses are 11,672,965. '
             + 'The SCO tie is ACFR Total Governmental 1,194,047,359 + SCO enterprise & ISF '
             + '207,325,063 = 1,401,372,422 against SCO\'s reported 1,401,372,428 — a $6 '
             + 'residue on $1.4bn. First 5 is 11,672,965, nearly two million times that residue '
             + 'and 0.83% of the total, so it is arithmetically impossible for it to be inside '
             + 'the SCO figure. A structural argument would have given the same answer; this '
             + 'measures it. '
             + '⚠ The county\'s FOUR BLENDED units ARE inside, as primary_government means they '
             + 'should be: the Capital Improvements Financing Authority and the Tobacco Funding '
             + 'Corporation (both debt service funds), 29 Lighting Districts and the IHSS Public '
             + 'Authority (both special revenue funds). '
             + '⭐ SECOND COUNTY, added 2026-11-03 with ca-sco-county-rev: COUNTY OF ALAMEDA '
             + 'FY2024 (docs/AlamedaCounty/alameda-county-fy2024-acfr.pdf, thousands). '
             + '4,244,700,272 - Internal Service Fund 401,869,333 = 3,842,830,939 against the '
             + 'ACFR\'s printed Total Governmental Funds total expenditures of 3,842,829,000 — a '
             + 'residue of 1,939, 0.00005%. Alameda\'s discretely presented Alameda Health System '
             + 'has expenses of 1,458,231,000, i.e. 34.4% of the SCO total and 752,053 times the '
             + 'residue. Stanislaus had the better residue ($6); ALAMEDA HAS THE BETTER RATIO, '
             + 'because its excluded unit is 125 times larger. Keep BOTH: Stanislaus is the only '
             + 'one of the two that exercises SCO\'s enterprise-fund categories, since Alameda '
             + 'has no enterprise funds at all.',
    },
  },
  {
    // ⭐⭐ `ca-sco-county-rev` WAS DELIBERATELY ABSENT UNTIL 2026-11-03, and it was
    // closed the way its own note asked for — not by arguing the residue down.
    //
    // The note said: leave this `unknown` until a county whose discretely
    // presented unit is LARGE relative to the revenue residue is reconciled.
    // Stanislaus could not do it. Its residue was 7,807,552 and First 5
    // Stanislaus's program revenues were 10,623,616 — a ratio of 1.36, which
    // cannot separate "excluded, and the residue is reclassification" from
    // "part of it is inside". ALAMEDA'S RATIO IS 3,873.
    //
    // ⭐ HOW THE COUNTY WAS CHOSEN, because the method is the reusable part:
    // not by reading ACFRs looking for a big component unit, but by reading
    // TT's OWN stored SCO trees first. Every comparable county reports a
    // Hospital Enterprise Fund at depth 0 — Santa Clara 2,861,453,933,
    // Riverside 986,561,418, Contra Costa 784,157,834, Ventura 624,422,293,
    // San Joaquin 493,808,487, Monterey 435,181,412, San Mateo 378,241,086.
    // Alameda, a county of 1.6 million people with three public hospitals,
    // reports NONE: its only depth-0 non-governmental root is an Internal
    // Service Fund. That absence IS the signature of a hospital held as a
    // discretely presented authority rather than an enterprise fund, and it
    // was visible in a single SQL query over `treasury.budget_categories`
    // before anything was downloaded.
    id: 'ca-sco-county-rev',
    match: /^CA State Controller - County Revenues$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'County of Alameda FY2024 ACFR '
              + '(docs/AlamedaCounty/alameda-county-fy2024-acfr.pdf), Statement of Activities '
              + 'p.20 and the governmental-funds Statement of Revenues, Expenditures and Changes '
              + 'in Fund Balances p.23, read 2026-11-03 from the Federal Audit Clearinghouse '
              + '(report id 2024-06-GSAFAC-0000355975). ⚠ THE DOCUMENT IS EXPRESSED IN '
              + 'THOUSANDS and every figure below is scaled from it; the statements say so in '
              + 'their own headers.',
      figures: 'ALAMEDA HEALTH SYSTEM IS 3,873 TIMES THE RESIDUE. AHS is Alameda\'s ONLY '
             + 'discretely presented component unit — Note 1 says it "is reported in a separate '
             + 'column in the government-wide financial statements to emphasize that it is '
             + 'legally separate from the County" — and the Statement of Activities gives it in '
             + 'full: expenses 1,458,231,000, program revenues 1,314,570,000 (charges '
             + '1,314,391 + operating grants 15 + capital grants 164, in thousands) and general '
             + 'revenues 153,043,000, so TOTAL AHS REVENUES ARE 1,467,613,000. That figure '
             + 'self-checks against the statement\'s own bottom line: 1,467,613 - 1,458,231 = '
             + '9,382, the printed change in net position. '
             + 'THE TIE: SCO reports 4,742,901,769; its only non-governmental depth-0 root is '
             + 'an Internal Service Fund of 359,302,737; 4,742,901,769 - 359,302,737 = '
             + '4,383,599,032 implied governmental, against the ACFR\'s printed Total '
             + 'Governmental Funds total revenues of 4,383,978,000. Residue 378,968, which is '
             + '0.0086% of the figure. AHS at 1,467,613,000 is 30.9% of the SCO total and 3,873 '
             + 'times that residue, so it is arithmetically impossible for it to be inside. '
             + '⭐ THE EXPENDITURE SIDE OF THE SAME COUNTY IS ALL BUT A DOLLAR TIE and was free '
             + 'to compute: 4,244,700,272 - 401,869,333 = 3,842,830,939 against the ACFR\'s '
             + 'printed 3,842,829,000 — a residue of 1,939, or 0.00005%. Two sides, one county, '
             + 'one document. '
             + 'STRUCTURAL CORROBORATION, independent of the arithmetic: Alameda\'s Statement of '
             + 'Activities has NO business-type activities column at all — total primary '
             + 'government equals total governmental activities, both 3,822,552 (thousands) — so '
             + 'the county genuinely has no enterprise funds, which is exactly why SCO reports '
             + 'only an Internal Service Fund for it. Two publishers, same structure. AHS also '
             + 'files its OWN single audit with the FAC as "Alameda Health System, A Public '
             + 'Hospital Authority", so it is a separate auditee, not a fund. '
             + '⚠⚠ WHAT ALAMEDA DOES NOT PROVE, and why Stanislaus stays in ca-sco-county-exp: '
             + 'having no enterprise funds is what makes this arithmetic so clean, and it also '
             + 'means Alameda NEVER EXERCISES the enterprise-fund half of SCO\'s taxonomy. '
             + 'Stanislaus does (Hospital 40,685,163, Solid Waste 18,055,105, Other 6,267,838). '
             + 'The two counties together cover the taxonomy; Alameda alone would not, and a '
             + 'future reader should not retire the Stanislaus evidence as superseded.',
    },
  },
  {
    // ⚠ Anchored and enumerated — see the note in fundScopeRegistry.mjs.
    id: 'nv-local-acfr-gf',
    match: /^(?:Reno ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY202[1-5] actual, GAAP basis\)|Washoe County ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY(?:2019|2020|202[2-5]) actual, GAAP basis\))$/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'The General Fund column of the governmental-funds statement is the primary '
        + 'government’s own fund. Component units are reported discretely in both issuers '
        + '— Reno’s notes name the Redevelopment Agency and the Housing Authority of '
        + 'the City of Reno as included units, and neither sits in the General Fund column read '
        + 'here.',
      figures: 'The column read is headed `General Fund` and is the first money column; the '
        + 'discretely presented component units appear in the government-wide statements, not in '
        + 'the fund statement this extracts.',
    },
  },
];
