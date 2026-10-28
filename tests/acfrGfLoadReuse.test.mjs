import { describe, it, expect } from 'vitest';

// From the LIB, never from a shebang driver — see the note in coAcfrLoad.test.mjs.
import { dataSourceLabel, ephemeralDataSourcePayload } from '../scripts/lib/acfrGfLoad.mjs';

/**
 * ── THE DEFECT THIS FILE EXISTS FOR ────────────────────────────────────────
 *
 * Re-running a load MINTED A NEW `treasury.budgets.id` for a row whose figures
 * had not moved. Found 2026-10-28 re-running Kodiak Island Borough as an
 * idempotence test; the frozen-figure gate caught it loudly, because that
 * registry is keyed on the id.
 *
 * ⚠⚠ THE CAUSE WAS TWO STRINGS THAT HAD TO MATCH AND DIDN'T.
 *
 * `treasury_sync_budget_tree` reuses an existing budgets row — it does not
 * blindly insert — but it finds that row with
 *
 *     WHERE municipality_id = v_ds.municipality_id
 *       AND fiscal_year = ... AND dataset_type = ...
 *       AND period_label IS NOT DISTINCT FROM ...
 *       AND data_source = v_ds.name          <-- HERE
 *
 * i.e. by the NAME OF THE data_sources ROW the caller passed. This loader named
 * that row `"<entity> General Fund <Kind> Budget"` and then, two statements
 * later, stamped the budgets row's `data_source` to
 * `"<entity> ACFR — General Fund <Kind> (FY<n> actual, GAAP basis)"`. Those are
 * different strings, so the lookup could never match on a second run, the RPC
 * always took its INSERT branch, and a pre-load DELETE was needed to stop that
 * becoming a duplicate. Delete + insert = a new uuid, every single time.
 *
 * The fix is to make the two strings ONE string: the ephemeral data_sources row
 * is now named with exactly the label the budgets row carries. That is the
 * property these tests pin. If it ever drifts again, every reload churns ids
 * again — and `dataSourceLabel` is a long interpolated string that a future
 * edit could easily change on one side only.
 *
 * ⚠ The pre-load delete was removed with it, and that matters on its own: it
 * keyed on (municipality_id, fiscal_year, dataset_type) WITHOUT fund_scope, and
 * treasury.budgets legitimately holds two scopes under one such key — New York
 * City publishes both a General Fund and a Total Governmental Funds series for
 * the same 24 entity-years. Nothing in this family shares a key with those 48
 * rows today, but the delete was one config away from removing them.
 */

const KODIAK = {
  entityLabel: 'Kodiak Island Borough',
  muniName: 'Kodiak Island Borough',
  entityType: 'county',
  state: 'AK',
  pdfDir: 'docs/AkBoroughs/kodiak',
  filePattern: /^kodiak-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractAkBorough.py',
  datasetIdPrefix: 'kodiak-acfr-gf',
  baseUrl: 'https://www.kodiakak.us/148/Finance',
  fys: [2016, 2017],
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
};

const ANCHORAGE = {
  ...KODIAK,
  entityLabel: 'Municipality of Anchorage',
  muniName: 'Municipality of Anchorage',
  entityType: 'city',
  datasetIdPrefix: 'anchorage-acfr-gf',
  fyEndMonthDay: '12-31',
  // ⚠ Anchorage closes December 31 while every borough in its own family closes
  // June 30. A payload that quietly defaulted this would assert the wrong period.
  fiscalYearStartMonth: 1,
};

const MUNI = '00000000-0000-4000-8000-000000000001';
const MODES = ['revenue', 'operating'];

describe('ephemeralDataSourcePayload — the row-reuse key', () => {
  it('⭐ names the data_source EXACTLY as the budgets row is stamped', () => {
    // This single equality is what keeps a reload from minting a new id.
    for (const cfg of [KODIAK, ANCHORAGE]) {
      for (const fy of [2016, 2025]) {
        for (const mode of MODES) {
          expect(
            ephemeralDataSourcePayload(cfg, MUNI, mode, fy).name,
            `${cfg.entityLabel} FY${fy} ${mode}`,
          ).toBe(dataSourceLabel(cfg, fy, mode));
        }
      }
    }
  });

  it('is scoped to ONE fiscal year, because the label names one', () => {
    // The label carries "(FY2024 actual, ...)", so a data_sources row claiming a
    // span of years while naming a single one would be a lie on its face — and
    // the name is now load-bearing, so it cannot be widened to cover the span.
    const p = ephemeralDataSourcePayload(KODIAK, MUNI, 'revenue', 2019);
    expect(p.fiscal_years).toEqual([2019]);
  });

  it('gives every (mode, fiscal year) its own dataset_id', () => {
    // ⚠ treasury.data_sources is UNIQUE on
    // (municipality_id, api_type, coalesce(dataset_id,''), dataset_type).
    // Per-FY rows that shared a dataset_id would collide on the second year.
    const ids = [];
    for (const fy of [2016, 2017, 2018]) {
      for (const mode of MODES) ids.push(ephemeralDataSourcePayload(KODIAK, MUNI, mode, fy).dataset_id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(KODIAK.datasetIdPrefix)).toBe(true);
  });

  it('carries the entity\'s own fiscal calendar, never a default', () => {
    expect(ephemeralDataSourcePayload(KODIAK, MUNI, 'revenue', 2020).fiscal_year_start_month).toBe(7);
    expect(ephemeralDataSourcePayload(ANCHORAGE, MUNI, 'revenue', 2020).fiscal_year_start_month).toBe(1);
  });

  it('points at the municipality it was given and the entity\'s own page', () => {
    const p = ephemeralDataSourcePayload(KODIAK, MUNI, 'operating', 2021);
    expect(p.municipality_id).toBe(MUNI);
    expect(p.base_url).toBe(KODIAK.baseUrl);
    expect(p.dataset_type).toBe('operating');
    expect(p.api_type).toBe('pdf_download');
  });
});
