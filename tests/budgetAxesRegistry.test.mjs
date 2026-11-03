import { describe, it, expect } from 'vitest';
import { BASIS, BASIS_VALUES, REPORTING_ENTITY, REPORTING_ENTITY_VALUES, validateAxisRegistry, classifyAxis }
  from '../scripts/lib/budgetAxes.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { REPORTING_ENTITY_REGISTRY } from '../scripts/data/reportingEntityRegistry.mjs';

const basisOf = (s) => classifyAxis(s, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).value;
const entityOf = (s) => classifyAxis(s, REPORTING_ENTITY_REGISTRY, REPORTING_ENTITY_VALUES, REPORTING_ENTITY.UNKNOWN).value;

describe('registries are well-formed', () => {
  it('basis registry validates', () => {
    expect(validateAxisRegistry(BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).ok).toBe(true);
  });
  it('reporting-entity registry validates', () => {
    expect(validateAxisRegistry(REPORTING_ENTITY_REGISTRY, REPORTING_ENTITY_VALUES, REPORTING_ENTITY.UNKNOWN).ok).toBe(true);
  });
});

describe('basis classification', () => {
  it('SCO is actual, all four strings', () => {
    expect(basisOf('CA State Controller - Expenditures')).toBe('actual');
    expect(basisOf('CA State Controller - Revenues')).toBe('actual');
    expect(basisOf('CA State Controller - County Expenditures')).toBe('actual');
    expect(basisOf('CA State Controller - County Revenues')).toBe('actual');
  });
  it('does NOT claim publicpay, which is a different SCO programme', () => {
    expect(basisOf('CA State Controller — Government Compensation in California (publicpay.ca.gov)'))
      .toBe('unknown');
  });
  it('city budget documents are adopted', () => {
    expect(basisOf('Long Beach General Fund Operating Budget FY2025')).toBe('adopted');
    expect(basisOf('Oakland General Purpose Fund Operating Budget FY2024')).toBe('adopted');
    expect(basisOf('Bakersfield Operating Budget FY2025')).toBe('adopted');
    expect(basisOf('Santa Ana General Fund Revenue Budget FY2023')).toBe('adopted');
  });
  it('audited year-end sources are actual', () => {
    expect(basisOf('WA State Auditor — Spokane Annual Financial Report FY2024 (General Fund, Expenditure by Function)')).toBe('actual');
    expect(basisOf('Utah State ACFR — General Fund (FY2024 actual, GAAP basis)')).toBe('actual');
    expect(basisOf('Ohio Auditor of State Summarized Annual Financial Reports')).toBe('actual');
    expect(basisOf('Minnesota Office of the State Auditor')).toBe('actual');
  });
  it('MA stays unknown -- not probed', () => {
    expect(basisOf('Newton — MA DLS General Fund Revenue by Source')).toBe('unknown');
  });
  it('city-adopted-budget-doc\'s unguarded "Budget FY####" tail alternative matches with no keyword present -- pinning intended, not accidental, behaviour', () => {
    expect(basisOf('Some City Adopted Budget FY2025')).toBe('adopted');
  });
});

describe('reporting entity classification', () => {
  it('MN OSA consolidates component units', () => {
    expect(entityOf('Minnesota Office of the State Auditor')).toBe('incl_component_units');
  });
  it('ACFR extracts are the primary government', () => {
    expect(entityOf('Utah State ACFR — General Fund (FY2024 actual, GAAP basis)')).toBe('primary_government');
  });
  it('WA SAO is the primary government', () => {
    expect(entityOf('WA State Auditor — Spokane Annual Financial Report FY2024 (General Fund, Expenditure by Function)'))
      .toBe('primary_government');
  });
  // ⚠⚠ THESE TWO USED TO ASSERT `unknown`, WITH THE REASON IN THE TEST NAME:
  // "EXPECTED primary_government but columbus.gov returned 403" and "not
  // probed". Both were true when written and neither was re-checked. On
  // 2026-11-03 columbus.gov simply answered, and the CA document turned out to
  // be in docs/ on the path the fund-scope entry already cited. A test that
  // pins the ABSENCE of evidence is pinning a measurement with a date on it —
  // it stops a silent regression, and it also quietly freezes a gap in place.
  it('Ohio AOS is the primary government — the AOS tab IS the audited fund statement', () => {
    // Columbus FY2025 and FY2024 both tie to the dollar, and under GASB 34 a
    // discretely presented component unit cannot be in a fund statement.
    expect(entityOf('Ohio Auditor of State Summarized Annual Financial Reports'))
      .toBe('primary_government');
  });
  it('CA SCO cities and county expenditures are the primary government', () => {
    expect(entityOf('CA State Controller - Expenditures')).toBe('primary_government');
    expect(entityOf('CA State Controller - Revenues')).toBe('primary_government');
    expect(entityOf('CA State Controller - County Expenditures')).toBe('primary_government');
  });
  // ── MN OSA: ONE ENTRY, TWO POPULATIONS ────────────────────────────────────
  // ⚠⚠ The defect this guards is NOT a missing entry. Every MN row has always
  // carried a value and every gate has always been green; what was missing was
  // evidence for HALF the rows the entry stamps. MN cities and MN counties
  // share one `data_source` string, so the regex cannot split them, and from
  // 2026-08 until 2026-11-03 a CITY reconciliation (Bloomington FY2022) was the
  // only thing standing behind 1,380 COUNTY rows. `unknown` is visible. An
  // entry whose evidence does not reach its own rows is visible as nothing —
  // which is why the assertions below read the evidence text itself.
  describe('MN OSA — the county branch is evidenced, not inherited from the cities', () => {
    const mn = REPORTING_ENTITY_REGISTRY.find((e) => e.id === 'mn-osa');

    it('the entry still carries the COUNTY reconciliation, not only the city one', () => {
      expect(mn.evidence.document).toMatch(/Dakota County/);
      expect(mn.evidence.document).toMatch(/county_21_data\.xlsx/);
      // The city workbook alone is what this entry used to rest on. If the
      // county documents ever disappear from the evidence, the entry is back to
      // stamping counties on a city's say-so.
      expect(mn.evidence.figures).toMatch(/Vermillion River Watershed/);
    });

    it('says in terms that it cannot be split city/county', () => {
      // Someone WILL try. The two populations share a data_source string, so a
      // `match` regex has nothing to split on.
      expect(mn.match.test('Minnesota Office of the State Auditor City/County Finances Report'))
        .toBe(true);
    });

    it('Dakota FY2021 ties on BOTH sides at exactly $0, and the excess ties too', () => {
      // Dakota County MN FY2021 ACFR, governmental funds (printed p.34-35):
      const ACFR_REVENUE = 396_557_509;
      const ACFR_EXPENDITURE = 428_973_445;
      // Vermillion River Watershed District, a DISCRETELY PRESENTED component
      // unit, its own fund statement (printed p.127):
      const VRW_REVENUE = 1_660_810;
      const VRW_EXPENDITURE = 1_557_495;
      // What TT stores, = the county workbook's Total Revenues / Total
      // Expenditures columns exactly:
      const STORED_REVENUE = 398_218_319;
      const STORED_EXPENDITURE = 430_530_940;

      expect(ACFR_REVENUE + VRW_REVENUE).toBe(STORED_REVENUE);
      expect(ACFR_EXPENDITURE + VRW_EXPENDITURE).toBe(STORED_EXPENDITURE);
      // The third tie is the one that makes coincidence untenable: the excess
      // of revenues over expenditures reconciles as well.
      expect((ACFR_REVENUE - ACFR_EXPENDITURE) + (VRW_REVENUE - VRW_EXPENDITURE))
        .toBe(STORED_REVENUE - STORED_EXPENDITURE);

      // ⚠ The evidence text and this test must not drift apart, and asserting
      // the digits one at a time is NOT enough to stop that: several of these
      // figures appear more than once in the prose, so corrupting one instance
      // leaves the others to satisfy a bare `toContain`. Measured — a mutation
      // that changed "the stored figures are 398,218,319" alone kept all 19
      // tests green. So pin the SENTENCES, rebuilt from the constants above.
      const usd = (n) => n.toLocaleString('en-US');
      expect(mn.evidence.figures)
        .toContain(`${usd(ACFR_REVENUE)} + ${usd(VRW_REVENUE)} = ${usd(STORED_REVENUE)}`);
      expect(mn.evidence.figures)
        .toContain(`${usd(ACFR_EXPENDITURE)} + ${usd(VRW_EXPENDITURE)} = ${usd(STORED_EXPENDITURE)}`);
      expect(mn.evidence.figures)
        .toContain(`The stored figures are ${usd(STORED_REVENUE)} and ${usd(STORED_EXPENDITURE)}`);
    });

    it('the business-type discrete unit is excluded BY EXHAUSTION, not by a ratio', () => {
      // Dakota's other discretely presented unit, the Community Development
      // Agency, has expenses of 59,587,281. It is out because the residue is
      // entirely spoken for by the Watershed — there is $0 left for it.
      const residueRevenue = 398_218_319 - 396_557_509;
      const residueExpenditure = 430_530_940 - 428_973_445;
      expect(residueRevenue - 1_660_810).toBe(0);
      expect(residueExpenditure - 1_557_495).toBe(0);
      expect(mn.evidence.figures).toContain('59,587,281');
    });

    it('Hennepin is the control: no discrete unit, so OSA should equal the county outright', () => {
      // GASB 80 made Hennepin Healthcare a BLENDED proprietary fund in 2017 and
      // the RRA and HRA are blended governmental funds, so Hennepin has nothing
      // discretely presented to add — and FY2020 revenue ties outright.
      const STORED_FY2020_REVENUE = 1_897_570_230;
      const ACFR_FY2020_REVENUE = 1_897_570_230;
      expect(STORED_FY2020_REVENUE - ACFR_FY2020_REVENUE).toBe(0);
      expect(mn.evidence.figures).toContain('1,897,570,230');

      // ⚠ Two residues are DECLARED rather than explained, and the entry must
      // keep saying so. The FY2021 pair is the important one: the signs are
      // OPPOSITE, which is what rules out an added entity as the cause.
      expect(2_229_604_721 - 2_229_604_361).toBe(360);
      const fy2021RevenueResidue = 1_851_255_583 - 1_852_541_519;
      const fy2021ExpenditureResidue = 1_834_835_822 - 1_833_705_402;
      expect(fy2021RevenueResidue).toBeLessThan(0);
      expect(fy2021ExpenditureResidue).toBeGreaterThan(0);
      expect(mn.evidence.figures).toMatch(/unexplained/);
    });
  });

  // ── CA SCO COUNTY REVENUES ────────────────────────────────────────────────
  // ⚠⚠ THIS TEST USED TO ASSERT `unknown`, and it was RIGHT to. It said: the
  // residue is 7,807,552 and First 5 Stanislaus's program revenues are
  // 10,623,616, the SAME ORDER, so the arithmetic cannot separate "excluded"
  // from "partly inside"; do not flip this because its siblings are classified;
  // it needs a county whose discretely presented unit is LARGE relative to the
  // revenue residue. On 2026-11-03 exactly that county was reconciled.
  // ⭐ The old test is the reason this was closable at all — it named the
  // measurement that would settle it, so a later session could go get it
  // instead of re-deriving the doubt. An honest `unknown` is a TODO with a
  // spec. Contrast the two assertions #324 had to retire, which pinned "not
  // probed" and "returned 403" — facts about a moment, with no way to act.
  describe('CA SCO county revenues — closed by ratio, not by argument', () => {
    const rev = REPORTING_ENTITY_REGISTRY.find((e) => e.id === 'ca-sco-county-rev');

    it('is primary_government', () => {
      expect(entityOf('CA State Controller - County Revenues')).toBe('primary_government');
    });

    it('Alameda FY2024: the implied governmental figure reconciles to the ACFR', () => {
      // SCO's stored total, and its ONLY non-governmental depth-0 root.
      const SCO_TOTAL = 4_742_901_769;
      const SCO_INTERNAL_SERVICE = 359_302_737;
      // County of Alameda FY2024 ACFR p.23, Total Governmental Funds column,
      // printed in THOUSANDS as 4,383,978.
      const ACFR_TOTAL_GOVERNMENTAL = 4_383_978 * 1000;

      const impliedGovernmental = SCO_TOTAL - SCO_INTERNAL_SERVICE;
      expect(impliedGovernmental).toBe(4_383_599_032);

      const residue = ACFR_TOTAL_GOVERNMENTAL - impliedGovernmental;
      expect(residue).toBe(378_968);
      expect(residue / ACFR_TOTAL_GOVERNMENTAL).toBeLessThan(0.0001); // 0.0086%
    });

    it('the excluded unit is 3,873x the residue — the ratio Stanislaus could not reach', () => {
      // Alameda Health System, the county's ONLY discretely presented unit,
      // from the Statement of Activities p.20 (thousands).
      const AHS_EXPENSES = 1_458_231 * 1000;
      const AHS_PROGRAM_REVENUES = (1_314_391 + 15 + 164) * 1000;
      const AHS_GENERAL_REVENUES = 153_043 * 1000;
      const AHS_TOTAL_REVENUES = AHS_PROGRAM_REVENUES + AHS_GENERAL_REVENUES;

      // ⭐ The statement's own bottom line proves the components were read
      // correctly: revenues less expenses IS the printed change in net position.
      expect(AHS_TOTAL_REVENUES - AHS_EXPENSES).toBe(9_382 * 1000);
      expect(AHS_TOTAL_REVENUES).toBe(1_467_613_000);

      const residue = 378_968;
      expect(Math.round(AHS_TOTAL_REVENUES / residue)).toBe(3873);
      // Stanislaus's ratio, which is why that county could NOT settle this.
      expect(10_623_616 / 7_807_552).toBeLessThan(1.4);
    });

    it('the expenditure side of the same county is all but a dollar tie', () => {
      const residue = (4_244_700_272 - 401_869_333) - (3_842_829 * 1000);
      expect(residue).toBe(1_939);
    });

    it('keeps Stanislaus, which is the only one exercising SCO enterprise funds', () => {
      // ⚠ Alameda has NO enterprise funds at all — that is what makes its
      // arithmetic clean AND what stops it standing alone. If a future pass
      // retires the Stanislaus evidence as superseded, the enterprise-fund half
      // of the taxonomy stops being covered.
      // ⚠⚠ Matching the bare word "Alameda" or "Stanislaus" is NOT enough and
      // was MEASURED not to be: deleting the Alameda expenditure reconciliation
      // left all 23 tests green, because the county's name still appears in the
      // document path and elsewhere in the same entry. This is the identical
      // hole found in the MN guard above. Pin the ARITHMETIC SENTENCES — a
      // county name is decoration, a reconciliation is the evidence.
      const exp = REPORTING_ENTITY_REGISTRY.find((e) => e.id === 'ca-sco-county-exp');
      expect(exp.evidence.figures)
        .toContain('1,194,047,359 + SCO enterprise & ISF 207,325,063 = 1,401,372,422');
      expect(exp.evidence.figures)
        .toContain('4,244,700,272 - Internal Service Fund 401,869,333 = 3,842,830,939');
      expect(exp.evidence.figures).toContain('11,672,965');   // First 5, the small unit
      expect(exp.evidence.figures).toContain('1,458,231,000'); // AHS, the large one
      expect(rev.evidence.figures).toMatch(/NEVER EXERCISES/);
    });
  });
});
