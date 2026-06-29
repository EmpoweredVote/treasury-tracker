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
 *   1. garbage / null / undefined / unknown key → returns 'operating'
 *      (rejects anything not in the static switchable set)
 *   2. available → keeps the requested dataset as-is
 *      (requested is in the static set AND in availableDatasetTypesForYear)
 *   3. unavailable → returns 'operating'
 *      (requested is valid but the entity/year does not have that dataset)
 *
 * Security note: the static allow-list guard (branch 1) ensures that arbitrary
 * URL query param values (e.g. ?dataset=<script> or ?dataset=foo) never reach
 * state as a DatasetType — they are normalised to 'operating' before any render.
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
  // Branch 1: garbage / null / undefined — not in the static switchable set
  if (!requested || !SWITCHABLE_DATASETS.includes(requested)) {
    return 'operating';
  }

  // Branch 2: valid AND available for this year
  if (availableDatasetTypesForYear.includes(requested)) {
    return requested as DatasetType;
  }

  // Branch 3: valid key but not available for this entity/year
  return 'operating';
}
