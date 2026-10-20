/**
 * ⭐⭐ WHY VINTAGE 2024 CANNOT NAME THESE SEVEN: THEY WERE DISSOLVED.
 *
 * ⚠⚠ THIS CORRECTS A CLAIM THIS REGISTER PREVIOUSLY MADE. #274 recorded that
 * "the census and DCA disagree about whether Ranger and Sunny Side exist",
 * because Census Vintage 2024 drops them while DCA shows them filing into
 * FY2022 and FY2023. There is NO disagreement. Both were dissolved by the
 * Georgia General Assembly in 2023, and each government's LAST FILING IS ITS
 * LAST FISCAL YEAR BEFORE DISSOLUTION. The two sources agree exactly; the
 * contradiction was manufactured by comparing a 2024 roster against a filing
 * history without looking up when each government ended.
 *
 * ⚠ The lesson is not "the census was right". It is that an apparent conflict
 * between two sources is a question about a THIRD fact — here, a dissolution
 * date — and asserting the conflict before looking for that fact published
 * something false.
 *
 * ── HOW EACH LINE IS SOURCED ───────────────────────────────────────────────
 *
 * `measured`  — from TT's own data or the census files in `cache/`. No
 *               external source involved, and reproducible here.
 * `sourced`   — an official document, named in `authority`.
 * ⚠ Where the CAUSE is not independently sourced it says so. A consolidation
 * TT can see in its own filing record is measured; the legal mechanism behind
 * it is not, unless an authority is named.
 */

export const GA_DISSOLVED = Object.freeze([
  Object.freeze({
    cicoid: '2011001',
    name: 'Macon',
    county: 'Bibb County',
    lastFiscalYear: 2013,
    dissolvedOn: '2014-01-01',
    successorCicoid: '3011011',
    authority: null,
    why: 'Consolidated with Bibb County to form Macon-Bibb County. ⭐ MEASURED, not '
      + 'inferred: Macon stops at FY2013 and Macon-Bibb (3011011) starts at FY2014 with '
      + 'no overlapping year, and the Census Bureau RETIRED place code 49000 after '
      + 'Vintage 2013 and issued 49008 for the consolidated government rather than '
      + 'continuing the old code. ⚠ The effective date is the consolidation TT can see '
      + 'in both records; no statute is cited here.',
  }),
  Object.freeze({
    cicoid: '2011002',
    name: 'Payne',
    county: 'Bibb County',
    lastFiscalYear: 2013,
    dissolvedOn: '2014-01-01',
    successorCicoid: '3011011',
    authority: null,
    why: 'Ceased with the Macon-Bibb consolidation. ⭐ MEASURED: stops at FY2013, the '
      + 'same year as Macon, and is absent from Census Vintage 2014 onward. ⚠ THE '
      + 'MECHANISM IS NOT SOURCED — Payne was a separate municipality inside Bibb '
      + 'County, and whether it was dissolved BY the consolidation act or separately is '
      + 'not established here. The date is the boundary TT can see, not a cited one.',
  }),
  Object.freeze({
    cicoid: '2134001',
    name: 'Helena',
    county: 'Telfair County',
    lastFiscalYear: 2014,
    dissolvedOn: '2015-01-01',
    successorCicoid: '2134007',
    authority: null,
    why: 'Merged with McRae to form McRae-Helena. ⭐ MEASURED: Helena and McRae both '
      + 'stop at FY2014 and McRae-Helena (2134007) starts at FY2015 with no overlap; '
      + 'the census carries `McRae-Helena city` (place 49100) from Vintage 2019. '
      + '⚠ The date is the filing boundary, not a cited effective date.',
  }),
  Object.freeze({
    cicoid: '2134004',
    name: 'McRae',
    county: 'Telfair County',
    lastFiscalYear: 2014,
    dissolvedOn: '2015-01-01',
    successorCicoid: '2134007',
    authority: null,
    why: 'Merged with Helena to form McRae-Helena. Same measurement as Helena above; '
      + 'the date is the filing boundary, not a cited effective date.',
  }),
  Object.freeze({
    cicoid: '2035008',
    name: 'Riverside',
    county: 'Colquitt County',
    lastFiscalYear: 2015,
    dissolvedOn: '2016',
    successorCicoid: null,
    authority: 'City of Moultrie, "Riverside" (moultriega.com): "In 2016, Riverside '
      + 'surrendered its municipal charter because of how low the population had gotten."',
    why: 'SOURCED to the surrounding city\'s official site, which gives the YEAR only — '
      + '2016 — not a day. ⚠ Riverside runs a July fiscal year, so its FY2016 would have '
      + 'ended 2016-06-30, before the surrender; it did not file that year. The last '
      + 'filing is therefore FY2015 and the final year is MISSING rather than '
      + 'coincident with dissolution — unlike Ranger and Sunny Side below, whose fit is '
      + 'exact. Recorded as the looser case it is. ⭐ The county is confirmed from the '
      + 'CICOID alone (035 = Colquitt), with no name matching — which matters, because '
      + 'Georgia has a second Riverside.',
  }),
  Object.freeze({
    cicoid: '2064902',
    name: 'Ranger',
    county: 'Gordon County',
    lastFiscalYear: 2022,
    dissolvedOn: '2023-05-03',
    successorCicoid: null,
    authority: 'Georgia HB 773 (2023) — Senate Local Consent Calendar, 2023-03-29 '
      + '(legis.ga.gov): repeals the Act providing a new charter for the Town of Ranger '
      + 'in the County of Gordon, approved 1979-04-11, and transfers duties and '
      + 'obligations to Gordon County. House 2023 composite status carries its history '
      + 'through 2023-05-03.',
    why: 'Ranger runs a January fiscal year, so its last filing FY2022 covers calendar '
      + '2022 and ended 2022-12-31 — the last complete fiscal year before dissolution. '
      + '⚠ Press reporting gives further detail (no police, utilities or elections) but '
      + 'is not relied on here; the legislative record is the authority. ⭐ County '
      + 'confirmed from the CICOID (064 = Gordon).',
  }),
  Object.freeze({
    cicoid: '2126003',
    name: 'Sunny Side',
    county: 'Spalding County',
    lastFiscalYear: 2023,
    dissolvedOn: '2024-01-01',
    successorCicoid: null,
    authority: 'Georgia HB 542 (2023), enrolled text on the Governor\'s signed-legislation '
      + 'site (gov.georgia.gov): repeals the 1950 Act incorporating the City of Sunny '
      + 'Side and vests Spalding County with its services, assets and obligations. '
      + 'SECTION 14: "This Act shall become effective on January 1, 2024."',
    why: '⭐⭐ THE TIGHTEST FIT OF THE SEVEN. Sunny Side runs a January fiscal year, so '
      + 'its last filing FY2023 covers calendar 2023 and ended 2023-12-31 — THE DAY '
      + 'BEFORE the repeal took effect. A government that filed right up to the moment '
      + 'it ceased to exist. ⭐ County confirmed from the CICOID (126 = Spalding).',
  }),
]);

export const GA_DISSOLVED_BY_CICOID = new Map(GA_DISSOLVED.map((d) => [d.cicoid, d]));

/** The dissolution record for a CICOID, or null. */
export function dissolvedGovernment(cicoid) {
  return GA_DISSOLVED_BY_CICOID.get(String(cicoid)) ?? null;
}
