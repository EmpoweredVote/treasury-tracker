/**
 * SCOPE-04 Task 1 — the pure derivation and its vocabulary guard.
 *
 * Spec: docs/superpowers/specs/2026-08-21-scope-04-design.md §2
 */

import { describe, it, expect } from 'vitest';
import {
  isEnterpriseRoot, deriveTotalGovernmental, KNOWN_ROOTS,
} from '../scripts/lib/derivedTotalGovernmental.mjs';

describe('isEnterpriseRoot', () => {
  it('matches every enterprise and ISF root, including the two typos', () => {
    // ⚠ Both typos are real and live: 84 rows carry the duplicated word, 78 the
    // double space. An exact-string list would miss them.
    for (const n of [
      'Internal Service Fund', 'Water Enterprise Fund', 'Sewer Enterprise Fund',
      'Hospital Enterprise Fund Fund', 'Gas  Enterprise Fund',
    ]) expect(isEnterpriseRoot(n)).toBe(true);
  });

  it('does NOT match Public Utilities, which PR #36 ruled governmental', () => {
    expect(isEnterpriseRoot('Public Utilities')).toBe(false);
    expect(isEnterpriseRoot('Public Utilities and Other Expenditures')).toBe(false);
  });
});

describe('deriveTotalGovernmental', () => {
  it('sums the governmental roots and reports the enterprise side', () => {
    // MODESTO FY2024, the milestone in one fixture. Ties to the dollar:
    // 588,042,068 total - 296,400,946 enterprise = 291,641,122 governmental.
    const roots = [
      { name: 'General Government and Public Safety', amount: 164848113 },
      { name: 'Transportation and Community Development', amount: 84207335 },
      { name: 'Health and Culture and Leisure', amount: 24224828 },
      { name: 'Debt Service and Capital Outlay', amount: 17999197 },
      { name: 'Public Utilities and Other Expenditures', amount: 361649 },
      { name: 'Internal Service Fund', amount: 122113248 },
      { name: 'Water Enterprise Fund', amount: 88972551 },
      { name: 'Sewer Enterprise Fund', amount: 53616219 },
      { name: 'Other Enterprise Fund', amount: 15451900 },
      { name: 'Solid Waste Enterprise Fund', amount: 14505806 },
      { name: 'Airport Enterprise Fund', amount: 1741222 },
    ];
    const out = deriveTotalGovernmental(roots);
    expect(out.totalGovernmental).toBe(291641122);
    expect(out.enterprise).toBe(296400946);
    expect(out.unrecognised).toEqual([]);
  });

  it('REFUSES an unrecognised root instead of counting it as governmental', () => {
    // ⚠ THE HAZARD. Classification is a negative match, so a future
    // enterprise-like root under a new name would be silently counted as
    // governmental and inflate TG with no arithmetic gate able to see it --
    // exactly the era-A failure shape. It must surface, not pass.
    const out = deriveTotalGovernmental([
      { name: 'General Government and Public Safety', amount: 100 },
      { name: 'Wastewater Utility Fund', amount: 900 },
    ]);
    expect(out.unrecognised).toEqual(['Wastewater Utility Fund']);
  });
});

describe('KNOWN_ROOTS', () => {
  it('carries the generated era-B vocabulary', () => {
    expect(KNOWN_ROOTS.size).toBe(51);
    expect(KNOWN_ROOTS.has('Public Utilities')).toBe(true);
  });
});
