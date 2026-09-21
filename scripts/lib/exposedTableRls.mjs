/**
 * Standing guard against the defect this migration wave reopened: a NEW table in
 * a PostgREST-exposed schema created with row-level security OFF, so the internet
 * (`anon`) can read every row through the schema-wide default SELECT grant.
 *
 * The 2026-09-10 audit (CTO decision 0015) left the project at "RLS on
 * everywhere it can be on"; six treasury tables added 2026-09-16..18 landed after
 * it with RLS off and nobody noticed until the next weekly linter read. This
 * check makes the NEXT such table fail its PR instead.
 *
 * ── ⚠ WHY THIS IS A STATIC CHECK, NOT A LIVE QUERY ─────────────────────────
 *
 * Identical reasoning to the sibling guard, scripts/lib/definerFunctionGrants.mjs:
 * this repo DELIBERATELY keeps no database credential in GitHub Actions (PR #90 —
 * a service-role key bypasses RLS and must not travel into Actions), and the
 * shared project also serves schemas that belong to ev-accounts, not this repo. A
 * live cross-schema scan would need that credential and would flag tables this
 * repo has no business governing. So this guard reasons about THIS repo's own
 * migration TEXT. The authoritative LIVE check is the post-verify DO block inside
 * each RLS migration, which runs at apply time in the database it targets.
 *
 * ── WHAT IT ENFORCES ───────────────────────────────────────────────────────
 *
 * For every table whose LAST `CREATE TABLE` is in an exposed schema, is not later
 * dropped, and was created AT OR AFTER the enforcement boundary (ENFORCE_FROM),
 * there must be an `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on that table in a
 * migration at or after that last create — or the table must be on ALLOWLIST with
 * a one-line reason. "Public on purpose" (RLS on + a permissive policy) satisfies
 * the check the same way default-deny does: both switch RLS on, which is the
 * acceptance the audit demands.
 *
 * ── ⚠ WHY A BOUNDARY, NOT A BLANKET RULE ───────────────────────────────────
 *
 * Most existing exposed tables had RLS switched on out-of-band (the 2026-09-10
 * sweep, and ad-hoc ALTERs), not in tracked migration text — so a blanket "every
 * exposed table must ENABLE RLS in a migration" would read them all as violations
 * and need a 40-entry allowlist. The live linter already covers what exists; this
 * guard's job is to stop NEW drift. ENFORCE_FROM is this fix's timestamp:
 * everything up to and including today's cleanup is grandfathered, and any table
 * created in a later migration must ship its own ENABLE RLS.
 *
 * ── ⚠ KNOWN LIMITATION ─────────────────────────────────────────────────────
 *
 * A static text check cannot see live state, and only matches SCHEMA-QUALIFIED
 * CREATE TABLE (schema.name) — an unqualified create is not governed here. A
 * table RLS'd outside tracked migrations reads as a violation; that is what
 * ALLOWLIST is for, and each entry must cite live evidence.
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
 * Enforcement boundary. A table whose last CREATE lands in a migration filename
 * >= this string must ship ENABLE ROW LEVEL SECURITY. Set to the 2026-09-21
 * new-treasury-tables RLS fix, which is where "RLS on for every new exposed
 * table" starts being a promise this repo keeps. Fixed-width zero-padded
 * timestamps sort lexically, so a string compare is a date compare.
 */
export const ENFORCE_FROM = '20260921120000';

/**
 * Exposed tables deliberately left without RLS by a route this static check
 * cannot see. Each value is the one-line reason and MUST cite live evidence.
 * Empty today — every exposed table created from ENFORCE_FROM onward is expected
 * to enable RLS in its own migration.
 */
export const ALLOWLIST = new Map([]);

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations');

const CREATE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/gi;
const DROP_RE   = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/gi;
const RLS_RE    = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

/**
 * @param {string} [dir] migrations directory (defaults to supabase/migrations)
 * @returns {{violations: {table: string, lastCreate: string}[],
 *            createsFound: string[], rlsEnablesFound: string[], filesScanned: number}}
 */
export function auditExposedTableRls(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  // key -> { lastCreateIdx, lastDropIdx, rlsIdxs: [] }
  const state = new Map();
  const get = (k) => {
    if (!state.has(k)) state.set(k, { lastCreateIdx: -1, lastDropIdx: -1, rlsIdxs: [] });
    return state.get(k);
  };

  files.forEach((f, idx) => {
    const txt = readFileSync(join(dir, f), 'utf8');
    let m;

    CREATE_RE.lastIndex = 0;
    while ((m = CREATE_RE.exec(txt))) {
      // Files are scanned in sorted (chronological) order.
      get(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`).lastCreateIdx = idx;
    }

    DROP_RE.lastIndex = 0;
    while ((m = DROP_RE.exec(txt))) {
      get(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`).lastDropIdx = idx;
    }

    RLS_RE.lastIndex = 0;
    while ((m = RLS_RE.exec(txt))) {
      get(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`).rlsIdxs.push(idx);
    }
  });

  const violations = [];
  const createsFound = [];
  const rlsEnablesFound = [];

  for (const [key, s] of [...state].sort()) {
    if (s.rlsIdxs.length) rlsEnablesFound.push(key);

    const schema = key.split('.')[0];
    const isLiveTable =
      EXPOSED_SCHEMAS.has(schema) &&
      s.lastCreateIdx !== -1 &&
      s.lastDropIdx < s.lastCreateIdx; // not dropped after its last create

    if (!isLiveTable) continue;
    createsFound.push(key);

    // Grandfathered: created before this repo began promising RLS-on for every
    // new exposed table. The live linter already covers what exists.
    if (files[s.lastCreateIdx] < ENFORCE_FROM) continue;

    if (ALLOWLIST.has(key)) continue;

    const rlsAtOrAfter = s.rlsIdxs.some((r) => r >= s.lastCreateIdx);
    if (!rlsAtOrAfter) {
      violations.push({ table: key, lastCreate: files[s.lastCreateIdx] });
    }
  }

  return { violations, createsFound, rlsEnablesFound, filesScanned: files.length };
}
