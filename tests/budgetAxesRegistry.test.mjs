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

  it('⛔ CA SCO COUNTY REVENUES stays unknown, and this one is not a gap to close casually', () => {
    // The only CA SCO half whose reconciliation is NOT a dollar tie: a
    // 7,807,552 residue (0.547%). First 5 Stanislaus — the discretely presented
    // component unit the figure must exclude — has program revenues of
    // 10,623,616, the SAME ORDER as that residue, so the arithmetic cannot
    // separate "excluded" from "partly inside". The expenditure half had a $6
    // residue against an 11.7M unit and could.
    // ⚠ Do not flip this because its three siblings are classified. It needs a
    // county whose discretely presented unit is large relative to the revenue
    // residue, or the residue decomposed to the line.
    expect(entityOf('CA State Controller - County Revenues')).toBe('unknown');
  });
});
