import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

import { liveSyncRowIds, repoExcludedIds, EXCLUSION_FILE } from '../scripts/liveSyncExclusions.mjs';

const baseline = JSON.parse(readFileSync('scripts/data/scopeBaseline.json', 'utf8'));

describe('which rows a live sync can rewrite', () => {
  const sources = [
    { id: 's1', name: 'Enabled Source', is_enabled: true },
    { id: 's2', name: 'Disabled Source', is_enabled: false },
  ];

  it('matches on the data_source TEXT column', () => {
    const rows = [
      { id: 'a', data_source: 'Enabled Source' },
      { id: 'b', data_source: 'Disabled Source' },
    ];
    expect(liveSyncRowIds(rows, sources)).toEqual(['a']);
  });

  // ⚠⚠ Measured 2026-08-30: `data_source_id` links ZERO budget rows to an enabled
  // source — only 984 of 88,354 rows carry one at all. A rule keyed on it matches
  // nothing, and a filter that matches nothing looks exactly like a filter that
  // found nothing to do.
  it('does NOT rely on data_source_id, which links nothing', () => {
    const rows = [{ id: 'a', data_source: null, data_source_id: 's1' }];
    expect(liveSyncRowIds(rows, sources)).toEqual([]);
  });

  it('ignores rows owned by a disabled source', () => {
    const rows = [{ id: 'b', data_source: 'Disabled Source' }];
    expect(liveSyncRowIds(rows, sources)).toEqual([]);
  });

  it('ignores rows with no source at all', () => {
    expect(liveSyncRowIds([{ id: 'x', data_source: null }, { id: 'y', data_source: '' }], sources))
      .toEqual([]);
  });

  // ⚠ The name must match exactly — a near-miss must not silently protect a row.
  it('does not match a source name loosely', () => {
    const rows = [
      { id: 'a', data_source: 'Enabled Source (revised)' },
      { id: 'b', data_source: 'enabled source' },
    ];
    expect(liveSyncRowIds(rows, sources)).toEqual([]);
  });
});

describe('the live-sync exclusion snapshot', () => {
  it('exists and is registered in excluded_ids_files', () => {
    expect(existsSync(EXCLUSION_FILE)).toBe(true);
    expect(baseline.excluded_ids_files).toContain(EXCLUSION_FILE);
  });

  it('is a non-empty array of unique id strings', () => {
    const ids = JSON.parse(readFileSync(EXCLUSION_FILE, 'utf8'));
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids.slice(0, 50)) expect(typeof id).toBe('string');
  });

  // ⚠ It is a COMPLETE statement of its own scope, not a diff against the
  // milestone files, so it is expected to overlap them. repoExcludedIds unions
  // into a Set, so the overlap changes no arithmetic.
  it('is unioned into a Set, so overlapping files are harmless', () => {
    const read = (f) => (f === 'a.json' ? '["x","y"]' : '["y","z"]');
    const s = repoExcludedIds({ excluded_ids_files: ['a.json', 'b.json'] }, read);
    expect([...s].sort()).toEqual(['x', 'y', 'z']);
  });
});

describe('the v2.34 rebase is recorded, not silent', () => {
  // ⚠⚠ scopeBaseline.json's own _warning: figures_frozen must never be quietly
  // regenerated. A rebase is allowed but must carry its reasoning and sign-off,
  // and the superseded digest must survive in the history.
  const rebase = baseline._rebased_at_v2_34;

  it('exists with a date and an authoriser', () => {
    expect(rebase).toBeTruthy();
    expect(rebase._date).toBe('2026-08-30');
    expect(rebase._authorised_by).toMatch(/Chris/);
  });

  it('keeps the superseded digest in the history', () => {
    const hist = baseline.figures_frozen_history ?? [];
    const prior = hist.find((h) => h.digest === '90f009fe396d20dcd211258e534ea81c237aa0bddd3d2412680c1dcce3af76fe');
    expect(prior, 'the pre-scoping digest must survive').toBeTruthy();
    expect(prior.row_count).toBe(79916);
    expect(baseline.figures_frozen).not.toBe(prior.digest);
  });

  it('records why the broad definition was chosen over the cron slice', () => {
    // The narrow rule covered 6 of the 7 observed drift candidates and keys on
    // the MUTABLE fiscal_years. Both reasons must stay written down, or the
    // next reader will "optimise" the coverage back down.
    expect(rebase._why_broad_and_not_the_cron_slice).toMatch(/fiscal_years is MUTABLE|MUTABLE/);
    expect(rebase._why_broad_and_not_the_cron_slice).toMatch(/covers 7 and the narrow rule/);
  });

  it('records that a snapshot was chosen over a live predicate', () => {
    expect(rebase._why_a_snapshot_and_not_a_live_predicate).toMatch(/repo stays the source of truth/);
  });

  it('records that the note\'s own numbers did not reproduce', () => {
    // 7,688 / 72,228 was a measurement with a date. Carrying it forward would
    // have under-scoped the fix by more than half.
    expect(rebase._the_note_s_numbers_did_not_reproduce).toMatch(/7,688/);
    expect(rebase._the_note_s_numbers_did_not_reproduce).toMatch(/17,262/);
  });

  it('records the parity proof taken BEFORE the baseline was written', () => {
    expect(rebase._proven_before_the_baseline_was_written).toMatch(/62,654/);
    expect(rebase._proven_before_the_baseline_was_written).toMatch(/total_budget::text/);
  });

  it('still states a remaining risk rather than claiming the problem is closed', () => {
    expect(rebase._known_remaining_risk).toBeTruthy();
    expect(rebase._known_remaining_risk).toMatch(/enabled after this snapshot|manual sync/);
  });
});

/**
 * The rule v2.36 added: an enabled source can rewrite any row on its own
 * municipality, for a fiscal_year it declares, of the dataset_type it writes —
 * whatever data_source string that row happens to carry. That is how
 * treasury_sync_city_budget keys, and it NEVER keys on data_source.
 */
describe('the rewrite surface the sync RPC actually uses', () => {
  const MUNI = 'muni-1';
  const OTHER = 'muni-2';
  const sources = [{
    id: 's1',
    name: 'Bloomington Annual Compensation',
    is_enabled: true,
    municipality_id: MUNI,
    fiscal_years: [2025, 2026],
    dataset_type: 'salaries',
  }];

  /**
   * ⚠⚠ THE ACTUAL 2026-09-07 INCIDENT, as a fixture. The row is labelled
   * `data/checkbook-all.csv` and no enabled source is named that — yet the
   * compensation feed rewrites it weekly, because the RPC matches on
   * (municipality, fiscal_year, dataset_type) and updates total_budget while
   * leaving data_source untouched.
   */
  it('catches a row a sync rewrites under someone else\'s label', () => {
    const rows = [{
      id: 'bloomington-fy2025-salaries',
      municipality_id: MUNI,
      fiscal_year: 2025,
      dataset_type: 'salaries',
      data_source: 'data/checkbook-all.csv',
    }];
    expect(liveSyncRowIds(rows, sources)).toEqual(['bloomington-fy2025-salaries']);
  });

  it('does not reach a different dataset_type on the same entity and year', () => {
    // Bloomington's FY2025 operating/revenue rows are NOT rewritable by a
    // salaries source — this is why (municipality, fiscal_year) alone was
    // rejected: it would have wrongly freed 165 rows instead of 51, including
    // all 24 California State ACFR revenue rows.
    const rows = [
      { id: 'op', municipality_id: MUNI, fiscal_year: 2025, dataset_type: 'operating', data_source: 'x' },
      { id: 'rev', municipality_id: MUNI, fiscal_year: 2025, dataset_type: 'revenue', data_source: 'x' },
    ];
    expect(liveSyncRowIds(rows, sources)).toEqual([]);
  });

  it('does not reach a year the source does not declare', () => {
    const rows = [{ id: 'old', municipality_id: MUNI, fiscal_year: 2024, dataset_type: 'salaries', data_source: 'x' }];
    expect(liveSyncRowIds(rows, sources)).toEqual([]);
  });

  it('does not reach another municipality', () => {
    const rows = [{ id: 'elsewhere', municipality_id: OTHER, fiscal_year: 2025, dataset_type: 'salaries', data_source: 'x' }];
    expect(liveSyncRowIds(rows, sources)).toEqual([]);
  });

  /**
   * ⚠⚠ THE UNION, NOT A REPLACEMENT. Measured 2026-09-07: 16 real rows match by
   * NAME but fall outside the surface, because a source can hold rows for a year
   * it no longer declares (LA City Payroll salaries FY2017-2020, several MA DLS
   * revenue rows). Replacing the name rule would have silently dropped them.
   */
  it('keeps a name match that falls OUTSIDE the declared surface', () => {
    const rows = [{
      id: 'name-only',
      municipality_id: MUNI,
      fiscal_year: 2017,                       // not in fiscal_years
      dataset_type: 'salaries',
      data_source: 'Bloomington Annual Compensation', // but the name matches
    }];
    expect(liveSyncRowIds(rows, sources)).toEqual(['name-only']);
  });

  it('never returns a row twice when both halves of the union match', () => {
    const rows = [{
      id: 'both', municipality_id: MUNI, fiscal_year: 2025, dataset_type: 'salaries',
      data_source: 'Bloomington Annual Compensation',
    }];
    expect(liveSyncRowIds(rows, sources)).toEqual(['both']);
  });

  it('ignores the surface of a DISABLED source', () => {
    const off = [{ ...sources[0], is_enabled: false }];
    const rows = [{ id: 'a', municipality_id: MUNI, fiscal_year: 2025, dataset_type: 'salaries', data_source: 'x' }];
    expect(liveSyncRowIds(rows, off)).toEqual([]);
  });

  /**
   * ⚠ A source with no declared dataset_type could write anything, so it must
   * widen to the whole (municipality, year) rather than being skipped. Measured
   * 2026-09-07: 0 of 1,799 enabled sources lack one — but a gate must not depend
   * on that staying true.
   */
  it('widens to the whole year when a source declares no dataset_type', () => {
    const vague = [{ ...sources[0], dataset_type: null }];
    const rows = [
      { id: 'op', municipality_id: MUNI, fiscal_year: 2025, dataset_type: 'operating', data_source: 'x' },
      { id: 'sal', municipality_id: MUNI, fiscal_year: 2025, dataset_type: 'salaries', data_source: 'x' },
      { id: 'other-year', municipality_id: MUNI, fiscal_year: 2024, dataset_type: 'operating', data_source: 'x' },
    ];
    expect(liveSyncRowIds(rows, vague).sort()).toEqual(['op', 'sal']);
  });

  it('ignores a source with no municipality rather than matching everything', () => {
    const orphan = [{ ...sources[0], municipality_id: null, name: 'Orphan' }];
    const rows = [{ id: 'a', municipality_id: MUNI, fiscal_year: 2025, dataset_type: 'salaries', data_source: 'x' }];
    expect(liveSyncRowIds(rows, orphan)).toEqual([]);
  });
});

describe('the baseline itself', () => {
  it('carries the scoped row count and digest', () => {
    // 62654 (v2.34) -10 (v2.35, the legacy Indiana rows the name-join could not
    // see) -51 (v2.36, re-keying the scope to the RPC's actual rewrite surface).
    expect(baseline.frozen_row_count).toBe(62593);
    expect(baseline.figures_frozen).toMatch(/^[0-9a-f]{64}$/);
  });

  // ⚠⚠ The v2.35 rebase exists BECAUSE this file's scope rule has a blind spot:
  // it identifies a row's owner by matching budgets.data_source against
  // data_sources.name. Measured 2026-09-05, 385 of 1,799 enabled cron-syncing
  // sources have a name matching NO budget row on their own municipality while
  // that municipality does have rows — each one a candidate for the same miss.
  // budgets.data_source_id cannot replace the join: NULL on 269,062 rows and
  // dangling on all 939 that carry one. This test fails if that admission is
  // ever quietly dropped from the baseline.
  /**
   * ⚠⚠ v2.36 closed the blind spot v2.35 only documented. The rule is now a UNION
   * of the name match and the RPC's real rewrite surface — see the tests in
   * "the rewrite surface the sync RPC actually uses" below.
   */
  it('records the v2.36 scope correction with its measurement and its loss', () => {
    const v = baseline._rebased_at_v2_36;
    expect(v).toBeTruthy();
    // The cause must stay recorded as the RPC's update path, not the label.
    expect(v._the_cause_is_in_the_rpc).toMatch(/treasury_sync_city_budget/);
    expect(v._the_cause_is_in_the_rpc).toMatch(/leaves\s+data_source and hierarchy/);
    // ⚠ The union-not-replacement lesson, with the 16 rows that proved it.
    expect(v._the_new_rule_is_a_UNION_and_that_matters).toMatch(/NOT A SUBSET/);
    expect(v._the_new_rule_is_a_UNION_and_that_matters).toMatch(/16/);
    // ⚠⚠ An unrecoverable change must never be smoothed away by a rebase.
    expect(v._what_is_permanently_LOST).toMatch(/PRE-DRIFT VALUE/);
    expect(v._the_row_that_moved_this_time).toMatch(/Bloomington/);
    expect(v._authorised_by).toBeTruthy();
    expect(v._the_51_rows_that_left_the_digest).toHaveLength(51);
    for (const r of v._the_51_rows_that_left_the_digest) {
      expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(typeof r.total_budget).toBe('number');
      expect(r.entity).toBeTruthy();
    }
  });

  it('records that the name-join blind spot is open, not closed', () => {
    const v235 = baseline._rebased_at_v2_35;
    expect(v235).toBeTruthy();
    expect(v235._the_defect_that_hid_them).toMatch(/data_sources\.name/);
    expect(v235._why_the_join_cannot_simply_be_fixed_here).toMatch(/385/);
    expect(v235._what_is_proven_and_what_is_not).toMatch(/NOT PROVEN/);
    expect(v235._authorised_by).toBeTruthy();
    expect(v235._withdrawn_rows).toHaveLength(10);
    for (const r of v235._withdrawn_rows) {
      expect(r.data_source).toBe('Indiana Gateway');
      expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('has not lost the never-regenerate warning', () => {
    expect(baseline._warning).toMatch(/never change|must never/i);
  });
});
