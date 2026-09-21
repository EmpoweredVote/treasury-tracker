/**
 * Tests for resolveEntityParamViaLookup — the slug-lookup twin of
 * resolveEntityParam, used where a page needs ONE entity and must not download
 * all 8,149 to find it.
 *
 * ⚠⚠ THESE EXIST BECAUSE THE TWO RESOLVERS MUST AGREE. Both decide which
 * government a reader lands on, and a divergence would not throw — the link
 * would just resolve differently depending on which host opened it, which is
 * the quiet version of the Bloomington failure (an unmatched slug rendering a
 * real budget for the wrong place).
 *
 * The parity block at the bottom asserts that agreement directly rather than
 * trusting the two implementations to be read side by side.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Municipality } from '../types/budget';
import { resolveEntityParam, resolveEntityParamViaLookup, toSlug } from './entityRouting';
import type { EntityAlias } from './entityRouting';

const muni = (name: string, state: string, entity_type: Municipality['entity_type'] = 'city'): Municipality =>
  ({ id: `${name}-${state}`, name, state, entity_type, population: 1 }) as Municipality;

// Bloomington IN first, so a regression to the old hardcoded fallback or to
// `list[0]` is caught by the same assertions as the original suite.
const list: Municipality[] = [
  muni('Bloomington', 'IN'),
  muni('Monroe County', 'IN', 'county'),
  muni('Empowered Vote', 'CA', 'nonprofit' as Municipality['entity_type']),
  muni('Birchwood Village', 'MN'),
  muni('San Francisco', 'CA'),
];

/** A server that filters the list by slug — what `?slug=` does. */
const lookup = (l: Municipality[] = list) =>
  vi.fn(async (slug: string) => l.filter(m => toSlug(m) === slug));

const alias = (slug: string, canonicalSlug: string, label = 'Old Name'): EntityAlias => ({
  slug,
  label,
  canonicalSlug,
  canonicalLabel: 'New Name',
});

/** Resolve through the lookup path, fetching the requested slug first. */
async function viaLookup(
  entityParam: string,
  aliases: EntityAlias[] = [],
  l: Municipality[] = list
) {
  const fetcher = lookup(l);
  const requested = await fetcher(entityParam);
  return { r: await resolveEntityParamViaLookup(requested, entityParam, aliases, fetcher), fetcher };
}

describe('resolveEntityParamViaLookup — matching', () => {
  it('matches a slug to its entity', async () => {
    const { r } = await viaLookup('san-francisco-ca');
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') expect(r.entity.name).toBe('San Francisco');
  });

  it('matches the nonprofit the financials host addresses', async () => {
    const { r } = await viaLookup('empowered-vote-ca');
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') expect(r.entity.name).toBe('Empowered Vote');
  });

  it('does not fetch a second time on the happy path', async () => {
    const { fetcher } = await viaLookup('san-francisco-ca');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('resolveEntityParamViaLookup — refusing to substitute', () => {
  it('resolves an unknown slug to not_found, never to another entity', async () => {
    const { r } = await viaLookup('nowhere-zz');
    expect(r.kind).toBe('not_found');
    if (r.kind === 'not_found') expect(r.slug).toBe('nowhere-zz');
  });

  it('never falls back to Bloomington or to the first row', async () => {
    const { r } = await viaLookup('renamed-city-ca');
    expect(r.kind).toBe('not_found');
  });

  it('resolves an empty param to not_found', async () => {
    const { r } = await viaLookup('');
    expect(r.kind).toBe('not_found');
  });

  it('treats a dangling alias as not_found — the target is not published', async () => {
    const { r } = await viaLookup('gone-mn', [alias('gone-mn', 'also-gone-mn')]);
    expect(r.kind).toBe('not_found');
  });
});

describe('resolveEntityParamViaLookup — aliases', () => {
  it('resolves a retired slug through its alias, and reports it as aliased', async () => {
    const { r } = await viaLookup('birchwood-mn', [
      alias('birchwood-mn', 'birchwood-village-mn', 'Birchwood'),
    ]);
    expect(r.kind).toBe('aliased');
    if (r.kind === 'aliased') {
      expect(r.entity.name).toBe('Birchwood Village');
      expect(r.requestedSlug).toBe('birchwood-mn');
      expect(r.canonicalSlug).toBe('birchwood-village-mn');
      expect(r.requestedLabel).toBe('Birchwood');
    }
  });

  it('pays the second lookup ONLY on the alias path', async () => {
    const fetcher = lookup();
    const requested = await fetcher('birchwood-mn');
    await resolveEntityParamViaLookup(
      requested,
      'birchwood-mn',
      [alias('birchwood-mn', 'birchwood-village-mn')],
      fetcher
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('A LIVE ENTITY ALWAYS WINS over an alias claiming its slug', async () => {
    // A stale alias row must never shadow a currently-published government.
    const { r, fetcher } = await viaLookup('san-francisco-ca', [
      alias('san-francisco-ca', 'bloomington-in'),
    ]);
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') expect(r.entity.name).toBe('San Francisco');
    // and it short-circuits before the alias lookup
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('REFUSES when two aliases claim one slug for different targets', async () => {
    // A contradiction in the data is resolved by refusing, never by picking.
    const { r } = await viaLookup('ambiguous-mn', [
      alias('ambiguous-mn', 'birchwood-village-mn'),
      alias('ambiguous-mn', 'san-francisco-ca'),
    ]);
    expect(r.kind).toBe('not_found');
  });

  it('ignores a self-alias', async () => {
    const { r } = await viaLookup('nowhere-zz', [alias('nowhere-zz', 'nowhere-zz')]);
    expect(r.kind).toBe('not_found');
  });
});

describe('resolveEntityParamViaLookup — a drifting server slug cannot mis-resolve', () => {
  it('rejects a row whose own slug is not the one asked for', async () => {
    // Simulates the server filter disagreeing with toSlug. The row is returned
    // but re-derived here, so drift surfaces as not_found — the honest answer —
    // rather than as the wrong entity on the page.
    const wrongRow = vi.fn(async () => [muni('Bloomington', 'IN')]);
    const r = await resolveEntityParamViaLookup(
      await wrongRow(),
      'san-francisco-ca',
      [],
      wrongRow
    );
    expect(r.kind).toBe('not_found');
  });
});

describe('PARITY — the two resolvers agree', () => {
  const aliases = [
    alias('birchwood-mn', 'birchwood-village-mn', 'Birchwood'),
    alias('ambiguous-mn', 'birchwood-village-mn'),
    alias('ambiguous-mn', 'san-francisco-ca'),
    alias('gone-mn', 'also-gone-mn'),
    alias('self-mn', 'self-mn'),
  ];

  const slugs = [
    'san-francisco-ca',
    'bloomington-in',
    'monroe-county-in',
    'empowered-vote-ca',
    'birchwood-village-mn',
    'birchwood-mn', // aliased
    'ambiguous-mn', // contradictory aliases
    'gone-mn', // dangling alias
    'self-mn', // self-alias
    'nowhere-zz', // unknown
    '', // empty
  ];

  it.each(slugs)('resolves %j identically to resolveEntityParam', async (slug) => {
    const fromList = resolveEntityParam(list, slug, aliases);
    const { r: fromLookup } = await viaLookup(slug, aliases);

    expect(fromLookup.kind).toBe(fromList.kind);
    if (fromList.kind === 'matched' && fromLookup.kind === 'matched') {
      expect(fromLookup.entity.id).toBe(fromList.entity.id);
    }
    if (fromList.kind === 'aliased' && fromLookup.kind === 'aliased') {
      expect(fromLookup.entity.id).toBe(fromList.entity.id);
      expect(fromLookup.canonicalSlug).toBe(fromList.canonicalSlug);
      expect(fromLookup.requestedSlug).toBe(fromList.requestedSlug);
      expect(fromLookup.requestedLabel).toBe(fromList.requestedLabel);
    }
    if (fromList.kind === 'not_found' && fromLookup.kind === 'not_found') {
      expect(fromLookup.slug).toBe(fromList.slug);
    }
  });
});
