/**
 * SCOPE-03 §3.1 — the split-series shape.
 *
 * An entity where EVERY series dataset holds exactly one series, but the datasets
 * hold DIFFERENT ones. Selecting either pill then leaves the other tile absent,
 * because neither series covers both sides.
 *
 * Chris ruled 2026-08-18 that this is correct: the two figures sit on different
 * bases and are not a pair. But it means a page that shows two tiles today shows
 * one after SCOPE-03, and **no existing harness would report a second such
 * entity** — this shape is invisible to the seam detectors, which compare within
 * a dataset, never across two.
 *
 * Longview TX is the only one as of 2026-08-18. Pure: IO lives in the caller.
 */

const SERIES_DATASETS = ['operating', 'revenue'];

export function detectSplitSeriesEntities(rows) {
  /** municipality_id -> { name, state, datasets: dataset_type -> Set of `scope|basis` } */
  const byEntity = new Map();

  for (const row of rows) {
    if (!SERIES_DATASETS.includes(row.dataset_type)) continue;
    if (!byEntity.has(row.municipality_id)) {
      byEntity.set(row.municipality_id, { name: row.name, state: row.state, datasets: new Map() });
    }
    const entity = byEntity.get(row.municipality_id);
    if (!entity.datasets.has(row.dataset_type)) entity.datasets.set(row.dataset_type, new Set());
    entity.datasets.get(row.dataset_type)
      .add(`${row.fund_scope ?? 'unknown'}|${row.basis ?? 'unknown'}`);
  }

  const out = [];
  for (const [municipality_id, entity] of byEntity) {
    // Needs both sides: a one-sided entity has nothing to lose.
    if (entity.datasets.size < 2) continue;
    // Every dataset must offer exactly one series — otherwise the reader has a
    // genuine choice within a dataset and this is not the shape.
    if ([...entity.datasets.values()].some((s) => s.size !== 1)) continue;
    // ...and the single series must DIFFER between datasets.
    const ids = new Set([...entity.datasets.values()].map((s) => [...s][0]));
    if (ids.size < 2) continue;

    out.push({
      municipality_id,
      name: entity.name,
      state: entity.state,
      datasets: Object.fromEntries(
        [...entity.datasets].map(([d, s]) => [d, [...s][0]])),
    });
  }

  return out.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}
