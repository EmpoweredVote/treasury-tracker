import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeEndpoints, endpointsAreClean } from '../scripts/lib/sourceEndpointJudge.mjs';
import { SOURCE_ENDPOINT_BASELINE } from '../scripts/data/sourceEndpointBaseline.mjs';

/**
 * `treasury.data_sources.base_url` — 156 distinct URLs over 1,824 rows — was
 * read by NO gate in this repo until #381, including the 13 of them a READER
 * is shown. These tests are pure: no database, no network, same split as
 * sourceUrlProbe.test.mjs. They fix what a verdict MEANS for a column that is
 * not a citation, and in particular the three things it must never do:
 *
 *   • let a dead SYNC endpoint be declared away — a job calls that one;
 *   • file a path on somebody's laptop under the citation gate's polite
 *     "uncitable", which means "the URL promises nothing so we assert
 *     nothing" and is a lie about a provenance record;
 *   • keep carrying a declaration about a publisher that has recovered.
 */

const row = (over = {}) => ({
  source_url: 'https://example.gov/budget.pdf',
  rows_using: 1,
  enabled_rows: 1,
  api_types: 'pdf_download',
  drives_a_sync: false,
  is_local_path: false,
  verdict: 'ok',
  sample_entity: 'Example',
  sample_state: 'XX',
  sample_source: 'Example Budget',
  ...over,
});

const EMPTY = { localPaths: 0, provenanceBroken: [] };

describe('judgeEndpoints', () => {
  it('passes a live endpoint through untouched', () => {
    const j = judgeEndpoints([row()], EMPTY);
    expect(j.ok).toHaveLength(1);
    expect(endpointsAreClean(j)).toBe(true);
  });

  it('⛔ FAILS a dead SYNC endpoint, and no declaration can excuse it', () => {
    const url = 'https://data.example.gov';
    const j = judgeEndpoints(
      [row({ source_url: url, drives_a_sync: true, api_types: 'socrata', verdict: 'dead' })],
      // the declaration exists, names the exact URL, and must be ignored
      { localPaths: 0, provenanceBroken: [{ url, why: 'declared anyway' }] },
    );
    expect(j.syncBroken).toHaveLength(1);
    expect(j.provenanceDeclared).toHaveLength(0);
    expect(endpointsAreClean(j)).toBe(false);
  });

  it('⛔ fails an undeclared broken provenance endpoint', () => {
    const j = judgeEndpoints([row({ verdict: 'dead' })], EMPTY);
    expect(j.provenanceBroken).toHaveLength(1);
    expect(endpointsAreClean(j)).toBe(false);
  });

  it('accepts a declared one, and still reports it', () => {
    const url = 'https://example.gov/gone.pdf';
    const j = judgeEndpoints(
      [row({ source_url: url, verdict: 'dead' })],
      { localPaths: 0, provenanceBroken: [{ url, why: 'publisher purged it' }] },
    );
    expect(j.provenanceBroken).toHaveLength(0);
    expect(j.provenanceDeclared).toHaveLength(1);
    expect(j.provenanceDeclared[0].declaration.why).toBe('publisher purged it');
    expect(endpointsAreClean(j)).toBe(true);
  });

  it('⚠ fails a declaration that is no longer true — a sentence about the web that expired', () => {
    const j = judgeEndpoints(
      [row()], // the declared URL recovered, or its row was deleted
      { localPaths: 0, provenanceBroken: [{ url: 'https://example.gov/gone.pdf', why: 'was dead' }] },
    );
    expect(j.stale).toHaveLength(1);
    expect(endpointsAreClean(j)).toBe(false);
  });

  it.each([
    'file://C:/treasury-tracker/docs/Fresno/fy2020-adopted-budget.pdf',
    'local:docs/Richardson/2019 Approved Budget FINAL.xlsx',
  ])('⚠⚠⚠ calls %s a LAPTOP PATH, never "uncitable"', (url) => {
    const j = judgeEndpoints([row({ source_url: url, is_local_path: true, verdict: 'uncitable' })], EMPTY);
    expect(j.localPaths).toHaveLength(1);
    expect(j.ok).toHaveLength(0);
    expect(j.provenanceBroken).toHaveLength(0);
  });

  it('⚠ reports a laptop path as a laptop path even when it drives a sync', () => {
    // "repair the URL" is not the instruction here; "find out where this file
    // actually came from" is — so the routing order matters.
    const j = judgeEndpoints(
      [row({ source_url: 'local:docs/x.xlsx', is_local_path: true, drives_a_sync: true, verdict: 'dead' })],
      EMPTY,
    );
    expect(j.localPaths).toHaveLength(1);
    expect(j.syncBroken).toHaveLength(0);
  });

  it('⛔ fails when laptop paths GROW — a loader wrote one into production', () => {
    const rows = [
      row({ source_url: 'local:a', is_local_path: true }),
      row({ source_url: 'local:b', is_local_path: true }),
    ];
    expect(endpointsAreClean(judgeEndpoints(rows, { localPaths: 2, provenanceBroken: [] }))).toBe(true);
    const grown = judgeEndpoints(rows, { localPaths: 1, provenanceBroken: [] });
    expect(grown.localGrew).toBe(true);
    expect(endpointsAreClean(grown)).toBe(false);
  });

  it('notes a pay-down without failing', () => {
    const j = judgeEndpoints([row({ source_url: 'local:a', is_local_path: true })], { localPaths: 5, provenanceBroken: [] });
    expect(j.localPaidDown).toBe(true);
    expect(j.localGrew).toBe(false);
    expect(endpointsAreClean(j)).toBe(true);
  });

  it.each(['dead', 'wrong-type'])('treats %s as broken', (verdict) => {
    expect(judgeEndpoints([row({ verdict })], EMPTY).provenanceBroken).toHaveLength(1);
  });

  /**
   * ⚠⚠⚠ `unreachable` USED TO BE LUMPED IN WITH `dead` HERE, and the
   * citation path has never done that — #373: "unreachable is the honest
   * bucket ... precisely because a person with a browser can still click one
   * of these."
   *
   * It stopped being academic when #383 put eleven web.archive.org URLs into
   * `data_sources.base_url`. The Archive refuses a random fraction of
   * connections, so a clean run failed with "A PROVENANCE ENDPOINT BROKE AND
   * IS NOT DECLARED (12)" about twelve endpoints that answered 206 with the
   * right content type a minute later.
   */
  it('⛔⛔ a REFUSED provenance endpoint is a notice, not a failure', () => {
    const j = judgeEndpoints([row({ verdict: 'unreachable' })], EMPTY);
    expect(j.provenanceBroken).toHaveLength(0);
    expect(j.provenanceUnreachable).toHaveLength(1);
    expect(endpointsAreClean(j)).toBe(true);
  });

  it('⚠ but a SYNC endpoint still fails on it — that is a job, not a note', () => {
    const j = judgeEndpoints([row({ verdict: 'unreachable', drives_a_sync: true })], EMPTY);
    expect(j.syncBroken).toHaveLength(1);
    expect(j.provenanceUnreachable).toHaveLength(0);
    expect(endpointsAreClean(j)).toBe(false);
  });

  it('⭐ a DEAD provenance endpoint still fails — 404 is the publisher speaking', () => {
    const j = judgeEndpoints([row({ verdict: 'dead' })], EMPTY);
    expect(j.provenanceBroken).toHaveLength(1);
    expect(endpointsAreClean(j)).toBe(false);
  });

  it('a DECLARED unreachable endpoint is still declared, not re-bucketed', () => {
    const o = row({ verdict: 'unreachable' });
    const j = judgeEndpoints([o], { localPaths: 0, provenanceBroken: [{ url: o.source_url, verdict: 'unreachable', observedOn: '2026-11-11', why: 'x' }] });
    expect(j.provenanceDeclared).toHaveLength(1);
    expect(j.provenanceUnreachable).toHaveLength(0);
    expect(j.stale).toHaveLength(0);
  });
});

describe('SOURCE_ENDPOINT_BASELINE', () => {
  it('⚠ never declares an endpoint that drives a sync', () => {
    // A socrata base_url is called by supabase/functions/treasury-sync on a
    // schedule. Declaring one would silence a cron failure. The judge already
    // routes past the list, but a declaration here would still be a lie.
    const declared = SOURCE_ENDPOINT_BASELINE.provenanceBroken.map((d) => d.url);
    const observed = declared.map((url) => row({ source_url: url, drives_a_sync: true, verdict: 'dead' }));
    const j = judgeEndpoints(observed, SOURCE_ENDPOINT_BASELINE);
    expect(j.syncBroken).toHaveLength(declared.length);
    expect(j.provenanceDeclared).toHaveLength(0);
  });

  it('gives every declaration a date and a reason a human can act on', () => {
    expect(SOURCE_ENDPOINT_BASELINE.provenanceBroken.length).toBeGreaterThan(0);
    for (const d of SOURCE_ENDPOINT_BASELINE.provenanceBroken) {
      expect(d.url).toMatch(/^https?:\/\//);
      expect(d.observedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['dead', 'wrong-type', 'unreachable']).toContain(d.verdict);
      // ⚠ Not a length check for its own sake: "moved" or "404" is a note, not
      // a reason, and the next person needs to know what was actually looked at.
      expect(d.why.length).toBeGreaterThan(40);
    }
  });

  it('declares each URL exactly once', () => {
    const urls = SOURCE_ENDPOINT_BASELINE.provenanceBroken.map((d) => d.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('⚠⚠ keeps a laptop-path baseline that is a real count, not a placeholder', () => {
    expect(Number.isInteger(SOURCE_ENDPOINT_BASELINE.localPaths)).toBe(true);
    expect(SOURCE_ENDPOINT_BASELINE.localPaths).toBeGreaterThan(0);
  });
});

/**
 * ⚠⚠⚠ `reader_link_census()` MUST ASK EVERY URL THE API PUBLISHES, NOT THE ONE
 * THE CLIENT CURRENTLY RENDERS.
 *
 * `data_source_info` carries two URL fields — `url` and `datasetUrl` — and the
 * API ships both to the browser on every budget. Which one the source chip
 * links to is one `||` in src/App.tsx.
 *
 * The first draft of the census resolved that ternary and asked only the
 * winner. It reported West Hollywood clean while the API handed eight demand
 * registers a 404 (`www.weho.org/.../open-checkbook`) in the same JSON object
 * as a live `datasetUrl`. The migration carries a runtime fence, but that only
 * fires on APPLY; this fires in the ordinary PR gate, with no database.
 */
describe('reader_link_census SQL', () => {
  const dir = fileURLToPath(new URL('../supabase/migrations', import.meta.url));
  const defining = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /(create|replace)\s+function\s+treasury\.reader_link_census/i
      .test(readFileSync(join(dir, f), 'utf8')));

  it('is defined by at least one migration (positive control)', () => {
    // A glob that matched nothing would make every assertion below vacuous.
    expect(defining.length).toBeGreaterThan(0);
  });

  it('⚠⚠⚠ unrolls BOTH published fields in its latest definition', () => {
    const sql = readFileSync(join(dir, defining[defining.length - 1]), 'utf8');
    expect(sql).toContain("'data_source_info.url'");
    expect(sql).toContain("'data_source_info.datasetUrl'");
  });

  it('⚠ still records which one the chip links to, so a finding can be read', () => {
    const sql = readFileSync(join(dir, defining[defining.length - 1]), 'utf8');
    expect(sql).toMatch(/is_chip_href/);
  });
});
