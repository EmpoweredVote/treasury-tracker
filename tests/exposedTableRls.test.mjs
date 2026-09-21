import { describe, it, expect } from 'vitest';
import { auditExposedTableRls, ALLOWLIST, ENFORCE_FROM } from '../scripts/lib/exposedTableRls.mjs';

/**
 * Guard: no NEW table in a PostgREST-exposed schema (created at or after
 * ENFORCE_FROM) may sit with row-level security off. This is the standing half
 * of the 2026-09-21 new-treasury-tables fix — it fails a PR that adds such a
 * table, so the "RLS on everywhere it can be on" end state cannot be silently
 * reopened by the next migration. See the module header for why this is a static
 * text check and not a live query.
 */
describe('new tables in exposed schemas enable row-level security', () => {
  const result = auditExposedTableRls();

  // ⚠ POSITIVE CONTROL — the project's own rule ("run a positive control on any
  // detector that reports 'nothing found'"). A parser that silently matched
  // nothing would report zero violations and pass while checking nothing. Pin
  // that it actually sees CREATE TABLEs and ENABLE RLS statements we know exist.
  it('actually parsed the migrations (positive control)', () => {
    expect(result.filesScanned).toBeGreaterThan(20);
    // a create it must see (treasury.municipality_source_keys, 20260917100000)
    expect(result.createsFound).toContain('treasury.municipality_source_keys');
    // an ENABLE RLS it must see (treasury.frozen_excluded_ids, 20260910000000)
    expect(result.rlsEnablesFound).toContain('treasury.frozen_excluded_ids');
    // and the six protected by the 2026-09-21 fix
    expect(result.rlsEnablesFound).toContain('treasury.budget_total_changes');
    expect(result.rlsEnablesFound).toContain('treasury.frozen_figure_snapshot');
  });

  it('leaves no new exposed-schema table with RLS off', () => {
    const lines = result.violations.map(
      (v) => `  ${v.table}  (last created in ${v.lastCreate}) has no ALTER TABLE ... ENABLE ROW LEVEL SECURITY at or after that create`,
    );
    expect(
      result.violations,
      lines.length
        ? `New table(s) in a PostgREST-exposed schema left readable by anon:\n${lines.join('\n')}\n\n` +
          `Fix: add ALTER TABLE <schema>.<table> ENABLE ROW LEVEL SECURITY; in a ` +
          `migration (default-deny), or RLS on plus a permissive SELECT policy if it ` +
          `is public on purpose — mirroring ` +
          `20260921120000_rls_new_treasury_tables_default_deny.sql. Only allowlist a ` +
          `table RLS'd outside tracked migrations, with live evidence.`
        : undefined,
    ).toEqual([]);
  });

  it('every allowlist entry carries a reason', () => {
    for (const [table, reason] of ALLOWLIST) {
      expect(typeof reason === 'string' && reason.trim().length > 0, `allowlist entry ${table} needs a reason`).toBe(true);
    }
  });

  it('the enforcement boundary is a 14-digit timestamp', () => {
    expect(ENFORCE_FROM).toMatch(/^\d{14}$/);
  });
});
