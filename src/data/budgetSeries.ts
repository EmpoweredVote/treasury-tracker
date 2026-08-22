/**
 * SCOPE-02 — series identity and the display-series choice.
 *
 * A SERIES is (entity, dataset_type, fund_scope, basis). One series is never
 * continued by another, and that single rule is what removes the -75% Long Beach
 * cliff: the cliff is an artifact of drawing an adopted General Fund budget as
 * the next point on an all-funds actuals line.
 *
 * Picking per-YEAR is what created the seam — each year showed "whatever that
 * year had". So the choice is made once per series and held.
 *
 * Pure: no fetch, no DOM. Spec: docs/superpowers/specs/2026-08-17-scope-02-design.md §3
 *
 * `Basis` and `normalizeBasis` are NOT declared here — they are imported (and
 * re-exported) from `./fundScopeVocabulary`, which already defines them
 * (SCOPE-02 Task 7). Declaring them again here would shadow or conflict with
 * that definition. The dependency runs one way, `budgetSeries` ->
 * `fundScopeVocabulary`, never the reverse, to avoid a circular import.
 */

import { normalizeScope, normalizeBasis, type FundScope, type Basis } from './fundScopeVocabulary';

export { normalizeBasis, type Basis } from './fundScopeVocabulary';

export interface SeriesKey {
  fundScope: FundScope;
  basis: Basis;
}

export interface DatasetEntry {
  fiscal_year: number;
  dataset_type: string;
  period_label?: string | null;
  fund_scope?: string | null;
  basis?: string | null;
  // SCOPE-04: 'published' | 'derived'. Absent means published — every row
  // predating SCOPE-04 is, and an older API build omits the field.
  derivation?: string | null;
}

/**
 * Later is better. `unknown` is the absence of a value, so it sorts below everything.
 *
 * ⚠ EXPORTED for SCOPE-03 (`seriesSelection.ts`), which orders its pills by the
 * same rule this file ranks by. A second copy of these tables would drift the day
 * one of them is edited, and the drift would be invisible: the pills would simply
 * order differently from the default and no test would notice.
 */
export const SCOPE_RANK: Record<FundScope, number> = {
  unknown: 0,
  general_fund: 1,
  all_funds: 2,
  total_governmental: 3,
};

export const BASIS_RANK: Record<Basis, number> = {
  unknown: 0,
  adopted: 1,
  actual: 2,
};

/** True when neither axis is `unknown` — i.e. the series rests on evidence. */
export function isEvidenced(k: SeriesKey): boolean {
  return k.fundScope !== 'unknown' && k.basis !== 'unknown';
}

/**
 * Choose the one series to draw for this entity and dataset type.
 *
 * Widest fiscal-year coverage wins; ties break `actual > adopted`, then
 * `total_governmental > all_funds > general_fund`.
 *
 * ⚠ An evidenced series ALWAYS beats an unevidenced one regardless of coverage.
 * Preferring `unknown` because it happens to span more years would reintroduce
 * exactly the mixing this milestone removes.
 */
export function chooseDisplaySeries(
  datasets: DatasetEntry[],
  datasetType: string,
): SeriesKey | null {
  const groups = new Map<string, { key: SeriesKey; years: Set<number> }>();

  for (const d of datasets) {
    if (d.dataset_type !== datasetType) continue;
    const key: SeriesKey = {
      fundScope: normalizeScope(d.fund_scope),
      basis: normalizeBasis(d.basis),
    };
    const id = `${key.fundScope}\u0000${key.basis}`;
    if (!groups.has(id)) groups.set(id, { key, years: new Set() });
    groups.get(id)!.years.add(d.fiscal_year);
  }

  if (groups.size === 0) return null;

  const candidates = [...groups.values()];
  const evidenced = candidates.filter((c) => isEvidenced(c.key));
  const pool = evidenced.length > 0 ? evidenced : candidates;

  pool.sort((a, b) =>
    b.years.size - a.years.size
    || BASIS_RANK[b.key.basis] - BASIS_RANK[a.key.basis]
    || SCOPE_RANK[b.key.fundScope] - SCOPE_RANK[a.key.fundScope]);

  return pool[0].key;
}

/** Reader-facing name for a series, e.g. "All Funds · actuals". */
export function seriesLabel(key: SeriesKey): string {
  const basisWord = key.basis === 'actual' ? 'actuals'
    : key.basis === 'adopted' ? 'adopted budget'
    : 'basis not established';
  const scopeWord = key.fundScope === 'unknown' ? 'Scope not established'
    : key.fundScope === 'general_fund' ? 'General Fund'
    : key.fundScope === 'total_governmental' ? 'Total Governmental'
    : 'All Funds';
  return `${scopeWord} · ${basisWord}`;
}
