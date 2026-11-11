import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROVEN_DOCUMENT_URLS,
  documentKey,
  publisherUrlFor,
} from '../scripts/data/documentPublisherUrls.mjs';

/**
 * ⚠⚠⚠ TEN LOADERS USED TO RECORD A CONTRIBUTOR'S HARD DISK AS PROVENANCE.
 *
 *     base_url: 'file://' + pdfAbsPath.replace(/[\\]/g, '/'),
 *
 * 51 of those reached production (86 rows, 11 cities) and nothing noticed
 * until #381, because no gate had ever read `base_url`. #382 repaired 23 of
 * them — but a data repair alone would not have held: the next run of any of
 * those loaders re-mints the laptop path straight over it, which is exactly
 * what `loadWICMREB.js` would have done to the Wisconsin citations in #379.
 *
 * So these pin the two halves of the fix: the registry is PROVEN, and a loader
 * that cannot find a document in it STOPS rather than falling back.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('PROVEN_DOCUMENT_URLS', () => {
  it('is not empty (positive control)', () => {
    // Every assertion below iterates the map; an empty one would pass vacuously.
    expect(Object.keys(PROVEN_DOCUMENT_URLS).length).toBeGreaterThan(20);
  });

  it('⛔ records only https PUBLISHER urls — never another local path', () => {
    for (const [key, v] of Object.entries(PROVEN_DOCUMENT_URLS)) {
      expect(v.url, key).toMatch(/^https:\/\/[a-z0-9.-]+\/.+/i);
      expect(v.url, key).not.toMatch(/^file:/);
      expect(v.url, key).not.toMatch(/^local:/);
    }
  });

  it('⭐ carries the PROOF, not just the link', () => {
    // A URL with no digest is an assertion; a URL with one is a measurement.
    for (const [key, v] of Object.entries(PROVEN_DOCUMENT_URLS)) {
      expect(v.sha256, key).toMatch(/^[0-9a-f]{64}$/);
      expect(v.bytes, key).toBeGreaterThan(1000);
      expect(v.provenOn, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('⚠ gives each document ONE url, and each url ONE document', () => {
    const urls = Object.values(PROVEN_DOCUMENT_URLS).map((v) => v.url);
    expect(new Set(urls).size).toBe(urls.length);
    const digests = Object.values(PROVEN_DOCUMENT_URLS).map((v) => v.sha256);
    expect(new Set(digests).size).toBe(digests.length);
  });

  it('keys on a repo-relative docs/ path', () => {
    for (const key of Object.keys(PROVEN_DOCUMENT_URLS)) {
      expect(key).toMatch(/^docs\/[^/]+\/.+/);
    }
  });
});

describe('documentKey', () => {
  it.each([
    ['C:\\treasury-tracker\\docs\\Fresno\\fy2024-adopted-budget.pdf', 'docs/Fresno/fy2024-adopted-budget.pdf'],
    ['/c/treasury-tracker/docs/Fresno/fy2024-adopted-budget.pdf', 'docs/Fresno/fy2024-adopted-budget.pdf'],
    ['docs/Fresno/fy2024-adopted-budget.pdf', 'docs/Fresno/fy2024-adopted-budget.pdf'],
    ['./docs/Fresno/fy2024-adopted-budget.pdf', 'docs/Fresno/fy2024-adopted-budget.pdf'],
  ])('normalises %s', (input, expected) => {
    expect(documentKey(input)).toBe(expected);
  });
});

describe('publisherUrlFor', () => {
  it('resolves a proven document from an absolute Windows path', () => {
    // ⚠ The loaders pass `path.resolve(...)`, so Windows separators are the
    // normal case, not an edge one.
    expect(publisherUrlFor('C:\\treasury-tracker\\docs\\Fresno\\fy2024-adopted-budget.pdf'))
      .toBe('https://www.fresno.gov/wp-content/uploads/2023/10/FY-2023-2024-Adopted-Budget.pdf');
  });

  it('⛔⛔ THROWS for a document whose publisher URL is not proven', () => {
    // Fremont is one of the 28 whose publisher refuses every automated client.
    // The old behaviour here was to write `file://` + the operator's path.
    expect(() => publisherUrlFor('docs/Fremont/FY 201920 Adopted Budget.pdf'))
      .toThrow(/No PROVEN publisher URL/);
  });

  it('⚠ the error tells the next person what to actually do', () => {
    // A throw that only says "missing" invites the fallback back in.
    let msg = '';
    try { publisherUrlFor('docs/Nowhere/x.pdf'); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/sha256/);
    expect(msg).toMatch(/documentPublisherUrls\.mjs/);
    expect(msg).toMatch(/may NOT fall back/);
  });
});

/**
 * ⛔⛔ THE REGRESSION GUARD. Repairing the 51 rows in the database buys nothing
 * if a loader can still mint the 52nd.
 */
describe('no loader may mint a local path as provenance', () => {
  const dir = join(ROOT, 'scripts');
  const files = readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));

  it('actually read the loaders (positive control)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('⚠⚠⚠ never assigns base_url or source_url a file:// or local: literal', () => {
    const offenders = [];
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      // ⚠ Strip line comments first: this file and the registry both DESCRIBE
      // the old pattern, and a guard that cannot tell prose from code would
      // either fail on its own documentation or be silenced by deleting it.
      const bare = src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
      for (const m of bare.matchAll(/(base_url|source_url|p_source_url)\s*:\s*'(file:\/\/|local:)/g)) {
        offenders.push(`${f}: ${m[1]} <- ${m[2]}`);
      }
    }
    expect(offenders, `loaders writing a local path as provenance:\n  ${offenders.join('\n  ')}`)
      .toEqual([]);
  });
});
