/**
 * New Jersey ACFR GAAP-statement isolation + General-Fund extraction (Phase 115-01, committed
 * per the Phase-115 code review WR-05 — this disambiguation previously existed only as prose in
 * 115-01-NJ-LOADLOG.md, leaving the false-match guard unreproducible from the repo).
 *
 * WHY ISOLATION IS REQUIRED: NJ's ACFR contains THREE statements sharing enough header
 * vocabulary ("General Fund" + "Governmental Funds") to false-match the shared extractor's
 * (maAcfrExtract.mjs) loose `/General/` + `/Governmental Funds/i` heuristic when scanning the
 * whole document:
 *   1. The true GAAP statement — "STATEMENT OF REVENUES, EXPENDITURES[,] AND CHANGES IN FUND
 *      BALANCES" / "GOVERNMENTAL FUNDS" (bare titles, no prefix) — the one we want.
 *   2. "BUDGETARY COMPARISON SCHEDULE — MAJOR GOVERNMENTAL FUNDS" — General Fund on a BUDGETARY
 *      basis, NOT GAAP. FY2004 false-tied against this in the initial 115-01 derivation: a
 *      genuinely wrong, non-GAAP total that happened to satisfy the sum-ties-total gate.
 *   3. "NON-MAJOR GOVERNMENTAL FUNDS — BY FUND TYPE" / "COMBINING STATEMENT…" — no GF column.
 *
 * isolateNJStatement() anchors on the exact bare title (whitespace-tolerant — FY2007's title has
 * an inserted `pdftotext -table` gap) followed within 5 lines by a bare "GOVERNMENTAL FUNDS"
 * subtitle (not "MAJOR…"/"NON-MAJOR…"/"COMBINING…"-prefixed), takes the FIRST such match
 * (confirmed to be the correct statement in every year FY2002–FY2025), and returns a scoped
 * snippet padded to satisfy the shared extractor's line-1500 scan-start convention.
 *
 * extractNJGeneralFund() layers the token-order → positional fallback with an EXACT tie gate
 * (NJ reports in DOLLARS, UNITS=1 — ties are $0, no thousands-rounding tolerance). FY2002–FY2003
 * need the positional fallback (a `pdftotext -table` artifact renders the "$" glyph as a bare
 * "--" immediately ahead of every dollar figure, so token-order parsing misassigns cells);
 * FY2004–FY2025 tie on token order.
 *
 * The NJ loaders (processNJAcfr.js / processNJRevenueAcfr.js) embed this extraction's tied
 * output as static data (verified once, not re-parsed at runtime, per their architecture).
 * Re-derive per the Phase-110 discipline with:
 *   node scripts/njAcfrExtract.mjs            (reads _acfr-work/nj/NJ{YYYY}.txt, prints totals)
 * and compare against the loaders' embedded control totals / 115-01-NJ-LOADLOG.md.
 */
import { extractGovFundGeneralColumn, extractGovFundGeneralColumnPositional } from './maAcfrExtract.mjs';

const TITLE_RE = /^\s*STATEMENT\s+OF\s+REVENUES,\s*EXPENDITURES,?\s+AND\s+CHANGES\s+IN\s+FUND\s+BALANCES\s*$/i;
const BARE_SUBTITLE_RE = /^\s*GOVERNMENTAL\s+FUNDS\s*$/i;

export function isolateNJStatement(txt, { span = 250 } = {}) {
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!TITLE_RE.test(lines[i])) continue;
    const lookahead = Math.min(i + 5, lines.length - 1);
    for (let j = i + 1; j <= lookahead; j++) {
      if (BARE_SUBTITLE_RE.test(lines[j])) {
        // FIRST bare title+subtitle pair = the true GAAP statement (verified FY2002–FY2025).
        // Pad with blank lines so the snippet starts past the shared extractor's line-1500
        // MD&A/TOC skip offset.
        return Array(1500).fill('').concat(lines.slice(i, i + span)).join('\n');
      }
    }
  }
  return null; // no bare GAAP title+subtitle pair found
}

// Token-order first, positional fallback, EXACT ($0) tie gate on BOTH sides — a result that
// does not tie both revenue and expenditure category sums to the printed GF totals is returned
// un-tied (found but not tying) so the caller's own gate refuses it; never silently "fixed".
export function extractNJGeneralFund(txt) {
  const empty = { found: false, revenues: [], revTotal: null, expenditures: [], expTotal: null };
  const scoped = isolateNJStatement(txt);
  if (scoped === null) return empty;
  const ties = (r) => r?.found && r.revTotal !== null && r.expTotal !== null
    && r.revenues.reduce((a, c) => a + c.total, 0) === r.revTotal
    && r.expenditures.reduce((a, c) => a + c.total, 0) === r.expTotal;
  const std = extractGovFundGeneralColumn(scoped);
  if (ties(std)) return std;
  const pos = extractGovFundGeneralColumnPositional(scoped);
  if (ties(pos)) return pos;
  return std.found ? std : (pos.found ? pos : empty);
}

// CLI re-derivation harness: node scripts/njAcfrExtract.mjs [firstFY] [lastFY]
// Reads _acfr-work/nj/NJ{YYYY}.txt and prints the extracted GF totals + tie status per year.
// Read-only — never touches the database.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const first = parseInt(process.argv[2] ?? '2002', 10);
  const last = parseInt(process.argv[3] ?? '2025', 10);
  const work = resolve(dirname(fileURLToPath(import.meta.url)), '../_acfr-work/nj');
  let bad = 0;
  for (let fy = first; fy <= last; fy++) {
    let r;
    try { r = extractNJGeneralFund(readFileSync(`${work}/NJ${fy}.txt`, 'utf8')); }
    catch (e) { console.log(`FY${fy}: ERROR ${e.message}`); bad++; continue; }
    const revSum = r.revenues.reduce((a, c) => a + c.total, 0);
    const expSum = r.expenditures.reduce((a, c) => a + c.total, 0);
    const tie = r.found && revSum === r.revTotal && expSum === r.expTotal;
    console.log(`FY${fy}: ${tie ? 'TIE ' : 'FAIL'} rev=${r.revTotal} (catSum ${revSum}) exp=${r.expTotal} (catSum ${expSum})`);
    if (!tie) bad++;
  }
  process.exit(bad ? 1 : 0);
}
