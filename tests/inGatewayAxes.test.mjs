/**
 * The Indiana Gateway AFR family must be claimed by ALL FOUR axis registries.
 *
 * ⚠⚠ WHY THIS FILE EXISTS. Before the statewide sweep, `auditGradeRegistry` was
 * the ONLY registry carrying an `in-gateway-afr` entry; fundScope, basis and
 * reporting_entity matched the source string with nothing at all, and every one
 * of the 106 loaded rows sat at `reporting_entity = 'unknown'`. That is the
 * FL / PA / SC / IN-county defect — "an entry did not claim what was measured" —
 * in a fifth place, and the sweep multiplies it from 106 rows to 16,876.
 *
 * The lesson the IN county wave wrote down verbatim: **widening one registry is
 * never enough — check all FOUR.**
 *
 * ⚠ These tests drive the source string from `sourceNameFor()` itself rather
 * than pasting a literal. A guard that hard-codes the string it checks cannot
 * notice the string changing, which is exactly how the audit grade silently fell
 * to `unknown` when the suffix gained "and payroll clearing" on 2026-09-08.
 */
import { describe, it, expect } from 'vitest';

import { sourceNameFor } from '../scripts/loadIndianaGateway.mjs';
import { classify, SCOPE } from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import {
  classifyAxis, BASIS, BASIS_VALUES, REPORTING_ENTITY, REPORTING_ENTITY_VALUES,
} from '../scripts/lib/budgetAxes.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { REPORTING_ENTITY_REGISTRY } from '../scripts/data/reportingEntityRegistry.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';

const scopeOf = (s) => classify(s, FUND_SCOPE_REGISTRY).scope;
const basisOf = (s) => classifyAxis(s, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).value;
const entityOf = (s) => classifyAxis(s, REPORTING_ENTITY_REGISTRY, REPORTING_ENTITY_VALUES,
  REPORTING_ENTITY.UNKNOWN).value;

/** The loaded window, held at FY2012-FY2024 (Chris's call, 2026-09-11). */
const LOADED_YEARS = Array.from({ length: 13 }, (_, i) => 2012 + i);
const DATASETS = ['operating', 'revenue'];

/** Every source string the sweep will actually write. */
const SWEEP_SOURCES = LOADED_YEARS.flatMap(
  (y) => DATASETS.map((d) => sourceNameFor(d, y)));

describe('the Indiana Gateway family is claimed by all four axis registries', () => {
  it('covers every source string the FY2012-FY2024 sweep writes', () => {
    // 13 years x 2 datasets. If this number moves, the window moved.
    expect(SWEEP_SOURCES).toHaveLength(26);
  });

  it('fund_scope is all_funds on every swept source', () => {
    for (const s of SWEEP_SOURCES) expect(scopeOf(s), s).toBe(SCOPE.ALL_FUNDS);
  });

  it('basis is actual on every swept source', () => {
    for (const s of SWEEP_SOURCES) expect(basisOf(s), s).toBe(BASIS.ACTUAL);
  });

  it('reporting_entity is primary_government on every swept source', () => {
    for (const s of SWEEP_SOURCES) expect(entityOf(s), s).toBe(REPORTING_ENTITY.PRIMARY);
  });

  it('audit_grade is self_reported_unaudited on every swept source', () => {
    // Already true before this change; asserted here so all four axes are pinned
    // in ONE place and a future widening cannot quietly cover three of four.
    for (const s of SWEEP_SOURCES) {
      expect(gradeFor(s).value, s).toBe(AUDIT_GRADE.SELF_REPORTED_UNAUDITED);
    }
  });
});

describe('the new entries are anchored and claim nothing else', () => {
  // ⚠ The trap this pins is the one the registries' own headers describe: a
  // pattern loose at either end claims a neighbouring family. Indiana has a
  // REAL neighbour to collide with — the county ACFR rows, same state, same
  // counties, DIFFERENT scope (total_governmental) and DIFFERENT grade
  // (audited_gaap). A `/^Indiana/` or unanchored `/Indiana Gateway/` would take
  // them and silently relabel 198 audited rows as unaudited all-funds.
  // ⚠ Read from the live table on 2026-09-11, not invented — an earlier draft of
  // this test guessed "Marion County ACFR — General Fund ..." and the real string
  // says "Total Governmental Funds". A guard built on a guessed string proves
  // nothing about the family it claims to protect.
  const COUNTY_ACFR = 'Allen County ACFR — Total Governmental Funds Revenue by Source '
    + '(FY2023 actual, GAAP basis)';

  it('does not claim the Indiana county ACFR family', () => {
    expect(scopeOf(COUNTY_ACFR)).toBe(SCOPE.TOTAL_GOVERNMENTAL);
    expect(entityOf(COUNTY_ACFR)).toBe(REPORTING_ENTITY.PRIMARY); // its own entry, not ours
    expect(gradeFor(COUNTY_ACFR).entryId).not.toBe('in-gateway-afr');
    expect(gradeFor(COUNTY_ACFR).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
  });

  it('does not claim a Gateway string outside the PATTERN window', () => {
    // ⚠ THE PATTERN WINDOW AND THE LOADED WINDOW ARE DIFFERENT THINGS, on
    // purpose. All four registries span FY2012-FY2025, because the evidence
    // behind each — Gateway's own explainer, and what the loader reads — is a
    // statement about the AFR programme, not about particular years. WHICH
    // years are loaded is the loader's decision (held at FY2012-FY2024 on
    // 2026-09-11) and it lives there, not here.
    //
    // FY2011 is outside because no Indiana unit can be loaded for it at all:
    // the Cash and Investments oracle carries no 2011 rows, so there is no
    // oracle and the loader refuses. FY2026 does not exist yet.
    for (const y of [2011, 2026]) {
      for (const d of DATASETS) {
        const s = sourceNameFor(d, y);
        expect(scopeOf(s), s).toBe(SCOPE.UNKNOWN);
        expect(basisOf(s), s).toBe(BASIS.UNKNOWN);
        expect(entityOf(s), s).toBe(REPORTING_ENTITY.UNKNOWN);
        expect(gradeFor(s).value, s).toBe(AUDIT_GRADE.UNKNOWN);
      }
    }
  });

  it('all four registries agree on the pattern window, so none can drift alone', () => {
    // ⚠⚠ THE DEFECT THIS PINS: for the whole life of this family, audit_grade
    // claimed FY2012-FY2025 and the other three claimed nothing. Four registries
    // that disagree about which rows they cover is how "widened three of four"
    // survives review. Asserted as a SET comparison so adding a year to one
    // registry and not the others fails here.
    const classified = (y) => [
      scopeOf(sourceNameFor('revenue', y)) !== SCOPE.UNKNOWN,
      basisOf(sourceNameFor('revenue', y)) !== BASIS.UNKNOWN,
      entityOf(sourceNameFor('revenue', y)) !== REPORTING_ENTITY.UNKNOWN,
      gradeFor(sourceNameFor('revenue', y)).value !== AUDIT_GRADE.UNKNOWN,
    ];
    for (let y = 2009; y <= 2030; y += 1) {
      const [a, b, c, d] = classified(y);
      expect(new Set([a, b, c, d]).size, `FY${y}: registries disagree — ${JSON.stringify(classified(y))}`)
        .toBe(1);
    }
  });

  it('does not claim a differently-scoped Gateway string', () => {
    // The suffix is the ONE reader-facing surface carrying the loaded scope.
    // If a future loader widens the scope, the string changes and these entries
    // must STOP matching rather than relabel the wider figure.
    const wider = 'Indiana Gateway Annual Financial Report — Revenue by Source '
      + '(FY2020 actual, unaudited, all funds)';
    expect(scopeOf(wider)).toBe(SCOPE.UNKNOWN);
    expect(basisOf(wider)).toBe(BASIS.UNKNOWN);
    expect(entityOf(wider)).toBe(REPORTING_ENTITY.UNKNOWN);
  });
});
