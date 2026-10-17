/**
 * Reader-facing figure flags.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MILLEDGEVILLE RULE, ON THE PAGE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Chris, 2026-08-29: *"It is not our job to hide bad data"* — reflect what is
 * ACCURATE, and flag what looks inconsistent, saying why.
 *
 * Every figure named here is **shown exactly as the government published it**.
 * Nothing is capped, corrected or withheld. This module exists so a reader can
 * be TOLD why a number looks wrong, because suppressing an outlier creates a
 * blind spot for exactly the thing a transparency tool exists to surface — and
 * the suppression would be invisible, so the reader could not even know a
 * judgement had been made for them.
 *
 * ⚠⚠ UNTIL THIS FILE EXISTED, EVERY FLAG TT HAD RECORDED WAS INVISIBLE.
 * The author-facing registers (`scripts/data/gaRlgfAnomalies.mjs`,
 * `scripts/data/inGatewayAnomalies.mjs`) were read by no UI code at all. The
 * standing rule is that a flag is evidence to PUBLISH and a repo registry is
 * the MINIMUM. This file is the publishing half.
 *
 * ── ⚠⚠ ONLY CORROBORATED FLAGS BELONG HERE ─────────────────────────────────
 *
 * An OBSERVATION is not a FINDING. A claim about a government's published
 * figures is not published to readers until independent agents have reached it
 * from the raw sources themselves — neutral prompts, neither shown the other's
 * work, and approached differently (one from the raw files, one from external
 * published sources). An uncorroborated observation stays in the repo register
 * marked as such and MUST NOT be added here.
 *
 * ⚠ `tests/figureFlags.test.ts` asserts this file stays in step with the
 * author-facing register, so a flag cannot be recorded for maintainers and
 * silently left off the page.
 *
 * ── ⚠⚠ CONTEXT, NOT A VERDICT ──────────────────────────────────────────────
 *
 * These banners explain what a figure IS and IS NOT. They do not announce that
 * something is broken, and they carry no alarm styling — one calm treatment for
 * every severity.
 *
 * That is a deliberate correction (Chris, 2026-10-17). The earlier design shouted
 * at the reader and positioned TT as adjudicator of a government's competence.
 * Two things make that wrong:
 *
 *   1. TT IS NOT THE AUDITOR. These are self-reported forms that the publisher
 *      states on their face it "cannot certify". TT transcribes them.
 *   2. ⚠⚠ WE NEARLY GOT ONE WRONG. Fulton FY2017 property tax sat at 0.592 of
 *      its neighbours — numerically indistinguishable from the real defects —
 *      and turned out to be a COURT-ORDERED billing delay. Flagging on the
 *      shape alone would have accused a county of misreporting when a judge had
 *      ordered the delay. A tool one step from that mistake should not be
 *      shouting.
 *
 * ⚠ WHAT SURVIVED THE RESTYLE, AND MUST: the practical consequence. A reader
 * who takes DeKalb FY2018 at face value is wrong SEVENFOLD, and that has to
 * survive a skim. It is carried by STATING THE MAGNITUDE PLAINLY in the
 * headline and by `whatThisMeans` — by information, never by colour.
 *
 * ── Authoring the copy ─────────────────────────────────────────────────────
 *
 * The register entries are technical and long. These are NOT a dump of them.
 * Lead with what the figure covers and what it leaves out. Give the comparison
 * and the size. Never imply wrongdoing, and never use a word like "wrong",
 * "error" or "failed" about a government — `tests/figureFlags.test.ts`
 * enforces it. Every defect found so far UNDERSTATES spending rather than
 * inflating it, which is worth remembering when choosing a verb.
 */

import type { ComparabilitySource } from '../types/budget';

export type FigureFlagSeverity = 'understated' | 'outlier' | 'not-comparable';

export interface FigureFlag {
  /** Matches the id in the author-facing register, so the two can be tied. */
  id: string;
  /** Short headline for the always-visible banner. One line. */
  headline: string;
  /** One or two sentences for the banner body. Plain language. */
  summary: string;
  /**
   * Steers the banner's colour, icon and assurance line.
   *
   *   understated     — the published figure is lower than the government's own
   *                     audited statements, so the page is showing too little.
   *   outlier         — the figure is extreme against its own history but the
   *                     publisher's arithmetic carries it.
   *   not-comparable  — ⚠⚠ THE FIGURE IS CORRECT. Nothing is wrong with the
   *                     number; what breaks is comparing it to its neighbour,
   *                     because a real event moved money between two years.
   *
   * ⚠⚠ `not-comparable` IS NOT A SOFTER `understated`, AND MUST NOT READ AS
   * ONE. Telling a reader a correct figure "looks wrong" is its own kind of
   * misinformation, and it would also defame a government that did nothing
   * wrong. It gets a neutral colour and an informational icon, never the
   * warning triangle.
   */
  severity: FigureFlagSeverity;
  /**
   * ⚠ REQUIRED. One short line telling the reader what to DO with this figure.
   * This is what replaced the implied verdict: not "something is wrong here"
   * but "here is how to use this number, and how not to".
   */
  whatThisMeans: string;
  /** Expandable detail. Every entry renders with its own SourceChip. */
  entries: ComparabilitySource[];
}

const DCA_URL = 'https://apps.dca.ga.gov/RLGF/Default.aspx';
const DCA_NAME = 'Georgia DCA Report of Local Government Finances';

/**
 * Keyed by `${entity name}|${state}|${fiscalYear}|${datasetType}`.
 *
 * ⚠ A lookup that misses returns undefined and the banner renders NOTHING.
 * Every entity, year and dataset without an entry is completely unaffected —
 * the additive pattern `cityBasisNotes` already uses.
 */
export const figureFlags: Record<string, FigureFlag> = {
  'DeKalb County|GA|2018|operating': {
    id: 'dekalb-fy2018-expenditure-side-is-about-one-twelfth',
    severity: 'understated',
    headline: 'DeKalb’s own audited accounts report about seven times this much spending for 2018',
    summary:
      'The state filing this page draws on reports $92.0 million of spending for 2018. DeKalb '
      + 'County’s own audited financial statements report $654.5 million for the same year. The '
      + 'difference runs through nearly every line of the filing, while the revenue side of that '
      + 'same return covers a full twelve months. Shown exactly as filed.',
    whatThisMeans:
      'For DeKalb’s 2018 spending, use the county’s own annual financial report rather than this '
      + 'figure.',
    entries: [
      {
        title: 'What the county’s audited accounts say',
        text:
          'DeKalb County’s audited Annual Comprehensive Financial Report for 2018 reports total '
          + 'governmental funds expenditures of $654,486,000. That figure has never been revised: the '
          + 'identical 2018 column is reprinted unchanged in the county’s 2019, 2020, 2021 and 2022 '
          + 'reports, and the county’s spending rose steadily through the period with no 2018 event '
          + '($591.7m in 2016, $620.1m in 2017, $654.5m in 2018, $717.1m in 2019, $834.9m in 2020).',
        source_name: 'DeKalb County, Georgia — 2018 Comprehensive Annual Financial Report',
        source_url: 'https://www.dekalbcountyga.gov/sites/default/files/2026-01/DeKalb%20County%202018%20Comprehensive%20Annual%20Financial%20Report%20FINAL%20.pdf',
        source_date: '2019-06-27',
      },
      {
        title: 'The shortfall runs through the whole filing',
        text:
          'It is not one bad line. Across the 47 spending lines reported in 2017, 2018 and 2019 alike, '
          + 'the 2018 figures are about a tenth of the neighbouring years, with nearly three quarters of '
          + 'lines falling between a fourteenth and an eighth. Police protection drops from $79.2m to '
          + '$6.5m and back to $77.6m; fire protection from $52.3m to $4.3m and back to $53.8m. The '
          + 'revenue side of the very same filing is a complete twelve months.',
        source_name: DCA_NAME,
        source_url: DCA_URL,
        source_date: '2026-10-17',
      },
      {
        title: 'Why this looks like a filing error, not a real cut',
        text:
          'The most likely explanation is routine: the spending side appears to have been pulled from '
          + 'the county’s accounting system for a single month while the revenue side was pulled for the '
          + 'full year. 2018 is also the only DeKalb filing that leaves the preparer’s name blank, which '
          + 'fits a draft that was sent and never amended. A units mistake and a narrower set of funds '
          + 'were both tested and ruled out. No wrongdoing is implied or suggested — the state does not '
          + 'audit or certify these forms, and this error understates spending rather than inflating it.',
        source_name: 'Georgia DCA Rule 110-3-1 — “DCA cannot certify the accuracy of the report figures submitted”',
        source_url: DCA_URL,
        source_date: '2026-10-17',
      },
    ],
  },

  // ── The two sides of one seam. Each points at the other, because a reader
  // landing on either year needs to be told about the one next to it. ──
  'Fulton County|GA|2017|revenue': {
    id: 'fulton-fy2017-fy2018-property-tax-timing',
    severity: 'not-comparable',
    headline: 'A court-ordered billing delay moved tax money out of this year and into 2018',
    summary:
      'Fulton County could not issue its 2017 property tax bills on time: the state did not approve '
      + 'the county’s 2017 tax digest, and a court order was needed before bills could go out at all. '
      + 'Payment was not due until 15 January 2018, so about a third of the year’s property tax was '
      + 'collected in 2018 instead. This year’s revenue is genuinely lower as a result, and 2018’s is '
      + 'correspondingly higher. Both figures are correct as filed — but comparing the two years to '
      + 'each other will mislead you.',
    whatThisMeans:
      'Take 2017 and 2018 together rather than separately — across the pair the figures match the '
      + 'surrounding years to better than one percent.',
    entries: [
      {
        title: 'The county’s own account of what happened',
        text:
          'From Fulton County’s 2017 annual financial report: “2017 saw unusual circumstances '
          + 'regarding the County’s property tax digest… The Georgia Department of Revenue did not '
          + 'approve this adjustment, and the County obtained a Temporary Collection Order in late '
          + '2017 to facilitate distribution of the tax bills.” The county reassessed property, the '
          + 'commissioners voted to hold residential values at 2016 levels to soften large increases, '
          + 'and the state declined to approve the result.',
        quote:
          'The County’s due date for property taxes was extended to January 15, 2018. 67% was '
          + 'collected in fiscal 2017, with the remainder collected in January of 2018.',
        source_name: 'Fulton County, Georgia — 2017 Comprehensive Annual Financial Report, transmittal letter',
        source_url: 'https://www.fultoncountyga.gov/-/media/Departments/Finance/ACFR-or-CAFR/Fulton_County_Georgia_CAFR_2017-.pdf',
        source_date: '2018-09-28',
      },
      {
        title: 'How much moved, in the county’s own collection records',
        text:
          'Fulton normally collects 95–97% of each year’s property tax levy within that year. In 2017 '
          + 'it collected 66.9%. In 2018 it collected 95.4% of the new levy PLUS $159.9 million of '
          + 'late 2017 tax, taking total collections to 125.7% of that year’s levy. The same pattern '
          + 'appears in three separate county funds. Across the two years together the county '
          + 'collected $1,007.3 million against a levy of $1,007.6 million — a gap of less than '
          + '$0.4 million on a billion. Nothing was lost; it arrived a few weeks late.',
        source_name: 'Fulton County, Georgia — 2020 CAFR, Schedule 8-A, Property Tax Levies and Collections',
        source_url: 'https://www.fultoncountyga.gov/-/media/Departments/Finance/ACFR-or-CAFR/FULTON-COUNTY-CAFR-2020.pdf',
        source_date: '2021-09-15',
      },
      {
        title: 'Why the county’s own accounts look smooth and this figure does not',
        text:
          'The county’s audited accounts record property tax in the year the bill is raised, so they '
          + 'show a steady rise straight through the disruption ($525.8m in 2016, $558.9m in 2017, '
          + '$589.0m in 2018, $609.5m in 2019). The state form shown here follows the money when it '
          + 'is actually received. Both are legitimate ways to count, and neither is a mistake — but '
          + 'they answer different questions, and only one of them shows the delay.',
        source_name: 'Fulton County, Georgia — 2020 CAFR, Schedule 2, Changes in Net Position',
        source_url: 'https://www.fultoncountyga.gov/-/media/Departments/Finance/ACFR-or-CAFR/FULTON-COUNTY-CAFR-2020.pdf',
        source_date: '2021-09-15',
      },
    ],
  },

  'Fulton County|GA|2018|revenue': {
    id: 'fulton-fy2017-fy2018-property-tax-timing',
    severity: 'not-comparable',
    headline: 'This year contains a second year’s worth of late 2017 tax — it is not a real increase',
    summary:
      'Fulton County’s 2017 property tax bills went out late under a court order and were not due '
      + 'until 15 January 2018, so $159.9 million of 2017 tax was collected during 2018 on top of '
      + '2018’s own. That makes this year look far larger than it was: revenue appears to jump 93% '
      + 'over 2017, when the underlying increase is about 5%. The figures are correct as filed — the '
      + 'comparison between the two years is what breaks.',
    whatThisMeans:
      'Take 2017 and 2018 together rather than separately. A growth rate or per-resident figure for '
      + 'either year alone will be out by roughly $190 million.',
    entries: [
      {
        title: 'What the jump actually consists of',
        text:
          'Of the $407.6 million apparent increase in tax revenue between 2017 and 2018, about '
          + '$375.8 million — roughly 92% — is the delay unwinding: money that belonged to 2017 '
          + 'arriving in 2018. Only around $32 million, or about 5%, is real growth. The county’s own '
          + 'collection records show 2018 collecting 125.7% of its levy, because $159.9 million of it '
          + 'was late 2017 tax.',
        source_name: 'Fulton County, Georgia — 2020 CAFR, Schedule 8-A, Property Tax Levies and Collections',
        source_url: 'https://www.fultoncountyga.gov/-/media/Departments/Finance/ACFR-or-CAFR/FULTON-COUNTY-CAFR-2020.pdf',
        source_date: '2021-09-15',
      },
      {
        title: 'Why the bills were late',
        text:
          'The Georgia Department of Revenue did not approve Fulton County’s 2017 tax digest after '
          + 'the commissioners voted to hold residential values at their 2016 levels. The county had '
          + 'to obtain a court order in November 2017 before it could issue 2017 bills at all, and '
          + 'payment was not due until 15 January 2018.',
        quote:
          'The last Fulton County Tax Digest that was approved by the Revenue Commissioner was from 2016.',
        source_name: 'Superior Court of Fulton County — Final Order Authorizing the Immediate and Temporary Collection of Taxes',
        source_url: 'https://saportareport.com/wp-content/uploads/2017/11/Final-Order-filed-11.3.17.pdf',
        source_date: '2017-11-03',
      },
      {
        title: 'What to use instead',
        text:
          'Take 2017 and 2018 together rather than separately. Across the pair the county collected '
          + '$1,007.3 million against a levy of $1,007.6 million, and the two-year total matches the '
          + 'surrounding years to better than one percent. A single-year comparison, a growth rate or '
          + 'a per-resident figure for either year on its own will be wrong by roughly $190 million.',
        source_name: 'Georgia DCA Report of Local Government Finances',
        source_url: DCA_URL,
        source_date: '2026-10-17',
      },
    ],
  },

  'Fulton County|GA|2021|operating': {
    id: 'fulton-fy2021-confined-cluster-at-two-percent',
    severity: 'understated',
    headline: 'This total covers almost none of Fulton’s library, recreation and welfare spending for 2021',
    summary:
      'The state filing reports $622,851 of culture and recreation spending for 2021, against about '
      + '$38 million the year before and $35 million the year after. Fulton County’s own budget '
      + 'records show it spent $26.3 million running its libraries that year. Nine lines in total are '
      + 'near zero or blank, while the rest of the return — courts, public safety, health — is '
      + 'ordinary. Shown exactly as filed.',
    whatThisMeans:
      'About a fifth of Fulton’s 2021 spending is not in this total. Do not compare it to the '
      + 'county’s other years.',
    entries: [
      {
        title: 'What the county’s own records show',
        text:
          'Fulton County’s published budget-to-actual schedule reports library spending of $27.4m in '
          + '2019, $28.1m in 2020, $26.3m in 2021, $26.8m in 2022 and $27.8m in 2023 — flat to within '
          + '7% across five years, with no drop in 2021 at all. How the library is funded also did not '
          + 'change: it is a county department paid for out of the general fund throughout, it is not '
          + 'a separate organisation, and there is no separate library tax.',
        source_name: 'Fulton County, Georgia — 2021 Annual Comprehensive Financial Report',
        source_url: 'https://www.fultoncountyga.gov/-/media/Departments/Finance/ACFR-or-CAFR/Fulton-County-Georgia-FY-2021-ACFR.pdf',
        source_date: '2022-12-15',
      },
      {
        title: 'Which lines are affected — and which are fine',
        text:
          'Three lines land at almost exactly 2% of their neighbouring years: libraries ($622,851), '
          + 'welfare ($384,820) and risk management ($137,931). Six more are reported as zero, '
          + 'including recreation and public safety administration. Most of the filing is unaffected — '
          + 'courts are at 96% of neighbouring years and public safety at 84% — so this is a confined '
          + 'group of lines rather than the whole return. About a fifth of the county’s reported '
          + 'spending for the year is missing, and it does not turn up under any other heading.',
        source_name: DCA_NAME,
        source_url: DCA_URL,
        source_date: '2026-10-17',
      },
      {
        title: 'Why this looks like a filing problem, not a spending cut',
        text:
          'The functions affected are ones Fulton runs largely outside its general fund, which fits a '
          + 'return prepared from a narrower set of accounts than the form asks for. 2021 was also the '
          + 'first year the form was completed by a new preparer, and the county’s own audit for that '
          + 'year was not signed off until December 2022 — unusually late, during a period when its '
          + 'fund structure was changing to handle federal pandemic relief. A genuine pandemic closure '
          + 'does not explain it: 2020 was the harder closure year and reports full library and '
          + 'recreation spending, and 2022 returns to normal. No wrongdoing is implied or suggested — '
          + 'the state does not audit or certify these forms.',
        source_name: DCA_NAME,
        source_url: DCA_URL,
        source_date: '2026-10-17',
      },
    ],
  },

  'DeKalb County|GA|2017|operating': {
    id: 'dekalb-fy2017-utility-lines-omitted',
    severity: 'understated',
    headline: 'This total leaves out water, sewer and sanitation — about $230 million in other years',
    summary:
      'DeKalb County reports its water, storm drainage and solid-waste spending inside this total in '
      + 'every year except 2017, where those lines are all blank. Water alone was $155.1 million in '
      + '2016 and $141.6 million in 2019. The rest of the public-works section that year is ordinary, '
      + 'so it is these categories specifically that are absent. Shown exactly as filed, with nothing '
      + 'added back in.',
    whatThisMeans:
      'Do not compare this year’s total to DeKalb’s other years — it covers a narrower set of '
      + 'services.',
    entries: [
      {
        title: 'Which lines are blank',
        text:
          'Storm drainage, wastewater, water, solid waste administration and solid waste collection are '
          + 'all reported as zero for 2017. Water alone was $155.1m in 2016 and $141.6m in 2019. The rest '
          + 'of the public-works section that year is normal — roads, administration and the maintenance '
          + 'shop all carry ordinary full-year figures — so this is a set of missing categories rather '
          + 'than an across-the-board problem.',
        source_name: DCA_NAME,
        source_url: DCA_URL,
        source_date: '2026-10-17',
      },
      {
        title: 'Comparing DeKalb’s years',
        text:
          'DeKalb includes its utility operations in this total in every other year, so its spending '
          + 'series is not directly comparable year to year across 2017, and is not comparable to a '
          + 'government that reports its utilities separately. The county reported $336.0m of utility '
          + 'revenue in 2017 alongside no utility spending at all.',
        source_name: DCA_NAME,
        source_url: DCA_URL,
        source_date: '2026-10-17',
      },
    ],
  },

  'Milledgeville|GA|2025|revenue': {
    id: 'milledgeville-fy2025-rents-royalties',
    severity: 'outlier',
    headline: 'Almost all of this year’s revenue is a single line — $7.18 billion of “Rents and Royalties”',
    summary:
      'Milledgeville has about 16,664 residents. Its 2025 filing reports $7.18 billion on one revenue '
      + 'line, which is around 99.6% of the city’s reported revenue for the year and roughly 18,300 '
      + 'times the most it has ever reported on that line before. The city reported $0.00 on the same '
      + 'line in both 2023 and 2024. The figure is genuinely what the city filed, and is shown as filed.',
    whatThisMeans:
      'Every total for this year is dominated by that one line. Without it the city’s 2025 revenue is '
      + '$31.2 million, in line with its other years.',
    entries: [
      {
        title: 'What makes it extraordinary',
        text:
          'The city reported $0.00 on this same line in both 2023 and 2024, and its previous high was '
          + '$391,806.73 in 2021. The amount works out at roughly $420,000 per resident per year from '
          + 'this one line, and is about a hundred times the city’s entire net position at the previous '
          + 'year end. Remove this single line and the city’s 2025 revenue is $31.2m, which matches its '
          + 'own adopted budget and sits inside its range for every other year.',
        source_name: DCA_NAME,
        source_url: DCA_URL,
        source_date: '2026-10-17',
      },
      {
        title: 'Why it is shown rather than removed',
        text:
          'The figure is a hard-keyed value in the published file, the filing’s own subtotals add up to '
          + 'the penny with it included, and a separate state data portal returns the identical number. '
          + 'A plausible innocent explanation is a non-dollar value typed into a dollar cell — the amount '
          + 'is exactly ten digits, the shape of a phone or account number. No wrongdoing is implied. '
          + 'Removing a figure because it looks implausible would hide it from the people best placed '
          + 'to explain it.',
        source_name: 'University of Georgia Carl Vinson Institute — Tax and Expenditure Data Center',
        source_url: 'https://ted.cviog.uga.edu',
        source_date: '2026-10-17',
      },
    ],
  },
};

/** Look up the flag for a rendered figure. Returns undefined when there is none. */
export function figureFlagFor(
  entityName: string | undefined,
  state: string | undefined,
  fiscalYear: number | string | undefined,
  datasetType: string | undefined,
): FigureFlag | undefined {
  if (!entityName || !state || fiscalYear === undefined || !datasetType) return undefined;
  return figureFlags[`${entityName}|${state}|${fiscalYear}|${datasetType}`];
}
