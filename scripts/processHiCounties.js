/**
 * NO SHEBANG — a test imports this module for its pure helpers, and the repo
 * forbids a shebang on anything a test imports (tests/waSao.test.mjs). It is
 * still run directly: `node scripts/<name>` needs no shebang on Windows.
 *
 * Hawaii's four counties — General Fund operating + revenue, FY2016–FY2025,
 * ACTUAL (ACFR GAAP basis).
 *
 * ⚠⚠ ALWAYS PASS `--entity`. Running this bare re-loads every county, and a
 * re-load is NOT free: `acfrGfLoad.loadFiscalYear` deletes and re-writes the
 * (municipality, fiscal_year, dataset_type) rows, so already-loaded rows come
 * back under NEW `budgets.id`s and the id-keyed frozen-figure registry goes
 * stale for exactly the rows re-run.
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, run once per county. That
 * module carries the write path and the guards (tie gate, fiscal-year
 * assertion, per-capita units guard, sanity ceiling, idempotence).
 *
 * Opens the `hi-local-acfr-gf` family. The HI STATE node belongs to
 * `state-acfr-gf` and is untouched.
 *
 * ── THE COHORT ────────────────────────────────────────────────────────────
 *
 *   Honolulu       city     998,747   ⚠ CONSOLIDATED CITY AND COUNTY
 *   Hawaii County  county   209,790   ⚠ five document gaps, see GAPS
 *   Maui County    county   163,688
 *   Kauai County   county    73,840
 *
 * ⚠⚠ TWO EXTRACTORS, CHOSEN PER ENTITY. Honolulu is read by the COORDINATE
 * reader (`extractHonoluluCoords.py`) because its dot leaders touch the digits
 * and defeat the `-table` character grid entirely; the other three tie at
 * exactly $0 under `-table` (`extractHiCounty.py`). The choice is made per
 * ENTITY for a stated reason, never per year — picking whichever reader tied
 * for a given year is curve-fitting.
 */
import { parseArgs } from 'node:util';

import { run } from './lib/acfrGfLoad.mjs';
import { HI_COUNTIES, countyByKey, fysFor, FAC_PDF_BASE } from './lib/hiCountySources.mjs';

/**
 * Published, audited and NOT EXTRACTABLE. Keyed `[key][mode] = [fiscalYears]`.
 * Reported at load time and NEVER written as $0 — the Sedgwick County FY2019
 * precedent, where a born-digital document simply would not yield its numbers.
 *
 * ⚠⚠ EVERY ONE OF THESE IS HAWAII COUNTY, and the cause is the DOCUMENT, not
 * the reader. Its own site (hawaiicounty.gov) returns 403 to every client
 * tried, so the Mat-Su second-publisher check has the Sitka/Akamai outcome:
 * there is no second copy to compare against.
 *
 *   FY2018, FY2023  IMAGE-ONLY SCANS — 238 and 250 chars/page against a
 *                   healthy band of 1,779-2,208 across the other 36 filings.
 *                   Rejected by the fetcher's density guard; no PDF on disk.
 *
 *   FY2017          DEGRADED OCR TEXT LAYER. The page reads `COLTNTYOF
 *                   HAWAII`, `Property taxe$`, commas rendered as periods
 *                   (`268. 517. 397`) and digits as brackets (`4. 1] 7.] 53`).
 *                   ⚠⚠⚠ The density guard PASSES it at 1,779 c/p. Repairing
 *                   punctuation here would publish confident wrong money,
 *                   because the DIGITS themselves are misread — the WA SAO
 *                   lesson that a ciphered page yields spurious money rather
 *                   than an empty one.
 *
 *   FY2020          Same class: periods as thousands separators
 *                   (`327,886.496`) and digits split by spaces
 *                   (`4 1 .604.474`).
 *
 *   FY2019 revenue  ONE ROW ONLY, and the expenditure side of the same page
 *                   is clean and loads. `Other` prints `2,506 ,7 91` — a
 *                   number broken into THREE fragments. `whitespace_repair`
 *                   closes a single split (it recovers `313 ,631,189` on this
 *                   very page) but not two, and inventing a multi-fragment
 *                   join risks welding two columns together.
 */
const GAPS = {
  hawaii: {
    revenue: [2017, 2018, 2019, 2020, 2023],
    operating: [2017, 2018, 2020, 2023],
  },
};

/**
 * The `run()` config for one county. Exported so the facts above are
 * assertable without a database.
 */
export function runConfigFor(key, { mode, dryRun, targetFY } = {}) {
  const ent = countyByKey(key);
  if (!ent) {
    throw new Error(
      `'${key}' is not one of Hawaii's four county governments. `
      + 'Kalawao has no government and the Department of Water is a component unit.',
    );
  }
  const skip = new Set(GAPS[key]?.[mode] ?? []);
  const isHonolulu = key === 'honolulu';
  return {
    entityLabel: ent.name,
    muniName: ent.name,
    entityType: ent.entityType,
    state: ent.state,
    pdfDir: `docs/HiCounties/${key}`,
    filePattern: new RegExp(`^${key}-(\\d{4})-acfr\\.pdf$`, 'i'),
    extractScript: isHonolulu ? 'scripts/extractHonoluluCoords.py' : 'scripts/extractHiCounty.py',
    extractArgs: isHonolulu ? [] : ['--entity', key],
    datasetIdPrefix: `${key}-acfr-gf`,
    // ⚠ The citable FAC endpoint. The counties' own finance pages were
    // measured on 2026-10-29 and NONE of them passes "a reader can click it
    // and see this data": Honolulu's answered only after 30.7s and names three
    // fiscal years, Maui's never mentions an ACFR, and Hawaii County's and
    // Kaua'i's return 403. Each ROW's `source_url` is the per-year permalink
    // the fetcher recorded in the manifest.
    baseUrl: FAC_PDF_BASE,
    fys: fysFor(key).filter((fy) => !skip.has(fy)),
    // ⚠ All four close June 30, asserted per filing by the fetcher.
    fyEndMonthDay: '06-30',
    fiscalYearStartMonth: 7,
    // ⚠ Left unset deliberately: the shared $20,000/capita ceiling is the ONLY
    // guard that can catch a wrong `units`, and Honolulu's statement is in
    // THOUSANDS while the other three are whole dollars.
    perCapitaMax: undefined,
    // ⚠⚠ HONOLULU ONLY. It is the one county here printing three tiers —
    // `Current:` > `Miscellaneous:` > {Retirement and health benefits, Other}
    // — and the RPC shape holds two. `toBudgetTree` REFUSES a third level
    // rather than dropping it silently, which is how this surfaced.
    //
    // Opting in keeps both spending lines (353,239 and 145,829 thousand on
    // FY2025) and loses only the `Miscellaneous` heading, which carries no
    // figure of its own; the loader then proves the projection arithmetically.
    // ⚠ The REVENUE side needs nothing: its `Miscellaneous` group sits
    // directly under the root, which is two levels.
    //
    // Left unset for the other three so a third level appearing by accident
    // still fails loudly. See `flattenToBudgetTree` in scripts/lib/acfrGfLoad.mjs.
    flattenThirdLevel: isHonolulu,
    seedScript: 'scripts/seedHiCounties.mjs',
    fetchScript: 'scripts/fetchHiCounties.mjs',
    dryRun,
    mode,
    targetFY,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      entity: { type: 'string' },
      mode: { type: 'string' },
      fy: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const chosen = values.entity
    ? HI_COUNTIES.filter((c) => c.key === values.entity)
    : [...HI_COUNTIES];
  if (!chosen.length) {
    console.error(`No Hawaii county matched ${values.entity}`);
    process.exit(1);
  }

  let total = 0;
  for (const ent of chosen) {
    // ⚠ The two modes have DIFFERENT year lists for Hawaii County (FY2019
    // revenue is a gap, FY2019 operating is not), so each mode runs with its
    // own window rather than one shared `fys`.
    for (const mode of (values.mode ? [values.mode] : ['revenue', 'operating'])) {
      const cfg = runConfigFor(ent.key, {
        mode,
        dryRun: values['dry-run'],
        targetFY: values.fy ? Number(values.fy) : undefined,
      });
      if (!cfg.fys.length) continue;
      total += Number(await run(cfg)) || 0;
    }
  }

  console.log(`\nHawaii counties: ${total} budgets row(s) loaded across ${chosen.length} entit(y/ies).`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
