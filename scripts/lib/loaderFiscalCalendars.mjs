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
};

/**
 * Sources deliberately NOT wired, with the reason. Each still works for an
 * entity we already hold (the RPC inherits); each will REFUSE on a brand-new
 * entity, which is the correct outcome while its calendar is unestablished.
 */
export const UNWIRED = {
  'Virginia APA Comparative Report':
    'Code of Virginia § 15.2-2500 puts every locality on July–June, but the '
    + 'applicability clause reads on towns of 3,500+ population (and towns that '
    + 'are a separate school division), and we hold 34 VA TOWNS whose populations '
    + 'have not been checked. Counties and cities are certainly 7; the towns are '
    + 'not established, so the source is left alone rather than wired at 7 and '
    + 'quietly cementing the towns.',
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
