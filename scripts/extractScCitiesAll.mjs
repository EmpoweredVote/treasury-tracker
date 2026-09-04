/**
 * Batch-extract the South Carolina city General Fund series (wave 1).
 *
 * NO SHEBANG — tests import `KNOWN_DOCUMENT_GAPS` and `stemFor`.
 *
 * Usage:
 *   node scripts/extractScCitiesAll.mjs
 *   node scripts/extractScCitiesAll.mjs --entity charleston --fy 2024
 *   node scripts/extractScCitiesAll.mjs --out _acfr-work/sc-cities/extracted
 *
 * Runs each entity's thin `acfrGF.py` wrapper over each fetched ACFR and writes
 * `<key>-<fy>-<mode>.json`. Refuses to write anything whose `tie_delta` is not 0.
 *
 * ── ⚠⚠ THE TIE PROVES THE READ, NEVER THE SHAPE ────────────────────────────
 *
 * Every extraction here ties at $0, and that is necessary, not sufficient. Both
 * structures were determined from pdfplumber GLYPH COORDINATES and then confirmed
 * by adding the printed leaves up by hand — see the docstring of each extractor.
 * Four documented failure modes produce a WRONG TREE THAT TIES AT $0: a revenue
 * group that closes in the wrong place, a `parents` entry that does not match the
 * printed wording, a wrong `units`, and picking up the budgetary schedule.
 *
 * ⚠ `pdftotext -layout` is UNUSABLE on Charleston — it emits the label column and
 * the numeric columns as separate blocks and pairs each label with another row's
 * money. Structure came from coordinates; `-table` is what the parser reads.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  SC_CITY_COVERAGE_GAPS, SC_CITY_DEFERRED, scCityLoadableEntities, scCityYearsFor,
} from './data/scCityAcfrEntities.mjs';

const ROOT = process.cwd();
const PDF_BASE = path.join(ROOT, '_acfr-work', 'sc-cities', 'acfr');
export const DEFAULT_OUT = path.join(ROOT, '_acfr-work', 'sc-cities', 'extracted');
export const MODES = ['revenue', 'operating'];

/**
 * Documents that exist but cannot be read, with the CAUSE.
 *
 * ⚠ Empty for every entity but North Charleston, whose six unreadable years are
 * declared below with the CAUSE and with the second publisher that was checked
 * before each was called lost.
 */
export const KNOWN_DOCUMENT_GAPS = Object.freeze({
  // ⚠⚠ NORTH CHARLESTON — six of ten years, each checked at BOTH publishers
  // (the Federal Audit Clearinghouse and the city's own site, which publishes
  // FY2015-FY2025). Quality is a property of the COPY, not only the issuer, so
  // "unreadable" is only ever said after the second copy has been measured too.
  // ⚠ A gap here is a DOCUMENT-QUALITY gap, unlike Summerville's and Goose
  // Creek's, which are years with no federal filing at all. Never $0.
  'north-charleston-2016': 'FAC: revenue reads and ties, but the EXPENDITURE section '
    + 'fuses three printed rows beyond recovery (`General Public Sanitation safety '
    + 'government`). City copy: a pure image, 1 char/page. A year needs both datasets.',
  'north-charleston-2017': 'FAC: the primary General Fund statement page cannot be '
    + 'located at all — only budgetary and combining schedules match. City copy: 1 '
    + 'char/page.',
  'north-charleston-2018': 'FAC: the General Fund expenditure total is mangled as '
    + '`I 18.446,203` — a letter for a digit AND a period for a comma, two '
    + 'substitutions nothing independent confirms. ⭐ The CITY copy passes all four '
    + 'quality checks and its REVENUE ties at $0, but its expenditure statement '
    + 'prints no General Fund figure for `General government` or `Public safety`.',
  'north-charleston-2019': 'image-only at FAC (120 chars/page) AND at the city (1 '
    + 'char/page over 150 pages).',
  'north-charleston-2020': 'image-only at FAC (118 chars/page) AND at the city (226).',
  'north-charleston-2023': 'image-only at FAC (238 chars/page) AND at the city (129).',
});

export function stemFor(entityKey, fiscalYear) {
  return `${entityKey}-${fiscalYear}`;
}

/** ⚠ Windows needs the interpreter named; `py`/`python` on PATH are Store stubs. */
function pythonBin() {
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const p = path.join(local, 'Python', 'pythoncore-3.14-64', 'python.exe');
    if (existsSync(p)) return p;
  }
  return process.env.PYTHON || 'python';
}

export async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: DEFAULT_OUT },
      entity: { type: 'string' },
      fy: { type: 'string' },
    },
  });

  const entities = values.entity
    ? scCityLoadableEntities().filter((e) => e.key === values.entity)
    : scCityLoadableEntities();
  if (!entities.length) throw new Error(`No loadable entity matched ${values.entity}`);

  mkdirSync(values.out, { recursive: true });
  const py = pythonBin();

  let written = 0;
  const failures = [];
  const gaps = [];

  for (const ent of entities) {
    if (!ent.extractor) throw new Error(`${ent.key} has no extractor declared`);
    const years = scCityYearsFor(ent);
    console.log(`\n${ent.name} (${ent.entityType}) — ${years.length} documents`);

    for (const fy of years) {
      if (values.fy && Number(values.fy) !== fy) continue;
      const stem = stemFor(ent.key, fy);
      if (KNOWN_DOCUMENT_GAPS[stem]) { gaps.push(`${stem}: ${KNOWN_DOCUMENT_GAPS[stem]}`); continue; }

      const pdf = path.join(PDF_BASE, ent.key, `${ent.key}_${fy}.pdf`);
      if (!existsSync(pdf)) { gaps.push(`${stem}: PDF not fetched`); continue; }

      const line = [];
      for (const mode of MODES) {
        const r = spawnSync(py, [ent.extractor, pdf, '--mode', mode], {
          encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
        });
        if (r.status !== 0) {
          failures.push(`${stem} ${mode}: ${(r.stderr || '').trim().split('\n').pop()}`);
          continue;
        }
        let data;
        try { data = JSON.parse(r.stdout); } catch {
          failures.push(`${stem} ${mode}: extractor did not emit JSON`);
          continue;
        }
        // ⚠⚠ Refuse to WRITE a bad tie. A cached file is trusted downstream.
        if (data.tie_delta !== 0) {
          failures.push(`${stem} ${mode}: tie_delta ${data.tie_delta}`);
          continue;
        }
        if (Number(data.fiscal_year) !== fy) {
          failures.push(`${stem} ${mode}: document reports FY${data.fiscal_year}, expected FY${fy}`);
          continue;
        }
        writeFileSync(path.join(values.out, `${stem}-${mode}.json`),
          `${JSON.stringify(data, null, 1)}\n`, 'utf8');
        written += 1;
        line.push(`${mode} ${Number(data.computed_total).toLocaleString()}`);
      }
      if (line.length === MODES.length) console.log(`  FY${fy}  ${line.join('   ')}`);
    }
  }

  if (gaps.length) {
    console.log('\nDECLARED GAPS — never written as $0:');
    for (const g of gaps) console.log(`  ${g}`);
  }
  for (const [key, d] of Object.entries(SC_CITY_DEFERRED)) {
    console.log(`\nDEFERRED ENTITY — ${key}: ${d.reason}`);
  }
  for (const [key, years] of Object.entries(SC_CITY_COVERAGE_GAPS)) {
    for (const [fy, why] of Object.entries(years)) {
      console.log(`  coverage gap ${key} FY${fy}: ${why}`);
    }
  }

  console.log(`\n${written} extraction(s) written to ${path.relative(ROOT, values.out)}.`);
  if (failures.length) {
    console.error(`\nREFUSING: ${failures.length} extraction failure(s):`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  // ⚠⚠ A run that extracted nothing must FAIL, not read as success.
  if (written === 0) {
    console.error('REFUSING: zero extractions were written. Nothing was measured.');
    process.exit(1);
  }
  return written;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('extractScCitiesAll.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
