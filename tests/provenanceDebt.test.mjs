/**
 * The provenance ratchet.
 *
 * ⚠⚠ The gate grandfathers families already in the database, so standing debt
 * exists by design — 3,963 unregistered families (54,914 rows) and 24,947
 * rows with no link, measured 2026-11-02. Debt nobody counts is debt that
 * grows, so this holds it flat: worse fails, equal passes, better passes and
 * says so.
 */

import { describe, it, expect } from 'vitest';
import { summarizeProvenanceDebt, toBaseline } from '../scripts/lib/provenanceDebt.mjs';

const row = (name, rows, linkless, unregistered) =>
  ({ data_source: name, rows, linkless, unregistered });

const BASE = { sources: { Alpha: { unregisteredRows: 10, linkless: 4 } } };

describe('summarizeProvenanceDebt', () => {
  it('passes a source that matches its baseline exactly', () => {
    const r = summarizeProvenanceDebt([row('Alpha', 10, 4, true)], BASE);
    expect(r.ok).toBe(true);
    expect(r.worse).toEqual([]);
  });

  it('fails a source with more unregistered rows than its baseline', () => {
    const r = summarizeProvenanceDebt([row('Alpha', 11, 4, true)], BASE);
    expect(r.ok).toBe(false);
    expect(r.worse[0].name).toBe('Alpha');
  });

  it('fails a source with more linkless rows than its baseline', () => {
    const r = summarizeProvenanceDebt([row('Alpha', 10, 5, true)], BASE);
    expect(r.ok).toBe(false);
    expect(r.worse[0].linkless).toBe(5);
  });

  it('passes and reports an improvement', () => {
    const r = summarizeProvenanceDebt([row('Alpha', 10, 0, true)], BASE);
    expect(r.ok).toBe(true);
    expect(r.better[0].wasLinkless).toBe(4);
  });

  it('passes a source that became fully registered', () => {
    const r = summarizeProvenanceDebt([row('Alpha', 10, 0, false)], BASE);
    expect(r.ok).toBe(true);
    expect(r.better[0].unregisteredRows).toBe(0);
  });

  // ⚠⚠ A NEW SOURCE ARRIVING WITH DEBT MUST FAIL. This is the whole point of
  // the ratchet existing alongside the gate: the gate grandfathers by family,
  // so a family that slips in some other way — a direct SQL insert, a
  // migration, a loader run before the gate shipped — would otherwise raise
  // the total with nothing complaining.
  it('fails a source the baseline has never seen that arrives WITH debt', () => {
    const r = summarizeProvenanceDebt([row('Newcomer', 7, 0, true)], BASE);
    expect(r.ok).toBe(false);
    expect(r.added[0].name).toBe('Newcomer');
  });

  // ⚠ But a clean new source is the normal case and must not fail, or every
  // ordinary load turns the gate red and people learn to ignore it.
  it('passes a clean new source', () => {
    const r = summarizeProvenanceDebt([row('Newcomer', 7, 0, false)], BASE);
    expect(r.ok).toBe(true);
    expect(r.added).toEqual([]);
  });

  it('totals across every source, not just the failing ones', () => {
    const r = summarizeProvenanceDebt(
      [row('Alpha', 10, 4, true), row('Beta', 90, 1, false)], BASE,
    );
    expect(r.totals).toEqual({ rows: 100, unregisteredRows: 10, linkless: 5 });
  });

  it('treats a missing baseline as empty rather than throwing', () => {
    expect(() => summarizeProvenanceDebt([row('Alpha', 1, 0, false)], null)).not.toThrow();
    expect(summarizeProvenanceDebt(null, BASE).ok).toBe(true);
  });
});

describe('toBaseline', () => {
  it('records only sources that carry debt', () => {
    const b = toBaseline([row('Alpha', 10, 4, true), row('Clean', 5, 0, false)]);
    expect(Object.keys(b.sources)).toEqual(['Alpha']);
    expect(b.sources.Alpha).toEqual({ unregisteredRows: 10, linkless: 4 });
  });

  it('round-trips: a measurement checked against its own baseline passes', () => {
    const measured = [row('Alpha', 10, 4, true), row('Beta', 3, 2, false)];
    expect(summarizeProvenanceDebt(measured, toBaseline(measured)).ok).toBe(true);
  });
});
