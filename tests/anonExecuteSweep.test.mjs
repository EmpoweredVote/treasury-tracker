import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyVerdict,
  surfaceVerdict,
  assertBaselineHasReasons,
  CYCLE_DAYS,
  STALE_CYCLES,
} from '../scripts/lib/anonExecuteSweep.mjs';

/**
 * The decision logic for the live anon-EXECUTE sweep, kept as pure functions so
 * it runs in the ordinary PR gate with NO database credential — the same split
 * that lets definerFunctionGrants.mjs be a real CI guard (this repo
 * deliberately keeps no DB credential in GitHub Actions, PR #90).
 *
 * The in-database half (treasury.run_anon_execute_sweep) does the live scan and
 * writes a verdict row. THIS half decides what a verdict MEANS — and in
 * particular that a missing or stale verdict is not a pass, which is the rule
 * whose absence let three consecutive frozen-invariant failures go unread
 * (2026-09-07, -14, -21).
 */

const row = (signature, extra = {}) => ({
  signature,
  secdef: true,
  anon_exec: true,
  authed_exec: false,
  acl: '{=X/postgres,postgres=X/postgres}',
  ...extra,
});

const accepted = (signature, reason = 'intentionally public, verified live') => ({ signature, reason });

describe('classifyVerdict — names the actual condition', () => {
  it('flags a function anon can execute that is not in the baseline', () => {
    const v = classifyVerdict({
      live: [row('public.treasury_ensure_municipality(text)')],
      baseline: [],
    });

    expect(v.ok).toBe(false);
    expect(v.detail).toContain('NEW EXPOSURE');
    expect(v.detail).toContain('public.treasury_ensure_municipality(text)');
    expect(v.newExposures).toEqual(['public.treasury_ensure_municipality(text)']);
  });

  it('passes when every live exposure is an accepted baseline entry', () => {
    const v = classifyVerdict({
      live: [row('public.treasury_get_sync_key(text)')],
      baseline: [accepted('public.treasury_get_sync_key(text)')],
    });

    expect(v.ok).toBe(true);
    expect(v.newExposures).toEqual([]);
  });

  // ⚠ Mirrors run_frozen_invariant_check: nothing to compare against must not
  // look green. An empty baseline means the seed never ran, not that the
  // database is clean.
  it('treats an empty baseline as INCONCLUSIVE rather than a pass', () => {
    const v = classifyVerdict({ live: [], baseline: [] });

    expect(v.ok).toBe(false);
    expect(v.detail).toContain('INCONCLUSIVE');
  });

  it('reports a baseline entry that is no longer exposed without failing the sweep', () => {
    const v = classifyVerdict({
      live: [],
      baseline: [accepted('public.closed_since(text)')],
    });

    expect(v.ok).toBe(true);
    expect(v.detail).toContain('BASELINE ENTRY GONE');
    expect(v.goneEntries).toEqual(['public.closed_since(text)']);
  });

  // A SECURITY INVOKER function is the case the static DEFINER-only guard
  // missed on treasury.detect_forked_entities (PR #204). The live sweep must
  // not inherit that blind spot.
  it('flags a SECURITY INVOKER function, not just SECURITY DEFINER', () => {
    const v = classifyVerdict({
      live: [row('treasury.detect_forked_entities()', { secdef: false })],
      baseline: [],
    });

    expect(v.ok).toBe(false);
    expect(v.newExposures).toEqual(['treasury.detect_forked_entities()']);
  });

  it('flags an authenticated-only exposure', () => {
    const v = classifyVerdict({
      live: [row('public.some_fn()', { anon_exec: false, authed_exec: true })],
      baseline: [],
    });

    expect(v.ok).toBe(false);
    expect(v.newExposures).toEqual(['public.some_fn()']);
  });
});

describe('surfaceVerdict — what the orchestrator acts on', () => {
  const now = new Date('2026-09-21T12:00:00Z');
  const freshOk = { ok: true, detail: 'unchanged', ran_at: '2026-09-21T06:00:00Z' };

  it('passes a fresh OK verdict', () => {
    expect(surfaceVerdict(freshOk, now).ok).toBe(true);
  });

  it('fails a fresh non-OK verdict and carries its detail through', () => {
    const s = surfaceVerdict({ ok: false, detail: 'NEW EXPOSURE: public.x()', ran_at: '2026-09-21T06:00:00Z' }, now);

    expect(s.ok).toBe(false);
    expect(s.detail).toContain('NEW EXPOSURE');
  });

  // ⚠⚠ THE RULE THE FROZEN INVARIANT LACKED. A sweep that stopped running must
  // not read as clean; absence of a failure is not health.
  it('fails an OK verdict that is older than STALE_CYCLES cycles', () => {
    const staleAt = new Date(now.getTime() - (CYCLE_DAYS * STALE_CYCLES + 1) * 86400e3).toISOString();

    const s = surfaceVerdict({ ok: true, detail: 'unchanged', ran_at: staleAt }, now);

    expect(s.ok).toBe(false);
    expect(s.detail).toContain('STALE');
  });

  it('still passes an OK verdict just inside the stale window', () => {
    const freshEnough = new Date(now.getTime() - (CYCLE_DAYS * STALE_CYCLES - 1) * 86400e3).toISOString();

    expect(surfaceVerdict({ ok: true, detail: 'unchanged', ran_at: freshEnough }, now).ok).toBe(true);
  });

  it('treats a missing verdict as INCONCLUSIVE rather than a pass', () => {
    const s = surfaceVerdict(null, now);

    expect(s.ok).toBe(false);
    expect(s.detail).toContain('INCONCLUSIVE');
  });
});

// ⚠⚠ The staleness threshold is declared TWICE: here (Node, for the manual
// runner and these tests) and in the Deno Edge Function, which cannot import a
// Node module. Two declarations that must agree is exactly the shape that
// drifts — see the entity_type union, where five declarations must agree. This
// asserts they still do, so a change to one is a failing build, not a silent
// hole in the daily check.
describe('the Edge Function staleness threshold matches this module', () => {
  it('declares VERDICT_STALE_AFTER_DAYS equal to CYCLE_DAYS * STALE_CYCLES', () => {
    const src = readFileSync(
      new URL('../supabase/functions/treasury-sync-orchestrator/index.ts', import.meta.url),
      'utf8',
    );
    const m = src.match(/const\s+VERDICT_STALE_AFTER_DAYS\s*=\s*(\d+)/);

    expect(m, 'VERDICT_STALE_AFTER_DAYS not found in treasury-sync-orchestrator/index.ts').not.toBeNull();
    expect(Number(m[1])).toBe(CYCLE_DAYS * STALE_CYCLES);
  });
});

describe('baseline discipline', () => {
  it('rejects a baseline entry with no reason', () => {
    expect(() => assertBaselineHasReasons([{ signature: 'public.x()', reason: '   ' }])).toThrow(/reason/i);
  });

  it('accepts a baseline whose every entry carries a reason', () => {
    expect(() => assertBaselineHasReasons([accepted('public.x()')])).not.toThrow();
  });
});
