/**
 * Does TT still hold every row its publisher publishes?
 *
 * ⚠⚠⚠ WHY A GATE EXISTS FOR SOMETHING SO OBVIOUS. Nothing in TT compared a
 * stored row count to the publisher's. It did not have to be subtle to go
 * unseen: West Hollywood held 143 of 134,643 rows and LA City FY2025 held
 * 226,909 of 749,295 — roughly $6.06B of spending — while every cron run
 * logged `success` with rows_inserted 0 / rows_skipped 5000.
 *
 * ⚠ A SUM CANNOT CATCH THIS. `treasury_sync_transactions` recomputes
 * `budgets.total_budget` from whatever rows survived, so the headline always
 * ties to the transactions beneath it. Every total agreed and 99.9% of the
 * data was gone — the same self-consistency blindness as the publisher TOTAL
 * row (#336) and the stray 2009 date (#343).
 *
 * ── ⭐⭐ WHAT IS A FAILURE, AND WHAT IS MERELY NEWS ───────────────────────
 *
 * The sibling gate (out-of-period) pins an EXACT expected count per budget,
 * which works because its subjects are static published files. These are LIVE
 * APIs: LA City appends rows every week. An exact-count registry here would
 * go red every week BY DESIGN, and a gate that cries wolf weekly is a gate
 * nobody reads — so the invariant has to be the one that actually matters:
 *
 *   ⚠⚠ HARD FAIL  stored != published
 *                 shortfall → TT is dropping rows (THE defect)
 *                 surplus   → TT is duplicating them, which is what a
 *                             wholesale dataset replace looks like once it
 *                             re-mints every Socrata `:id`
 *
 *   NOTICE        stored == published but != the registry's baseline.
 *                 TT kept up with a publisher that restated. Nothing is
 *                 wrong; the baseline is stale and should be refreshed.
 *
 * Undeclared budgets, stale entries, duplicate keys and an unreachable
 * publisher all still FAIL — a budget nobody registered is a budget nobody
 * checked, and "could not look" must never read as "looked and agreed".
 */

export function coverageKey({ source, fiscalYear, fiscal_year }) {
  const year = fiscalYear ?? fiscal_year;
  return `${String(source ?? '').trim().toLowerCase()}::fy${year}`;
}

/**
 * `observations` are `{ source, fiscalYear, stored, published }` — `stored`
 * from the database, `published` from the publisher's own count query, or
 * null when the publisher could not be reached.
 */
export function classifyCoverage(observations, registry) {
  const byKey = new Map();
  const duplicates = [];
  for (const e of registry) {
    const k = coverageKey(e);
    if (byKey.has(k)) duplicates.push(k);
    else byKey.set(k, e);
  }

  const ok = [];
  const undeclared = [];
  const shortfall = [];
  const surplus = [];
  const baselineMoved = [];
  const unreachable = [];
  const seen = new Set();

  for (const obs of observations) {
    const k = coverageKey(obs);
    seen.add(k);
    const entry = byKey.get(k);
    if (!entry) { undeclared.push(obs); continue; }
    if (obs.published === null || obs.published === undefined || Number.isNaN(Number(obs.published))) {
      unreachable.push({ obs, entry });
      continue;
    }
    const stored = Number(obs.stored);
    const published = Number(obs.published);
    if (stored < published) {
      shortfall.push({ obs, entry, stored, published, missing: published - stored });
    } else if (stored > published) {
      surplus.push({ obs, entry, stored, published, extra: stored - published });
    } else {
      // They agree. The only remaining question is whether our recorded
      // baseline still describes the world.
      if (Number(entry.rows) !== stored) {
        baselineMoved.push({ obs, entry, baseline: Number(entry.rows), now: stored });
      }
      ok.push({ obs, entry });
    }
  }

  const stale = registry.filter((e) => !seen.has(coverageKey(e)));
  return { ok, undeclared, shortfall, surplus, baselineMoved, unreachable, stale, duplicates };
}

/** ⚠ `baselineMoved` is deliberately NOT a failure — see the header. */
export function isClean({ undeclared, shortfall, surplus, unreachable, stale, duplicates }) {
  return undeclared.length === 0 && shortfall.length === 0 && surplus.length === 0
    && unreachable.length === 0 && stale.length === 0 && duplicates.length === 0;
}
