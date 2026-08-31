import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIT_GRADE_VALUES } from '../scripts/lib/budgetAxes.mjs';

/**
 * ⚠ THIS IS A STATIC TEST BY NECESSITY, NOT BY PREFERENCE.
 *
 * The plan called for a live guard asserting "no row in treasury.budgets carries
 * a non-unknown audit_grade without a source_url". That cannot be a vitest test
 * here: the suite NEVER touches the database — zero tests call createClient, and
 * CI runs `npm test` with no credentials.
 *
 * So the invariant is enforced where it actually holds — as a CHECK constraint,
 * on every write path including the sync RPCs and every future loader. What
 * these tests guard is that the constraints remain DECLARED, so a later
 * migration cannot quietly drop them and leave the vocabulary unenforced.
 *
 * The live values are verified by scripts/verify-budget-axes.mjs. Note that
 * harness is not run automatically and was found broken on 2026-08-28 — see
 * .planning/KNIGHT-COMMUNITIES-PROGRESS.md. That is precisely why the real
 * enforcement is in the database and not in a script someone has to remember.
 */

const MIGRATIONS = 'supabase/migrations';

function migrationSource(nameFragment) {
  const file = readdirSync(MIGRATIONS).find((f) => f.includes(nameFragment));
  expect(file, `no migration matching "${nameFragment}"`).toBeTruthy();
  return readFileSync(join(MIGRATIONS, file), 'utf8');
}

describe('audit_grade column migration', () => {
  const sql = migrationSource('audit_grade_on_budgets');

  it('adds the column to treasury.budgets', () => {
    expect(sql).toMatch(/ALTER TABLE treasury\.budgets\s+ADD COLUMN audit_grade text/);
  });

  // ⚠ NOT NULL DEFAULT 'unknown' is safe ONLY because `unknown` is true of every
  // pre-existing row. If someone ever changes this default to a real grade, they
  // would be asserting assurance nobody verified — the FYSM DEFAULT 1 defect,
  // which read as fact on ~18,700 rows. Pin the default.
  it("defaults to 'unknown' and never to a real grade", () => {
    expect(sql).toMatch(/DEFAULT 'unknown'/);
    for (const grade of AUDIT_GRADE_VALUES.filter((g) => g !== 'unknown')) {
      expect(sql).not.toMatch(new RegExp(`DEFAULT '${grade}'`));
    }
  });

  it('declares the CHECK constraint', () => {
    expect(sql).toMatch(/budgets_audit_grade_check/);
  });
});

/**
 * ⚠ THE VOCABULARY IS ASSERTED AGAINST THE *LAST* MIGRATION THAT DECLARES THE
 * CONSTRAINT, not against the one that first added the column.
 *
 * Knight session 8 added `audited_ocboa` in a second migration, so pinning the
 * original file would fail for a correct schema — and, worse, would keep
 * passing if a later migration DROPPED a value, because the original still
 * mentions it. Reading the newest declaration is both correct today and the
 * stricter guard: whatever is in force must cover exactly the vocabulary.
 */
describe('the audit_grade CHECK in force covers exactly the vocabulary', () => {
  const declaring = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => readFileSync(join(MIGRATIONS, f), 'utf8')
      .includes('ADD CONSTRAINT budgets_audit_grade_check'))
    .sort();

  it('at least one migration declares it', () => {
    expect(declaring.length).toBeGreaterThan(0);
  });

  const latest = declaring[declaring.length - 1];
  const sql = readFileSync(join(MIGRATIONS, latest), 'utf8');

  it(`${'lists every vocabulary value'} (from ${declaring[declaring.length - 1]})`, () => {
    for (const grade of AUDIT_GRADE_VALUES) {
      expect(sql, `vocabulary value ${grade} missing from the CHECK in ${latest}`)
        .toContain(`'${grade}'`);
    }
  });

  // The other direction: a value in the constraint that the code does not know
  // about would let a writer store something classifyAxis can never produce.
  it('lists no value the vocabulary does not have', () => {
    const inCheck = [...sql.matchAll(/^\s*'([a-z_]+)',?\s*$/gm)].map((m) => m[1]);
    expect(inCheck.length, 'could not parse the CHECK list').toBeGreaterThan(0);
    for (const v of inCheck) {
      expect(AUDIT_GRADE_VALUES, `${v} is in the CHECK but not in AUDIT_GRADE`).toContain(v);
    }
  });
});

describe('graded rows must cite a source', () => {
  const sql = migrationSource('audit_grade_requires_source_url');

  it('declares the constraint', () => {
    expect(sql).toMatch(/budgets_graded_rows_need_a_source_url/);
  });

  // The two halves that make it correct: ungraded rows are exempt (they make no
  // claim), and graded rows need a non-empty URL (empty string is not a citation).
  it('exempts unknown rows and requires a non-empty url for the rest', () => {
    expect(sql).toMatch(/audit_grade = 'unknown'/);
    expect(sql).toMatch(/source_url IS NOT NULL/);
    expect(sql).toMatch(/source_url <> ''/);
  });
});

describe('the vocabulary and the database agree', () => {
  // A gate nobody has watched fail is not a gate: prove this test would notice
  // if the migration and the vocabulary drifted apart.
  it('would fail if a vocabulary value were absent from the CHECK', () => {
    const sql = migrationSource('audit_grade_on_budgets');
    expect(sql).not.toContain("'compiled_from_unaudited'"); // a value that must never exist
    expect(AUDIT_GRADE_VALUES).toContain('compiled_from_audited');
  });
});
