import { describe, it, expect } from 'vitest';
import { auditDefinerGrants, ALLOWLIST } from '../scripts/lib/definerFunctionGrants.mjs';

/**
 * Guard: no SECURITY DEFINER function in a PostgREST-exposed schema may sit
 * without a PUBLIC-revoke at or after its last create. This is the standing
 * half of the watchlist-#61 fix — it fails a PR that adds such a function,
 * so the hole cannot be reopened by the next migration. See the module header
 * for why this is a static text check and not a live-privilege query.
 */
describe('SECURITY DEFINER functions are not left executable by anon/authenticated', () => {
  const result = auditDefinerGrants();

  // ⚠ POSITIVE CONTROL — the project's own rule ("run a positive control on any
  // detector that reports 'nothing found'"). A parser that silently matches
  // nothing would report zero violations and pass while checking nothing. Pin
  // that it actually sees the migrations and finds the definer functions we
  // know are there.
  it('actually parsed the migrations (positive control)', () => {
    expect(result.filesScanned).toBeGreaterThan(20);
    expect(result.definersFound).toContain('public.treasury_ensure_municipality');
    expect(result.definersFound).toContain('treasury.capture_frozen_snapshot');
    // and it can see PUBLIC-revokes at all
    expect(result.revokesFound).toContain('public.treasury_sync_city_budget');
  });

  it('leaves no definer function in an exposed schema without a PUBLIC-revoke', () => {
    const lines = result.violations.map(
      (v) => `  ${v.fn}  (last created in ${v.lastCreate}) has no REVOKE ... FROM PUBLIC at or after that create`,
    );
    expect(
      result.violations,
      lines.length
        ? `SECURITY DEFINER function(s) callable by anon/authenticated:\n${lines.join('\n')}\n\n` +
          `Fix: add REVOKE EXECUTE ON FUNCTION <fn> FROM PUBLIC, anon, authenticated; ` +
          `(then GRANT EXECUTE ... TO service_role) in a migration, mirroring ` +
          `20260921000000_revoke_anon_execute_new_treasury_definer_functions.sql. ` +
          `Only allowlist a function that is genuinely meant to be public, with a reason.`
        : undefined,
    ).toEqual([]);
  });

  it('every allowlist entry carries a reason', () => {
    for (const [fn, reason] of ALLOWLIST) {
      expect(typeof reason === 'string' && reason.trim().length > 0, `allowlist entry ${fn} needs a reason`).toBe(true);
    }
  });
});
