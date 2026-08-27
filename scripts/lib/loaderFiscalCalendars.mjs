/**
 * The fiscal calendar each loader must pass to `treasury_sync_city_budget`,
 * with the authority for every value.
 *
 * ⚠ NO SHEBANG — a library, and `tests/waSao.test.mjs` fails the build if any
 * module a test imports starts with `#!`.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * The RPC used to INSERT a literal `7` (PR #61 removed it). It now resolves the
 * month as: explicit parameter -> inherit the unanimous month of the same
 * (municipality_id, data_source) family -> REFUSE. Inheritance already covers a
 * new fiscal year for an entity we hold. What it cannot cover is a BRAND-NEW
 * (entity, data_source) pair, which now refuses — correctly, because nobody has
 * established that entity's calendar.
 *
 * This file is how a loader establishes it: one evidenced constant per source,
 * cited, in one place, so the next reader can check the claim rather than trust
 * the code.
 *
 * ⚠ EVERY VALUE HERE IS EVIDENCED. A source whose calendar could not be pinned
 * to a statute or the entity's own report is LISTED IN `UNWIRED` and left alone
 * rather than given a plausible default — the entire arc that produced this file
 * started with a plausible default.
 *
 * ⚠ AND A CONSTANT IS NOT ALWAYS ENOUGH. Two sources here need a function, not a
 * number, because a real jurisdiction carves an exception out of its own rule:
 * Ohio exempts the city of Cincinnati, and Utah splits by entity type. Both are
 * resolved through `scripts/lib/calendarYearLocalGov.mjs`, which owns those
 * carve-outs and their statutes, so the sweep and the loaders cannot drift apart.
 *
 * ⚠⚠ THIS FILE ONLY GOVERNS ONE OF THE TWO WRITE PATHS. It describes
 * `treasury_sync_city_budget`, which takes an explicit month. There is a SECOND
 * RPC — `treasury_sync_budget_tree` — which takes NO month parameter at all and
 * instead copies `fiscal_year_start_month` off the `treasury.data_sources` row:
 *
 *     INSERT INTO treasury.budgets (..., fiscal_year_start_month, ...)
 *     VALUES (..., v_ds.fiscal_year_start_month, ...)
 *
 * and BOTH columns are declared `NOT NULL DEFAULT 1`:
 *
 *     treasury.data_sources.fiscal_year_start_month  bigint NOT NULL DEFAULT 1
 *     treasury.budgets.fiscal_year_start_month       bigint NOT NULL DEFAULT 1
 *
 * So PR #61 removing the literal `7` from the other RPC did NOT end the class of
 * defect — it left a silent JANUARY on every loader that writes through the tree
 * RPC without setting the source row's month. That is what put 16,839
 * Massachusetts rows on a calendar fiscal year (see
 * `scripts/lib/maFiscalCalendar.mjs` and PR "fix(ma): July–June by statute").
 *
 * A loader that calls `treasury_sync_budget_tree` therefore cannot be wired by
 * adding an entry here. It must set `fiscal_year_start_month` on the
 * `data_sources` row it creates. `scripts/loadMaGFExcel.js` and
 * `scripts/loadMACountyBudget.js` are the worked examples.
 *
 * ⚠ The remaining `1`s outside Massachusetts have NOT been swept: CA 99 rows,
 * TX 71, IN 86, WA 336, CO 64, MD 6. CO/WA/IN are believed correct because those
 * states' localities genuinely run the calendar year — which means they are right
 * BY COINCIDENCE, the default having matched. None of the six is evidenced yet.
 */

import { exemptionFor, protectionFor } from './calendarYearLocalGov.mjs';

/**
 * Sources whose entire population shares one evidenced calendar.
 * `month` is what the loader passes as `p_fiscal_year_start_month`.
 */
export const SOURCE_CALENDARS = {
  'CA State Controller — Government Compensation in California (publicpay.ca.gov)': {
    month: 1,
    authority: 'SCO GCC reporting instructions — a W-2-based CALENDAR-year report; '
      + 'the instructions contain zero occurrences of "fiscal year". See PR #62.',
  },
  'Minnesota Office of the State Auditor City/County Finances Report': {
    month: 1,
    authority: 'Minn. Stat. § 471.696 (cities, towns); OSA County Finances Report '
      + '"For the Year Ended December 31" (counties). See PR #63.',
  },
  'Wisconsin DOR County and Municipal Revenues and Expenditures (unaudited MFR)': {
    month: 1,
    authority: 'Wisconsin municipalities run the calendar year (MAD-06). These rows '
      + 'were already stamped 1 by the loader itself, which post-stamped around '
      + 'the RPC hardcode; passing it removes the need for that workaround.',
  },
  'CA State Controller - County Expenditures': {
    month: 7,
    authority: 'Cal. Gov. Code § 29001 (County Budget Act) — "Budget year" is the '
      + 'fiscal year July 1 through June 30.',
  },
  'CA State Controller - County Revenues': {
    month: 7,
    authority: 'Cal. Gov. Code § 29001 (County Budget Act) — July 1 through June 30.',
  },
  'Virginia APA Comparative Report': {
    month: 7,
    // ⚠ This one took an extra step to establish, and the extra step MATTERED.
    // Va. Code § 15.2-2500 puts "every locality and school division" on July–June,
    // but its applicability clause reads on all counties and cities, on towns of
    // 3,500+ population, and on towns constituting a separate school division —
    // so the statute alone does NOT settle a small town. We hold 161 VA entities:
    // 93 counties + 34 cities (bound regardless of population) and 34 TOWNS.
    //
    // 32 of the towns are >= 3,500 and bound directly. The two below 3,500 were
    // checked individually rather than assumed:
    //   West Point (3,414) — one of only TWO Virginia towns with an independent
    //     school division, so § 15.2-2500 binds it "regardless of population".
    //   Wise (2,971) — no separate division, so settled by its OWN charter,
    //     § 4.2: "The fiscal year of the Town shall begin on July 1 of each year
    //     and end on June 30 of the following year."
    //     https://law.lis.virginia.gov/charters/wise/
    //
    // All 161 entities therefore run July–June, and all 608 stored rows already
    // read 7 — this wiring changes no data, it only stops the value depending on
    // the RPC's fallback.
    authority: 'Va. Code § 15.2-2500 (counties, cities, towns >= 3,500 and towns '
      + 'constituting a separate school division — covers 33 of our 34 towns, '
      + 'West Point via the school-division clause); Town of Wise charter § 4.2 '
      + 'for the one remaining town.',
  },
};

/**
 * Sources deliberately NOT wired, with the reason. Each still works for an
 * entity we already hold (the RPC inherits); each will REFUSE on a brand-new
 * entity, which is the correct outcome while its calendar is unestablished.
 */
export const UNWIRED = {
  // ⚠ Virginia used to sit here, and the reason it no longer does is worth
  // keeping: it was resolved by CHECKING, not by deciding the doubt was small.
  // The doubt was two towns out of 161 entities, and both turned out to be 7 —
  // but West Point is 7 for a reason that has nothing to do with its population,
  // and Wise is 7 only because its own charter says so. Wiring the source at 7
  // on the strength of "counties and cities are certainly 7" would have reached
  // the right answer by the wrong route, which is how the original hardcode
  // survived four milestones.
  'LA County Open Data - Employee Salaries':
    'The publishing period of this dataset is not stated in anything read so far. '
    + 'LA County itself is July–June, but a compensation extract may well be a '
    + 'calendar year, exactly as publicpay turned out to be. Unestablished.',
};

/**
 * The month for a source that needs no per-entity logic.
 * Throws rather than returning a default — a caller asking about an unknown
 * source has a bug, and a silent fallback is what this whole arc is about.
 */
export function monthForSource(source) {
  const entry = SOURCE_CALENDARS[source];
  if (!entry) {
    const why = UNWIRED[source];
    throw new Error(why
      ? `"${source}" is deliberately unwired: ${why}`
      : `no established fiscal calendar for data_source "${source}" — `
        + 'add it to SOURCE_CALENDARS with its authority, or to UNWIRED with its reason');
  }
  return entry.month;
}

/**
 * Ohio: calendar year for every political subdivision EXCEPT the city of
 * Cincinnati, which Ohio Rev. Code § 9.34 names explicitly and which runs
 * July–June. `entity` is `{ name, state }`.
 */
export const OHIO_SOURCE = 'Ohio Auditor of State Summarized Annual Financial Reports';

export function ohioMonthFor(entity) {
  const exempt = exemptionFor(entity);
  return exempt ? exempt.month : 1;
}

/**
 * Utah: counties run the calendar year (§ 17-36-3.5), municipalities run
 * July–June (§ 10-6-105). `entity` is `{ entity_type }`.
 *
 * Throws for any other type: the State Auditor says only that "SOME special
 * service districts" use the calendar year, which is not an establishment of
 * anything, so a district must be evidenced individually before it can load.
 */
export const UTAH_SOURCE = 'Transparent Utah';

export function utahMonthFor(entity) {
  const protectedType = protectionFor(UTAH_SOURCE, entity);
  if (protectedType) return protectedType.month;
  if (entity?.entity_type === 'county') return 1;
  throw new Error(`no established Utah fiscal calendar for entity_type `
    + `"${entity?.entity_type}" — § 17-36-3.5 covers counties and § 10-6-105 `
    + 'covers municipalities; anything else must be evidenced individually');
}
