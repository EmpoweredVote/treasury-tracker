/**
 * North Carolina ACFR source manifests — City of Durham, Durham County,
 * City of Asheville, Buncombe County.
 *
 * NO SHEBANG — library module under scripts/lib/ (`tests/ncAcfrSources.test.mjs`
 * imports it, and `tests/waSao.test.mjs` forbids a test from importing any
 * module that starts with a shebang: a CRLF checkout turns the interpreter
 * line into an unresolvable path).
 *
 * Four entities, four completely different retrieval problems. Nothing here is
 * pattern-generated except where a pattern was PROVEN by probing every year in
 * the range; the irregular years are transcribed from the issuer's own index
 * page, because every one of these hosts drifts its filenames.
 *
 * ── THE DECOY PROBLEM IS THE THEME OF THIS MILESTONE ────────────────────────
 * All four issuers publish a SECOND, shorter annual document alongside the
 * ACFR, and on three of the four hosts it sorts adjacent to the real one:
 *
 *   City of Durham    "Citizens Financial Report"  (…/citizens_fin_report16-tg)
 *                     "Durham Financial Report"    (…/2019-20-Durham-Financial-Report-web)
 *   Durham County     "Popular Annual Financial Report"
 *                     ⚠ and FY2020's REAL ACFR is itself named
 *                       `FY-2020-Financial-Report.pdf` — the decoy naming
 *                       convention applied to the genuine article, so a
 *                       name-based filter would drop a good year.
 *   Asheville         FY2021 ships TWO Drive links; one is the single-audit
 *                     "Compliance Audit", not the ACFR.
 *   Buncombe          DocumentCenter 6519 is the FY2019 PAFR, sitting between
 *                     6518 (FY2018 ACFR) and 6520 (FY2019 ACFR).
 *
 * A PAFR is 20-40 glossy pages and contains no fund statements, so the
 * fetcher's page-count floor plus the extractor's statement-anchor search
 * reject it — but only because the URLs below never point at one. The lesson
 * from FY2020 Durham County is that the FILENAME CANNOT BE THE FILTER; the
 * document's own content has to be.
 *
 * ── FISCAL CALENDAR ─────────────────────────────────────────────────────────
 * N.C.G.S. 159-8(b) fixes the fiscal year for EVERY NC local unit at July 1 -
 * June 30. All four entities therefore load with `fiscalYearStartMonth = 7`
 * and `fyEndMonthDay = '06-30'`, matching the North Carolina state node
 * already in `treasury.budgets`. Unlike CO-SPRINGS-EPC-01 there is no
 * calendar-year surprise here, but the values are still passed explicitly to
 * `acfrGfLoad.mjs`, which asserts them rather than defaulting.
 */

// -- City of Durham ----------------------------------------------------------
/**
 * `{ fiscal_year: 'DocumentCenter id/slug' }`, transcribed from the hrefs on
 * the city's "Previous City of Durham Financial Reports" index.
 *
 * The numeric id is the only part that resolves; the trailing slug is
 * decorative and the host ignores it. Ids are NOT ordered by fiscal year —
 * FY2010-FY2016 were re-uploaded together in 2020 as a `-tg` batch (34271-
 * 34277) and so carry HIGHER ids than FY2017 (17688) and FY2018 (24584). Any
 * scheme that inferred a year from an id would mis-assign seven years.
 *
 * FY2025 is absent: as of 2026-08-24 the city has published its FY2025
 * Citizens Financial Report but not its FY2025 ACFR.
 */
export const DURHAM_CITY_DOCS = {
  2009: '4379/Comprehensive-Annual-Financial-Report-2009-PDF',
  2010: '34271/cafr_10-tg',
  2011: '34272/cafr_11-tg',
  2012: '34273/cafr_12-tg',
  2013: '34274/cafr_13-tg',
  2014: '34275/cafr_14-tg',
  2015: '34276/cafr_15-tg',
  2016: '34277/cafr_16-tg',
  2017: '17688/CITY-OF-DURHAM-FY17-CAFR-for-website-112717',
  2018: '24584/CITY-OF-DURHAM-FY18-CAFR---Web-version',
  2019: '31196/cafr_19',
  2020: '34825/CITY-OF-DURHAM-FY20-CAFR---FINAL',
  2021: '41639/CITY-OF-DURHAM-FY21-ACFRrev2',
  2022: '47665/Annual-Comprehensive-Financial-Report-2022',
  2023: '53931/CITY-OF-DURHAM-FY23-ACFR---FINAL',
  2024: '64607/CITY-OF-DURHAM-FY24-ACFR---FINAL',
};

export const DURHAM_CITY_FYS = Object.keys(DURHAM_CITY_DOCS).map(Number).sort((a, b) => a - b);

/**
 * The bare `/DocumentCenter/View/<id>` form is what actually serves the bytes;
 * the slug is appended so the recorded `source_url` matches the published link
 * a reader would click.
 */
export function durhamCityUrls(fy) {
  const doc = DURHAM_CITY_DOCS[fy];
  if (!doc) return [];
  const id = doc.split('/')[0];
  return [
    `https://www.durhamnc.gov/DocumentCenter/View/${doc}`,
    `https://www.durhamnc.gov/DocumentCenter/View/${id}`,
  ];
}

// -- Durham County -----------------------------------------------------------
/**
 * `{ fiscal_year: path under dconc.gov }`, transcribed from the county's
 * "Financial Reports" index. Five naming conventions in twenty-one years:
 *
 *   FY2005-FY2013, FY2015-FY2018  Fiscal-Year-Ending-June-<YYYY>.pdf
 *   FY2014                        Durham-County-CAFR---2014.pdf   (triple hyphen)
 *   FY2019                        FY19-Durham-County-CAFR.pdf     (two-digit year)
 *   FY2020                        FY-2020-Financial-Report.pdf    (⚠ see below)
 *   FY2021-FY2025                 five mutually different shapes
 *
 * ⚠ FY2014 breaks the otherwise-unbroken FY2005-FY2018 run: there is no
 * `Fiscal-Year-Ending-June-2014.pdf`. Generating the range would 404 on
 * exactly one year and quietly leave a hole in the series.
 *
 * ⚠ FY2020's ACFR is published under the same "Financial Report" wording the
 * county uses for its Popular Annual Financial Report. It is the real ACFR —
 * confirmed by page count and by the presence of the fund statements — which
 * is precisely why this module refuses to filter on filenames.
 *
 * ⚠ FY2025 lives under `/Archive/` and the county MISSPELLED ITS OWN NAME in
 * the filename: `FY-2025-Duhram-County-…`. Corrected spelling 404s.
 */
export const DURHAM_COUNTY_FILES = {
  2005: 'Fiscal-Year-Ending-June-2005.pdf',
  2006: 'Fiscal-Year-Ending-June-2006.pdf',
  2007: 'Fiscal-Year-Ending-June-2007.pdf',
  2008: 'Fiscal-Year-Ending-June-2008.pdf',
  2009: 'Fiscal-Year-Ending-June-2009.pdf',
  2010: 'Fiscal-Year-Ending-June-2010.pdf',
  2011: 'Fiscal-Year-Ending-June-2011.pdf',
  2012: 'Fiscal-Year-Ending-June-2012.pdf',
  2013: 'Fiscal-Year-Ending-June-2013.pdf',
  2014: 'Durham-County-CAFR---2014.pdf',
  2015: 'Fiscal-Year-Ending-June-2015.pdf',
  2016: 'Fiscal-Year-Ending-June-2016.pdf',
  2017: 'Fiscal-Year-Ending-June-2017.pdf',
  2018: 'Fiscal-Year-Ending-June-2018.pdf',
  2019: 'FY19-Durham-County-CAFR.pdf',
  2020: 'FY-2020-Financial-Report.pdf',
  2021: 'FY21-Durham-County-North-Carolina-ACFR.pdf',
  2022: 'Durham-County-FY-2022-ACFR.pdf',
  2023: 'Durham-County-Annual-Comprehensive-Financial-Report-2023.pdf',
  2024: 'FY2024-Annual-Comprehensive-Financial-Report.pdf',
  2025: 'Archive/FY-2025-Duhram-County-Annual-Comprehensive-Financial-Report.pdf',
};

export const DURHAM_COUNTY_FYS = Object.keys(DURHAM_COUNTY_FILES).map(Number).sort((a, b) => a - b);

/**
 * Ordered candidate list: the transcribed path first, then the same file under
 * `/Archive/` (the county moves older reports there over time, and FY2025 is
 * already there while FY2024 is not — the boundary moves).
 */
export function durhamCountyUrls(fy) {
  const file = DURHAM_COUNTY_FILES[fy];
  if (!file) return [];
  const base = 'https://dconc.gov/Finance1/Documents/ACRF';
  const urls = [`${base}/${file}`];
  if (!file.startsWith('Archive/')) urls.push(`${base}/Archive/${file}`);
  else urls.push(`${base}/${file.replace('Archive/', '')}`);
  return urls;
}

// -- City of Asheville -------------------------------------------------------
/**
 * `{ fiscal_year: Google Drive file id }`. Asheville is the only one of the four
 * that publishes to Drive rather than to its own host, so there is no filename
 * to reason about at all — the id is the whole address and it is opaque.
 *
 * ⚠ FY2007-FY2020 ARE NOT ON THE CITY'S CURRENT PAGE. That page lists only
 * FY2021 onward, which is why NC-DURHAM-AVL-01 first shipped Asheville as a
 * five-year series. The earlier ids were recovered from WAYBACK SNAPSHOTS OF
 * THE CITY'S OWN PAGE — the 2019-08 snapshot lists FY2007-FY2018 and the
 * 2021-12 snapshot adds FY2019 and FY2020 — and every one of those Drive files
 * IS STILL LIVE. The city removed the links, not the documents.
 *
 * ⚠ SO THE BYTES ARE STILL FIRST-PARTY. The archive was used only to DISCOVER
 * the addresses; every file is fetched from the city's own Google Drive at load
 * time and `source_url` records that live URL, never a web.archive.org one.
 * Nothing here is served from an archive copy. (Had a file been gone from
 * Drive, the honest options were a Wayback-sourced row labelled as such, or no
 * row — not a silent archive fetch under a first-party URL.)
 *
 * ⚠ FY2019 uses Drive's OLD long-form id (`0B2t_…`), where every other year
 * uses the modern short form. Both resolve; a length or charset assumption
 * about Drive ids would drop exactly that one year.
 *
 * ⚠ The page carries an EXTRA Drive link for FY2021: the Uniform Guidance
 * single-audit "Compliance Audit", which names the same fiscal year and would
 * pass a naive year check. Only the ACFR id is recorded here; the compliance id
 * is listed in ASHEVILLE_REJECTED_IDS so the test can assert it never returns.
 */
export const ASHEVILLE_DRIVE_IDS = {
  // FY2009-FY2018 — transcribed from the 2019-08-23 Wayback snapshot of the
  // city's own ACFR page. Still live on Drive; only the LINKS were removed.
  2009: '12ZXmbgvTs_Frf58bMR41Jas6qRJ3I0Tm',
  2010: '12W9pYa1pWwimsPCVCaYNBQ7idMbY3XIK',
  2011: '12VqXONdpf54KNJ3MzHsEMb-W-jJeDQs2',
  2012: '11LWYubKb-zZdBSVCriFS78d_4lADS9xp',
  2014: '11IAoBtBRLTRLca0gKoYJsC5K7nbsR--6',
  2015: '11HzbAnLc4phtL_EU3XBlUtgouvx9s_ht',
  2016: '116mxNgtWoTbMLG78NvHwUjJsydb6c8qw',
  2017: '115zJHlCFw4f0f-nN_4uTpS5CCbOW2YbE',
  2018: '10wv1YNCnSx5bgNqyr_x-lGZHPtTOkGGh',
  // FY2021+ — currently published on the city's live ACFR page.
  2021: '18Nx9LLB9aiKRW7KmpAorpiq2Inuf__7_',
  2022: '1wKYxK1c81LfzXj6aLuNxTqm0Y_mr2hXs',
  2023: '1Ac9khivhKor4YjSpmDIg3c4o_Zji2Qbx',
  2024: '1pAvE04Ka-hMDMIwcD2Wagwwg1bHJkOtm',
  2025: '1TWc9sOMHvgy5aSbN3uo-V1vOF29ifzwm',
};

/**
 * Asheville years that EXIST but cannot be loaded, each with the reason
 * MEASURED rather than assumed. Recorded here so the gaps in the city's series
 * are auditable instead of looking like years nobody looked for.
 *
 * ⚠ FY2019 and FY2020 are a DIFFERENT KIND of gap from the rest of this
 * milestone: the documents were published and are now GONE. The Drive ids are
 * transcribed from the 2021-12 Wayback snapshot of the city's page and both
 * return HTTP 404 — the city deleted the files, not just the links. Every other
 * id from those snapshots still resolves, so this is deletion, not rot in the
 * archive. Recovering them needs the NC LGC, whose FY2019-FY2021 archive is a
 * JavaScript app with no file listing (its FY2022+ sibling is a Power Apps
 * portal behind `/_services/entity-grid-data.json`), or a request to the city.
 */
export const ASHEVILLE_EXCLUDED = {
  2007: 'IMAGE-ONLY SCAN — 292 characters of text in 183 pages',
  2008: 'IMAGE-ONLY SCAN — 172 characters of text in 172 pages',
  2013: 'HYBRID SCAN — only 18 of 240 pages carry text, and the fund statements '
      + 'are not among them; the auditor report page is born-digital, the '
      + 'statements are images',
  2019: 'DELETED FROM DRIVE — id 0B2t_Ch5LbY5eUXdxMHBDR18xX1lhTXFoZ3dMcEExMGNQaXFr returns HTTP 404',
  2020: 'DELETED FROM DRIVE — id 1H6OtnyAm1zIYknYf-aXADRidRfc3gGs3 returns HTTP 404',
};



/** The FY2021 single-audit report. Present on the page, never a source. */
export const ASHEVILLE_REJECTED_IDS = {
  '1TLDiS6utsZ1WspY1sojojD4ri7M9gNCP': 'FY2021 Compliance Audit (single audit, not the ACFR)',
};

export const ASHEVILLE_FYS = Object.keys(ASHEVILLE_DRIVE_IDS).map(Number).sort((a, b) => a - b);

/**
 * Drive's `/file/d/<id>/view` address is a viewer page, not the bytes — the
 * same class of trap as Colorado Springs' pdf.js shell, and it likewise
 * returns HTTP 200 with HTML. `uc?export=download` serves the file itself.
 *
 * For files above Drive's virus-scan threshold (~100MB) `uc` returns an HTML
 * interstitial instead; none of these five is close to that, and the
 * fetcher's `%PDF` guard rejects the interstitial if that ever changes.
 * `usercontent.google.com` is offered as a second candidate because it is the
 * host `uc` redirects to and it bypasses the interstitial directly.
 */
export function ashevilleUrls(fy) {
  const id = ASHEVILLE_DRIVE_IDS[fy];
  if (!id) return [];
  return [
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://drive.usercontent.google.com/download?id=${id}&export=download`,
  ];
}

/** The human-facing page for a year, recorded alongside the asset URL. */
export function ashevilleViewerUrl(fy) {
  const id = ASHEVILLE_DRIVE_IDS[fy];
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
}

// -- Buncombe County ---------------------------------------------------------
/**
 * Buncombe publishes the same reports twice, on two hosts with two unrelated
 * naming schemes, and NEITHER host is complete:
 *
 *   media.buncombenc.gov/common/finance/cafr/CAFR<yy>.pdf
 *       FY2008 and FY2011-FY2019 only. FY2005-07, FY2009-10 and FY2020+ 404.
 *       (Every two-digit year in 05-25 was probed; the gaps are real, not a
 *       naming variant — CAFR09/cafr09/CAFR2009/CAFR_09 all 404.)
 *
 *   media.buncombenc.gov/common/finance/financial-reports/<Y-1>-<Y>/…
 *       FY2020-FY2024. ⚠ The GFOA rename lands INSIDE this directory scheme:
 *       FY2020 is `comprehensive-annual-financial-report.pdf` and FY2021+ is
 *       `annual-comprehensive-financial-report.pdf`. One word order apart.
 *
 *   buncombenc.gov/DocumentCenter/View/<id>
 *       FY2015-FY2025, and the ONLY host carrying FY2025.
 *
 * So the county's series is FY2008 + FY2011-FY2025, assembled from all three.
 * Where two hosts carry the same year both are listed, which is a free
 * integrity check: FY2024 served 6,822,215 bytes from the media host and from
 * DocumentCenter id 6524 — byte-identical, so the two schemes agree.
 *
 * ⚠ DocumentCenter ids are labelled by SPAN ("2023-2024"), and that span's
 * SECOND year is the fiscal year. Reading the first would shift the entire
 * county series back by one year while every file still passed every guard.
 *
 * ⚠ id 6519 is the FY2019 PAFR and is deliberately absent; the FY2019 ACFR is
 * 6520. They are adjacent, and only one of them has fund statements.
 */
export const BUNCOMBE_DOC_IDS = {
  2015: '6515/2014-2015-Comprehensive-Financial-Annual-Report',
  2016: '6516/2015-2016-Comprehensive-Financial-Annual-Report',
  2017: '6517/2016-2017-Comprehensive-Financial-Annual-Report',
  2018: '6518/2017-2018-Comprehensive-Financial-Annual-Report',
  2019: '6520/2018-2019-Comprehensive-Financial-Annual-Report',
  2020: '6512/2019-2020-Comprehensive-Financial-Annual-Report',
  2021: '6522/2020-2021-Comprehensive-Financial-Annual-Report',
  2022: '6521/2021-2022-Comprehensive-Financial-Annual-Report',
  2023: '6523/2022-2023-Comprehensive-Financial-Annual-Report',
  2024: '6524/2023-2024-Comprehensive-Financial-Annual-Report',
  2025: '6705/2024-2025-Comprehensive-Financial-Annual-Report',
};

/** The FY2019 Popular Annual Financial Report. Adjacent id, never a source. */
export const BUNCOMBE_REJECTED_IDS = {
  '6519': 'FY2019 Popular Annual Financial Report (PAFR, no fund statements)',
};

/** Years the `CAFR<yy>.pdf` scheme serves — probed, not assumed. */
export const BUNCOMBE_LEGACY_FYS = [2008, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019];

export const BUNCOMBE_FYS = [...new Set([
  ...BUNCOMBE_LEGACY_FYS,
  ...Object.keys(BUNCOMBE_DOC_IDS).map(Number),
])].sort((a, b) => a - b);

export function buncombeUrls(fy) {
  const urls = [];
  const doc = BUNCOMBE_DOC_IDS[fy];
  if (doc) urls.push(`https://www.buncombenc.gov/DocumentCenter/View/${doc}`);
  if (BUNCOMBE_LEGACY_FYS.includes(fy)) {
    urls.push(`https://media.buncombenc.gov/common/finance/cafr/CAFR${String(fy).slice(2)}.pdf`);
  }
  if (fy >= 2020 && fy <= 2024) {
    // The GFOA rename sits inside this scheme: FY2020 keeps the old word order.
    const span = `${fy - 1}-${fy}`;
    const base = `https://media.buncombenc.gov/common/finance/financial-reports/${span}`;
    urls.push(`${base}/annual-comprehensive-financial-report.pdf`);
    urls.push(`${base}/comprehensive-annual-financial-report.pdf`);
  }
  return urls;
}

// -- Content guards ----------------------------------------------------------
/**
 * These two live in the lib, not in the shebang fetcher, so `tests/` can
 * exercise them against real front-matter fixtures. A guard that has never
 * been shown to REJECT anything is a comment, not a guard.
 */

/**
 * The report's own text must name the fiscal year the caller claims.
 *
 * Every NC local unit closes JUNE 30 (N.C.G.S. 159-8(b)), so the caption to
 * look for is "June 30, <FY>". The month/day gap is `\s*` because pdftotext
 * drops the space in some renderings — that is how a King County report once
 * loaded as the wrong year in v2.21.
 *
 * The asymmetry is deliberate. A MISS is reported and ALLOWED; only a positive
 * hit on a different year in [FY-1, FY+1] with no hit on the claimed year is a
 * hard failure. An ACFR legitimately prints the prior year throughout its
 * comparative columns, so "names FY-1 somewhere" is normal and only "names
 * FY-1 and never FY" is evidence of a mislabeled file.
 */
export function assertFiscalYear(text, fy) {
  if (text === null || text === undefined) return { ok: true, note: 'no text — year unverified' };
  const hit = (y) => new RegExp(`June\\s*30,?\\s*${y}`, 'i').test(text)
    || new RegExp(`(fiscal\\s+year|year\\s+ended)[^.]{0,40}${y}`, 'i').test(text);
  if (hit(fy)) return { ok: true };
  const wrong = [fy - 1, fy + 1].filter(hit);
  if (wrong.length) return { ok: false, note: `names FY${wrong.join('/')} but not FY${fy}` };
  return { ok: true, note: 'MISS — no fiscal-year caption found (not proof of a wrong year)' };
}

/**
 * ⚠ The guard this milestone exists to add — and the one that had to be
 * REDESIGNED after its first version was shown to fail.
 *
 * THE ADVERSARY. Buncombe County and the Buncombe County Board of Education
 * ("Buncombe County Schools") each publish an ACFR. The schools' FY2024 report
 * is a genuine 137-page, 4.9MB PDF whose cover reads "Buncombe County Board of
 * Education / Asheville, North Carolina / Annual Comprehensive Financial
 * Report / For the Fiscal Year Ended June 30, 2024", and it OUTRANKS the
 * county's own report in web search. Magic bytes, byte size, page count and
 * the fiscal-year assertion all pass on it untouched.
 *
 * ⚠ WHY THE OBVIOUS GUARD DOES NOT WORK. The first version of this function
 * required the issuer's name and forbade the neighbour's, and it ACCEPTED the
 * impostor — verified against the real file, not reasoned about:
 *
 *   - "Buncombe County Board of Education" CONTAINS "Buncombe County", so the
 *     required name matches the wrong document. The county's own covers read
 *     "BUNCOMBE COUNTY, NORTH CAROLINA", never "County of Buncombe", so the
 *     name cannot be tightened to exclude the school board.
 *   - The genuine county ACFR mentions its Board of Education as a discretely
 *     presented component unit — all 16 of them do — so forbidding that phrase
 *     outright would reject every real year. The "mentions it alongside the
 *     issuer, so allow" escape hatch that fixed THAT is exactly what let the
 *     impostor through.
 *
 * ⚠ AND WHY A COVER-PAGE RULE DOES NOT WORK EITHER. Scoping the check to the
 * title block is defensible in principle and fails in practice here: 21 of the
 * 58 NC reports have an IMAGE-ONLY page 1 (`pdftotext` yields one character),
 * so a cover-only rule cannot verify 36% of the corpus and would have to
 * report them all as "unverified".
 *
 * THE RULE THAT HOLDS. Require POSITIVE EVIDENCE OF AUTHORSHIP: a government's
 * ACFR front matter always names its own governing body or chief executive in
 * the list of principal officials. A school board's never does.
 *
 *   all 21 Durham County reports    "county manager"            impostor: absent
 *   all 16 Buncombe County reports  "county manager" + "board of commissioners"
 *   all 16 Durham City reports      "mayor" + "city council" + "city manager"
 *   all  5 Asheville reports        "mayor"           impostor: absent
 *   the impostor                    NONE of the above; "superintendent" instead
 *
 * Measured across all 58 files, not assumed. Note `city council` alone would
 * have failed on Asheville FY2024 and FY2025, whose front matter names the
 * mayor and councillors without using the phrase — which is why `governing` is
 * an ANY-OF set rather than a single pattern.
 *
 * `forbidGoverning` is retained purely to turn a rejection into a legible
 * diagnosis ("this is a school board's report") rather than a bare miss. It
 * cannot rescue a document: the any-of `governing` test is the decision.
 */
export function assertIssuer(text, { require, governing, forbidGoverning = [] }) {
  if (text === null || text === undefined) return { ok: false, note: 'no text — issuer UNVERIFIABLE' };
  const head = text.slice(0, 20_000);

  const named = require.test(head);
  const authored = governing.filter((rx) => rx.test(head)).map((rx) => rx.source);
  const impostor = forbidGoverning.filter((rx) => rx.test(head)).map((rx) => rx.source);

  if (!named) {
    return { ok: false, note: `WRONG ISSUER — front matter does not name ${require.source}` };
  }
  if (!authored.length) {
    const why = impostor.length
      ? `names ${impostor.join(', ')} instead — this is a different body's report`
      : 'no governing-body or chief-executive marker found';
    return { ok: false, note: `WRONG ISSUER — ${require.source} appears but ${why}` };
  }
  return { ok: true };
}

/**
 * Per-entity issuer patterns.
 *
 * `require`     the government's name as it appears in its own front matter.
 * `governing`   ANY-OF markers proving the document was authored BY that
 *               government. This is the load-bearing test.
 * `forbidGoverning`  a confusable neighbour's markers, for diagnosis only.
 *
 * Every NC city and county has a school district filing its own audited
 * statements, so all four entities carry the same forbid set rather than only
 * the one where the collision was actually observed.
 */
const SCHOOL_MARKERS = [/BOARD\s+OF\s+EDUCATION/i, /SUPERINTENDENT/i];

export const NC_ISSUERS = {
  'durham-city': {
    require: /CITY\s+OF\s+DURHAM/i,
    governing: [/MAYOR/i, /CITY\s+COUNCIL/i, /CITY\s+MANAGER/i],
    forbidGoverning: SCHOOL_MARKERS,
  },
  'durham-county': {
    require: /(COUNTY\s+OF\s+DURHAM|DURHAM\s+COUNTY)/i,
    governing: [/COUNTY\s+MANAGER/i, /BOARD\s+OF\s+COMMISSIONERS/i],
    forbidGoverning: SCHOOL_MARKERS,
  },
  asheville: {
    require: /CITY\s+OF\s+ASHEVILLE/i,
    governing: [/MAYOR/i, /CITY\s+COUNCIL/i, /CITY\s+MANAGER/i],
    forbidGoverning: SCHOOL_MARKERS,
  },
  buncombe: {
    require: /BUNCOMBE\s+COUNTY/i,
    governing: [/COUNTY\s+MANAGER/i, /BOARD\s+OF\s+COMMISSIONERS/i],
    forbidGoverning: SCHOOL_MARKERS,
  },
};

// -- Structure comparison (verifier helpers) ---------------------------------
/**
 * These live in the lib, not in the shebang verifier, so `tests/` can exercise
 * them. `isDoubledGlyphs` in particular is a structural predicate that must not
 * fire on a genuine label, and that is only credible if it is tested.
 */

/**
 * Root-level subtotals implied by the coordinate reader's flat component list.
 *
 * ⚠ THE CHECK THAT CATCHES A WELD, and the reason it exists.
 *
 * `CHECK 2` compares LEAF amounts, and a weld does not change them. When a
 * group heading is read as a wrapped label and fused onto its first child
 * ("Intergovernmental Education"), the heading carried $0, so the leaf multiset
 * is IDENTICAL either way and CHECK 2 passes. So does the extractor tie gate,
 * for the same reason. Eleven of Buncombe County's sixteen operating rows
 * shipped exactly that label, and it surfaced only incidentally — through an
 * unrelated glyph defect on one year.
 *
 * What a weld DOES change is the ROOT structure: the document has three root
 * categories and the stored tree has two, with the survivor inflated by the
 * whole of the missing one ($66,171,518 of education transfers in FY2008).
 * Comparing root-level subtotals catches that precisely.
 *
 * Compared as AMOUNTS, never as label strings: the two readers legitimately
 * render labels differently on documents that fuse or split their glyphs
 * (City of Durham FY2023 yields "Licensesandpermits" under pdfplumber), so a
 * string comparison would raise false failures on correct data.
 */
export function coordRootAmounts(components) {
  const indents = components.map((c) => c.indent).filter((i) => i !== null && i !== undefined);
  if (!indents.length) return null;
  const rootX = Math.min(...indents);
  const TOL = 1.5;   // same tolerance lib/acfrGfCoords.py uses
  const roots = [];
  let open = null;
  for (const c of components) {
    if (c.indent === null || c.indent === undefined) return null;
    if (c.indent <= rootX + TOL) {
      if (c.cell === 'number' && c.amount !== 0) { roots.push(c.amount); open = null; }
      else { open = { a: 0 }; roots.push(open); }
    } else if (open) {
      open.a += c.amount;
    }
  }
  return roots
    .map((r) => (typeof r === 'number' ? r : r.a))
    .filter((a) => a !== 0)
    .sort((a, b) => a - b);
}

/** Root-level subtotals of an acfrGF-shaped tree. */
export function treeRootAmounts(tree) {
  return (tree?.c ?? [])
    .map((c) => (Array.isArray(c.c) && c.c.length ? c.c.reduce((s, g) => s + g.a, 0) : c.a))
    .filter((a) => a !== 0)
    .sort((a, b) => a - b);
}

/**
 * Is this label the OVERPRINTED-GLYPH artifact?
 *
 * ⚠ Buncombe County's FY2008 statement draws one row twice, so pdfplumber sees
 * every glyph doubled and interleaved. Verbatim from the coordinate reader:
 *
 *     label   ddeevveellooppmmeenntt        (i.e. "development")
 *     amount  77553388887766                (i.e. 7,538,876)
 *
 * The `-table` reader is unaffected — it reads 7,538,876 and ties at exactly $0
 * against the printed 244,279,691, and `acfrPrintedTotal` independently agrees
 * on the total. So the STORED FIGURE IS RIGHT and it is the CHECKER that cannot
 * read this page.
 *
 * A row in that state is therefore reported as SINGLE-READER and named, exactly
 * as `verify-colorado.mjs` reports the six El Paso rows neither `-table`
 * strategy can read. It is NOT downgraded to a pass, and NOT counted as
 * corroborated.
 *
 * Detection is structural, not a hardcoded string: every character appears
 * twice in adjacent pairs. The length floor keeps a genuine short label
 * ("Fees") from ever qualifying.
 */
export function isDoubledGlyphs(label) {
  const s = (label ?? '').replace(/\s+/g, '');
  if (s.length < 8 || s.length % 2 !== 0) return false;
  for (let i = 0; i < s.length; i += 2) if (s[i] !== s[i + 1]) return false;
  return true;
}

// -- Shared ------------------------------------------------------------------
/**
 * N.C.G.S. 159-8(b): every NC local unit's fiscal year begins July 1.
 * Exported so the loaders and the verifier assert one shared constant rather
 * than each repeating a literal.
 */
export const NC_FISCAL_YEAR_START_MONTH = 7;
export const NC_FY_END_MONTH_DAY = '06-30';

export const NC_ENTITIES = {
  'durham-city': {
    label: 'City of Durham, NC', entityType: 'city',
    dir: 'docs/DurhamCity', fys: DURHAM_CITY_FYS, urls: durhamCityUrls,
    file: (fy) => `durham-city-${fy}-acfr.pdf`,
  },
  'durham-county': {
    label: 'Durham County, NC', entityType: 'county',
    dir: 'docs/DurhamCounty', fys: DURHAM_COUNTY_FYS, urls: durhamCountyUrls,
    file: (fy) => `durham-county-${fy}-acfr.pdf`,
  },
  asheville: {
    label: 'City of Asheville, NC', entityType: 'city',
    dir: 'docs/Asheville', fys: ASHEVILLE_FYS, urls: ashevilleUrls,
    file: (fy) => `asheville-${fy}-acfr.pdf`,
  },
  buncombe: {
    label: 'Buncombe County, NC', entityType: 'county',
    dir: 'docs/BuncombeCounty', fys: BUNCOMBE_FYS, urls: buncombeUrls,
    file: (fy) => `buncombe-county-${fy}-acfr.pdf`,
  },
};
