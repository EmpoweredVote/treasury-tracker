import { describe, it, expect } from 'vitest';
import {
  buildWorkList, mergeCheckpoint, pendingUnits, classifyRun, isRetryable, summarize, parseDryRunCounts,
} from '../scripts/lib/caSweepPlan.mjs';

/**
 * ⭐⭐ WHY A SWEEP DRIVER EXISTS AT ALL.
 *
 * The CA FY2025 fleet load is 112 loader invocations — 55 counties of cities
 * plus 57 county governments. Two things make a single straight-through run
 * the wrong shape:
 *
 *   1. `bulkLoadStateController.js` calls `process.exit(1)` on a fiscal-year
 *      contradiction (monthForCity / censusGuard). Today that abandons a whole
 *      county; 88 cities of Los Angeles can be lost to one city's bad month.
 *   2. bythenumbers.sco.ca.gov intermittently connect-times-out — ~1/3 success
 *      observed 2026-06-17 — and the loaders have no fetch retry.
 *
 * ⚠⚠ A TIMEOUT AND A CONTRADICTION ARE NOT THE SAME FAILURE. Retrying a
 * timeout converges in seconds; retrying a fiscal-month contradiction burns
 * the same wall clock forever and ends with the identical message. The driver
 * must retry the first and park the second for a person.
 *
 * ⚠⚠ TRUST THE OUTPUT, NOT THE EXIT CODE. A background chunk of the NY load
 * reported `exited with code 0` having done half its work.
 */
describe('buildWorkList', () => {
  it('pairs every city county and every county government with the fiscal year', () => {
    const units = buildWorkList({ cityCounties: ['Alpine', 'Los Angeles'], countyEntities: ['Alpine'], fy: 2025 });
    expect(units).toEqual([
      { id: 'city:Alpine:2025', kind: 'city', key: 'Alpine', fy: 2025 },
      { id: 'city:Los Angeles:2025', kind: 'city', key: 'Los Angeles', fy: 2025 },
      { id: 'county:Alpine:2025', kind: 'county', key: 'Alpine', fy: 2025 },
    ]);
  });

  // ⚠ Cities first and counties second is deliberate, not incidental: the two
  // feeds are independent, and finishing one whole class gives a verifiable
  // result if the sweep is stopped halfway.
  it('runs every city unit before any county unit', () => {
    const units = buildWorkList({ cityCounties: ['Yolo'], countyEntities: ['Alpine'], fy: 2025 });
    expect(units.map((u) => u.kind)).toEqual(['city', 'county']);
  });

  it('refuses a fiscal year it cannot use', () => {
    expect(() => buildWorkList({ cityCounties: [], countyEntities: [], fy: undefined }))
      .toThrow(/fiscal year/i);
  });
});

describe('mergeCheckpoint / pendingUnits', () => {
  const units = buildWorkList({ cityCounties: ['A', 'B'], countyEntities: ['C'], fy: 2025 });

  it('treats an absent checkpoint as everything pending', () => {
    const merged = mergeCheckpoint(units, null);
    expect(pendingUnits(merged)).toHaveLength(3);
  });

  it('skips what a previous run finished', () => {
    const merged = mergeCheckpoint(units, { units: { 'city:A:2025': { status: 'done', attempts: 1 } } });
    expect(pendingUnits(merged).map((u) => u.id)).toEqual(['city:B:2025', 'county:C:2025']);
  });

  // ⚠⚠ A PARKED FAILURE IS NOT PENDING. Re-running it every sweep is how an
  // operator learns to ignore the output.
  it('leaves a parked failure out of the pending list', () => {
    const merged = mergeCheckpoint(units, { units: { 'city:A:2025': { status: 'parked', attempts: 1, note: 'FATAL' } } });
    expect(pendingUnits(merged).map((u) => u.id)).toEqual(['city:B:2025', 'county:C:2025']);
  });

  it('keeps a retryable failure pending and carries its attempt count', () => {
    const merged = mergeCheckpoint(units, { units: { 'city:A:2025': { status: 'retry', attempts: 2 } } });
    expect(pendingUnits(merged).map((u) => u.id)).toEqual(['city:A:2025', 'city:B:2025', 'county:C:2025']);
    expect(pendingUnits(merged)[0].attempts).toBe(2);
  });

  // ⚠ A checkpoint from a different fiscal year describes different work.
  it('ignores a checkpoint entry for a unit not in this work list', () => {
    const merged = mergeCheckpoint(units, { units: { 'city:A:2024': { status: 'done', attempts: 1 } } });
    expect(pendingUnits(merged)).toHaveLength(3);
  });
});

describe('classifyRun', () => {
  it('is done only when the loader says it finished AND exits zero', () => {
    expect(classifyRun({ code: 0, output: '  ✅ 12 cities imported\n🎉 State Controller import complete!\n' }).status)
      .toBe('done');
  });

  // ⚠⚠ THE NY LESSON, PINNED. Exit code 0 with no completion line is a
  // half-finished run, and counting it as done loses the rest of that county
  // silently.
  it('is not done on exit code zero without the completion line', () => {
    expect(classifyRun({ code: 0, output: '  Fetched 10,000 rows...\n' }).status).toBe('retry');
  });

  it('parks a fiscal-year contradiction instead of retrying it', () => {
    const r = classifyRun({ code: 1, output: '\nFATAL: month 7 contradicts the federal audit record for Dixon, CA\n' });
    expect(r.status).toBe('parked');
    expect(r.note).toMatch(/contradicts the federal audit record/);
  });

  it('parks a refused write instead of retrying it', () => {
    const r = classifyRun({ code: 1, output: '❌ 2 write(s) were REFUSED and nothing was loaded for them:\n   Dixon FY2025 operating  [rpc]\n' });
    expect(r.status).toBe('parked');
    expect(r.note).toMatch(/REFUSED/);
  });

  it('retries a connect timeout', () => {
    const r = classifyRun({ code: 1, output: 'Fatal: TypeError: fetch failed\n  cause: ConnectTimeoutError\n' });
    expect(r.status).toBe('retry');
  });

  it('retries a 5xx from the feed', () => {
    expect(classifyRun({ code: 1, output: 'Fatal: Error: API 503: upstream\n' }).status).toBe('retry');
  });

  // ⚠ An unrecognised failure is NOT assumed transient: a sweep that retries
  // everything forever is a sweep that never reports.
  it('parks a failure it does not recognise', () => {
    expect(classifyRun({ code: 1, output: 'Fatal: something nobody has seen\n' }).status).toBe('parked');
  });
});

describe('isRetryable', () => {
  it('stops retrying a unit at the attempt ceiling', () => {
    expect(isRetryable({ status: 'retry', attempts: 3 }, 3)).toBe(false);
    expect(isRetryable({ status: 'retry', attempts: 2 }, 3)).toBe(true);
  });

  it('never retries a parked unit', () => {
    expect(isRetryable({ status: 'parked', attempts: 1 }, 3)).toBe(false);
  });
});

describe('summarize', () => {
  it('counts each outcome so the final line is not a guess', () => {
    const units = [
      { status: 'done' }, { status: 'done' }, { status: 'parked' }, { status: 'pending' },
    ];
    expect(summarize(units)).toEqual({ total: 4, done: 2, parked: 1, pending: 1, retry: 0 });
  });
});

/**
 * ⚠⚠ THE TWO LOADERS DO NOT ANNOUNCE SUCCESS THE SAME WAY, and a smoke test
 * of the driver on two real county units is what found it:
 *
 *   bulkLoadStateController.js   "🎉 State Controller import complete!"
 *   loadCountyBudget.js          "Done. 2 year/type combos processed."
 *
 * Classifying every unit against the city loader's line parked all 57 county
 * units as "exited 0 without the completion line" — a clean run reported as a
 * total failure, which is the direction that wastes a person's whole day.
 */
describe('classifyRun per loader', () => {
  it('accepts the county loader own completion line', () => {
    const r = classifyRun({ kind: 'county', code: 0, output: '────\nDone. 2 year/type combos processed.\n  FY2025 operating: $167,525,888 — dry-run\n' });
    expect(r.status).toBe('done');
  });

  it('accepts the city loader completion line', () => {
    expect(classifyRun({ kind: 'city', code: 0, output: '🎉 State Controller import complete!\n' }).status).toBe('done');
  });

  // ⚠ Each kind is held to ITS OWN marker. A county run printing the city
  // loader's line would mean something has gone very strange, and waving it
  // through is how a wrong success gets recorded.
  it('does not accept the other loader line', () => {
    expect(classifyRun({ kind: 'county', code: 0, output: '🎉 State Controller import complete!\n' }).status).toBe('retry');
    expect(classifyRun({ kind: 'city', code: 0, output: 'Done. 2 year/type combos processed.\n' }).status).toBe('retry');
  });

  // ⚠⚠ A REAL FINDING FROM THE SMOKE TEST, PINNED. Alpine County is not seeded
  // as a county entity, so the loader refuses before fetching anything. It is
  // not transient and no retry will seed it.
  it('parks an unseeded county entity', () => {
    const r = classifyRun({
      kind: 'county',
      code: 1,
      output: 'ERROR: County entity "Alpine County" (entity_type=county, state=CA) not found.\n'
        + '       The county entity must be seeded before running this loader (see seedCountyLinks.js).\n',
    });
    expect(r.status).toBe('parked');
    expect(r.note).toMatch(/not seeded|seedCountyLinks|not found/i);
  });
});

/**
 * ⭐ A DRY RUN THAT ONLY SAYS "done" PROVES THE UNIT RAN, NOT WHAT IT WOULD DO.
 *
 * The first city pre-flight reported 55 done / 0 parked and told us nothing
 * about the thing actually worth knowing before a fleet load: how many
 * entities would be written, and how many the never-overwrite guard would
 * skip because a richer custom source already holds that year.
 */
describe('parseDryRunCounts', () => {
  it('reads the city loader would-import and skipped counts', () => {
    const out = '  (dry run — skipping import) 33 cities would import, 1 skipped (existing other-source data preserved)\n';
    expect(parseDryRunCounts(out)).toEqual({ wouldImport: 33, skipped: 1 });
  });

  // ⚠ Both datasets run in one invocation, so the line appears TWICE — once
  // for expenditures and once for revenues. Reading only the first halves the
  // number and makes a fleet look smaller than it is.
  it('sums the line across both datasets in one run', () => {
    const out = '  (dry run — skipping import) 33 cities would import, 1 skipped (x)\n'
      + '  (dry run — skipping import) 32 cities would import, 2 skipped (x)\n';
    expect(parseDryRunCounts(out)).toEqual({ wouldImport: 65, skipped: 3 });
  });

  it('is null when the output carries no such line', () => {
    expect(parseDryRunCounts('Done. 2 year/type combos processed.\n')).toBeNull();
  });
});

/**
 * ⚠⚠ THE REFUSAL NOTE SENT ME HUNTING FOR A DUPLICATE THAT DID NOT EXIST.
 *
 * The FY2025 fleet load parked Alameda, Sacramento and Santa Clara with
 * "writes REFUSED by the database — resolve the duplicate". I measured every
 * CA FY2025 all_funds/actual group: ZERO duplicates. The actual message was
 *
 *   cannot determine fiscal_year_start_month: 0 existing month(s) for
 *   (muni=… data_source=CA State Controller - Expenditures). Pass
 *   p_fiscal_year_start_month explicitly — it must come from the entity's own
 *   financial report, never a default.
 *
 * Fremont, Sacramento and San Jose have NO State Controller budget history at
 * all — only publicpay salaries — so there was no month to inherit. That is
 * the standing "no SCO backfill for flagship custom-source cities" decision
 * being enforced by the database, not a fault.
 *
 * Both are refusals and both are parked; they need completely different
 * actions, so the note must name which one it is.
 */
describe('classifyRun tells the two refusals apart', () => {
  it('names a missing fiscal-year month, and does not call it a duplicate', () => {
    const r = classifyRun({
      kind: 'city',
      code: 1,
      output: '❌ 2 write(s) were REFUSED and nothing was loaded for them:\n'
        + '   Sacramento FY2025 operating  [rpc]\n'
        + '      cannot determine fiscal_year_start_month: 0 existing month(s) for '
        + '(muni=9722596e data_source=CA State Controller - Expenditures). Pass '
        + "p_fiscal_year_start_month explicitly — it must come from the entity's own "
        + 'financial report, never a default.\n',
    });
    expect(r.status).toBe('parked');
    expect(r.note).toMatch(/fiscal.year start month/i);
    expect(r.note).not.toMatch(/duplicate/i);
  });

  it('still names an ambiguous target as a duplicate', () => {
    const r = classifyRun({
      kind: 'city',
      code: 1,
      output: '❌ 1 write(s) were REFUSED and nothing was loaded for them:\n'
        + '   Dixon FY2025 operating  [rpc]\n      ambiguous target: 2 rows match\n',
    });
    expect(r.status).toBe('parked');
    expect(r.note).toMatch(/duplicate/i);
  });

  it('falls back to a neutral refusal note it cannot classify', () => {
    const r = classifyRun({ kind: 'city', code: 1, output: '❌ 1 write(s) were REFUSED\n   something new\n' });
    expect(r.status).toBe('parked');
    expect(r.note).toMatch(/refused/i);
    expect(r.note).not.toMatch(/duplicate/i);
  });
});
