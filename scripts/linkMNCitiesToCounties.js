#!/usr/bin/env node
/**
 * MN City→County Linker — sets municipalities.county_id for every MN city by reading the city
 * workbook's ParentEntityName column (Phase 91 — MNLINK-01, CONTEXT D-04 sourced linking, no authored map).
 *
 * Strategy (mirrors scripts/linkOhioCitiesToCounties.js, but the source is the in-row ParentEntityName
 * column instead of a separate OI_Demographics tab):
 *   1. Build a city → parent-county map from the most recent city workbook (cired_23), reading
 *      entityCounty(wb, cityName, 'city') (= the ParentEntityName cell). Fall back to older FY city
 *      workbooks for any city absent from FY2023 (the city→county relationship is stable across years).
 *   2. Load MN city + county municipalities from the DB. County rows are stored "<Name> County".
 *   3. Match each city's bare ParentEntityName ("Hennepin") to its county municipality by NORMALIZED
 *      stem (county name minus " County"), so casing variants tie. If matched and county_id differs →
 *      UPDATE municipalities.county_id (idempotent set-if-different, guarded .eq('entity_type','city')).
 *   4. Cities with a blank ParentEntityName or no matching loaded county → link-residual (no phantom).
 *   5. Counties keep county_id NULL (top sub-state tier — D-05).
 *
 * Usage:
 *   node scripts/linkMNCitiesToCounties.js --dry-run   # print plan, zero writes
 *   node scripts/linkMNCitiesToCounties.js             # live (idempotent)
 * Env: SUPABASE_URL + SUPABASE_SERVICE_KEY (from .env).
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { getSupabase, enumerateEntities, entityCounty, normalizeLabel } from './loadMNOSA.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECON_DIR = join(__dirname, '..', '_mn-recon');
// Newest-first city workbooks (ParentEntityName is stable across years; first hit wins).
const CITY_FYS = [23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12];

/** county stem key: normalized name with a trailing " county" removed. */
const countyStem = (name) => normalizeLabel(String(name).replace(/\s+county$/i, ''));

async function main() {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' } }, strict: false });
  const dryRun = values['dry-run'] ?? false;

  console.log('MN City→County Linker (linkMNCitiesToCounties.js)');
  console.log('─'.repeat(55));
  if (dryRun) console.log('[DRY RUN] No writes will be performed.\n');

  // ── Step 1: city → parent-county (ParentEntityName) map from city workbooks ──
  console.log('Step 1: Build city→ParentEntityName map from city workbooks...');
  const cityToCounty = new Map(); // normalized city name → bare ParentEntityName
  for (const yy of CITY_FYS) {
    const p = join(RECON_DIR, `cired_${yy}_data.xlsx`);
    if (!existsSync(p)) continue;
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.readFile(p); } catch { continue; }
    let added = 0;
    for (const city of enumerateEntities(wb, 'city')) {
      const k = normalizeLabel(city);
      if (cityToCounty.has(k)) continue;
      const parent = entityCounty(wb, city, 'city');
      if (parent) { cityToCounty.set(k, parent); added++; }
    }
    console.log(`  cired_${yy}: +${added} (total ${cityToCounty.size})`);
    if (cityToCounty.size >= 850) break;
  }

  const sb = await getSupabase();

  // ── Step 2: load MN city + county municipalities ───────────────────────────
  const cities = (await sb.schema('treasury').from('municipalities')
    .select('id,name,county_id').eq('state', 'MN').eq('entity_type', 'city').order('name')).data || [];
  const counties = (await sb.schema('treasury').from('municipalities')
    .select('id,name').eq('state', 'MN').eq('entity_type', 'county')).data || [];
  console.log(`\nStep 2: ${cities.length} MN cities, ${counties.length} MN counties in DB.`);

  const countyByStem = new Map();
  for (const c of counties) countyByStem.set(countyStem(c.name), c);

  // ── Step 3: compute links ──────────────────────────────────────────────────
  const toLink = []; const residual = []; let already = 0;
  for (const city of cities) {
    const parent = cityToCounty.get(normalizeLabel(city.name));
    if (!parent) { residual.push({ city: city.name, reason: 'no ParentEntityName in any city workbook' }); continue; }
    const county = countyByStem.get(countyStem(parent));
    if (!county) { residual.push({ city: city.name, reason: `parent county "${parent}" not loaded` }); continue; }
    if (city.county_id === county.id) { already++; continue; }
    toLink.push({ city, countyId: county.id, countyName: county.name });
  }
  console.log(`\nStep 3: to-link ${toLink.length} | already ${already} | residual ${residual.length}`);
  for (const l of toLink.slice(0, 5)) console.log(`    ${l.city.name} → ${l.countyName}`);
  if (residual.length) for (const r of residual.slice(0, 10)) console.log(`    [residual] ${r.city}: ${r.reason}`);

  if (dryRun) {
    console.log(`\n[dry-run] would link ${toLink.length}, already ${already}, residual ${residual.length}. No writes.`);
    return { toLink: toLink.length, already, residual };
  }

  // ── Step 4: live UPDATE county_id (set-if-different) ────────────────────────
  let linked = 0, failed = 0;
  for (const { city, countyId, countyName } of toLink) {
    const { error } = await sb.schema('treasury').from('municipalities')
      .update({ county_id: countyId }).eq('id', city.id).eq('entity_type', 'city');
    if (error) { console.error(`  ✗ ${city.name} → ${countyName}: ${error.message}`); failed++; }
    else linked++;
  }
  const withCounty = (await sb.schema('treasury').from('municipalities')
    .select('*', { count: 'exact', head: true }).eq('state', 'MN').eq('entity_type', 'city').not('county_id', 'is', null)).count;
  console.log(`\nStep 4: linked ${linked}, failed ${failed}. MN cities with county_id: ${withCounty}/${cities.length}.`);
  if (residual.length) console.log(`Link residual (${residual.length}): ${residual.slice(0, 20).map(r => r.city).join(', ')}${residual.length > 20 ? ' …' : ''}`);
  return { linked, failed, withCounty, residual };
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
