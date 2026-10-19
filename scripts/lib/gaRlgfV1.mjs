/**
 * Georgia DCA "Report of Local Government Finances" (RLGF) — the FY2009-2015
 * form generation, read here as "V1". Pure parser, no I/O.
 *
 * `gaRlgf.mjs` is the SIBLING reader for the FY2016-2025 generation ("V2", the
 * one with a `LOAD1` sheet). Full measured design, every column and every trap:
 * `.planning/GA-RLGF-V1-DESIGN.md`. Read it before changing anything here.
 *
 * ── WHAT MAKES V1 A DIFFERENT READER, NOT A WIDER LOOP ──────────────────────
 *
 * V2 keys everything by UCOA code (`31_1100`). V1 has no UCOA code anywhere:
 * it keys by the form's OWN LINE NUMBERS, which this module calls V-codes, and
 * it prints that key beside each money cell. So the page/extract join is EXACT
 * here, and the whole `aliasBareCodes` / `parseCodeCell` family of V2 traps —
 * which existed because the printed UCOA code dropped its suffix — has no
 * analogue in V1.
 *
 * ⚠⚠ THE PRICE OF THAT IS A WORSE ONE: A V-CODE AND A DOLLAR AMOUNT ARE THE
 * SAME BARE INTEGER. Cell `402` may be line 402 or $402, and nothing in the
 * cell says which. Columns are therefore DECLARED (`V1_PAGE_GEOMETRY`) and never
 * discovered by scanning a row. A census that guessed codes by numeric range
 * reported 31 distinct Part V shapes; re-run with declared columns it reported
 * ONE, across all 222 sampled workbooks. That gap is the entire argument.
 */

// ⚠ Shared with the V2 reader ON PURPOSE. `isErrorValue` and `num` encode the
// rule that an Excel error must propagate as NaN rather than pass as a zero, and
// that rule is identical in both generations. Forking it would let one reader
// drift into treating `#REF!` as money.
import { cellText, isErrorValue, num, monthFromEndText } from './gaRlgf.mjs';

export { isErrorValue, num };

/**
 * Canonical join key for a V-code, from either side of the join.
 *
 * ⚠⚠ MEASURED: "Parks and recreation" stores its codes 473 and 474 as STRINGS
 * while 475 is a number — in ALL 222 workbooks. A `Map` keyed on the raw cell
 * therefore misses that function entirely and drops its money with no error
 * anywhere. Everything is coerced through here, on both sides.
 *
 * ⚠ A trailing letter is SIGNIFICANT and is kept: `V312` and `V312A` are two
 * different revenue lines (they are the FY2014 `#REF!` pair).
 */
export function vkey(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^[Vv]?(\d{1,4})([A-Za-z])?$/);
  if (!m) return null;
  return `V${m[1]}${m[2] ? m[2].toUpperCase() : ''}`;
}

/**
 * Parse a V1 extract sheet (`Exportable Data` or its `Data` twin) into
 * `{ blocks, flat }`.
 *
 * The sheet is a stack of blocks. Each is a marker row whose first cell names
 * the block, a header row whose first cell is `CICOID`, and exactly ONE value
 * row. Both twin sheets share this shape.
 *
 * ⚠ BLOCK NAMES ARE READ, NEVER ASSUMED. The two sheets disagree about them:
 * `Exportable Data` writes `AUTH_LIST` / `FNLOG` where `Data` writes
 * `tblAuthority_list` / `FN_Log` for the same block. Anything that matched on a
 * hard-coded block name would silently read one sheet and not the other — which
 * is why `mergeTwins` reconciles on the KEY, not on the block.
 *
 * ⚠ The marker is recognised by the CICOID header that FOLLOWS it, not by its
 * own spelling. The sheet's title row ("Exportable data") is first-cell text
 * too, and a looser rule would mint a block from it.
 *
 * @param {Array<Array<*>>} rows zero-indexed grid
 */
export function parseExportable(rows) {
  const blocks = {};
  const flat = {};
  for (let r = 0; r < rows.length; r++) {
    const header = rows[r] || [];
    if (cellText(header[0]) !== 'CICOID') continue;
    // The marker is the nearest preceding row carrying first-cell text.
    let name = null;
    for (let b = r - 1; b >= 0 && b >= r - 3; b--) {
      const t = cellText(rows[b]?.[0]);
      if (t) { name = t; break; }
    }
    if (!name) continue;
    const values = rows[r + 1] || [];
    const block = {};
    for (let c = 1; c < header.length; c++) {
      const raw = cellText(header[c]);
      if (!raw) continue;
      const key = vkey(raw) ?? raw;
      block[key] = values[c] ?? null;
    }
    blocks[name] = { ...(blocks[name] || {}), ...block };
    Object.assign(flat, block);
  }
  return { blocks, flat };
}

/**
 * Reconcile the two copies of the V1 extract into one reading per key.
 *
 * ⭐⭐ THIS IS THE ONE THING V1 CAN DO THAT V2 CANNOT. V2 has a single extract
 * (`LOAD1`), so a broken cell there is simply broken. V1 ships the SAME TABLE
 * TWICE — `Exportable Data` and `Data` — and measurement across 222 workbooks
 * showed they shadow each other almost perfectly:
 *
 *   122,992 keys agree · 270 disagree
 *     5,770 are `#REF!` in `Data` but live in `Exportable Data`
 *         8 are the reverse
 *         2 are `#REF!` in BOTH (Athens-Clarke FY2012/FY2013 `V1213`, DET5)
 *
 * So a broken reference is usually RECOVERABLE, and when it is not, two
 * independent copies agreeing that it is broken is a much stronger statement
 * than one copy saying so.
 *
 * ⚠⚠ A DISAGREEMENT IS RECORDED, NEVER RESOLVED SILENTLY. The live sheet wins
 * for the oracle — but the conflict is the signal that a cell reference broke,
 * and the Milledgeville Rule is to surface it, not to pick quietly.
 *
 * ⚠ `null` for a key both copies lost. NOT zero: "the publisher's formula is
 * broken" and "the publisher reported nothing" are different facts, and only
 * one of them may be added into a total.
 *
 * @param {Object} live  flat keys from `Exportable Data`
 * @param {Object} twin  flat keys from `Data`
 */
export function mergeTwins(live, twin) {
  const merged = {};
  const notes = [];
  for (const key of new Set([...Object.keys(live || {}), ...Object.keys(twin || {})])) {
    const a = live?.[key];
    const b = twin?.[key];
    const aBad = a === undefined || a === null || isErrorValue(a);
    const bBad = b === undefined || b === null || isErrorValue(b);
    if (!aBad && !bBad) {
      merged[key] = a;
      const bothNumeric = typeof a === 'number' && typeof b === 'number';
      const same = bothNumeric ? Math.abs(a - b) <= 0.005 : String(a).trim() === String(b).trim();
      if (!same) notes.push({ kind: 'twins_disagree', key, live: a, twin: b });
      continue;
    }
    if (!aBad) { merged[key] = a; continue; }
    if (!bBad) {
      merged[key] = b;
      // Only an ERROR in the live sheet is a recovery; a key the live sheet
      // simply does not carry is not a defect, it is a different key set.
      if (isErrorValue(a)) notes.push({ kind: 'recovered_from_twin', key, twin: b });
      continue;
    }
    merged[key] = null;
    if (isErrorValue(a) && isErrorValue(b)) notes.push({ kind: 'unrecoverable', key });
  }
  return { merged, notes };
}

/**
 * Which Part a printed heading opens, and which Part each page carries.
 * ⚠ The V1 form renumbers Parts VII-XI relative to V2. Only I-VI mean the same
 * thing in both generations, and those are the only ones read here.
 */
const V1_PART_RE = /^Part\s+([IVX]+)\s*[-–]/i;
const V1_SECTION_RE = /^Section\s+([A-G])\b/i;
const V1_TOTAL_RE = /^total\b/i;

/**
 * Declared money/code column pairs, per page and per Part. Zero-indexed.
 *
 * ⚠⚠ DECLARED, NEVER DISCOVERED. On this form a V-code and a dollar amount are
 * the same bare integer in adjacent columns — cell `402` may be line 402 or
 * $402 and nothing in the cell distinguishes them. A census that inferred codes
 * by numeric range found 31 "distinct" Part V shapes; declared columns found
 * ONE, across all 222 sampled workbooks.
 *
 * ⚠ Page 1 columns 11-12 carry the government DROPDOWN LIST (`Bartow County` /
 * `1008008`) bleeding into the sheet. Declaring money as column 5 and nothing
 * else is what keeps a county name out of the revenue tree.
 *
 * ⚠ Page 2 Part II column 7 is `Govt ID No.`, a TEXT field with a V-code of its
 * own in column 8. It is not money and has no pair here.
 *
 * ⚠ Page 2 Part III items sit in column 11 while the Blk 312 annotation sits in
 * column 9. Declaring (11,12) alone is what keeps that memo out of the total.
 *
 * ⚠⚠ A TOTAL ROW DOES NOT ALWAYS SIT IN ITS ITEMS' COLUMN. Measured in all 222
 * workbooks: Part III's `Total Section A` keeps its money in column 10 while its
 * items are in column 11, and `Total Section B` is back in column 11. Hence
 * `totalCols`, tried in order until one carries a figure. Reading a total under
 * the item geometry yields a blank, and a blank subtotal silently becomes $0 —
 * which is exactly the failure this separate declaration prevents.
 */
export const V1_PAGE_GEOMETRY = Object.freeze({
  'Page 1': { labelCol: 0, parts: { I: { pairs: [[5, 7]] } } },
  'Page 2': {
    labelCol: 0,
    parts: {
      II: { pairs: [[5, 6], [9, 10], [11, 12]] },
      III: { pairs: [[11, 12]], totalCols: [10, 11] },
    },
  },
  'Page 3': { labelCol: 0, parts: { V: { pairs: [[7, 8], [9, 10], [11, 12]] } } },
});

/**
 * Subtotal cells the publisher's own extract NEVER populates.
 *
 * ⚠⚠ `V310` (Part III, Total Section A) reads 0 in every one of the 222 sampled
 * workbooks while the printed page carries the real figure — the extract's
 * formula points at the ITEM column, which is blank on the total row. 178 of
 * the 222 have a non-zero Section A, so an extract-only oracle would fail 80%
 * of the corpus for a defect that is in the publisher's spreadsheet, not in
 * the data.
 *
 * ⚠ Named here so the page/extract disagreement is recorded ONCE as a known
 * corpus-wide fact rather than raised 4,551 times. It is NOT suppressed
 * silently: `checkV1SectionTotals` still oracles the section, using the page.
 */
export const V1_EXTRACT_SUBTOTAL_GAPS = Object.freeze(new Set(['V310']));

/**
 * Read every V-coded money cell off the printed pages.
 *
 * ⚠⚠ THE PAGE IS PRIMARY AND THE EXTRACT CORROBORATES — the same decision V2
 * reached by measurement, for the same reason: the extract is derived from the
 * pages by cell reference, so agreement is by construction and it is the
 * DISAGREEMENTS that carry information.
 *
 * ⭐ V1 makes that join EXACT, because the page prints the extract's own key
 * beside each money cell. V2 needed `parseCodeCell`/`aliasBareCodes` to recover
 * a suffix the page had dropped; none of that is needed here.
 *
 * @param {Object<string, Array<Array<*>>>} pages sheet name -> zero-indexed grid
 * @returns {{cells, labels, totals, parts, rows}}
 */
export function readV1Pages(pages) {
  const cells = {};
  const labels = {};
  const totals = {};
  const parts = {};
  const rows = [];
  for (const [sheet, geom] of Object.entries(V1_PAGE_GEOMETRY)) {
    const grid = pages[sheet];
    if (!grid) continue;
    let part = null;
    let section = null;
    // ⚠⚠ Part II prints TWO MEMO ROWS AFTER its own `Total Part II` — General
    // revenue sharing and Physical health grants. They are outside the Part's
    // arithmetic, so once a Part has totalled, its items are closed.
    let closed = false;
    for (const grow of grid) {
      const label = cellText(grow?.[geom.labelCol]);
      const mPart = label.match(V1_PART_RE);
      if (mPart) {
        part = mPart[1].toUpperCase();
        section = null;
        closed = false;
        continue;
      }
      const mSec = label.match(V1_SECTION_RE);
      if (mSec) { section = mSec[1].toUpperCase(); continue; }
      if (!label || !part) continue;
      const spec = geom.parts[part];
      if (!spec) continue;
      const isTotal = V1_TOTAL_RE.test(label);
      if (!isTotal && closed) continue;
      const codes = [];
      const amounts = [];
      for (const [moneyCol, codeCol] of spec.pairs) {
        const key = vkey(grow?.[codeCol]);
        if (!key) continue;
        let raw = grow?.[moneyCol];
        // ⚠⚠ A total row may keep its money in a DIFFERENT column from its own
        // items — Part III's Total Section A does, in all 222 workbooks. Reading
        // it under the item geometry yields a blank that silently becomes $0.
        if (isTotal && spec.totalCols) {
          raw = undefined;
          for (const c of spec.totalCols) {
            if (grow?.[c] !== undefined && grow?.[c] !== null) { raw = grow[c]; break; }
          }
        }
        codes.push(key);
        amounts.push(raw);
        if (isTotal) totals[key] = raw === undefined ? null : raw;
        else {
          cells[key] = raw === undefined ? null : raw;
          labels[key] = label;
          parts[key] = part;
        }
      }
      if (!codes.length) continue;
      rows.push({ sheet, part, section, label, codes, amounts, isTotal });
      // `Total Part n` closes the Part; `Total Section x` does not.
      if (isTotal && /^total\s+part\b/i.test(label)) closed = true;
    }
  }
  return { cells, labels, totals, parts, rows };
}

/** The publisher's own Part V column totals: current ops, equipment, construction. */
export const V1_EXPENDITURE_TOTAL_KEYS = Object.freeze(['V509', 'V510', 'V511']);

/**
 * Compare one printed cell against the extract, recording any disagreement.
 * The PAGE figure is always the one returned — see the module header.
 */
function crossCheck(code, label, printed, extract, anomalies, section) {
  if (!(code in extract)) return;
  const raw = extract[code];
  if (isErrorValue(raw)) {
    anomalies.push({
      kind: 'extract_cell_is_excel_error', section, code, label,
      form: printed, extract: null, delta: null,
    });
    return;
  }
  if (raw === null || raw === undefined) return;
  const load = num(raw);
  if (Number.isNaN(load)) return;
  if (Math.abs(load - printed) > 0.005) {
    anomalies.push({
      kind: 'extract_disagrees_with_form', section, code, label,
      form: printed, extract: load, delta: load - printed,
    });
  }
}

/**
 * Build the V1 expenditure tree: Part V, FLAT.
 *
 * ⚠⚠ EACH FUNCTION IS A ROOT, AND TT INVENTS NO SECTIONS. The printed V1 Part V
 * carries 36 function rows and no section headings at all. V2's `5A`-`5G` roots
 * exist because V2's form prints them; asserting them here would manufacture a
 * structure this publisher never published in this generation — the "uniform is
 * not correct" trap. The resulting tree is 2 levels deep where V2's is 3, and
 * that difference is a true fact about the source.
 *
 * The three object columns (current operations / equipment and land /
 * construction) are SUMMED into one amount per function, exactly as V2 sums its
 * four. Each column is cross-checked against the extract individually, so a
 * broken cell is localised to its own column rather than to the row.
 */
export function buildV1ExpenditureTree(pageRead, extract = {}, anomalies = []) {
  const roots = [];
  for (const r of pageRead.rows) {
    if (r.part !== 'V' || r.isTotal) continue;
    let amount = 0;
    for (let i = 0; i < r.codes.length; i++) {
      const printed = num(r.amounts[i]);
      const v = Number.isNaN(printed) ? 0 : printed;
      amount += v;
      crossCheck(r.codes[i], r.label, v, extract, anomalies, 'V');
    }
    roots.push({ id: r.codes[0], label: r.label, amount, items: [] });
  }
  return { roots, total: roots.reduce((a, x) => a + x.amount, 0) };
}

/**
 * Oracle the flat Part V against the publisher's own printed column totals.
 *
 * ⚠ V1 affords ONE expenditure check where V2 affords seven, because a flat
 * Part has one subtotal. What compensates is the per-cell cross-check above:
 * 36 functions x 3 columns = 108 cells, each measured against two independent
 * extract copies. V2 had one extract and therefore one opinion per cell.
 *
 * ⚠⚠ A TOTAL THAT IS AN EXCEL ERROR SKIPS, AND A SKIP IS NEVER A PASS. This is
 * the exact condition that excluded Gwinnett FY2018/FY2023 and Upson FY2021
 * from the FY2016-2025 sweep, and it keeps that meaning here.
 */
export function checkV1ExpenditureTotal(tree, extract = {}) {
  let expected = 0;
  let found = 0;
  for (const key of V1_EXPENDITURE_TOTAL_KEYS) {
    const raw = extract[key];
    if (isErrorValue(raw)) {
      return { id: 'Part V', tag: 'exp', skipped: true, reason: `total ${key} is an Excel error cell` };
    }
    if (raw === null || raw === undefined) continue;
    found++;
    expected += num(raw);
  }
  if (!found) {
    return {
      id: 'Part V', tag: 'exp', skipped: true,
      reason: `none of ${V1_EXPENDITURE_TOTAL_KEYS.join('/')} present`,
    };
  }
  return {
    id: 'Part V', tag: 'exp', expected, actual: tree.total,
    ok: Math.abs(expected - tree.total) <= 0.005,
  };
}

/**
 * The seven revenue roots, with the V-code subtotals that must equal each.
 *
 * ⭐⭐ IDS AND LABELS ARE DELIBERATELY IDENTICAL TO V2's `REVENUE_SECTIONS`, and
 * a test pins that. The V1 and V2 forms print DIFFERENT revenue line items, but
 * they group them under the SAME seven headings — so a revenue series runs
 * continuously across the FY2015/FY2016 generation boundary at root level, even
 * though the leaves below it change vocabulary. The expenditure side has no
 * such luck (see `buildV1ExpenditureTree`), and the asymmetry is real, not an
 * inconsistency to be tidied away.
 *
 * ⚠ Part II's subtotal is THREE cells — one per source column — exactly as V2's
 * is `TTL_2A`/`TTL_2B`/`TTL_2C`. V254 is the `Govt ID No.` column's total and
 * is not money.
 */
export const V1_REVENUE_SECTIONS = Object.freeze([
  { id: '1A', label: 'General Property Taxes', part: 'I', section: 'A', totalKeys: ['V109'] },
  { id: '1B', label: 'General Sales and Use Taxes', part: 'I', section: 'B', totalKeys: ['V113'] },
  { id: '1C', label: 'Excise or Selective Sales and Use Taxes or Fees', part: 'I', section: 'C', totalKeys: ['V119'] },
  { id: '1D', label: 'Licenses, Permits, and Fees', part: 'I', section: 'D', totalKeys: ['V124'] },
  { id: '2', label: 'Intergovernmental Revenues', part: 'II', section: null, totalKeys: ['V253', 'V255', 'V256'] },
  { id: '3A', label: 'Service Charges', part: 'III', section: 'A', totalKeys: ['V310'] },
  { id: '3B', label: 'Other Revenues', part: 'III', section: 'B', totalKeys: ['V319'] },
]);

/**
 * Build the V1 revenue tree: Parts I, II and III.
 *
 * Part IV (public utility / enterprise REVENUES) is excluded by the form's own
 * scope statement, exactly as in V2. Never widen the tree to close a gap.
 *
 * ⚠ A line's root comes from the section heading printed ABOVE it, not from its
 * V-code's numeric range. Codes run in printed order today, and a form revision
 * that inserted a line would silently re-band every line after it under a
 * range rule. The oracle then catches any misassignment, because a root whose
 * items do not reach its own printed subtotal fails.
 */
export function buildV1RevenueTree(pageRead, extract = {}, anomalies = []) {
  const roots = V1_REVENUE_SECTIONS.map((s) => ({ id: s.id, label: s.label, amount: 0, items: [] }));
  const byId = Object.fromEntries(roots.map((r) => [r.id, r]));
  for (const r of pageRead.rows) {
    if (r.isTotal) continue;
    const sec = V1_REVENUE_SECTIONS.find(
      (s) => s.part === r.part && (s.section === null || s.section === r.section),
    );
    if (!sec) continue;
    let amount = 0;
    for (let i = 0; i < r.codes.length; i++) {
      const printed = num(r.amounts[i]);
      const v = Number.isNaN(printed) ? 0 : printed;
      amount += v;
      crossCheck(r.codes[i], r.label, v, extract, anomalies, sec.id);
    }
    byId[sec.id].items.push({ code: r.codes[0], label: r.label, amount });
    byId[sec.id].amount += amount;
  }
  return { roots, total: roots.reduce((a, x) => a + x.amount, 0) };
}

/**
 * Oracle: every revenue root must equal the publisher's own printed subtotal.
 *
 * `total = sum of items` would be tautological; `total = DCA's own cell` is not.
 * ⚠⚠ A subtotal that is an Excel error SKIPS, and a skip is reported, never
 * counted as a pass.
 */
export function checkV1SectionTotals(tree, extract = {}, pageTotals = {}, anomalies = []) {
  const checks = [];
  for (const sec of V1_REVENUE_SECTIONS) {
    const root = tree.roots.find((r) => r.id === sec.id);
    if (!root) continue;
    let expected = 0;
    let found = 0;
    let errored = null;
    for (const key of sec.totalKeys) {
      const onPage = pageTotals[key];
      const raw = extract[key];
      // ⚠⚠ THE PRINTED SUBTOTAL WINS. It is the figure the government filed;
      // the extract cell is derived from it by a formula that demonstrably
      // breaks (see V1_EXTRACT_SUBTOTAL_GAPS). Where the page prints nothing,
      // the extract is still a valid oracle and is used.
      const havePage = onPage !== null && onPage !== undefined && !isErrorValue(onPage);
      if (havePage) {
        found++;
        expected += num(onPage);
        if (raw !== null && raw !== undefined && !isErrorValue(raw)
          && Math.abs(num(raw) - num(onPage)) > 0.005
          && !V1_EXTRACT_SUBTOTAL_GAPS.has(key)) {
          anomalies.push({
            kind: 'extract_subtotal_disagrees_with_form', section: sec.id, code: key,
            label: `Total ${sec.label}`, form: num(onPage), extract: num(raw),
            delta: num(raw) - num(onPage),
          });
        }
        continue;
      }
      if (isErrorValue(onPage)) { errored = key; break; }
      if (isErrorValue(raw)) { errored = key; break; }
      if (raw === null || raw === undefined) continue;
      found++;
      expected += num(raw);
    }
    if (errored) {
      checks.push({ id: sec.id, tag: 'rev', skipped: true, reason: `subtotal ${errored} is an Excel error cell` });
      continue;
    }
    if (!found) {
      checks.push({ id: sec.id, tag: 'rev', skipped: true, reason: `none of ${sec.totalKeys.join('/')} present` });
      continue;
    }
    checks.push({
      id: sec.id, tag: 'rev', expected, actual: root.amount,
      ok: Math.abs(expected - root.amount) <= 0.005,
    });
  }
  return checks;
}

/**
 * Oracle the Part-level rollup, one level above the section subtotals.
 *
 * ⚠ Only Part I carries a printed grand total in V1 (`V125`, captioned "TOTAL
 * PART I - Sum of lines 109 + 113 + 119 + 124"). Part III prints its two
 * section totals and no Part total, and there is no V1 analogue of V2's
 * `TTL_OSR`. Checking a total the form does not print would mean inventing one.
 */
export function checkV1PartTotals(tree, extract = {}) {
  const checks = [];
  const amt = (id) => tree.roots.find((r) => r.id === id)?.amount ?? 0;
  const raw = extract.V125;
  if (raw !== undefined && raw !== null && !isErrorValue(raw)) {
    const part1 = amt('1A') + amt('1B') + amt('1C') + amt('1D');
    checks.push({
      id: 'Part I', tag: 'rev', expected: num(raw), actual: part1,
      ok: Math.abs(num(raw) - part1) <= 0.005,
    });
  } else if (isErrorValue(raw)) {
    checks.push({ id: 'Part I', tag: 'rev', skipped: true, reason: 'total V125 is an Excel error cell' });
  }
  return checks;
}

/**
 * Read a V1 filing's own metadata: fiscal month, audit status, declared year.
 *
 * ⚠⚠ THIS TAKES THE LIVE `Exportable Data` FLAT MAP AND NOTHING ELSE, BY
 * DESIGN. The `Data` twin's `MO` is garbage — measured across the sample, Banks
 * reads `2005`/`2007`/`2009` and Cobb and DeKalb read `0`, where the live sheet
 * reads the true `June 30` / `September 30`. Taking the merged map here would
 * be correct only by luck, so the rule is enforced by the signature.
 *
 * ⚠ The fiscal month comes from `V98` (the printed year END), with FNLOG's `MO`
 * as the fallback within the same sheet. `monthFromEndText` returns null for
 * anything it does not recognise and NEVER defaults —
 * `project_fysm_column_default_one_defect` is the story of why.
 *
 * ⚠ A raw `"0"` in the audited flag is NOT STATED, never "No" — the same trap
 * V2 carries.
 *
 * The returned shape matches V2's `readLog1` so the loader's `resolveMonth`,
 * `auditBranch` and source-string builders work on either generation unchanged.
 */
export function readV1Log(live = {}) {
  const raw = (k) => cellText(live[k]);
  const auditedRaw = raw('V97');
  let audited = null; // null === not stated
  if (/^yes$/i.test(auditedRaw)) audited = true;
  else if (/^no$/i.test(auditedRaw)) audited = false;

  const endText = raw('V98') || raw('MO');
  const months = live.V99;
  const declared = live.V100 ?? live.YEAR;
  return {
    government: raw('CONTACT'),
    fyEndMonthText: endText,
    fyEndMonth: monthFromEndText(endText),
    monthsReported: months === null || months === undefined ? null : num(months),
    // ⚠ V1 has no `MoChng` field. Reporting `false` would assert the form said
    // "no change" when it said nothing at all.
    monthChanged: null,
    audited,
    auditedRaw,
    declaredYear: declared === null || declared === undefined ? null : num(declared),
  };
}

/** Sheets a V1 workbook must carry. The page list is what `V1_PAGE_GEOMETRY` reads. */
export const V1_EXTRACT_SHEET = 'Exportable Data';
export const V1_TWIN_SHEET = 'Data';

/**
 * Read one V1 filing end to end.
 *
 * @param {Object}   arg
 * @param {Object}   arg.pages       sheet name -> grid, for Pages 1-3
 * @param {Array}    arg.exportable  the `Exportable Data` grid
 * @param {Array}    [arg.data]      the `Data` twin grid, when the workbook has one
 * @param {number}   [arg.fiscalYear] the year the FILENAME claims, for the guard
 */
export function readV1Filing({ pages, exportable, data, fiscalYear = null }) {
  const live = parseExportable(exportable || []);
  const twin = parseExportable(data || []);
  const { merged, notes } = mergeTwins(live.flat, twin.flat);

  const pageRead = readV1Pages(pages);
  const anomalies = [];
  const exp = buildV1ExpenditureTree(pageRead, merged, anomalies);
  const rev = buildV1RevenueTree(pageRead, merged, anomalies);
  // ⚠ The LIVE sheet only — never the merged map. See readV1Log.
  const log1 = readV1Log(live.flat);

  const checks = [
    ...checkV1SectionTotals(rev, merged, pageRead.totals, anomalies),
    ...checkV1PartTotals(rev, merged),
    checkV1ExpenditureTotal(exp, merged),
  ];

  // ⚠ THE FORM STATES ITS OWN FISCAL YEAR, so the filename is checkable rather
  // than merely trusted. V2 had no such field. A disagreement is surfaced for
  // the caller to refuse on; it is not resolved here, because neither side is
  // obviously right and guessing would mint a filing under the wrong year.
  const yearConflict = fiscalYear !== null && log1.declaredYear !== null
    && Number(fiscalYear) !== Number(log1.declaredYear)
    ? { filename: Number(fiscalYear), form: Number(log1.declaredYear) }
    : null;

  return {
    generation: 'v1', exp, rev, log1, checks, anomalies,
    twinNotes: notes, yearConflict,
  };
}
