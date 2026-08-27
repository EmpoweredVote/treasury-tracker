import { describe, it, expect } from 'vitest';
import { classifySyncHealth, isUnhealthy, summarise, FREQ_DAYS, STALE_CYCLES }
  from '../scripts/lib/syncHealth.mjs';

// Fixed clock — Date.now() in a test makes the result depend on when it runs.
const NOW = new Date('2026-08-27T00:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const src = (over = {}) => ({
  name: 'Test Source',
  sync_frequency: 'monthly',
  sync_status: 'idle',
  last_error: null,
  last_synced_at: daysAgo(1),
  is_enabled: true,
  ...over,
});

describe('classifySyncHealth', () => {
  it('calls a freshly-synced source ok', () => {
    expect(classifySyncHealth(src(), null, NOW).verdict).toBe('ok');
  });

  it('reports an explicit error, and it outranks staleness', () => {
    const r = classifySyncHealth(
      src({ sync_status: 'error', last_error: 'Refusing to write a $0 budget', last_synced_at: daysAgo(400) }),
      null, NOW);
    expect(r.verdict).toBe('error');
    expect(r.reason).toContain('Refusing to write a $0 budget');
  });

  it('picks up an error that is only on the latest log', () => {
    const r = classifySyncHealth(src(), { status: 'error', error_message: 'Socrata 400' }, NOW);
    expect(r.verdict).toBe('error');
    expect(r.reason).toContain('Socrata 400');
  });

  it('flags a source that has never synced', () => {
    expect(classifySyncHealth(src({ last_synced_at: null }), null, NOW).verdict).toBe('never_synced');
  });

  it('treats a disabled source as its own verdict, not a failure', () => {
    const r = classifySyncHealth(src({ is_enabled: false, last_synced_at: null }), null, NOW);
    expect(r.verdict).toBe('disabled');
    expect(isUnhealthy(r.verdict)).toBe(false);
  });

  // ── The defect this module exists for ──
  it('flags the San Francisco shape: idle, no error, ancient last_synced_at', () => {
    // SF: 'monthly', last synced 2026-05-23, checked 2026-08-27 = 96 days.
    const r = classifySyncHealth(
      src({ name: 'San Francisco Operating Budget', sync_frequency: 'monthly', last_synced_at: daysAgo(96) }),
      null, NOW);
    expect(r.verdict).toBe('stale');
    expect(isUnhealthy(r.verdict)).toBe(true);
    expect(r.reason).toContain('96d ago');
    expect(r.reason).toContain('monthly');
  });

  it('absence of an error is NOT health', () => {
    const s = src({ sync_status: 'idle', last_error: null, last_synced_at: daysAgo(365) });
    // Every field a human would eyeball says fine:
    expect(s.sync_status).toBe('idle');
    expect(s.last_error).toBeNull();
    // ...and the classifier still refuses to call it ok.
    expect(classifySyncHealth(s, null, NOW).verdict).toBe('stale');
  });

  it('allows slack of STALE_CYCLES before calling a source stale', () => {
    const cycle = FREQ_DAYS.monthly;
    const justInside = classifySyncHealth(src({ last_synced_at: daysAgo(cycle * STALE_CYCLES - 1) }), null, NOW);
    const justOutside = classifySyncHealth(src({ last_synced_at: daysAgo(cycle * STALE_CYCLES + 1) }), null, NOW);
    expect(justInside.verdict).toBe('ok');
    expect(justOutside.verdict).toBe('stale');
  });

  it('never marks a manual source stale on a clock', () => {
    const r = classifySyncHealth(src({ sync_frequency: 'manual', last_synced_at: daysAgo(3000) }), null, NOW);
    expect(r.verdict).toBe('ok');
  });

  it('surfaces an empty fetch without calling the source broken', () => {
    const r = classifySyncHealth(src(), { status: 'empty', error_message: "Fetched 0 rows for FY1999. Filter: {\"$where\":\"bfy='1999'\"}" }, NOW);
    expect(r.verdict).toBe('empty');
    expect(isUnhealthy(r.verdict)).toBe(false);
    expect(r.reason).toContain('FY1999');
  });

  it('falls back to the monthly cycle for an unrecognised frequency', () => {
    const r = classifySyncHealth(src({ sync_frequency: 'fortnightly', last_synced_at: daysAgo(200) }), null, NOW);
    expect(r.verdict).toBe('stale');
  });
});

describe('summarise', () => {
  it('counts verdicts and unhealthy sources', () => {
    const s = summarise([
      { verdict: 'ok' }, { verdict: 'ok' }, { verdict: 'stale' },
      { verdict: 'error' }, { verdict: 'empty' }, { verdict: 'disabled' },
    ]);
    expect(s.total).toBe(6);
    expect(s.byVerdict.ok).toBe(2);
    expect(s.unhealthy).toBe(2); // stale + error; empty and disabled are not failures
  });
});
