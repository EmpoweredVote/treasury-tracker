/**
 * The one door a loader uses to turn a published name into a TT entity id, and
 * the check that proves the load did not fork a city on the way.
 *
 * ⚠⚠ THE DEFECT THESE GUARD AGAINST does not fail anything. When a publisher
 * renames a city, the name lookup misses, a SECOND entity is created, and the
 * city's history is severed at that year — while both halves carry honest data,
 * every total ties, and each half looks complete. It has happened twice, both
 * from MN OSA.
 *
 * These are pure unit tests against a fake `db`, because CI runs no database.
 * The database-level proof lives in the migrations' self-verification blocks.
 */

import { describe, it, expect } from 'vitest';
import { ensureMunicipality, assertNoNewForks } from '../scripts/lib/ensureMunicipality.mjs';

/** Minimal fake of the supabase client's `.rpc()` surface. */
const fakeDb = (impl) => ({ rpc: async (fn, args) => impl(fn, args) });

describe('ensureMunicipality', () => {
  it('returns the id the RPC resolves', async () => {
    const db = fakeDb(async () => ({ data: 'aaaaaaaa-0000-0000-0000-000000000001', error: null }));
    const out = await ensureMunicipality(db, { name: 'Napa', state: 'CA', entityType: 'city' });
    expect(out).toEqual({ id: 'aaaaaaaa-0000-0000-0000-000000000001' });
  });

  it('throws on a real error, so a broken load fails loudly', async () => {
    const db = fakeDb(async () => ({ data: null, error: { message: 'connection reset' } }));
    await expect(
      ensureMunicipality(db, { name: 'Napa', state: 'CA', entityType: 'city' }),
    ).rejects.toThrow(/connection reset/);
  });

  it('throws when the RPC returns no id at all', async () => {
    // ⚠ A null id used to flow onward and violate a NOT NULL FK somewhere far
    // from the cause. Fail here, where the entity name is still in hand.
    const db = fakeDb(async () => ({ data: null, error: null }));
    await expect(
      ensureMunicipality(db, { name: 'Napa', state: 'CA', entityType: 'city' }),
    ).rejects.toThrow(/no id/i);
  });

  it('names the entity in its errors', async () => {
    const db = fakeDb(async () => ({ data: null, error: { message: 'boom' } }));
    await expect(
      ensureMunicipality(db, { name: 'Birchwood', state: 'MN', entityType: 'city' }),
    ).rejects.toThrow(/Birchwood.*MN/);
  });

  it('defaults entity_type to city and population to 0', async () => {
    let seen = null;
    const db = fakeDb(async (_fn, args) => { seen = args; return { data: 'id', error: null }; });
    await ensureMunicipality(db, { name: 'Anytown', state: 'MN' });
    expect(seen.p_entity_type).toBe('city');
    expect(seen.p_population).toBe(0);
  });

  it('passes the publisher key through when given', async () => {
    let seen = null;
    const db = fakeDb(async (_fn, args) => { seen = args; return { data: 'id', error: null }; });
    await ensureMunicipality(db, {
      name: 'Anytown', state: 'MN', entityType: 'city',
      source: 'MN OSA', sourceEntityKey: '12345',
    });
    expect(seen.p_source).toBe('MN OSA');
    expect(seen.p_source_entity_key).toBe('12345');
  });
});

describe('assertNoNewForks', () => {
  it('passes when the detector returns nothing', async () => {
    const db = fakeDb(async () => ({ data: [], error: null }));
    await expect(assertNoNewForks(db)).resolves.toBeUndefined();
  });

  it('throws and names both halves when a fork appears', async () => {
    const db = fakeDb(async () => ({
      data: [{
        state: 'MN', name_a: 'Birchwood', years_a: '2012-2020',
        name_b: 'Birchwood Village', years_b: '2021-2023',
      }],
      error: null,
    }));
    await expect(assertNoNewForks(db)).rejects.toThrow(/Birchwood[\s\S]*Birchwood Village/);
  });

  it('reports every pair, not just the first', async () => {
    const db = fakeDb(async () => ({
      data: [
        { state: 'MN', name_a: 'A', years_a: '2012-2020', name_b: 'A Village', years_b: '2021-2023' },
        { state: 'PA', name_a: 'B', years_a: '2014-2019', name_b: 'B Borough', years_b: '2020-2023' },
      ],
      error: null,
    }));
    await expect(assertNoNewForks(db)).rejects.toThrow(/A Village[\s\S]*B Borough/);
  });

  it('fails loudly when the check itself cannot run', async () => {
    // ⚠ A check that silently does not run is worse than no check: it reports
    // health it never measured.
    const db = fakeDb(async () => ({ data: null, error: { message: 'permission denied' } }));
    await expect(assertNoNewForks(db)).rejects.toThrow(/fork check failed to run.*permission denied/);
  });
});
