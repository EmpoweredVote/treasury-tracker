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
 * ── Authoring the copy ─────────────────────────────────────────────────────
 *
 * The register entries are technical and long. These are NOT a dump of them:
 * write plain language a non-accountant can act on, state the published figure
 * and the comparison, and never imply wrongdoing — these are self-reported
 * forms that the publisher explicitly does not certify, and the defects found
 * so far UNDERSTATE spending rather than inflate it.
 */

import type { ComparabilitySource } from '../types/budget';

export type FigureFlagSeverity = 'understated' | 'outlier';

export interface FigureFlag {
  /** Matches the id in the author-facing register, so the two can be tied. */
  id: string;
  /** Short headline for the always-visible banner. One line. */
  headline: string;
  /** One or two sentences for the banner body. Plain language. */
  summary: string;
  /**
   * Steers the banner's colour and icon only.
   *   understated — the published figure is lower than the government's own
   *                 audited statements, so the page is showing too little.
   *   outlier     — the figure is extreme against its own history but the
   *                 publisher's arithmetic carries it.
   */
  severity: FigureFlagSeverity;
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
    headline: 'This spending figure is far lower than the county’s audited accounts',
    summary:
      'DeKalb County’s filing to the state reports $92.0 million of spending for 2018, while the '
      + 'county’s own audited financial statements report $654.5 million for the same year — so the '
      + 'figure shown here is about a seventh of what the county actually spent. It is displayed '
      + 'exactly as filed, and flagged rather than altered.',
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

  'Fulton County|GA|2021|operating': {
    id: 'fulton-fy2021-confined-cluster-at-two-percent',
    severity: 'understated',
    headline: 'Library, recreation and welfare spending is almost entirely missing from this year',
    summary:
      'Fulton County’s filing to the state reports $622,851 of culture and recreation spending for '
      + '2021, against about $38 million the year before and $35 million the year after. The county’s '
      + 'own budget records show it actually spent $26.3 million running its libraries that year. '
      + 'Eight other spending lines are similarly near zero or blank. The figures are shown exactly as '
      + 'filed, and flagged rather than altered.',
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
    headline: 'Water, sewer and sanitation spending is missing from this year',
    summary:
      'DeKalb County normally reports its water, storm drainage and solid-waste spending inside this '
      + 'total — more than $230 million in neighbouring years — but every one of those lines is blank '
      + 'in the 2017 filing. The total shown is therefore lower than, and not comparable to, the '
      + 'county’s other years. It is displayed exactly as filed, with nothing added back in.',
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
    headline: 'One revenue line in this filing is extraordinarily large',
    summary:
      'Milledgeville (population 16,664) reported $7.18 billion of “Rents and Royalties” for 2025 — '
      + 'around 99.6% of its own reported revenue that year, and roughly 18,300 times its previous '
      + 'maximum for that line. The figure is genuinely what the city filed, and is shown as filed.',
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
