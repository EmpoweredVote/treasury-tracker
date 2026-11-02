/**
 * The preflight: the same answer the RPC will give, before a loader spends
 * anything.
 *
 * ⚠⚠⚠ WHY IT EXISTS AT ALL. A refusal at write time arrives AFTER the loader
 * has done its expensive work. `loadUtahTransparency.js --rollup` bills a
 * BigQuery scan BEFORE it writes, so an armed gate over an unregistered Utah
 * gives scan → pay → refuse → write nothing, and an operator with nothing to
 * show for it re-runs. The 2026-06-19 incident was 622 jobs and ~21.2 TiB in
 * ten hours, ≈ $132, on an unfunded nonprofit.
 *
 * ⚠⚠ THE PREFLIGHT MUST AGREE WITH THE GATE. A preflight that says yes where
 * the RPC says no is worse than none — it teaches people the check is noise.
 * So it applies the SAME two rules: the three active axes must match, UNLESS
 * the family already exists in the database (grandfathered).
 */

import { describe, it, expect } from 'vitest';
import { familyRefusalReason } from '../scripts/lib/registeredFamilies.mjs';

const REGISTERED = 'Ohio Auditor of State Summarized Annual Financial Reports';
const UNKNOWN_FAMILY = 'Wisconsin DOR Municipal Report';

describe('familyRefusalReason', () => {
  it('passes a family registered on all three active axes', () => {
    expect(familyRefusalReason(REGISTERED, { exists: false })).toBeNull();
  });

  it('refuses a family no registry entry matches', () => {
    const r = familyRefusalReason(UNKNOWN_FAMILY, { exists: false });
    expect(r).toBeTruthy();
    expect(r).toContain(UNKNOWN_FAMILY);
  });

  it('names exactly which axes are unmatched', () => {
    const r = familyRefusalReason(UNKNOWN_FAMILY, { exists: false });
    expect(r).toContain('audit_grade');
    expect(r).toContain('fund_scope');
    expect(r).toContain('basis');
  });

  // ⚠⚠ GRANDFATHERING. The gate's goal is that a loader cannot write rows for
  // a family no registry matches; its non-goal is draining the backlog. A
  // bare three-axis rule would refuse 2,150 existing families on their next
  // write — including a run whose whole purpose is to FIX bad data. Measured:
  // only 1,966 of 5,929 families (33.2%) pass all three today.
  it('lets an already-present family through, so existing data stays fixable', () => {
    expect(familyRefusalReason(UNKNOWN_FAMILY, { exists: true })).toBeNull();
  });

  // ⭐ And the enumerated-year design still bites, because a new year is a new
  // data_source STRING and therefore a new family.
  it('still refuses a year outside a registry\'s enumerated window', () => {
    const read = 'Los Angeles ACFR — General Fund Revenue by Source (FY2023 actual, GAAP basis)';
    const unread = 'Los Angeles ACFR — General Fund Revenue by Source (FY2026 actual, GAAP basis)';
    expect(familyRefusalReason(read, { exists: false })).toBeNull();
    expect(familyRefusalReason(unread, { exists: false })).toBeTruthy();
  });

  it('hands back a paste-ready entry, not just a complaint', () => {
    const r = familyRefusalReason(UNKNOWN_FAMILY, { exists: false, fiscalYears: [2023, 2024] });
    expect(r).toContain('match:');
    expect(r).toContain('evidence:');
    expect(r).toMatch(/2023/);
  });

  it('refuses a blank or missing family name rather than passing it', () => {
    for (const bad of ['', '   ', null, undefined]) {
      expect(familyRefusalReason(bad, { exists: false }), String(bad)).toBeTruthy();
    }
  });

  // ⚠ accounting_basis is NOT required — it has 5 entries and is unknown on
  // 99.94% of rows. Requiring it would refuse every loader in the repo.
  it('does not require accounting_basis', () => {
    expect(familyRefusalReason('CA State Controller - Revenues', { exists: false })).toBeNull();
  });
});
