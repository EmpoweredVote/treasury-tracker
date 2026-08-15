import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkPerCapita, dataSourceLabel, buildFilenameRegex, makeExtractorSelector,
  toBudgetTree, requireSourceUrl, loadEntity,
} from '../scripts/lib/waSaoLoad.mjs';
import {
  BAINBRIDGE_2025_OPERATING_TREE, KITSAP_2024_OPERATING_TREE,
} from './fixtures/waSaoExtractorTrees.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('checkPerCapita', () => {
  // Kitsap FY2024 GF operating: $128,230,878 / 288,900 = $443.9/resident.
  // Seattle's [500, 25000] band would REJECT this correct load; the
  // re-derived [100, 10000] band must PASS it.
  const KITSAP_BAND = [100, 10000];

  it('passes a genuine Kitsap-scale total ($443.9/resident) against [100, 10000]', () => {
    const total = 128_230_878;
    const population = 288_900;
    const perCapita = checkPerCapita(total, population, KITSAP_BAND, 2024, 'operating');
    expect(perCapita).toBeCloseTo(443.9, 1);
  });

  it('passes a genuine Bainbridge-scale total ($814.8/resident) against [100, 10000]', () => {
    const total = 20_801_297;
    const population = 25_530;
    const perCapita = checkPerCapita(total, population, KITSAP_BAND, 2025, 'operating');
    expect(perCapita).toBeCloseTo(814.8, 1);
  });

  it('rejects a missing x1000 (Kitsap total wrongly left in thousands)', () => {
    const total = 128_230.878; // what a stray /1000 would produce
    const population = 288_900;
    expect(() => checkPerCapita(total, population, KITSAP_BAND, 2024, 'operating'))
      .toThrow(/outside the plausible band \[100, 10000\]/);
  });

  it('rejects a spurious x1000 (Kitsap total wrongly multiplied)', () => {
    const total = 128_230_878 * 1000;
    const population = 288_900;
    expect(() => checkPerCapita(total, population, KITSAP_BAND, 2024, 'operating'))
      .toThrow(/units error/);
  });

  it('would have REJECTED Kitsap under Seattle\'s [500, 25000] band -- the trap this task warns about', () => {
    const total = 128_230_878;
    const population = 288_900;
    expect(() => checkPerCapita(total, population, [500, 25000], 2024, 'operating'))
      .toThrow(/outside the plausible band \[500, 25000\]/);
  });

  it('names the exact band it used in the error message', () => {
    expect(() => checkPerCapita(1, 1_000_000, [100, 10000], 2020, 'revenue'))
      .toThrow('FY2020 revenue: $0.00/resident is outside the plausible band [100, 10000]. Total=$1, pop=1000000. This is almost certainly a units error -- check the extractor\'s units setting.');
  });
});

describe('dataSourceLabel', () => {
  it('builds the exact operating (expenditure) label', () => {
    expect(dataSourceLabel('Bainbridge Island', 2025, 'operating')).toBe(
      'WA State Auditor — Bainbridge Island Annual Financial Report FY2025 (General Fund, Expenditure by Function)'
    );
  });
  it('builds the exact revenue label', () => {
    expect(dataSourceLabel('Kitsap County', 2024, 'revenue')).toBe(
      'WA State Auditor — Kitsap County Annual Financial Report FY2024 (General Fund, Revenue by Source)'
    );
  });
});

describe('buildFilenameRegex', () => {
  it('matches the expected Bainbridge filename and captures the year', () => {
    const re = buildFilenameRegex('bainbridge');
    const m = 'bainbridge-2025-acfr.pdf'.match(re);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('2025');
  });
  it('matches the expected Kitsap filename and captures the year', () => {
    const re = buildFilenameRegex('kitsap');
    const m = 'kitsap-2004-acfr.pdf'.match(re);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('2004');
  });
  it('is case-insensitive', () => {
    const re = buildFilenameRegex('bainbridge');
    expect(re.test('Bainbridge-2025-ACFR.PDF')).toBe(true);
  });
  it('does not match a different entity\'s prefix', () => {
    const re = buildFilenameRegex('bainbridge');
    expect(re.test('kitsap-2024-acfr.pdf')).toBe(false);
  });
  it('does not match without the -acfr suffix', () => {
    const re = buildFilenameRegex('kitsap');
    expect(re.test('kitsap-2024.pdf')).toBe(false);
  });
});

describe('makeExtractorSelector', () => {
  it('reproduces the real Bainbridge era split: early years to extractBainbridgeEarly.py, the rest to extractBainbridge.py', () => {
    const selector = makeExtractorSelector('extractBainbridge.py', {
      2004: 'extractBainbridgeEarly.py',
      2005: 'extractBainbridgeEarly.py',
      2007: 'extractBainbridgeEarly.py',
      2008: 'extractBainbridgeEarly.py',
    });
    expect(selector(2004)).toBe('extractBainbridgeEarly.py');
    expect(selector(2005)).toBe('extractBainbridgeEarly.py');
    expect(selector(2007)).toBe('extractBainbridgeEarly.py');
    expect(selector(2008)).toBe('extractBainbridgeEarly.py');
    expect(selector(2010)).toBe('extractBainbridge.py');
    expect(selector(2025)).toBe('extractBainbridge.py');
    // FY2006 and FY2009 are excluded upstream (never in fiscalYears), but the
    // selector itself has no opinion on years outside its overrides map --
    // it just falls through to the default, which is correct behaviour for
    // any year the caller does pass in.
    expect(selector(2006)).toBe('extractBainbridge.py');
  });

  it('reproduces Kitsap: one extractor for the whole window, no overrides needed', () => {
    const selector = makeExtractorSelector('extractKitsap.py');
    expect(selector(2004)).toBe('extractKitsap.py');
    expect(selector(2020)).toBe('extractKitsap.py');
    expect(selector(2024)).toBe('extractKitsap.py');
  });
});

// I-2 code review fix: toBudgetTree was exported and asserted (in the Task 7
// report) to handle both entities' shapes with one rule, but nothing tested
// it. These fixtures are the REAL `.tree` output of the real, shipped
// extractors (extractBainbridge.py FY2025 operating, extractKitsap.py
// FY2024 operating) -- see tests/fixtures/waSaoExtractorTrees.mjs for the
// exact commands used to capture them. No PDF/python dependency at test
// time.
describe('toBudgetTree (fixture-driven, real extractor output)', () => {
  it('maps Bainbridge FY2025 operating: Current is the only parent; Debt Service - Principal, Debt Service - Interest and Capital Outlay are valued root leaves', () => {
    const { tree, total, rowCount } = toBudgetTree(BAINBRIDGE_2025_OPERATING_TREE);

    expect(total).toBe(20801296);
    expect(rowCount).toBe(10); // 7 Current children + 3 root-level leaves
    expect(tree).toHaveLength(4);

    const current = tree.find(n => n.n === 'Current');
    expect(current.a).toBe(20633325);
    expect(current.i).toHaveLength(7);
    expect(current.i.map(i => i.d)).toEqual([
      'General Government', 'Judicial', 'Public Safety', 'Physical Environment',
      'Health and Human Services', 'Economic Environment', 'Culture and Recreation',
    ]);

    // Debt Service is NOT a single parent here -- it is split into two
    // separately-valued root children, each a single-item leaf.
    const principal = tree.find(n => n.n === 'Debt Service - Principal');
    expect(principal.a).toBe(30508);
    expect(principal.i).toEqual([{ d: 'Debt Service - Principal', a: 30508, aa: null, f: null, e: null }]);
    const interest = tree.find(n => n.n === 'Debt Service - Interest');
    expect(interest.i).toEqual([{ d: 'Debt Service - Interest', a: 3966, aa: null, f: null, e: null }]);

    const capitalOutlay = tree.find(n => n.n === 'Capital Outlay');
    expect(capitalOutlay.i).toEqual([{ d: 'Capital Outlay', a: 133497, aa: null, f: null, e: null }]);
  });

  it('maps Kitsap FY2024 operating: Current AND Debt Service are both parents; Capital Outlay is the only valued root leaf', () => {
    const { tree, total, rowCount } = toBudgetTree(KITSAP_2024_OPERATING_TREE);

    expect(total).toBe(128230878);
    expect(rowCount).toBe(8); // 5 Current children + 2 Debt Service children + 1 root leaf
    expect(tree).toHaveLength(3);

    const current = tree.find(n => n.n === 'Current');
    expect(current.a).toBe(127422261);
    expect(current.i).toHaveLength(5);

    // Debt Service IS a single parent here (the inverse of Bainbridge's
    // shape) -- its two children become the icicle drill-down leaves.
    const debtService = tree.find(n => n.n === 'Debt Service');
    expect(debtService.a).toBe(478049);
    expect(debtService.i).toEqual([
      { d: 'Principal', a: 442709, aa: null, f: null, e: null },
      { d: 'Interest & Other Charges', a: 35340, aa: null, f: null, e: null },
    ]);

    const capitalOutlay = tree.find(n => n.n === 'Capital Outlay');
    expect(capitalOutlay.a).toBe(330568);
    expect(capitalOutlay.i).toEqual([{ d: 'Capital Outlay', a: 330568, aa: null, f: null, e: null }]);
  });
});

// I-1 code review fix: a falsy sourceUrlFor(fy) must never silently result
// in a published row / ephemeral data_source with no source_url.
describe('requireSourceUrl', () => {
  it('returns the URL when sourceUrlFor resolves one', () => {
    expect(requireSourceUrl(() => 'https://sao.wa.gov/report.pdf', 2024, 'ctx')).toBe('https://sao.wa.gov/report.pdf');
  });
  it('throws when sourceUrlFor returns undefined', () => {
    expect(() => requireSourceUrl(() => undefined, 2024, 'ctx')).toThrow(/falsy value/);
  });
  it('throws when sourceUrlFor returns an empty string', () => {
    expect(() => requireSourceUrl(() => '', 2024, 'ctx')).toThrow(/falsy value/);
  });
  it('names the fiscal year and the caller-supplied context in the error', () => {
    expect(() => requireSourceUrl(() => null, 2099, 'loadFiscalYear FY2099 (operating)'))
      .toThrow('loadFiscalYear FY2099 (operating): sourceUrlFor(2099) returned a falsy value -- refusing to write a row with no source_url');
  });
});

// C-1 code review fix: loadEntity must not resolve normally when any
// FY/dataset failed. This exercises the REAL loadEntity control flow
// end-to-end (no Supabase mocking, no real PDFs/python needed) by using
// dryRun: true (so no DB code path executes at all) and a descriptor whose
// requested fiscalYears deliberately has no matching PDF -- a genuine,
// unmocked "No PDF found for FYxxxx" failure on both dataset types.
describe('loadEntity default-reject on failed years (C-1)', () => {
  // docs/* is gitignored (see .gitignore line 36), so this fixture directory
  // is never tracked and safe to create/remove around the test run.
  const FIXTURE_REL_DIR = 'docs/__waSaoLoadTestFixture__';
  const FIXTURE_ABS_DIR = path.join(REPO_ROOT, ...FIXTURE_REL_DIR.split('/'));

  beforeAll(() => {
    mkdirSync(FIXTURE_ABS_DIR, { recursive: true });
    // A real PDF for a YEAR NOT REQUESTED below, purely so discoverPdfsByFY
    // finds at least one file and loadEntity's "no PDFs found at all" guard
    // does not fire before the real failure path under test.
    writeFileSync(path.join(FIXTURE_ABS_DIR, 'testent-2000-acfr.pdf'), '%PDF-1.4 unused');
  });
  afterAll(() => {
    rmSync(FIXTURE_ABS_DIR, { recursive: true, force: true });
  });

  const baseDescriptor = {
    entityName: 'Test Entity',
    extractorFor: () => 'unused-extractor.py', // never invoked: PDF lookup fails first
    pdfDir: FIXTURE_REL_DIR,
    pdfPrefix: 'testent',
    fiscalYears: [2099], // deliberately has NO matching PDF in the fixture dir
    population: 1000,
    perCapitaBand: [1, 1],
    datasetIdPrefix: 'testent-sao-gf',
    sourceUrlFor: (fy) => `https://example.com/testent-${fy}.pdf`,
    sanityMax: 1,
    dryRun: true,
    targetFY: null,
  };

  it('rejects by default when a fiscal year has no matching PDF (2 failures: operating + revenue)', async () => {
    await expect(loadEntity({ ...baseDescriptor })).rejects.toThrow(
      /Test Entity: 2 fiscal-year\/dataset load\(s\) failed .* FY2099 operating, FY2099 revenue/s
    );
  });

  it('resolves with failed > 0 only when allowPartial is explicitly true', async () => {
    const result = await loadEntity({ ...baseDescriptor, allowPartial: true });
    expect(result).toEqual({ loaded: 0, failed: 2 });
  });
});
