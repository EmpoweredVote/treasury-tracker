import { describe, it, expect } from 'vitest';

import {
  figureFlagsFor, assertFigureFlagStillHolds, IN_FIGURE_FLAGS,
} from '../scripts/data/inGatewayAnomalies.mjs';
import { auditFigureFlags } from '../scripts/loadIndianaGateway.mjs';

/**
 * ── ⚠⚠ WHY THIS FILE EXISTS: THE GEORGIA REGISTRY IS IMPORTED BY NOTHING ────
 *
 * `scripts/data/gaRlgfAnomalies.mjs` records the Milledgeville flag beautifully
 * and **no code reads it** — not the loader, not a test. Measured: `GA_FIGURE_FLAGS`
 * has zero importers. So it met the Milledgeville rule's stated MINIMUM ("a
 * registry in the repo") and nothing more: it cannot surface to a reader, and
 * nothing notices if the data it describes changes underneath it.
 *
 * That is the guard shape #143 was about. An anomaly flag makes a claim about a
 * government's published figures, so it must be:
 *   1. CORROBORATED by independent agents before it is recorded (Chris's
 *      standing requirement), and
 *   2. SELF-CHECKING afterwards — if the publisher amends the filing, the flag
 *      no longer describes reality and the loader must say so rather than keep
 *      asserting a stale claim about a real government.
 *
 * (2) is the Parke residue pattern: pin the exact figure, refuse on drift.
 */
const FIXTURE = Object.freeze([{
  id: 'fixture-county-fy2024-short-filing',
  entity: 'Fixture County',
  countyCode: '99',
  unitCode: '0000',
  fiscalYears: [2024, 2025],
  loaded: true,
  assertions: [
    { fiscalYear: 2024, dataset: 'revenue', measure: 'subsetTotal', expected: 607_214_107.07 },
    { fiscalYear: 2025, dataset: 'revenue', measure: 'subsetTotal', expected: 592_961_896.94 },
  ],
}]);

describe('Indiana figure flags — lookup', () => {
  it('finds a flag for a flagged government-year', () => {
    const hits = figureFlagsFor('99', '0000', 2024, { flags: FIXTURE });
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('fixture-county-fy2024-short-filing');
  });

  it('does not flag an unflagged year of a flagged government', () => {
    expect(figureFlagsFor('99', '0000', 2023, { flags: FIXTURE })).toEqual([]);
  });

  // ⚠ Keyed on (cnty_cd, unit_code) like everything else in this loader, NOT on
  // name — two governments sharing a name would inherit each other's flags.
  it('does not flag a different government in the same year', () => {
    expect(figureFlagsFor('49', '0000', 2024, { flags: FIXTURE })).toEqual([]);
  });
});

describe('Indiana figure flags — the flag is self-checking', () => {
  const filing = (total) => ({ revenue: { subsetTotal: total }, operating: { subsetTotal: 1 } });

  it('holds while the published figure still matches what was flagged', () => {
    const res = assertFigureFlagStillHolds(
      FIXTURE[0], 2024, filing(607_214_107.07), 'Fixture County FY2024');
    expect(res.ok).toBe(true);
  });

  // ⚠⚠ THE POINT. A flag is a claim about a government's numbers. If the
  // publisher amends the filing, the claim is stale and continuing to publish it
  // would be TT asserting something untrue about a real government.
  it('refuses when the publisher has amended the flagged figure', () => {
    expect(() => assertFigureFlagStillHolds(
      FIXTURE[0], 2024, filing(1_558_918_179.86), 'Fixture County FY2024'))
      .toThrow(/no longer describes/);
  });

  it('tolerates float noise but not a dollar', () => {
    expect(assertFigureFlagStillHolds(
      FIXTURE[0], 2024, filing(607_214_107.07 + 0.000001), 'x').ok).toBe(true);
    expect(() => assertFigureFlagStillHolds(
      FIXTURE[0], 2024, filing(607_214_107.07 + 2), 'x')).toThrow(/no longer describes/);
  });

  it('is a no-op for a year the flag makes no assertion about', () => {
    expect(assertFigureFlagStillHolds(FIXTURE[0], 2023, filing(1), 'x').ok).toBe(true);
    expect(assertFigureFlagStillHolds(FIXTURE[0], 2023, filing(1), 'x').checked).toBe(0);
  });
});

/**
 * ── EVERY RECORDED FLAG MUST CARRY ITS EVIDENCE ─────────────────────────────
 *
 * Driven from the registry itself, so a flag added later is covered without
 * anyone remembering to register it here — #143's lesson that a guard requiring
 * each new member to opt in cannot catch the member that forgets.
 */
describe('Indiana figure flags — the recorded registry', () => {
  // ⚠⚠ This used to assert `loaded === true` for every flag. That became a LIE
  // when Chris narrowed the Indiana scope on 2026-09-08 and Marion FY2019's
  // payroll clearing fund left the loaded set. Forcing the old invariant would
  // have meant recording something untrue to keep a test green, so the model now
  // names the two dispositions apart — and an excluded one must cite the rule
  // that excluded it, so a scope choice can never be dressed up as suppression.
  it('declares a disposition for every flag, and cites the rule when excluded', () => {
    for (const f of IN_FIGURE_FLAGS) {
      expect(['loaded-as-published', 'excluded-by-scope'], f.id).toContain(f.disposition);
      expect(f.loaded, f.id).toBe(f.disposition === 'loaded-as-published');
      if (f.disposition === 'excluded-by-scope') {
        // must name a documented rule, not a per-figure judgement
        expect(f.scopeDecision, f.id).toBeTruthy();
        expect(f.scopeDecision, f.id).toMatch(/inGateway\.mjs/);
      }
    }
  });

  // ⚠ And nothing may be withheld merely for looking implausible: an excluded
  // flag has to point at a rule that applies to every government equally.
  it('never withholds a figure on plausibility grounds alone', () => {
    for (const f of IN_FIGURE_FLAGS.filter((x) => x.disposition === 'excluded-by-scope')) {
      expect(f.scopeDecision, f.id).toMatch(/scope|excluded/i);
    }
  });

  it('carries evidence, benign explanations and corroboration on every flag', () => {
    for (const f of IN_FIGURE_FLAGS) {
      expect(f.what, f.id).toBeTruthy();
      expect(f.magnitude.length, f.id).toBeGreaterThan(0);
      expect(f.verifiedBecause.length, f.id).toBeGreaterThan(0);
      // ⚠ Chris's standing rule: ask for benign explanations, imply no wrongdoing.
      expect(f.benignExplanations.length, f.id).toBeGreaterThan(0);
      expect(f.corroboration, f.id).toMatch(/independent/i);
    }
  });

  it('gives every flag at least one self-checking assertion', () => {
    for (const f of IN_FIGURE_FLAGS) {
      expect(f.assertions.length, f.id).toBeGreaterThan(0);
      for (const a of f.assertions) {
        expect(Number.isFinite(a.expected), `${f.id} ${a.fiscalYear}`).toBe(true);
      }
    }
  });
});

/**
 * ── THE LOADER MUST ACTUALLY READ THE REGISTRY ──────────────────────────────
 *
 * The whole defect in the Georgia precedent is that nothing imports it. This
 * pins the loader-side consumption: every flagged government-year that is about
 * to be written is re-checked and announced.
 */
describe('Indiana loader figure-flag audit', () => {
  const FLAG = {
    id: 'fixture-short-filing',
    entity: 'Fixture County',
    countyCode: '99',
    unitCode: '0000',
    fiscalYears: [2024],
    loaded: true,
    what: 'Fixture County FY2024 reports far less than FY2023.',
    assertions: [
      { fiscalYear: 2024, dataset: 'revenue', measure: 'subsetTotal', expected: 569_988_242.80 },
    ],
  };
  const filing = (year, total) => ({
    entity: { name: 'Fixture County', countyCode: '99', unitCode: '0000' },
    year: String(year),
    revenue: { subsetTotal: total },
    operating: { subsetTotal: 1 },
  });

  it('announces a flagged government-year that is being loaded', () => {
    const lines = [];
    const summary = auditFigureFlags([filing(2024, 569_988_242.80)],
      { flags: [FLAG], log: (m) => lines.push(m) });
    expect(summary.flagged).toBe(1);
    expect(lines.join('\n')).toMatch(/fixture-short-filing/);
    // ⚠ It must say the figure is LOADED, not withheld — the Milledgeville rule.
    expect(lines.join('\n')).toMatch(/LOADED AS PUBLISHED/);
  });

  it('says nothing for unflagged government-years', () => {
    const lines = [];
    const summary = auditFigureFlags([filing(2023, 1_448_064_843.05)],
      { flags: [FLAG], log: (m) => lines.push(m) });
    expect(summary.flagged).toBe(0);
    expect(lines).toEqual([]);
  });

  // ⚠⚠ The self-check must fire through the loader, not just in isolation.
  it('refuses the load when a flag no longer describes the filing', () => {
    expect(() => auditFigureFlags([filing(2024, 1_448_064_843.05)],
      { flags: [FLAG], log: () => {} })).toThrow(/no longer describes/);
  });
});
