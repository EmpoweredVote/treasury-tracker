import { describe, it, expect } from 'vitest';
import { UNCITED_BASELINE } from '../scripts/data/sourceUrlCoverage.mjs';
import { familyOf } from '../scripts/lib/sourceUrlProbe.mjs';

/**
 * ⚠⚠⚠ THIS FILE PINS A RATCHET, AND A RATCHET IS ONLY WORTH ITS LOWEST NUMBER.
 *
 * `judgeUncited` fails the gate when a family GROWS and shrugs when one
 * shrinks. That asymmetry is right — it is what stops the gate being red by
 * design — but it means the file this reads has exactly one failure mode that
 * nothing else can see: **a number raised quietly is a load that shipped
 * uncited rows, forgiven in advance.** The gate cannot catch that, because the
 * gate asks this file what to expect.
 *
 * So the total is pinned here. A legitimate pay-down edits one number in this
 * test alongside the number in the baseline, and the reviewer sees both.
 *
 * ⭐ MEASURED 2026-11-13 against the live fleet: `verify:source-urls --census`.
 */
describe('the uncited baseline as shipped', () => {
  const total = Object.values(UNCITED_BASELINE.families).reduce((a, b) => a + b, 0);

  it('carries 299 uncited budgets across 51 families', () => {
    expect(total).toBe(299);
    expect(Object.keys(UNCITED_BASELINE.families)).toHaveLength(51);
  });

  it('⛔ does not carry the four families 20261113140000 cited', () => {
    // 24,497 of 24,508 budgets across these four were cited on 2026-11-13.
    // Two of the four left nothing behind at all; the other two keep only the
    // rows whose figure the publisher does not print, which is why this
    // asserts a CEILING rather than absence for them. Re-loading any of
    // these linkless would otherwise land as a pay-down notice, not a failure.
    expect(UNCITED_BASELINE.families['Government Compensation in California (publicpay.ca.gov)'])
      .toBeUndefined();
    expect(UNCITED_BASELINE.families['MA General Fund Revenues']).toBeUndefined();
    expect(UNCITED_BASELINE.families['MA General Fund Expenditures']).toBe(1);
    // ⭐⭐ 10 → 6 → GONE, over two migrations on 2026-11-14. None of the ten
    // was "a figure the publisher stopped printing": all were stale
    // Revenue-by-Source rows (Total Receipts, enterprise funds included)
    // sitting in a General Fund family.
    //   · 20261114090000 — four had since filed Schedule A and took the
    //     publisher's own General Fund figure and tree.
    //   · 20261114100000 — the other six have NOT filed, so instead of
    //     inventing a General Fund figure they were told the truth: scope
    //     all_funds, relabelled to "MA DLS Revenue by Source (Total
    //     Receipts)", and cited to the report they actually came from after a
    //     6/6 component-level tie. A cited row is not citation debt, so the
    //     family leaves this file entirely.
    expect(UNCITED_BASELINE.families['MA DLS General Fund Revenue by Source']).toBeUndefined();
    expect(UNCITED_BASELINE.families['MA DLS Revenue by Source (Total Receipts)']).toBeUndefined();
  });

  it('⛔ does not carry the seven families #389 cited', () => {
    // These 71 budgets were given a live link by
    // scripts/citeNonStatementSources.mjs on 2026-11-12. Re-adding one would
    // not fail the gate — an observed 0 against a baseline of 10 is a NOTICE —
    // so a re-load that shipped these registers linkless again would pass
    // silently. That is the whole reason to name them.
    for (const family of [
      'Bloomington Annual Compensation',
      'Frisco Check Register',
      'LA City Checkbook',
      'LA City Payroll',
      'McKinney Check Register',
      'McKinney Payroll Register',
      'Plano Check Register',
    ]) {
      expect(UNCITED_BASELINE.families[family], `${family} is cited — it may not carry debt`).toBeUndefined();
    }
  });

  it('⛔ carries no entry of zero — a zero is a pay-down nobody recorded', () => {
    // A family at 0 reads as debt that does not exist, and it is the shape a
    // paid-down family takes when the baseline edit was forgotten.
    for (const [family, count] of Object.entries(UNCITED_BASELINE.families)) {
      expect(Number.isInteger(count), `${family} count ${count}`).toBe(true);
      expect(count, `${family} carries no uncited budgets`).toBeGreaterThan(0);
    }
  });

  it('⚠ keys every entry by a FAMILY, never by a raw data_source', () => {
    // `familyOf` strips the town prefix and the fiscal year, so a key pasted
    // straight out of the database — "Plano Check Register FY2026" — can never
    // match anything the census produces. It would sit here forever as debt
    // that cannot be paid, while the real family came back as `appeared`.
    for (const family of Object.keys(UNCITED_BASELINE.families)) {
      expect(familyOf(family), `${family} is not in its own family`).toBe(family);
    }
  });
});
