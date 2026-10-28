import { describe, it, expect } from 'vitest';

// From the LIB, never from a shebang driver — see the note in coAcfrLoad.test.mjs.
import { dataSourceLabel, scopeForDataSource } from '../scripts/lib/acfrGfLoad.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { classify, SCOPE } from '../scripts/lib/fundScope.mjs';

/**
 * ── THE DEFECT THIS FILE EXISTS FOR ────────────────────────────────────────
 *
 * `loadFiscalYear` used to DELETE (municipality, fiscal_year, dataset_type) and
 * then let the RPC insert a fresh row. The replacement arrived at the column
 * DEFAULT for `fund_scope`, which is 'unknown'. So re-running a load that had
 * already been classified by SCOPE-01 silently threw its classification away —
 * row counts unchanged, every total unchanged, nothing failing.
 *
 * ⚠ The delete is gone (see tests/acfrGfLoadReuse.test.mjs — it was also
 * churning row ids), so the RPC no longer resets the column on a reload. The
 * stamp still has to be right: it classifies every genuinely new row, which
 * does insert at 'unknown'.
 *
 * Found 2026-10-28 by re-running the Kodiak Island Borough load as an
 * idempotence test: the rows came back, and came back `unknown`.
 *
 * ⚠ The frozen-invariant gate caught the sibling defect (new row ids) LOUDLY.
 * This one announced nothing, which is why it needs a test rather than a gate.
 *
 * ⚠ `fund_scope` was the ONLY axis this loader stamped, which is a defect of
 * its own — see tests/acfrGfLoadBasis.test.mjs, where `basis` sat `unknown` on
 * 139 Alaska rows whose Texas and Colorado siblings read `actual`.
 */

const ANCHORAGE = {
  entityLabel: 'Municipality of Anchorage',
  muniName: 'Municipality of Anchorage',
  entityType: 'city',
  state: 'AK',
  pdfDir: 'docs/Anchorage',
  filePattern: /^anchorage-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractAnchorageAK.py',
  datasetIdPrefix: 'anchorage-acfr-gf',
  baseUrl: 'https://www.muni.org/',
  fys: [2024],
  fyEndMonthDay: '12-31',
  fiscalYearStartMonth: 1,
};

const KODIAK = {
  ...ANCHORAGE,
  entityLabel: 'Kodiak Island Borough',
  muniName: 'Kodiak Island Borough',
  entityType: 'county',
  state: 'AK',
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
};

describe('dataSourceLabel — the string the registry actually matches on', () => {
  it('builds the label the loader stamps, per mode', () => {
    expect(dataSourceLabel(ANCHORAGE, 2024, 'revenue'))
      .toBe('Municipality of Anchorage ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)');
    expect(dataSourceLabel(ANCHORAGE, 2024, 'operating'))
      .toBe('Municipality of Anchorage ACFR — General Fund Expenditure by Function (FY2024 actual, GAAP basis)');
  });
});

describe('scopeForDataSource — a reload must not downgrade an evidenced row', () => {
  it('stamps general_fund for every entity in the ak-local-acfr-gf family', () => {
    for (const cfg of [ANCHORAGE, KODIAK]) {
      for (const mode of ['revenue', 'operating']) {
        const label = dataSourceLabel(cfg, 2024, mode);
        expect(scopeForDataSource(label), `${cfg.muniName} ${mode}`).toBe(SCOPE.GENERAL_FUND);
      }
    }
  });

  it('AGREES WITH classify() exactly — the loader is not a second authority', () => {
    // ⭐ This is the property that matters. The loader must stamp precisely what
    // the SCOPE-01 sweep would write, so a reload cannot make the table
    // disagree with the registry.
    for (const cfg of [ANCHORAGE, KODIAK]) {
      for (const mode of ['revenue', 'operating']) {
        const label = dataSourceLabel(cfg, 2024, mode);
        expect(scopeForDataSource(label)).toBe(classify(label, FUND_SCOPE_REGISTRY).scope);
      }
    }
  });

  it('leaves an UNRECOGNISED source unknown rather than guessing', () => {
    expect(scopeForDataSource('Some Brand New City ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)'))
      .toBe(SCOPE.UNKNOWN);
    expect(scopeForDataSource('')).toBe(SCOPE.UNKNOWN);
    expect(scopeForDataSource(null)).toBe(SCOPE.UNKNOWN);
  });

  it('refuses an UNEVIDENCED registry entry, even one claiming a scope', () => {
    // ⚠⚠ The safety property. `classify()` returns unknown when an entry has no
    // evidence, and this path must inherit that rather than reading `.scope`
    // off the entry itself. An unevidenced claim must not reach the database
    // through the loader any more than through the sweep.
    const unevidenced = [{
      id: 'pretend-family',
      match: /^Pretendville ACFR — General Fund /,
      scope: SCOPE.GENERAL_FUND,
      evidence: null,
    }];
    const label = 'Pretendville ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)';
    expect(scopeForDataSource(label, unevidenced)).toBe(SCOPE.UNKNOWN);
  });

  it('never returns a value outside the CHECK constraint set', () => {
    const labels = [
      dataSourceLabel(ANCHORAGE, 2024, 'revenue'),
      'nonsense',
      '',
    ];
    for (const l of labels) {
      expect(['general_fund', 'total_governmental', 'all_funds', 'unknown'])
        .toContain(scopeForDataSource(l));
    }
  });
});
