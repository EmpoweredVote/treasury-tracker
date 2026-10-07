import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { ACCOUNTING_BASIS_VALUES } from '../scripts/lib/budgetAxes.mjs';

/**
 * The vocabulary is enforced where it actually holds — as a CHECK constraint,
 * on every write path including the sync RPCs and every future loader. The
 * suite NEVER touches the database (zero tests call createClient, and CI runs
 * with no credentials), so what these tests guard is that the constraint
 * remains DECLARED and that it covers exactly the vocabulary a later migration
 * cannot quietly diverge from.
 */
const MIGRATIONS = 'supabase/migrations';

/**
 * ⚠ The vocabulary is asserted against the LAST migration that declares the
 * constraint, not the one that first added the column. Pinning the original
 * would fail for a correct schema the moment a value is added — and, worse,
 * would keep PASSING if a later migration DROPPED a value, because the
 * original still mentions it. Reading the newest declaration is both correct
 * today and the stricter guard.
 */
const declaring = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => readFileSync(`${MIGRATIONS}/${f}`, 'utf8').includes('budgets_accounting_basis_check'))
  .sort();

describe('the accounting_basis column', () => {
  it('is declared by at least one migration', () => {
    // Without this the two tests below would pass vacuously on an empty list.
    expect(declaring.length, 'no migration declares budgets_accounting_basis_check').toBeGreaterThan(0);
  });

  it('defaults to unknown and is NOT NULL — nothing is classified by absence', () => {
    // ⚠ `declaring[0]` is correct HERE and nowhere else in this file: the
    // `NOT NULL DEFAULT` text only ever appears in the migration that ADDS the
    // column, so reading the newest declaration (right for the CHECK below)
    // would find no match at all. What `[0]` cannot see is a LATER migration
    // weakening what it established -- that is the next test's job, and
    // without it this assertion is a claim about history, not about the schema
    // in force.
    const sql = readFileSync(`${MIGRATIONS}/${declaring[0]}`, 'utf8');
    expect(sql).toMatch(/accounting_basis\s+text\s+NOT NULL\s+DEFAULT\s+'unknown'/i);
  });

  it('is not weakened by any LATER migration', () => {
    // ⚠⚠ THE SAME ARGUMENT THE HEADER MAKES FOR THE CHECK APPLIES HERE.
    //
    // Reading the original migration keeps PASSING after a later one does
    // `ALTER COLUMN accounting_basis DROP NOT NULL`, `DROP DEFAULT`, or drops
    // the column outright -- the original still says what it always said. A
    // row arriving NULL would then be classified by absence, which is the one
    // thing this axis was built to prevent: `unknown` is a VALUE that means
    // "not established", and NULL is the absence of an answer to a question
    // nobody asked.
    const all = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
    const after = all.slice(all.indexOf(declaring[0]) + 1);

    const WEAKENING = [
      /alter\s+column\s+accounting_basis\s+drop\s+not\s+null/i,
      /alter\s+column\s+accounting_basis\s+drop\s+default/i,
      /drop\s+column\s+(?:if\s+exists\s+)?accounting_basis/i,
    ];

    const offenders = [];
    for (const f of after) {
      const sql = readFileSync(`${MIGRATIONS}/${f}`, 'utf8');
      for (const re of WEAKENING) {
        if (re.test(sql)) offenders.push(`${f}: ${re}`);
      }
      // A redefined default is only acceptable if it is still 'unknown'.
      const setDefault = /alter\s+column\s+accounting_basis\s+set\s+default\s+('[a-z_]*')/i.exec(sql);
      if (setDefault && setDefault[1] !== "'unknown'") {
        offenders.push(`${f}: default changed to ${setDefault[1]}`);
      }
    }
    expect(offenders, 'a later migration weakens accounting_basis').toEqual([]);
  });

  it('the CHECK in force covers EXACTLY the vocabulary', () => {
    const sql = readFileSync(`${MIGRATIONS}/${declaring[declaring.length - 1]}`, 'utf8');
    const m = /budgets_accounting_basis_check[\s\S]*?CHECK\s*\(\s*accounting_basis\s+IN\s*\(([^)]*)\)/i.exec(sql);
    expect(m, 'no CHECK constraint found in the declaring migration').not.toBeNull();
    const inSql = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(inSql).toEqual([...ACCOUNTING_BASIS_VALUES].sort());
  });

  it('does not overload budgets.basis — the two CHECKs are separate', () => {
    // ⚠ budgets.basis means actual-vs-adopted. If a migration ever widened
    // THAT constraint to carry gaap/cash, both meanings would be destroyed and
    // every consumer of either axis would be reading the wrong question.
    const sql = readFileSync(`${MIGRATIONS}/${declaring[declaring.length - 1]}`, 'utf8');
    expect(sql).not.toMatch(/budgets_basis_check[\s\S]{0,200}'(gaap|cash|modified_cash)'/i);
  });
});
