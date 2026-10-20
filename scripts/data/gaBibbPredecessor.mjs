/**
 * ⚠⚠ BIBB COUNTY IS A DIFFERENT GOVERNMENT FROM MACON-BIBB COUNTY.
 *
 * Bibb County filed as `1011011` through FY2013 and reports $92.0M-$115.7M of
 * operating expenditure. In 2014 it consolidated with the CITY of Macon to
 * form Macon-Bibb County (`3011011`), which reports $195.3M in FY2016.
 *
 * Appending one series to the other would show a ~1.7x step that reads as
 * growth and is a change of scope — the Fulton FY2017/FY2018 reader-distortion
 * shape, where 92% of an apparent jump was not growth at all. Chris's call,
 * 2026-10-19: load it as its own entity, which is what it was.
 *
 * ⭐ THE CENSUS BUREAU REACHED THE SAME CONCLUSION INDEPENDENTLY. It retired
 * PLACE 49000 (`Macon city`) after vintage 2013 and issued PLACE 49008
 * (`Macon-Bibb County`) for the consolidated government, rather than
 * continuing the old code. A consolidation is a new government, not a renamed
 * one.
 *
 * ⚠ HAND-MAINTAINED, not generated. `buildGaStatewideEntities.mjs` builds from
 * the v2 window and this government has no v2 filing; its v1 fallback covers
 * MUNICIPALITIES, whose enumeration this county is not in. Carried here for
 * the same reason `FL_DISSOLVED` is carried by hand: a government that ceased
 * to exist cannot be derived from a current roster.
 *
 * ⚠ `population` is NULL. There is no 2024 estimate for a county government
 * that ceased in 2014, and Bibb County's territory is now reported under
 * Macon-Bibb. Borrowing Macon-Bibb's figure would describe a different
 * government — the one whose scope change this entity exists to keep separate.
 *
 * ⚠ `fiscalYearStartMonth` is MEASURED, not assumed: all five filings print
 * "June 30" with MosRptd = 12. No `monthByYear` is needed because they agree.
 */
export const GA_BIBB_PREDECESSOR = Object.freeze([
  Object.freeze({
    key: 'bibb-county',
    cicoid: '1011011',
    name: 'Bibb County',
    state: 'GA',
    entityType: 'county',
    population: null,
    populationSource: 'no current estimate — the county government consolidated into '
      + 'Macon-Bibb County in 2014. Census Vintage 2013 names `Macon city` (PLACE 49000); '
      + 'vintage 2014 replaces it with `Macon-Bibb County` (PLACE 49008), a NEW place code.',
    fiscalYearStartMonth: 7,
    fiscalYearEndText: 'June 30',
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    censusVintage: 2013,
    placeFips: null,
    builtFrom: 'v1',
    monthStatus: 'unverified',
    monthWhy: 'all five filings print "June 30" with MosRptd = 12 and agree; the federal '
      + 'audit record covers no year this government filed, so the month is recorded, '
      + 'not corroborated',
    parentCountyKey: null,
    fiscalYears: Object.freeze([2009, 2010, 2011, 2012, 2013]),
    // ⚠⚠ Asserted in tests: this must never gain an FY2014+ year. A year
    // appearing here that Macon-Bibb also claims is a double count, and a
    // series that spans 2013/2014 is a scope change shown as growth.
    lastFiscalYear: 2013,
    successorCicoid: '3011011',
  }),
]);
