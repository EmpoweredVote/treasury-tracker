/**
 * The never-overwrite guard must key on what the RPC keys on — no more, no less.
 *
 * ⚠⚠ THE DEFECT THIS FIXES. The guard looked up
 *     (municipality_id, fiscal_year, dataset_type)
 * while `treasury_sync_city_budget` matches on
 *     (municipality_id, fiscal_year, dataset_type, fund_scope, basis)
 * — read from the function body on 2026-09-12, not from a comment. A guard whose
 * key is NARROWER than the writer's refuses writes that would never have
 * collided. The FY2012-FY2024 sweep lost 173 rows to it:
 *
 *     Bloomington        21   its rows are fund_scope/basis = unknown/unknown
 *     14 GAAP counties  152   their ACFR rows are total_governmental
 *
 * Neither shares a key with a Gateway all_funds/actual row, and the proof is
 * already in the table: Allen, Marion and Lake carry BOTH series today.
 *
 * ⚠ AND THE LOOKUP WAS `.limit(1)` WITH NO `ORDER BY`, over a set that can hold
 * more than one row — so which row it saw was formally undefined. Allen, Marion
 * and Lake were written only because it happened to return their Gateway row.
 * Fifth occurrence of the unordered-read family. The fix takes ALL matching rows
 * and refuses on ambiguity, mirroring the RPC's own `v_matches > 1` guard.
 */
import { describe, it, expect } from 'vitest';

import { blockingRow } from '../scripts/lib/inGateway.mjs';

const PREFIX = 'Indiana Gateway Annual Financial Report';
const ours = (fy = 2020) => ({
  id: 'a',
  data_source: `${PREFIX} — Revenue by Source (FY${fy} actual, unaudited, all funds excl. settlement and payroll clearing)`,
});
const theirs = (src) => ({ id: 'b', data_source: src });

describe('blockingRow', () => {
  it('does not block when nothing exists at the key', () => {
    expect(blockingRow([], PREFIX)).toBeNull();
    expect(blockingRow(undefined, PREFIX)).toBeNull();
  });

  it('does not block our own row — that is the update case', () => {
    expect(blockingRow([ours()], PREFIX)).toBeNull();
  });

  it('blocks another publisher at the SAME key', () => {
    // The case the guard exists for: same municipality, year, dataset, scope and
    // basis, different publisher. The RPC would overwrite the totals and leave
    // the old data_source in place.
    const row = theirs('bloomington-open-data');
    expect(blockingRow([row], PREFIX)).toBe(row);
  });

  it('treats a null or empty data_source as another publisher, not as ours', () => {
    expect(blockingRow([{ id: 'c', data_source: null }], PREFIX)).toBeTruthy();
    expect(blockingRow([{ id: 'c', data_source: '' }], PREFIX)).toBeTruthy();
  });

  it('REFUSES on ambiguity rather than picking one', () => {
    // ⚠ The old code took `.limit(1)` with no ORDER BY here and acted on
    // whichever row came back. The RPC itself refuses this case, so the loader
    // must not paper over it.
    expect(() => blockingRow([ours(), theirs('bloomington-open-data')], PREFIX))
      .toThrow(/ambiguous/i);
  });

  it('refuses ambiguity even when both rows are ours', () => {
    // Two rows at one RPC key is a corrupt table regardless of who wrote them.
    expect(() => blockingRow([ours(2020), { ...ours(2020), id: 'z' }], PREFIX))
      .toThrow(/ambiguous/i);
  });
});
