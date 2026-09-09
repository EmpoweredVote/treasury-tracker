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
import { resolveEntityParam, displaySlug } from './entityRouting';

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
