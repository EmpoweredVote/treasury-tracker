/**
 * Which governments would an older census vintage name, state by state?
 *
 * ⚠ READ-ONLY. It loads nothing, writes nothing and changes nothing.
 *
 * `cache/` holds Vintage 2024 for 26 states and nothing older, so every state
 * TT has loaded carries the same blind spot Georgia had: a government that
 * ceased to exist before 2024 cannot be typed from the census, so it gets no
 * entity, so it gets no rows — and the refusal reads like absence rather than
 * like a gap. This prices that gap instead of leaving "not Georgia-specific"
 * as a belief.
 *
 * ⚠⚠ A STATE WHOSE OLDER VINTAGES ARE NOT CACHED IS `incomplete`, NEVER CLEAN.
 * Reporting "no recoverable governments" for a state nobody fetched would be
 * the same lie the ladder exists to prevent, one level up.
 *
 * Usage:
 *   node scripts/auditCensusVintageGaps.mjs 13 "Ranger Town" "Macon City"
 */
import { loadLadder, resolvePlace, DEFAULT_LADDER } from './lib/censusVintages.mjs';

/**
 * @param {string} stateFips
 * @param {string[]} names publisher names a builder refused for a missing
 *   census row. ⚠ Take these from the builder's own `refusals` array
 *   (`status: 'no-population'`) — never re-derive a roster, or the audit
 *   measures a list it made up rather than the one that was refused.
 */
export function auditState(stateFips, names, { ladders, missing = [] }) {
  const byVintage = {};
  const unnamed = [];
  let named = 0;
  for (const n of names) {
    const r = resolvePlace(n, { ladders, missing });
    if (r.why) { unnamed.push(n); continue; }
    named++;
    (byVintage[r.vintage] ??= []).push(n);
  }
  return {
    stateFips, named, unnamed, byVintage, missing, incomplete: missing.length > 0,
  };
}

export function formatReport(r) {
  const lines = [`state ${r.stateFips}: ${r.named} nameable by an older vintage, ${r.unnamed.length} by none`];
  if (r.incomplete) lines.push(`  ⚠ INCOMPLETE — vintages not cached: ${r.missing.join(', ')}`);
  for (const v of Object.keys(r.byVintage).sort((a, b) => b - a)) {
    lines.push(`  vintage ${v}: ${r.byVintage[v].join(', ')}`);
  }
  if (r.unnamed.length) lines.push(`  named by NO vintage: ${r.unnamed.join(', ')}`);
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const [fips, ...names] = process.argv.slice(2);
  if (!fips || !names.length) {
    console.error('usage: node scripts/auditCensusVintageGaps.mjs <stateFips> <refused name>...');
    process.exit(2);
  }
  const { ladders, missing } = loadLadder('.', fips, DEFAULT_LADDER);
  console.log(formatReport(auditState(fips, names, { ladders, missing })));
}
