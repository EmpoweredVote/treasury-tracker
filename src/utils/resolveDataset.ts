/**
 * resolveEffectiveDataset — pure helper for validating a requested dataset
 * against an entity's actual availability for a given year.
 *
 * This helper is intentionally dependency-free (no React, no DOM, no network).
 * The caller is responsible for year-filtering `availableDatasetTypesForYear`
 * before passing it in — matching the existing `availableDatasetTypes` derivation
 * in App.tsx (filter by fiscalYear, exclude all_funds_requirements + federal_agency).
 *
 * Three branches:
 *   1. garbage / null / undefined / unknown key → fall back
 *      (rejects anything not in the static switchable set)
 *   2. available → keeps the requested dataset as-is
 *      (requested is in the static set AND in availableDatasetTypesForYear)
 *   3. unavailable → fall back
 *      (requested is valid but the entity/year does not have that dataset)
 *
 * ⚠ THE FALLBACK MUST ITSELF BE AVAILABLE. Every branch used to return
 * 'operating' unconditionally, including when the entity/year had no operating
 * row — so the resolver handed back a dataset that cannot load and the caller
 * asked the API for a row that cannot exist. Landing on Brockton MA, whose
 * latest year (FY2025) carries revenue but no operating, produced "Unable to
 * load budget data" and `No budget found for Brockton 2025 (operating)`.
 *
 * Nine entities were in that state: eight MA towns that had not filed FY2025
 * expenditures when the DLS workbook was captured (Brockton, Florida, Gill,
 * Gosnold, Holyoke, Hopedale, Hudson, Orange) and — the control showing this
 * predates the MA work entirely — Allen TX at FY2026.
 *
 * `operating` is still PREFERRED whenever it exists, so no page that worked
 * before changes behaviour.
 *
 * Security note: the static allow-list guard (branch 1) ensures that arbitrary
 * URL query param values (e.g. ?dataset=<script> or ?dataset=foo) never reach
 * state as a DatasetType — they are normalised before any render. The fallback
 * only ever chooses from the same static set, so widening it cannot admit an
 * arbitrary string.
 */

type DatasetType = 'operating' | 'revenue' | 'salaries';

/** The switchable dataset types — used as the first-guard allow-list. */
const SWITCHABLE_DATASETS: readonly string[] = ['operating', 'revenue', 'salaries'];

/**
 * Resolve a requested dataset against the available dataset types for a year,
 * falling back to 'operating' when the requested value is invalid or unavailable.
 *
 * @param availableDatasetTypesForYear - already year-filtered list of dataset_type strings
 * @param requested - raw requested dataset (e.g. from a URL param) — may be null/undefined/garbage
 * @returns the effective DatasetType to activate
 */
export function resolveEffectiveDataset(
  availableDatasetTypesForYear: string[],
  requested: string | null | undefined,
): DatasetType {
  // Branch 2 first in effect: valid AND available for this year.
  if (requested && SWITCHABLE_DATASETS.includes(requested)
      && availableDatasetTypesForYear.includes(requested)) {
    return requested as DatasetType;
  }

  // Branches 1 and 3 share one fallback, and it must land on something that
  // actually exists for this entity-year. `operating` first, so every page that
  // worked before is unchanged; otherwise the first available switchable type,
  // in the order a reader meets them.
  return fallbackDataset(availableDatasetTypesForYear);
}

/**
 * The best dataset that actually exists for this year, preferring `operating`.
 * Returns 'operating' when nothing is available, leaving the caller to render
 * its empty state rather than inventing a type that is not in the static set.
 */
function fallbackDataset(availableDatasetTypesForYear: string[]): DatasetType {
  for (const candidate of SWITCHABLE_DATASETS) {
    if (availableDatasetTypesForYear.includes(candidate)) return candidate as DatasetType;
  }
  return 'operating';
}
