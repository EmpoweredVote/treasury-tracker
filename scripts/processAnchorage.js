#!/usr/bin/env node
/**
 * Municipality of Anchorage, AK — General Fund operating (expenditure-by-
 * function) + revenue (revenue-by-source), FY2012–FY2024, ACTUAL (ACFR GAAP
 * basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units guard,
 * sanity ceiling, idempotence).
 *
 * ALASKA'S FIRST LOCAL GOVERNMENT IN TT. The AK STATE node (FY2006-2025,
 * `processAKAcfr.js`) already exists and nothing here touches it.
 *
 * ── ⚠⚠ ANCHORAGE IS ALSO THE COUNTY ───────────────────────────────────────
 *
 * A unified home-rule municipality: city and borough consolidated into ONE
 * government. There is no separate borough entity, and `county_id` is null
 * because Anchorage IS the county-equivalent. The census proves it — its 2024
 * estimate is identical at SUMLEV 050, 162 and 157 (289,600). Modelling and
 * evidence: `scripts/seedAnchorage.mjs`.
 *
 * ── FY WINDOW: FY2012–FY2024, THIRTEEN YEARS, 26 ROWS ─────────────────────
 *
 * Every year ties at exactly $0 in BOTH modes against the printed General Fund
 * column. muni.org publishes back to FY2001 and ELEVEN years are not loaded,
 * for one proven reason:
 *
 *   FY2001–FY2011 — IMAGE-ONLY SCANS. 1–48 chars/page against 2,482–2,805 for
 *     FY2012+. The break falls exactly where muni.org switches from four
 *     section PDFs per year to one complete report, so it is an ERA rather
 *     than a few bad uploads — the same shape as Colorado Springs FY1999–2011.
 *
 *     There is no text layer to parse, so this is an upstream publishing fact
 *     rather than an extraction failure, and no config value reaches it.
 *     Recovering the era needs OCR, which is a decision about introducing a
 *     transcription step into a provenance chain that is currently byte-exact —
 *     deliberately out of scope rather than quietly attempted. Declared in
 *     `scripts/lib/akAcfrSources.mjs` and reported by the fetcher. NEVER $0.
 *
 * ── ⚠ FISCAL YEAR: CALENDAR. THE STATE'S IS NOT ───────────────────────────
 *
 * Anchorage closes December 31 (month 1). The State of Alaska closes JUNE 30
 * (month 7). Two fiscal calendars inside one state; `assertConfig` cross-checks
 * `fyEndMonthDay` against `fiscalYearStartMonth` so a carried-over month fails
 * at startup rather than mislabelling the period of every row.
 *
 * ── UNITS: WHOLE DOLLARS (units=1) ────────────────────────────────────────
 *
 * No statement page carries an "in thousands" caption. ⚠ Read per entity, never
 * carried: the AK STATE loader in this same repo is in THOUSANDS. The tie gate
 * is structurally blind to a units error, so the per-capita guard is what holds
 * it: FY2024 General Fund revenue is ~$2,774/capita.
 *
 * ⚠ That per-capita figure is HIGH for a "city" because a unified municipality
 * carries borough-level services — notably the ~$263M Education line a
 * non-consolidated city would never show in its General Fund. The government is
 * unusual; the figure is not wrong.
 *
 * ── ⚠ THE STATEMENT'S SHAPE CHANGES TWICE, AND BOTH ARE THE ISSUER'S ──────
 *
 *   FY2012–FY2016  the nine functions sit at ROOT level; there is NO "Current:"
 *                  heading. Only "Debt service:" is a parent.
 *   FY2017+        Anchorage introduces "Current:" and nests the functions.
 *   FY2022 / FY2023  GASB 87 (leases) and GASB 96 (SBITAs) each add their own
 *                  "Debt service - ..." and "Capital outlay - ..." rows.
 *
 * Verified against the printed pages, not inferred from the root counts. Loaded
 * as published — normalising the two eras into one shape would be inferring
 * intent the issuer did not express.
 *
 * ── CONTINUITY: ONE ≥20% MOVE, EXPLAINED BY THE ISSUER ────────────────────
 *
 * FY2021 General Fund expenditures jump to $847.3M from $703.8M (+20.4%) and
 * fall back to $769.1M in FY2022. The MD&A attributes it to federal pandemic
 * relief flowing through the General Fund (CARES, ARPA and ERA), concentrated
 * in Health and Human Services and Economic and Community Development.
 *
 * ⭐ The same MD&A confirms the extraction for free: it states Education
 * "increased $23.5 million, or 8.7 percent" to $293.4M, and the extracted
 * figures are $269,915,069 -> $293,429,596, a $23,514,527 (+8.7%) increase.
 * Both years checked by one narrative sentence.
 *
 * ⚠ The MD&A's Police/Fire figures move the OPPOSITE way to the General Fund's
 * because that passage describes GOVERNMENT-WIDE governmental activities, which
 * consolidate every fund. Money that sat in a pandemic grant fund in FY2020 and
 * in the General Fund in FY2021 moves both series in opposite directions
 * legitimately. The GF column was re-read off the printed page to confirm.
 *
 * Usage:
 *   node scripts/fetchAnchorage.mjs           # first — downloads + manifest
 *   node scripts/seedAnchorage.mjs            # then  — creates the entity
 *   node scripts/processAnchorage.js --dry-run
 *   node scripts/processAnchorage.js --mode revenue --fy 2024
 *   node scripts/processAnchorage.js
 */

import { run } from './lib/acfrGfLoad.mjs';
import { ANCHORAGE_FYS, ANCHORAGE_PAGE } from './lib/akAcfrSources.mjs';

await run({
  entityLabel: 'Municipality of Anchorage',
  muniName: 'Municipality of Anchorage',
  entityType: 'city',
  state: 'AK',
  pdfDir: 'docs/Anchorage',
  filePattern: /^anchorage-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractAnchorageAK.py',
  datasetIdPrefix: 'anchorage-acfr-gf',
  baseUrl: ANCHORAGE_PAGE,
  fys: [...ANCHORAGE_FYS],
  // CALENDAR fiscal year — January 1 to December 31. ⚠ The AK STATE node is
  // July-June (month 7); carrying that here would stamp a June period end on
  // every Anchorage row without changing a single dollar figure.
  fyEndMonthDay: '12-31',
  fiscalYearStartMonth: 1,
  seedScript: 'scripts/seedAnchorage.mjs',
  fetchScript: 'scripts/fetchAnchorage.mjs',
});
