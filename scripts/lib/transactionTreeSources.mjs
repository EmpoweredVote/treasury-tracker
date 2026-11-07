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

/**
 * ── FRISCO: THE VENDOR NAME AS THE PUBLISHER WROTE IT ────────────────────
 *
 * ⚠⚠ This is the narrowest possible naming rule and that is deliberate. It
 * INVENTS NOTHING: the label is the `vendor_name` cell from Frisco's own
 * check register, carried through unchanged. There is no map, no lookup and
 * no judgement — which is what separates it from McKinney, whose roots are
 * numeric department CODES that needed a published name map before anything
 * could be called by a name.
 *
 * ⚠ Frisco's names are full ("NORTH TEXAS MUNICIPAL WATER DISTRICT"), unlike
 * PLANO's, which the publisher truncates to five characters — which is why
 * Plano's vendor axis was removed in #340 and must NOT be enrolled here.
 *
 * The key is `vendorLinkKey`, recovered by measurement against the five years
 * no reload touched: 10,892 distinct keys, 10,892 exact matches.
 */
function friscoResolver() {
  return (keys, ctx = {}) => {
    const byKey = ctx.vendorNameByKey instanceof Map ? ctx.vendorNameByKey : new Map();
    const out = new Map();
    // ⚠ No fallback. A key with no vendor name behind it means the join came
    // back short, and rollUpTransactions refuses rather than labelling money
    // with something TT made up.
    for (const k of keys) out.set(k, byKey.get(k));
    return out;
  };
}

/**
 * ── WEST HOLLYWOOD: THE PUBLISHED CATEGORY, AS THE CITY WROTE IT ─────────
 *
 * Narrower than Frisco's rule, which still has to look a name up by key. Here
 * the label IS the key. `column_mapping.expense_category_column` is `category`
 * and no department or fund column is mapped, so the loader's
 * `linkKey([department, fund, expense_category])` reduces to the `category`
 * cell unchanged — "Contracted Services", "Payroll Liabilities", "Debt
 * Service". There is no map, no lookup, no slug and no judgement.
 *
 * ⭐⭐ VERIFIED AGAINST THE PUBLISHER, NOT AGAINST TT'S OWN COPY. A tree built
 * from TT's transactions will always tie to TT's transactions; that proves
 * nothing about whether the categories are the city's. So the city was asked
 * the same question directly, per dataset:
 *
 *     $select=category,count(*),sum(amount_paid)&$group=category
 *
 * All eight years agree with the stored keys, row count for row count and
 * cent for cent. 20-23 categories a year — a readable breakdown, so unlike
 * Frisco there is no tail bucket and no `keepTop`.
 *
 * ⚠⚠ THE COMPOSITE-KEY GUARD BELOW IS LOAD-BEARING. `linkKey()` joins its
 * parts with "|", and today exactly one part survives. The day anyone maps a
 * fund_column on one of these sources, every key silently becomes
 * "General Fund|Contracted Services" — and an identity rule would print that
 * to a reader as the name of a category. That is how an unsourced label
 * starts looking sourced, so it refuses instead.
 */
function wehoCategoryResolver() {
  return (keys) => {
    const out = new Map();
    for (const k of keys) {
      if (typeof k === 'string' && k.includes('|')) {
        throw new Error(
          `West Hollywood key ${JSON.stringify(k)} is composite: more than one column went into ` +
          `linkKey(), so it is no longer the publisher's own category cell and must not be shown ` +
          `as a category name. Fix the column_mapping, or write a real naming rule for the new shape.`,
        );
      }
      out.set(k, k);
    }
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
  {
    // "Frisco Check Register FY2019"
    match: /^Frisco Check Register FY(\d{4})$/,
    resolver: friscoResolver,
    source: "The vendor_name column of Frisco's published check register, unchanged.",
    // ⚠ MEASURED from all eight stored Frisco years, every one of which holds
    // exactly 30 named roots plus one "Other Vendors". Reproducing the stored
    // convention is what keeps a no-change rebuild a no-op.
    keepTop: 30,
    tailKey: 'other-vendors',
    tailName: 'Other Vendors',
    // ⚠⚠ The ONLY source that needs the vendors join, and it must ask for it.
    // The join used to be unconditional and made McKinney's registers
    // unrebuildable — see the note on `transactionsOf`.
    needsVendorNames: true,
  },
  {
    // "West Hollywood Demand Register FY2018-19" … "FY2025-26"
    //
    // ⚠ The file TITLES are not the fiscal years — "FY2022-24" is TT's
    // FY2024 budget. The resolver does not care: it reads no year.
    match: /^West Hollywood Demand Register FY\d{4}-\d{2}$/,
    resolver: wehoCategoryResolver,
    source: "The category column of West Hollywood's published demand register, unchanged.",
  },
];

/**
 * The name resolver for a data source, or null when it is not enrolled.
 * Returns `{ resolveNames, source }`.
 */
export function resolverFor(dataSourceName, fiscalYear) {
  for (const s of SOURCES) {
    if (s.match.test(String(dataSourceName || ''))) {
      return {
        resolveNames: s.resolver(fiscalYear),
        source: s.source,
        // ⚠ Undefined for a source with no tail bucket, which is what
        // rollUpTransactions treats as "one root per key" — McKinney's shape.
        keepTop: s.keepTop ?? null,
        tailKey: s.tailKey ?? null,
        tailName: s.tailName ?? null,
        // ⚠ Defaults to FALSE: a source pays for the vendors join only by
        // declaring it needs one. See `transactionsOf`.
        needsVendorNames: s.needsVendorNames === true,
      };
    }
  }
  return null;
}

/** True when this source's tree should be rebuilt after a load. */
export function isEnrolled(dataSourceName) {
  return SOURCES.some((s) => s.match.test(String(dataSourceName || '')));
}
