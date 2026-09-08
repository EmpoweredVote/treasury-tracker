/**
 * Indiana Gateway AFR — the anomaly register.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MILLEDGEVILLE RULE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Chris, 2026-08-29: *"It is not our job to hide bad data"* — reflect what is
 * ACCURATE, and flag what looks inconsistent, saying why.
 *
 * **Nothing in this file is withheld from the product.** Every figure recorded
 * here is LOADED exactly as the government published it. Editing or dropping a
 * verified figure because it looks outlandish would create a blind spot for
 * legitimate fraud — an outlier is a FINDING, not noise to be cleaned up.
 *
 * ⚠ Every entry was CORROBORATED BY INDEPENDENT AGENTS working from the raw
 * source with neutral prompts, before being recorded — Chris's standing
 * requirement for any flag of this nature. Agents are told the file layout and
 * asked a question, never the conclusion, and are explicitly invited to return
 * a null result.
 *
 * ── ⚠⚠ WHY THIS FILE IS SHAPED DIFFERENTLY FROM ITS GEORGIA PREDECESSOR ─────
 *
 * `scripts/data/gaRlgfAnomalies.mjs` is the precedent and it is **imported by
 * nothing** — measured: `GA_FIGURE_FLAGS` has zero importers, not even a test.
 * So it achieved the rule's stated MINIMUM ("a registry in the repo") and could
 * never reach a reader, and nothing would notice if the data underneath it
 * changed. That is the guard shape #143 was about.
 *
 * A flag here therefore carries `assertions`: the exact figures the flag claims
 * the publisher filed. `assertFigureFlagStillHolds()` re-checks them on every
 * load, so if a government AMENDS its filing the loader REFUSES rather than
 * continuing to publish a stale claim about a real government. That is the Parke
 * residue pattern — pin the exact figure, refuse on drift, never a tolerance
 * where an exact registry will do.
 *
 * ⚠ Still true, and still a gap worth naming: TT has NO READER-FACING anomaly
 * surface. `treasury_sync_city_budget` takes no note or flag parameter, and the
 * only free-text a reader sees is the `data_source` name — which is load-bearing
 * for the live-sync name join and the frozen digest, so it must not be bent into
 * carrying prose. Surfacing these to readers is a product decision, not
 * something a loader can smuggle in. The rule's stated GOAL is not yet met.
 */

/**
 * `assertions` is what makes a flag self-checking:
 *   fiscalYear  the year the claim is about
 *   dataset     'revenue' | 'operating'
 *   measure     a field on the parsed result — `subsetTotal` is what TT loads
 *   expected    the exact figure, in dollars, as published
 */
export const IN_FIGURE_FLAGS = Object.freeze([]);

/** Whole dollars: these extracts carry cents but never sub-cent noise. */
const EPSILON = 1.0;

/** Every flag recorded against one government-year. Keyed on (cnty_cd, unit_code). */
export function figureFlagsFor(countyCode, unitCode, fiscalYear, { flags = IN_FIGURE_FLAGS } = {}) {
  return flags.filter((f) => f.countyCode === countyCode
    && f.unitCode === unitCode
    && f.fiscalYears.includes(Number(fiscalYear)));
}

/**
 * Re-check a flag's claims against what was just parsed.
 *
 * ⚠⚠ A flag is a CLAIM ABOUT A GOVERNMENT'S PUBLISHED FIGURES. If the publisher
 * amends the filing, the claim becomes false, and TT would be asserting
 * something untrue about a real government — worse than having no flag, because
 * it looks like knowledge. So this refuses and names what to re-measure.
 */
export function assertFigureFlagStillHolds(flag, fiscalYear, filing, label) {
  let checked = 0;
  for (const a of flag.assertions ?? []) {
    if (Number(a.fiscalYear) !== Number(fiscalYear)) continue;
    const actual = filing?.[a.dataset]?.[a.measure];
    checked++;
    if (!Number.isFinite(actual) || Math.abs(actual - a.expected) > EPSILON) {
      throw new Error(
        `REFUSING ${label}: the recorded anomaly flag "${flag.id}" no longer describes `
        + `the data — it claims ${a.dataset}.${a.measure} of ${a.expected.toFixed(2)} for `
        + `FY${a.fiscalYear}, the extract now parses `
        + `${Number.isFinite(actual) ? actual.toFixed(2) : String(actual)}. `
        + 'The publisher may have amended the filing. Re-measure with '
        + 'scripts/inGovernmentTotalsProbe.py, re-corroborate, and update or retire the '
        + 'flag — do NOT keep publishing a stale claim about a real government.');
    }
  }
  return { ok: true, checked };
}
