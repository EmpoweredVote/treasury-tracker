/**
 * Which source families are registered — the gate's matching logic.
 *
 * ⚠⚠⚠ THE GATE TESTS FOR A MATCH, NEVER FOR A NON-`unknown` VALUE. 24,778 rows
 * are honestly `unknown` on audit grade and that is CORRECT — SCOPE-01
 * deliberately classified 33.2% as unknown rather than guess. A family whose
 * considered, cited answer is `unknown` passes. Making `unknown` illegal is
 * the anti-goal, and the test below pins it.
 *
 * ⚠⚠ Three axes, not four. Measured 2026-11-01 across all 5,929 live families:
 * only 62 (1.0%) match all four, because accounting_basis has 5 entries and is
 * `unknown` on 99.94% of rows. An all-four gate refuses every loader in the
 * repo. The active three — audit_grade, fund_scope, basis — pass for 1,966
 * families covering 530,717 rows (90.6%).
 */

import { describe, it, expect } from 'vitest';
import {
  ACTIVE_AXES, matchedAxes, missingAxes, mirrorRows, suggestEntry,
} from '../scripts/lib/registeredFamilies.mjs';
import { AUDIT_GRADE_REGISTRY } from '../scripts/data/auditGradeRegistry.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { ACCOUNTING_BASIS_REGISTRY } from '../scripts/data/accountingBasisRegistry.mjs';

const OHIO = 'Ohio Auditor of State Summarized Annual Financial Reports';
const LA = 'Los Angeles ACFR — General Fund Revenue by Source (FY2023 actual, GAAP basis)';

describe('ACTIVE_AXES', () => {
  it('is the three axes that actually carry answers, not all four', () => {
    expect(ACTIVE_AXES).toEqual(['audit_grade', 'fund_scope', 'basis']);
  });
});

describe('matchedAxes', () => {
  it('returns the matching entry id per axis for a registered family', () => {
    const m = matchedAxes(LA);
    expect(m.audit_grade).toBe('la-city-acfr-gf');
    expect(m.fund_scope).toBeTruthy();
    expect(m.basis).toBeTruthy();
  });

  it('returns null on every axis for a family nobody has registered', () => {
    expect(matchedAxes('Transparent Utah')).toEqual({
      audit_grade: null, fund_scope: null, basis: null, accounting_basis: null,
    });
  });

  // ⚠ Review Focus #2 — these names are full of regex metacharacters: an em
  // dash, parentheses, a period. A family name is data, never a pattern.
  it('treats the family name as a literal, not a pattern', () => {
    expect(matchedAxes('Ohio Auditor of State Summarized Annual Financial Reports.')
      .audit_grade).toBeNull();
    expect(matchedAxes(OHIO).audit_grade).toBeTruthy();
  });

  it('is empty for a non-string or blank name rather than throwing', () => {
    for (const bad of [null, undefined, '', '   ', 42]) {
      expect(matchedAxes(bad).audit_grade, String(bad)).toBeNull();
    }
  });
});

describe('missingAxes', () => {
  it('names only the active axes a family fails', () => {
    expect(missingAxes('Transparent Utah')).toEqual(['audit_grade', 'fund_scope', 'basis']);
  });

  it('never reports accounting_basis, which is out of scope', () => {
    // CA SCO matches the active three but NOT accounting_basis. If
    // accounting_basis were in scope this would be non-empty, and the gate
    // would refuse one of the largest families in the database.
    expect(missingAxes('CA State Controller - Revenues')).toEqual([]);
    expect(matchedAxes('CA State Controller - Revenues').accounting_basis).toBeNull();
  });

  // ⚠⚠⚠ THE ANTI-GOAL, PINNED. An entry whose cited answer is `unknown` is a
  // considered answer and must pass. budgetAxes.matchFor() returns
  // {entryId: null} for exactly this case, which is why this module does not
  // reuse it.
  it('counts an entry whose value is unknown as registered', () => {
    const registries = {
      audit_grade: [{ id: 'x-unknown', match: /^Test Family$/, value: 'unknown' }],
      fund_scope: [{ id: 'x-fs', match: /^Test Family$/, value: 'general_fund' }],
      basis: [{ id: 'x-b', match: /^Test Family$/, value: 'actual' }],
      accounting_basis: [],
    };
    expect(missingAxes('Test Family', registries)).toEqual([]);
    expect(matchedAxes('Test Family', registries).audit_grade).toBe('x-unknown');
  });
});

describe('mirrorRows', () => {
  const rows = mirrorRows();

  it('emits one row per entry across all four registries', () => {
    expect(rows).toHaveLength(
      AUDIT_GRADE_REGISTRY.length + FUND_SCOPE_REGISTRY.length
      + BASIS_REGISTRY.length + ACCOUNTING_BASIS_REGISTRY.length,
    );
  });

  it('keys every row by axis and entry id', () => {
    const keys = rows.map((r) => `${r.axis}|${r.entry_id}`);
    expect(new Set(keys).size).toBe(rows.length);
  });

  // ⚠ Review Focus #1 — the pattern that reaches Postgres must be the same
  // pattern JS matched with. Postgres ARE accepts (?:…) and \d verbatim, so
  // the source is passed through; only the `i` flag needs expressing, as an
  // inline (?i) prefix.
  it('passes the JS source through, with the i flag made inline', () => {
    for (const axis of Object.keys(matchedAxes('x'))) {
      // nothing to assert per axis here; the shape check is below
      expect(typeof axis).toBe('string');
    }
    const insensitive = BASIS_REGISTRY.filter((e) => e.match.flags.includes('i'));
    expect(insensitive.length, 'basisRegistry should still carry an i-flagged entry')
      .toBeGreaterThan(0);
    for (const e of insensitive) {
      const row = rows.find((r) => r.axis === 'basis' && r.entry_id === e.id);
      expect(row.pattern).toBe(`(?i)${e.match.source}`);
    }
    const sensitive = AUDIT_GRADE_REGISTRY.find((e) => !e.match.flags.includes('i'));
    const srow = rows.find((r) => r.axis === 'audit_grade' && r.entry_id === sensitive.id);
    expect(srow.pattern).toBe(sensitive.match.source);
  });

  // ⚠⚠⚠ THE STATIC HALF OF REVIEW FOCUS #1, AND IT RUNS IN CI. The live
  // parity proof (verify:registry-parity) needs a database, and this repo
  // deliberately keeps no service-role key in Actions — so it runs only when
  // a human remembers. This test needs nothing and runs every time.
  //
  // Postgres ARE accepts (?:…), \d and {n} verbatim, which is why the
  // patterns are stored unchanged. It does NOT share JS's meaning for every
  // escape: `\b` is a BACKSPACE in ARE but a word boundary in JS, so a future
  // entry using it would silently never match and the gate would refuse a
  // family that IS registered — Review Focus #1 happening with every check
  // green. `\B`, `\A`, `\Z` and `\G` are the same class of hazard.
  it('uses no regex construct whose meaning differs in Postgres ARE', () => {
    const HAZARDS = [
      [/\\b/, '\\b — word boundary in JS, BACKSPACE in Postgres ARE'],
      [/\\B/, '\\B — non-boundary in JS, undefined in ARE'],
      [/\\A/, '\\A — not portable'],
      [/\\Z/, '\\Z — not portable'],
      [/\\G/, '\\G — not portable'],
      [/\(\?<[=!]/, 'lookbehind — unsupported in ARE'],
      [/\\p\{/, '\\p{…} unicode property — differs in ARE'],
    ];
    const bad = [];
    for (const { axis, entry_id: id, pattern } of rows) {
      for (const [re, why] of HAZARDS) if (re.test(pattern)) bad.push(`${axis}/${id}: ${why}`);
    }
    expect(bad).toEqual([]);
  });

  it('carries no flag other than i anywhere in the live registries', () => {
    const all = [
      ...AUDIT_GRADE_REGISTRY, ...FUND_SCOPE_REGISTRY,
      ...BASIS_REGISTRY, ...ACCOUNTING_BASIS_REGISTRY,
    ];
    const exotic = all.filter((e) => e.match.flags.replace('i', '') !== '');
    expect(exotic.map((e) => `${e.id}:${e.match.flags}`)).toEqual([]);
  });
});

describe('suggestEntry', () => {
  const text = suggestEntry('Wisconsin DOR Municipal Report', [2020, 2021, 2022]);

  it('names the family verbatim and escapes it for a regex', () => {
    expect(text).toContain('Wisconsin DOR Municipal Report');
  });

  it('enumerates the years present, so a later year cannot self-grade', () => {
    // ⚠ Assert on the `match:` LINE, not the whole text — the comment beside
    // it deliberately mentions FY\d{4} to say why it is not used.
    const matchLine = text.split('\n').find((l) => l.trim().startsWith('match:'));
    const withYears = suggestEntry('X Report FY2024 actual', [2020, 2021, 2022]);
    const yearLine = withYears.split('\n').find((l) => l.trim().startsWith('match:'));
    expect(yearLine).toContain('FY(?:2020|2021|2022)');
    expect(yearLine).not.toMatch(/\\d\{4\}/);
    expect(matchLine).toBeTruthy();
  });

  it('leaves the value and the evidence blank — the parts a human must supply', () => {
    expect(text).toMatch(/value:\s*TODO/);
    expect(text).toMatch(/document:\s*''/);
  });

  it('escapes metacharacters in the family name', () => {
    const t = suggestEntry('Foo (Bar) — Baz.', []);
    expect(t).toContain('\\(Bar\\)');
    expect(t).toContain('Baz\\.');
  });
});
