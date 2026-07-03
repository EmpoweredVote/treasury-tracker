/**
 * Pre-GASB-34 General-Fund extractor (Phase 115-02, DEEP-02).
 *
 * Before GASB Statement 34 (adopted by CT/WI for FY2002), state CAFRs printed a
 * "Combined Statement of Revenues, Expenditures, and Changes in Fund Balances — All
 * Governmental Fund Types (and Expendable Trust Funds)" — structurally DIFFERENT from the
 * modern "[Governmental Funds] Statement of Revenues, Expenditures and Changes in Fund
 * Balances" that scripts/maAcfrExtract.mjs targets. The General (Fund) column is always the
 * 1st numeric column (same principle as the modern extractor), but the surrounding fund-column
 * lineup (Special Revenue | Debt Service | Capital Projects [| Expendable Trust | Memorandum
 * Totals]) and section layout differ enough to need a dedicated title anchor.
 *
 * CAUTION (confirmed in cached CT/WI text): the same pre-34 CAFR also contains OTHER
 * "Combined Statement of Revenues, Expenditures, ..." variants that must NOT be matched:
 *   - Higher-Education / University-Hospital funds: "...and Other Changes" (no "Fund Balances")
 *   - Budget-and-Actual / Non-GAAP Budgetary Basis: no "All Governmental Fund Types" nearby
 *   - Ten-year statistical trend tables: title reused with a "1987-1995"-style year range,
 *     no "Revenues:"/"Expenditures:" section headers following
 *   - A Table-of-Contents line: matches the title text AND "All Governmental Fund Types",
 *     but is never followed by a real "Revenues:" section header within a few lines
 * This extractor anchors ONLY on "Combined Statement of Revenues, Expenditures, and Changes
 * in Fund Balances" + "All Governmental Fund Types" within a few lines, THEN requires it to be
 * followed by a genuine Revenues:/Total Revenues/Expenditures:/Total Expenditures sequence
 * within a bounded window — the same tie-gate discipline the loaders apply externally rejects
 * anything that still slips through.
 *
 * extractPre34GeneralFund(text) → { found, revenues:[{name,total}], revTotal,
 *   expenditures:[{name,total}], expTotal } — mirrors maAcfrExtract.mjs's result shape.
 *   All values in THOUSANDS (loader multiplies by UNITS). null totals if not found.
 *
 * Position-anchored (extract_gf.py precedent, ported to JS): the General Fund column is
 * located by the right-edge character position of the FIRST numeric token on the "Total
 * Revenues"/"Total Expenditures" row, then every other row's numeric tokens are matched to
 * the NEAREST anchor column — a row whose nearest-to-GF token isn't actually at position 0
 * (an explicit blank/dash GF cell, or a wrapped label pushing values right) yields no GF value
 * for that row (null / skipped), never a mis-assigned neighbor-column figure.
 */

// Numeric tokens with their end-character position (for position-anchored column matching).
// "(Note NN)" cross-references are blanked first so an incidental bare number inside one is
// never read as a data value (mirrors maAcfrExtract.mjs's positional variant).
//
// CT1991/CT1992 SCAN QUIRK: some pre-34 pages misprint (or mis-scan) the thousands separator
// as a period instead of a comma on isolated rows (e.g. "6.859.289" for 6,859,289; "7.215,567"
// for 7,215,567 — a mixed one-off). Since every figure in this statement is whole thousands
// (never a real decimal), any run of "\d{1,3}" followed by one-or-more ".ddd" (exactly 3
// digits) groups is unambiguously a corrupted thousands-grouping, not a fraction — normalize
// dots to commas within that run before tokenizing. Scoped to this narrow statement-only
// tokenizer, so it never touches unrelated numeric text elsewhere in the source document.
function numTokensWithPos(line) {
  const cleaned = line.replace(/\(Note\s+\d+\)/gi, (m) => ' '.repeat(m.length)).replace(/\$/g, ' ')
    .replace(/\d{1,3}(?:\.\d{3})+/g, (m) => m.replace(/\./g, ','));
  const out = [];
  for (const m of cleaned.matchAll(/\(?[\d,]+\)?/g)) {
    const t = m[0];
    if (!/\d/.test(t)) continue;
    const neg = /^\(.*\)$/.test(t);
    const v = parseInt(t.replace(/[(),]/g, ''), 10);
    if (Number.isNaN(v)) continue;
    out.push({ v: neg ? -v : v, end: m.index + t.length, start: m.index });
  }
  return out;
}
function labelBefore(line, firstTokStart) {
  return line.slice(0, firstTokStart).replace(/\$/g, ' ').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim();
}
// Pick the token nearest the GF-column anchor (index 0 of the anchor row's tokens); a row
// with nothing near that position has a blank GF cell → null (never a wrong-column guess).
function pickGF(toks, anchor) {
  let gf = null;
  for (const tok of toks) {
    let best = 0, bestD = Infinity;
    for (let k = 0; k < anchor.length; k++) {
      const d = Math.abs(tok.end - anchor[k].end);
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best === 0 && gf === null) gf = tok.v;
  }
  return gf;
}

// Extract label + General-Fund value for every leaf row between `start` (exclusive, the
// section header line) and `end` (exclusive, the "Total ..." row), against `anchor` (the
// Total row's numeric tokens). Sub-headers ending in ":" (e.g. "Current:", "Debt Service:",
// "Other Revenues:") propagate onto subsequent leaf rows then clear at the next top-level
// line — a fresh sub-header or a "Total ..." subtotal row (extract_gf.py precedent). "Current:"
// is a no-op header (matches the modern extractor's treatment: it never renames anything).
// Wrapped multi-line labels (no numbers on their own line) are held in `pending` and prepended
// onto the next data row's label (KY precedent, ported for pre-34 years that may wrap too).
function extractSection(lines, start, end, anchor, { debtServicePrefix = false } = {}) {
  const items = [];
  let pending = '';
  let sub = null;
  for (let j = start; j < end; j++) {
    const raw = lines[j];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const toks = numTokensWithPos(raw);
    if (!toks.length) {
      if (/:$/.test(trimmed)) {
        const hdr = trimmed.replace(/:$/, '').trim();
        sub = /^current$/i.test(hdr) ? null : hdr;
        pending = '';
      } else if (trimmed.length < 60) {
        pending = pending ? `${pending} ${trimmed}` : trimmed;
      }
      continue;
    }
    let name = labelBefore(raw, toks[0].start);
    if (pending) { name = name ? `${pending} ${name}` : pending; pending = ''; }
    if (!name) continue;
    if (/^total\s/i.test(name)) { sub = null; continue; } // subtotal row closes the subsection
    const gf = pickGF(toks, anchor);
    if (gf === null) continue; // blank GF cell — real value lives in another fund column
    if (debtServicePrefix && sub && /debt service/i.test(sub) && !/debt service/i.test(name)) {
      name = `Debt service — ${name}`;
    }
    items.push({ name, total: gf });
  }
  return items;
}

export function extractPre34GeneralFund(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const titleWindow = lines.slice(i, i + 4).join(' ');
    if (!/Combined Statement of Revenues,?\s+Expenditures,?\s+and\s+Changes in Fund Balances/i.test(titleWindow)) continue;
    const lookahead = lines.slice(i, i + 8).join(' ');
    if (!/All Governmental Fund Types/i.test(lookahead)) continue;

    // Confirm this is the real statement page (not a Table-of-Contents entry or a
    // statistical trend table reusing the same title) — a genuine "Revenues:" section
    // header must follow within a bounded window.
    // Trailing "$" tolerated — CT1988 prints a stray lone dollar sign after "Revenues:"
    // (the first data column's $ sign orphaned onto the header line by the page's column
    // wrapping) — same allowance applied to "Expenditures:" for symmetry.
    let revH = -1;
    for (let j = i; j < Math.min(lines.length, i + 30); j++) {
      if (/^\s*Revenues:?\s*\$?\s*$/i.test(lines[j])) { revH = j; break; }
    }
    if (revH < 0) continue;

    let tRev = -1, expH = -1, tExp = -1;
    for (let j = revH + 1; j < Math.min(lines.length, revH + 400); j++) {
      if (tRev < 0 && /^\s*Total\s+Revenues/i.test(lines[j])) tRev = j;
      else if (tRev > 0 && expH < 0 && /^\s*Expenditures:?\s*\$?\s*$/i.test(lines[j])) expH = j;
      else if (expH > 0 && /^\s*Total\s+Expenditures/i.test(lines[j])) { tExp = j; break; }
    }
    if (tRev < 0 || expH < 0 || tExp < 0) continue;

    const revAnchor = numTokensWithPos(lines[tRev]);
    const expAnchor = numTokensWithPos(lines[tExp]);
    if (!revAnchor.length || !expAnchor.length) continue;

    const revenues = extractSection(lines, revH + 1, tRev, revAnchor);
    const revTotal = pickGF(revAnchor, revAnchor);
    const expenditures = extractSection(lines, expH + 1, tExp, expAnchor, { debtServicePrefix: true });
    const expTotal = pickGF(expAnchor, expAnchor);

    if (revTotal !== null && expTotal !== null && revenues.length && expenditures.length) {
      return { found: true, statementLine: i, revenues, revTotal, expenditures, expTotal };
    }
    // This candidate matched the title but didn't yield a clean tie-able extraction —
    // keep scanning in case the same title text reappears later (e.g. a second candidate
    // whose statement layout our walk handles correctly).
  }
  return { found: false, revenues: [], revTotal: null, expenditures: [], expTotal: null };
}
