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
 *
 * ── ⭐⭐ AND A FIFTH OUTCOME: THE PUBLISHER MOVED, AND TT KEPT UP ───────────
 *
 * The four outcomes above were written for STATIC published files, and they
 * are wrong for a live one. West Hollywood's FY2025-26 register is the city's
 * CURRENT register: its out-of-period count went 1,164 → 6,393 in a day, and
 * the registry predicts ~1,500 more a month. Under the rules above this gate
 * would go red every month on a budget where red means nothing new, which is
 * how a gate stops being read.
 *
 *   publisherConfirmed   the count MOVED, and the publisher's own data holds
 *                        exactly the number TT now holds              NOTICE
 *
 * ⚠⚠ THIS IS NOT A TOLERANCE. The comparison is still exact — it is against
 * the live publisher instead of a number somebody wrote down once, so nothing
 * can hide inside an old defect's allowance. A count that moves and does NOT
 * match the publisher is still `mismatched`, and still fails.
 *
 * ⚠⚠⚠ A MISSING PUBLISHER COUNT IS NOT AGREEMENT. `publisherCounts` maps a
 * key to a number, or to null when the publisher could not be asked. null
 * falls through to `mismatched` — "could not look" must never read as "looked
 * and agreed", the same rule the row-coverage gate holds.
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
 * @param {Map<string, number|null>} [publisherCounts] keyed by periodKey — the
 *   publisher's OWN out-of-period count, or null where it could not be asked.
 *   Omitted entirely, every moved count fails as before.
 */
export function classifyOutOfPeriod(hits, exceptions, publisherCounts = new Map()) {
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
  const publisherConfirmed = [];
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
    if (expected === actual) {
      declared.push({ hit, entry });
      continue;
    }

    // ⚠ The count moved. Whether that is news or a defect is the publisher's
    // to settle, and ONLY an exact match settles it: `null` (could not ask)
    // and any disagreement both fall through to `mismatched`.
    const published = publisherCounts.get(k);
    if (published !== null && published !== undefined && Number(published) === actual) {
      publisherConfirmed.push({ hit, entry, expected, actual, published: Number(published) });
    } else {
      mismatched.push({ hit, entry, expected, actual, published: published ?? null });
    }
  }

  const stale = exceptions.filter((e) => !seen.has(periodKey(e)));

  return { declared, undeclared, mismatched, publisherConfirmed, stale, duplicates };
}

/**
 * True when nothing needs a human.
 *
 * ⚠ `publisherConfirmed` is deliberately absent — see the header. TT matching
 * a publisher that restated is NEWS, and failing on it is what would make this
 * gate cry wolf every month on West Hollywood's live register.
 */
export function isClean({ undeclared, mismatched, stale, duplicates }) {
  return undeclared.length === 0
    && mismatched.length === 0
    && stale.length === 0
    && duplicates.length === 0;
}
