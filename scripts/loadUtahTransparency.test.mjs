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
  buildSalaryTree,
  SALARY_QUERY,
  DATA_SOURCE_NAME,
  ROLLUP_QUERY,
  groupRollupRows,
  ROLLUP_ENTITY_MAP,
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

// ── buildTree — fund-first compact tree (D-69-01: fund1 → org1 → cat1) ────────

// Fixture rows shaped like the documented BQ schema (fund1/org1/cat1/amount).
const FIXTURE = [
  { fund1: 'General Fund', org1: 'Police',  cat1: 'Patrol',         amount: 1000 },
  { fund1: 'General Fund', org1: 'Police',  cat1: 'Investigations', amount: 500 },
  { fund1: 'General Fund', org1: 'Fire',    cat1: 'Suppression',    amount: 800 },
  { fund1: 'Water',        org1: 'Streets', cat1: 'Paving',         amount: 2000 },
  { fund1: 'Water',        org1: 'Streets', cat1: 'Refund',         amount: '(200)' }, // offset
  { fund1: 'Water',        org1: 'Streets', cat1: 'ZeroLine',       amount: 0 },        // skipped
  { fund1: null,           org1: null,      cat1: null,             amount: 50 },        // Unknown/General
];

describe('buildTree — totals, structure, sorting, edge cases', () => {
  const { tree, total } = buildTree(FIXTURE, { topCol: 'fund1', subCol: 'org1', itemCol: 'cat1' });

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

  it('top nodes are funds (fund1), subs are departments (org1), leaves are objects (cat1)', () => {
    const gf = tree.find((n) => n.n === 'General Fund');
    assert.ok(gf, 'expected a "General Fund" top-level node (fund1)');
    const police = gf.c.find((c) => c.n === 'Police');
    assert.ok(police, 'expected a "Police" sub node (org1)');
    assert.ok(police.i.some((i) => i.d === 'Patrol'), 'expected a "Patrol" leaf (cat1)');
  });

  it('skips zero-amount rows but retains negative offsets', () => {
    const water = tree.find((n) => n.n === 'Water');
    const streets = water.c.find((c) => c.n === 'Streets');
    // Paving 2000 + Refund(-200) = 1800; ZeroLine excluded entirely
    assert.equal(streets.a, 1800);
    assert.ok(!streets.i.some((i) => i.d === 'ZeroLine'));
    assert.ok(streets.i.some((i) => i.d === 'Refund' && i.a === -200));
  });

  it('null fund1/org1 fall back to "Unknown"/"General"', () => {
    const unknown = tree.find((n) => n.n === 'Unknown');
    assert.ok(unknown, 'expected an "Unknown" top-level node');
    assert.equal(unknown.a, 50);
    assert.equal(unknown.c[0].n, 'General');
  });

  it('respects a configurable top column (top by org1 instead of fund1)', () => {
    const byOrg = buildTree(FIXTURE, { topCol: 'org1', subCol: 'fund1', itemCol: 'cat1' });
    // Top level now Police/Fire/Streets (+ "Unknown" for the null-org1 row) rather than funds
    const names = byOrg.tree.map((n) => n.n).sort();
    assert.deepEqual(names, ['Fire', 'Police', 'Streets', 'Unknown']);
    assert.equal(byOrg.total, 4150); // total is column-independent
  });
});

// ── PII-exclusion guard (D-71-01) ─────────────────────────────────────────────

/** The full list of PII column names that MUST NOT appear in the PY query or emitted tree. */
const PII_BLOCKLIST = [
  'vendor_name', 'dba_name', 'vendor_code', 'title', 'hourly_rate',
  'gender', 'account_number', 'contract_name', 'contract_number',
  'description', 'ref_id',
];

describe('PII-exclusion guard (D-71-01) — SALARY_QUERY and buildSalaryTree emit no PII', () => {
  it('SALARY_QUERY contains org1, cat1, SUM(amount), GROUP BY org1, cat1, and parameterized type', () => {
    assert.ok(SALARY_QUERY.includes('org1'), 'query must reference org1');
    assert.ok(SALARY_QUERY.includes('cat1'), 'query must reference cat1');
    assert.ok(SALARY_QUERY.toLowerCase().includes('sum(amount)'), 'query must aggregate with SUM(amount)');
    assert.ok(SALARY_QUERY.includes('GROUP BY org1, cat1'), 'query must GROUP BY org1, cat1');
    assert.ok(SALARY_QUERY.includes('type = @type'), 'query must use parameterized @type (never literal)');
  });

  it('SALARY_QUERY does NOT contain fund1', () => {
    assert.ok(!SALARY_QUERY.includes('fund1'), 'salary query must not reference fund1 (all-funds, D-71-03)');
  });

  for (const piiToken of PII_BLOCKLIST) {
    it(`SALARY_QUERY does NOT contain PII token: ${piiToken}`, () => {
      assert.ok(
        !SALARY_QUERY.includes(piiToken),
        `SALARY_QUERY must not reference PII column "${piiToken}" (D-71-01)`,
      );
    });
  }

  // Fixture rows that carry PII keys alongside the allowed columns — the tree must
  // suppress all PII and emit ONLY { n: org1-value, a: ..., c: [{ n: cat1-value, a: ... }] }.
  const PII_LADEN_FIXTURE = [
    {
      org1: 'Police - Patrol', cat1: 'Wages', amount: 65000,
      vendor_name: 'John Doe', dba_name: 'JD LLC', vendor_code: 'V123',
      title: 'Officer I', hourly_rate: 31.25, gender: 'M',
      account_number: 'AC-001', contract_name: 'PD Contract',
      contract_number: 'CN-007', description: 'Regular Pay',
      ref_id: 'REF-42',
    },
    {
      org1: 'Police - Patrol', cat1: 'Benefits', amount: 27000,
      vendor_name: 'Jane Smith', title: 'Officer I', hourly_rate: 31.25,
      gender: 'F', account_number: 'AC-002',
    },
    {
      org1: 'Fire - Administration', cat1: 'Wages', amount: 120000,
      vendor_name: 'Chief Burns', title: 'Fire Chief',
    },
  ];

  it('buildSalaryTree tree JSON contains none of the PII blocklist tokens', () => {
    const { tree } = buildSalaryTree(PII_LADEN_FIXTURE);
    const json = JSON.stringify(tree);
    for (const piiToken of PII_BLOCKLIST) {
      assert.ok(
        !json.includes(piiToken),
        `Serialized salary tree must not contain PII token "${piiToken}" (D-71-01)`,
      );
    }
  });

  it('buildSalaryTree tree JSON does not contain any fixture PII values (names/codes/rates)', () => {
    const { tree } = buildSalaryTree(PII_LADEN_FIXTURE);
    const json = JSON.stringify(tree);
    // Spot-check actual PII values from the fixture
    assert.ok(!json.includes('John Doe'), 'must not contain individual name');
    assert.ok(!json.includes('Jane Smith'), 'must not contain individual name');
    assert.ok(!json.includes('Chief Burns'), 'must not contain individual name');
    assert.ok(!json.includes('Officer I'), 'must not contain job title');
    assert.ok(!json.includes('31.25'), 'must not contain hourly rate');
    assert.ok(!json.includes('V123'), 'must not contain vendor code');
    assert.ok(!json.includes('REF-42'), 'must not contain ref_id');
  });
});

// ── buildSalaryTree shape (D-71-02) ──────────────────────────────────────────

const SALARY_FIXTURE = [
  // Dept A: 2 categories
  { org1: 'Police - Patrol',      cat1: 'Wages',    amount: 65125717 },
  { org1: 'Police - Patrol',      cat1: 'Benefits', amount: 27820236 },
  // Dept B: 2 categories
  { org1: 'Fire - Administration', cat1: 'Wages',    amount: 8000000 },
  { org1: 'Fire - Administration', cat1: 'Benefits', amount: 3000000 },
  // Zero-amount row — must be skipped
  { org1: 'Police - Patrol',      cat1: 'Wages',    amount: 0 },
];

describe('buildSalaryTree shape (D-71-02) — 2-level Department→comp-category tree', () => {
  const { tree, total } = buildSalaryTree(SALARY_FIXTURE);

  it('grand total equals sum of all non-zero amounts', () => {
    // 65125717 + 27820236 + 8000000 + 3000000 = 103945953
    assert.equal(total, 65125717 + 27820236 + 8000000 + 3000000);
  });

  it('top-level nodes have {n, a, c} keys', () => {
    for (const node of tree) {
      assert.ok('n' in node, 'top node must have n');
      assert.ok('a' in node, 'top node must have a');
      assert.ok('c' in node, 'top node must have c');
    }
  });

  it('children have {n, a} but NO i key (2-level — no 3rd item level)', () => {
    for (const node of tree) {
      for (const child of node.c) {
        assert.ok('n' in child, 'child must have n');
        assert.ok('a' in child, 'child must have a');
        assert.ok(!('i' in child), 'child must NOT have i key (not 3-level)');
      }
    }
  });

  it('each department total equals the sum of its category children', () => {
    for (const node of tree) {
      const childSum = node.c.reduce((s, c) => s + c.a, 0);
      assert.equal(node.a, childSum, `dept "${node.n}" total != sum of children`);
    }
  });

  it('top-level nodes are sorted descending by amount', () => {
    const amounts = tree.map((n) => n.a);
    const sorted = [...amounts].sort((x, y) => y - x);
    assert.deepEqual(amounts, sorted);
  });

  it('category children are sorted descending by amount', () => {
    for (const node of tree) {
      const amounts = node.c.map((c) => c.a);
      const sorted = [...amounts].sort((x, y) => y - x);
      assert.deepEqual(amounts, sorted, `children of "${node.n}" not sorted desc`);
    }
  });

  it('zero-amount rows are skipped', () => {
    // The zero row was for Police - Patrol / Wages — Wages total should be exactly 65125717, not 65125717+0
    const police = tree.find((n) => n.n === 'Police - Patrol');
    assert.ok(police, 'Police - Patrol node must exist');
    const wages = police.c.find((c) => c.n === 'Wages');
    assert.ok(wages, 'Wages child must exist');
    assert.equal(wages.a, 65125717, 'Wages total must be exactly 65125717 (zero row skipped)');
  });

  it('category names match the Wages/Benefits shape from the Provo FY2024 probe', () => {
    const police = tree.find((n) => n.n === 'Police - Patrol');
    const catNames = police.c.map((c) => c.n).sort();
    assert.deepEqual(catNames, ['Benefits', 'Wages']);
  });

  it('there are exactly 2 departments in the fixture', () => {
    assert.equal(tree.length, 2);
  });
});

// ── ROLLUP_QUERY PII-exclusion guard (D-71-01, Phase 71.1) ───────────────────

/** PII columns that must NEVER appear in the rollup query or in any emitted tree. */
const ROLLUP_PII_BLOCKLIST = [
  'vendor_name', 'dba_name', 'vendor_code', 'title', 'hourly_rate',
  'gender', 'account_number', 'contract_name', 'contract_number',
  'description', 'ref_id',
];

describe('ROLLUP_QUERY PII-exclusion guard (D-71-01, Phase 71.1)', () => {
  it('ROLLUP_QUERY contains entity_name, fiscal_year, type, fund1, org1, cat1, SUM(amount)', () => {
    assert.ok(ROLLUP_QUERY.includes('entity_name'), 'must select entity_name');
    assert.ok(ROLLUP_QUERY.includes('fiscal_year'), 'must select fiscal_year');
    assert.ok(ROLLUP_QUERY.includes('type'), 'must select type');
    assert.ok(ROLLUP_QUERY.includes('fund1'), 'must select fund1 (for EX/RV 3-level tree)');
    assert.ok(ROLLUP_QUERY.includes('org1'), 'must select org1');
    assert.ok(ROLLUP_QUERY.includes('cat1'), 'must select cat1');
    assert.ok(ROLLUP_QUERY.toLowerCase().includes('sum(amount)'), 'must aggregate with SUM(amount)');
  });

  it('ROLLUP_QUERY uses IN UNNEST(@entities) — parameterized, not string-interpolated', () => {
    assert.ok(
      ROLLUP_QUERY.includes('IN UNNEST(@entities)'),
      'must use parameterized @entities via UNNEST (never string-interpolated names)',
    );
  });

  it('ROLLUP_QUERY has BETWEEN 2014 AND 2025 fiscal year scope', () => {
    assert.ok(
      ROLLUP_QUERY.includes('BETWEEN 2014 AND 2025'),
      'must include the FY2014–2025 range filter (excludes FY2026+)',
    );
  });

  it('ROLLUP_QUERY GROUP BY includes all 6 non-PII columns', () => {
    // GROUP BY entity_name, fiscal_year, type, fund1, org1, cat1
    assert.ok(ROLLUP_QUERY.includes('GROUP BY entity_name, fiscal_year, type, fund1, org1, cat1'));
  });

  it('ROLLUP_QUERY does NOT contain LIKE (exact match required — decoy guard)', () => {
    assert.ok(!ROLLUP_QUERY.includes('LIKE'), 'must not use LIKE — entity_name must match EXACTLY (decoys exist)');
  });

  for (const piiToken of ROLLUP_PII_BLOCKLIST) {
    it(`ROLLUP_QUERY does NOT contain PII token: ${piiToken}`, () => {
      assert.ok(
        !ROLLUP_QUERY.includes(piiToken),
        `ROLLUP_QUERY must not reference PII column "${piiToken}" (D-71-01)`,
      );
    });
  }

  // PII-laden fixture simulating rows returned from the rollup query but carrying extra
  // PII-like keys (in practice BigQuery only returns the projected columns, but we verify
  // that groupRollupRows discards anything beyond the 6 allowed columns + amount).
  const ROLLUP_PII_FIXTURE = [
    {
      entity_name: 'Provo City', fiscal_year: 2024, type: 'PY',
      fund1: 'General', org1: 'Police', cat1: 'Wages', amount: 1000000,
      vendor_name: 'John Doe', title: 'Officer I', hourly_rate: 31.25,
      gender: 'M', ref_id: 'REF-99', description: 'Regular Pay',
    },
    {
      entity_name: 'Provo City', fiscal_year: 2024, type: 'PY',
      fund1: 'General', org1: 'Police', cat1: 'Benefits', amount: 400000,
      vendor_name: 'Jane Smith', title: 'Officer II', gender: 'F',
    },
    {
      entity_name: 'Provo City', fiscal_year: 2024, type: 'EX',
      fund1: 'General Fund', org1: 'Fire', cat1: 'Suppression', amount: 5000000,
      vendor_name: 'ACME Corp', contract_name: 'Fire Contract',
      contract_number: 'CN-001', account_number: 'AC-999',
    },
  ];

  it('groupRollupRows trees built from PII-laden fixture contain no PII tokens', () => {
    const groups = groupRollupRows(ROLLUP_PII_FIXTURE);
    const json = JSON.stringify(groups.map((g) => g.tree));
    for (const piiToken of ROLLUP_PII_BLOCKLIST) {
      assert.ok(
        !json.includes(piiToken),
        `Tree JSON from groupRollupRows must not contain PII key "${piiToken}"`,
      );
    }
    // Spot-check actual PII values
    assert.ok(!json.includes('John Doe'), 'must not contain individual name');
    assert.ok(!json.includes('Jane Smith'), 'must not contain individual name');
    assert.ok(!json.includes('31.25'), 'must not contain hourly rate');
    assert.ok(!json.includes('REF-99'), 'must not contain ref_id value');
  });
});

// ── groupRollupRows shape (Phase 71.1) ────────────────────────────────────────

// Fixture: 2 entities × 2 FYs × EX/RV/PY + a FY2026 row to confirm exclusion
// + a non-mapped entity to confirm exclusion + a multi-fund PY pair to confirm
// fund1-collapse.
const ENTITY_A = 'Provo City';   // a real mapped city
const ENTITY_B = 'Davis County'; // a real mapped county
const NON_MAPPED = 'North Ogden City'; // NOT in ROLLUP_ENTITY_MAP — decoy

const ROLLUP_FIXTURE = [
  // ENTITY_A FY2024 EX — 2 funds × 1 dept each
  { entity_name: ENTITY_A, fiscal_year: 2024, type: 'EX', fund1: 'General Fund', org1: 'Police', cat1: 'Patrol', amount: 1000 },
  { entity_name: ENTITY_A, fiscal_year: 2024, type: 'EX', fund1: 'Water', org1: 'Streets', cat1: 'Paving', amount: 500 },
  // ENTITY_A FY2024 RV
  { entity_name: ENTITY_A, fiscal_year: 2024, type: 'RV', fund1: 'General Fund', org1: 'Taxes', cat1: 'Property', amount: 800 },
  // ENTITY_A FY2024 PY — two funds for same dept/cat to test fund1-collapse
  { entity_name: ENTITY_A, fiscal_year: 2024, type: 'PY', fund1: 'General', org1: 'Police', cat1: 'Wages', amount: 300 },
  { entity_name: ENTITY_A, fiscal_year: 2024, type: 'PY', fund1: 'Special', org1: 'Police', cat1: 'Wages', amount: 200 },
  { entity_name: ENTITY_A, fiscal_year: 2024, type: 'PY', fund1: 'General', org1: 'Fire', cat1: 'Benefits', amount: 150 },
  // ENTITY_A FY2025 EX
  { entity_name: ENTITY_A, fiscal_year: 2025, type: 'EX', fund1: 'General Fund', org1: 'Parks', cat1: 'Maintenance', amount: 2000 },
  // ENTITY_B FY2024 EX
  { entity_name: ENTITY_B, fiscal_year: 2024, type: 'EX', fund1: 'General Fund', org1: 'Admin', cat1: 'Personnel', amount: 9000 },
  // FY2026 row — must be EXCLUDED (fiscal_year > 2025)
  { entity_name: ENTITY_A, fiscal_year: 2026, type: 'EX', fund1: 'General Fund', org1: 'IT', cat1: 'Software', amount: 3000 },
  // Non-mapped entity — must be EXCLUDED
  { entity_name: NON_MAPPED, fiscal_year: 2024, type: 'EX', fund1: 'General Fund', org1: 'Admin', cat1: 'Personnel', amount: 5000 },
];

describe('groupRollupRows shape (Phase 71.1)', () => {
  const groups = groupRollupRows(ROLLUP_FIXTURE);

  it('ROLLUP_ENTITY_MAP contains exactly 15 entries (10 cities + 5 counties)', () => {
    assert.equal(ROLLUP_ENTITY_MAP.length, 15);
    const cities = ROLLUP_ENTITY_MAP.filter((e) => e.entityType === 'city');
    const counties = ROLLUP_ENTITY_MAP.filter((e) => e.entityType === 'county');
    assert.equal(cities.length, 10, 'must have 10 cities');
    assert.equal(counties.length, 5, 'must have 5 counties');
  });

  it('FY2026 rows are excluded from groupRollupRows output', () => {
    const fy2026 = groups.filter((g) => g.fiscalYear === 2026);
    assert.equal(fy2026.length, 0, 'FY2026 rows must be excluded');
  });

  it('non-mapped entity rows are excluded from groupRollupRows output', () => {
    const nonMapped = groups.filter((g) => g.entityName === NON_MAPPED);
    assert.equal(nonMapped.length, 0, 'non-mapped entity rows must be excluded');
  });

  it('correct number of (entity, FY, type) groups produced from the fixture', () => {
    // ENTITY_A FY2024: EX, RV, PY = 3; ENTITY_A FY2025: EX = 1; ENTITY_B FY2024: EX = 1
    // Total = 5 groups (FY2026 and non-mapped excluded)
    assert.equal(groups.length, 5, `expected 5 groups, got ${groups.length}`);
  });

  it('each group has entityName, fiscalYear, type, datasetType, tree, total, entityType fields', () => {
    for (const g of groups) {
      assert.ok('entityName' in g, 'must have entityName');
      assert.ok('fiscalYear' in g, 'must have fiscalYear');
      assert.ok('type' in g, 'must have type');
      assert.ok('datasetType' in g, 'must have datasetType');
      assert.ok('tree' in g, 'must have tree');
      assert.ok('total' in g, 'must have total');
      assert.ok('entityType' in g, 'must have entityType');
    }
  });

  it('EX groups produce a 3-level fund->org->cat tree (has c with i arrays)', () => {
    const exGroups = groups.filter((g) => g.type === 'EX');
    assert.ok(exGroups.length > 0, 'must have EX groups');
    for (const g of exGroups) {
      assert.ok(Array.isArray(g.tree), 'tree must be an array');
      for (const fund of g.tree) {
        assert.ok('n' in fund && 'a' in fund && 'c' in fund, 'fund node must have n,a,c');
        for (const dept of fund.c) {
          assert.ok('n' in dept && 'a' in dept && 'i' in dept, 'dept node must have n,a,i');
        }
      }
    }
  });

  it('RV groups produce a 3-level fund->org->cat tree (has c with i arrays)', () => {
    const rvGroups = groups.filter((g) => g.type === 'RV');
    assert.ok(rvGroups.length > 0, 'must have RV groups');
    for (const g of rvGroups) {
      for (const fund of g.tree) {
        assert.ok('c' in fund, 'fund node must have c');
        for (const dept of fund.c) {
          assert.ok('i' in dept, 'dept node must have i (3-level)');
        }
      }
    }
  });

  it('PY groups produce a 2-level dept->cat tree (no i key on children)', () => {
    const pyGroups = groups.filter((g) => g.type === 'PY');
    assert.ok(pyGroups.length > 0, 'must have PY groups');
    for (const g of pyGroups) {
      for (const dept of g.tree) {
        assert.ok('n' in dept && 'a' in dept && 'c' in dept, 'dept node must have n,a,c');
        for (const cat of dept.c) {
          assert.ok('n' in cat && 'a' in cat, 'cat leaf must have n,a');
          assert.ok(!('i' in cat), 'cat leaf must NOT have i (2-level, not 3)');
        }
      }
    }
  });

  it('PY fund1-collapse: two fund rows for the same dept/cat are summed into one leaf', () => {
    // Fixture: ENTITY_A FY2024 PY Police/Wages: General=300 + Special=200 → collapsed 500
    const pyGroup = groups.find(
      (g) => g.entityName === ENTITY_A && g.fiscalYear === 2024 && g.type === 'PY',
    );
    assert.ok(pyGroup, 'must find ENTITY_A FY2024 PY group');
    const police = pyGroup.tree.find((n) => n.n === 'Police');
    assert.ok(police, 'must find Police dept in PY tree');
    const wages = police.c.find((c) => c.n === 'Wages');
    assert.ok(wages, 'must find Wages cat');
    assert.equal(wages.a, 500, 'fund1-collapsed Wages total must be 300+200=500');
    // Confirm no fund1 level in the tree (2-level only)
    for (const dept of pyGroup.tree) {
      // No child should have an 'i' key — PY is dept→cat, not fund→dept→cat
      for (const cat of dept.c) {
        assert.ok(!('i' in cat), 'PY tree must be 2-level (no i on cat leaves)');
      }
    }
  });

  it('PY group total equals the sum across all funds (fund1-collapsed)', () => {
    const pyGroup = groups.find(
      (g) => g.entityName === ENTITY_A && g.fiscalYear === 2024 && g.type === 'PY',
    );
    // Police/Wages 300+200=500 + Fire/Benefits 150 = 650
    assert.equal(pyGroup.total, 650, 'PY total must be 650 (all funds collapsed)');
  });

  it('EX group total matches the sum of its fixture rows', () => {
    const exGroup = groups.find(
      (g) => g.entityName === ENTITY_A && g.fiscalYear === 2024 && g.type === 'EX',
    );
    // General Fund/Police/Patrol 1000 + Water/Streets/Paving 500 = 1500
    assert.equal(exGroup.total, 1500, 'EX FY2024 total must be 1500');
  });

  it('entityType is correct for cities and counties', () => {
    const cityGroup = groups.find((g) => g.entityName === ENTITY_A);
    const countyGroup = groups.find((g) => g.entityName === ENTITY_B);
    assert.equal(cityGroup.entityType, 'city', 'Provo City must have entityType city');
    assert.equal(countyGroup.entityType, 'county', 'Davis County must have entityType county');
  });

  it('datasetType maps correctly for EX, RV, PY', () => {
    const exGroup = groups.find((g) => g.type === 'EX');
    const rvGroup = groups.find((g) => g.type === 'RV');
    const pyGroup = groups.find((g) => g.type === 'PY');
    assert.equal(exGroup.datasetType, 'operating');
    assert.equal(rvGroup.datasetType, 'revenue');
    assert.equal(pyGroup.datasetType, 'salaries');
  });
});
