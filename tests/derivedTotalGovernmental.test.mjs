/**
 * SCOPE-04 Task 1 — the pure derivation and its vocabulary guard.
 *
 * Spec: docs/superpowers/specs/2026-08-21-scope-04-design.md §2
 */

import { describe, it, expect } from 'vitest';
import {
  isEnterpriseRoot, deriveTotalGovernmental, KNOWN_ROOTS, isInDerivationScope,
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

/**
 * ⚠⚠ WHY SCOPE IS A DECLARED TEST AND NOT AN ACCIDENT OF THE DATA.
 *
 * This derivation only ever covered the CA State Controller family, but it had
 * no scope test at all. Out-of-scope rows fell out of triage by LUCK: measured
 * 2026-10-31, all 50,304 non-SCO era-B all_funds rows happen to carry no
 * enterprise-named root, so they landed in `skip-no-enterprise` — which is why
 * that counter read 51,257 against an `expect 852` that had only ever described
 * the 953 SCO rows.
 *
 * It is luck, not safety. One loader naming a root "Enterprise Fund" sends a
 * non-SCO row past that filter and into the vocabulary guard, which HALTs the
 * WHOLE RUN and blocks the CA derivation it was never about.
 */
describe('isInDerivationScope', () => {
  it('accepts all four CA State Controller parent families', () => {
    for (const s of [
      'CA State Controller - Expenditures',
      'CA State Controller - Revenues',
      'CA State Controller - County Expenditures',
      'CA State Controller - County Revenues',
    ]) expect(isInDerivationScope(s)).toBe(true);
  });

  it('accepts an UNREGISTERED CA State Controller family, so it can still HALT', () => {
    // ⚠ The point of a prefix rather than the four exact labels: a new SCO
    // family must reach the "no derived label" HALT and be registered, not be
    // silently dropped as out of scope. A new family loading unregistered has
    // happened twice and no gate saw it.
    expect(isInDerivationScope('CA State Controller - Special District Expenditures')).toBe(true);
  });

  it('rejects the other states this derivation never covered', () => {
    for (const s of [
      'NY OSC Local Government Data', 'MI Treasury F-65', 'PA DCED Municipal Statistics',
      'Ohio AOS Financial Data', 'publicpay.ca.gov',
    ]) expect(isInDerivationScope(s)).toBe(false);
  });

  it('rejects this derivation\'s OWN output, so a re-run cannot eat it', () => {
    expect(isInDerivationScope(
      'Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures)',
    )).toBe(false);
  });

  it('rejects a null or empty data_source instead of throwing', () => {
    expect(isInDerivationScope(null)).toBe(false);
    expect(isInDerivationScope(undefined)).toBe(false);
    expect(isInDerivationScope('')).toBe(false);
  });

  it('is anchored at the start — a label merely MENTIONING the SCO is not in scope', () => {
    expect(isInDerivationScope('Audited ACFR reconciled to CA State Controller')).toBe(false);
  });
});
