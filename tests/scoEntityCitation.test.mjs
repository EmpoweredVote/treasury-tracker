import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scoCorpus, scoOrg1, scoBranch, scoEntityUrl, isScoEntityUrl,
  judgeScoTie, scoTieIsClean, scoTotalsUrl, SCO_ENTITY_HOSTS,
} from '../scripts/lib/scoEntityCitation.mjs';

/**
 * ⚠⚠⚠ 24,354 BUDGETS CITED A STATEWIDE DATASET.
 *
 * Every CA State Controller budget — 480 cities, 57 counties, FY2003-2025 —
 * pointed at one of four dataset pages, so a reader of Torrance FY2023 landed
 * on a grid of every city in California for every year.
 *
 * The publisher's per-entity view ties to the dollar (24,352 of 24,354 on
 * 2026-11-11), but it is an Angular `#!` route — a fragment never reaches the
 * server, and the host answers a real entity, a fake entity and complete
 * nonsense with the same 236,927-byte shell. So these pin the two halves: the
 * URL is built to one rule, and the family is verified by TIE rather than by a
 * liveness probe that could only ever say "yes".
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('scoEntityUrl', () => {
  it('⭐ builds the per-entity, per-year view a reader can actually use', () => {
    expect(scoEntityUrl({ entityName: 'Torrance', entityType: 'city', fiscalYear: 2023, datasetType: 'operating' }))
      .toBe('https://cities.bythenumbers.sco.ca.gov/#!/year/2023/operating/0/entity_name/Torrance/0/category');
  });

  it('⚠ a county is "Merced" to the publisher, not "Merced County"', () => {
    // Getting this wrong yields a page with no entity on it — at HTTP 200,
    // because the shell answers everything.
    expect(scoEntityUrl({ entityName: 'Merced County', entityType: 'county', fiscalYear: 2023, datasetType: 'revenue' }))
      .toBe('https://counties.bythenumbers.sco.ca.gov/#!/year/2023/revenue/0/entity_name/Merced/0/category');
  });

  it('encodes a space, and leaves URL-safe punctuation alone', () => {
    // Verified against the live app: both render the entity.
    expect(scoEntityUrl({ entityName: 'St. Helena', entityType: 'city', fiscalYear: 2023, datasetType: 'operating' }))
      .toContain('/entity_name/St.%20Helena/0/category');
    expect(scoEntityUrl({ entityName: 'Carmel-By-The-Sea', entityType: 'city', fiscalYear: 2023, datasetType: 'operating' }))
      .toContain('/entity_name/Carmel-By-The-Sea/0/category');
  });

  it('⛔ refuses rather than building a URL that names no entity', () => {
    expect(() => scoEntityUrl({ entityName: '  ', entityType: 'city', fiscalYear: 2023, datasetType: 'operating' }))
      .toThrow(/empty entity name/);
    // ⚠ Mirrors the migration's FENCE 1: a county whose name does not carry
    // the suffix cannot be turned into the publisher's label, and the shell
    // would answer 200 for the broken URL anyway.
    expect(() => scoEntityUrl({ entityName: 'Merced', entityType: 'county', fiscalYear: 2023, datasetType: 'operating' }))
      .toThrow(/does not end in/);
    expect(() => scoEntityUrl({ entityName: 'Torrance', entityType: 'city', fiscalYear: 23, datasetType: 'operating' }))
      .toThrow(/four digits/);
  });

  it('maps only `revenue` to the revenue branch', () => {
    // Measured: `revenues`, `funding`, `income` all render a page with the
    // entity ABSENT, at HTTP 200.
    expect(scoBranch('revenue')).toBe('revenue');
    expect(scoBranch('operating')).toBe('operating');
    expect(scoBranch('salaries')).toBe('operating');
    expect(scoCorpus('county')).toBe('counties');
    expect(scoCorpus('city')).toBe('cities');
    expect(scoOrg1('Merced County', 'county')).toBe('Merced');
    expect(scoOrg1('Orange', 'city')).toBe('Orange');
  });

  it('every built URL satisfies the shape the migration asserts', () => {
    for (const t of ['operating', 'revenue']) {
      for (const [name, type] of [['Torrance', 'city'], ['Merced County', 'county'], ['St. Helena', 'city']]) {
        expect(isScoEntityUrl(scoEntityUrl({ entityName: name, entityType: type, fiscalYear: 2019, datasetType: t }))).toBe(true);
      }
    }
    expect(isScoEntityUrl('https://bythenumbers.sco.ca.gov/d/ju3w-4gxp')).toBe(false);
    expect(isScoEntityUrl('https://cities.bythenumbers.sco.ca.gov/#!/year/2023/operating/0/entity_name/St. Helena/0/category')).toBe(false);
  });
});

describe('scoTotalsUrl', () => {
  it('⭐ asks for a WHOLE YEAR at once — 92 calls cover 24,354 citations', () => {
    expect(scoTotalsUrl('cities', 'operating', 2023)).toContain('/api/opex/chart_data.json');
    expect(scoTotalsUrl('counties', 'revenue', 2011)).toContain('/api/revenue/chart_data.json');
    expect(scoTotalsUrl('cities', 'operating', 2023)).toContain('child_entity=org1');
  });
});

describe('judgeScoTie', () => {
  const row = {
    id: 'b1', entityName: 'Torrance', entityType: 'city', fiscalYear: 2023,
    datasetType: 'operating', total: '417534982',
  };

  it('✅ ties when the publisher reports our figure', () => {
    const pub = new Map([['cities|operating|2023|Torrance', 417534982]]);
    const t = judgeScoTie([row], pub);
    expect(t.tie).toBe(1);
    expect(scoTieIsClean(t)).toBe(true);
  });

  it('⛔⛔ CATCHES THE REAL ONE — Berkeley published $0 against the SCO’s $294M', () => {
    const berkeley = { ...row, id: 'b2', entityName: 'Berkeley', fiscalYear: 2014, total: '0' };
    const pub = new Map([['cities|operating|2014|Berkeley', 293986462]]);
    const t = judgeScoTie([berkeley], pub);
    expect(t.mismatch).toHaveLength(1);
    expect(t.mismatch[0].publisher).toBe(293986462);
    expect(t.mismatch[0].diff).toBe(293986462);
    expect(scoTieIsClean(t)).toBe(false);
  });

  it('⚠ an entity-year the publisher does not list is ABSENT, never a mismatch', () => {
    // The SCO simply has no filing for some entity-years. Calling that a
    // disagreement would invent failures — #373's distinction.
    const t = judgeScoTie([row], new Map());
    expect(t.mismatch).toHaveLength(0);
    expect(t.absent).toHaveLength(1);
    expect(scoTieIsClean(t)).toBe(true);
  });

  it('counts what it checked, so a vacuous pass is visible', () => {
    expect(judgeScoTie([], new Map()).checked).toBe(0);
  });

  it('uses the county label when looking the publisher up', () => {
    const county = { ...row, id: 'b3', entityName: 'Merced County', entityType: 'county', total: '744481942' };
    const pub = new Map([['counties|operating|2023|Merced', 744481942]]);
    expect(judgeScoTie([county], pub).tie).toBe(1);
  });
});

/**
 * ⛔ SQL and JS must build the SAME url. They are two implementations of one
 * rule — the exact shape of drift that let reader_link_census() go stale — so
 * the migration's assertions are held against the module's here.
 */
describe('the migration and the module agree on the URL', () => {
  const dir = join(ROOT, 'supabase/migrations');
  const file = readdirSync(dir).filter((f) => /sco_cites_the_entity/.test(f)).sort().pop();

  it('found the migration (positive control)', () => {
    expect(file).toBeTruthy();
  });

  it('writes both subdomains, both branches, and strips the County suffix', () => {
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const h of SCO_ENTITY_HOSTS) expect(sql).toContain(h.split('.')[0]);
    expect(sql).toContain('.bythenumbers.sco.ca.gov/#!/year/');
    expect(sql).toContain("'/0/entity_name/'");
    expect(sql).toMatch(/County\$/);
    expect(sql).toContain("replace(");
  });

  it('⛔ leaves the derived rows on the dataset page, and says the number', () => {
    const sql = readFileSync(join(dir, file), 'utf8');
    expect(sql).toContain('8622');
    expect(sql).toMatch(/Treasury Tracker derived/);
  });
});
