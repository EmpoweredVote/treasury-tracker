/**
 * Turn one Ohio AOS spreadsheet row into a category tree without duplicating
 * a root or inventing a figure.
 *
 * NO SHEBANG — a test imports this module. The loader is scripts/loadOhioAOS.js.
 *
 * ── ⚠⚠ THE TWO QUIRKS THIS EXISTS FOR ──────────────────────────────────────
 *
 * Ohio publishes a wide table under a FOUR-ROW header: section (Revenues /
 * Expenditures), group (Current / Debt Service), subgroup (Security Of Persons
 * And Property), then the leaf. Reading only the leaf row produced 1,778
 * budgets with duplicate root categories across 212 entities.
 *
 * 1. A VERBATIM REPEATED COLUMN. In the FY2024 GAAP city workbook columns 11
 *    and 12 are both "Rentals" carrying the IDENTICAL value — 237 of 237
 *    cities. The publisher's own Total counts it once, so reading both
 *    double-counts: revenue tied for 146/237 before and 237/237 after.
 *
 * 2. A LEAF LABEL REUSED UNDER DIFFERENT GROUPS. "Other" is both
 *    Current → Security Of Persons And Property → Other (col 19) and
 *    Debt Service → Other (col 33). Different money, same word.
 *
 * ⚠⚠ THE TWO NEED OPPOSITE HANDLING, which is why the rule keys on the AMOUNT
 * as well as the label. Same label AND same amount is the publisher repeating
 * itself, so one copy is dropped. Same label with a DIFFERENT amount is two
 * real categories, so they are told apart — merging them would invent a figure
 * and dropping one would lose it.
 *
 * ⚠ A colon, never an em dash. The API serves `data_source` double-encoded for
 * every em-dash label, and these names ride the same path.
 */

/**
 * @param {Array<{label: string, amount: number|null, group?: string}>} cells
 *   one entry per source column, in sheet order
 * @returns {{tree: Array<{n: string, a: number}>, skipped: Array<object>}}
 */
export function buildOhioTree(cells) {
  const kept = [];
  const skipped = [];

  for (const cell of cells) {
    const label = String(cell.label ?? '').trim();
    const amount = Number(cell.amount);
    // Blank labels and zero/absent amounts were never part of the tree.
    if (!label || !Number.isFinite(amount) || amount === 0) continue;

    // ⚠ The publisher repeating a column verbatim. Its Total counts it once,
    // so a second copy is not a category — it is the same category twice.
    if (kept.some((k) => k.label === label && k.amount === amount)) {
      skipped.push({ label, amount, why: 'verbatim repeat' });
      continue;
    }
    kept.push({ label, amount, group: String(cell.group ?? '').trim() });
  }

  // ⚠ Disambiguate ONLY a genuine collision. Reader-facing text: a unique
  // label keeps the publisher's own wording.
  const seen = new Map();
  for (const k of kept) seen.set(k.label, (seen.get(k.label) ?? 0) + 1);

  const used = new Set();
  const tree = kept.map((k) => {
    let name = k.label;
    if (seen.get(k.label) > 1) {
      name = k.group ? `${k.group}: ${k.label}` : k.label;
      // ⚠ Two columns with one label and no group to separate them still must
      // not collide: a duplicate root is the whole defect, and merging two
      // different amounts would invent a figure that no filing reports.
      if (used.has(name)) {
        let n = 2;
        while (used.has(`${name} (${n})`)) n += 1;
        name = `${name} (${n})`;
      }
    }
    used.add(name);
    return { n: name, a: k.amount };
  });

  tree.sort((x, y) => y.a - x.a);
  return { tree, skipped };
}
