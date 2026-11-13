/**
 * ⚠⚠⚠ 16,826 MASSACHUSETTS BUDGETS CITED NOTHING AT ALL.
 *
 * NO SHEBANG — library module under scripts/lib/.
 *
 * All 351 municipalities, FY2002-FY2025, across three families:
 *
 *     MA General Fund Expenditures            8,408   operating   FY2002-2025
 *     MA General Fund Revenues                6,663   revenue     FY2002-2020
 *     MA DLS General Fund Revenue by Source   1,755   revenue     FY2021-2025
 *
 * Every one carried `source_url = NULL`, and their `data_sources.base_url` was
 * `https://www.mass.gov/orgs/division-of-local-services` — a department's
 * front door, which is not a citation of anything.
 *
 * ── ⭐⭐ THE PUBLISHER ADDRESSES ONE MUNICIPALITY-YEAR BY GET ──────────────
 *
 * The DLS Gateway's Schedule A General Fund report takes its three form inputs
 * as query parameters, so the citation is PER ROW rather than per dataset:
 *
 *     rdPage.aspx?rdReport=ScheduleA.GeneralFund
 *                &iclMuni=035&islYear=2024&islAmountType=Expenditures
 *
 * returns exactly `035 Boston 2024 … 4,410,854,496`. #381's rule is that a
 * landing page is not a weaker citation, it is a WRONG one, and this family
 * does not need one: mass.gov publishes no Schedule A file at all (checked
 * 2026-11-13 — the Schedule A page links only to these reports, and says the
 * data is "extracted real-time based on the municipal submission").
 *
 * ── ⚠⚠⚠ AND ALL THREE FAMILIES READ THE SAME REPORT, WHATEVER THE THIRD IS
 *        CALLED ───────────────────────────────────────────────────────────
 *
 * "MA DLS General Fund Revenue by Source" is named after
 * `RevenueBySource.RBS.RevbySource2`, which is a REAL and DIFFERENT report —
 * Tax Levy / State Aid / Local Receipts / All Other / Enterprise & CPA, summing
 * to "Total Receipts". Its Boston FY2024 total is 4,397,284,371. TT stores
 * 4,498,898,752 for that row, which is Schedule A's "Total Revenues" to the
 * dollar, and the same holds for Worcester and Yarmouth in FY2021 and FY2025.
 *
 * ⛔ So the figure is cited to the report it CAME from, not to the report it
 * is named after. A citation that matched the label would hand a reader a page
 * showing a different number — the Milledgeville rule: record it, do not
 * quietly repair it by picking the prettier URL.
 *
 * ── ⛔⛔ THIS FAMILY CANNOT BE LIVENESS-CHECKED ────────────────────────────
 *
 * Measured against the live host on 2026-11-13, every one of these answered
 * HTTP 200:
 *
 *     iclMuni=035&islYear=2024            real          74,937 B, 16 money cells
 *     iclMuni=999&islYear=2024            no such muni  66,113 B,  0 money cells
 *     iclMuni=035&islYear=1800            no such year  74,763 B,  0 money cells
 *     iclMuni=zzz&islYear=2024            nonsense      10,958 B,  0 money cells
 *     rdReport=ScheduleA.NoSuchReport     no such REPORT 11,003 B, 0 money cells
 *
 * A probe therefore cannot tell a correct citation from a typo, exactly as for
 * the SCO per-entity family (see scoEntityCitation.mjs) — and 16,826 of them
 * would add hours to every `verify:source-urls` run and 16,826 requests to a
 * Massachusetts state server to learn nothing.
 *
 * ⭐ So the family is exempt from per-URL liveness and verified a STRONGER way:
 * `judgeMaDlsTie` compares every stored figure to the publisher's own printed
 * total, read from the same report — 432 requests for the whole fleet, because
 * one request carries a chunk of 40 municipalities. A 200 says a server
 * answered; a tie says the number is theirs.
 */

export const MA_DLS_HOST = 'dls-gw.dor.state.ma.us';
export const MA_DLS_REPORT = 'ScheduleA.GeneralFund';
const MA_DLS_BASE = `https://${MA_DLS_HOST}/reports/rdPage.aspx?rdReport=${MA_DLS_REPORT}`;

/**
 * ⚠⚠ The report renders 40 rows per page, and server-side paging needs an
 * `rdDataCache` token that a plain GET has no way to hold. A chunk of 50 comes
 * back as 40 rows with TEN SILENTLY DROPPED — which a tie census would read as
 * "the publisher does not list them", i.e. as absence rather than as a bug in
 * the asking.
 */
export const MA_DLS_CHUNK = 40;

/**
 * The report's own Revenues/Expenditures toggle (`islAmountType`).
 *
 * ⚠ NOT a default. `scoBranch` can fall back to `operating` because both of
 * its branches exist for every entity; here a wrong guess would cite a
 * municipality's REVENUES as the source of its EXPENDITURES, at HTTP 200,
 * and only the tie would ever notice.
 */
export function maDlsAmountType(datasetType) {
  if (datasetType === 'revenue') return 'Revenues';
  if (datasetType === 'operating') return 'Expenditures';
  throw new Error(`maDlsAmountType: dataset type ${JSON.stringify(datasetType)} `
    + 'has no column in ScheduleA.GeneralFund');
}

/**
 * The per-row citation.
 *
 * @param {{dorCode: string, fiscalYear: number|string, datasetType: string}} row
 */
export function maDlsUrl({ dorCode, fiscalYear, datasetType }) {
  // ⚠ The form's own values are zero-padded to three digits. `iclMuni=35`
  // selects NOTHING and the page still answers 200 — so this has to refuse
  // rather than pad, because a caller handing over `35` has a bug upstream.
  if (typeof dorCode !== 'string' || !/^\d{3}$/.test(dorCode)) {
    throw new Error(`maDlsUrl: DOR code ${JSON.stringify(dorCode)} is not three digits`);
  }
  if (!/^\d{4}$/.test(String(fiscalYear))) {
    throw new Error(`maDlsUrl: fiscal year ${fiscalYear} is not four digits`);
  }
  return `${MA_DLS_BASE}&iclMuni=${dorCode}&islYear=${fiscalYear}`
    + `&islAmountType=${maDlsAmountType(datasetType)}`;
}

/**
 * The shape the migration writes, so a test can hold SQL and JS to one rule.
 *
 * ⛔ The gate SKIPS this family's liveness probe. Anything that slips past this
 * check would be both unprobed and unverifiable, so the shape check is the only
 * thing between a typo and no checking at all.
 */
export const MA_DLS_URL_RE = new RegExp(
  '^https://dls-gw\\.dor\\.state\\.ma\\.us/reports/rdPage\\.aspx'
  + '\\?rdReport=ScheduleA\\.GeneralFund'
  + '&iclMuni=(\\d{3})&islYear=(\\d{4})&islAmountType=(Revenues|Expenditures)$',
);

export function isMaDlsUrl(url) {
  return typeof url === 'string' && MA_DLS_URL_RE.test(url);
}

/** `{ dorCode, fiscalYear, amountType }`, or null when it is not ours. */
export function parseMaDlsUrl(url) {
  if (typeof url !== 'string') return null;
  const m = MA_DLS_URL_RE.exec(url);
  return m ? { dorCode: m[1], fiscalYear: Number(m[2]), amountType: m[3] } : null;
}

/** One request carrying up to `MA_DLS_CHUNK` municipalities for one year. */
export function maDlsCorpusUrl(fiscalYear, amountType, dorCodes) {
  if (!Array.isArray(dorCodes) || dorCodes.length === 0) {
    throw new Error('maDlsCorpusUrl: no municipalities asked for');
  }
  if (dorCodes.length > MA_DLS_CHUNK) {
    throw new Error(`maDlsCorpusUrl: ${dorCodes.length} municipalities asked for, `
      + `but the report renders ${MA_DLS_CHUNK} rows per page and drops the rest`);
  }
  if (!/^\d{4}$/.test(String(fiscalYear))) {
    throw new Error(`maDlsCorpusUrl: fiscal year ${fiscalYear} is not four digits`);
  }
  if (amountType !== 'Revenues' && amountType !== 'Expenditures') {
    throw new Error(`maDlsCorpusUrl: unknown amount type ${JSON.stringify(amountType)}`);
  }
  return `${MA_DLS_BASE}&islYear=${fiscalYear}&islAmountType=${amountType}`
    + `&${dorCodes.map((d) => `iclMuni=${d}`).join('&')}`;
}

const strip = (s) => String(s).replace(/<[^>]*>/g, '').replace(/&#160;|&nbsp;/g, ' ').trim();

const money = (s) => {
  const t = strip(s).replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  return /^-?\d+(\.\d+)?$/.test(t) ? Math.round(Number(t)) : null;
};

/**
 * The (DOR code, publisher's spelling) roster, read out of the report's own
 * municipality checkbox list.
 *
 * ⚠ Read from the publisher rather than listed by hand: DLS prints
 * `Manchester By The Sea` where the census writes `Manchester-by-the-Sea`, and
 * `Amherst` where TT stores `Amherst Town`. Thirteen municipalities differ.
 * Resolve both sides through `maKey` in scripts/lib/maNames.mjs.
 */
export function readMaDlsRoster(html) {
  const out = [];
  const re = /name="iclMuni"[^>]*value="(\d+)"\s*\/>\s*<span>([^<]+)<\/span>/gi;
  for (const m of String(html).matchAll(re)) out.push({ dorCode: m[1], name: strip(m[2]) });
  return out;
}

/**
 * Every data row of the `xtGenFund` table: DOR code, spelling, year, total.
 *
 * ⚠⚠ THE TOTAL IS THE LAST MONEY CELL, NEVER THE FIRST. Abington FY2024
 * expenditures open at 2,719,438 and total 65,233,098; a "first number on the
 * row" rule would publish the wrong one, and the page would still be 200.
 */
export function readMaDlsRows(html) {
  const out = [];
  for (const tr of String(html).matchAll(/<TR[^>]*Row="\d+"[^>]*>([\s\S]*?)<\/TR>/gi)) {
    const cells = [...tr[1].matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/gi)].map((c) => c[1]);
    if (cells.length < 4) continue;
    const dorCode = strip(cells[0]);
    if (!/^\d{3}$/.test(dorCode)) continue;
    const nums = cells.slice(3).map(money).filter((n) => n !== null);
    if (!nums.length) continue;
    out.push({
      dorCode,
      name: strip(cells[1]),
      fiscalYear: Number(strip(cells[2])),
      total: nums[nums.length - 1],
    });
  }
  return out;
}

/** The key both sides of the tie are built on. */
export const maDlsTieKey = (dorCode, fiscalYear, amountType) => `${dorCode}|${fiscalYear}|${amountType}`;

/**
 * Compare stored totals to the publisher's own.
 *
 * `rows`:      { id, dorCode, fiscalYear, amountType, total, … }
 * `published`: Map of `${dorCode}|${fiscalYear}|${amountType}` -> Number
 *
 * ⚠ A municipality-year the publisher does not list is `absent`, never a
 * mismatch. DLS has no row at all for some older years, and calling that a
 * disagreement would invent a failure — #373's distinction, one level down.
 */
export function judgeMaDlsTie(rows, published) {
  const tie = [];
  const mismatch = [];
  const absent = [];
  for (const r of rows) {
    const pub = published.get(maDlsTieKey(r.dorCode, r.fiscalYear, r.amountType));
    if (pub === undefined || pub === null) { absent.push(r); continue; }
    const p = Math.round(Number(pub));
    if (p === Math.round(Number(r.total))) tie.push(r.id);
    else mismatch.push({ ...r, publisher: p, diff: p - Math.round(Number(r.total)) });
  }
  return { checked: rows.length, tie: tie.length, mismatch, absent };
}

export function maDlsTieIsClean(t) {
  return t.mismatch.length === 0;
}
