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

describe('the baseline itself', () => {
  it('carries the scoped row count and digest', () => {
    // 62654 (v2.34) - 10 = 62644. Migration 20260905000100 deleted the legacy
    // Indiana Gateway vintage; ten of those rows were inside the digest because
    // they carried a data_source string their owning enabled source is not named
    // after, so this file's name-join could not see them. See scopeBaseline.json
    // `_rebased_at_v2_35`, which is what the next test guards.
    expect(baseline.frozen_row_count).toBe(62644);
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
