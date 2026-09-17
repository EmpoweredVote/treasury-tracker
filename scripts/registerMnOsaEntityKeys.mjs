#!/usr/bin/env node
/**
 * Register MN OSA's own `GovEntityID` for every MN city TT already holds — the
 * approach-C backfill.
 *
 *   npm run register:mn-keys                       # FY2023 + FY2022 + FY2020
 *   node --env-file=.env scripts/registerMnOsaEntityKeys.mjs --fy 2023 --fy 2020
 *   node --env-file=.env scripts/registerMnOsaEntityKeys.mjs --file docs/MN/cired_22_data.xlsx
 *   ... --dry-run                                   # read + report, write nothing
 *
 * ── ⚠⚠ WHY A BACKFILL AT ALL ───────────────────────────────────────────────
 *
 * treasury_ensure_municipality LEARNS a key while writing budgets, so a city is
 * protected only from the next time a load touches it — and MN's loads run as
 * rare statewide batches. A rename published in between would fork the city
 * exactly as Birchwood forked: the lookup misses, a second entity is created,
 * every later year lands on it, and NOTHING FAILS. This pass registers the
 * whole roster in one go, writing no budget rows.
 *
 * ⚠ IT CREATES NO ENTITY. A published name TT does not hold is REPORTED, not
 * invented — see treasury_register_source_key. The two residuals it prints are
 * the point of the run, not decoration:
 *
 *   "no TT entity"  — the publisher names a city TT has never loaded.
 *   "still unkeyed" — TT holds a city the publisher's roster did not name, so
 *                     it is STILL identified by name alone and still forkable.
 *
 * ⚠ MULTIPLE YEARS ON PURPOSE. A city that left the latest roster (dissolved,
 * or merged away) is keyed from an older file, and a spelling TT stored years
 * ago resolves through its alias. Ids are stable across years — measured:
 * Birchwood = 168 in FY2020 and Birchwood Village = 168 in FY2022.
 *
 * ⚠ CITIES ONLY. The county workbooks print no GovEntityID at all (measured on
 * county_20_data.xlsx, whose first column is `Entity Name`), so counties keep
 * name identity plus `npm run check:forks`.
 */

import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import {
  DATA_SOURCE_NAME,
  enumerateEntityKeys,
  resolveSourceUrl,
} from './loadMNOSA.js';

// ⭐ MEASURED, not guessed: the union of ids across ALL TWELVE XLSX years is
// 856 — exactly the number of MN cities TT holds — and these three files are
// the only ones that contribute any of it:
//
//   FY2023  851 ids     the current roster
//   FY2022  +3          published that year, gone by FY2023
//   FY2014  +2          Boy River (183) and Thomson (858), last filed FY2014
//   every other year    +0
//
// So the default run reaches every MN city TT holds. Pass --fy to widen it if
// a later file ever adds one.
const DEFAULT_YEARS = [2023, 2022, 2014];
const RECON_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '_mn-recon');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Resolve --fy to a local workbook path, downloading from the manifest if absent. */
function acquireCityFile(fy) {
  const sourceUrl = resolveSourceUrl(fy, 'city');
  if (!sourceUrl) {
    console.log(`  FY${fy}: no city_url in the manifest — skipped`);
    return null;
  }
  const localPath = join(RECON_DIR, `cired_${String(fy).slice(-2)}_data.xlsx`);
  if (!existsSync(localPath)) {
    if (!existsSync(RECON_DIR)) mkdirSync(RECON_DIR, { recursive: true });
    console.log(`  FY${fy}: downloading ${sourceUrl}`);
    try {
      execSync(`curl -fsSL -o "${localPath}" "${sourceUrl}"`, { stdio: 'pipe', timeout: 120000 });
    } catch (e) {
      console.log(`  FY${fy}: download failed (${e.message}) — skipped`);
      return null;
    }
  }
  return localPath;
}

/** Entities of this state/type that carry NO key from this source — the residual that matters. */
async function unkeyed(db) {
  const { data, error } = await db.rpc('treasury_unkeyed_entities', {
    p_source: DATA_SOURCE_NAME,
    p_state: 'MN',
    p_entity_type: 'city',
  });
  // ⚠ A coverage number that silently fails to load would read as full coverage.
  if (error) throw new Error(`unkeyed-entity check failed to run: ${error.message}`);
  return data || [];
}

async function main() {
  const { values } = parseArgs({
    options: {
      fy:        { type: 'string', multiple: true },
      file:      { type: 'string', multiple: true },
      'dry-run': { type: 'boolean' },
    },
  });

  const dryRun = values['dry-run'] || false;

  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Run with: node --env-file=.env scripts/registerMnOsaEntityKeys.mjs');
    process.exitCode = 1;
    return;
  }
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`\nMN OSA source-key registration — approach C${dryRun ? '  [dry-run]' : ''}`);
  console.log(`  Source: ${DATA_SOURCE_NAME}`);

  const files = [];
  for (const f of values.file || []) {
    if (!existsSync(f)) { console.log(`  --file not found: ${f}`); continue; }
    files.push(f);
  }
  if (!values.file || values.file.length === 0) {
    for (const fy of (values.fy || DEFAULT_YEARS.map(String)).map(Number)) {
      const p = acquireCityFile(fy);
      if (p) files.push(p);
    }
  }
  if (files.length === 0) {
    console.error('No workbooks to read.');
    process.exitCode = 1;
    return;
  }

  const before = await unkeyed(db);
  console.log(`  Unkeyed MN cities before: ${before.length}`);

  // ⚠ Roster order matters: the NEWEST file is read first, so a key is first
  // seen under the spelling the publisher prints TODAY. An older file then
  // resolves the same id through the alias path rather than fighting it.
  const roster = new Map(); // govEntityId -> name (first spelling wins)
  for (const file of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const pairs = enumerateEntityKeys(wb, 'city');
    let added = 0;
    for (const { name, govEntityId } of pairs) {
      if (roster.has(govEntityId)) continue;
      roster.set(govEntityId, name);
      added++;
    }
    console.log(`  ${file}: ${pairs.length} entities with an id (${added} new to this run)`);
  }

  console.log(`  Roster: ${roster.size} distinct GovEntityIDs`);

  if (dryRun) {
    console.log('\nDry-run — nothing written.');
    return;
  }

  const missing = [];
  let resolved = 0;
  for (const [govEntityId, name] of roster) {
    const { data, error } = await db.rpc('treasury_register_source_key', {
      p_source: DATA_SOURCE_NAME,
      p_source_entity_key: govEntityId,
      p_name: name,
      p_state: 'MN',
      p_entity_type: 'city',
    });
    // ⚠ Do NOT swallow this. A raise here is the key meaning two governments,
    // or one government carrying two ids — findings, not noise.
    if (error) throw new Error(`register ${name} (id ${govEntityId}): ${error.message}`);
    if (data) resolved++; else missing.push({ name, govEntityId });
  }

  const after = await unkeyed(db);

  console.log(`\n  Registered/confirmed: ${resolved} of ${roster.size}`);
  console.log(`  Newly protected:      ${before.length - after.length}`);
  console.log(`  No TT entity:         ${missing.length}`);
  for (const m of missing) console.log(`     ${m.name} (GovEntityID ${m.govEntityId})`);
  console.log(`  Still unkeyed:        ${after.length} MN cities identified by NAME ALONE`);
  for (const u of after.slice(0, 40)) console.log(`     ${u.name}`);
  if (after.length > 40) console.log(`     ... and ${after.length - 40} more`);

  console.log(
    after.length === 0
      ? '\nEvery MN city TT holds is now identified by the publisher\'s own id. A re-spelling cannot fork one.'
      : '\n⚠ The cities above are still name-identified. Each is one publisher rename away from forking.',
  );
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
