/**
 * Massachusetts ACFR General-Fund extractor (Phase 108-02).
 *
 * MA's Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances is
 * DEPARTMENT-level (~44 expenditure line items) across a variable number of fund columns
 * (FY2025: General | Lotteries | MSBA | Federal Grants | Other Governmental | Total). The GENERAL
 * FUND is always the 1st numeric column. Hand-transcribing 44 depts × 25 yrs is impractical, so
 * this module parses the pdftotext -table output programmatically. Every extracted year is gated by
 * an exact GF-column total-tie in the loader — a year whose parse doesn't tie is skipped+logged
 * (honest hole per D-04), never mis-loaded.
 *
 * extractMAGeneralFund(txt) → { found, revenues:[{name,total}], revTotal, expenditures:[{name,total}], expTotal }
 *   all values in THOUSANDS (the loader ×1000 → dollars). null totals if not found.
 */

// Parse a statement line into { label, nums:[] } where nums are the numeric columns (thousands).
// Columns in -table output are separated by 2+ spaces; the label (with dotted leader) is col 0.
// "$" is dropped; "--"/"-" → 0; "(1,234)" → -1234.
//
// FY2014 SCAN-QUIRK (115-03): isolated rows misprint the thousands separator as a period
// instead of a comma (e.g. "470.116" for 470,116) — the same corruption class as CT1991/1992
// (pre34Extract.mjs). Every figure in this statement is whole thousands (never a real
// decimal), so any `\d{1,3}(\.\d{3})+` run is unambiguously a corrupted thousands-grouping —
// normalize dots to commas before column-splitting, scoped to this narrow tokenizer.
//
// FY2014 also has a handful of rows where the embedded subset font maps the "1" glyph to a
// literal "]" bracket at the START of a number (e.g. "],904" for "1,904"; "20],257" for
// "201,257"). The "]"→"1" normalization is applied PER-TOKEN after column-splitting, and ONLY
// when the token is otherwise a numeric candidate (digits/commas/brackets, optionally
// parenthesized) — a legitimate "]" inside label text is never rewritten (115 review WR-04:
// labels are not tie-gated, so a whole-line rewrite could silently ship a mangled label).
function parseRow(line) {
  const cleaned = line.replace(/\$/g, ' ')
    .replace(/\d{1,3}(?:\.\d{3})+/g, (m) => m.replace(/\./g, ','));
  const cols = cleaned.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  if (!cols.length) return null;
  const nums = [];
  let firstNumIdx = -1;
  for (let i = 0; i < cols.length; i++) {
    let t = cols[i].replace(/\.+$/, '').trim(); // strip trailing dotted leader
    // FY2014 "]"→"1" glyph fix, scoped to numeric-candidate tokens only (WR-04).
    if (t.includes(']') && /^\(?[\d,\]]+\)?$/.test(t)) t = t.replace(/\]/g, '1');
    if (/^-{1,2}$/.test(t)) { nums.push(0); if (firstNumIdx < 0) firstNumIdx = i; }
    else if (/^\(?[\d,]+\)?$/.test(t) && /\d/.test(t)) {
      const neg = /^\(.*\)$/.test(t);
      const v = parseInt(t.replace(/[(),]/g, ''), 10);
      nums.push(neg ? -v : v); if (firstNumIdx < 0) firstNumIdx = i;
    }
  }
  // label = column tokens before the first numeric column, dots stripped
  let label = '';
  if (firstNumIdx > 0) label = cols.slice(0, firstNumIdx).join(' ').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  else if (firstNumIdx === 0) label = ''; // number-only line
  else label = cols.join(' ').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim(); // pure text
  return { label, nums, hasNum: firstNumIdx >= 0 };
}

// Locate the basic Governmental Funds Rev/Exp/Changes statement and extract the General Fund (col 1).
export function extractMAGeneralFund(txt) {
  const lines = txt.split('\n');
  // Find candidate REVENUES headers past the MD&A/TOC (line > 1500), with a General-Fund header above
  // and a Total revenues / EXPENDITURES / Total expenditures sequence below.
  for (let i = 1500; i < lines.length; i++) {
    if (!/^\s*REVENUES:?\s*$/i.test(lines[i])) continue;
    // header region above must reference "General" and "Governmental Funds"
    const header = lines.slice(Math.max(0, i - 18), i).join(' ');
    if (!/General/.test(header) || !/Governmental Funds/i.test(header)) continue;
    // find Total revenues, EXPENDITURES, Total expenditures below
    //
    // FY2014 GLYPH-CORRUPTION TOLERANCE (115-03): this year's PDF has isolated single-
    // character font-glyph substitutions on section-anchor lines ("Total revenaes" for
    // "Total revenues"; "EXPENDTTURES" for "EXPENDITURES" — the embedded subset font maps a
    // handful of glyph codes to the wrong character on THESE specific lines, while individual
    // department/category labels below are unaffected in ways that change their extracted
    // values). The anchors below tolerate a single corrupted character in the distinguishing
    // position (reven\w*s / EXPEND\w*TURES) while still requiring the rest of the word intact,
    // so they cannot accidentally match unrelated text — verified against all 19 previously-
    // tying years' identical totals (regression-gated).
    let tRev = -1, expH = -1, tExp = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 400); j++) {
      if (tRev < 0 && /^\s*Total\s+reven\w*s\b/i.test(lines[j])) tRev = j;
      else if (tRev > 0 && expH < 0 && /^\s*EXPEND\w*TURES:?\s*$/i.test(lines[j])) expH = j;
      else if (expH > 0 && /^\s*Total\s+e\wpenditures/i.test(lines[j])) { tExp = j; break; }
    }
    if (tRev < 0 || expH < 0 || tExp < 0) continue;

    // Extract revenue items (between REVENUES and Total revenues) — GF = 1st numeric column
    const revenues = [];
    for (let j = i + 1; j < tRev; j++) {
      const r = parseRow(lines[j]); if (!r || !r.hasNum || !r.label) continue;
      if (/^current$/i.test(r.label)) continue;
      revenues.push({ name: r.label, total: r.nums[0] });
    }
    const revTotalRow = parseRow(lines[tRev]);
    const revTotal = revTotalRow?.nums?.[0] ?? null;

    // Extract expenditure items (between EXPENDITURES and Total expenditures)
    const expenditures = [];
    let pending = '';
    for (let j = expH + 1; j < tExp; j++) {
      const r = parseRow(lines[j]); if (!r) continue;
      if (!r.hasNum) { // label continuation / heading like "Current:"
        if (r.label && !/^current:?$/i.test(r.label)) pending = pending ? `${pending} ${r.label}` : r.label;
        continue;
      }
      let name = r.label;
      if (pending) { name = name ? `${pending} ${name}` : pending; pending = ''; }
      if (!name) continue;
      expenditures.push({ name, total: r.nums[0] });
    }
    const expTotalRow = parseRow(lines[tExp]);
    const expTotal = expTotalRow?.nums?.[0] ?? null;

    if (revTotal && expTotal && revenues.length && expenditures.length) {
      return { found: true, statementLine: i, revenues, revTotal, expenditures, expTotal };
    }
  }
  return { found: false, revenues: [], revTotal: null, expenditures: [], expTotal: null };
}

// Generic alias — the extractor is state-agnostic (any Governmental Funds Statement of
// Rev/Exp/Changes whose GENERAL FUND is the 1st numeric column). Reused by North Carolina
// (Phase 108-03) — NC is functional-level (23 rev sources / 13 exp functions) but shares the exact
// Revenues/Total revenues/Expenditures/Total expenditures + "GOVERNMENTAL FUNDS"/"General" structure.
export const extractGovFundGeneralColumn = extractMAGeneralFund;

/**
 * POSITIONAL variant (Phase 109-01 parser evolution, TN FY2009–FY2014 precedent).
 *
 * Older statements leave blank GENERAL-FUND cells truly EMPTY (no "--" placeholder), so
 * token-order extraction shifts a neighbor fund's value into the GF slot (TN FY2009 exp sum
 * overshot by the Education-fund column). This variant derives each fund column's right-aligned
 * END character position from the "Total revenues" / "Total expenditures" anchor rows, then
 * assigns each row's numeric tokens to the NEAREST anchor column — a row with no token nearest
 * column 0 has a blank GF cell (value 0). Same return shape as extractGovFundGeneralColumn.
 * Loaders try the token-order extractor first and fall back to this when the exact tie fails;
 * the per-FY total-tie remains the gate either way.
 */
function numTokensWithPos(line) {
  // Strip "(Note NN)" cross-references (MI "Tax credits (Note 16)") — the bare number inside
  // would otherwise be read as the row's first numeric column. Pad to preserve char positions.
  const cleaned = line.replace(/\(Note\s+\d+\)/gi, (m) => ' '.repeat(m.length)).replace(/\$/g, ' ');
  const out = [];
  for (const m of cleaned.matchAll(/\(?[\d,]+\)?/g)) {
    const t = m[0];
    if (!/\d/.test(t)) continue;
    const neg = /^\(.*\)$/.test(t);
    const v = parseInt(t.replace(/[(),]/g, ''), 10);
    if (Number.isNaN(v)) continue;
    out.push({ v: neg ? -v : v, end: m.index + t.length, start: m.index, raw: t });
  }
  return out;
}
function labelBefore(line, firstTokStart) {
  return line.slice(0, firstTokStart).replace(/\$/g, ' ').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim();
}
export function extractGovFundGeneralColumnPositional(txt, opts = {}) {
  const startLine = opts.startLine ?? 1500;
  const lines = txt.split('\n');
  for (let i = startLine; i < lines.length; i++) {
    if (!/^\s*REVENUES:?\s*$/i.test(lines[i])) continue;
    // Case-INSENSITIVE header match (MI prints "GENERAL FUND" / "GOVERNMENTAL FUNDS" all-caps).
    const header = lines.slice(Math.max(0, i - 18), i).join(' ');
    if (!/General/i.test(header) || !/Governmental Funds/i.test(header)) continue;
    let tRev = -1, expH = -1, tExp = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 400); j++) {
      if (tRev < 0 && /^\s*Total revenues/i.test(lines[j])) tRev = j;
      else if (tRev > 0 && expH < 0 && /^\s*EXPENDITURES:?\s*$/i.test(lines[j])) expH = j;
      else if (expH > 0 && /^\s*Total expenditures/i.test(lines[j])) { tExp = j; break; }
    }
    if (tRev < 0 || expH < 0 || tExp < 0) continue;

    const revAnchor = numTokensWithPos(lines[tRev]);
    const expAnchor = numTokensWithPos(lines[tExp]);
    if (!revAnchor.length || !expAnchor.length) continue;

    const pickGF = (toks, anchor) => {
      let gf = null;
      for (const tok of toks) {
        let best = 0, bestD = Infinity;
        for (let k = 0; k < anchor.length; k++) {
          const d = Math.abs(tok.end - anchor[k].end);
          if (d < bestD) { bestD = d; best = k; }
        }
        if (best === 0 && gf === null) gf = tok.v;
      }
      return gf; // null = blank GF cell
    };

    const revenues = [];
    for (let j = i + 1; j < tRev; j++) {
      const toks = numTokensWithPos(lines[j]);
      if (!toks.length) continue;
      const name = labelBefore(lines[j], toks[0].start);
      if (!name || /^current:?$/i.test(name)) continue;
      const gf = pickGF(toks, revAnchor);
      if (gf === null) continue;
      revenues.push({ name, total: gf });
    }
    const revTotal = pickGF(revAnchor, revAnchor);

    const expenditures = [];
    let pending = '';
    for (let j = expH + 1; j < tExp; j++) {
      const toks = numTokensWithPos(lines[j]);
      if (!toks.length) {
        const lbl = lines[j].replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
        if (lbl && !/^current:?$/i.test(lbl)) pending = pending ? `${pending} ${lbl}` : lbl;
        continue;
      }
      let name = labelBefore(lines[j], toks[0].start);
      if (pending) { name = name ? `${pending} ${name}` : pending; pending = ''; }
      if (!name) continue;
      const gf = pickGF(toks, expAnchor);
      if (gf === null) continue;
      expenditures.push({ name, total: gf });
    }
    const expTotal = pickGF(expAnchor, expAnchor);

    if (revTotal && expTotal && revenues.length && expenditures.length) {
      return { found: true, statementLine: i, revenues, revTotal, expenditures, expTotal };
    }
  }
  return { found: false, revenues: [], revTotal: null, expenditures: [], expTotal: null };
}

// NOTE (Phase 115-03): FY2002/2004/2005's pdftotext -table output has NO whitespace gap
// between a row's label dot-leader and its first numeric column — the leader dots run
// directly into the number, with periods interleaved between individual digits (e.g.
// "6..0..,.0..4..5" for "60,045"; also reproduced under -layout, so it is baked into the PDF's
// font metrics, not an extraction-mode artifact). A position-anchored variant tolerant of a
// bounded inter-digit separator (`\d(?:[.,]{0,4}\d)*`) was attempted but abandoned: the
// separator-run-length distribution for "corruption within one number" (2-7 chars observed)
// overlaps too heavily with "genuine gap between two adjacent numbers/columns" (6-95 chars
// observed) to draw a safe bound — any fixed threshold either merges adjacent fund columns
// into one inflated figure or truncates a number at a stray wide gap. Since a wrong-but-
// plausible dollar figure is worse than an honest hole, these three years are left unrecovered
// (see 115-03-MA-LOADLOG.md for the full investigation and disposition).
