/**
 * The Ohio AOS dataset manifests: the URLs the loader fetches AND the
 * `source_url` it stamps on every Ohio row via resolveSourceUrl().
 *
 * ⚠⚠ THE APEX DOES NOT RESOLVE. Measured 2026-11-01: `ohioauditor.gov` fails
 * DNS outright (curl exit 6) while `www.ohioauditor.gov` resolves and answers.
 * Probing only the apex reads as "the host is down" and hides the real state —
 * it is what made a first pass conclude the publisher was unreachable when the
 * site was merely offline for another reason.
 *
 * ⚠ Sixty-two URLs across two files are edited by hand exactly once. This
 * exists so a half-finished edit cannot ship: every entry must agree with its
 * own `url_pattern`, so one stray apex is a failing test, not a silent 404 in
 * a loader someone runs six months from now.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(here, '..', 'scripts', f), 'utf8'));

const MANIFESTS = [
  ['city', 'ohioAosDatasets.json', 'City'],
  ['county', 'ohioAosCountyDatasets.json', 'County'],
];

describe.each(MANIFESTS)('ohio AOS %s manifest', (kind, file, prefix) => {
  const m = read(file);

  it('covers FY2016-2025 across all three bases', () => {
    expect(m.datasets).toHaveLength(30);
    expect(new Set(m.datasets.map((d) => d.fiscal_year)).size).toBe(10);
    expect(new Set(m.datasets.map((d) => d.basis))).toEqual(new Set(['GAAP', 'CASH', 'MOD']));
  });

  it('uses www, never the bare apex, which does not resolve', () => {
    expect(m.url_pattern.startsWith('https://www.ohioauditor.gov/')).toBe(true);
    const apex = m.datasets.filter((d) => /^https:\/\/ohioauditor\.gov\//.test(d.url));
    expect(apex.map((d) => `${d.fiscal_year} ${d.basis}`)).toEqual([]);
  });

  it('every entry matches the manifest\'s own url_pattern', () => {
    // ⚠ The guard against a half-finished hand edit: a URL that drifts from
    // the pattern is a 404 nobody sees until a load fails.
    const wrong = m.datasets.filter((d) => d.url !== m.url_pattern
      .replace('<YEAR>', String(d.fiscal_year))
      .replace('<BASIS>', d.basis));
    expect(wrong.map((d) => d.url)).toEqual([]);
  });

  it('names the right entity type in every filename', () => {
    const bad = m.datasets.filter((d) => !d.url.includes(`/${prefix}_`));
    expect(bad.map((d) => d.url)).toEqual([]);
  });
});
