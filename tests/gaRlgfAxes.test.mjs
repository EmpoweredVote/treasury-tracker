/**
 * The Georgia DCA RLGF family must be claimed by the registries ACROSS BOTH
 * FORM GENERATIONS.
 *
 * ⚠⚠ WHY THIS FILE EXISTS. `basisRegistry` and `auditGradeRegistry` both
 * anchored `ga-dca-rlgf` at `FY20(1[6-9]|2[0-5])` — the V2 generation — while
 * PR #273 loaded the V1 generation, FY2009-FY2015, underneath them. 9,071 rows
 * therefore carried `basis = actual` written directly by the loader
 * (`BASIS_VALUE = 'actual'` in loadGeorgiaRLGF.mjs) with NO registry entry
 * standing behind the word, and `audit_grade = unknown` while their V2 siblings
 * read `self_reported_unaudited`.
 *
 * Both directions of that are wrong. `scripts/stampBudgetAxes.mjs --reset`
 * would have set those 9,071 to `unknown` with no sweep able to restore them;
 * and in the meantime the table asserted a basis nobody had evidenced.
 *
 * ⚠ The two generations are NOT the same document. V2 keys by UCOA code and has
 * a `LOAD1` sheet; V1 keys by the form's own line numbers and has none — a
 * different reader (`scripts/lib/gaRlgfV1.mjs`), not a wider loop. So widening
 * the year range needed the V1 form read, not a family resemblance. It was.
 *
 * ⚠ These tests drive the source string from `sourceNameFor()` itself rather
 * than pasting a literal — the lesson from tests/inGatewayAxes.test.mjs, where
 * a hard-coded string could not notice the string changing.
 */
import { describe, it, expect } from 'vitest';

import { sourceNameFor } from '../scripts/loadGeorgiaRLGF.mjs';
import { classify, SCOPE } from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import {
  classifyAxis, BASIS, BASIS_VALUES, AUDIT_GRADE,
  REPORTING_ENTITY, REPORTING_ENTITY_VALUES,
} from '../scripts/lib/budgetAxes.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { REPORTING_ENTITY_REGISTRY } from '../scripts/data/reportingEntityRegistry.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';

/** FY2009-FY2015 is V1, FY2016-FY2025 is V2. The whole loaded window. */
const V1_YEARS = [2009, 2010, 2011, 2012, 2013, 2014, 2015];
const V2_YEARS = [2016, 2019, 2022, 2025];
const DATASETS = ['operating', 'revenue'];
/** The three audit branches the form's own certification flag produces. */
const BRANCHES = [true, false, null];

const everyLabel = (years) => years.flatMap((fy) =>
  DATASETS.flatMap((d) => BRANCHES.map((a) => [sourceNameFor(d, fy, a), `FY${fy} ${d} ${a}`])));

const basisOf = (label) => classifyAxis(label, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN);

describe('basis — the RLGF reports a CLOSED year in both generations', () => {
  it('⭐ claims every V1 label, which no entry did until 2026-10-28', () => {
    for (const [label, what] of everyLabel(V1_YEARS)) {
      const { value, entryId } = basisOf(label);
      expect(entryId, `${what} unclaimed: ${label}`).toBe('ga-dca-rlgf');
      expect(value, what).toBe(BASIS.ACTUAL);
    }
  });

  it('still claims every V2 label, unchanged', () => {
    for (const [label, what] of everyLabel(V2_YEARS)) {
      expect(basisOf(label).entryId, what).toBe('ga-dca-rlgf');
      expect(basisOf(label).value, what).toBe(BASIS.ACTUAL);
    }
  });

  it('⚠ does NOT reach a year outside the loaded window', () => {
    // FY2008 precedes the published V1 archive; FY2026 is not filed yet. A
    // newly published year must land `unknown` until somebody reads it — the
    // same rule the audit-grade entries are pinned by.
    for (const fy of [2008, 2026]) {
      for (const d of DATASETS) {
        expect(basisOf(sourceNameFor(d, fy, false)).value, `FY${fy} ${d}`).toBe(BASIS.UNKNOWN);
      }
    }
  });
});

describe('audit_grade — DCA certifies nothing, in either generation', () => {
  it('⭐ grades every V1 label self_reported_unaudited', () => {
    for (const [label, what] of everyLabel(V1_YEARS)) {
      expect(gradeFor(label).entryId, `${what} unclaimed: ${label}`).toBe('ga-dca-rlgf');
      expect(gradeFor(label).value, what).toBe(AUDIT_GRADE.SELF_REPORTED_UNAUDITED);
    }
  });

  it('⚠⚠ the preparer-certified branch is NOT graded higher', () => {
    // The form carries an "audited" flag and the loader records which branch a
    // filing took IN THE SOURCE STRING, so it stays visible and re-gradable
    // without a reload. It is not assurance: DCA reconciles nothing, and the
    // V1 form says so on its own first page — "DCA cannot certify the accuracy
    // of the report figures submitted". All three branches grade the same.
    for (const fy of [2012, 2020]) {
      const grades = BRANCHES.map((a) => gradeFor(sourceNameFor('revenue', fy, a)).value);
      expect(new Set(grades).size, `FY${fy} branches: ${grades.join(', ')}`).toBe(1);
      expect(grades[0]).toBe(AUDIT_GRADE.SELF_REPORTED_UNAUDITED);
    }
  });

  it('still grades every V2 label, unchanged', () => {
    for (const [label, what] of everyLabel(V2_YEARS)) {
      expect(gradeFor(label).value, what).toBe(AUDIT_GRADE.SELF_REPORTED_UNAUDITED);
    }
  });
});

describe('reporting_entity — `unknown` here is EVIDENCED too', () => {
  it('⚠⚠ stays unknown in both generations, because the answer is PER FILING', () => {
    // Do NOT add a reportingEntityRegistry entry for this family. The form
    // ASKS — Part XII, "AUTHORITIES, BOARDS COMMISSIONS, AND SPECIAL
    // DISTRICTS": "Please list below the names of all authorities, boards,
    // commissions, and special districts WHOSE FINANCES ARE INCLUDED IN THIS
    // REPORT." Present in 20 of 20 V1 workbooks sampled 2026-10-28, and the
    // lists differ between filers. So the entity boundary is a property of each
    // filing, not of the source, and TT does not load Part XII. One value for
    // 21,682 rows would be a guess either way.
    //
    // ⚠ Same shape as the deliberate absence on `sc-rfa-lgf` in
    // reportingEntityRegistry.mjs, arrived at from the opposite direction:
    // there the publisher never says, here it asks and the answers vary.
    for (const [label, what] of everyLabel([2009, 2015, 2016, 2025])) {
      expect(classifyAxis(label, REPORTING_ENTITY_REGISTRY, REPORTING_ENTITY_VALUES,
        REPORTING_ENTITY.UNKNOWN).value, what).toBe(REPORTING_ENTITY.UNKNOWN);
    }
  });
});

describe('fund_scope — `unknown` here is EVIDENCED, not a gap', () => {
  it('⚠⚠ stays unknown in both generations, on purpose', () => {
    // Do NOT "fix" this by adding a fundScopeRegistry entry. Part V's own
    // header reads "Report Expenditures from ALL FUNDS EXCEPT: Principal and
    // Interest on Debt / Public Utility Systems ... / Inter-fund Transfers".
    // Excluding enterprise makes it narrower than all_funds; excluding DEBT
    // SERVICE makes it narrower than total_governmental, by roughly 5.5% at
    // Macon-Bibb FY2023. There is no honest value in the CHECK constraint set,
    // so `unknown` is the answer the evidence supports. See the header of
    // scripts/loadGeorgiaRLGF.mjs.
    for (const [label, what] of everyLabel([2009, 2015, 2016, 2025])) {
      expect(classify(label, FUND_SCOPE_REGISTRY).scope, what).toBe(SCOPE.UNKNOWN);
    }
  });
});
