import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

/**
 * ⚠⚠ SQL PROSE MUST NOT BE READ AS SQL.
 *
 * The REVOKE pattern spans lines lazily, so the words "REVOKE ... ON FUNCTION
 * ... FROM PUBLIC" appearing INSIDE a dollar-quoted body — a plpgsql error
 * message telling the reader how to fix the very problem this guard reports —
 * would start a match that swallowed the next real REVOKE. The guard then
 * reported a properly-revoked function as a violation.
 *
 * Found 2026-09-21 when 20260921190000_anon_execute_live_sweep.sql tripped it:
 * the runner's own remediation text ("Close each with REVOKE EXECUTE ON
 * FUNCTION <fn> FROM PUBLIC, anon, authenticated") ate the revoke on
 * treasury.anon_executable_functions two lines below.
 *
 * A false violation is not harmless here: the cheap way out is to reword the
 * migration until the gate goes quiet, which trains people to write worse error
 * messages to satisfy a parser.
 */
describe('function bodies are not parsed as statements', () => {
  const withFixture = (sql, fn) => {
    const dir = mkdtempSync(join(tmpdir(), 'definer-grants-'));
    try {
      writeFileSync(join(dir, '20260101000000_fixture.sql'), sql);
      return fn(auditDefinerGrants(dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  // Faithful reproduction of the real trip. Two things combine: a REVOKE token
  // inside a dollar-quoted body, and a COMMENT ON FUNCTION whose ')' is NOT
  // followed by FROM — so the argument matcher \([\s\S]*?\) keeps expanding
  // across statements until it finds one that is, eating every real REVOKE in
  // between. A SQL statement cannot span a semicolon; the pattern could.
  it('sees real REVOKEs that a body mention and a COMMENT ON FUNCTION would swallow', () => {
    const sql = `
CREATE OR REPLACE FUNCTION treasury.scanner()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $fn$
BEGIN
  RAISE EXCEPTION 'Close each with REVOKE EXECUTE ON FUNCTION <fn> FROM PUBLIC, anon, authenticated';
END;
$fn$;

CREATE OR REPLACE FUNCTION treasury.runner()
RETURNS int LANGUAGE sql SECURITY DEFINER AS $fn$ SELECT 1 $fn$;

CREATE OR REPLACE FUNCTION public.status_fn()
RETURNS int LANGUAGE sql SECURITY DEFINER AS $fn$ SELECT 1 $fn$;

COMMENT ON FUNCTION public.status_fn() IS 'read by the orchestrator';

REVOKE EXECUTE ON FUNCTION treasury.scanner()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION treasury.runner()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.status_fn()  FROM PUBLIC, anon, authenticated;
`;
    withFixture(sql, (r) => {
      expect(r.definersFound).toEqual(
        expect.arrayContaining(['treasury.scanner', 'treasury.runner', 'public.status_fn']),
      );
      expect(r.violations).toEqual([]);
    });
  });

  it('does not treat a CREATE FUNCTION named inside a body as a real definer', () => {
    const sql = `
CREATE OR REPLACE FUNCTION treasury.outer_fn()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $fn$
BEGIN
  -- documentation only, not a real object:
  -- CREATE FUNCTION treasury.ghost_fn() RETURNS int SECURITY DEFINER
  RETURN 1;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION treasury.outer_fn() FROM PUBLIC, anon, authenticated;
`;
    withFixture(sql, (r) => {
      expect(r.definersFound).not.toContain('treasury.ghost_fn');
      expect(r.violations).toEqual([]);
    });
  });
});
