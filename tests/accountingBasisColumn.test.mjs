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
    const sql = readFileSync(`${MIGRATIONS}/${declaring[0]}`, 'utf8');
    expect(sql).toMatch(/accounting_basis\s+text\s+NOT NULL\s+DEFAULT\s+'unknown'/i);
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
