/**
 * The city-tier list is consulted in six places. This is the guard that stops
 * them drifting apart again.
 *
 * ⚠⚠ HOW THEY DRIFTED. Measured 2026-09-07, `borough` was present in all three
 * `verify-*-tether.mjs` scripts and absent from every list the PRODUCT reads:
 *
 *   src/utils/essentialsCoverage.ts          CITY_TIER_TYPES   no borough
 *   src/utils/triviaCoverage.ts              CITY_TIER_TYPES   no borough
 *   src/components/CitiesInCountyPanel.tsx   CHILD_TYPES       no borough
 *   scripts/verify-phase133-tether.mjs       private copy      HAS borough
 *   scripts/verify-seattle-tether.mjs        private copy      HAS borough
 *   scripts/verify-wa-tether.mjs             private copy      HAS borough
 *
 * So Pennsylvania's 949 boroughs matched no coverage record and never appeared
 * under their own county, while the three scripts whose whole job is verifying
 * the tether each held a copy of the list that said they were fine.
 *
 * ⭐⭐ A GUARD THAT KEEPS ITS OWN COPY OF THE LIST CANNOT CATCH THE LIST BEING
 * WRONG. The three TS/TSX consumers now import the single definition, so they
 * cannot drift at all. The three .mjs scripts are run by `node` directly and
 * cannot import a .ts module, so this test reads their SOURCE and asserts the
 * literal matches — the only mechanism that covers them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { CITY_TIER_TYPES, isCityTier } from '../src/utils/cityTierTypes.ts';

/** The .mjs scripts node runs directly, each with an inline copy. */
const SCRIPTS_WITH_A_PRIVATE_COPY = [
  'scripts/verify-phase133-tether.mjs',
  'scripts/verify-seattle-tether.mjs',
  'scripts/verify-wa-tether.mjs',
];

/**
 * ⚠⚠ STRIP COMMENTS BEFORE PULLING QUOTED LITERALS OUT OF SOURCE.
 *
 * A comment containing an apostrophe — Pennsylvania's, the entity's — makes a
 * naive sweep for quoted strings treat that apostrophe as an opening quote and
 * swallow the rest of the block. It does not fail loudly: it returns a list of
 * roughly the right LENGTH full of comment fragments, so a count check still
 * passes and only a value-level assertion catches it. Hit while writing this
 * test, on a comment written three edits earlier in the same session.
 */
function quotedLiterals(text, commentPattern) {
  return [...text.replace(commentPattern, '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('the canonical city-tier set', () => {
  it('contains every incorporated-place type TT stores', () => {
    // Counted in the database 2026-09-07: city 2,790 · township 2,798 ·
    // borough 949 · village 253 · town 39 · municipality 30.
    expect([...CITY_TIER_TYPES].sort()).toEqual(
      ['borough', 'city', 'municipality', 'town', 'township', 'village'],
    );
  });

  it('excludes every tier that is not an incorporated place', () => {
    for (const t of ['county', 'state', 'federal', 'nonprofit',
      'special_district', 'school_district', 'library', 'conservancy']) {
      expect(isCityTier(t), t).toBe(false);
    }
  });

  it('treats a null or unknown type as not city-tier', () => {
    expect(isCityTier(null)).toBe(false);
    expect(isCityTier(undefined)).toBe(false);
    expect(isCityTier('')).toBe(false);
    expect(isCityTier('burgh')).toBe(false);
  });
});

describe('the three node-run scripts that cannot import it', () => {
  for (const rel of SCRIPTS_WITH_A_PRIVATE_COPY) {
    it(`${rel} declares exactly the canonical set`, () => {
      const src = readFileSync(rel, 'utf8');
      const m = /CITY_TIER_TYPES\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(src);
      // ⚠ A gate that cannot find its subject must FAIL, not pass. If the
      // declaration is reshaped, this test must go red rather than silently
      // stop checking — the #138 lesson.
      expect(m, `no inline CITY_TIER_TYPES literal found in ${rel}`).not.toBeNull();
      const declared = quotedLiterals(m[1], /\/\/[^\n]*/g).sort();
      expect(declared.length, `${rel} declared an empty set`).toBeGreaterThan(0);
      expect(declared, rel).toEqual([...CITY_TIER_TYPES].sort());
    });
  }

  it('checks a non-zero number of scripts', () => {
    // ⚠⚠ If the loop above ever iterates nothing, every assertion in it passes
    // vacuously and this file reports success having verified nothing.
    expect(SCRIPTS_WITH_A_PRIVATE_COPY.length).toBe(3);
  });
});

/**
 * ⚠⚠ THE ROOT CAUSE, AND THE GUARD THAT WOULD HAVE CAUGHT IT.
 *
 * `borough` reached the database and the CHECK constraint (migration
 * 20260903000000) but never reached the entity_type TypeScript union. So it
 * COULD NOT be added to CITY_TIER_TYPES or SOURCE_CHIP_ENTITY_TYPES — tsc would
 * have rejected it — and the omission read as a deliberate choice instead of as
 * a compile error nobody had hit yet. A clean build surfaced it, and only
 * because the tsbuildinfo was deleted first.
 *
 * Three declarations have to stay in step: the CHECK constraint, the TS union,
 * and the city-tier set. This asserts the first two agree exactly and that the
 * third is a subset, so the next new entity type cannot repeat the pattern.
 */
describe('the entity_type CHECK constraint, the TS union and this set stay in step', () => {
  /** Values from the newest migration that (re)defines the CHECK constraint. */
  function checkConstraintValues() {
    const dir = 'supabase/migrations';
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => readFileSync(`${dir}/${f}`, 'utf8').includes('municipalities_entity_type_check'))
      .sort();
    expect(files.length, 'no migration defines municipalities_entity_type_check').toBeGreaterThan(0);
    const newest = files[files.length - 1];
    const src = readFileSync(`${dir}/${newest}`, 'utf8');
    const m = /CHECK\s*\(\s*entity_type\s+IN\s*\(([\s\S]*?)\)\s*\)/i.exec(src);
    expect(m, `could not parse the CHECK list out of ${newest}`).not.toBeNull();
    return quotedLiterals(m[1], /--[^\n]*/g);
  }

  /** Literals from the entity_type union in src/types/budget.ts. */
  function tsUnionValues() {
    const src = readFileSync('src/types/budget.ts', 'utf8');
    const m = /entity_type:\s*([\s\S]*?);/.exec(src);
    expect(m, 'could not find the entity_type union').not.toBeNull();
    return quotedLiterals(m[1], /\/\/[^\n]*/g);
  }

  it('the TS union admits every value the database allows', () => {
    const check = checkConstraintValues();
    const union = tsUnionValues();
    expect(check.length, 'parsed an empty CHECK list').toBeGreaterThan(5);
    const missing = check.filter((v) => !union.includes(v));
    expect(missing, 'in the CHECK constraint but missing from the TS union').toEqual([]);
  });

  it('the TS union claims nothing the database would reject', () => {
    const check = checkConstraintValues();
    const extra = tsUnionValues().filter((v) => !check.includes(v));
    expect(extra, 'in the TS union but not allowed by the CHECK constraint').toEqual([]);
  });

  it('every city-tier value is a real entity type', () => {
    const union = tsUnionValues();
    expect(union.length, 'parsed an empty union').toBeGreaterThan(5);
    for (const t of CITY_TIER_TYPES) expect(union, t).toContain(t);
  });
});

describe('the product consumers import it rather than re-declaring it', () => {
  const CONSUMERS = [
    'src/utils/essentialsCoverage.ts',
    'src/utils/triviaCoverage.ts',
    'src/components/CitiesInCountyPanel.tsx',
  ];

  for (const rel of CONSUMERS) {
    it(`${rel} has no private copy`, () => {
      const src = readFileSync(rel, 'utf8');
      expect(src, rel).toMatch(/import \{ CITY_TIER_TYPES \} from/);
      // ⚠ The literal must be GONE, not merely shadowed by the import.
      expect(/(const|let)\s+CITY_TIER_TYPES\s*=/.test(src), `${rel} still declares its own`).toBe(false);
      expect(/(const|let)\s+CHILD_TYPES\s*=/.test(src), `${rel} still declares CHILD_TYPES`).toBe(false);
    });
  }
});
