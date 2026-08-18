/**
 * SCOPE-01 verification logic — pure, so the harnesses are testable without a DB.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * Holds the two detectors from Tasks 6 and 7. Both take plain row arrays and
 * return findings; all database access lives in scripts/lib/scopeDb.mjs. That
 * split is what lets the duplicate detector be mutation-tested on synthetic rows
 * rather than only against a table where the condition it hunts cannot yet occur.
 *
 * Spec: docs/superpowers/specs/2026-08-16-scope-01-design.md
 * Evidence of record: docs/superpowers/plans/SCOPE-01-RECON.md
 */

import { createHash } from 'node:crypto';
import { SCOPE } from './fundScope.mjs';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const nz = (v) => (v == null ? '~' : String(v));

/**
 * Task 8 — THE FIGURE INVARIANT. sha256 over (primary key | total_budget).
 *
 * Keyed on `id`, so it is immune to any relabelling of dataset_type, period_label
 * or anything else. **It must never move while this milestone runs**: this
 * milestone changes no figure, so a move here is a bug, never a baseline to
 * update.
 */
export function figureDigest(rows) {
  return sha(rows.map((r) => `${r.id}|${nz(r.total_budget)}`).sort().join('\n'));
}

/**
 * Task 8 — THE CHANGE DETECTOR. sha256 over the original Task 3 key, which
 * includes `dataset_type`.
 *
 * ⚠ NOT an invariant. `dataset_type` is a mutable label, so a deliberate relabel
 * moves this legitimately — it did when the 304 VA APA revenue rows became
 * `revenue_local_only` (migration 20260817000200). Keeping it alongside the figure
 * digest is what stops the harness reporting "a figure moved" when the truth is "a
 * label changed"; a harness that cries wolf gets ignored.
 */
export function compositeDigest(rows) {
  return sha(rows
    .map((r) => `${r.municipality_id}|${r.fiscal_year}|${r.dataset_type}|${nz(r.period_label)}|${nz(r.total_budget)}`)
    .sort().join('\n'));
}

/** Percentage change from a to b, or null when a is 0/absent (no meaningful ratio). */
export function pctChange(a, b) {
  const from = Number(a);
  const to = Number(b);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

/**
 * Series key. A scope seam is only meaningful WITHIN one entity's one dataset, and
 * `period_label` is part of it — the Transition Quarter is a separate series, and
 * folding it in would invent a seam every time a TQ row sat between two annuals.
 *
 * ⚠ The separator is U+0000, written as an ESCAPE and not as a raw byte (a raw
 * NUL makes git treat this file as binary, so it stops producing diffs — which is
 * how it got here). NUL rather than a space because `period_label` values contain
 * spaces ("Transition Quarter (Jul–Sep 1976)"), and a separator that can occur
 * inside a component can collide two different keys into one.
 */
function seriesKey(r) {
  return `${r.municipality_id}\u0000${r.dataset_type}\u0000${r.period_label ?? ''}`;
}

/**
 * Task 6 — find every point where an entity's series changes `fund_scope`
 * between consecutive PRESENT fiscal years.
 *
 * ⚠ A change into or out of `unknown` IS a seam, and this is the load-bearing
 * design decision. Every one of the seven known CA cities transitions
 * `all_funds` -> `unknown` (State Controller citywide handing over to the city's
 * own General-Fund document), so a detector that only compared two KNOWN scopes
 * would report ZERO and look clean. `unknown` is not a scope, it is the absence
 * of one — and the cliff a reader sees on the chart is just as real either way.
 *
 * Consecutive means consecutive *in the data*, not fiscalYear+1: gaps are common
 * (FY2009 is missing from several CA series), and a gap must not hide a seam. The
 * gap width is reported so a wide one can be judged on its own merits.
 *
 * @param {Array<{municipality_id, name, state, dataset_type, fiscal_year,
 *                period_label, fund_scope, total_budget, data_source}>} rows
 * @returns {Array<object>} seams, largest absolute change first
 */
export function detectSeams(rows) {
  const series = new Map();
  for (const r of rows) {
    const k = seriesKey(r);
    if (!series.has(k)) series.set(k, []);
    series.get(k).push(r);
  }

  const seams = [];
  for (const list of series.values()) {
    list.sort((a, b) => a.fiscal_year - b.fiscal_year);
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const cur = list[i];
      if (prev.fund_scope === cur.fund_scope) continue;
      seams.push({
        municipality_id: cur.municipality_id,
        name: cur.name,
        state: cur.state,
        dataset_type: cur.dataset_type,
        period_label: cur.period_label ?? null,
        from_fy: prev.fiscal_year,
        to_fy: cur.fiscal_year,
        fy_gap: cur.fiscal_year - prev.fiscal_year,
        from_scope: prev.fund_scope,
        to_scope: cur.fund_scope,
        from_total: Number(prev.total_budget),
        to_total: Number(cur.total_budget),
        pct: pctChange(prev.total_budget, cur.total_budget),
        from_source: prev.data_source,
        to_source: cur.data_source,
        involves_unknown: prev.fund_scope === SCOPE.UNKNOWN || cur.fund_scope === SCOPE.UNKNOWN,
      });
    }
  }
  seams.sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0));
  return seams;
}

/**
 * Task 7 — find any (municipality, fiscal_year, dataset_type) holding more than
 * one distinct `fund_scope`.
 *
 * Must read ZERO today: the unique index still forbids two rows per
 * (municipality_id, fiscal_year, dataset_type, period_label), so more than one
 * scope for a city-year is currently impossible. That is exactly why the guard is
 * built now and exercised on synthetic rows — a guard first run against the data
 * it is meant to police is a guard nobody has tested. SCOPE-02 moves it off zero
 * deliberately when it widens the index.
 *
 * NOTE the grouping deliberately EXCLUDES `period_label`: two scopes across an
 * annual row and its Transition Quarter row would be a real double-count hazard
 * for anything that sums a city-year, so it must be caught, not grouped apart.
 *
 * @returns {Array<{municipality_id, name, fiscal_year, dataset_type, scopes, rows}>}
 */
export function findDuplicateScopes(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.municipality_id}\u0000${r.fiscal_year}\u0000${r.dataset_type}`;
    if (!groups.has(k)) groups.set(k, { rows: [], scopes: new Set() });
    const g = groups.get(k);
    g.rows.push(r);
    g.scopes.add(r.fund_scope);
  }

  const dupes = [];
  for (const g of groups.values()) {
    if (g.scopes.size < 2) continue;
    const first = g.rows[0];
    dupes.push({
      municipality_id: first.municipality_id,
      name: first.name,
      state: first.state,
      fiscal_year: first.fiscal_year,
      dataset_type: first.dataset_type,
      scopes: [...g.scopes].sort(),
      rows: g.rows.length,
      detail: g.rows.map((r) => ({
        fund_scope: r.fund_scope,
        period_label: r.period_label ?? null,
        total_budget: Number(r.total_budget),
        data_source: r.data_source,
      })),
    });
  }
  dupes.sort((a, b) => a.name?.localeCompare(b.name ?? '') || a.fiscal_year - b.fiscal_year);
  return dupes;
}

/**
 * The seven CA seams measured by CA-CITIES-01 Task 6 and named in the plan.
 *
 * ⚠ THIS IS AN ACCEPTANCE TEST, NOT A REPORT. Chris's instruction, verbatim:
 * "the seam detector in Task 6 must find those seven cities. If it finds fewer,
 * the detector is broken, not the data." Finding MORE is a result to record.
 * Tolerance is 1.0 percentage point against the plan's rounded figures.
 */
export const REQUIRED_SEAMS = Object.freeze([
  { name: 'Long Beach', from_fy: 2024, to_fy: 2025, pct: -75.0 },
  { name: 'Anaheim', from_fy: 2024, to_fy: 2025, pct: -70.1 },
  { name: 'Riverside', from_fy: 2022, to_fy: 2023, pct: -66.4 },
  { name: 'Santa Ana', from_fy: 2022, to_fy: 2023, pct: -62.5 },
  { name: 'Oakland', from_fy: 2023, to_fy: 2024, pct: -59.4 },
  { name: 'Fresno', from_fy: 2019, to_fy: 2020, pct: -44.5 },
  { name: 'Bakersfield', from_fy: 2024, to_fy: 2025, pct: -43.2 },
]);

/**
 * Check the detector found all seven, at the right years and roughly the right
 * magnitude. Returns per-expectation results plus a pass flag.
 */
export function checkRequiredSeams(seams, tolerancePct = 1.0) {
  const results = REQUIRED_SEAMS.map((want) => {
    const hit = seams.find((s) => s.name === want.name
      && s.dataset_type === 'operating'
      && s.from_fy === want.from_fy
      && s.to_fy === want.to_fy);
    if (!hit) return { ...want, found: false, reason: 'no seam at that year pair' };
    const drift = Math.abs((hit.pct ?? 0) - want.pct);
    return {
      ...want,
      found: drift <= tolerancePct,
      actual_pct: hit.pct,
      drift,
      from_scope: hit.from_scope,
      to_scope: hit.to_scope,
      reason: drift <= tolerancePct ? null : `pct ${hit.pct?.toFixed(2)} differs from ${want.pct} by ${drift.toFixed(2)}pt`,
    };
  });
  return { ok: results.every((r) => r.found), results };
}

/**
 * SCOPE-02 — the duplicate rule, INVERTED.
 *
 * ⚠ SCOPE-01's findDuplicateScopes() asserted that NO city-year holds more than
 * one fund_scope. That assertion passing is now itself the bug: the milestone
 * deliberately creates exactly that pair (a State Controller all-funds actuals
 * row beside a city's adopted General Fund budget row), so a detector still
 * demanding zero would fail on correct data and get switched off.
 *
 * The legal shape is now: at most one row per (city-year, dataset_type, basis).
 * Two rows sharing a basis is a genuine double-count hazard whatever their
 * scopes; an actuals row beside an adopted-budget row is the intended state.
 *
 * Grouping still EXCLUDES period_label, for the SCOPE-01 reason: the FY1976
 * Transition Quarter pair is a real double-count hazard for anything summing a
 * city-year, and grouping it apart would hide it by construction.
 *
 * findDuplicateScopes() above is kept as-is: SCOPE-01's tests still cover it and
 * it documents what the detector proved before this fix.
 */
export function findIllegalDuplicates(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.municipality_id}\u0000${r.fiscal_year}\u0000${r.dataset_type}\u0000${r.basis ?? 'unknown'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const bad = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const first = g[0];
    bad.push({
      municipality_id: first.municipality_id,
      name: first.name,
      state: first.state,
      fiscal_year: first.fiscal_year,
      dataset_type: first.dataset_type,
      basis: first.basis ?? 'unknown',
      rows: g.length,
      detail: g.map((r) => ({
        fund_scope: r.fund_scope,
        basis: r.basis,
        period_label: r.period_label ?? null,
        total_budget: Number(r.total_budget),
        data_source: r.data_source,
      })),
    });
  }
  bad.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '') || a.fiscal_year - b.fiscal_year);
  return bad;
}

/**
 * SCOPE-02 — the seam acceptance test, FLIPPED.
 *
 * SCOPE-01's checkRequiredSeams() demanded the seven be FOUND; this demands they
 * be GONE. Both are kept: the SCOPE-01 form documents what the detector proved
 * before the fix, and this one proves the fix.
 *
 * ⚠ Scoped to the seven BY NAME. The other 19 seams in the database are out of
 * scope and must still be found — a detector reporting zero seams overall has
 * broken, not succeeded.
 */
export const REQUIRED_ABSENT_SEAMS = REQUIRED_SEAMS;

export function checkSeamsClosed(seams) {
  const stillOpen = REQUIRED_ABSENT_SEAMS
    .map((want) => seams.find((s) => s.name === want.name
      && s.dataset_type === 'operating'
      && s.from_fy === want.from_fy
      && s.to_fy === want.to_fy))
    .filter(Boolean);
  return { ok: stillOpen.length === 0, stillOpen };
}

/**
 * SCOPE-02 — THE FIGURE INVARIANT, re-based as an EXCLUSION.
 *
 * SCOPE-01's figureDigest() covered every row and was asserted never to move.
 * This milestone adds rows by design, so that digest moves legitimately and a
 * baseline rewritten to accommodate it would defeat the check permanently.
 *
 * ⚠ Inverted from the brief's inclusion-list design: `created_at` is NULL on
 * 79,899 of the 79,927 rows that existed at v2.24, so it cannot identify that
 * set, and committing all 79,927 ids would be a ~3MB permanent repo artifact.
 * What IS cheap and known exactly is the small set this milestone created —
 * `scripts/data/scope02CreatedIds.json`, 12 ids. So this covers every row
 * EXCEPT the excluded (newly-created) ones: a row that existed at v2.24 must
 * still be present and byte-identical. A frozen row disappearing moves the
 * digest too, which is the point — a delete is exactly as bad as an edit.
 */
export function frozenIdDigest(rows, excludedIds) {
  const excluded = new Set(excludedIds);
  return sha(rows
    .filter((r) => !excluded.has(r.id))
    .map((r) => `${r.id}|${nz(r.total_budget)}`)
    .sort()
    .join('\n'));
}
