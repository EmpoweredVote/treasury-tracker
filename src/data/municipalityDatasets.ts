import type { Municipality } from '../types/budget';

/**
 * Read an entity's dataset coverage from EITHER shape the API can return.
 *
 * ── ⚠⚠ WHY TWO SHAPES EXIST ────────────────────────────────────────────────
 *
 * `/treasury/cities` used to return `available_datasets` — ONE ENTRY PER BUDGET
 * ROW — for every entity. Measured 2026-09-01 that was 111,776 entries and
 * **97.1% of a 23.5 MB response**, fetched on every page load largely to look up
 * one municipality id. It grew with the database: the Michigan statewide sweep
 * alone took it from 18.4 MB to 23.5 MB.
 *
 * The list now asks for `?datasets=summary` and gets
 * `dataset_summary: { years, dataset_types }` — 1.1 MB, 21× smaller. The full
 * per-row detail is fetched for the ONE entity a reader opens.
 *
 * ⚠ These helpers exist so a component that only needs "does this place have
 * data" or "which years" never has to know which shape it was handed, and never
 * accidentally reports a summarised entity as empty. `hasDatasets` returning
 * false for a real government is the failure that matters: it removes the place
 * from search and from every browse grid, silently.
 *
 * ⚠ Anything that needs the AXES — fund scope, basis, derivation, audit grade —
 * must use a HYDRATED entity instead. Those live only on `available_datasets`,
 * and a summary cannot answer for them. See `hydrateMunicipality` in dataLoader.
 */

/** Does this entity have any budget data at all? */
export function hasDatasets(
  m: Pick<Municipality, 'available_datasets' | 'dataset_summary'> & { has_data?: boolean }
): boolean {
  // ⚠ THE FLAG FIRST. An index row carries no dataset_summary at all, so
  // checking the summary first would report every indexed entity as empty and
  // the switcher would render "0 jurisdictions".
  if (typeof m.has_data === 'boolean') return m.has_data;
  if (m.dataset_summary) return m.dataset_summary.years.length > 0;
  return (m.available_datasets?.length ?? 0) > 0;
}

/**
 * The distinct fiscal years this entity has data for, newest first.
 *
 * ⚠ De-duplicated in the `available_datasets` branch. An entity with two fund
 * scopes emits two entries per (year, dataset_type) — Michigan carries sixteen
 * years of exactly that — so the raw array would repeat every year.
 */
export function datasetYears(m: Pick<Municipality, 'available_datasets' | 'dataset_summary'>): number[] {
  if (m.dataset_summary) return [...m.dataset_summary.years].sort((a, b) => b - a);
  return [...new Set((m.available_datasets ?? []).map((d) => d.fiscal_year))].sort((a, b) => b - a);
}

/**
 * The newest fiscal year this entity has data for, or null.
 *
 * ⚠ Prefers an index row's `latest_year` over deriving from the year list,
 * because a lean index row carries NO `dataset_summary` and NO
 * `available_datasets` — `datasetYears()` returns `[]` for one, which is how
 * the landing search's FY label silently blanked.
 *
 * ⚠ The fallback matters for deploy order, but only softens the blow for a
 * HYDRATED entity or a summarised list row: against an API that does not yet
 * send `latest_year`, those still have `available_datasets` or
 * `dataset_summary` to derive a year FROM. A LEAN INDEX ROW has neither — it
 * carries no years at all — so until the API ships `latest_year` this returns
 * null for one, and the caller's FY label goes BLANK rather than showing a
 * wrong year. Say that plainly rather than "degrades ... rather than
 * breaking", which implied a fallback figure that does not exist here.
 */
export function latestDatasetYear(
  m: Pick<Municipality, 'available_datasets' | 'dataset_summary'> & { latest_year?: number | null }
): number | null {
  if (m.latest_year !== undefined) return m.latest_year;
  return datasetYears(m)[0] ?? null;
}

/** The distinct dataset types this entity has, sorted. */
export function datasetTypes(m: Pick<Municipality, 'available_datasets' | 'dataset_summary'>): string[] {
  if (m.dataset_summary) return [...m.dataset_summary.dataset_types].sort();
  return [...new Set((m.available_datasets ?? []).map((d) => d.dataset_type))].sort();
}
