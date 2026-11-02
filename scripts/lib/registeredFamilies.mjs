/**
 * Which source families are registered, and the patterns the database uses to
 * ask the same question.
 *
 * NO SHEBANG — a test imports this module, and a shebang in scripts/lib/
 * breaks the Vite transform on a CRLF checkout (see tests/waSao.test.mjs).
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * A loader writes rows, the axis columns default to `unknown` because no
 * registry entry matches the new `data_source`, and no gate reads the axis
 * columns at load time. Hawaii shipped that way twice. Measured 2026-11-01:
 * 1,302 rows are `unknown` on all four axes, nobody having chosen that.
 *
 * ── ⚠⚠⚠ THE THREE RULES THIS GETS WRONG IF YOU CHANGE IT CARELESSLY ─────────
 *
 * 1. IT TESTS FOR A MATCH, NEVER FOR A NON-`unknown` VALUE. 24,778 rows are
 *    honestly `unknown` on audit grade and that is CORRECT — SCOPE-01
 *    classified 33.2% as unknown rather than guess. A family whose considered,
 *    cited answer is `unknown` is REGISTERED. This is why the module does not
 *    reuse `budgetAxes.matchFor()`, which returns `{entryId: null}` for an
 *    `unknown` entry and so cannot tell "nothing matched" from "something
 *    matched and the answer is unknown".
 *
 * 2. THREE AXES, NOT FOUR. Measured across all 5,929 live families: only 62
 *    (1.0%), 62 rows of 585,631, match all four. `accounting_basis` has five
 *    entries, covers 374 families, and is `unknown` on 99.94% of rows. An
 *    all-four gate refuses every loader in the repo — a shutdown, not a gate.
 *    The active three pass for 1,966 families / 530,717 rows (90.6%).
 *
 * 3. POSTGRES TAKES THE PATTERNS VERBATIM. `~` uses ARE, not bare POSIX ERE,
 *    so `(?:…)`, `\d{4}`, escaped parens and the em dash all work unchanged.
 *    Only the JS `i` flag needs expressing, as an inline `(?i)`. Translating
 *    the patterns would add exactly the drift surface the gate exists to
 *    prevent: a pattern that silently fails to match is a green check over
 *    unlabelled data.
 */

import { AUDIT_GRADE_REGISTRY } from '../data/auditGradeRegistry.mjs';
import { FUND_SCOPE_REGISTRY } from '../data/fundScopeRegistry.mjs';
import { BASIS_REGISTRY } from '../data/basisRegistry.mjs';
import { ACCOUNTING_BASIS_REGISTRY } from '../data/accountingBasisRegistry.mjs';

/**
 * The axes the gate requires. `accounting_basis` is deliberately absent —
 * see rule 2 above. It is still mirrored and still reported, just not required.
 */
export const ACTIVE_AXES = Object.freeze(['audit_grade', 'fund_scope', 'basis']);

const REGISTRIES = Object.freeze({
  audit_grade: AUDIT_GRADE_REGISTRY,
  fund_scope: FUND_SCOPE_REGISTRY,
  basis: BASIS_REGISTRY,
  accounting_basis: ACCOUNTING_BASIS_REGISTRY,
});

/**
 * The id of the entry matching `dataSource` on each axis, or null.
 *
 * @param {string} dataSource
 * @param {Record<string, Array<{id: string, match: RegExp}>>} [registries]
 * @returns {{audit_grade: string|null, fund_scope: string|null,
 *            basis: string|null, accounting_basis: string|null}}
 */
export function matchedAxes(dataSource, registries = REGISTRIES) {
  const out = {};
  const name = typeof dataSource === 'string' ? dataSource.trim() : '';
  for (const axis of Object.keys(registries)) {
    out[axis] = null;
    if (!name) continue;
    for (const entry of registries[axis] ?? []) {
      if (!(entry?.match instanceof RegExp)) continue;
      let hit;
      // A malformed pattern blocks its own family and nothing else — the same
      // rule budgetAxes.matchFor follows.
      try { hit = entry.match.test(name); } catch { continue; }
      if (hit) { out[axis] = entry.id; break; }
    }
  }
  return out;
}

/** The ACTIVE axes this family fails. Empty means registered. */
export function missingAxes(dataSource, registries = REGISTRIES) {
  const m = matchedAxes(dataSource, registries);
  return ACTIVE_AXES.filter((axis) => m[axis] == null);
}

/**
 * Every registry entry as a row the database can match with `~`.
 * @returns {Array<{axis: string, entry_id: string, pattern: string}>}
 */
export function mirrorRows(registries = REGISTRIES) {
  const rows = [];
  for (const [axis, registry] of Object.entries(registries)) {
    for (const entry of registry ?? []) {
      if (!(entry?.match instanceof RegExp)) continue;
      const prefix = entry.match.flags.includes('i') ? '(?i)' : '';
      rows.push({ axis, entry_id: entry.id, pattern: prefix + entry.match.source });
    }
  }
  return rows;
}

/** Regex-escape a literal family name. */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The paste-ready registry entry a refusal hands back.
 *
 * ⚠ The two blanks are deliberate and are the whole point: the machine fills
 * in what it knows (the exact family name, the years actually present in this
 * load) and leaves the value and the evidence to a human, because asserting
 * "audited" means naming the opinion you read. `validateAxisRegistry` enforces
 * that an entry whose value is not `unknown` carries evidence.
 *
 * ⚠⚠ The years are ENUMERATED, never `FY\d{4}`. A bare year class grades a
 * future filing the moment it loads, off a document nobody has opened.
 */
export function suggestEntry(dataSource, fiscalYears = []) {
  const years = [...new Set(fiscalYears)].filter(Number.isFinite).sort((a, b) => a - b);
  const name = escapeRe(dataSource);
  const pattern = years.length
    ? `/^${name.replace(/FY\d{4}/, `FY(?:${years.join('|')})`)}$/`
    : `/^${name}$/`;
  const yearNote = years.length
    ? `  // Years read: ${years.join(', ')}. ENUMERATE them — a bare FY\\d{4}\n`
      + '  // would grade a future filing off a document nobody has opened.\n'
    : '';
  return [
    '{',
    `  id: '<short-kebab-id>',`,
    `  match: ${pattern},`,
    yearNote + `  value: TODO,   // one of the axis's legal values`,
    '  evidence: {',
    `    document: '',  // what you read, where it came from, and any caveat`,
    `    figures: '',   // the proof, and anything that corroborates it`,
    '  },',
    '},',
  ].join('\n');
}
