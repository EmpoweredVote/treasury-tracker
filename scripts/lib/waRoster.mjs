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
    perCapitaBand: [100, 10_000], sanityMax: 2_000_000_000,
    fiscalYears: [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016,
                  2020, 2021, 2022, 2023, 2024],
    roundingFiles: ['extractKitsap.py'], navOnly: false,
  },
  {
    name: 'Bainbridge Island', mcag: '0461', entityType: 'city', countyName: 'Kitsap County',
    pdfDir: 'docs/BainbridgeIsland', pdfPrefix: 'bainbridge', datasetIdPrefix: 'bainbridge-sao-gf',
    population: 25_530, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 186',
    perCapitaBand: [100, 10_000], sanityMax: 500_000_000,
    fiscalYears: [2004, 2005, 2007, 2008,
                  2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
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
    population: 959_900, populationNote: 'WA OFM April 1, 2025 — Filter=1 county row, line 271 (2026 est: 967,000)' },
  { name: 'Spokane County',   mcag: '0166', entityType: 'county', countyName: null, navOnly: true,
    population: 566_000, populationNote: 'WA OFM April 1, 2025 — Filter=1 county row, line 346 (2026 est: 570,600)' },
  { name: 'Clark County',     mcag: '0103', entityType: 'county', countyName: null, navOnly: true,
    population: 542_400, populationNote: 'WA OFM April 1, 2025 — Filter=1 county row, line 41 (2026 est: 550,000)' },
  { name: 'Snohomish County', mcag: '0162', entityType: 'county', countyName: null, navOnly: true,
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
    roundingFiles: ['extractTacoma.py'], navOnly: false,
  },
  {
    name: 'Spokane', mcag: '0724', entityType: 'city', countyName: 'Spokane County',
    pdfDir: 'docs/Spokane', pdfPrefix: 'spokane', datasetIdPrefix: 'spokane-sao-gf',
    population: 234_700, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 359 (2026 est: 235,900)',
    perCapitaBand: null, sanityMax: 5_000_000_000,
    fiscalYears: null, roundingFiles: ['extractSpokane.py'], navOnly: false,
  },
  {
    name: 'Vancouver', mcag: '0247', entityType: 'city', countyName: 'Clark County',
    pdfDir: 'docs/Vancouver', pdfPrefix: 'vancouver', datasetIdPrefix: 'vancouver-sao-gf',
    population: 205_100, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 48 (2026 est: 207,000)',
    perCapitaBand: null, sanityMax: 5_000_000_000,
    fiscalYears: null, roundingFiles: ['extractVancouver.py'], navOnly: false,
  },
  {
    name: 'Bellevue', mcag: '0374', entityType: 'city', countyName: 'King County',
    pdfDir: 'docs/Bellevue', pdfPrefix: 'bellevue', datasetIdPrefix: 'bellevue-sao-gf',
    population: 158_000, populationNote: 'WA OFM April 1, 2025 — Filter=4 city row, line 146 (2026 est: 158,300)',
    perCapitaBand: null, sanityMax: 5_000_000_000,
    fiscalYears: null, roundingFiles: ['extractBellevue.py'], navOnly: false,
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
