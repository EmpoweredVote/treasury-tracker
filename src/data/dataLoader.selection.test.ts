import { describe, it, expect } from 'vitest';
import { pickBudgetForSeries } from './dataLoader';

const row = (fund_scope: string, basis: string, total_budget: number, period_label: string | null = null) =>
  ({ id: `${fund_scope}-${basis}`, dataset_type: 'operating', period_label, fund_scope, basis, total_budget });

describe('pickBudgetForSeries', () => {
  const actuals = row('all_funds', 'actual', 2_400_000_000);
  const adopted = row('general_fund', 'adopted', 600_000_000);

  it('picks the row matching the chosen series, not the first one returned', () => {
    const picked = pickBudgetForSeries([adopted, actuals], 'operating', null,
      { fundScope: 'all_funds', basis: 'actual' });
    expect(picked?.total_budget).toBe(2_400_000_000);
  });

  it('is order-independent — the bug was that it was not', () => {
    const a = pickBudgetForSeries([adopted, actuals], 'operating', null, { fundScope: 'all_funds', basis: 'actual' });
    const b = pickBudgetForSeries([actuals, adopted], 'operating', null, { fundScope: 'all_funds', basis: 'actual' });
    expect(a?.id).toBe(b?.id);
  });

  it('respects period_label so the FY1976 Transition Quarter still resolves', () => {
    const annual = row('unknown', 'unknown', 418_517_827_000, null);
    const tq = row('unknown', 'unknown', 106_769_689_000, 'Transition Quarter (Jul–Sep 1976)');
    const picked = pickBudgetForSeries([annual, tq], 'operating', 'Transition Quarter (Jul–Sep 1976)',
      { fundScope: 'unknown', basis: 'unknown' });
    expect(picked?.total_budget).toBe(106_769_689_000);
  });

  it('returns undefined when the chosen series has no row for this year — a GAP, not a substitute', () => {
    expect(pickBudgetForSeries([adopted], 'operating', null, { fundScope: 'all_funds', basis: 'actual' }))
      .toBeUndefined();
  });

  it('falls back to a dataset_type match when no series is given (pre-deploy API)', () => {
    expect(pickBudgetForSeries([adopted], 'operating', null, null)?.id).toBe(adopted.id);
  });
});
