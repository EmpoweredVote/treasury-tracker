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
