/**
 * Tests for entityRouting.ts — what a `?entity=<slug>` param resolves to.
 *
 * The regression these lock down: an unrecognised slug used to resolve to
 * `list.find(m => m.name === 'Bloomington' && m.state === 'IN') ?? list[0]`,
 * so TT silently rendered Bloomington, Indiana's budget with nothing on the
 * page saying the requested entity was not found. Because the slug derives
 * from `name`, renaming any entity invalidated every link ever shared to it,
 * and each one landed on Bloomington.
 *
 * A real budget for the wrong place is worse than no budget, so an unmatched
 * slug must resolve to 'not_found' — never to a neighbouring entity.
 */

import { describe, it, expect } from 'vitest';
import type { Municipality } from '../types/budget';
import { resolveEntityParam, displaySlug, displayLabel } from './entityRouting';
import type { EntityAlias } from './entityRouting';

const muni = (name: string, state: string, entity_type: Municipality['entity_type'] = 'city'): Municipality =>
  ({ id: `${name}-${state}`, name, state, entity_type, population: 1 }) as Municipality;

// Bloomington IN first in the list, so a regression to either the old
// hardcoded fallback OR to `list[0]` is caught by the same assertion.
const list: Municipality[] = [
  muni('Bloomington', 'IN'),
  muni('Monroe County', 'IN', 'county'),
  muni('Indiana', 'IN', 'state'),
  muni('San Francisco', 'CA'),
];

describe('resolveEntityParam — matching', () => {
  it('matches a city slug to its entity', () => {
    const r = resolveEntityParam(list, 'san-francisco-ca');
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') expect(r.entity.name).toBe('San Francisco');
  });

  it('matches a multi-word entity whose slug hyphenates', () => {
    const r = resolveEntityParam(list, 'monroe-county-in');
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') expect(r.entity.name).toBe('Monroe County');
  });

  it('matches Bloomington when Bloomington is genuinely what was asked for', () => {
    const r = resolveEntityParam(list, 'bloomington-in');
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') expect(r.entity.name).toBe('Bloomington');
  });
});

describe('resolveEntityParam — the Bloomington regression', () => {
  it('does NOT fall back to Bloomington for an unknown slug', () => {
    const r = resolveEntityParam(list, 'definitely-not-a-real-place-zz');
    expect(r.kind).toBe('not_found');
    expect(JSON.stringify(r)).not.toContain('Bloomington');
  });

  it('does NOT fall back to the first list entry for an unknown slug', () => {
    const r = resolveEntityParam(list, 'nowhere-xx');
    expect(r.kind).toBe('not_found');
  });

  it('reports the slug that was asked for, so the page can name it', () => {
    const r = resolveEntityParam(list, 'nowhere-xx');
    if (r.kind === 'not_found') expect(r.slug).toBe('nowhere-xx');
  });

  it('treats a renamed entity as not found rather than as a neighbour', () => {
    // The live failure mode: slug derives from `name`, so a rename invalidates
    // every shared link. Those links must not land on someone else's budget.
    const r = resolveEntityParam(list, 'sanfrancisco-ca');
    expect(r.kind).toBe('not_found');
  });

  it('is not_found against an empty list rather than crashing', () => {
    const r = resolveEntityParam([], 'anything-xx');
    expect(r.kind).toBe('not_found');
  });

  it('is not_found for an empty slug', () => {
    expect(resolveEntityParam(list, '').kind).toBe('not_found');
  });
});

describe('displaySlug — the slug is untrusted URL input', () => {
  it('passes a normal slug through unchanged', () => {
    expect(displaySlug('monroe-county-in')).toBe('monroe-county-in');
  });

  it('truncates an absurdly long slug so it cannot blow out the layout', () => {
    const out = displaySlug('x'.repeat(500));
    expect(out.length).toBeLessThanOrEqual(64);
    expect(out.endsWith('…')).toBe(true);
  });

  it('strips control characters', () => {
    expect(displaySlug('mon\u0000roe\ncounty')).toBe('monroecounty');
  });
});

// ── Aliases ─────────────────────────────────────────────────────────────────
//
// A publisher rename forks or renames an entity, and every link ever shared to
// the old slug dies. `birchwood-mn` became `birchwood-village-mn` when the MN
// OSA renamed the city between its FY2020 and FY2021 filings (TT PR #185).
//
// An alias is an EXACT RECORDED IDENTITY, not a name guess, which is the only
// reason resolving one does not reintroduce the Bloomington failure. Every
// rule below exists to keep that distinction true.

// Aliases arrive already slugged, from the same SQL expression that builds
// `slug` in the coverage catalog — so this helper slugs its inputs the way the
// API does, rather than the resolver doing it.
const alias = (aliasName: string, state: string, canonicalName: string): EntityAlias => ({
  slug: `${aliasName.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`,
  label: aliasName,
  canonicalSlug: `${canonicalName.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`,
  canonicalLabel: canonicalName,
});

const aliasList: Municipality[] = [
  muni('Bloomington', 'IN'),
  muni('Birchwood Village', 'MN'),
  muni('San Francisco', 'CA'),
];

const aliases: EntityAlias[] = [alias('Birchwood', 'MN', 'Birchwood Village')];

describe('resolveEntityParam — aliases', () => {
  it('resolves a retired slug to the current entity', () => {
    const r = resolveEntityParam(aliasList, 'birchwood-mn', aliases);
    expect(r.kind).toBe('aliased');
    if (r.kind === 'aliased') {
      expect(r.entity.name).toBe('Birchwood Village');
      expect(r.requestedSlug).toBe('birchwood-mn');
      expect(r.canonicalSlug).toBe('birchwood-village-mn');
    }
  });

  it('still matches the canonical slug directly, as `matched` not `aliased`', () => {
    const r = resolveEntityParam(aliasList, 'birchwood-village-mn', aliases);
    expect(r.kind).toBe('matched');
  });

  it('omitting the aliases argument reproduces the old behaviour exactly', () => {
    expect(resolveEntityParam(aliasList, 'birchwood-mn').kind).toBe('not_found');
  });

  it('an unknown slug is still not_found even with aliases present', () => {
    expect(resolveEntityParam(aliasList, 'nowhere-zz', aliases).kind).toBe('not_found');
  });

  // ⚠ A LIVE ENTITY ALWAYS WINS. Otherwise a stale alias row could shadow a
  // real, currently-published government — the Bloomington failure with extra
  // steps, and harder to spot because the alias looks authoritative.
  it('prefers a live entity over an alias claiming the same slug', () => {
    const shadowing: EntityAlias[] = [alias('San Francisco', 'CA', 'Birchwood Village')];
    const r = resolveEntityParam(aliasList, 'san-francisco-ca', shadowing);
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') expect(r.entity.name).toBe('San Francisco');
  });

  // ⚠ NEVER GUESS BETWEEN TWO CANONICALS. Two alias rows sharing a slug but
  // naming different entities is precisely the ambiguity the not_found rule
  // exists for.
  it('resolves an ambiguous alias to not_found rather than picking one', () => {
    const ambiguous: EntityAlias[] = [
      alias('Birchwood', 'MN', 'Birchwood Village'),
      alias('Birchwood', 'MN', 'San Francisco'),
    ];
    expect(resolveEntityParam(aliasList, 'birchwood-mn', ambiguous).kind).toBe('not_found');
  });

  it('tolerates a duplicate alias row naming the SAME canonical', () => {
    const duped: EntityAlias[] = [
      alias('Birchwood', 'MN', 'Birchwood Village'),
      alias('Birchwood', 'MN', 'Birchwood Village'),
    ];
    expect(resolveEntityParam(aliasList, 'birchwood-mn', duped).kind).toBe('aliased');
  });

  it('ignores an alias whose canonical entity is not in the list', () => {
    const dangling: EntityAlias[] = [alias('Gone', 'MN', 'Not Loaded')];
    expect(resolveEntityParam(aliasList, 'gone-mn', dangling).kind).toBe('not_found');
  });

  it('ignores a self-alias', () => {
    const self: EntityAlias[] = [alias('San Francisco', 'CA', 'San Francisco')];
    const r = resolveEntityParam(aliasList, 'san-francisco-ca', self);
    expect(r.kind).toBe('matched');
  });

  it('matches an alias case-insensitively, as the slug transform lowercases', () => {
    const r = resolveEntityParam(aliasList, 'birchwood-mn', [alias('BIRCHWOOD', 'mn', 'Birchwood Village')]);
    expect(r.kind).toBe('aliased');
  });

  it('an empty slug is not_found, never an alias hit', () => {
    expect(resolveEntityParam(aliasList, '', aliases).kind).toBe('not_found');
  });
});

describe('displayLabel — the guard for a name, not a slug', () => {
  it('KEEPS the spaces displaySlug strips', () => {
    // The bug this exists to prevent: displaySlug('Birchwood Village') is
    // 'BirchwoodVillage', which is what the rename notice would have shown.
    expect(displayLabel('Birchwood Village')).toBe('Birchwood Village');
    expect(displaySlug('Birchwood Village')).toBe('BirchwoodVillage');
  });

  it('collapses runs of whitespace rather than removing them', () => {
    expect(displayLabel('Marine  on   Saint Croix')).toBe('Marine on Saint Croix');
  });

  it('strips control characters and trims', () => {
    // Built rather than written literally: a raw control byte in a source file
    // trips tests/noControlBytesInSource.test.mjs and tests/nulByte.test.mjs.
    expect(displayLabel(`  Birch${String.fromCharCode(0)}wood  `)).toBe('Birchwood');
  });

  it('truncates a name long enough to blow out the banner', () => {
    const out = displayLabel('x'.repeat(200));
    expect(out.length).toBe(64);
    expect(out.endsWith('…')).toBe(true);
  });
});
