/**
 * Sorting out-of-period transactions into DECLARED and UNDECLARED.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── WHY A REGISTRY AND NOT A THRESHOLD ────────────────────────────────────
 *
 * Some out-of-period rows are real and TT keeps them on purpose. Frisco's
 * FY2019 register genuinely contains a row dated 2009-04-05, and under the
 * Milledgeville rule TT loads what the publisher published rather than
 * quietly repairing the date. So this gate can never simply demand zero.
 *
 * A COUNT threshold would be worse than useless: it would pass a brand-new
 * defect as long as some older one was already tolerated. Instead every
 * tolerated budget is named, with the EXACT number of rows expected and the
 * reason it is accepted.
 *
 * ── ⚠⚠ THE GUARD RUNS BOTH WAYS, AND THAT IS THE POINT ───────────────────
 *
 * Four outcomes, three of them failures:
 *
 *   declared    a hit whose budget is in the registry, same row count     ok
 *   undeclared  a hit nobody has written down                           FAIL
 *   mismatched  a declared budget whose row count MOVED                 FAIL
 *   stale       a registry entry with no hit at all                     FAIL
 *
 * `stale` is the one that is easy to leave out and the one that rots. If a
 * reload fixes a defect and the entry stays, the registry starts describing
 * a TT that no longer exists — and the next person reads it as current. An
 * entry that no longer matches anything is a lie about the data, so it fails
 * exactly as loudly as a new defect.
 *
 * `mismatched` catches the quiet case between those two: the budget still has
 * out-of-period rows, but not the ones somebody looked at. One row becoming
 * two is a new defect wearing an old defect's name.
 */

/** Build the registry key for a hit or an entry. Case and spacing are noise. */
export function periodKey({ municipality, state, fiscalYear, fiscal_year }) {
  const year = fiscalYear ?? fiscal_year;
  return [
    String(municipality ?? '').trim().toLowerCase(),
    String(state ?? '').trim().toLowerCase(),
    `fy${year}`,
  ].join('|');
}

/**
 * @param {Array<object>} hits        rows from treasury.out_of_period_transaction_status()
 * @param {Array<object>} exceptions  entries from scripts/data/outOfPeriodExceptions.mjs
 */
export function classifyOutOfPeriod(hits, exceptions) {
  const byKey = new Map();
  const duplicates = [];
  for (const e of exceptions) {
    const k = periodKey(e);
    // ⚠ Two entries for one budget make "the expected count" undefined, and
    // whichever is checked second would silently win. Refuse the ambiguity
    // rather than pick.
    if (byKey.has(k)) duplicates.push(k);
    else byKey.set(k, e);
  }

  const declared = [];
  const undeclared = [];
  const mismatched = [];
  const seen = new Set();

  for (const hit of hits) {
    const k = periodKey(hit);
    const entry = byKey.get(k);
    if (!entry) {
      undeclared.push(hit);
      continue;
    }
    seen.add(k);
    const expected = Number(entry.outRows);
    const actual = Number(hit.out_rows ?? hit.outRows);
    if (expected !== actual) mismatched.push({ hit, entry, expected, actual });
    else declared.push({ hit, entry });
  }

  const stale = exceptions.filter((e) => !seen.has(periodKey(e)));

  return { declared, undeclared, mismatched, stale, duplicates };
}

/** True when nothing needs a human. */
export function isClean({ undeclared, mismatched, stale, duplicates }) {
  return undeclared.length === 0
    && mismatched.length === 0
    && stale.length === 0
    && duplicates.length === 0;
}
