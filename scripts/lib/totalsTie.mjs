/**
 * Does a budget's headline total equal the sum of its own root categories?
 *
 * NO SHEBANG — a test imports this module. The driver that reads the database
 * is scripts/verifyTotalsTieToTree.mjs.
 *
 * ── ⚠⚠ WHY THIS EXISTS ─────────────────────────────────────────────────────
 *
 * Nothing asserted it, and on 2026-11-01 a check written in one query found
 * 1,765 Ohio AOS rows whose stored total contradicts their own tree — 211
 * entities, average gap $7.0M — and 13 that publish a NEGATIVE total. The
 * worst, Huber Heights FY2024 operating, reads −$35,461,443 while its only two
 * root categories sum to +$10,483,560.
 *
 * ⭐ 100% of those 1,765 carry DUPLICATE ROOT-CATEGORY NAMES. That is the
 * mechanism, not a coincidence: the loader writes the same root twice.
 *
 * It surfaced while looking at an unrelated $1 budget in Indiana, which is the
 * point — a property everyone assumes and nothing verifies is found by
 * accident or not at all.
 *
 * ── ⚠ A RATCHET, NOT A PASS/FAIL ───────────────────────────────────────────
 *
 * Failing outright on 1,765 known rows would be a red light nobody can turn
 * green, and a light like that gets ignored — which is how the condition got
 * here. This fails on a REGRESSION against a recorded baseline and merely
 * reports an improvement, so the baseline can only be lowered deliberately.
 */

/** The only legitimate gap is a rounding artefact; amounts are integers. */
const TOLERANCE = 1;

/**
 * @param {{total: number|string, rootSum: number|string, nRoots: number}} budget
 * @returns {'rootless'|'ties'|'mismatch'}
 */
export function classifyBudgetTie({ total, rootSum, nRoots }, tolerance = TOLERANCE) {
  // ⚠ "No tree at all" is a DIFFERENT defect from "the tree disagrees", and
  // folding them together hides both. CA SCO carries 12 rootless rows.
  if (!nRoots) return 'rootless';
  return Math.abs(Number(total) - Number(rootSum)) > tolerance ? 'mismatch' : 'ties';
}

/**
 * Tally per source family and compare against the recorded baselines.
 *
 * ⚠ A source with NO baseline that breaks is a regression, not a new normal.
 * Without that rule one source improving could mask another breaking, because
 * a single fleet-wide total would stay flat.
 *
 * @param {Array<{source: string, total: number, rootSum: number, nRoots: number}>} rows
 * @param {Record<string, number>} baseline        known mismatches per source
 * @param {Record<string, number>} negativeBaseline known negative totals per source
 */
export function summarizeTies(rows, baseline = {}, negativeBaseline = {}) {
  const bySource = {};
  const negatives = {};
  const rootless = {};

  for (const r of rows) {
    const verdict = classifyBudgetTie(r);
    if (verdict === 'mismatch') bySource[r.source] = (bySource[r.source] ?? 0) + 1;
    if (verdict === 'rootless') rootless[r.source] = (rootless[r.source] ?? 0) + 1;
    // ⚠ Counted SEPARATELY and on its own baseline: a negative headline is
    // indefensible to a reader even when it ties its own tree.
    if (Number(r.total) < 0) negatives[r.source] = (negatives[r.source] ?? 0) + 1;
  }

  return ratchet({ bySource, negatives, rootless }, baseline, negativeBaseline);
}

/**
 * The same ratchet, fed by the database's own per-source aggregate.
 *
 * ⚠⚠ ONE COMPARISON, TWO CALLERS. The aggregate spans 585,587 budgets and all
 * their categories, so `treasury.totals_tie_status()` counts server-side while
 * `--check` judges rows locally. A second copy of the comparison is how two
 * declarations of one rule drift apart.
 *
 * @param {Array<{source: string, mismatches: number, negatives: number, rootless: number}>} counts
 */
export function summarizeCounts(counts, baseline = {}, negativeBaseline = {}) {
  const bySource = {};
  const negatives = {};
  const rootless = {};
  for (const c of counts) {
    if (Number(c.mismatches) > 0) bySource[c.source] = Number(c.mismatches);
    if (Number(c.negatives) > 0) negatives[c.source] = Number(c.negatives);
    if (Number(c.rootless) > 0) rootless[c.source] = Number(c.rootless);
  }
  return ratchet({ bySource, negatives, rootless }, baseline, negativeBaseline);
}

function ratchet({ bySource, negatives, rootless }, baseline, negativeBaseline) {
  const regressions = [];
  const improvements = [];
  for (const [source, actual] of Object.entries(bySource)) {
    const want = baseline[source] ?? 0;
    if (actual > want) regressions.push({ source, baseline: want, actual });
    else if (actual < want) improvements.push({ source, baseline: want, actual });
  }
  // A source that improved all the way to zero never appears in bySource.
  for (const [source, want] of Object.entries(baseline)) {
    if (want > 0 && !(source in bySource)) improvements.push({ source, baseline: want, actual: 0 });
  }
  for (const [source, actual] of Object.entries(negatives)) {
    const want = negativeBaseline[source] ?? 0;
    if (actual > want) regressions.push({ source, baseline: want, actual, kind: 'negative' });
  }

  return {
    bySource,
    negatives,
    rootless,
    regressions,
    improvements,
    total: Object.values(bySource).reduce((a, b) => a + b, 0),
    ok: regressions.length === 0,
  };
}
