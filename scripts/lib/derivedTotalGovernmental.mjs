/**
 * SCOPE-04 — derive Total Governmental from published all-funds components.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs. Pure: no I/O beyond reading the
 * committed vocabulary at import, so it is unit-testable without a database.
 *
 * Spec: docs/superpowers/specs/2026-08-21-scope-04-design.md §2
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The era-B root vocabulary, GENERATED from the live database, never transcribed.
 * ⚠ Punctuation variants are real: `Intergovernmental – State` (en dash) and
 * `Intergovernmental - State` (hyphen) both occur, as do `Taxes – Other` and the
 * two enterprise typos below.
 */
export const KNOWN_ROOTS = new Set(
  JSON.parse(readFileSync(join(here, '..', 'data', 'eraBRootVocabulary.json'), 'utf8')),
);

/**
 * ⚠ Match LOOSELY. The vocabulary is closed but carries typos --
 * `Hospital Enterprise Fund Fund` (duplicated word, 84 rows) and
 * `Gas  Enterprise Fund` (double space, 78 rows) -- so an exact list would miss
 * 162 rows across 21 entities.
 *
 * ⚠ `Public Utilities` and `Public Utilities and Other Expenditures` are
 * GOVERNMENTAL and must NOT match: ruled in PR #36 and proven to the dollar
 * against two audited ACFRs (Cerritos FY2017 69,951,331, Lakewood FY2017
 * 57,831,166). The SCO feed points the wrong way here -- the rows are
 * utility-named (`CURR_EXP_WATER`) but `CURR_EXP_*` is the *governmental*
 * schedule. Tie the total; never match function names.
 */
export function isEnterpriseRoot(name) {
  return /(enterprise|internal service)/i.test(name);
}

/**
 * TG = Σ governmental roots. NEVER all_funds − enterprise.
 *
 * The two are algebraically identical here (0 of 23,260 rows fail to sum), but
 * Σ-governmental is IMMUNE to enterprise-side defects, which is what makes the
 * 44 negative-enterprise rows a disclosure problem on the slice rather than a
 * correctness problem in the figure.
 *
 * ⚠ `unrecognised` is the load-bearing return value. Classification is a
 * NEGATIVE match, so an enterprise-like root under a new name -- "Wastewater
 * Utility Fund", say -- would otherwise be silently counted as governmental and
 * inflate TG with no arithmetic gate able to see it. Callers must REFUSE the row
 * when this is non-empty, never warn and continue.
 *
 * @param {Array<{name: string, amount: number}>} roots the row's root categories
 * @returns {{totalGovernmental: number, enterprise: number, unrecognised: string[]}}
 */
export function deriveTotalGovernmental(roots) {
  let totalGovernmental = 0;
  let enterprise = 0;
  const unrecognised = [];
  for (const r of roots) {
    if (!KNOWN_ROOTS.has(r.name)) unrecognised.push(r.name);
    if (isEnterpriseRoot(r.name)) enterprise += r.amount;
    else totalGovernmental += r.amount;
  }
  return { totalGovernmental, enterprise, unrecognised };
}

/**
 * Is this parent row one this derivation covers at all?
 *
 * ⚠⚠ THE SCOPE USED TO BE IMPLICIT, AND THAT BROKE A TRIPWIRE. Every row in
 * the era-B all_funds population was triaged, so 50,304 rows belonging to New
 * York, Michigan, Pennsylvania and the rest fell through the enterprise-root
 * test into `skip-no-enterprise` and made it read 51,257 against an
 * `expect 852` that had only ever described the 953 CA State Controller rows
 * that genuinely have no enterprise root. The expectation was never stale; the
 * MEASUREMENT had quietly become a different quantity.
 *
 * ⚠ It only worked because no non-SCO loader happens to name a root
 * "Enterprise" — measured, 0 of 50,304. That is luck. A row that did would sail
 * past the enterprise filter into the vocabulary guard and HALT the entire run
 * over a government this derivation was never about.
 *
 * ⚠ A PREFIX, not the four known labels, on purpose: an unregistered CA SCO
 * family must stay IN scope so it reaches the "no derived label" HALT and gets
 * registered. A new family loading unregistered has happened twice with no gate
 * seeing it. \b stops it matching a label that merely mentions the SCO.
 */
export function isInDerivationScope(dataSource) {
  return typeof dataSource === 'string' && /^CA State Controller\b/.test(dataSource);
}
