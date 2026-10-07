import { describe, it, expect } from 'vitest';
import { isComparablePair } from '../scripts/lib/fundScope.mjs';

const row = (scope, accountingBasis) => ({ scope, accountingBasis });

describe('isComparablePair', () => {
  it('REFUSES a proven mismatch — GAAP against cash', () => {
    // Duvall vs Redmond: two King County cities, two measurements. This is the
    // whole reason the axis exists.
    expect(isComparablePair(row('general_fund', 'gaap'), row('general_fund', 'cash'))).toBe(false);
  });

  it('REFUSES modified cash against GAAP — Brown County SD vs Aberdeen SD', () => {
    // Twelve miles apart, audited in the same town, measured differently.
    expect(isComparablePair(row('general_fund', 'modified_cash'), row('general_fund', 'gaap'))).toBe(false);
  });

  it('REFUSES cash against modified cash — they are different bases', () => {
    // Not "both non-GAAP, therefore comparable". Cash and modified cash are
    // two different measurements and merging them would be the same error one
    // level down.
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'modified_cash'))).toBe(false);
  });

  it('ALLOWS two figures on the same known basis', () => {
    expect(isComparablePair(row('general_fund', 'gaap'), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'cash'))).toBe(true);
  });

  // ⚠⚠ THE LOAD-BEARING CASE. The column starts 100% `unknown` and will stay
  // mostly unknown for a long time — `audit_grade` is 68% unknown today. A rule
  // phrased "comparable only if both are known and equal" is defensible in the
  // abstract and catastrophic in practice: it would switch off cross-entity
  // comparison across nearly the whole site on the day it shipped.
  it('ALLOWS when either side is unknown — absence never blocks', () => {
    expect(isComparablePair(row('general_fund', 'unknown'), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'unknown'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'unknown'), row('general_fund', 'unknown'))).toBe(true);
  });

  it('ALLOWS when the basis is missing entirely — a caller that knows nothing', () => {
    expect(isComparablePair(row('general_fund', null), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', undefined), row('general_fund', 'cash'))).toBe(true);
    expect(isComparablePair(row('general_fund', ''), row('general_fund', 'cash'))).toBe(true);
  });

  it('still refuses on a non-comparable SCOPE, independently of basis', () => {
    // The two axes compose; neither excuses the other.
    expect(isComparablePair(row('unknown', 'gaap'), row('unknown', 'gaap'))).toBe(false);
    expect(isComparablePair(row('unknown', 'gaap'), row('general_fund', 'gaap'))).toBe(false);
  });

  it('refuses a malformed argument rather than treating it as comparable', () => {
    expect(isComparablePair(null, row('general_fund', 'gaap'))).toBe(false);
    expect(isComparablePair(undefined, undefined)).toBe(false);
  });
});

// ── The registry ────────────────────────────────────────────────────────────
import { ACCOUNTING_BASIS_REGISTRY } from '../scripts/data/accountingBasisRegistry.mjs';
import {
  classifyAxis, validateAxisRegistry, ACCOUNTING_BASIS, ACCOUNTING_BASIS_VALUES,
} from '../scripts/lib/budgetAxes.mjs';

const cls = (src) =>
  classifyAxis(src, ACCOUNTING_BASIS_REGISTRY, ACCOUNTING_BASIS_VALUES, ACCOUNTING_BASIS.UNKNOWN);

// Exact strings, resolved by querying the live table — never transcribed from
// a plan, because transcribing a source string is how the wrong one gets
// matched.
const REDMOND = 'WA State Auditor — Redmond Annual Financial Report FY2024 (General Fund, Revenue by Source)';
const DUVALL = 'WA State Auditor — Duvall Annual Financial Report FY2024 (General Fund, Revenue by Source)';
const BROWN = 'Brown County ACFR — General Fund Revenue by Source (FY2023 actual, modified cash basis)';
const ABERDEEN = 'City of Aberdeen ACFR — General Fund Revenue by Source (FY2023 actual, GAAP basis)';

describe('ACCOUNTING_BASIS_REGISTRY', () => {
  it('is valid — every entry evidenced, every value legal', () => {
    expect(ACCOUNTING_BASIS_REGISTRY, 'registry must be exported').toBeDefined();
    const r = validateAxisRegistry(ACCOUNTING_BASIS_REGISTRY, ACCOUNTING_BASIS_VALUES, ACCOUNTING_BASIS.UNKNOWN);
    expect(r.ok, JSON.stringify(r, null, 2)).toBe(true);
  });

  it('stamps Redmond gaap', () => {
    expect(cls(REDMOND).value).toBe('gaap');
  });

  it('stamps Duvall cash', () => {
    expect(cls(DUVALL).value).toBe('cash');
  });

  // ⚠⚠ THE TRAP. Redmond and Duvall are BOTH `WA State Auditor — ...` and both
  // King County. A pattern anchored only on the publisher stamps Duvall GAAP —
  // a false public claim about a document whose auditor issued an ADVERSE
  // opinion on U.S. GAAP.
  it('never lets the WA publisher prefix stamp Duvall as gaap', () => {
    expect(cls(DUVALL).value).not.toBe('gaap');
    for (const fy of [2016, 2018, 2020, 2024]) {
      for (const kind of ['Revenue by Source', 'Expenditure by Function']) {
        const src = `WA State Auditor — Duvall Annual Financial Report FY${fy} (General Fund, ${kind})`;
        expect(cls(src).value, src).toBe('cash');
      }
    }
  });

  it('the gaap entry does not match Duvall even in isolation', () => {
    // Order-independence. classifyAxis returns the FIRST match, so a correct
    // result could still come from luck in array order. This asserts the gaap
    // pattern itself cannot reach Duvall.
    const gaapEntries = ACCOUNTING_BASIS_REGISTRY.filter((e) => e.value === 'gaap');
    expect(gaapEntries.length).toBeGreaterThan(0);
    for (const e of gaapEntries) {
      expect(e.match.test(DUVALL), `${e.id} must not match Duvall`).toBe(false);
    }
  });

  it('stamps Brown County SD modified_cash and Aberdeen SD gaap — twelve miles apart', () => {
    expect(cls(BROWN).value).toBe('modified_cash');
    expect(cls(ABERDEEN).value).toBe('gaap');
  });

  it('leaves an unmatched source unknown rather than guessing', () => {
    expect(cls('Ohio AOS — something entirely else').value).toBe('unknown');
    expect(cls('Michigan Treasury Form F-65 Annual Local Unit Fiscal Report — Revenue by Source (FY2024 actual, general fund, excl. financing sources and uses)').value).toBe('unknown');
    expect(cls(null).value).toBe('unknown');
    expect(cls('').value).toBe('unknown');
  });
});
