/**
 * Single source of truth for every WA SAO entity in Treasury Tracker.
 *
 * NO SHEBANG, deliberately -- this is a library, and a `#!` line breaks the
 * Vite transform on any Windows checkout (git rewrites to CRLF; Vite's shebang
 * strip matches `#!.*\n` and `.` does not match `\r`). `tests/waSao.test.mjs`
 * guards this for every module in scripts/lib/.
 *
 * MCAGs are STRINGS, not numbers. Leading zeros are significant: Tacoma is
 * '0610', and a numeric literal would silently make it 610.
 *
 * ⚠ EVERY MCAG BELOW WAS RESOLVED AGAINST THE LIVE SAO REGISTRY (2026-08-15),
 * not inferred. The four county MCAGs are the reason that matters: the
 * WA-CITIES-01 plan drafted them from guesswork as 0620/0730/0240/0660 and
 * ALL FOUR WERE WRONG. An MCAG mismatch is not a tie failure -- it loads a
 * different government's money in a perfectly self-consistent way that every
 * arithmetic gate passes. Never write an MCAG here that you have not looked up.
 *
 * `fiscalYears: null` means "not yet reconned". `perCapitaBand: null` means
 * "not yet derived from the loaded spread". Nothing may load an entity with
 * either still null -- the loaders assert this.
 *
 * ── THREE FIELDS THAT EXIST ONLY FOR THE AUDIT HARNESS ──────────────────────
 * `manifestSpan`, `excludedYears` and `expectedResidues` are not used by the
 * loaders. They are here rather than in verify-wa-audit.mjs because they are
 * FACTS ABOUT AN ENTITY, and the audit's whole job is to assert them:
 *
 *   manifestSpan      [first, last] fiscal year the entity's ARN manifest
 *                     covers. Every year in the span is either loaded or
 *                     declared excluded; anything else is a silent hole and
 *                     the audit fails on it.
 *   excludedYears     FY -> the reason it is not loaded. The audit asserts each
 *                     one has ZERO rows. Every exclusion is a deliberate
 *                     refusal to publish, so a row quietly appearing for one
 *                     would mean a figure nobody adjudicated got shipped.
 *   expectedResidues  how many source_rounding cases the entity's extractor is
 *                     expected to register. A REAL number in every case,
 *                     including zero: Tacoma prints in thousands, so its
 *                     components are already rounded to the thousand and sum
 *                     exactly. Asserting the zero means a residue appearing
 *                     there later is a finding rather than a shrug.
 */

/**
 * Populations are the WA OFM April 1 estimates, read from
 * `ofm_april1_population_final.xlsx` (the April 1, 2026 edition), sheet
 * `Population`, column `2025 Population Estimate`, Filter=4 city rows /
 * Filter=1 county rows. Line numbers are recorded per entity below.
 *
 * The 2026 edition also carries a `2026 Population Estimate` column. The WA
 * cohort is deliberately kept on the **2025** column so all eight entities
 * share one denominator year and per-capita figures stay comparable across
 * cities. The 2026 values are recorded in
 * `docs/superpowers/plans/WA-CITIES-01-RECON.md` for a future whole-cohort
 * refresh -- refresh all eight together or not at all.
 */
const POPULATION_YEAR = 2025;
export { POPULATION_YEAR };

export const WA_ENTITIES = [
  // ── v2.22, already live. Listed so the harnesses cover them too. ──────────
  {
    name: 'Kitsap County', mcag: '0132', entityType: 'county', countyName: null,
    pdfDir: 'docs/KitsapCounty', pdfPrefix: 'kitsap', datasetIdPrefix: 'kitsap-sao-gf',
    population: 288_900, populationNote: 'WA OFM April 1, 2025 — Filter=1 county row, line 183',
    expectId: 'c35da2c6-c8e6-4f50-85d8-60b02890d3e4',
    perCapitaBand: [100, 10_000], verifyPerCapitaBand: [200, 700], sanityMax: 2_000_000_000,
    fiscalYears: [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016,
                  2020, 2021, 2022, 2023, 2024],
    manifestSpan: [2004, 2025],
    excludedYears: {
      2017: 'font defect, digits absent', 2018: 'font defect, digits absent',
      2019: 'font defect, digits absent', 2025: 'not yet audited — no filing exists',
    },
    expectedResidues: 13,
    roundingFiles: ['extractKitsap.py'], navOnly: false,
  },
  {
    name: 'Bainbridge Island', mcag: '0461', entityType: 'city', countyName: 'Kitsap County',
    pdfDir: 'docs/BainbridgeIsland', pdfPrefix: 'bainbridge', datasetIdPrefix: 'bainbridge-sao-gf',
    population: 25_530, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 186',
    expectId: '9e7b49a3-8a8c-48b8-897f-28d4bb161fb5',
    perCapitaBand: [100, 10_000], verifyPerCapitaBand: [250, 1400], sanityMax: 500_000_000,
    fiscalYears: [2004, 2005, 2007, 2008,
                  2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    manifestSpan: [2004, 2025],
    excludedYears: {
      2006: 'image-only scan', 2009: 'ciphered digits, bounded decode failed',
      2010: 'ciphered GAAP statement, money digits absent', 2011: 'CCITT stencil scan',
    },
    expectedResidues: 20,
    roundingFiles: ['extractBainbridgeEarly.py', 'extractBainbridge.py'], navOnly: false,
  },

  // ── Nav-only county nodes: a breadcrumb parent, no budget rows. ───────────
  // v2.17/v2.18 Pima precedent. MCAGs verified live 2026-08-15 and kept even
  // though nav-only nodes never fetch, so a future county-finances milestone
  // starts from fact. The lookup returns decoys for every one of these
  // (cemetery districts, development corporations) -- see selectExactCity.
  //
  // Populations ARE carried even though these nodes hold no budget rows: the
  // hero banner's info-row renders a POPULATION stat, and Pima (v2.17) set the
  // precedent of a nav-only node carrying one. Same OFM file and column as the
  // cities, Filter=1 county rows. Cross-check that the column is the right one:
  // this file gives Kitsap County 288,900 at line 183, matching the figure
  // v2.22 loaded independently.
  { name: 'Pierce County',    mcag: '0152', entityType: 'county', countyName: null, navOnly: true,
    expectId: 'cfb055a0-e380-479c-83a4-23c4de421f99',
    population: 959_900, populationNote: 'WA OFM April 1, 2025 — Filter=1 county row, line 271 (2026 est: 967,000)' },
  { name: 'Spokane County',   mcag: '0166', entityType: 'county', countyName: null, navOnly: true,
    expectId: '9ca34d93-cb22-477b-8aa1-ec2c207960e0',
    population: 566_000, populationNote: 'WA OFM April 1, 2025 — Filter=1 county row, line 346 (2026 est: 570,600)' },
  { name: 'Clark County',     mcag: '0103', entityType: 'county', countyName: null, navOnly: true,
    expectId: '5a041c97-8477-4835-8342-c3c6fd46d9fe',
    population: 542_400, populationNote: 'WA OFM April 1, 2025 — Filter=1 county row, line 41 (2026 est: 550,000)' },
  { name: 'Snohomish County', mcag: '0162', entityType: 'county', countyName: null, navOnly: true,
    expectId: 'ee9ad970-fd12-48ca-977e-2ab0e4f1f0a4',
    population: 873_800, populationNote: 'WA OFM April 1, 2025 — Filter=1 county row, line 322 (2026 est: 879,700)' },

  // ── WA-CITIES-01 ──────────────────────────────────────────────────────────
  {
    name: 'Tacoma', mcag: '0610', entityType: 'city', countyName: 'Pierce County',
    pdfDir: 'docs/Tacoma', pdfPrefix: 'tacoma', datasetIdPrefix: 'tacoma-sao-gf',
    population: 228_400, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 295 (2026 est: 231,000)',
    // DERIVED from the observed spread, never copied. Across all 38 loaded
    // combinations Tacoma runs $588.40/resident (FY2004 revenue) to
    // $1,345.21 (FY2024 revenue). The band keeps roughly half the minimum
    // below and twice the maximum above, which passes every real year while
    // still rejecting a 1000x units error in either direction: units=1 would
    // read ~$0.59 and units=1_000_000 would read ~$588,000.
    //
    // This is the ONLY guard that fires on a wrong `units`. The tie gate is
    // unit-invariant -- it reads $0 whether or not the multiplier was applied
    // -- and Tacoma is the first WA SAO city here that prints IN THOUSANDS,
    // so a config copied from Bainbridge or Kitsap would land 1000x low with
    // a green tie. Kitsap's own [100, 10_000] would NOT have caught it.
    perCapitaBand: [300, 3_000],
    // The harness band is TIGHTER than the loader band above, deliberately.
    // The loader's job is to reject a units catastrophe; the harness's job is
    // to reject a WRONG PAGE, whose per-capita lands far outside the real
    // spread but often inside a generous units band. Measured spread is
    // $588-$1,345, so this brackets it closely.
    verifyPerCapitaBand: [500, 1_500],
    expectId: 'c8f93566-29fa-48df-878c-07b48655a290',
    sanityMax: 5_000_000_000,
    // MEASURED window: 19 years. All 22 "Financial and Federal" filings
    // FY2003-FY2024 pass the content guard, and ONE extractor config ties at
    // exactly $0 on 19 of them, spanning all three of Tacoma's statement eras.
    //
    // Excluded, each an isolated year so the walk continues past it:
    //   FY2025 -- source timing. Its only City of Tacoma filings are a 5pp
    //             opinion letter (ARN 1040162) and Contracted CPA reports; the
    //             financial audit is not yet released. Re-check later.
    //   FY2011, FY2018, FY2021 -- source-document defect. The statement pages
    //             carry no usable text layer; FY2018 shows the constant +29
    //             byte shift plainly. Same cipher class v2.22 failed to decode
    //             on Bainbridge FY2010 and Kitsap FY2017-2019, so no recovery
    //             is attempted. See scripts/extractTacoma.py.
    fiscalYears: [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2012, 2013,
                  2014, 2015, 2016, 2017, 2019, 2020, 2022, 2023, 2024],
    manifestSpan: [2003, 2025],
    excludedYears: {
      2011: 'no usable text layer on the statement pages',
      2018: 'no usable text layer — constant +29 byte shift, same cipher class as Bainbridge FY2010',
      2021: 'no usable text layer on the statement pages',
      2025: 'source timing — only a 5pp opinion letter (ARN 1040162) has been released',
    },
    // ZERO is the measured value, not a placeholder. Tacoma prints IN
    // THOUSANDS, so every component is already rounded to the thousand and the
    // components sum exactly; the sub-dollar artifacts that produce residues on
    // the whole-dollar issuers cannot arise.
    expectedResidues: 0,
    roundingFiles: ['extractTacoma.py'], navOnly: false,
  },
  {
    name: 'Spokane', mcag: '0724', entityType: 'city', countyName: 'Spokane County',
    pdfDir: 'docs/Spokane', pdfPrefix: 'spokane', datasetIdPrefix: 'spokane-sao-gf',
    population: 234_700, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 359 (2026 est: 235,900)',
    // DERIVED from the observed spread, never copied. Across all 40 loaded
    // combinations Spokane runs $384.88/resident (FY2005 operating) to
    // $1,144.95 (FY2024 revenue). Half the minimum below and roughly twice the
    // maximum above: wide enough for every real year, tight enough that a
    // 1000x units error cannot pass -- units=1000 would read ~$385,000.
    //
    // Spokane prints WHOLE DOLLARS and Tacoma, its neighbour in this
    // milestone, prints IN THOUSANDS. Copying Tacoma's [300, 3000] here would
    // still have passed every Spokane year, which is exactly why the band has
    // to be re-derived rather than inherited: a band that passes by accident
    // guards nothing.
    perCapitaBand: [200, 2_500],
    // TIGHTER than the loader band, deliberately: the loader's job is to
    // reject a units catastrophe, the harness's is to reject a WRONG PAGE.
    // Spokane needs that especially -- it publishes a `Schedule of General
    // Fund Accounts` whose Total column EQUALS this statement's General Fund
    // column, so a wrong-page hit there would tie at $0 and land at a
    // plausible per-capita. Measured spread is $385-$1,145.
    verifyPerCapitaBand: [300, 1_400],
    expectId: '7877e1e6-1c77-4c71-af90-425cf84610a4',
    sanityMax: 5_000_000_000,
    // MEASURED window: 20 years. All 21 "Financial and Federal" filings
    // FY2004-FY2024 pass the content guard, and ONE extractor config ties at
    // exactly $0 on 20 of them -- every year except FY2012.
    fiscalYears: [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2013, 2014,
                  2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    manifestSpan: [2004, 2025],
    excludedYears: {
      2012: 'no usable text layer — every statement page returns only the SAO page furniture',
      2025: 'source timing — the only FY2025 filing is a Contracted CPA report (ARN 1039996)',
    },
    // ZERO is the measured value. Spokane prints whole dollars, so unlike the
    // whole-dollar v2.22 entities it could plausibly carry sub-dollar
    // artifacts -- it carries none: all 40 combinations tie at a bare $0.
    expectedResidues: 0,
    roundingFiles: ['extractSpokane.py'], navOnly: false,
  },
  {
    name: 'Vancouver', mcag: '0247', entityType: 'city', countyName: 'Clark County',
    pdfDir: 'docs/Vancouver', pdfPrefix: 'vancouver', datasetIdPrefix: 'vancouver-sao-gf',
    population: 205_100, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 48 (2026 est: 207,000)',
    // DERIVED from the observed spread. Across all 38 loaded combinations
    // Vancouver runs $348.74/resident (FY2005 operating) to $1,163.89 (FY2023
    // revenue). Half the minimum below and roughly twice the maximum above:
    // wide enough for every real year, tight enough that units=1000 (~$349,000)
    // cannot pass.
    perCapitaBand: [175, 2_500],
    // TIGHTER than the loader band: the loader rejects a units catastrophe,
    // the harness rejects a WRONG PAGE. Measured spread $349-$1,164.
    verifyPerCapitaBand: [275, 1_400],
    expectId: '136eabfe-c898-435b-86cb-ca68af59256e',
    sanityMax: 5_000_000_000,
    // MEASURED window: 19 years. All 21 "Financial and Federal" filings
    // FY2004-FY2024 pass the content guard, and ONE extractor config ties at
    // $0 on 19 of them -- the two exclusions are both at the ENDS of the span,
    // so no year inside the window is skipped.
    fiscalYears: [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014,
                  2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    manifestSpan: [2004, 2025],
    excludedYears: {
      2004: 'image-only scan — every statement page returns only the SAO page furniture',
      2024: 'text-layer defect — glyphs dropped (f/w/x/j/z and the fi/fl/ff ligatures), +29 shift on other runs, and the money DIGITS are absent from the statement ("$ ,,")',
      2025: 'source timing — the SAO holds no City of Vancouver filing for FY2025 at all',
    },
    // TWO, both FY2008, both adjudicated off the rendered page image: each side
    // of that statement prints a total one dollar BELOW the sum of its own
    // printed components. See scripts/extractVancouver.py for the component
    // lists that were re-added by hand.
    expectedResidues: 2,
    roundingFiles: ['extractVancouver.py'], navOnly: false,
  },
  {
    name: 'Bellevue', mcag: '0374', entityType: 'city', countyName: 'King County',
    pdfDir: 'docs/Bellevue', pdfPrefix: 'bellevue', datasetIdPrefix: 'bellevue-sao-gf',
    population: 158_000, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 146 (2026 est: 158,300)',
    // DERIVED from the observed spread. Across all 24 loaded combinations
    // Bellevue runs $904.11/resident (FY2009 revenue) to $2,011.32 (FY2023
    // revenue) -- the RICHEST per resident of the WA cohort, which is why the
    // band sits well above Spokane's and Vancouver's and why copying either of
    // theirs would have rejected a correct load outright.
    //
    // Bellevue prints IN THOUSANDS like Tacoma. units=1 would read ~$0.90 and
    // units=1_000_000 ~$904,000; both are far outside.
    perCapitaBand: [400, 4_500],
    // TIGHTER than the loader band: the loader rejects a units catastrophe, the
    // harness rejects a WRONG PAGE. Measured spread $904-$2,011.
    verifyPerCapitaBand: [700, 2_400],
    expectId: '59884fc5-ecc8-4fbc-9092-600360eba765',
    sanityMax: 5_000_000_000,
    // MEASURED window: 12 years, the SHORTEST in this milestone, and every gap
    // is a source-document defect rather than a config limit. All 21 filings
    // pass the fetch-time content guard; nine of them have no readable
    // statement. FY2004-FY2007 are four CONSECUTIVE image-only scans, which is
    // what ends the window at FY2008 under the floor rule; FY2011/2014/2017/
    // 2019/2024 are each ISOLATED, so the walk continues past them.
    fiscalYears: [2008, 2009, 2010, 2012, 2013, 2015, 2016, 2018, 2020, 2021, 2022, 2023],
    // The span covers the WHOLE ARN manifest, not just the loadable part, so
    // the audit asserts that the four scan years hold zero rows as well.
    manifestSpan: [2004, 2025],
    excludedYears: {
      2004: 'image-only scan — no statement page carries any text (first of four consecutive, which is what ends the window)',
      2005: 'image-only scan — no statement page carries any text',
      2006: 'image-only scan — no statement page carries any text',
      2007: 'image-only scan — no statement page carries any text',
      2011: 'no usable text layer — statement pages carry no digits',
      2014: 'text layer both collapses spaces AND injects them inside words and numbers ("$1 5,205"), so the digits are present but unparseable without a de-spacing heuristic the library refuses',
      2017: 'no usable text layer — statement pages carry no digits',
      2019: 'no usable text layer — statement pages carry no digits',
      2024: 'no usable text layer — text renders as consonant soup ("ZtZ", "&Zz") with no numerals at all',
      2025: 'source timing — the SAO holds no City of Bellevue filing for FY2025',
    },
    // ELEVEN, the most of any entity here, and structural: Bellevue prints in
    // thousands, so each component is independently rounded and their sum need
    // not equal the separately-rounded printed total. All eleven adjudicated
    // off the rendered page images — see scripts/extractBellevue.py.
    expectedResidues: 11,
    roundingFiles: ['extractBellevue.py'], navOnly: false,
  },
  {
    name: 'Kent', mcag: '0401', entityType: 'city', countyName: 'King County',
    pdfDir: 'docs/Kent', pdfPrefix: 'kent', datasetIdPrefix: 'kent-sao-gf',
    population: 140_100, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 160 (2026 est: 140,400)',
    perCapitaBand: null, sanityMax: 5_000_000_000,
    fiscalYears: null, roundingFiles: ['extractKent.py'], navOnly: false,
  },
  {
    name: 'Everett', mcag: '0664', entityType: 'city', countyName: 'Snohomish County',
    pdfDir: 'docs/Everett', pdfPrefix: 'everett', datasetIdPrefix: 'everett-sao-gf',
    population: 114_700, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 330 (2026 est: 114,900)',
    perCapitaBand: null, sanityMax: 5_000_000_000,
    fiscalYears: null, roundingFiles: ['extractEverett.py'], navOnly: false,
  },
];

export function getEntity(name) {
  const e = WA_ENTITIES.find((x) => x.name === name);
  if (!e) throw new Error(`"${name}" is not in the WA roster (scripts/lib/waRoster.mjs)`);
  return e;
}

export const cityEntities = () => WA_ENTITIES.filter((e) => e.entityType === 'city');
export const countyEntities = () => WA_ENTITIES.filter((e) => e.entityType === 'county');

/** Entities ready to load: reconned window, population and band all present. */
export function loadableEntities() {
  return WA_ENTITIES.filter((e) => !e.navOnly && e.fiscalYears && e.population && e.perCapitaBand);
}

/**
 * Entities the verification harnesses cover: loaded, with a pinned id and a
 * tight verify band. Nav-only county nodes are excluded -- they hold no budget
 * rows, so there is nothing to re-derive.
 */
export function verifiableEntities() {
  return WA_ENTITIES.filter((e) => !e.navOnly && e.fiscalYears && e.expectId && e.verifyPerCapitaBand);
}

/**
 * Pick the exact `City of <Name>` row out of a GetEntities response.
 *
 * The endpoint matches on a name PREFIX, so this must reject decoys rather
 * than take the first hit. Observed live 2026-08-15: "Spokane" returns City of
 * Spokane (0724), City of Spokane VALLEY (2781) -- a genuinely different
 * municipality -- and an Inactive transportation benefit district (3062);
 * "Kent" returns City of Kent (0401) plus two inactive districts.
 */
export function selectExactCity(candidates, cityName) {
  const want = `city of ${cityName}`.toLowerCase();
  const list = candidates || [];
  const hits = list.filter((r) => String(r.EntityName || r.Name || '').trim().toLowerCase() === want);
  if (hits.length !== 1) {
    throw new Error(
      `no exact "City of ${cityName}" entity in ${list.length} candidate(s) (found ${hits.length}); ` +
      `candidates: ${list.map((r) => r.EntityName || r.Name).join(' | ')}`);
  }
  return hits[0];
}

/**
 * Assert a resolved MCAG against the pinned roster value.
 *
 * This is the guard that makes the decoys harmless. It is deliberately a hard
 * throw and not a warning: a wrong MCAG produces a load that ties at $0 on
 * every gate while reporting another government's finances under this city's
 * name.
 */
export function assertMcag(cityName, resolvedMcag) {
  const pinned = getEntity(cityName).mcag;
  if (String(resolvedMcag) !== pinned) {
    throw new Error(
      `${cityName}: resolved MCAG ${resolvedMcag} does not match the pinned MCAG ${pinned} — ` +
      `refusing to continue. An MCAG mismatch loads a DIFFERENT government's money and ties at $0.`);
  }
  return pinned;
}
