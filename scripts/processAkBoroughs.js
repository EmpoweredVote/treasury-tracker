#!/usr/bin/env node
/**
 * Alaska's organized boroughs — General Fund operating + revenue,
 * FY2016–FY2025, ACTUAL (ACFR GAAP basis).
 *
 * ⚠⚠ ALWAYS PASS `--entity`. Running this bare re-loads every borough, and a
 * re-load is NOT free: `acfrGfLoad.loadFiscalYear` deletes and re-writes the
 * (municipality, fiscal_year, dataset_type) rows, so already-loaded rows come
 * back under NEW `budgets.id`s and the id-keyed frozen-figure registry goes
 * stale for exactly the rows re-run. Wave 1 was loaded six `--entity` runs at a
 * time for that reason.
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, run once per borough. That
 * module carries the write path and the guards (tie gate — now including the
 * exact source-rounding registry — fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * Extends the `ak-local-acfr-gf` family opened by the Municipality of
 * Anchorage. The AK STATE node belongs to `state-acfr-gf` and is untouched.
 *
 * ── THE COHORT — TWELVE BOROUGHS IN TWO WAVES ─────────────────────────────
 *
 *   #299, the six LARGEST:
 *   Matanuska-Susitna Borough     county   117,613
 *   Fairbanks North Star Borough  county    94,951
 *   Kenai Peninsula Borough       county    61,259
 *   City and Borough of Juneau    city      31,572   ⚠ UNIFIED, see below
 *   Ketchikan Gateway Borough     county    13,677
 *   Kodiak Island Borough         county    12,654
 *
 *   WAVE 1 (2026-10-28), the six with full, clean, born-digital coverage:
 *   North Slope Borough           county    10,663   ⚠ raised per-capita ceiling
 *   City and Borough of Sitka     city       8,355   ⚠ UNIFIED
 *   Northwest Arctic Borough      county     7,134   ⚠ three-level tree
 *   Aleutians East Borough        county     3,632   ⚠ 8 filings, not 10
 *   Petersburg Borough            county     3,436   ⚠ NOT unified — see below
 *   City and Borough of Wrangell  city       2,064   ⚠ UNIFIED
 *
 * ⚠ PETERSBURG LOOKS UNIFIED AND IS NOT. The City of Petersburg dissolved into
 * the borough in 2013, so its seat is unincorporated today and the name reads
 * like Sitka's — but Kupreanof city (pop 19) is a separate incorporated
 * government inside it, which the census test shows and a name-based guess
 * would have buried. Evidence: `scripts/lib/akBoroughSources.mjs`.
 *
 * An Alaska borough is a COUNTY-EQUIVALENT (census SUMLEV 050), hence `county`
 * — never `borough`, which in TT means the 949 Pennsylvania boroughs, a
 * city-like unit beneath a county. Juneau is a consolidated city-borough and is
 * `city`, proved by its population being identical at SUMLEV 050/162/157.
 * Modelling and evidence: `scripts/seedAkBoroughs.mjs`.
 *
 * ── ⚠ ALL TWELVE END JUNE 30 — ANCHORAGE DOES NOT ────────────────────────
 *
 * `fiscalYearStartMonth: 7`, confirmed by `fy_end_date` on all 118 FAC filings.
 * Anchorage, in this same family, closes DECEMBER 31 (month 1). Two fiscal
 * calendars inside one family; `assertConfig` cross-checks the month against
 * the year end so a carried-over value fails at startup.
 *
 * ── 113 OF 120 EXTRACTIONS LOAD; SEVEN ARE DECLARED GAPS ─────────────────
 *
 * 103 tie at exactly $0. Ten Fairbanks entity-year-modes carry an EXACT
 * registered source-rounding delta of $1–$2, where that borough's own printed
 * total disagrees with the sum of its own printed components — and its own
 * `Excess (deficiency)` row sides with the components. See
 * `scripts/extractAkBorough.py`.
 *
 * Seven are document gaps, declared in KNOWN_DOCUMENT_GAPS with their cause and
 * NEVER written as $0:
 *   Mat-Su FY2022, FY2023 (both modes) — the column grid collapses, so rows
 *     whose General Fund cell is a dash take a later fund's figure. ⚠ Verified
 *     identical in the borough's OWN matsugov.us copies, so the damage is in
 *     the document as issued, not in the FAC copy.
 *   Fairbanks FY2018 revenue — the `Revenues` header line absorbs the first
 *     data row's value; the expenditure side of the same page loads.
 *   Fairbanks FY2019 (both modes) — label and numeric columns occupy separate
 *     text blocks, so no page yields a parseable statement.
 *
 * ── WAVE 1 — 114 OF 114 EXTRACTIONS LOAD, ALL TYING AT EXACTLY $0 ────────
 *
 * 57 entity-years x 2 modes, no source-rounding exceptions and no mode-level
 * gaps. Two absences, and they are different kinds of absence:
 *
 *   SITKA FY2018 is a DOCUMENT GAP — a ciphered text layer that extracts ~1,900
 *     chars/page of wrong characters on all 177 pages. The fetcher's density
 *     guard PASSES it; its auditee-identity guard is what rejected it, so no
 *     PDF exists on disk. Cause and the second-publisher check (the borough's
 *     own copy is behind an Akamai WAF) are in `scripts/extractAkBorough.py`.
 *   ALEUTIANS EAST FY2017 and FY2018 are NOT gaps — the Federal Audit
 *     Clearinghouse holds no filing for those years, because a single audit is
 *     filed only in a year the auditee spends enough federal money to require
 *     one. A year with no document is a coverage limit, not a failed read.
 *
 * Usage:
 *   node scripts/fetchAkBoroughs.mjs      # first — downloads + manifests
 *   node scripts/seedAkBoroughs.mjs       # then  — creates the six entities
 *   node scripts/processAkBoroughs.js --dry-run
 *   node scripts/processAkBoroughs.js --entity kodiak --dry-run
 *   node scripts/processAkBoroughs.js
 */

import { parseArgs } from 'node:util';
import { run } from './lib/acfrGfLoad.mjs';
import { AK_BOROUGHS, fysFor } from './lib/akBoroughSources.mjs';

/**
 * Entity-years that must not be attempted, by mode. Mirrors
 * `KNOWN_DOCUMENT_GAPS` in `scripts/extractAkBorough.py`, which carries the
 * CAUSE for each. Listed here too so the loader never invokes an extractor it
 * knows will fail — a refusal and a declared gap must not look alike in a log.
 */
const GAPS = {
  matsu: { revenue: [2022, 2023], operating: [2022, 2023] },
  fnsb: { revenue: [2018, 2019], operating: [2019] },
  // ⚠ Sitka FY2018 is a CIPHERED TEXT LAYER, not a scan and not a bad fetch —
  // all 177 pages extract as wrong characters at a healthy ~1,900 chars/page.
  // `fetchAkBoroughs.mjs` rejected it on the auditee-identity guard, so no PDF
  // exists on disk for that year; this entry keeps the loader from reporting a
  // missing file as a failure. Cause and the second-publisher check are in
  // `scripts/extractAkBorough.py`'s KNOWN_DOCUMENT_GAPS.
  sitka: { revenue: [2018], operating: [2018] },
};

const { values } = parseArgs({
  options: {
    entity: { type: 'string' },
    fy: { type: 'string' },
    mode: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: false,
});

const chosen = values.entity
  ? AK_BOROUGHS.filter((b) => b.key === values.entity)
  : [...AK_BOROUGHS];
if (!chosen.length) {
  console.error(`No borough matched ${values.entity}`);
  process.exit(1);
}

let total = 0;
for (const ent of chosen) {
  const gaps = GAPS[ent.key] ?? {};
  // ⚠ The two modes have DIFFERENT year lists for Fairbanks (FY2018 revenue is
  // a gap, FY2018 operating is not), so each mode is run with its own window
  // rather than one shared `fys`.
  for (const mode of (values.mode ? [values.mode] : ['revenue', 'operating'])) {
    const skip = new Set(gaps[mode] ?? []);
    const fys = fysFor(ent.key).filter((fy) => !skip.has(fy));
    if (!fys.length) continue;
    const loaded = await run({
      entityLabel: ent.name,
      muniName: ent.name,
      entityType: ent.entityType,
      state: ent.state,
      pdfDir: `docs/AkBoroughs/${ent.key}`,
      filePattern: new RegExp(`^${ent.key}-(\\d{4})-acfr\\.pdf$`, 'i'),
      extractScript: 'scripts/extractAkBorough.py',
      /** One extractor serves all six; the key selects this borough's config. */
      extractArgs: ['--entity', ent.key],
      datasetIdPrefix: `${ent.key}-acfr-gf`,
      baseUrl: ent.sourcePage,
      fys,
      // ⚠ All six close June 30. Anchorage, same family, closes December 31.
      fyEndMonthDay: '06-30',
      fiscalYearStartMonth: 7,
      // ⚠ Set only for North Slope, whose General Fund is funded by the
      // Prudhoe Bay oil and gas tax base rather than by its 10,663 residents.
      // `undefined` keeps the shared $20,000/capita units ceiling, and
      // `perCapitaMaxFor` refuses any override that would narrow it.
      perCapitaMax: ent.perCapitaMax,
      // ⚠ Northwest Arctic ONLY. It is the one borough here printing three
      // tiers (`Current:` > `Education:` > `Payments to School District`), and
      // the RPC shape holds two. Opting in keeps the spending lines and loses
      // only the `Education` heading, which carries no figure of its own; the
      // loader then proves the projection arithmetically. Left unset
      // everywhere else so a third level that appears by accident still fails
      // loudly. See `flattenToBudgetTree` in scripts/lib/acfrGfLoad.mjs.
      flattenThirdLevel: ent.key === 'nwarctic',
      seedScript: 'scripts/seedAkBoroughs.mjs',
      fetchScript: 'scripts/fetchAkBoroughs.mjs',
      dryRun: values['dry-run'],
      mode,
      targetFY: values.fy ? Number(values.fy) : undefined,
    });
    total += Number(loaded) || 0;
  }
}

console.log(`\nAlaska boroughs: ${total} budgets row(s) loaded across ${chosen.length} entit(y/ies).`);
