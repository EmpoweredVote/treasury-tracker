/**
 * Which transaction sources have a rebuildable, SOURCED category tree.
 *
 * ⚠⚠ ENROLMENT IS OPT-IN, AND DELIBERATELY NARROW. Every transaction-backed
 * budget in this database got its tree from the same uncommitted one-off
 * migration, so every one of them has the same fragility — but they do not all
 * have the same answer. McKinney's roots are DEPARTMENT CODES with a published
 * name map; Frisco's and Plano's are VENDOR NAMES, which are already the label
 * and raise different questions (McKinney's "vendors" are invoice descriptions,
 * for one). Rebuilding a tree whose naming rule nobody has checked would be the
 * same mistake that put invented names on McKinney's money in the first place.
 *
 * A source not listed here is REFUSED by rebuildTransactionTree.mjs rather than
 * given a default. Add one only with a sourced naming rule and a test.
 */
import { readFileSync } from 'node:fs';
import { labelYear } from './mckinneyLabels.mjs';

const MCKINNEY = JSON.parse(
  readFileSync(new URL('../data/mckinneyDepartments.json', import.meta.url), 'utf8'),
);

/** Codes named in any year, so a department absent from one year's budget still resolves. */
function mckinneyUnion() {
  const out = {};
  for (const fy of Object.keys(MCKINNEY.byYear).sort()) {
    for (const [code, entry] of Object.entries(MCKINNEY.byYear[fy])) {
      if (!out[code]) out[code] = entry;
    }
  }
  return out;
}

/**
 * ⚠ `unknown` is what the falsy-zero bug made of department code 0. It is kept
 * here as an ALIAS so a rebuild run before the key backfill still resolves the
 * right name rather than refusing — but the backfill is the fix, and
 * verifyCategoryTreeMatchesTransactions.mjs reports any key still reading
 * `unknown`.
 */
const MCKINNEY_KEY_ALIASES = { unknown: '0' };

function mckinneyResolver(fiscalYear) {
  const map = { ...mckinneyUnion(), ...(MCKINNEY.byYear[String(fiscalYear)] || {}) };
  return (keys) => {
    const codes = keys.map((k) => MCKINNEY_KEY_ALIASES[k] ?? k);
    const labels = labelYear(codes, map);
    const out = new Map();
    keys.forEach((k, i) => out.set(k, labels.get(codes[i])));
    return out;
  };
}

const SOURCES = [
  {
    // "McKinney Check Register FY2024"
    match: /^McKinney Check Register FY(\d{4})$/,
    resolver: mckinneyResolver,
    source: MCKINNEY._source,
  },
];

/**
 * The name resolver for a data source, or null when it is not enrolled.
 * Returns `{ resolveNames, source }`.
 */
export function resolverFor(dataSourceName, fiscalYear) {
  for (const s of SOURCES) {
    if (s.match.test(String(dataSourceName || ''))) {
      return { resolveNames: s.resolver(fiscalYear), source: s.source };
    }
  }
  return null;
}

/** True when this source's tree should be rebuilt after a load. */
export function isEnrolled(dataSourceName) {
  return SOURCES.some((s) => s.match.test(String(dataSourceName || '')));
}
