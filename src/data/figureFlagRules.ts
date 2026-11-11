/**
 * Figure flags that are RULES, not entries.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⭐⭐⭐ WHY THIS MODULE EXISTS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every flag in `figureFlags.ts` is there because a person spent a day on that
 * entity. That makes coverage a record of ATTENTION, not of data: "unflagged"
 * has never meant "checked and fine", only "nobody looked".
 *
 * West Hollywood FY2016 is the proof. Its revenue reads $114.7M → $214.4M →
 * $132.6M, and the spike is one line: $85,015,000 of bond proceeds. Nothing
 * flagged it, and West Hollywood is one of the most heavily examined entities
 * in this repo. Asking the whole fleet the same question finds **43 city-years
 * across 36 entities**, of which West Hollywood is the eleventh largest.
 *
 * So a rule is evaluated over every budget in the series, and the flags it
 * emits are a consequence of the data rather than of who was looking.
 *
 * ── ⚠⚠ NO NUMBER IN THIS FILE IS TYPED ─────────────────────────────────────
 *
 * Every figure in every sentence below is interpolated from the measured row,
 * which is the same value the chart draws. That is the structural fix for the
 * defect PR #364 shipped and then repaired: a banner that hard-coded
 * "$275.28 million" for a file the city appends to weekly, which would have
 * ended up contradicting the total printed beside it. A figure stated in prose
 * cannot drift from the figure in the chart if it IS the figure in the chart.
 *
 * ── ⚠ THE THRESHOLD IS A JUDGEMENT, AND IT IS PUBLISHED ────────────────────
 *
 * 25% is a choice. It lives in ONE place —
 * `scripts/generateBondFinancedRevenue.mjs` — the register records the value it
 * was built at, the gate refuses to run if the two disagree, and the banner
 * states it in words the reader can apply themselves ("more than a quarter").
 * That is the difference between a threshold and a secret.
 *
 * ── ⚠⚠ WHAT A RULE MAY CLAIM ───────────────────────────────────────────────
 *
 * Only what the publisher published. The condition here is arithmetic over two
 * of the State Controller's own figures — a line it names and a total it
 * prints — so it is a FACT ABOUT THE FILE. A rule whose condition needed an
 * INFERENCE about the publisher would belong in an author-facing register
 * instead, like Frisco's four anomalies, and must not be emitted here.
 *
 * ⚠ And the copy claims nothing about neighbouring years. Several entities are
 * flagged in more than one year — Vernon in FY2003, FY2012 and FY2016; Albany
 * in FY2003 and FY2008 — so "unlike the years around it" would be FALSE for
 * them. The sentence says only that a year with a bond issue is not comparable
 * with one without.
 */
import type { FigureFlag } from './figureFlags';
import { formatMoneyExact, formatMoneyProse } from '../utils/formatMoney';
import register from './bondFinancedRevenueYears.json';
import distortionRegister from './fiscalPeriodDistortionYears.json';
import absentRegister from './absentMonthYears.json';

/** One measured year, exactly as `generateBondFinancedRevenue.mjs` wrote it. */
export interface BondFinancedYear {
  id: string;
  entity: string;
  state: string;
  fiscalYear: number;
  datasetType: string;
  total: number;
  bondAmount: number;
  lines: string[];
  sourceUrl: string;
  loaded: boolean;
  readerFacing: boolean;
}

export const BOND_FINANCED_YEARS = register.rows as BondFinancedYear[];
export const BOND_SHARE_THRESHOLD = register.thresholdShare as number;
export const BOND_MEASURED_ON = register.measuredOn as string;

const SOURCE_NAME = 'California State Controller — Cities Annual Report (Revenues)';

/** `39.7` — one decimal, because 40% and 39.7% read differently at a glance. */
export function bondSharePct(row: BondFinancedYear): number {
  return Math.round((1000 * row.bondAmount) / row.total) / 10;
}

/**
 * ⚠ The publisher's own label, VERBATIM, underscore and all
 * (`Revenue Bond Proceeds_Functional Revenues`). It is ugly, and tidying it
 * would break the one thing the evidence line is for: a reader finding that
 * exact string in the Controller's dataset. The plain phrase "bond proceeds"
 * carries the meaning in the summary; this carries the proof.
 */
function lineList(lines: string[]): string {
  if (lines.length === 1) return `“${lines[0]}”`;
  return `${lines.slice(0, -1).map((l) => `“${l}”`).join(', ')} and “${lines[lines.length - 1]}”`;
}

/** The flag one measured year emits. Every figure comes from `row`. */
export function bondFinancedRevenueFlag(row: BondFinancedYear): FigureFlag {
  const pct = bondSharePct(row);
  const bondProse = formatMoneyProse(row.bondAmount);
  const bondExact = formatMoneyExact(row.bondAmount);
  const totalExact = formatMoneyExact(row.total);
  const plural = row.lines.length === 1 ? 'the line' : 'the lines';

  return {
    id: row.id,
    severity: 'not-comparable',
    headline: `About ${bondProse} of this year’s revenue — ${pct}% — is bond proceeds, not income`,
    summary:
      `The State Controller reports ${bondExact} of ${row.entity}’s FY${row.fiscalYear} revenue on `
      + `${plural} ${lineList(row.lines)}. Bond proceeds are money raised by borrowing and repaid in `
      + `later years, and the Controller counts them inside the revenue total. The figure is shown `
      + `exactly as filed and the classification is the Controller’s own — but a year holding a bond `
      + `issue is not comparable with one that does not.`,
    whatThisMeans:
      `Read this as the year’s revenue plus a one-off bond issue. To compare it with another year, `
      + `set the ${bondProse} of bond proceeds aside first.`,
    entries: [
      {
        title: 'What the published total contains',
        text:
          `${row.entity}’s FY${row.fiscalYear} revenue total is ${totalExact}. Of that, ${bondExact} `
          + `sits on ${plural} ${lineList(row.lines)} — ${pct}% of the total. Both figures are the `
          + `State Controller’s own and are loaded exactly as published. This banner appears wherever `
          + `bond proceeds exceed a quarter of a year’s reported revenue, which is true of `
          + `${BOND_FINANCED_YEARS.length} city-years in this series.`,
        source_name: SOURCE_NAME,
        source_url: row.sourceUrl,
        source_date: BOND_MEASURED_ON,
      },
    ],
  };
}

/**
 * Every flag this rule emits, keyed the way `figureFlagFor` looks them up.
 *
 * ⚠ A rule RETIRES ITSELF. When a year stops crossing the threshold — a reload,
 * a restatement — it leaves the register and its banner disappears with it. No
 * human has to remember, which is the failure mode McKinney's eleven-month flag
 * still depends on avoiding by hand.
 */
export function bondFinancedRevenueFlags(): Record<string, FigureFlag> {
  const out: Record<string, FigureFlag> = {};
  for (const row of BOND_FINANCED_YEARS) {
    out[`${row.entity}|${row.state}|${row.fiscalYear}|${row.datasetType}`] = bondFinancedRevenueFlag(row);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FISCAL-PERIOD RULES — the second and third rules, over `transactions`.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⭐⭐⭐ THESE REPLACE SIX HAND-WRITTEN ENTRIES. West Hollywood had five
 * straddle banners and McKinney an eleven-month banner, and all six existed
 * because a person spent a day on that city. Asking all 43 transaction budgets
 * the same two questions reproduces the five West Hollywood years exactly —
 * and finds a sixth nobody had flagged: **Frisco FY2021 holds ten months.**
 * Its file stops on 2021-07-29 and is drawn beside FY2020 and FY2022, both
 * complete. Frisco has its own anomaly register and its own row-coverage
 * baseline; neither asked this question.
 *
 * ── ⭐⭐ THE SEAM RULE IS GONE, AND THAT IS THE DESIGN ──────────────────────
 *
 * The hand-written set needed a second rule a human had to apply: "both sides
 * of a seam are flagged". FY2020 and FY2025 are nearly spotless in themselves
 * and still read wrong, because the money paid during them sits in the file
 * before. Measuring the RECEIVING side as its own share — `displacedShare` —
 * makes that fall out of one number. Nobody has to notice a seam any more.
 *
 * ── ⭐⭐⭐ AND THE ABSENT-MONTH RULE RETIRES ITSELF ─────────────────────────
 *
 * McKinney's banner says the year covers eleven months. The day the city posts
 * September and TT reloads, that sentence becomes FALSE, and a banner telling
 * a reader a COMPLETE year is incomplete is its own misinformation. Until now
 * only a person remembering to delete it stood between those two states. The
 * condition is computed from the file, so the row leaves the register on the
 * next run and the banner goes with it.
 */

/** One measured year, exactly as `generateFiscalPeriodFlags.mjs` wrote it. */
export interface FiscalPeriodDistortionYear {
  id: string;
  entity: string;
  state: string;
  fiscalYear: number;
  datasetType: string;
  severity: 'not-comparable';
  total: number;
  periodStart: string;
  periodEnd: string;
  outRows: number;
  outAmount: number;
  rowsBefore: number;
  amountBefore: number;
  rowsAfter: number;
  amountAfter: number;
  earliestOut: string | null;
  latestOut: string | null;
  inWindow: number;
  elsewhereRows: number;
  elsewhereAmount: number;
  elsewhereYears: number[];
  ownShare: number;
  displacedShare: number;
  axis: 'own' | 'displaced';
  hasPriorYear: boolean;
  hasNextYear: boolean;
  stillGrowing: boolean;
  sourceName: string;
  sourceUrl: string;
  loaded: boolean;
  readerFacing: boolean;
}

/** One measured year whose own file does not cover its whole fiscal period. */
export interface AbsentMonthYear {
  id: string;
  entity: string;
  state: string;
  fiscalYear: number;
  datasetType: string;
  severity: 'incomplete-period';
  total: number;
  rowCount: number;
  periodStart: string;
  periodEnd: string;
  firstPayment: string;
  lastPayment: string;
  monthsInPeriod: number;
  monthsCovered: number;
  absentMonths: string[];
  completeYears: number[];
  completeYearTotals: number[];
  stillGrowing: boolean;
  sourceName: string;
  sourceUrl: string;
  loaded: boolean;
  readerFacing: boolean;
  retireWhen: string;
}

export const FISCAL_PERIOD_DISTORTION_YEARS =
  distortionRegister.rows as FiscalPeriodDistortionYear[];
export const ABSENT_MONTH_YEARS = absentRegister.rows as AbsentMonthYear[];

/**
 * ⚠ THE ONE PUBLISHED THRESHOLD, read from the register rather than retyped.
 * Both registers are written by the same script at the same value, and
 * `--check` refuses when the script and a register disagree.
 */
export const PERIOD_DISTORTION_THRESHOLD = distortionRegister.thresholdShare as number;
export const PERIOD_MEASURED_ON = distortionRegister.measuredOn as string;
/** How many transaction budgets the rule was evaluated over — the denominator. */
export const PERIOD_FLEET_SIZE = distortionRegister.evaluated as number;

/** `18.6` — one decimal, because 19% and 18.6% read differently at a glance. */
export function distortionPct(row: FiscalPeriodDistortionYear): number {
  const share = row.axis === 'own' ? row.ownShare : row.displacedShare;
  return Math.round(1000 * share) / 10;
}

/**
 * `18.6` / `25.0` — the printed form, ALWAYS one decimal.
 *
 * ⚠ `distortionPct` returns a number, and 25.048% rounds to the number 25,
 * which prints as "25%" beside siblings printing "27.6%" and "18.6%". A bare
 * "25%" also reads as a round figure somebody chose rather than one that was
 * measured, which is the opposite of what this banner is for.
 */
export function distortionPctText(row: FiscalPeriodDistortionYear): string {
  return distortionPct(row).toFixed(1);
}

/**
 * ⚠⚠ THE LAST DAY THE PERIOD ACTUALLY INCLUDES.
 *
 * `periodEnd` is EXCLUSIVE — `transaction_period_distortion` builds it as
 * `period_start + 1 year`, so FY2024 ends at 2024-07-01 meaning "up to but not
 * including". Printing that raw told a reader the year "runs 1 October 2020 to
 * 1 October 2021" and that payments fell "between 1 July 2024 and 1 July
 * 2025", both of which claim a day the period does not contain. A reader
 * checking a payment dated on that boundary would be told the wrong thing by a
 * banner whose whole job is to be exact about dates.
 */
function lastDay(exclusiveEndIso: string): string {
  const d = new Date(`${exclusiveEndIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** `11 November 2026` — the form the still-growing copy rule asks for. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1]} ${y}`;
}

/** `FY2024 and FY2026`, `FY2019, FY2021 and FY2022` — never a bare array. */
function yearList(years: number[]): string {
  const fy = years.map((y) => `FY${y}`);
  if (fy.length === 0) return '';
  if (fy.length === 1) return fy[0];
  return `${fy.slice(0, -1).join(', ')} and ${fy[fy.length - 1]}`;
}

/**
 * ⚠ `or`, not `and`, because every use of this sits after a NEGATIVE: "none
 * dated in August 2021 and September 2021" reads as though a single payment
 * had to be in both. "none dated in August 2021 or September 2021" is what the
 * measurement actually says.
 */
function monthList(months: string[]): string {
  if (months.length === 1) return months[0];
  return `${months.slice(0, -1).join(', ')} or ${months[months.length - 1]}`;
}

/**
 * ⚠ The direction is MEASURED, not assumed. West Hollywood FY2019 runs past
 * its year (4,174 rows after, 48 before); FY2026 reaches both ways. Saying
 * "after the year ended" of a file that also reaches back years would be
 * false, and it is the kind of false that sounds authoritative.
 */
function directionPhrase(row: FiscalPeriodDistortionYear): string {
  if (row.rowsAfter > 0 && row.rowsBefore === 0) return 'after the year ended';
  if (row.rowsBefore > 0 && row.rowsAfter === 0) return 'before the year began';
  return 'outside the year it names';
}

/**
 * ⚠⚠ The sentence that makes the threshold a published rule rather than a
 * secret — "more than a tenth" is `PERIOD_DISTORTION_THRESHOLD` in words, so a
 * reader can apply their own and see how many years this one catches.
 */
function thresholdSentence(): string {
  return `This banner appears wherever more than a tenth of a year’s payments sit on the wrong `
    + `side of its own fiscal period, which is true of ${FISCAL_PERIOD_DISTORTION_YEARS.length} `
    + `of the ${PERIOD_FLEET_SIZE} transaction years in this series.`;
}

/** ⚠ Appended only where the publisher is still posting into the file. */
function growthSentence(): string {
  return `These figures are as of ${longDate(PERIOD_MEASURED_ON)} and the publisher is still `
    + `adding payments to this file, so they rise.`;
}

/** The flag one distorted year emits. Every figure comes from `row`. */
export function fiscalPeriodDistortionFlag(row: FiscalPeriodDistortionYear): FigureFlag {
  const pct = distortionPctText(row);
  const totalExact = formatMoneyExact(row.total);
  const growth = row.stillGrowing ? ` ${growthSentence()}` : '';

  if (row.axis === 'own') {
    const outProse = formatMoneyProse(row.outAmount);
    const outExact = formatMoneyExact(row.outAmount);
    return {
      id: row.id,
      severity: 'not-comparable',
      headline: `About ${outProse} of this total — ${pct}% — was paid ${directionPhrase(row)}`,
      summary:
        `${row.entity} publishes one register per fiscal year, and this one runs past the period `
        + `it names: of the ${totalExact} shown here, ${outExact} — ${pct}% — carries a payment `
        + `date outside ${longDate(row.periodStart)} to ${longDate(lastDay(row.periodEnd))}. The total is `
        + `shown exactly as published and every payment in it is the city’s own, so the figure is `
        + `right. It is simply not comparable with a year that holds only its own months.${growth}`,
      whatThisMeans:
        `Read this as “${row.sourceName}”, not as the money that moved during FY${row.fiscalYear}. `
        + `About ${outProse} of it was paid ${directionPhrase(row)}.`,
      entries: [
        {
          title: 'What the file covers',
          text:
            `The register holds ${row.outRows.toLocaleString()} payments dated outside `
            + `${row.periodStart} – ${lastDay(row.periodEnd)}: ${row.rowsBefore.toLocaleString()} before it `
            + `and ${row.rowsAfter.toLocaleString()} after, spanning ${row.earliestOut} to `
            + `${row.latestOut}, totalling ${outExact} of the ${totalExact} published. `
            + thresholdSentence(),
          source_name: row.sourceName,
          source_url: row.sourceUrl,
          source_date: PERIOD_MEASURED_ON,
        },
      ],
    };
  }

  const elseProse = formatMoneyProse(row.elsewhereAmount);
  const elseExact = formatMoneyExact(row.elsewhereAmount);
  return {
    id: row.id,
    severity: 'not-comparable',
    headline: `About ${elseProse} paid during this year — ${pct}% — is counted in another year`,
    summary:
      `${row.entity} publishes one register per fiscal year, and the neighbouring files run into `
      + `this one: ${elseExact} was paid between ${longDate(row.periodStart)} and `
      + `${longDate(lastDay(row.periodEnd))} but sits in the `
      + `${row.elsewhereYears.length === 1 ? 'register' : 'registers'} for `
      + `${yearList(row.elsewhereYears)}, so it appears `
      + `${row.elsewhereYears.length === 1 ? 'in that total' : 'in those totals'} rather than `
      + `here. This year’s own figure of ${totalExact} is `
      + `shown exactly as published and is almost entirely within its own dates, which is why the `
      + `comparison, and not the figure, is the thing that is not comparable.${growth}`,
    whatThisMeans:
      `This year looks smaller than it was: ${elseProse} of the money ${row.entity} paid during it `
      + `is counted in ${yearList(row.elsewhereYears)}. Compare the registers, not the calendar.`,
    entries: [
      {
        title: 'Where this year’s payments are counted',
        text:
          `${row.elsewhereRows.toLocaleString()} payments dated between ${row.periodStart} and `
          + `${lastDay(row.periodEnd)}, worth ${elseExact}, are held in ${row.entity}’s `
          + `${yearList(row.elsewhereYears)} `
          // ⚠ Four of the five flagged years spill into more than one
          // neighbour, so a fixed "register" was wrong more often than right.
          + `${row.elsewhereYears.length === 1 ? 'register' : 'registers'} rather than this one. `
          + `This register’s own total is ${totalExact}, shown exactly as published. `
          + thresholdSentence(),
        source_name: row.sourceName,
        source_url: row.sourceUrl,
        source_date: PERIOD_MEASURED_ON,
      },
    ],
  };
}

/** This file’s own total spread over the months it actually covers. */
export function perMonth(total: number, months: number): number {
  return Math.round((100 * total) / months) / 100;
}

/**
 * ⚠⚠⚠ THE NEAREST COMPLETE YEAR, NOT THE MOST RECENT — AND THE DIFFERENCE IS
 * THE WHOLE VALUE OF THE SENTENCE IT FEEDS.
 *
 * The first version of this copy took the most recent complete year, which is
 * right for McKinney by accident (FY2025 is both) and badly wrong for Frisco.
 * Frisco FY2021's nearest complete years are FY2020 and FY2022; its most
 * recent is FY2026, five years later, by which time Frisco's spending had gone
 * from $316M to $937M. The banner read "FY2021 ran at $31.7M a month against
 * FY2026's $78.1M" — true, and an invitation to conclude that the short year
 * was also a tiny one.
 *
 * Against FY2020 it reads $31.67M a month against $31.49M: the monthly rate
 * was NORMAL and only the period was short, which is exactly what the banner
 * exists to say.
 *
 * ⚠ Ties go to the EARLIER year — the prior year is the conventional
 * comparison, and choosing deterministically keeps the copy stable across
 * re-measures rather than flipping on array order.
 *
 * ⚠⚠ EXPORTED SO THE TEST USES THE SAME SELECTION. The guard that every stated
 * figure is a measured one has to know which year the prose picked; when it
 * had its own copy of that logic it went green on a sentence the rule no
 * longer wrote.
 */
export function nearestCompleteYear(
  row: AbsentMonthYear,
): { year: number; total: number } | null {
  return row.completeYears
    .map((y, i) => ({ year: y, total: row.completeYearTotals[i] }))
    .sort((a, b) => Math.abs(a.year - row.fiscalYear) - Math.abs(b.year - row.fiscalYear)
      || a.year - b.year)[0] ?? null;
}

/** The flag one incomplete year emits. Every figure comes from `row`. */
export function absentMonthFlag(row: AbsentMonthYear): FigureFlag {
  const totalExact = formatMoneyExact(row.total);
  const here = perMonth(row.total, row.monthsCovered);
  const short = row.monthsInPeriod - row.monthsCovered;
  const growth = row.stillGrowing
    ? ` These figures are as of ${longDate(PERIOD_MEASURED_ON)}; TT syncs this register on a `
      + `schedule, so the total can still rise.`
    : '';

  // ⚠⚠⚠ THE NEAREST COMPLETE YEAR, NOT THE MOST RECENT — AND THE DIFFERENCE
  // IS THE WHOLE VALUE OF THE SENTENCE.
  //
  // The first version took the most recent, which is right for McKinney by
  // accident (FY2025 is both) and badly wrong for Frisco. Frisco FY2021's
  // nearest complete years are FY2020 and FY2022; its most recent is FY2026,
  // five years later, by which time Frisco's spending had gone from $316M to
  // $937M. The banner said FY2021 ran at $31.7M a month against FY2026's
  // $78.1M — true, and it invites a reader to conclude the short year was also
  // a tiny one.
  //
  // Against FY2020 it says $31.67M a month against $31.49M: the monthly rate
  // was NORMAL and only the period was short, which is precisely what the
  // banner exists to tell them.
  //
  const nearest = nearestCompleteYear(row);
  const n = row.completeYears.length;
  const last = nearest ? nearest.year : null;
  const lastTotal = nearest ? nearest.total : null;
  const lastPerMonth = lastTotal === null ? null : perMonth(lastTotal, row.monthsInPeriod);

  const entries = [
    {
      title: 'What the file covers',
      text:
        `The ${row.fiscalYear} register holds ${row.rowCount.toLocaleString()} payments dated `
        + `${row.firstPayment} to ${row.lastPayment}, across ${row.monthsCovered} of the `
        + `${row.monthsInPeriod} months of ${row.periodStart} – ${lastDay(row.periodEnd)}. No payment in it `
        + `is dated in ${monthList(row.absentMonths)}, and no other ${row.entity} register in this `
        + `series holds one either. ${row.entity} has ${n} other registers here that each cover `
        + `all ${row.monthsInPeriod} months (${yearList(row.completeYears)}).`,
      source_name: row.sourceName,
      source_url: row.sourceUrl,
      source_date: PERIOD_MEASURED_ON,
    },
  ];

  if (last !== null && lastTotal !== null && lastPerMonth !== null) {
    entries.push({
      title: 'Why the total reads lower than the year actually ran',
      text:
        `This file’s ${totalExact} is shown exactly as published, spread over the `
        + `${row.monthsCovered} months it covers: ${formatMoneyExact(here)} a month. `
        + `${row.entity}’s nearest complete year, FY${last}, totals `
        + `${formatMoneyExact(lastTotal)} over ${row.monthsInPeriod} months, or `
        + `${formatMoneyExact(lastPerMonth)} a month. The comparison, not the figure, is what the `
        + `shorter period breaks.`,
      source_name: row.sourceName,
      source_url: row.sourceUrl,
      source_date: PERIOD_MEASURED_ON,
    });
  }

  return {
    id: row.id,
    /**
     * ⚠⚠ `not-comparable`, NOT the register's `incomplete-period`.
     *
     * The two vocabularies are deliberately different. `incomplete-period` is
     * a REGISTER severity — it is what makes `tests/figureFlags.test.ts`
     * demand a retirement condition. `FigureFlagSeverity` is the UI's union of
     * three, and this is the same choice the hand-written McKinney entry made,
     * for the same reason: the figure is CORRECT for what it covers, exactly
     * like Georgetown-Quitman FY2023's six-month transition year. Only the
     * comparison breaks.
     *
     * ⭐ `npm run build` caught this and `tsc --noEmit` did not — the third
     * time that has happened in this repo. Run the build, not just the check.
     */
    severity: 'not-comparable',
    headline:
      `This covers ${row.monthsCovered} of ${row.monthsInPeriod} months — nothing here is dated `
      + `in ${monthList(row.absentMonths)}`,
    summary:
      `${row.entity}’s fiscal year runs ${longDate(row.periodStart)} to `
      + `${longDate(lastDay(row.periodEnd))}. The register it publishes for ${row.fiscalYear} contains `
      + `payments from ${row.firstPayment} to ${row.lastPayment} and none dated in `
      + `${monthList(row.absentMonths)}, so this total covers ${row.monthsCovered} months. It is `
      + `shown exactly as published and every payment in it is held — `
      + `${row.rowCount.toLocaleString()} of them — but it is not a full year, which makes it not `
      + `comparable with the complete ones.${growth}`,
    whatThisMeans:
      `Expect about ${short === 1 ? 'a month' : `${short} months`} less than a full year here. To `
      + `compare it with another year, use what each file covers rather than the yearly totals.`,
    entries,
  };
}

/**
 * Every flag these two rules emit, keyed the way `figureFlagFor` looks them up.
 *
 * ⚠⚠ THE TWO RULES MUST NOT BOTH CLAIM A KEY — only one banner can render, so
 * a collision silently costs a reader whichever sentence lost. West Hollywood
 * FY2025 is the live near-miss: it has no July 2024 payment of its own and
 * would be an absent-month year, except that 1,497 payments worth
 * $21,028,719.61 from that month sit in the FY2022-24 register. The money is
 * displaced, not absent. `transaction_absent_months()` draws that distinction
 * and `generateFiscalPeriodFlags.mjs` refuses to write registers that collide.
 */
export function fiscalPeriodFlags(): Record<string, FigureFlag> {
  const out: Record<string, FigureFlag> = {};
  for (const row of FISCAL_PERIOD_DISTORTION_YEARS) {
    out[`${row.entity}|${row.state}|${row.fiscalYear}|${row.datasetType}`] =
      fiscalPeriodDistortionFlag(row);
  }
  for (const row of ABSENT_MONTH_YEARS) {
    out[`${row.entity}|${row.state}|${row.fiscalYear}|${row.datasetType}`] = absentMonthFlag(row);
  }
  return out;
}
