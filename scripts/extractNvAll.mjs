/**
 * Batch-extract the Nevada ACFR General Fund series (Reno + Washoe County).
 *
 * NO SHEBANG — tests import `extractedPath` and `KNOWN_DOCUMENT_GAPS`.
 *
 * Usage:
 *   node scripts/extractNvAll.mjs --pdf-dir docs --out _acfr-work/nv/extracted
 *   node scripts/extractNvAll.mjs --entity reno --fy 2025 --out <dir>
 *
 * Runs the two thin Python wrappers over `scripts/lib/acfrGfCoords.py`, one
 * per entity, and writes one JSON per (entity, fiscal year, mode).
 *
 * ⚠⚠ IT RE-CHECKS THE TIE RATHER THAN TRUSTING THE EXIT CODE. The extractor
 * exits non-zero on a bad tie, but a batch that only watched exit codes would
 * happily cache a file whose `tie_delta` later stopped being read. Both this
 * and the loader assert it independently.
 *
 * ⚠ A TIE PROVES THE READ, NEVER THE SHAPE. Four documented ways exist to
 * produce a wrong tree that ties at $0 — see
 * `reference_acfr_gf_extractor_howto`. This batch additionally prints the
 * ROOT-LEVEL SUBTOTALS per filing so a weld or a mis-parent is visible to a
 * human reading the output, which is the only check that sees that class.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { NV_ENTITIES, nvEntityByKey } from './data/nvAcfrEntities.mjs';
import { NV_WINDOWS, KNOWN_DOCUMENT_GAPS } from './data/nvAcfrSources.mjs';

export { KNOWN_DOCUMENT_GAPS };

/** Where each entity's PDFs sit, and how a fiscal year names one. */
export const PDF_DIR = Object.freeze({
  reno: 'Reno',
  'washoe-county': 'WashoeCounty',
});

/**
 * ⚠ Washoe FY2024 is stored under the REISSUED PRINTABLE file, because that is
 * the one the county's own ACFR index links. The 288pp revised variant yields
 * identical General Fund figures — both were extracted and compared.
 */
export const PDF_NAME = Object.freeze({
  'washoe-county': { 2024: 'FY2024-reissued-printable.pdf' },
});

export function pdfPathFor(pdfDir, entityKey, fiscalYear) {
  const name = PDF_NAME[entityKey]?.[fiscalYear] || `FY${fiscalYear}.pdf`;
  return join(pdfDir, PDF_DIR[entityKey], name);
}

export const SCRIPT_FOR = Object.freeze({
  reno: 'scripts/extractRenoNV.py',
  'washoe-county': 'scripts/extractWashoeCountyNV.py',
});

export function extractedPath(outDir, entityKey, fiscalYear, mode) {
  return join(outDir, `${entityKey}-${fiscalYear}-${mode}.json`);
}

/** `py -3` per this repo's probed toolchain; see reference_python_toolchain_location. */
function runExtractor(entityKey, pdfPath, mode) {
  const r = spawnSync('py', ['-3', SCRIPT_FOR[entityKey], pdfPath, '--mode', mode], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw new Error(`could not run py -3: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`${entityKey} ${mode} ${pdfPath}: exit ${r.status}\n${(r.stderr || '').trim()}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch (e) {
    throw new Error(`${entityKey} ${mode} ${pdfPath}: stdout was not JSON — ${e.message}`);
  }
  return parsed;
}

/** Root-level children and their amounts — the only view that shows a weld. */
function subtotals(tree) {
  return (tree.c || []).map((r) => `${r.n}=${r.a.toLocaleString()}`).join('  ');
}

async function main() {
  const { values } = parseArgs({
    options: {
      'pdf-dir': { type: 'string', default: 'docs' },
      out: { type: 'string' },
      entity: { type: 'string' },
      fy: { type: 'string' },
    },
  });
  if (!values.out) {
    console.error('Usage: node scripts/extractNvAll.mjs --out <dir> [--pdf-dir docs] [--entity k] [--fy n]');
    process.exitCode = 1;
    return;
  }
  mkdirSync(values.out, { recursive: true });

  const entities = values.entity
    ? [nvEntityByKey(values.entity)].filter(Boolean)
    : [...NV_ENTITIES];
  if (!entities.length) {
    console.error(`No such entity: ${values.entity}`);
    process.exitCode = 1;
    return;
  }

  let ok = 0;
  const failures = [];
  for (const ent of entities) {
    const years = (NV_WINDOWS[ent.key] || [])
      .filter((y) => !values.fy || Number(values.fy) === y);
    for (const fy of years) {
      const pdfPath = pdfPathFor(values['pdf-dir'], ent.key, fy);
      for (const mode of ['revenue', 'operating']) {
        try {
          const data = runExtractor(ent.key, pdfPath, mode);
          if (data.tie_delta !== 0) {
            throw new Error(`tie_delta ${data.tie_delta} — components do not meet the printed total`);
          }
          if (Number(data.fiscal_year) !== fy) {
            throw new Error(`document reports FY${data.fiscal_year}, expected FY${fy}`);
          }
          writeFileSync(extractedPath(values.out, ent.key, fy, mode), `${JSON.stringify(data, null, 2)}\n`);
          ok += 1;
          console.log(`  ${ent.name} FY${fy} ${mode.padEnd(9)} ${String(data.tree.a).padStart(12)}  tie=0`);
          console.log(`      ${subtotals(data.tree)}`.slice(0, 160));
        } catch (e) {
          failures.push(`${ent.name} FY${fy} ${mode}: ${e.message}`);
          console.error(`  ${ent.name} FY${fy} ${mode} FAILED — ${e.message}`);
        }
      }
    }
  }

  console.log(`\n${ok} extraction(s) written to ${values.out}`);
  for (const gap of KNOWN_DOCUMENT_GAPS) {
    console.log(`\nℹ️  DECLARED GAP — ${gap.entity} FY${gap.fiscalYears.join(', FY')}`);
    console.log(`   ${gap.reason}`);
  }
  if (failures.length) {
    console.error(`\n❌ ${failures.length} extraction(s) failed:`);
    for (const f of failures) console.error(`   ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✅ every filing in the window extracted and tied at $0.');
}

// ⚠ `process.exitCode`, never `process.exit()` — see reference_figure_flag_rules.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main().catch((e) => { console.error(`\n❌ ${e.message}`); process.exitCode = 1; });
}
