import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Static integrity of the frozen-invariant bookkeeping.
 *
 * ⚠ WHY STATIC. The live check (scripts/verify-budget-axes.mjs) needs the
 * database, and this repo's vitest suite never touches it — CI runs `npm test`
 * with no credentials. So the live invariant runs on a schedule instead
 * (.github/workflows/frozen-invariant-watch.yml), and what CI can enforce is
 * that the BOOKKEEPING those checks depend on stays coherent.
 *
 * ⚠ WHY IT MATTERS. This invariant has been broken by bookkeeping three times:
 * a shared exclusion file went un-updated across v2.27, v2.28 and v2.29, and
 * after v2.30 three more milestones inserted rows without registering them.
 * Every one of those was a missing or stale file path — exactly what this
 * catches, without a database.
 */

const BASELINE = 'scripts/data/scopeBaseline.json';
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

/**
 * ⚠ LAZY AND FORGIVING BY DESIGN. An earlier version read every registered file
 * at describe-collection time. A missing path then threw before any `it` ran, so
 * vitest reported "no tests" instead of naming the file — a red build with the
 * diagnosis stripped out, which is the same disease this whole invariant has.
 * Reads happen inside tests, and a missing file yields [] so the dedicated
 * existence test is the one that reports it.
 */
const readList = (rel) => {
  if (!existsSync(rel)) return [];
  try {
    const parsed = JSON.parse(readFileSync(rel, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

describe('scopeBaseline.json shape', () => {
  it('carries a frozen row count and digest', () => {
    expect(typeof baseline.frozen_row_count).toBe('number');
    expect(baseline.figures_frozen).toMatch(/^[0-9a-f]{64}$/);
  }, 30_000);

  it('lists exclusion files, never a single shared path', () => {
    // The single `excluded_ids_file` is what went stale across three milestones.
    expect(Array.isArray(baseline.excluded_ids_files)).toBe(true);
    expect(baseline.excluded_ids_files.length).toBeGreaterThan(0);
    expect(baseline.excluded_ids_file).toBeUndefined();
  }, 30_000);

  it('keeps the warning against regenerating the digest', () => {
    expect(baseline._warning).toMatch(/do NOT edit or regenerate/i);
  }, 30_000);

  // Every rebase must stay documented. Losing the history is losing the reason.
  it('records every rebase it has performed', () => {
    const rebases = Object.keys(baseline).filter((k) => k.startsWith('_rebased_at_'));
    expect(rebases.length).toBeGreaterThanOrEqual(2);
    for (const k of rebases) {
      expect(typeof baseline[k]._date, k).toBe('string');
      expect(typeof baseline[k]._authorised_by, k).toBe('string');
    }
  }, 30_000);
});

describe('every registered file exists and parses', () => {
  const all = [...(baseline.excluded_ids_files ?? []), ...(baseline.figure_change_files ?? [])];

  it('registers at least one file', () => {
    expect(all.length).toBeGreaterThan(0);
  }, 30_000);

  for (const rel of all) {
    it(`${rel} exists`, () => {
      expect(existsSync(rel), `${rel} is registered in ${BASELINE} but missing on disk`).toBe(true);
    }, 30_000);

    // ⚠ Asserts on the RAW bytes, not via readList — readList swallows a parse
    // error to keep collection alive, so testing it here would always pass.
    it(`${rel} parses as a JSON array`, () => {
      if (!existsSync(rel)) return; // the existence test above owns this case
      const raw = readFileSync(rel, 'utf8');
      let parsed;
      expect(() => { parsed = JSON.parse(raw); }, `${rel} is not valid JSON`).not.toThrow();
      expect(Array.isArray(parsed), `${rel} must hold a JSON array`).toBe(true);
    }, 30_000);
  }
});

describe('exclusion ids', () => {
  const ids = (baseline.excluded_ids_files ?? []).flatMap(readList);

  it('are all non-empty strings', () => {
    for (const id of ids) expect(typeof id).toBe('string');
    expect(ids.every((id) => id.trim() !== '')).toBe(true);
  }, 30_000);

  // ⚠ A row registered twice would be excluded once but counted twice by anyone
  // reconciling the arithmetic, which is how an off-by-N hides.
  //
  // ⚠⚠ SCOPED TO THE MILESTONE FILES since 2026-08-30. Exclusions now come in two
  // KINDS, and only one of them is provenance:
  //
  //   created-ids files   "this milestone inserted these rows after the freeze"
  //                       — provenance, and the deficit arithmetic in
  //                       registerCreatedRows.mjs reconciles against them, so a
  //                       row appearing in two of these IS a bookkeeping error.
  //   liveSyncExcludedIds "these rows belong to a source that can rewrite them"
  //                       — SCOPE. It is deliberately a COMPLETE statement of
  //                       what is out of scope, not a diff against the others, so
  //                       it overlaps them by design. 16 such overlaps existed on
  //                       the day it was introduced: rows both created by a
  //                       milestone and owned by a live-syncing source.
  //
  // Both kinds are unioned into a Set before use, so an overlap changes no
  // arithmetic. Forbidding it would force the scope file to be expressed as a
  // diff, which is exactly the shape that went stale across v2.27-v2.29.
  const SCOPE_FILES = new Set(['scripts/data/liveSyncExcludedIds.json']);
  const milestoneFiles = (baseline.excluded_ids_files ?? []).filter((f) => !SCOPE_FILES.has(f));

  it('contain no duplicates across the MILESTONE files', () => {
    const seen = new Set();
    const dupes = [];
    for (const id of milestoneFiles.flatMap(readList)) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    expect(dupes).toEqual([]);
  }, 30_000);

  it('have no duplicates WITHIN any single file, scope files included', () => {
    for (const rel of baseline.excluded_ids_files ?? []) {
      const list = readList(rel);
      expect(new Set(list).size, `${rel} repeats an id`).toBe(list.length);
    }
  }, 30_000);
});

describe('the authorised-correction ledger', () => {
  const entries = (baseline.figure_change_files ?? []).flatMap(readList);

  it('is registered, so a correction has somewhere to go', () => {
    expect(Array.isArray(baseline.figure_change_files)).toBe(true);
    expect(baseline.figure_change_files.length).toBeGreaterThan(0);
  }, 30_000);

  // ⚠ An entry without `old` is useless: the digest hashes the value a row
  // REPLACED, so a missing old value silently fails to hold the digest steady.
  it('every entry records id, old, new and a reason', () => {
    for (const e of entries) {
      expect(typeof e.id, JSON.stringify(e)).toBe('string');
      expect(e.old, JSON.stringify(e)).toBeDefined();
      expect(e.new, JSON.stringify(e)).toBeDefined();
      expect(String(e.why ?? '').length, JSON.stringify(e)).toBeGreaterThan(20);
    }
  }, 30_000);

  it('never ledgers the same row twice', () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  }, 30_000);

  // A ledgered row must be frozen, not excluded — excluding it already removes
  // it from the digest, so a ledger entry would be dead weight hiding a mistake.
  it('never ledgers a row that is also excluded', () => {
    const excluded = new Set((baseline.excluded_ids_files ?? []).flatMap(readList));
    expect(entries.filter((e) => excluded.has(e.id)).map((e) => e.id)).toEqual([]);
  }, 30_000);
});
