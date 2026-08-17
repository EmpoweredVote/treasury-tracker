/**
 * CA-CITIES-01 roster — the single source of truth for the five cities.
 *
 * Read by every loader, the reconciliation driver and all four harnesses, so an
 * entity's facts are stated once rather than restated in a dozen places. This is
 * the lesson of `waRoster.mjs`: two hardcoded entity arrays were fine, eight were
 * not.
 *
 * NO SHEBANG. A `#!` on any module under scripts/lib/ breaks `npm test` on
 * Windows, and a test guards it (commit 40aa706).
 *
 * ── The per-capita gate ──────────────────────────────────────────────────────
 * `populationYear` is NULL for all five cities in production as of 2026-08-16,
 * and per the spec per-capita display is GATED on it: no population year means
 * no band, which means no per-capita figure. A current estimate attributed to a
 * FY2007 figure would be a wrong number wearing a real-looking label.
 *
 * A band is also never inherited — not from another city, not from another year.
 * Seattle's [500, 25000] rejects a correct Kitsap load, which is how that rule
 * was learned. Task 13 sets populationYear and perCapitaBand together, per city,
 * once a properly-yeared population source (CA DOF E-4/E-5) is read.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * All five county nodes ALREADY EXIST in production; this milestone creates none.
 * `scoWindow` records what the State Controller bulk series already covers, which
 * is what the ACFR load will be reconciled against — every ACFR year here lands
 * on a year that already has a figure from a different reporter.
 *
 * Spec:  docs/superpowers/specs/2026-08-16-ca-cities-01-design.md
 * Plan:  docs/superpowers/plans/2026-08-16-ca-cities-01.md
 */

/**
 * @typedef {object} CaCity
 * @property {string}        name            Display name, matches treasury.municipalities.name
 * @property {string}        municipalityId  Resolved from production 2026-08-16
 * @property {string}        countyNode      Existing county entity this city hangs under
 * @property {number}        population      Unyeared until Task 13 — see the gate above
 * @property {number|null}   populationYear  NULL until a yeared source is read
 * @property {number[]|null} perCapitaBand   NULL while populationYear is NULL. Never inherited
 * @property {string}        docDir          Where this city's ACFRs are fetched to
 * @property {string}        pdfPrefix       Filename prefix for those PDFs
 * @property {number[]}      fys             Reconciled, loadable years. Filled by the city's recon task
 * @property {[number, number]} scoWindow    Existing State Controller coverage, inclusive
 */

/** @type {CaCity[]} */
export const CA_CITIES = [
  {
    name: 'Irvine',
    municipalityId: '17f0abc4-751f-4609-adcd-d6274ed33269',
    countyNode: 'Orange County',
    population: 314550,
    populationYear: null,
    perCapitaBand: null,
    docDir: 'docs/Irvine',
    pdfPrefix: 'irvine',
    fys: [],
    scoWindow: [2003, 2024],
  },
  {
    name: 'Stockton',
    municipalityId: 'f37da4cf-b8ea-4c60-8c9d-7fbe8b0f36c5',
    countyNode: 'San Joaquin County',
    population: 261253,
    populationYear: null,
    perCapitaBand: null,
    docDir: 'docs/Stockton',
    pdfPrefix: 'stockton',
    fys: [],
    scoWindow: [2003, 2024],
  },
  {
    name: 'Santa Clarita',
    municipalityId: '332c6253-7242-4cef-9938-d9c40df56e03',
    countyNode: 'Los Angeles County',
    population: 230659,
    populationYear: null,
    perCapitaBand: null,
    docDir: 'docs/SantaClarita',
    pdfPrefix: 'santa-clarita',
    fys: [],
    scoWindow: [2003, 2024],
  },
  {
    name: 'Modesto',
    municipalityId: 'e2f0a3f9-0373-4d3e-86ee-ae1e8a97406a',
    countyNode: 'Stanislaus County',
    population: 203294,
    populationYear: null,
    perCapitaBand: null,
    docDir: 'docs/Modesto',
    pdfPrefix: 'modesto',
    // Source recon 2026-08-16 (Task 4). Modesto publishes 31 years, FY1995–FY2025,
    // through a CivicPlus ArchiveCenter. Four exclusions, all for source-document
    // reasons and none for a parser reason:
    //   FY1995–1999  image-only scans (~1 char/page). No OCR recovery — that class
    //                of work returned zero rows in v2.22.
    //   FY2000–2001  PRE-GASB-34 format: "Combined Statement … All Governmental
    //                Fund Types", not the modern governmental-funds statement.
    //                A second extractor config, deferred not refused — see the
    //                recon document.
    //   FY2009       image-only scan (236 chars / 148 pages, cover page only).
    //                Isolated, so the walk continues either side of it.
    // Leaves 23 loadable years. NOTE the two that fall OUTSIDE the SCO window and
    // so have nothing to reconcile against: FY2002 (below SCO's FY2003 floor) and
    // FY2025 (above its FY2024 ceiling).
    fys: [
      2002, 2003, 2004, 2005, 2006, 2007, 2008,
      2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
      2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ],
    scoWindow: [2003, 2024],
  },
  {
    name: 'Chula Vista',
    municipalityId: '283e9d2e-c0a9-4319-94e6-f262d61c523b',
    countyNode: 'San Diego County',
    population: 199680,
    populationYear: null,
    perCapitaBand: null,
    docDir: 'docs/ChulaVista',
    pdfPrefix: 'chula-vista',
    fys: [],
    scoWindow: [2003, 2024],
  },
];

/** Cities with at least one reconciled, loadable year. Empty until recon runs. */
export const loadableCities = () => CA_CITIES.filter((c) => c.fys.length > 0);

/** Look up one city by its display name, or undefined. */
export const cityByName = (name) => CA_CITIES.find((c) => c.name === name);
