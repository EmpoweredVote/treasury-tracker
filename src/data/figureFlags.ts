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
  'Monroe|GA|2025|revenue': {
    id: 'monroe-fy2025-other-intergovernmental-line',
    severity: 'outlier',
    headline: 'One line of the 2025 return carries $1.69 billion — nineteen times everything the city handles',
    summary:
      'Almost all of this year’s revenue comes from a single free-text row of the form, “Other '
      + 'Intergovernmental Revenues — attach list”, which reads $1,686,319,022. Every other '
      + 'line on the same page is normal, and so is the city’s spending. Monroe’s own audited '
      + 'accounts for the same year report $89.2 million of total revenue including its '
      + 'electric utility, and $4.2 million of money received from other governments. The '
      + 'figure is shown as filed.',
    whatThisMeans:
      'Do not use 2025 revenue for Monroe, and do not compare it with 2024 — the rise is this '
      + 'one row, not anything the city received. The rest of the 2025 return is usable.',
    entries: [
      {
        title: 'Where the money actually is on the form',
        text:
          'The intergovernmental section lists six lines. Five are ordinary: payment in lieu of '
          + 'taxes $101,356, road maintenance grants $206,713, crime and corrections grants '
          + '$42,310, community development grants $5,580, and the city’s share of the local '
          + 'sales tax $2,890,186. The sixth — a free-text “other, attach list” row — reads '
          + '$1,686,319,022. The same row was $2,670,179 in 2024 and $2,496,501 in 2023.',
        source_name: 'Georgia DCA Report of Local Government Finances — Monroe FY2023–FY2025',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-18',
      },
      {
        title: 'What the city’s own audited accounts report',
        text:
          'The City of Monroe’s annual comprehensive financial report for the year ended 31 '
          + 'December 2025 reports $4,232,497 of intergovernmental revenue across all '
          + 'governmental funds, and total revenues of $89,170,673 — $21.2 million from '
          + 'government activities and $68.0 million from the city’s utilities. The single form '
          + 'line is roughly nineteen times the city’s entire annual revenue.',
        source_name: 'City of Monroe, Georgia — 2025 Annual Comprehensive Financial Report, statement of activities and governmental funds statements',
        source_url: 'https://app.fac.gov/dissemination/report/pdf/2025-12-GSAFAC-0000422443',
        source_date: '2026-10-18',
      },
      {
        title: 'What is likely, and what is not being claimed',
        text:
          'Divided by a thousand the line reads $1,686,319, which sits between what the same '
          + 'row reported in 2023 and 2024, and would bring the section to $4.9 million against '
          + 'the audited $4.2 million. A figure entered in thousands on a form that asks for '
          + 'dollars is therefore the most likely explanation — but no source states it, the '
          + 'attachment the row refers to was not obtained, and Treasury Tracker shows the '
          + 'number as filed rather than substituting a corrected one.',
        source_name: 'Georgia DCA Report of Local Government Finances — Monroe FY2025',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/2147003_2025_RLGF_Monroe.xls',
        source_date: '2026-10-18',
      },
    ],
  },

  'Varnell|GA|2018|revenue': {
    id: 'varnell-fy2018-real-property-tax-line',
    severity: 'outlier',
    headline: 'One line of the 2018 return reports $44.1 million of property tax for a town of about 2,000',
    summary:
      'The “real property taxes, current year” line reads $44,107,410. The same line was $67,370 '
      + 'the year before, and Varnell’s entire revenue is about $1 million in every other year '
      + 'it filed. Its spending for 2018 is $783,695 — completely ordinary — so only the revenue '
      + 'side moves. The figure is shown as filed.',
    whatThisMeans:
      'Treat 2018 revenue as unusable for this town and read the surrounding years instead. The '
      + 'spending side of the same return is unaffected.',
    entries: [
      {
        title: 'What the town reports in its other years',
        text:
          'Varnell’s eight other filings report total revenue between $874,715 and $1,879,709. '
          + 'Divided by a thousand the 2018 line reads $44,107, which is the same order as the '
          + '$67,370 reported the year before — so a figure entered in the wrong units is the '
          + 'most likely explanation, though nothing states it.',
        source_name: 'Georgia DCA Report of Local Government Finances — Varnell FY2016–FY2025',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-18',
      },
      {
        title: '⚠ Why there is no audited figure to compare',
        text:
          'Varnell files no federal Single Audit: it spends below the $750,000 threshold that '
          + 'requires one, so no independently audited statement of its finances exists. This '
          + 'flag rests on the town’s own other filings alone, which is weaker evidence than the '
          + 'audited comparisons shown for larger governments, and is said plainly rather than '
          + 'glossed over.',
        source_name: 'Federal Audit Clearinghouse — General data (no record for this government)',
        source_url: 'https://app.fac.gov/dissemination/public-data/gsa/full/general.csv',
        source_date: '2026-10-18',
      },
    ],
  },

  'Cornelia|GA|2017|revenue': {
    id: 'cornelia-fy2017-water-wastewater-grants-line',
    severity: 'outlier',
    headline: 'One line of the 2017 return reports $63.8 million of water and wastewater grants',
    summary:
      'The “water/wastewater grants” line reads $63,781,999, against $1,012,024 the year before, '
      + 'for a city of about 4,500 people whose total revenue is $4–9 million in every other '
      + 'year. The city’s spending for the same year is an ordinary $4.5 million, so no matching '
      + 'outlay appears. The figure is shown as filed.',
    whatThisMeans:
      'Do not use 2017 revenue for Cornelia or compare it with 2016 or 2018.',
    entries: [
      {
        title: 'What the city reports in its other years',
        text:
          'Cornelia’s eight other filings report total revenue between $4.2 million and $9.2 '
          + 'million, and the same grant line runs about $1.0 million in 2016. Unlike the '
          + 'similar figures flagged for Monroe, Varnell and Shellman, this one does not fit a '
          + 'simple unit error: divided by a thousand it would read $63,782, which is sixteen '
          + 'times SMALLER than the year before. What happened here is not established.',
        source_name: 'Georgia DCA Report of Local Government Finances — Cornelia FY2016–FY2025',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-18',
      },
    ],
  },

  'Shellman|GA|2024|revenue': {
    id: 'shellman-fy2024-interest-revenues-line',
    severity: 'outlier',
    headline: 'One line of the 2024 return reports $9.0 million of interest for a town of about 1,000',
    summary:
      'The “interest revenues” line reads $9,049,486, against $1,938 the year before. At 2024 '
      + 'interest rates that would require roughly $180 million on deposit, for a town whose '
      + 'whole annual revenue is under $1 million. Spending for the same year is $1.5 million, '
      + 'so no matching outlay appears. The figure is shown as filed.',
    whatThisMeans:
      'Treat 2024 revenue as unusable for this town; its 2023 and 2025 figures are the better '
      + 'guide.',
    entries: [
      {
        title: 'Why the figure cannot be what it says',
        text:
          'Shellman’s nine other filings report total revenue between $492,940 and $1,034,473. '
          + 'Interest of $9.0 million at the rates prevailing in 2024 implies a balance of '
          + 'roughly $180 million — about two hundred times the town’s annual revenue. Divided by '
          + 'a thousand the line reads $9,049, which is an ordinary figure for a town this size.',
        source_name: 'Georgia DCA Report of Local Government Finances — Shellman FY2016–FY2025',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-18',
      },
    ],
  },

  'Franklin County|GA|2023|revenue': {
    id: 'franklin-fy2023-filing-is-all-but-empty',
    severity: 'understated',
    headline: 'Franklin County’s 2023 return is almost entirely blank — this is under 1% of a normal year',
    summary:
      'The county reported $192,274 of revenue for 2023, in a single category. In every other '
      + 'year it filed, Franklin reported between $17.8 million and $34.3 million, and its own '
      + 'audited accounts for 2024 show $22.6 million in the general fund alone. The spending side '
      + 'of the same return is blank, so no spending figure is shown for 2023 at all. The amount '
      + 'here is displayed exactly as filed.',
    whatThisMeans:
      'Treat 2023 as a year with no usable data for this county rather than as a collapse in '
      + 'revenue. Franklin’s 2022 and 2025 figures are the better guide.',
    entries: [
      {
        title: 'What the county reports in every other year',
        text:
          'Franklin County’s returns report revenue of $18.4m (2016), $17.8m (2017), $19.0m '
          + '(2018), $20.9m (2019), $24.0m (2020), $25.9m (2022) and $34.3m (2025). The state '
          + 'publishes no 2021 or 2024 return for this county. Against that series, 2023’s '
          + '$192,274 is not a smaller year — it is an all but empty form.',
        source_name: 'Georgia DCA Report of Local Government Finances — Franklin County FY2016–FY2025',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-17',
      },
      {
        title: 'What the county’s audited accounts show',
        text:
          'Franklin County’s audited financial statements for the year ended 30 June 2024 report '
          + 'general fund revenues of $22,561,941. There is no audited report for 2023, so this '
          + 'establishes the county’s scale rather than what 2023 itself should have been — but it '
          + 'confirms that a county of this size does not take $192,274 in a year.',
        source_name: 'Franklin County, Georgia — FY2024 Single Audit, general fund statement of revenues, expenditures and changes in fund balances — budget and actual',
        source_url: 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000350197',
        source_date: '2026-10-17',
      },
      {
        title: 'Why this still appears at all',
        text:
          'Treasury Tracker shows what a government filed rather than deciding what it ought to '
          + 'have filed, so the $192,274 is shown as filed and flagged instead of being removed or '
          + 'replaced. The spending side is different: it is blank rather than small, so there is '
          + 'no figure to show and no spending row exists for 2023.',
        source_name: 'Georgia DCA Report of Local Government Finances — Franklin County FY2023',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1059059_2023_RLGF_Franklin.xls',
        source_date: '2026-10-17',
      },
    ],
  },

  'Lowndes County|GA|2018|operating': {
    id: 'lowndes-fy2018-expenditure-side-is-about-one-quarter',
    severity: 'understated',
    headline: 'Lowndes’s own audited accounts report about four times this much spending for 2018',
    summary:
      'The state form shown here reports $23.6 million of spending for 2018. The county’s own '
      + 'audited financial statements for the same year report $89.4 million across its '
      + 'governmental funds. Every part of the form’s spending section is low by a similar '
      + 'amount, so this looks like a return that was only partly filled in — not a year in which '
      + 'the county spent less.',
    whatThisMeans:
      'Treat 2018 spending as incomplete. The county’s 2017 and 2019 figures ($107.5m and $87.2m) '
      + 'are the better guide to its actual scale, and the revenue side of 2018 is unaffected.',
    entries: [
      {
        title: 'What the county’s own audited statements report',
        text:
          'Lowndes County’s audited financial statements for the year ended 30 June 2018 report '
          + 'total expenditures of $55,812,164 in the General Fund, $18,725,238 and $14,830,382 in '
          + 'its other governmental funds — $89,367,784 in all. The state form reports $23,615,258, '
          + 'which is 26.4% of that.',
        source_name: 'Lowndes County, Georgia — FY2018 Single Audit, governmental funds statement of revenues, expenditures and changes in fund balances',
        source_url: 'https://app.fac.gov/dissemination/report/pdf/2018-06-CENSUS-0000136968',
        source_date: '2026-10-17',
      },
      {
        title: 'The shortfall is spread across every category, not confined to one',
        text:
          'Compared with the average of 2017 and 2019, general administration comes to 36% of '
          + 'normal, judicial 28%, public safety 21%, public works 18%, health and welfare 20%, '
          + 'culture and recreation 37%, and housing and development 26%. Because the proportions '
          + 'differ from one another this is not a decimal-point error — it reads as part of the '
          + 'year, or part of the funds, being left out.',
        source_name: 'Georgia DCA Report of Local Government Finances — Lowndes County FY2017–FY2019',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-17',
      },
      {
        title: 'The figure shown is the one the county filed',
        text:
          'Treasury Tracker shows $23,615,258 as filed, because that is what Lowndes County reported to the '
          + 'state. It is not replaced with the audited figure: that would publish a number this '
          + 'publisher never filed. The form is internally consistent — its own printed totals '
          + 'match its line items exactly — so nothing was misread in producing this page.',
        source_name: 'Georgia DCA Report of Local Government Finances — Lowndes County FY2018',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1092092_2018_RLGF_Lowndes.xls',
        source_date: '2026-10-17',
      },
    ],
  },

  'Lowndes County|GA|2022|revenue': {
    id: 'lowndes-fy2022-sales-tax-is-forty-four-times-audited',
    severity: 'outlier',
    headline: 'The sales tax figure for 2022 is about 44 times what the county’s audited accounts report',
    summary:
      'This year’s form reports $1.67 billion of sales and use tax — more than Lowndes County’s '
      + 'entire revenue in any other year. The county’s own audited statements report $37.6 million '
      + 'of sales taxes for 2022. The county reported the figure and the form adds it up correctly, '
      + 'so the page reproduces the filing faithfully, but the figure itself does not stand up '
      + 'against the county’s audited accounts or against its own other years.',
    whatThisMeans:
      'Do not use 2022 revenue for this county, and do not compare it with 2021 or 2023 — the rise '
      + 'and fall either side of it are this one figure, not anything the county did.',
    entries: [
      {
        title: 'What the county’s own audited statements report',
        text:
          'Lowndes County’s 2023 annual financial report gives sales taxes of $37.59 million for '
          + '2022 and $36,756,343 for 2023, and describes sales tax as “the major contributor to '
          + 'general revenues… 41% of total general revenues”. The state form’s $1,673,304,896 for '
          + '2022 is 44.5 times the audited figure.',
        quote:
          'Sales tax revenues are the major contributor to general revenues and account for '
          + '$36,756,343 or 41% of total general revenues.',
        source_name: 'Lowndes County, Georgia — FY2023 Annual Comprehensive Financial Report, management’s discussion and analysis',
        source_url: 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000024739',
        source_date: '2026-10-17',
      },
      {
        title: 'Only this one line moves',
        text:
          'Every other part of the same filing is ordinary. Property taxes are $41.3 million against '
          + '$40.5 million the year before; licences, service charges and the rest are all in line '
          + 'with neighbouring years. Sales and use tax alone goes from $16.0 million in 2021 to '
          + '$1.67 billion in 2022 and back to $26.0 million in 2023.',
        source_name: 'Georgia DCA Report of Local Government Finances — Lowndes County FY2021–FY2023',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-17',
      },
      {
        title: 'What is not being claimed',
        text:
          'Dividing the figure by exactly 100 gives $16.7 million, which would sit neatly between '
          + '2021 and 2023 — so a misplaced decimal point is the most likely explanation. That is '
          + 'not stated as fact: no source says so, and the stored value does not divide into a '
          + 'clean figure. Treasury Tracker shows the number as filed and leaves the cause '
          + 'open rather than substituting a corrected figure of its own.',
        source_name: 'Georgia DCA Report of Local Government Finances — Lowndes County FY2022',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1092092_2022_RLGF_Lowndes.xls',
        source_date: '2026-10-17',
      },
    ],
  },

  // ── TRANSITION STUBS: a short fiscal year sitting beside full ones ────────
  //
  // ⚠⚠ THE FIGURES ARE CORRECT. Each of these covers a REAL, SHORTER period —
  // the government changed the month its financial year ends, and the year in
  // between is a stub. Nothing is wrong with the number; what breaks is reading
  // it beside its neighbours as though it were a full year. That is exactly
  // what `not-comparable` is for, and it must not read as `understated`.
  'Barrow County|GA|2017|operating': {
    id: 'barrow-fy2017-nine-month-transition-year',
    severity: 'not-comparable',
    headline: 'This is a nine-month year, not a full one — Barrow moved its year-end in 2017',
    summary:
      'Barrow County used to close its books on 30 September. In 2017 it moved to 30 June, so the '
      + 'year shown here runs nine months instead of twelve. The county says so on the form itself. '
      + 'The figure is correct for the period it covers and is shown as filed — it is simply a '
      + 'shorter period than the years either side of it, so comparing them is comparing nine '
      + 'months with twelve.',
    whatThisMeans:
      'Expect roughly three quarters of a normal year here. Do not read the dip as a spending cut, '
      + 'and do not compare 2017 directly with 2016 or 2018.',
    entries: [
      {
        title: 'The county states the short period on the form itself',
        text:
          'Barrow County’s 2017 report records its months reported as 9, and answers “Yes” to the '
          + 'form’s question about whether the fiscal year changed. Its 2016 report gives a year-end '
          + 'of 30 September; every report from 2017 onwards gives 30 June. This is the only one of '
          + 'the three Georgia counties that changed calendar mid-series where the form declares the '
          + 'change itself.',
        source_name: 'Georgia DCA Report of Local Government Finances — Barrow County FY2017',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1007007_2017_RLGF_Barrow.xls',
        source_date: '2026-10-17',
      },
      {
        title: 'The money matches a nine-month period',
        text:
          'Spending in 2017 is $35.4 million against an average of $45.8 million in 2016 and 2018 — '
          + 'a ratio of 0.77, where nine months of a twelve-month year would be 0.75. Revenue runs a '
          + 'little higher at 0.87, which is what a changeover does to tax collection: a billing '
          + 'cycle does not divide neatly into the stub. Both are shown exactly as filed.',
        source_name: 'Georgia DCA Report of Local Government Finances — Barrow County FY2016–FY2018',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-17',
      },
      {
        title: 'The federal audit record agrees on both calendars',
        text:
          'Barrow County’s own federal Single Audit filings report a financial year starting in '
          + 'October for 1998 through 2016, and starting in July for 2019 and 2024 — the same change, '
          + 'in the same direction, recorded independently of the state form.',
        source_name: 'Federal Audit Clearinghouse — General data, audited fiscal periods',
        source_url: 'https://app.fac.gov/dissemination/public-data/gsa/full/general.csv',
        source_date: '2026-10-17',
      },
    ],
  },

  'Talbot County|GA|2022|operating': {
    id: 'talbot-fy2022-three-month-transition-year',
    severity: 'not-comparable',
    headline: 'This is a three-month year, not a full one — Talbot moved its year-end in 2022',
    summary:
      'Talbot County closed its books on 30 June through 2021 and on 30 September from 2022 onwards, '
      + 'so the year shown here covers about three months rather than twelve. The figure is correct '
      + 'for the period it covers and is shown as filed, but it is not comparable with the years '
      + 'around it. ⚠ Unlike Barrow’s equivalent year, the form does not say the '
      + 'period was short — it still reports twelve months — so the only way to see it is the size '
      + 'of the figures and the county’s own change of year-end.',
    whatThisMeans:
      'Expect roughly a quarter of a normal year here. The drop from 2021 and the jump to 2023 are '
      + 'the calendar changing, not the county’s finances.',
    entries: [
      {
        title: 'The year-end moves, and the money moves with it',
        text:
          'Talbot’s reports give a year-end of 30 June for 2016 through 2021 and 30 September for '
          + '2022 through 2025. Spending in 2022 is $2.04 million against an average of $8.25 million '
          + 'in 2021 and 2023 — a ratio of 0.247, where three months of a twelve-month year would be '
          + '0.25. Revenue shows the same break at 0.19. Four consecutive later reports give the new '
          + 'date, so this is a change of calendar and not a one-year mistake on the form. The '
          + 'figures are shown exactly as filed.',
        source_name: 'Georgia DCA Report of Local Government Finances — Talbot County FY2021–FY2023',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1130130_2022_RLGF_Talbot.xls',
        source_date: '2026-10-17',
      },
      {
        title: '⚠ What the form gets wrong, stated plainly',
        text:
          'The 2022 report answers “No” to the form’s question about whether the fiscal year changed, '
          + 'and reports twelve months — while reporting about three months of money. The figures '
          + 'themselves are consistent and reconcile to the report’s own printed totals; it is the '
          + 'period description that is wrong. Treasury Tracker records the year-end the report gives '
          + 'for each year, so this year is stored as a September year-end, matching the change.',
        source_name: 'Georgia DCA Report of Local Government Finances — Talbot County FY2022',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1130130_2022_RLGF_Talbot.xls',
        source_date: '2026-10-17',
      },
      {
        title: 'What the federal audit record can and cannot confirm',
        text:
          '⚠ Talbot County’s federal Single Audit filings report a financial year starting in July '
          + 'for 1998 through 2014 — the earlier calendar — and carry no filing on the later one at '
          + 'all. So the first half of this change is independently corroborated and the second half '
          + 'rests on the county’s own reports. That is weaker evidence than Barrow’s, and is '
          + 'recorded as such rather than presented as settled.',
        source_name: 'Federal Audit Clearinghouse — General data, audited fiscal periods',
        source_url: 'https://app.fac.gov/dissemination/public-data/gsa/full/general.csv',
        source_date: '2026-10-17',
      },
    ],
  },

  'Barrow County|GA|2017|revenue': {
    id: 'barrow-fy2017-nine-month-transition-year',
    severity: 'not-comparable',
    headline: 'This is a nine-month year, not a full one — Barrow moved its year-end in 2017',
    summary:
      'Barrow County used to close its books on 30 September. In 2017 it moved to 30 June, so the '
      + 'year shown here runs nine months instead of twelve. The county says so on the form itself. '
      + 'The figure is correct for the period it covers and is shown as filed — it is simply a '
      + 'shorter period than the years either side of it, so comparing them is comparing nine '
      + 'months with twelve.',
    whatThisMeans:
      'Expect roughly three quarters of a normal year here. Do not read the dip as revenue falling, '
      + 'and do not compare 2017 directly with 2016 or 2018.',
    entries: [
      {
        title: 'The county states the short period on the form itself',
        text:
          'Barrow County’s 2017 report records its months reported as 9, and answers “Yes” to the '
          + 'form’s question about whether the fiscal year changed. Its 2016 report gives a year-end '
          + 'of 30 September; every report from 2017 onwards gives 30 June. This is the only one of '
          + 'the three Georgia counties that changed calendar mid-series where the form declares the '
          + 'change itself.',
        source_name: 'Georgia DCA Report of Local Government Finances — Barrow County FY2017',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1007007_2017_RLGF_Barrow.xls',
        source_date: '2026-10-17',
      },
      {
        title: 'The money matches a nine-month period',
        text:
          'Spending in 2017 is $35.4 million against an average of $45.8 million in 2016 and 2018 — '
          + 'a ratio of 0.77, where nine months of a twelve-month year would be 0.75. Revenue runs a '
          + 'little higher at 0.87, which is what a changeover does to tax collection: a billing '
          + 'cycle does not divide neatly into the stub. Both are shown exactly as filed.',
        source_name: 'Georgia DCA Report of Local Government Finances — Barrow County FY2016–FY2018',
        source_url: 'https://apps.dca.ga.gov/RLGF/Default.aspx',
        source_date: '2026-10-17',
      },
      {
        title: 'The federal audit record agrees on both calendars',
        text:
          'Barrow County’s own federal Single Audit filings report a financial year starting in '
          + 'October for 1998 through 2016, and starting in July for 2019 and 2024 — the same change, '
          + 'in the same direction, recorded independently of the state form.',
        source_name: 'Federal Audit Clearinghouse — General data, audited fiscal periods',
        source_url: 'https://app.fac.gov/dissemination/public-data/gsa/full/general.csv',
        source_date: '2026-10-17',
      },
    ],
  },

  'Talbot County|GA|2022|revenue': {
    id: 'talbot-fy2022-three-month-transition-year',
    severity: 'not-comparable',
    headline: 'This is a three-month year, not a full one — Talbot moved its year-end in 2022',
    summary:
      'Talbot County closed its books on 30 June through 2021 and on 30 September from 2022 onwards, '
      + 'so the year shown here covers about three months rather than twelve. The figure is correct '
      + 'for the period it covers and is shown as filed, but it is not comparable with the years '
      + 'around it. ⚠ Unlike Barrow’s equivalent year, the form does not say the '
      + 'period was short — it still reports twelve months — so the only way to see it is the size '
      + 'of the figures and the county’s own change of year-end.',
    whatThisMeans:
      'Expect roughly a quarter of a normal year here. The drop from 2021 and the jump to 2023 are '
      + 'the calendar changing, not the county’s finances.',
    entries: [
      {
        title: 'The year-end moves, and the money moves with it',
        text:
          'Talbot’s reports give a year-end of 30 June for 2016 through 2021 and 30 September for '
          + '2022 through 2025. Spending in 2022 is $2.04 million against an average of $8.25 million '
          + 'in 2021 and 2023 — a ratio of 0.247, where three months of a twelve-month year would be '
          + '0.25. Revenue shows the same break at 0.19. Four consecutive later reports give the new '
          + 'date, so this is a change of calendar and not a one-year mistake on the form. The '
          + 'figures are shown exactly as filed.',
        source_name: 'Georgia DCA Report of Local Government Finances — Talbot County FY2021–FY2023',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1130130_2022_RLGF_Talbot.xls',
        source_date: '2026-10-17',
      },
      {
        title: '⚠ What the form gets wrong, stated plainly',
        text:
          'The 2022 report answers “No” to the form’s question about whether the fiscal year changed, '
          + 'and reports twelve months — while reporting about three months of money. The figures '
          + 'themselves are consistent and reconcile to the report’s own printed totals; it is the '
          + 'period description that is wrong. Treasury Tracker records the year-end the report gives '
          + 'for each year, so this year is stored as a September year-end, matching the change.',
        source_name: 'Georgia DCA Report of Local Government Finances — Talbot County FY2022',
        source_url: 'https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/1130130_2022_RLGF_Talbot.xls',
        source_date: '2026-10-17',
      },
      {
        title: 'What the federal audit record can and cannot confirm',
        text:
          '⚠ Talbot County’s federal Single Audit filings report a financial year starting in July '
          + 'for 1998 through 2014 — the earlier calendar — and carry no filing on the later one at '
          + 'all. So the first half of this change is independently corroborated and the second half '
          + 'rests on the county’s own reports. That is weaker evidence than Barrow’s, and is '
          + 'recorded as such rather than presented as settled.',
        source_name: 'Federal Audit Clearinghouse — General data, audited fiscal periods',
        source_url: 'https://app.fac.gov/dissemination/public-data/gsa/full/general.csv',
        source_date: '2026-10-17',
      },
    ],
  },

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
