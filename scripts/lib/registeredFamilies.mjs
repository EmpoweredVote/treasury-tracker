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

/**
 * Why this family may not be written, or null if it may.
 *
 * ⚠⚠ GRANDFATHERING IS DELIBERATE. The goal is that a loader cannot write
 * rows for a family NO registry entry matches; the non-goal is draining the
 * existing backlog. Only 1,966 of 5,929 live families (33.2%) match all three
 * active axes today, so a bare rule would refuse 2,150 existing families on
 * their next write — including a run whose whole purpose is to fix bad data.
 * A family already present in the database is let through, and its debt is
 * held flat by the provenance ratchet instead.
 *
 * ⭐ This does NOT weaken the enumerated-year design. "… (FY2026 actual, GAAP
 * basis)" is a different `data_source` string, so a year outside a registry's
 * window is a NEW family and is refused — which is exactly why the years are
 * enumerated rather than written `FY\d{4}`.
 *
 * @param {string} dataSource
 * @param {{exists?: boolean, fiscalYears?: number[]}} opts
 *   `exists` — is this data_source already in treasury.budgets?
 * @returns {string|null} the refusal, ready to print, or null to proceed
 */
export function familyRefusalReason(dataSource, opts = {}) {
  const name = typeof dataSource === 'string' ? dataSource.trim() : '';
  if (!name) return 'refusing to write a row with a blank data_source.';
  if (opts.exists) return null;

  const missing = missingAxes(name, opts.registries);
  if (missing.length === 0) return null;

  return [
    `unregistered source family: ${name}`,
    `  unmatched: ${missing.join(', ')}`,
    '',
    '  Nothing was written. This family has never been classified, so its rows',
    '  would publish with no provenance label and no gate would notice.',
    '',
    `  Add an entry to each of: ${missing.map((a) => `scripts/data/${AXIS_FILE[a]}`).join(', ')}`,
    '  then run: node scripts/syncRegisteredFamilies.mjs',
    '',
    suggestEntry(name, opts.fiscalYears ?? []),
  ].join('\n');
}

/**
 * Throw before a loader spends anything, if the gate would refuse this family.
 *
 * ⚠⚠⚠ CALL THIS FIRST — before fetching, scanning or downloading. For
 * `loadUtahTransparency.js --rollup` that means before the BigQuery scan,
 * which is billed. A refusal after the scan has already cost money, and the
 * operator, with nothing written, re-runs it.
 *
 * ⚠ It makes ONE tiny indexed existence query, so it gives the SAME answer as
 * the gate rather than a different one. That is not "network-free" in the
 * strictest sense, but it is a single PostgREST round trip against the
 * alternative of a 47 GiB scan — and a preflight that disagrees with the gate
 * is worse than no preflight, because it teaches people the check is noise.
 *
 * ⚠⚠ THIS IS A COURTESY, NEVER THE ENFORCEMENT. The RPC refuses too. Do not
 * drop that half on the grounds that every current loader calls this: the
 * whole premise is the loader written next year by someone who never read it.
 */
export async function assertRegisteredFamily(client, dataSource, opts = {}) {
  // A blank name is wrong whatever the probe says, so it is checked first.
  const blank = typeof dataSource !== 'string' || dataSource.trim() === '';
  if (blank) throw new Error(familyRefusalReason(dataSource, opts));

  let exists = false;
  if (client) {
    const { data, error } = await client.schema('treasury').from('budgets')
      .select('id').eq('data_source', dataSource).limit(1);
    // ⚠⚠ A FAILED PROBE MUST NOT BECOME A FALSE REFUSAL. Without the family's
    // presence we cannot tell grandfathered from new, and defaulting to "new"
    // would tell someone re-running a long-standing loader that their source
    // "has never been classified" — wrong, alarming, and caused by a
    // connection blip. The RPC is the real gate and still applies, so the
    // preflight stands aside rather than guessing. It is a courtesy; the
    // enforcement is downstream.
    if (error || !Array.isArray(data)) return;
    exists = data.length > 0;
  }
  const reason = familyRefusalReason(dataSource, { ...opts, exists });
  if (reason) throw new Error(reason);
}

const AXIS_FILE = Object.freeze({
  audit_grade: 'auditGradeRegistry.mjs',
  fund_scope: 'fundScopeRegistry.mjs',
  basis: 'basisRegistry.mjs',
  accounting_basis: 'accountingBasisRegistry.mjs',
});

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

  // ⚠ REPLACE EVERY OCCURRENCE. Several real family names carry the year
  // twice ("… FY2024 actual (FY2024 basis)"); substituting only the first
  // leaves a hard-coded year behind, so the entry matches one year while
  // claiming a window.
  const substituted = years.length
    ? name.replace(/FY\d{4}/g, `FY(?:${years.join('|')})`)
    : name;
  const didSubstitute = substituted !== name;
  const pattern = `/^${substituted}$/`;

  // ⚠⚠ The note only appears if a year class was actually written. A
  // "Years read" comment beside a pattern with no year in it says the window
  // was enumerated when nothing was — a lie in the one artifact whose whole
  // job is to be checkable.
  let yearNote = '';
  if (didSubstitute) {
    yearNote = `  // Years read: ${years.join(', ')}. ENUMERATE them — a bare FY\\d{4}\n`
      + '  // would grade a future filing off a document nobody has opened.\n';
  } else if (years.length) {
    // ⚠ The name carries no year, so one entry covers every year of this
    // family — there is nothing to enumerate and claiming otherwise would be
    // the lie this branch exists to avoid. Say what IS true: which years this
    // load held, and that the answer must therefore be year-invariant.
    yearNote = `  // Years in this load: ${years.join(', ')}. This family's name carries no\n`
      + '  // year, so ONE entry answers for every year — only correct if the answer\n'
      + '  // really is a property of the publisher rather than of one document.\n';
  }
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
