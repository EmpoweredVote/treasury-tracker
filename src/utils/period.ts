/**
 * Federal period model (Phase 50).
 *
 * A selectable "period" is either an annual fiscal year (token = '2024') or the
 * FY1976 Transition Quarter (token = TQ_TOKEN). The Transition Quarter shares
 * fiscal_year 1976 with the real FY1976 in the database, distinguished by
 * budgets.period_label — so the frontend needs a token that is distinct from
 * '1976' while still resolving to fiscal year 1976 for data fetches.
 *
 * parsePeriod centralizes turning a selector token into { fiscalYear, periodLabel,
 * labels }. Every `parseInt(selectedYear)` in the app must go through this so a
 * non-numeric TQ token never leaks into a year calculation.
 */

export const TQ_TOKEN = '1976-TQ';
export const TQ_LABEL = 'Transition Quarter (Jul–Sep 1976)';
export const TQ_SHORT = 'Transition Q 1976';

export interface ParsedPeriod {
  fiscalYear: number;
  periodLabel: string | null;
  label: string; // full label (option list)
  shortLabel: string; // compact label (selector button)
}

export function parsePeriod(token: string): ParsedPeriod {
  if (token === TQ_TOKEN) {
    return { fiscalYear: 1976, periodLabel: TQ_LABEL, label: TQ_LABEL, shortLabel: TQ_SHORT };
  }
  return { fiscalYear: parseInt(token, 10), periodLabel: null, label: `FY ${token}`, shortLabel: `FY ${token}` };
}

/**
 * Build the ordered selector token list from an entity's available_datasets.
 * Annual years descend; the Transition Quarter (a period_label row) is inserted
 * immediately after FY1976. Entities without any period_label row (every city /
 * state / county) get a plain descending year list — unchanged behavior.
 */
export function buildPeriodTokens(
  datasets: Array<{ fiscal_year: number; period_label?: string | null }>,
): string[] {
  const years = [...new Set(datasets.filter((d) => !d.period_label).map((d) => d.fiscal_year))]
    .sort((a, b) => b - a)
    .map(String);
  const hasTQ = datasets.some((d) => d.period_label === TQ_LABEL);
  if (!hasTQ) return years;
  const out: string[] = [];
  for (const y of years) {
    out.push(y);
    if (y === '1976') out.push(TQ_TOKEN);
  }
  if (!years.includes('1976')) out.push(TQ_TOKEN);
  return out;
}
