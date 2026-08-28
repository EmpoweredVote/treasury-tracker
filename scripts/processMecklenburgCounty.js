#!/usr/bin/env node
/**
 * Mecklenburg County, NC — General Fund ACFR load (GAAP actuals).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the five guards
 * and the source-safe RPC write path.
 *
 * WINDOW: FY2005–FY2025, twenty-one years UNBROKEN, 42 rows. Every year ties $0
 * against the issuer's own printed total.
 *
 * AMOUNTS ARE IN WHOLE DOLLARS (units=1). The county prints full figures
 * ("1,303,781,250"), with no "in thousands" caption on any statement page.
 * ⚠ THE CITY OF CHARLOTTE, LOADED IN THE SAME MILESTONE, PRINTS IN THOUSANDS.
 * The tie gate cannot tell the two apart — it reads the printed total through
 * the same multiplier as the components — so `units` is declared per entity and
 * checked by the loader's per-capita guard. At FY2025 the true figure is roughly
 * $1,300/capita on a population of 1,206,285.
 *
 * READER: the COORDINATE reader, `scripts/extractMecklenburgCoords.py`, on the
 * same diagnosed defect as the City of Charlotte — the text layer emits the
 * LABEL column and the NUMERIC columns as separate blocks, so a line-based
 * reader pairs each label with the row below it. ⚠ That permutation ties at
 * exactly $0 while every category carries its neighbour's money, and the
 * `-table` reader therefore cannot CORROBORATE this entity: it reads the page
 * confidently and wrongly. The independent oracle is the issuer's printed total
 * (spec §5.2).
 *
 * ⚠ THE BUDGETARY DECOY. The county prints a second General Fund statement on
 * the BUDGETARY basis (FY2023 pages 56–58) immediately after the GAAP
 * governmental-funds statement on page 54. `_EXCLUDE` already disqualifies a
 * budgetary page, so no `exclude_ignore` is set; the GAAP statement is the one
 * read.
 *
 * ⚠ TWO READER DEFECTS WERE FOUND ON THIS ENTITY, both fixed in the shared
 * modules and both documented there:
 *   * FY2024/FY2025 carry a GHOST TEXT RUN — the notes sentence redrawn at
 *     0.10pt on top of the REVENUES banner. Only the revenue side failed, so it
 *     looked like a county quirk rather than a reader bug.
 *   * FY2005–FY2011 print `Current` ~2pt deeper than its own sibling headings,
 *     so the entity declares `indent_tol=4.0` against a measured root spread of
 *     1.82–2.90pt and a root→child gap of 3.67–4.08pt.
 *
 * ⚠ THE EXPENDITURE STRUCTURE CHANGES TWICE, and both changes are REAL — checked
 * rather than assumed, because "a category vanished and the tie still passed" is
 * exactly the shape a mis-parse takes:
 *
 *   FY2005–FY2011   2 categories / 10 items — `Current` (8 functions) plus
 *                   `Debt Service` (Principal, Interest).
 *   FY2012–FY2016   1 category / 8 items — the `Debt Service` parent is DROPPED
 *                   because every one of its children is $0 in the General Fund.
 *   FY2017–FY2025   8 categories / 8 items — the county stops printing a
 *                   `Current` group heading and sets the eight functions as
 *                   root-level peers. Typography, not accounting.
 *
 * The FY2011→FY2012 break is CONFIRMED ARITHMETICALLY, not inferred: General
 * Fund expenditure falls $1,203.8M → $961.6M, a drop of ~$242M, and the debt
 * service the county charged to the General Fund immediately before that was of
 * exactly that size (FY2007: Principal $135.5M + Interest $87.0M = $222.5M). The
 * county moved debt service into a separate Debt Service Fund; the money did not
 * go missing. The shared extractor drops a childless parent rather than
 * publishing an empty node, which is why the COUNT changes rather than a $0
 * category appearing — the same honest structural absence documented for City of
 * Durham FY2016–FY2021.
 *
 * ⚠ THE PUBLISHER HAS NO DURABLE DIRECT-FILE URL — a provenance shape new to TT.
 * Reports live in an Acquia/Widen DAM that serves bytes only from signed,
 * expiring `orders-bb.us-east-1.widencdn.net` links; every public Widen content
 * pattern 404s. The stable first-party citation is the PORTAL ASSET PAGE,
 * `…/portals/y6kaiqln/FinancialReports/asset/<uuid>`, which is what the manifest
 * records and what is stamped onto every row — the same choice made for
 * Asheville's Google Drive viewer URLs.
 *
 * ⚠ THE CONFUSABLE NEIGHBOUR IS CHARLOTTE-MECKLENBURG SCHOOLS, whose ACFR names
 * BOTH entities in this milestone. It is rejected on positive evidence of
 * authorship (no county governing-body marker; `SUPERINTENDENT` present), the
 * guard shape the Buncombe County impostor forced.
 *
 * Usage:
 *   node scripts/processMecklenburgCounty.js --dry-run
 *   node scripts/processMecklenburgCounty.js
 */

import { run } from './lib/acfrGfLoad.mjs';

const FYS = Array.from({ length: 21 }, (_, i) => 2005 + i);

run({
  entityLabel: 'Mecklenburg County',
  muniName: 'Mecklenburg County',
  entityType: 'county',
  pdfDir: 'docs/MecklenburgCounty',
  filePattern: /^mecklenburg_fy(\d{4})\.pdf$/i,
  extractScript: 'scripts/extractMecklenburgCoords.py',
  datasetIdPrefix: 'mecklenburg-county-acfr-gf',
  baseUrl: 'https://mecknc.widencollective.com/portals/y6kaiqln/FinancialReports',
  fys: FYS,
  state: 'NC',
  // July 1 – June 30, the statutory fiscal year for every North Carolina local
  // unit (N.C.G.S. 159-8(b)), independently confirmed by the FAC census
  // (`NC,Mecklenburg County,county,annual,7,,1998-2000 2002-2025`).
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedNorthCarolina.mjs',
  fetchScript: 'scripts/fetchCharlotteMecklenburg.mjs',
});
