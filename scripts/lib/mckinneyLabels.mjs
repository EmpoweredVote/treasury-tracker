/**
 * McKinney department labels — the publisher's own names, and nothing else.
 *
 * ⚠⚠⚠ WHY THIS FILE EXISTS. McKinney's check register (the source behind
 * `McKinney Check Register FY2022-FY2025`) publishes a BARE 4-DIGIT CODE in its
 * `Department` column and no department name anywhere in the file. Treasury
 * Tracker nevertheless showed readers friendly names — `Risk Management`,
 * `Fleet & Vehicles`, `Development Reimbursements`. They were INVENTED.
 *
 * The project's own phase record says so in as many words: migration
 * `rename_mckinney_dept_categories` "mapped top ~90 codes to human-readable
 * names ... DERIVED FROM TOP-VENDOR ANALYSIS". And McKinney's `vendor_column`
 * is `description_1`, an INVOICE DESCRIPTION — so the names were guessed from
 * invoice text. A measured majority of the checkable ones were wrong:
 *
 *     2119  TT said `Risk Management`             — is INFORMATION TECHNOLOGY ($8.1M)
 *     4306  TT said `Development Reimbursements`  — is PARKS MAINTENANCE ($3.3M)
 *     1241  TT said `Parks Horticulture`          — is PLANNING
 *     1100  TT said `Performing Arts`             — is CITY COUNCIL / GENERAL GOVERNMENT
 *     9999  TT said `Economic Development Oblig.` — is NON-DEPARTMENTAL
 *
 * ── THE SOURCE ─────────────────────────────────────────────────────────────
 *
 * McKinney publishes an **Adopted Budget Worksheet** per fiscal year
 * (Archive.aspx?AMID=97). Its `Expenditure Budget` sheet carries the account
 * number — `fund-dept-object`, e.g. `001-4306-453.81-01` — ALONGSIDE a
 * `Department` and a `Division` column. That is the publisher's own code→name
 * map, contemporaneous with each check register, and it is unambiguous: in all
 * four years every code resolves to exactly one (Department, Division) pair.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 *
 * 1. The label is `Department - Division`, both the publisher's strings.
 * 2. When Division is absent or repeats Department, the label is Department
 *    alone — `Police`, not `Police - Police`.
 * 3. When two codes collide on that label, the publisher's FUND NAME
 *    disambiguates. This happens once: codes 1257 and 1247 are both
 *    `ADMINISTRATION / PROJECTS`, one inside MEDC and one inside MCDC — two
 *    different component-unit corporations. The fund is the publisher's data,
 *    not ours.
 * 4. ⛔ A code the publisher does NOT name is labelled with the publisher's own
 *    identifier — `Department 7777` — and NEVER with a guess. Appending a code
 *    to an invented name (`Fleet & Vehicles (3224)`) is strictly worse than the
 *    invention: it makes a fabrication look sourced. Two codes reach rule 4:
 *      7777 — used across every CIP construction fund; never named.
 *         0 — the `0000` account segment, carrying revenue and balance-sheet
 *             lines; never named.
 *
 * Casing is the only transform applied to a publisher string: the worksheets
 * are ALL CAPS and TT renders mixed case everywhere else. ACRONYMS is the
 * guard against `Cdbg` and `Mpac`.
 */

/**
 * Publisher strings that are acronyms, not words. Rendered verbatim.
 *
 * ⚠ EVERY ENTRY MUST OCCUR IN THE PUBLISHER MAP as a whole token, and a test
 * asserts it. A speculative list is how `Mhfc` and `Tirz` would have arrived in
 * the UI having never been in McKinney's data at all — the same failure as the
 * invented names, in miniature.
 */
export const ACRONYMS = new Set([
  'APEX',   // APEX Centre, the recreation facility
  'CDBG',   // Community Development Block Grant
  'GO',     // general obligation, written `G.O.` by the publisher
  'MCDC',   // McKinney Community Development Corporation
  'MCK',    // the publisher's own abbreviation of McKinney
  'MCVB',   // McKinney Convention & Visitors Bureau
  'MEDC',   // McKinney Economic Development Corporation
  'MPAC',   // McKinney Performing Arts Centre
]);

/** Short words that stay lowercase inside a name, never at its start. */
const MINOR = new Set(['a', 'and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

/**
 * ALL CAPS -> Title Case, preserving acronyms, hyphens, slashes and `&`.
 *
 * ⚠ Splits on word characters only, so `WATER/WASTEWATER` keeps its slash and
 * `PARK & REC ADMINISTRATION` keeps its ampersand. A token already containing a
 * lowercase letter is left alone — the publisher occasionally ships mixed case
 * and we are not here to restyle it.
 */
export function titleCaseName(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/[a-z]/.test(s)) return s;           // already mixed case — leave it
  let first = true;
  return s.replace(/[A-Za-z0-9'.]+/g, (tok) => {
    const bare = tok.replace(/[^A-Za-z0-9]/g, '');
    let out;
    // ⚠ Upper-case the TOKEN, not the bare form: the publisher writes `G.O.`
    // and dropping its periods would be us restyling its string, not casing it.
    if (ACRONYMS.has(bare.toUpperCase())) out = tok.toUpperCase();
    else if (!first && MINOR.has(tok.toLowerCase())) out = tok.toLowerCase();
    else out = tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
    first = false;
    return out;
  });
}

/**
 * The label for one department code, from one year's publisher map.
 *
 * `entry` is `{ dept, div, fund }` as extracted from the Adopted Budget
 * Worksheet, or null/undefined when the publisher never named the code.
 * `qualify` asks for rule 3 — the caller decides, because only the caller can
 * see the whole year and know whether this label collides.
 */
export function labelFor(code, entry, { qualify = false } = {}) {
  if (!entry || !entry.dept) return `Department ${code}`;
  const dept = titleCaseName(entry.dept);
  const div = titleCaseName(entry.div);
  const base = (!div || div.toLowerCase() === dept.toLowerCase()) ? dept : `${dept} - ${div}`;
  if (!qualify) return base;
  const fund = titleCaseName(entry.fund);
  return fund ? `${fund} - ${base}` : base;
}

/**
 * Label every code in one fiscal year, applying rule 3 only where it is needed.
 *
 * ⚠ Qualification is decided over the WHOLE year, never per code: a label is
 * only ambiguous relative to its siblings. Returns a Map code -> label.
 *
 * ⚠⚠ Throws when qualification fails to separate a collision. A duplicate label
 * is the exact defect this file exists to remove, so returning one quietly
 * would defeat the point — the gate in verifyTotalsTieToTree.mjs holds McKinney
 * at zero duplicates and this is what keeps that honest at the source.
 */
export function labelYear(codes, map) {
  const plain = new Map();
  for (const code of codes) plain.set(code, labelFor(code, map[code]));

  const seen = new Map();
  for (const [code, label] of plain) {
    if (!seen.has(label)) seen.set(label, []);
    seen.get(label).push(code);
  }

  const out = new Map();
  for (const [label, group] of seen) {
    if (group.length === 1) { out.set(group[0], label); continue; }
    for (const code of group) out.set(code, labelFor(code, map[code], { qualify: true }));
  }

  const after = new Map();
  for (const [code, label] of out) {
    if (after.has(label)) {
      throw new Error(
        `McKinney label collision survives fund qualification: "${label}" is shared by ` +
        `codes ${after.get(label)} and ${code}. The publisher names them identically and ` +
        `gives no third distinguishing field. Do NOT append the code to paper over this — ` +
        `find what the publisher calls them apart by, or leave the budget unlabelled.`,
      );
    }
    after.set(label, code);
  }
  return out;
}

// ⚠ The falsy-zero guard lives in publisherIds.mjs because the bug is GENERAL,
// not McKinney's: any publisher that numbers something from zero hits it. It is
// re-exported here so the McKinney tests exercise the thing the loader imports.
export { idOrNull } from './publisherIds.mjs';
