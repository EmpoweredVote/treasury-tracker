import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paginate } from '../scripts/lib/listAllSources.mjs';

/**
 * The paging core, tested without a database.
 *
 * ⚠ Why this is worth testing at all: the bug being replaced was not a crash, it was
 * a SHORT ANSWER that looked complete. `treasury_list_source_ids()` returned exactly
 * 1,000 of 1,811 rows with no error, and every caller believed it. A replacement that
 * pages has its own version of that failure — an off-by-one at the page boundary
 * silently drops or duplicates rows — so the boundaries get explicit cases.
 */

/** Build a fetcher over a fixed array, honouring inclusive [from, to] like PostgREST. */
function fetcherOver(rows, { cap = Infinity } = {}) {
  const calls = [];
  const fn = async (from, to) => {
    calls.push([from, to]);
    const size = Math.min(to - from + 1, cap);
    return rows.slice(from, from + size);
  };
  fn.calls = calls;
  return fn;
}

describe('paginate', () => {
  it('returns everything when the set is larger than one page', () => {
    const rows = Array.from({ length: 1811 }, (_, i) => ({ i }));
    return paginate(fetcherOver(rows), 500).then((out) => {
      expect(out).toHaveLength(1811);
      expect(out[0]).toEqual({ i: 0 });
      expect(out[1810]).toEqual({ i: 1810 });
    });
  });

  it('preserves order across page boundaries', async () => {
    const rows = Array.from({ length: 1201 }, (_, i) => ({ i }));
    const out = await paginate(fetcherOver(rows), 500);
    expect(out.map((r) => r.i)).toEqual(rows.map((r) => r.i));
  });

  it('drops nothing and duplicates nothing when the total is an exact multiple', async () => {
    // The classic off-by-one: a full final page must trigger one more request that
    // comes back empty, not an early exit that loses the last page.
    const rows = Array.from({ length: 1000 }, (_, i) => ({ i }));
    const f = fetcherOver(rows);
    const out = await paginate(f, 500);
    expect(out).toHaveLength(1000);
    expect(new Set(out.map((r) => r.i)).size).toBe(1000);
    expect(f.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it('requests inclusive ranges, the way PostgREST does', async () => {
    const f = fetcherOver(Array.from({ length: 10 }, (_, i) => ({ i })));
    await paginate(f, 4);
    expect(f.calls[0]).toEqual([0, 3]);
    expect(f.calls[1]).toEqual([4, 7]);
  });

  it('handles an empty table', async () => {
    const out = await paginate(fetcherOver([]), 500);
    expect(out).toEqual([]);
  });

  it('handles a set smaller than one page', async () => {
    const out = await paginate(fetcherOver([{ i: 1 }, { i: 2 }]), 500);
    expect(out).toHaveLength(2);
  });

  // ⚠ The failure mode that matters: a backend that ignores the range and keeps
  // returning a full page forever would spin without this stop.
  it('refuses to loop forever when the range is ignored', async () => {
    const always = async () => Array.from({ length: 500 }, (_, i) => ({ i }));
    await expect(paginate(always, 500, 2000)).rejects.toThrow(/refusing to continue past/);
  });

  it('rejects a nonsense page size rather than looping', async () => {
    await expect(paginate(async () => [], 0)).rejects.toThrow(/positive integer/);
    await expect(paginate(async () => [], -1)).rejects.toThrow(/positive integer/);
  });

  it('rejects a fetcher that does not return an array', async () => {
    await expect(paginate(async () => null, 10)).rejects.toThrow(/must resolve to an array/);
  });

  // The regression this whole module exists for.
  it('does NOT stop at 1000 rows, which is the PostgREST cap that caused the bug', async () => {
    const rows = Array.from({ length: 1811 }, (_, i) => ({ i }));
    // Simulate PostgREST: it will never return more than 1000 rows in one response,
    // so a caller asking for everything in one shot gets silently truncated.
    const capped = fetcherOver(rows, { cap: 1000 });
    const out = await paginate(capped, 500);
    expect(out).toHaveLength(1811);
    expect(out.length).toBeGreaterThan(1000);
  });
});

/**
 * ⚠ The capped RPC must not creep back. `treasury_list_source_ids()` returns 1,811
 * rows and PostgREST truncates the response at 1,000 with no error — the failure that
 * hid San Francisco from cron for three months (PR #85) and left two loaders unable to
 * find their own sources (PR #91). 28 call sites were migrated off it; this fails the
 * build if a new one appears.
 *
 * The four loaders that call `treasury_list_sources(p_api_type, p_dataset_types)` are
 * fine and unaffected: that one filters SERVER-side to a set that fits.
 */
describe('nothing calls the capped treasury_list_source_ids RPC', () => {
  const files = readdirSync('scripts', { withFileTypes: true })
    .filter((e) => e.isFile() && (e.name.endsWith('.js') || e.name.endsWith('.mjs')))
    .map((e) => join('scripts', e.name).split('\\').join('/'));

  it('scans the loader scripts (control: the scan must not match nothing)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no live capped-RPC call anywhere in scripts/', () => {
    const offenders = files.filter((f) =>
      /\.rpc\(\s*['"`]treasury_list_source_ids['"`]\s*\)/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('still recognises the call shape it is looking for', () => {
    // A gate nobody has watched fail is not a gate.
    const shape = /\.rpc\(\s*['"`]treasury_list_source_ids['"`]\s*\)/;
    expect(shape.test("await supabase.rpc('treasury_list_source_ids');")).toBe(true);
    expect(shape.test('await client.rpc("treasury_list_source_ids")')).toBe(true);
    // ...and does not flag the safe, server-filtered function.
    expect(shape.test("await supabase.rpc('treasury_list_sources', { p_api_type: 'socrata' })")).toBe(false);
  });
});
