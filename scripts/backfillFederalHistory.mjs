#!/usr/bin/env node
/**
 * Federal History Backfill Orchestrator (Phase 49, Plan 05)
 *
 * Loops FY1976–FY2024 (+ the FY1976 Transition Quarter) and runs the three lens
 * loaders per period. Loaders are idempotent (data_source-scoped pre-delete + RPC),
 * so re-running is safe and resumable. FY2025 is NEVER targeted (its rows stay as
 * loaded by the MTS/T9 paths).
 *
 * Usage:
 *   node scripts/backfillFederalHistory.mjs --dry-run        # full-span matrix, no writes
 *   node scripts/backfillFederalHistory.mjs                  # real writes
 *   node scripts/backfillFederalHistory.mjs --only function  # one lens
 *   node scripts/backfillFederalHistory.mjs --from 1976 --to 1990
 *   node scripts/backfillFederalHistory.mjs --no-tq
 *
 * Exit non-zero if any (period, lens) ends with no row written (real run) or any
 * loader errored (dry-run).
 */
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values: opts } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    only: { type: 'string' },                 // function | agency | receipts
    from: { type: 'string', default: '1976' },
    to: { type: 'string', default: '2024' },
    'no-tq': { type: 'boolean', default: false },
  },
});
const dryRun = opts['dry-run'];
const FROM = parseInt(opts.from, 10);
const TO = parseInt(opts.to, 10);
if (FROM < 1962 || TO > 2024 || FROM > TO) { console.error('--from/--to must satisfy 1962 <= from <= to <= 2024'); process.exit(1); }

const LENSES = {
  function: { script: 'loadFederalFunctions.js', baseArgs: [] },
  agency: { script: 'loadFederalAgencies.js', baseArgs: ['--source', 'omb'] },
  receipts: { script: 'loadFederalReceipts.js', baseArgs: [] },
};
const lensKeys = opts.only ? [opts.only] : ['function', 'agency', 'receipts'];
for (const k of lensKeys) if (!LENSES[k]) { console.error(`--only must be one of: ${Object.keys(LENSES).join(', ')}`); process.exit(1); }

function runLoader(lensKey, periodArgs, label) {
  const { script, baseArgs } = LENSES[lensKey];
  const args = [join(__dirname, script), ...baseArgs, ...periodArgs];
  if (dryRun) args.push('--dry-run');
  let out = '', ok = true, err = null;
  try {
    out = execFileSync('node', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    ok = false;
    out = (e.stdout || '') + (e.stderr || '');
    err = (e.stderr || e.message || '').toString().split('\n').filter(Boolean).pop();
  }
  const deltaM = out.match(/vs anchor[^\n]*?:\s*([\-\d.]+)%/);
  const tier2 = /Tier-2|load-anyway/i.test(out);
  const noAnchor = /No anchor/.test(out);
  const insertedM = out.match(/Inserted:\s*(\d+)/);
  const wrote = !!insertedM;
  return {
    lens: lensKey, label,
    ok: ok && (dryRun || wrote),
    delta: deltaM ? `${deltaM[1]}%` : (noAnchor ? 'self-anchor' : '—'),
    tier: tier2 ? 'load-anyway' : 'account',
    inserted: insertedM ? Number(insertedM[1]) : null,
    err,
  };
}

const periods = [];
for (let y = FROM; y <= TO; y++) periods.push({ key: String(y), args: ['--fy', String(y)] });
if (!opts['no-tq']) periods.push({ key: 'TQ', args: ['--tq'] });

console.log(`\n${'='.repeat(70)}\n Federal history backfill — ${dryRun ? 'DRY RUN (no writes)' : 'REAL WRITES'}`);
console.log(` Periods: FY${FROM}–FY${TO}${opts['no-tq'] ? '' : ' + TQ'} | Lenses: ${lensKeys.join(', ')}\n${'='.repeat(70)}`);

const results = [];
for (const p of periods) {
  const row = { period: p.key, cells: {} };
  for (const lensKey of lensKeys) {
    const r = runLoader(lensKey, p.args, p.key);
    row.cells[lensKey] = r;
    results.push(r);
    const status = r.ok ? (r.tier === 'load-anyway' ? '⚠T2' : 'ok') : 'FAIL';
    process.stdout.write(`  ${p.key} ${lensKey.padEnd(9)} ${status.padEnd(5)} Δ${r.delta}${r.inserted != null ? ` (${r.inserted} rows)` : ''}${r.err ? ` — ${r.err}` : ''}\n`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
const failures = results.filter(r => !r.ok);
const tier2s = results.filter(r => r.ok && r.tier === 'load-anyway');
console.log(`\n${'─'.repeat(70)}\nSummary: ${results.length} (period,lens) loads — ${results.length - failures.length} ok, ${failures.length} failed, ${tier2s.length} Tier-2 (loaded with disclosure).`);
if (tier2s.length) {
  console.log('Tier-2 (account-level did not reconcile within 0.5% — loaded anyway + disclosure):');
  for (const r of tier2s) console.log(`  - ${r.label} / ${r.lens} (Δ${r.delta})`);
}
if (failures.length) {
  console.log('FAILURES:');
  for (const r of failures) console.log(`  - ${r.label} / ${r.lens}: ${r.err || 'no row written'}`);
  process.exit(1);
}
console.log(dryRun ? '\nDry run clean — ready for the real backfill.' : '\nBackfill complete.');
