#!/usr/bin/env node
/**
 * Watch for the CA State Controller publishing a fiscal year newer than the one
 * Treasury Tracker has loaded, so LA City's continuous series can be extended.
 *
 * Why this exists: LA City's Money In / Money Out is FY2003-FY2024 in one
 * unbroken series, sourced entirely from the State Controller's ByTheNumbers
 * open data (see docs/superpowers/plans/LA-02-CLOSEOUT.md). FY2024 is the newest
 * year published as of 2026-08-21 — the Controller runs roughly two years behind
 * the fiscal year end, so FY2025 is a wait, not a bug.
 *
 * ⚠ Do NOT substitute LA's own ACFR for the missing year. LA-01 proved the ACFR
 * does not reconcile to the Controller's all-funds construction under any stable
 * scope, so an ACFR-sourced year would re-create the exact seam LA-02 removed.
 *
 * ⚠ This must run on a machine with direct internet access. Anthropic's cloud
 * sandbox blocks bythenumbers.sco.ca.gov at its egress proxy (EGRESS_BLOCKED),
 * so a cloud routine cannot do this check.
 *
 * Usage:
 *   node scripts/checkScoNewFiscalYear.mjs                 # baseline 2024
 *   node scripts/checkScoNewFiscalYear.mjs --baseline 2025 # after FY2025 lands
 *   node scripts/checkScoNewFiscalYear.mjs --log <file> --marker <file>
 *
 * Exit codes: 0 = nothing new · 10 = a newer year is available · 2 = inconclusive
 * (could not reach the API — deliberately NOT reported as "nothing new").
 */
import { appendFileSync, writeFileSync } from 'node:fs';

const DATASETS = {
  operating: { id: 'ju3w-4gxp', label: 'Expenditures' },
  revenue:   { id: 'rrtv-rsj9', label: 'Revenues' },
};
const ENTITY = 'Los Angeles', COUNTY = 'Los Angeles';

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const BASELINE = Number(argOf('--baseline', '2024'));
const LOG = argOf('--log', null);
const MARKER = argOf('--marker', null);

const out = [];
const say = (line) => { out.push(line); console.log(line); };

async function soql(datasetId, params) {
  const u = new URL(`https://bythenumbers.sco.ca.gov/resource/${datasetId}.json`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {   // the API times out intermittently
    try {
      const res = await fetch(u, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  throw new Error(`${datasetId}: ${lastErr?.message ?? 'unknown error'} (after 3 attempts)`);
}

const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const stamp = new Date().toISOString();

let exitCode = 0;
try {
  const found = {};
  for (const [ds, { id, label }] of Object.entries(DATASETS)) {
    const [{ max_fy }] = await soql(id, { '$select': 'max(fiscal_year) as max_fy' });
    const maxFy = Number(max_fy);
    if (maxFy > BASELINE) {
      const rows = await soql(id, {
        '$select': 'fiscal_year,sum(value) as total',
        '$where': `entity_name='${ENTITY}' and county='${COUNTY}' and fiscal_year>'${BASELINE}'`,
        '$group': 'fiscal_year', '$order': 'fiscal_year',
      });
      found[ds] = { label, maxFy, rows: rows.filter(r => Number(r.total) !== 0) };
    } else {
      found[ds] = { label, maxFy, rows: [] };
    }
  }

  const newYears = [...new Set(Object.values(found).flatMap(f => f.rows.map(r => Number(r.fiscal_year))))].sort();

  if (!newYears.length) {
    say(`[${stamp}] SCO still at FY${found.operating.maxFy}/FY${found.revenue.maxFy} (baseline FY${BASELINE}) - nothing to do.`);
  } else {
    exitCode = 10;
    say(`[${stamp}] *** SCO HAS PUBLISHED A NEWER FISCAL YEAR - LA series can be extended ***`);
    for (const fy of newYears) {
      const parts = Object.entries(found).map(([ds, f]) => {
        const hit = f.rows.find(r => Number(r.fiscal_year) === fy);
        return `${ds}=${hit ? '$' + fmt(hit.total) : 'NOT YET'}`;
      });
      say(`  FY${fy}: ${parts.join('  ')}`);
    }
    const bothSides = newYears.filter(fy =>
      Object.values(found).every(f => f.rows.some(r => Number(r.fiscal_year) === fy)));
    const oneSided = newYears.filter(fy => !bothSides.includes(fy));
    if (oneSided.length) {
      say(`  ** ONE SIDE ONLY for FY${oneSided.join(', FY')} - do NOT load yet. Loading one side`);
      say(`    alone leaves Money In and Money Out ending on different years, which is the`);
      say(`    very defect LA-02 removed. Wait for both datasets.`);
    }
    for (const fy of bothSides) {
      say(`  Ready to load FY${fy}:`);
      say(`    node scripts/bulkLoadStateController.js --city "Los Angeles" --fy ${fy} --source-date ${stamp.slice(0, 10)}`);
    }
    if (bothSides.length) {
      say('  Then, per docs/superpowers/plans/LA-02-CLOSEOUT.md:');
      say('   1. Verify the written totals against the figures above BEFORE deleting anything.');
      say('   2. treasury_sync_city_budget INSERTS rather than overwrites when fund_scope/basis');
      say('      differ - remove any superseded row deliberately.');
      say('   3. Bump ca-sco-city-exp / ca-sco-city-rev in BOTH scripts/classifyFundScope.mjs');
      say('      AND scripts/stampBudgetAxes.mjs (they have silently drifted apart before).');
      say(`   4. Re-run this check with --baseline ${Math.max(...bothSides)} so it stops re-reporting.`);
    }
    if (MARKER) {
      writeFileSync(MARKER, out.join('\n') + '\n');
      say(`  (wrote marker ${MARKER})`);
    }
  }
} catch (err) {
  exitCode = 2;
  say(`[${stamp}] INCONCLUSIVE - could not reach the SCO API: ${err.message}`);
  say('  This is NOT "nothing new". Re-run before drawing any conclusion.');
}

if (LOG) { try { appendFileSync(LOG, out.join('\n') + '\n'); } catch { /* logging is best-effort */ } }
process.exit(exitCode);
