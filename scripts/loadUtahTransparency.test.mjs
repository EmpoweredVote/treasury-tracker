/**
 * Offline unit tests for the pure logic exported from scripts/loadUtahTransparency.js
 * (v2.5 Phase 68 — UTSRC-02 build verification).
 *
 * Run with: node --test scripts/loadUtahTransparency.test.mjs
 *
 * These tests exercise the tree builder, amount parser, type→dataset mapper, and
 * never-overwrite decision against FIXTURE rows — NO BigQuery, NO Supabase, NO
 * network. The BigQuery client is dynamically imported only inside the live fetch
 * path, so importing this module never requires @google-cloud/bigquery or ADC.
 *
 * CRITICAL: set a dummy SUPABASE_SERVICE_KEY BEFORE the import so the loader's
 * top-level guard (`if (!SUPABASE_KEY) process.exit(1)`) does not kill the runner.
 */

process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-key-not-used';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  amt,
  typeToDataset,
  neverOverwriteDecision,
  buildTree,
  DATA_SOURCE_NAME,
} from './loadUtahTransparency.js';

// ── amt — money/number parsing ────────────────────────────────────────────────

describe('amt — parses BigQuery numeric + string money safely', () => {
  it('numeric input passes through: 1234.56 → 1234.56', () => {
    assert.equal(amt(1234.56), 1234.56);
  });
  it('plain integer 150535676 → 150535676 (no truncation)', () => {
    assert.equal(amt(150535676), 150535676);
  });
  it('comma string "1,234.56" → 1234.56', () => {
    assert.equal(amt('1,234.56'), 1234.56);
  });
  it('dollar + comma "$1,000" → 1000', () => {
    assert.equal(amt('$1,000'), 1000);
  });
  it('parenthesized offset "(1,000)" → -1000', () => {
    assert.equal(amt('(1,000)'), -1000);
  });
  it('negative number -250 → -250', () => {
    assert.equal(amt(-250), -250);
  });
  it('empty / null / undefined → 0', () => {
    assert.equal(amt(''), 0);
    assert.equal(amt(null), 0);
    assert.equal(amt(undefined), 0);
  });
});

// ── typeToDataset — EX/RV mapping (PY deferred) ──────────────────────────────

describe('typeToDataset — BigQuery type code → dataset_type', () => {
  it('EX → operating', () => assert.equal(typeToDataset('EX'), 'operating'));
  it('RV → revenue', () => assert.equal(typeToDataset('RV'), 'revenue'));
  it('PY → salaries (mapped, but out of scope this phase)', () =>
    assert.equal(typeToDataset('PY'), 'salaries'));
  it('unknown → null', () => assert.equal(typeToDataset('ZZ'), null));
});

// ── neverOverwriteDecision — never overwrite a different source ───────────────

describe('neverOverwriteDecision — preserve different-source rows', () => {
  it('different source → "skip" (preserve existing)', () => {
    assert.equal(neverOverwriteDecision('Custom Provo Budget', DATA_SOURCE_NAME), 'skip');
  });
  it('same source (Transparent Utah) → "refresh"', () => {
    assert.equal(neverOverwriteDecision('Transparent Utah', DATA_SOURCE_NAME), 'refresh');
  });
  it('no existing row (null/empty source) → "refresh"', () => {
    assert.equal(neverOverwriteDecision(null, DATA_SOURCE_NAME), 'refresh');
    assert.equal(neverOverwriteDecision('', DATA_SOURCE_NAME), 'refresh');
  });
  it('defaults runSourceName to DATA_SOURCE_NAME', () => {
    assert.equal(neverOverwriteDecision('Transparent Utah'), 'refresh');
    assert.equal(neverOverwriteDecision('SCO ByTheNumbers'), 'skip');
  });
});

// ── buildTree — function/purpose-first compact tree ──────────────────────────

// Fixture rows shaped like the documented BQ schema (function1/cat1/org1/amount).
const FIXTURE = [
  { function1: 'Public Safety', cat1: 'Police', org1: 'Patrol',        amount: 1000 },
  { function1: 'Public Safety', cat1: 'Police', org1: 'Investigations', amount: 500 },
  { function1: 'Public Safety', cat1: 'Fire',   org1: 'Suppression',   amount: 800 },
  { function1: 'Public Works',  cat1: 'Streets', org1: 'Paving',       amount: 2000 },
  { function1: 'Public Works',  cat1: 'Streets', org1: 'Refund',       amount: '(200)' }, // offset
  { function1: 'Public Works',  cat1: 'Streets', org1: 'ZeroLine',     amount: 0 },        // skipped
  { function1: null,            cat1: null,      org1: null,           amount: 50 },        // Unknown/General
];

describe('buildTree — totals, structure, sorting, edge cases', () => {
  const { tree, total } = buildTree(FIXTURE);

  it('grand total equals the sum of all non-zero rows (incl. the negative offset)', () => {
    // 1000 + 500 + 800 + 2000 - 200 + 50 = 4150  (the 0 row is skipped)
    assert.equal(total, 4150);
  });

  it('each top-level total equals the sum of its children', () => {
    for (const node of tree) {
      const childSum = node.c.reduce((s, c) => s + c.a, 0);
      assert.equal(node.a, childSum, `top "${node.n}" total != sum of children`);
    }
  });

  it('each subcategory total equals the sum of its items', () => {
    for (const node of tree) {
      for (const sub of node.c) {
        const itemSum = sub.i.reduce((s, i) => s + i.a, 0);
        assert.equal(sub.a, itemSum, `sub "${sub.n}" total != sum of items`);
      }
    }
  });

  it('top-level nodes are sorted by amount descending', () => {
    const amounts = tree.map((n) => n.a);
    const sorted = [...amounts].sort((x, y) => y - x);
    assert.deepEqual(amounts, sorted);
  });

  it('uses the compact {n,a,c}/{n,a,i} shape', () => {
    const top = tree[0];
    assert.ok('n' in top && 'a' in top && 'c' in top);
    const sub = top.c[0];
    assert.ok('n' in sub && 'a' in sub && 'i' in sub);
    const item = sub.i[0];
    assert.ok('d' in item && 'a' in item);
  });

  it('skips zero-amount rows but retains negative offsets', () => {
    const pw = tree.find((n) => n.n === 'Public Works');
    const streets = pw.c.find((c) => c.n === 'Streets');
    // Paving 2000 + Refund(-200) = 1800; ZeroLine excluded entirely
    assert.equal(streets.a, 1800);
    assert.ok(!streets.i.some((i) => i.d === 'ZeroLine'));
    assert.ok(streets.i.some((i) => i.d === 'Refund' && i.a === -200));
  });

  it('null function1/cat1 fall back to "Unknown"/"General"', () => {
    const unknown = tree.find((n) => n.n === 'Unknown');
    assert.ok(unknown, 'expected an "Unknown" top-level node');
    assert.equal(unknown.a, 50);
    assert.equal(unknown.c[0].n, 'General');
  });

  it('respects a configurable top column (--source-column fallback to cat1)', () => {
    const byCat = buildTree(FIXTURE, { topCol: 'cat1', subCol: 'org1', itemCol: 'org1' });
    // Top level now Police/Fire/Streets (+ "Unknown" for the null-cat1 row) rather than function names
    const names = byCat.tree.map((n) => n.n).sort();
    assert.deepEqual(names, ['Fire', 'Police', 'Streets', 'Unknown']);
    assert.equal(byCat.total, 4150); // total is column-independent
  });
});
