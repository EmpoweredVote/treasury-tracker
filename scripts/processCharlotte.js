#!/usr/bin/env node
/**
 * City of Charlotte, NC — General Fund ACFR load (GAAP actuals).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the five guards
 * and the source-safe RPC write path.
 *
 * WINDOW: FY2011–FY2025, fifteen years, 30 rows. Every year ties $0 against the
 * issuer's own printed total.
 *
 * ⚠⚠ AMOUNTS ARE PRINTED IN THOUSANDS (units=1000).
 * Every statement page is captioned "(Dollar Amounts in Thousands)" — verified
 * on the FY2023 balance sheet (p50), the governmental-funds statement (p52) and
 * the notes (p71, p80). The tie gate structurally CANNOT confirm this: it
 * compares a computed sum against a printed total read through the SAME
 * multiplier, so it is $0 whether or not the scaling is right. The per-capita
 * guard in the shared loader is the only check that can catch it. At FY2025 the
 * true figure is roughly $860/capita on a population of 943,476; a 1000x slip
 * lands near $860,000/capita and is rejected.
 *
 * ⚠ MECKLENBURG COUNTY, LOADED IN THE SAME MILESTONE, PRINTS WHOLE DOLLARS.
 * Two entities, one session, opposite units — the Austin/Travis shape, and the
 * reason `units` is declared per entity and never carried across.
 *
 * READER: the COORDINATE reader, `scripts/extractCharlotteCoords.py`. Chosen on
 * a diagnosed mechanical failure of `-table`, not because a year happened to
 * tie: this city's text layer emits the LABEL column and the NUMERIC columns as
 * separate blocks, so every line-based reader pairs each label with the value of
 * the row BELOW it. ⚠ That permutation ties at exactly $0 — it neither adds nor
 * removes a figure, so the component multiset, the sum and the printed-total
 * check are all unmoved while every category carries its neighbour's money.
 *
 * ⚠ THE `-table` READER CANNOT CORROBORATE THIS ENTITY. For Durham County and
 * Asheville the second reader cross-checks every year it can read. Here it does
 * not merely fail — it reads the page confidently and WRONGLY. The independent
 * oracle is therefore the issuer's own printed total on the statement (spec
 * §5.2), which the extractor compares against a sum it computed separately.
 *
 * ⚠ WRAPPED LABELS. The city wraps long function names onto a second, DEEPER
 * line and prints the money there. Without `weld='indent'` the published
 * categories were literally `management` ($25,584k) and `development`
 * ($36,701k) — with the tie still at exactly $0. See
 * `scripts/acfrGfComponents.py`.
 *
 * ⚠ FY2010 AND EARLIER ARE NOT LOADED. They were published on the retired
 * `charmeck.org` host, which now 301s to `charlottenc.gov` with the files gone,
 * so they survive only in the Internet Archive. Under the first-party
 * `source_url` policy set 2026-08-25 for City of Durham FY2004–FY2006 they stay
 * out. The FAC census independently records Charlotte as audited from FY2000, so
 * this is an ACCESS gap, not an absence.
 *
 * ⚠ THE HOST REJECTS EVERY NON-BROWSER CLIENT. `curl` and PowerShell both get an
 * Akamai `403 Access Denied` on the HTML page and on the PDFs alike; a real
 * Chromium passes unchanged. The WAF fingerprints the client, not the request.
 *
 * Usage:
 *   node scripts/processCharlotte.js --dry-run
 *   node scripts/processCharlotte.js
 */

import { run } from './lib/acfrGfLoad.mjs';

const FYS = Array.from({ length: 15 }, (_, i) => 2011 + i);

run({
  entityLabel: 'City of Charlotte',
  muniName: 'Charlotte',
  entityType: 'city',
  pdfDir: 'docs/Charlotte',
  filePattern: /^charlotte_fy(\d{4})\.pdf$/i,
  extractScript: 'scripts/extractCharlotteCoords.py',
  datasetIdPrefix: 'charlotte-acfr-gf',
  baseUrl: 'https://www.charlottenc.gov/City-Government/Departments/Finance/Publications',
  fys: FYS,
  state: 'NC',
  // July 1 – June 30, the statutory fiscal year for every North Carolina local
  // unit (N.C.G.S. 159-8(b)), and independently confirmed for this entity by the
  // FAC census (`NC,Charlotte,municipality,annual,7,,2000-2025`).
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedNorthCarolina.mjs',
  fetchScript: 'scripts/fetchCharlotteMecklenburg.mjs',
});
