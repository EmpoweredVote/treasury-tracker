/**
 * Behavioral unit tests for normalizeDeptLabel and parseMoney
 * exported from scripts/loadCASalaries.js (Phase 55 — SAL-02 gap closure).
 *
 * Run with: npx vitest run scripts/loadCASalaries.test.mjs
 *
 * CRITICAL: Set a dummy SUPABASE_SERVICE_KEY BEFORE the import to prevent
 * the top-level guard (`if (!SUPABASE_KEY) process.exit(1)`) from killing
 * the test runner.
 */

process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-key-not-used';

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { normalizeDeptLabel, parseMoney } from './loadCASalaries.js';

// ── normalizeDeptLabel ─────────────────────────────────────────────────────────
//
// Gap requirement: lock in the exact label gap-closure behavior so regressions
// in the expansion map or acronym-preservation logic are caught immediately.

describe('normalizeDeptLabel — approved high-confidence token expansions', () => {

  it('expands "Pw Sust" to "Public Works Sustainability"', () => {
    // pw → "Public Works", sust → "Sustainability"
    assert.equal(normalizeDeptLabel('Pw Sust'), 'Public Works Sustainability');
  });

  it('expands "Pw Trsp" to "Public Works Transportation"', () => {
    // pw → "Public Works", trsp → "Transportation"
    assert.equal(normalizeDeptLabel('Pw Trsp'), 'Public Works Transportation');
  });

  it('expands "Hum Res" to "Human Resources"', () => {
    // hum → "Human", res → "Resources"
    assert.equal(normalizeDeptLabel('Hum Res'), 'Human Resources');
  });

  it('expands "City Cnl" to "City Council"', () => {
    // city → title-cased "City", cnl → "Council"
    assert.equal(normalizeDeptLabel('City Cnl'), 'City Council');
  });

  it('expands "Admin Services" to "Administrative Services"', () => {
    // admin → "Administrative", Services → title-cased "Services"
    assert.equal(normalizeDeptLabel('Admin Services'), 'Administrative Services');
  });

});

describe('normalizeDeptLabel — genuinely ambiguous codes left as-reported', () => {

  it('leaves "Com Eng" as "Com Eng" (no expansion for "com" or "eng")', () => {
    // Neither "com" nor "eng" is in the approved expansion map.
    // Each token is title-cased individually.
    assert.equal(normalizeDeptLabel('Com Eng'), 'Com Eng');
  });

  it('leaves "Pd Sustainability" as "Pd Sustainability" (not a PW expansion)', () => {
    // "pd" is not in the map; title-cased → "Pd".
    // "Sustainability" → title-cased → "Sustainability".
    assert.equal(normalizeDeptLabel('Pd Sustainability'), 'Pd Sustainability');
  });

  it('leaves "Citycnl2" as "Citycnl2" (fused ambiguous token, not expanded)', () => {
    // Single token; not in map; not all-caps 2-4 chars; not a roman numeral.
    // title-case of "citycnl2" → "Citycnl2".
    assert.equal(normalizeDeptLabel('Citycnl2'), 'Citycnl2');
  });

});

describe('normalizeDeptLabel — preserves already-clean multi-word names', () => {

  it('preserves "Public Safety" unchanged', () => {
    // "Public" and "Safety" are ordinary words; title-cased they produce themselves.
    assert.equal(normalizeDeptLabel('Public Safety'), 'Public Safety');
  });

  it('preserves "Community Development" unchanged', () => {
    assert.equal(normalizeDeptLabel('Community Development'), 'Community Development');
  });

});

describe('normalizeDeptLabel — preserves roman numerals and short all-caps acronyms', () => {

  it('preserves roman numeral token "II" as uppercase "II"', () => {
    // ROMAN_NUMERAL regex matches "II"; tok.toUpperCase() keeps it "II".
    // Here it appears as a suffix in a job-title-style dept label.
    assert.equal(normalizeDeptLabel('Dispatcher II'), 'Dispatcher II');
  });

  it('preserves all-caps acronym "IT" without lowercasing', () => {
    // /^[A-Z0-9]{2,4}$/ matches "IT" — it is returned as-is.
    assert.equal(normalizeDeptLabel('IT'), 'IT');
  });

  it('preserves "IT" when mixed with other words: "IT Services" → "IT Services"', () => {
    assert.equal(normalizeDeptLabel('IT Services'), 'IT Services');
  });

  it('a bare roman numeral token "IV" in context: "Class IV" → "Class IV"', () => {
    // ROMAN_NUMERAL matches "iv" case-insensitively; toUpperCase → "IV".
    assert.equal(normalizeDeptLabel('Class IV'), 'Class IV');
  });

});

describe('normalizeDeptLabel — empty / whitespace / null input returns "UNKNOWN"', () => {

  it('empty string "" → "UNKNOWN"', () => {
    assert.equal(normalizeDeptLabel(''), 'UNKNOWN');
  });

  it('whitespace-only "   " → "UNKNOWN"', () => {
    assert.equal(normalizeDeptLabel('   '), 'UNKNOWN');
  });

  it('null → "UNKNOWN"', () => {
    assert.equal(normalizeDeptLabel(null), 'UNKNOWN');
  });

  it('undefined → "UNKNOWN"', () => {
    assert.equal(normalizeDeptLabel(undefined), 'UNKNOWN');
  });

});

// ── parseMoney ────────────────────────────────────────────────────────────────
//
// Gap requirement: lock in WR-01 fix — thousands separators must be stripped
// before parsing so "1,234.56" is not silently truncated to 1 by parseFloat.

describe('parseMoney — WR-01: thousands separators stripped, not truncated', () => {

  it('"1,234.56" → 1234.56 (not truncated to 1)', () => {
    // WR-01 core case: parseFloat("1,234.56") would give 1; Number(stripped) gives 1234.56
    assert.equal(parseMoney('1,234.56'), 1234.56);
  });

  it('"$1,000" → 1000 (dollar sign and comma both stripped)', () => {
    assert.equal(parseMoney('$1,000'), 1000);
  });

  it('plain integer string "150535676" → 150535676 (no separator, no truncation)', () => {
    assert.equal(parseMoney('150535676'), 150535676);
  });

});

describe('parseMoney — empty, null, and undefined inputs return 0', () => {

  it('"" → 0', () => {
    assert.equal(parseMoney(''), 0);
  });

  it('null → 0', () => {
    assert.equal(parseMoney(null), 0);
  });

  it('undefined → 0', () => {
    assert.equal(parseMoney(undefined), 0);
  });

});

describe('parseMoney — non-numeric input returns 0', () => {

  it('"abc" → 0', () => {
    assert.equal(parseMoney('abc'), 0);
  });

});
