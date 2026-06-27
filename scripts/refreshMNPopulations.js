#!/usr/bin/env node
/**
 * Refresh MN municipality populations to their LATEST available FY value (v2.9 Phase 90).
 *
 * Why: treasury_ensure_municipality sets population only on INSERT, so a serial load that runs
 * oldest-FY-first leaves each municipality.population stuck at its earliest year. municipalities.population
 * is a single column (the per-capita denominator — per-year-source value, no fixed Census vintage), so the
 * most useful value is the entity's MOST RECENT filed-year population. This pass sweeps the manifest FY
 * range newest -> oldest, takes the first (newest) non-zero Population per entity, and UPDATEs the
 * municipality row.
 *
 * Idempotent: a second run finds every row already at its latest value and updates 0. Reusable for
 * counties in Phase 91 (--entity-type county). Requires the gitignored .env SUPABASE_SERVICE_KEY.
 *
 * Usage:
 *   node scripts/refreshMNPopulations.js --entity-type city [--dry-run]
 *   node scripts/refreshMNPopulations.js --entity-type county
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { getSupabase, enumerateEntities, entityPopulation, resolveSourceUrl, normalizeLabel } from './loadMNOSA.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECON_DIR = join(__dirname, '..', '_mn-recon');

/** Manifest FY list (descending) that has a workbook URL for the entity type. */
function manifestFYsDesc(entityType) {
  const m = JSON.parse(readFileSync(join(__dirname, 'mnOsaDatasets.json'), 'utf8'));
  const key = entityType === 'county' ? 'county_url' : 'city_url';
  return m.datasets.filter((d) => d[key]).map((d) => d.fiscal_year).sort((a, b) => b - a);
}

/** Acquire (download-if-missing) a workbook for (fy, entityType) into _mn-recon/; returns the open workbook or null. */
async function acquire(fy, entityType) {
  const url = resolveSourceUrl(fy, entityType);
  if (!url) return null;
  const prefix = entityType === 'county' ? 'county' : 'cired';
  const localPath = join(RECON_DIR, `${prefix}_${String(fy).slice(-2)}_data.xlsx`);
  if (!existsSync(localPath)) {
    if (!existsSync(RECON_DIR)) mkdirSync(RECON_DIR, { recursive: true });
    try { execSync(`curl -fsSL -o "${localPath}" "${url}"`, { stdio: 'pipe', timeout: 120000 }); }
    catch { return null; }
  }
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.readFile(localPath); } catch { return null; }
  return wb;
}

export async function refreshLatestPopulations({ entityType = 'city', dryRun = false } = {}) {
  const fys = manifestFYsDesc(entityType);
  // newest -> oldest: first non-zero population per entity wins
  const latest = new Map(); // normName -> { pop, fy, name }
  for (const fy of fys) {
    const wb = await acquire(fy, entityType);
    if (!wb) continue;
    for (const name of enumerateEntities(wb, entityType)) {
      const k = normalizeLabel(name);
      if (latest.has(k)) continue;
      const pop = entityPopulation(wb, name, entityType);
      if (Number.isFinite(pop) && pop > 0) latest.set(k, { pop, fy, name });
    }
  }
  console.log(`Latest-FY population resolved for ${latest.size} ${entityType} entities (FY ${fys[fys.length - 1]}–${fys[0]})`);

  const sb = await getSupabase();
  const munis = (await sb.schema('treasury').from('municipalities')
    .select('id,name,population').eq('state', 'MN').eq('entity_type', entityType)).data || [];
  let updated = 0, unchanged = 0, nomatch = 0;
  for (const m of munis) {
    const rec = latest.get(normalizeLabel(m.name));
    if (!rec) { nomatch++; continue; }
    if (m.population === rec.pop) { unchanged++; continue; }
    if (!dryRun) {
      const { error } = await sb.schema('treasury').from('municipalities').update({ population: rec.pop }).eq('id', m.id);
      if (error) { console.error(`  update failed ${m.name}: ${error.message}`); continue; }
    }
    updated++;
  }
  console.log(`${dryRun ? '[dry-run] would update' : 'Updated'}: ${updated} | unchanged: ${unchanged} | no source match: ${nomatch}`);
  return { entityType, updated, unchanged, nomatch, resolved: latest.size };
}

async function main() {
  const { values } = parseArgs({ options: { 'entity-type': { type: 'string' }, 'dry-run': { type: 'boolean' } } });
  await refreshLatestPopulations({ entityType: values['entity-type'] || 'city', dryRun: !!values['dry-run'] });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
