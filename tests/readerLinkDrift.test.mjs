import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  publishedUrlsFor,
  judgeDrift,
  sampleKey,
  pickDriftSample,
  driftIsClean,
} from '../scripts/lib/readerLinkDrift.mjs';

/**
 * ⚠⚠⚠ THE GATE SPENT A DAY INSTRUCTING PEOPLE TO REDO MERGED WORK.
 *
 * `reader_link_census()` is a SQL copy of a precedence that lives in another
 * repository. ev-accounts#1372 changed that precedence and deployed it; the
 * census kept describing the old one and the gate kept printing "704 budgets
 * shown a landing page — the repair is in ev-accounts", a repair that had
 * already shipped.
 *
 * Nothing inside the model could catch that: the model was self-consistent and
 * simply described a world that had moved. These pin the check that can —
 * comparing the model's claim against what the live API actually publishes.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const bradbury = {
  source_url: 'https://bythenumbers.sco.ca.gov',
  sample_entity: 'Bradbury',
  sample_state: 'CA',
  sample_fiscal_year: 2021,
  sample_source: 'CA State Controller - Revenues',
};

describe('publishedUrlsFor', () => {
  it('⭐ counts BOTH fields — the chip links one, the API ships both (#381)', () => {
    expect(publishedUrlsFor({
      data_source_info: { url: 'https://a.gov/x.pdf', datasetUrl: 'https://b.gov/y' },
    })).toEqual(['https://a.gov/x.pdf', 'https://b.gov/y']);
  });

  it('survives a budget with no citation at all', () => {
    expect(publishedUrlsFor({ data_source_info: null })).toEqual([]);
    expect(publishedUrlsFor({})).toEqual([]);
    expect(publishedUrlsFor(undefined)).toEqual([]);
  });

  it('drops empty strings rather than reporting them as a published URL', () => {
    expect(publishedUrlsFor({ data_source_info: { url: '', datasetUrl: null } })).toEqual([]);
  });
});

describe('judgeDrift', () => {
  it('⛔⛔ CATCHES THE REAL ONE — the stale census against the fixed API', () => {
    // This is the exact disagreement that went unnoticed: the census said
    // Bradbury FY2021 readers are sent to the portal ROOT, while the deployed
    // API had already started publishing the precise dataset page.
    const observed = new Map([[sampleKey(bradbury), [{
      fiscal_year: 2021,
      data_source_info: {
        url: 'https://bythenumbers.sco.ca.gov/d/rrtv-rsj9',
        datasetUrl: 'https://bythenumbers.sco.ca.gov/d/rrtv-rsj9',
      },
    }]]]);
    const d = judgeDrift([bradbury], observed);
    expect(d.drifted).toHaveLength(1);
    expect(d.agreed).toBe(0);
    expect(driftIsClean(d)).toBe(false);
    expect(d.drifted[0].published).toEqual(['https://bythenumbers.sco.ca.gov/d/rrtv-rsj9']);
  });

  it('✅ agrees once the census is brought into line', () => {
    const fixed = { ...bradbury, source_url: 'https://bythenumbers.sco.ca.gov/d/rrtv-rsj9' };
    const observed = new Map([[sampleKey(fixed), [{
      fiscal_year: 2021,
      data_source_info: {
        url: 'https://bythenumbers.sco.ca.gov/d/rrtv-rsj9',
        datasetUrl: 'https://bythenumbers.sco.ca.gov/d/rrtv-rsj9',
      },
    }]]]);
    const d = judgeDrift([fixed], observed);
    expect(d.drifted).toHaveLength(0);
    expect(d.agreed).toBe(1);
    expect(driftIsClean(d)).toBe(true);
  });

  it('⭐ matches on EITHER published field, not just the chip href', () => {
    // A URL carried only by `datasetUrl` still reaches the reader.
    const observed = new Map([[sampleKey(bradbury), [{
      fiscal_year: 2021,
      data_source_info: { url: 'https://elsewhere.gov/x', datasetUrl: bradbury.source_url },
    }]]]);
    expect(judgeDrift([bradbury], observed).agreed).toBe(1);
  });

  it('⚠⚠ an API that cannot be asked is UNRESOLVED, never drift', () => {
    // #373's distinction. Silence from a service is not disagreement with it,
    // and a gate that conflated the two would go red on a bad network.
    const d = judgeDrift([bradbury], new Map([[sampleKey(bradbury), 'unreachable']]));
    expect(d.drifted).toHaveLength(0);
    expect(d.unresolved).toHaveLength(1);
    expect(d.unresolved[0].why).toMatch(/could not be asked/);
    expect(driftIsClean(d)).toBe(true);
  });

  it('⚠ a missing fiscal year is UNRESOLVED, not drift', () => {
    const observed = new Map([[sampleKey(bradbury), [{ fiscal_year: 2019, data_source_info: { url: 'x' } }]]]);
    const d = judgeDrift([bradbury], observed);
    expect(d.drifted).toHaveLength(0);
    expect(d.unresolved[0].why).toMatch(/no FY2021 budget/);
  });

  it('⚠ a budget the API serves with NO citation is unresolved, not agreement', () => {
    const observed = new Map([[sampleKey(bradbury), [{ fiscal_year: 2021, data_source_info: null }]]]);
    const d = judgeDrift([bradbury], observed);
    expect(d.agreed).toBe(0);
    expect(d.unresolved).toHaveLength(1);
  });

  it('counts what it checked, so a vacuous pass is visible', () => {
    const d = judgeDrift([], new Map());
    expect(d.checked).toBe(0);
    expect(d.agreed).toBe(0);
  });
});

describe('pickDriftSample', () => {
  const rows = [
    ...Array.from({ length: 20 }, (_, i) => ({
      source_url: `https://big.gov/${i}`, sample_entity: 'Bradbury', sample_state: 'CA', sample_fiscal_year: 2021,
    })),
    { source_url: 'https://weho.org/a', sample_entity: 'West Hollywood', sample_state: 'CA', sample_fiscal_year: 2019 },
    { source_url: 'https://sd.gov/b', sample_entity: 'San Diego', sample_state: 'CA', sample_fiscal_year: 2024 },
  ];

  it('⚠ spreads across ENTITIES instead of taking the top of the list', () => {
    // The census is dominated by a few publishers; the first N rows would ask
    // about one entity N times and read like coverage.
    const picked = pickDriftSample(rows, 6);
    const entities = new Set(picked.map((r) => r.sample_entity));
    expect(entities.size).toBe(3);
    expect(picked).toHaveLength(6);
  });

  it('respects the limit and never invents rows', () => {
    expect(pickDriftSample(rows, 2)).toHaveLength(2);
    expect(pickDriftSample([], 8)).toHaveLength(0);
  });

  it('skips rows with no sample budget to look up', () => {
    expect(pickDriftSample([{ source_url: 'https://x/1' }], 4)).toHaveLength(0);
  });
});

/**
 * ⛔ The census must not quietly go back to describing the old precedence. A
 * comment can say anything; this reads the SQL.
 */
describe('the latest reader_link_census migration applies the deployed rule', () => {
  const dir = join(ROOT, 'supabase/migrations');
  const defining = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /create\s+function\s+treasury\.reader_link_census/i.test(readFileSync(join(dir, f), 'utf8')));

  it('found the migrations (positive control)', () => {
    expect(defining.length).toBeGreaterThan(0);
  });

  it('⭐ coalesces source_url ahead of the registry url and the base_url', () => {
    const sql = readFileSync(join(dir, defining[defining.length - 1]), 'utf8');
    expect(sql).toMatch(/coalesce\(\s*c\.source_url,\s*c\.sr_url\s*\)/);
    expect(sql).toMatch(/coalesce\(\s*c\.source_url,\s*c\.base_url\s*\)/);
  });

  it('⛔ no longer returns a column that could only ever report zero', () => {
    const sql = readFileSync(join(dir, defining[defining.length - 1]), 'utf8');
    const body = sql.slice(sql.indexOf('create function'));
    expect(body).not.toMatch(/^\s*overrides_stored_url\s+bigint/m);
  });
});
