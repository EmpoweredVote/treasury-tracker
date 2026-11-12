/**
 * The provenance ratchet: what a reader cannot get from a row today, held
 * flat so it can only shrink.
 *
 * NO SHEBANG — a test imports this module.
 *
 * ⚠⚠ THE GATE AND THE RATCHET DO DIFFERENT JOBS, AND BOTH ARE NEEDED. The
 * gate (in treasury_sync_city_budget) stops a NEW unregistered family being
 * written at all. It deliberately grandfathers families already present,
 * because only 1,966 of 5,929 match all three active axes and refusing the
 * rest would block the very re-runs that fix bad data. That leaves standing
 * debt — and debt nobody counts is debt that grows. This counts it.
 *
 * Measured 2026-11-02:
 *     3,963 unregistered families   54,914 rows
 *     24,947 rows with no source_url
 *
 * ⚠ A ratchet, not a pass/fail gate: a source worse than its recorded
 * baseline fails; equal passes; better passes and says so. Same shape as
 * scripts/lib/totalsTie.mjs, which this follows deliberately — a second
 * vocabulary for the same idea is a second thing to learn.
 */

/**
 * `dataset_type`s whose axes are answered by the SHAPE of the record rather
 * than by a registry entry about its publisher.
 *
 * ⚠⚠ MIRRORS `NOT_APPLICABLE_DATASET_TYPES` in scripts/stampNotApplicableGrade.mjs,
 * and deliberately does not import it — that module opens a Supabase client at
 * import time, and a pure ratchet must stay unit-testable without a database.
 * tests/provenanceShapeAnswered.test.mjs pins the two lists to the same pair.
 *
 * ── WHY AN EXCUSE EXISTS AT ALL ─────────────────────────────────────────────
 *
 * A check, payroll or demand register is not a financial statement, so the
 * audit question does not APPLY to it. `stampNotApplicableGrade.mjs` answers it
 * from `dataset_type`, and `tests/auditGradeRegistry.test.mjs` PINS
 * `not_applicable` out of the audit-grade registry on purpose: "a registry
 * entry would dress a row-shape fact as a publisher judgement, and would have
 * to be repeated for all 26 salary and transaction sources and every future
 * one."
 *
 * The ratchet was therefore asking a registry a question that registry is
 * designed never to answer — and because these family names embed the fiscal
 * year (`Plano Check Register FY2026`), every October produced a brand-new
 * family that could never be registered. It failed on 2026-11-12 with seven
 * such entries. That is the calendar, not debt.
 *
 * ⚠⚠ THE EXCUSE COVERS `unregistered` ONLY, NEVER `linkless`. A payment
 * register still owes the reader a link; what it does not owe is an audit
 * opinion. All 71 of these rows were given their publisher URL in the same
 * change that added this, so the excuse is not covering for a gap — it is
 * describing a class of record correctly.
 */
export const SHAPE_ANSWERED_DATASET_TYPES = Object.freeze(['salaries', 'transactions']);

/**
 * Is EVERY row of this family a shape-answered record?
 *
 * ⚠ ALL, never SOME. A family holding both a register and a statement still
 * owes the statement's label, and `some()` here would excuse it.
 *
 * @param {Iterable<string>} datasetTypes every dataset_type present in the family
 */
export function familyIsShapeAnswered(datasetTypes) {
  const seen = [...(datasetTypes ?? [])];
  if (seen.length === 0) return false;
  return seen.every((t) => SHAPE_ANSWERED_DATASET_TYPES.includes(t));
}

/**
 * How many shape-answered rows have fallen back to "nobody said".
 *
 * ⚠⚠ THIS WATCHES THE THING THAT CAUSED THE ORIGINAL FAILURE. The excuse above
 * is only honest while the grade is actually applied; if
 * `budgets_fill_not_applicable_audit_grade` is dropped, these rows return to
 * `unknown`, the ratchet goes on excusing them, and a correct rule becomes a
 * blindfold. Measured 2026-11-12, thirteen days after `stampNotApplicableGrade.mjs`
 * last ran: 27 of 43 `transactions` rows had already decayed and nothing noticed.
 *
 * ⚠ ONLY shape-answered types are counted. 24,778 statement rows are honestly
 * `unknown` on audit grade and that is CORRECT — SCOPE-01 classified 33.2% as
 * unknown rather than guess. Counting those would make this fire constantly and
 * be switched off, which is how a gate dies.
 *
 * @param {Array<{dataset_type?: string, audit_grade?: string|null}>} rows
 * @returns {number}
 */
export function gradeDecayOf(rows) {
  let n = 0;
  for (const r of rows ?? []) {
    if (!SHAPE_ANSWERED_DATASET_TYPES.includes(r?.dataset_type)) continue;
    if (r?.audit_grade == null || r.audit_grade === 'unknown') n += 1;
  }
  return n;
}

/**
 * @param {Array<{data_source: string, rows: number, linkless: number,
 *                unregistered: boolean, shapeAnswered?: boolean}>} current
 * @param {{sources: Record<string, {unregisteredRows: number, linkless: number}>}} baseline
 */
export function summarizeProvenanceDebt(current, baseline) {
  const base = baseline?.sources ?? {};
  const worse = []; const better = []; const added = [];
  let unregisteredRows = 0; let linkless = 0; let rows = 0;

  for (const row of current ?? []) {
    const name = row.data_source;
    // ⚠ `=== true`, so a caller that does not set the flag keeps the STRICT
    // behaviour. Absence must never mean permission.
    const unreg = row.unregistered && row.shapeAnswered !== true ? row.rows : 0;
    rows += row.rows;
    unregisteredRows += unreg;
    linkless += row.linkless;

    const b = base[name];
    if (!b) {
      // ⚠ A source the baseline has never seen is only debt if it ARRIVES
      // with debt. A clean new source is the normal case and must not fail.
      if (unreg > 0 || row.linkless > 0) {
        added.push({ name, unregisteredRows: unreg, linkless: row.linkless });
      }
      continue;
    }
    if (unreg > b.unregisteredRows || row.linkless > b.linkless) {
      worse.push({
        name,
        unregisteredRows: unreg, wasUnregisteredRows: b.unregisteredRows,
        linkless: row.linkless, wasLinkless: b.linkless,
      });
    } else if (unreg < b.unregisteredRows || row.linkless < b.linkless) {
      better.push({
        name,
        unregisteredRows: unreg, wasUnregisteredRows: b.unregisteredRows,
        linkless: row.linkless, wasLinkless: b.linkless,
      });
    }
  }

  return {
    ok: worse.length === 0 && added.length === 0,
    worse, better, added,
    totals: { rows, unregisteredRows, linkless },
  };
}

/** Turn a measurement into the baseline file's shape. */
export function toBaseline(current) {
  const sources = {};
  for (const row of current ?? []) {
    // ⚠ The SAME excuse the comparison uses. If toBaseline recorded a
    // shape-answered family as carrying unregistered debt, the next run would
    // compare an excused 0 against a recorded N, report it as `better` every
    // time, and the baseline would never settle.
    const unreg = row.unregistered && row.shapeAnswered !== true ? row.rows : 0;
    if (unreg === 0 && row.linkless === 0) continue;   // nothing to record
    sources[row.data_source] = { unregisteredRows: unreg, linkless: row.linkless };
  }
  return { sources };
}
