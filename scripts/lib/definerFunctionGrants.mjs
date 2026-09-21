/**
 * Standing guard against the watchlist-#61 defect class: a SECURITY DEFINER
 * function in a PostgREST-exposed schema that the internet (`anon`) or any
 * signed-in user (`authenticated`) can EXECUTE, inherited from the PUBLIC grant
 * that CREATE FUNCTION hands out by default.
 *
 * ── ⚠ WHY THIS IS A STATIC CHECK, NOT A LIVE QUERY ─────────────────────────
 *
 * The obvious guard queries the live database (has_function_privilege) and fails
 * if anon/authenticated hold EXECUTE. It is NOT used here on purpose: this repo
 * DELIBERATELY keeps no database credential in GitHub Actions (PR #90 moved the
 * sync key into Vault and deleted the service-role fallback; frozen-invariant-
 * watch.yml documents the rule — "a service-role key, which bypasses RLS
 * entirely, must not travel into Actions"). A live-privilege CI job would
 * re-introduce exactly that credential. And the shared project also serves
 * civic_spaces / connect / essentials schemas that belong to ev-accounts, not to
 * this repo — a live cross-schema scan would flag functions this repo has no
 * business governing.
 *
 * So this guard reasons about THIS repo's own migration TEXT, needs no
 * credential, and runs in the ordinary PR gate (npm test). The authoritative
 * LIVE check is the post-verify DO block inside each revoke migration, which
 * runs at apply time in the database it targets.
 *
 * ── WHAT IT ENFORCES ───────────────────────────────────────────────────────
 *
 * For every function in an exposed schema whose LAST `CREATE [OR REPLACE]
 * FUNCTION` is `SECURITY DEFINER` and is not later dropped, there must be a
 * `REVOKE ... FROM PUBLIC` on that function in a migration at or after that last
 * create — or the function must be on ALLOWLIST with a one-line reason.
 *
 * "At or after the last create" matters: `CREATE OR REPLACE` PRESERVES the
 * existing ACL, so a revoke that predates a later re-create still holds live —
 * but re-asserting the revoke is cheap and idempotent, and requiring it closes
 * the gap where a future migration re-creates a function FRESH (resetting its
 * ACL to PUBLIC) and a name-only match would wave it through.
 *
 * ── ⚠ KNOWN LIMITATION ─────────────────────────────────────────────────────
 *
 * A static text check cannot see a live ACL. A function whose PUBLIC EXECUTE was
 * revoked OUTSIDE the tracked migrations (or before its first tracked create,
 * then carried forward by CREATE OR REPLACE) reads as a violation here even
 * though it is safe live. That is exactly why ALLOWLIST exists, and why each
 * entry must cite live evidence. Do not add an entry without it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// pgrst.db_schemas for project kxsdzaojfaibhuzmclfq, verified 2026-09-21.
export const EXPOSED_SCHEMAS = new Set([
  'public', 'civic_spaces', 'connect', 'empower', 'inform',
  'graphql_public', 'validation_quests', 'treasury', 'civic',
]);

/**
 * Functions deliberately left as anon/authenticated-safe by a route this static
 * check cannot see. Each value is the one-line reason, and MUST cite live
 * evidence — a static allowlist without it is just a way to hide a hole.
 */
export const ALLOWLIST = new Map([
  ['public.treasury_get_sync_key',
    'EXECUTE revoked from PUBLIC before the tracked CREATE OR REPLACE (plaintext-table era); the OR REPLACE in 20260827000600 preserves that ACL. Verified live 2026-09-21: anon EXECUTE = false, authenticated EXECUTE = false.'],
]);

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations');

const CREATE_RE = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(/gi;
const DROP_RE   = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(/gi;
// ⚠ Bounded by `;` on purpose. A SQL statement cannot span a semicolon, but
// [\s\S]*? can: with a COMMENT ON FUNCTION in the way (whose ')' is not followed
// by FROM) the argument matcher kept expanding across statements until it found
// one that was, eating every real REVOKE in between. Measured 2026-09-21 against
// 20260921190000_anon_execute_live_sweep.sql: three revokes silently lost, and
// the guard then reported a properly-revoked function as a violation.
const REVOKE_RE = /REVOKE\s+[^;]*?\bON\s+FUNCTION\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\([^;]*?\)\s*FROM\s+([^;]*?);/gi;

/**
 * Blank out the CONTENTS of dollar-quoted bodies, preserving length and line
 * breaks so every index into the text stays valid (headerHasSecurityDefiner
 * relies on that).
 *
 * ⚠⚠ SQL PROSE MUST NOT BE READ AS SQL. A plpgsql function that tells its reader
 * "Close each with REVOKE EXECUTE ON FUNCTION <fn> FROM PUBLIC, anon,
 * authenticated" is a good error message, and an unmasked parser read it as a
 * statement. Likewise a commented-out `CREATE FUNCTION ...` inside a body
 * conjured a SECURITY DEFINER function that does not exist.
 *
 * The opening and closing tags are LEFT IN PLACE so `AS $fn$` is still findable.
 */
function maskDollarQuotedBodies(txt) {
  const TAG = /\$([a-zA-Z_][a-zA-Z0-9_]*)?\$/g;
  let out = txt;
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(out))) {
    const tag = m[0];
    const bodyStart = m.index + tag.length;
    const close = out.indexOf(tag, bodyStart);
    if (close === -1) break; // unterminated — leave the rest alone rather than guess
    const masked = out.slice(bodyStart, close).replace(/[^\n]/g, ' ');
    out = out.slice(0, bodyStart) + masked + out.slice(close);
    TAG.lastIndex = close + tag.length;
  }
  return out;
}

/** The function header is everything up to the body delimiter; SECURITY DEFINER
 *  always sits there, never in the dollar-quoted body (where the words could
 *  appear inside a comment). */
function headerHasSecurityDefiner(txt, start) {
  const candidates = [txt.indexOf('AS $', start), txt.indexOf("AS '", start)]
    .filter((i) => i !== -1);
  const end = candidates.length ? Math.min(...candidates) : start + 800;
  return /SECURITY\s+DEFINER/i.test(txt.slice(start, end));
}

/**
 * @param {string} [dir] migrations directory (defaults to supabase/migrations)
 * @returns {{violations: {fn: string, lastCreate: string}[],
 *            definersFound: string[], revokesFound: string[], filesScanned: number}}
 */
export function auditDefinerGrants(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  // key -> { lastCreateIdx, lastCreateSecDef, lastDropIdx, revokeIdxs: [] }
  const state = new Map();
  const get = (k) => {
    if (!state.has(k)) state.set(k, { lastCreateIdx: -1, lastCreateSecDef: false, lastDropIdx: -1, revokeIdxs: [] });
    return state.get(k);
  };

  files.forEach((f, idx) => {
    const txt = maskDollarQuotedBodies(readFileSync(join(dir, f), 'utf8'));
    let m;

    CREATE_RE.lastIndex = 0;
    while ((m = CREATE_RE.exec(txt))) {
      const key = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
      const s = get(key);
      // Files are scanned in sorted (chronological) order, so a later file's
      // index is >= an earlier one's; ties within a file are fine.
      s.lastCreateIdx = idx;
      s.lastCreateSecDef = headerHasSecurityDefiner(txt, m.index);
    }

    DROP_RE.lastIndex = 0;
    while ((m = DROP_RE.exec(txt))) {
      get(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`).lastDropIdx = idx;
    }

    REVOKE_RE.lastIndex = 0;
    while ((m = REVOKE_RE.exec(txt))) {
      if (/\bPUBLIC\b/i.test(m[3])) {
        get(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`).revokeIdxs.push(idx);
      }
    }
  });

  const violations = [];
  const definersFound = [];
  const revokesFound = [];

  for (const [key, s] of [...state].sort()) {
    if (s.revokeIdxs.length) revokesFound.push(key);

    const schema = key.split('.')[0];
    const isLiveDefiner =
      EXPOSED_SCHEMAS.has(schema) &&
      s.lastCreateIdx !== -1 &&
      s.lastCreateSecDef &&
      s.lastDropIdx < s.lastCreateIdx; // not dropped after its last create

    if (!isLiveDefiner) continue;
    definersFound.push(key);

    if (ALLOWLIST.has(key)) continue;

    const revokedAtOrAfter = s.revokeIdxs.some((r) => r >= s.lastCreateIdx);
    if (!revokedAtOrAfter) {
      violations.push({ fn: key, lastCreate: files[s.lastCreateIdx] });
    }
  }

  return { violations, definersFound, revokesFound, filesScanned: files.length };
}
