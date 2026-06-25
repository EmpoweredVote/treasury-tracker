#!/usr/bin/env node
/**
 * Ohio City→County Linker — sets municipalities.county_id for every Ohio city
 * by reading the workbook OI_Demographics County column (CONTEXT D-05 sourced linking).
 *
 * Strategy:
 *   1. Load all OH city municipalities from the DB (253 cities from Phase 85).
 *   2. For each city, read its County value from the most recent FY GAAP city workbook
 *      (prefer FY2024 GAAP → FY2023 GAAP → … → FY2016 GAAP → CASH/MOD fallback).
 *   3. The bare county name returned by cityCounty() (e.g. "Franklin") is mapped to
 *      the parent municipality named "<County> County" (e.g. "Franklin County"),
 *      entity_type='county', state='OH'.
 *   4. If the parent county municipality exists and the city's county_id differs →
 *      UPDATE municipalities.county_id (idempotent set-if-different).
 *   5. If the county value is blank or no matching county municipality exists →
 *      record in link-residual (no phantom county, no write).
 *   6. Counties keep county_id NULL (they are the top sub-state tier per CONTEXT D-06).
 *
 * Precedent: scripts/seedMACountyLinks.js (Phase 25 city→county county_id pattern).
 *
 * Usage:
 *   node scripts/linkOhioCitiesToCounties.js --dry-run   # print plan, zero writes
 *   node scripts/linkOhioCitiesToCounties.js             # live run (idempotent)
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_KEY (loaded from .env / .env.local auto).
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { cityCounty, getSupabase, detectLayout } from './loadOhioAOS.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECON_DIR = join(__dirname, '..', '_oh-recon');

// ── .env loader (mirrors seedMACountyLinks.js) ────────────────────────────────
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore missing */ }
  }
}
loadEnv();

// ── Workbook acquisition (uses cached _oh-recon/ XLSX files) ─────────────────

/**
 * Load a city workbook from _oh-recon/ if present. Returns the ExcelJS Workbook or null.
 * Tries GAAP first, then CASH, then MOD for the given FY.
 */
async function loadCityWorkbook(fy, basis) {
  const filename = `City_${fy}_${basis}_Summarized.XLSX`;
  const localPath = join(RECON_DIR, filename);
  if (!existsSync(localPath)) return null;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(localPath);
    return wb;
  } catch {
    return null;
  }
}

/**
 * Build a county lookup map for all cities in a workbook: cityName → bare county name.
 * Uses detectLayout + OI_Demographics tab.
 * Returns Map<cityName_lowercase, bareCo name> for all cities found in the Demographics tab.
 */
function buildCountyMap(workbook) {
  let layout;
  try { layout = detectLayout(workbook); } catch { return new Map(); }
  const ws = workbook.getWorksheet('OI_Demographics');
  if (!ws) return new Map();

  const map = new Map();
  for (let r = layout.demoDataStart; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    // Entity name
    const rawName = ws.getRow(r).getCell(layout.demoEntityCol)?.value;
    if (!rawName) continue;
    let name = typeof rawName === 'string' ? rawName.trim()
      : (rawName?.richText ? rawName.richText.map(t => t.text).join('').trim() : String(rawName).trim());
    if (!name) continue;
    // Strip "City of" prefix
    name = name.replace(/^city\s+of\s+/i, '').trim();

    // County name
    const rawCo = ws.getRow(r).getCell(layout.demoCountyCol)?.value;
    if (!rawCo) continue;
    let co = typeof rawCo === 'string' ? rawCo.trim()
      : (rawCo?.richText ? rawCo.richText.map(t => t.text).join('').trim() : String(rawCo).trim());

    if (name && co) {
      map.set(name.toLowerCase(), co);
    }
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean' } },
    strict: false,
  });
  const dryRun = values['dry-run'] ?? false;

  console.log('Ohio City→County Linker (linkOhioCitiesToCounties.js)');
  console.log('─'.repeat(55));
  if (dryRun) console.log('[DRY RUN] No writes will be performed.\n');

  // ── Step 1: Build city name → county map from workbooks ────────────────────
  // Priority: FY2024 GAAP → FY2023 GAAP → … → FY2016 GAAP → FY2024 CASH → FY2024 MOD
  // The city→county relationship is stable across FY; we just need at least one hit.

  console.log('Step 1: Build city→county map from workbook OI_Demographics...');

  const cityCountyMap = new Map(); // cityName_lower → bareCo name (e.g. "columbus" → "Franklin")

  // Prioritised workbook list: GAAP FY2024 down to 2016, then CASH/MOD
  const wbOrder = [];
  for (let fy = 2024; fy >= 2016; fy--) wbOrder.push([fy, 'GAAP']);
  wbOrder.push([2024, 'CASH'], [2024, 'MOD']);

  let wbsLoaded = 0;
  for (const [fy, basis] of wbOrder) {
    const wb = await loadCityWorkbook(fy, basis);
    if (!wb) continue;
    const map = buildCountyMap(wb);
    let newEntries = 0;
    for (const [cityLower, co] of map) {
      if (!cityCountyMap.has(cityLower)) {
        cityCountyMap.set(cityLower, co);
        newEntries++;
      }
    }
    console.log(`  FY${fy} ${basis}: ${map.size} entries, ${newEntries} new (total so far: ${cityCountyMap.size})`);
    wbsLoaded++;
    // Stop early once we have a stable count (all cities covered)
    if (cityCountyMap.size >= 250) {
      console.log(`  Stopping workbook scan — ${cityCountyMap.size} cities mapped.`);
      break;
    }
  }

  console.log(`  Total workbooks scanned: ${wbsLoaded}`);
  console.log(`  Total city→county entries: ${cityCountyMap.size}`);

  // ── Step 2: Load OH cities from DB ─────────────────────────────────────────
  console.log('\nStep 2: Load OH city municipalities from DB...');

  const supabase = await getSupabase();
  const { data: ohCities, error: fetchErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, county_id')
    .eq('state', 'OH')
    .eq('entity_type', 'city')
    .order('name');

  if (fetchErr) {
    console.error('Failed to fetch OH cities:', fetchErr.message);
    process.exit(1);
  }

  console.log(`  Found ${ohCities.length} OH city municipalities.`);

  // ── Step 3: Load county id map (by canonical name) ─────────────────────────
  console.log('\nStep 3: Load OH county municipalities from DB...');

  const { data: ohCounties, error: countyErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('state', 'OH')
    .eq('entity_type', 'county');

  if (countyErr) {
    console.error('Failed to fetch OH counties:', countyErr.message);
    process.exit(1);
  }

  // Map: lowercase canonical name → id
  const countyIdMap = new Map();
  for (const c of ohCounties) {
    countyIdMap.set(c.name.toLowerCase(), c.id);
  }
  console.log(`  Found ${ohCounties.length} OH county municipalities.`);

  // ── Step 4: Compute links + residual ───────────────────────────────────────
  console.log('\nStep 4: Compute city→county links...');

  const toLink = [];   // { city, countyMuniId, countyName }
  const residual = []; // { city, reason }
  let alreadyLinked = 0;

  for (const city of ohCities) {
    const cityLower = city.name.toLowerCase();
    const bareCo = cityCountyMap.get(cityLower);

    if (!bareCo) {
      residual.push({ city: city.name, reason: 'No county entry found in workbook OI_Demographics' });
      continue;
    }

    // Canonical county municipality name: "<BareCo> County"
    const canonicalCo = `${bareCo} County`.toLowerCase();
    const countyId = countyIdMap.get(canonicalCo);

    if (!countyId) {
      residual.push({ city: city.name, reason: `County municipality "${bareCo} County" not found in DB (not loaded)` });
      continue;
    }

    if (city.county_id === countyId) {
      alreadyLinked++;
      continue; // idempotent: already correct
    }

    toLink.push({ city, countyMuniId: countyId, countyName: `${bareCo} County` });
  }

  console.log(`  To link (new or changed): ${toLink.length}`);
  console.log(`  Already correctly linked: ${alreadyLinked}`);
  console.log(`  Residual (no match):      ${residual.length}`);

  if (toLink.length > 0) {
    console.log('\n  Sample links:');
    for (const { city, countyName } of toLink.slice(0, 5)) {
      console.log(`    ${city.name} → ${countyName}`);
    }
    if (toLink.length > 5) console.log(`    ... (+${toLink.length - 5} more)`);
  }

  if (residual.length > 0) {
    console.log('\n  Residual cities:');
    for (const { city: c, reason } of residual.slice(0, 10)) {
      console.log(`    ${c}: ${reason}`);
    }
    if (residual.length > 10) console.log(`    ... (+${residual.length - 10} more)`);
  }

  if (dryRun) {
    console.log('\n─'.repeat(55));
    console.log('Dry run complete — no writes performed.');
    console.log(`Would link: ${toLink.length} cities`);
    console.log(`Already correct: ${alreadyLinked} cities`);
    console.log(`Link residual: ${residual.length} cities`);
    return;
  }

  // ── Step 5: Live UPDATE county_id (idempotent set-if-different) ─────────────
  console.log('\nStep 5: Update county_id for OH cities...');

  let linked = 0;
  let failed = 0;

  for (const { city, countyMuniId, countyName } of toLink) {
    const { error: updateErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update({ county_id: countyMuniId })
      .eq('id', city.id)
      .eq('entity_type', 'city'); // safety: never accidentally update a county row

    if (updateErr) {
      console.error(`  ✗ ${city.name} → ${countyName}: ${updateErr.message}`);
      failed++;
    } else {
      linked++;
    }
  }

  console.log(`  Linked: ${linked} cities`);
  if (failed > 0) console.log(`  Failed: ${failed} cities`);

  // ── Step 6: Verification ─────────────────────────────────────────────────────
  console.log('\nStep 6: Verification...');

  // Total OH cities with county_id set
  const { count: linkedCount } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id', { count: 'exact', head: true })
    .eq('state', 'OH')
    .eq('entity_type', 'city')
    .not('county_id', 'is', null);

  console.log(`  OH cities with county_id set: ${linkedCount} / ${ohCities.length}`);

  // Columbus → Franklin County spot-check
  const { data: columbusRow } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, county_id')
    .eq('state', 'OH')
    .eq('name', 'Columbus')
    .limit(1);

  if (columbusRow?.[0]?.county_id) {
    const { data: franklinRow } = await supabase
      .schema('treasury')
      .from('municipalities')
      .select('id, name, entity_type')
      .eq('id', columbusRow[0].county_id)
      .limit(1);
    console.log(`  Columbus.county_id → ${franklinRow?.[0]?.name || '(unknown)'} [${franklinRow?.[0]?.entity_type || '?'}]`);
  } else {
    console.log('  WARNING: Columbus has no county_id set');
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  console.log(`DONE. ${linked} OH cities linked to their county.`);
  console.log(`Already correct: ${alreadyLinked}`);
  console.log(`Total with county_id: ${linkedCount} / ${ohCities.length}`);
  if (residual.length > 0) {
    console.log(`Link residual (${residual.length} cities not linked):`);
    for (const { city: c, reason } of residual) {
      console.log(`  ${c}: ${reason}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
