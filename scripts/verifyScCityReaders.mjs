/**
 * Corroborate the SC city coordinate reader against the `-table` reader.
 *
 * NO SHEBANG — tests import `READER_DISAGREEMENTS` and `disagreementFor`.
 *
 * Usage:
 *   node scripts/verifyScCityReaders.mjs
 *   node scripts/verifyScCityReaders.mjs --entity rock-hill
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * When an entity moves onto `acfrGfCoords.py`, the campaign requires the OTHER
 * reader to keep corroborating every year it can still read. Otherwise the move
 * is unfalsifiable: a coordinate reader that quietly went wrong would tie at $0
 * exactly as happily as the character-grid reader it replaced.
 *
 * The two share NO code and NO strategy:
 *   acfrGF.py        flattens the page onto a CHARACTER grid, then assigns each
 *                    money token to the nearest column anchor.
 *   acfrGfCoords.py  the PDF's own glyph x-coordinates. Never sees the grid, so
 *                    the grid's artifacts cannot reach it.
 *
 * ── ⚠⚠ AN EXACT REGISTRY OF DISAGREEMENTS, NEVER A TOLERANCE ──────────────
 *
 * Rock Hill's two disagreements are named below with their exact deltas and
 * their diagnosed cause. Anything NOT named here fails the run. A declared
 * disagreement that is not observed also fails — otherwise a reader defect that
 * got fixed upstream would leave dead permission behind, and a NEW defect in the
 * same year would be silently excused by the old entry.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { scCityLoadableEntities } from './data/scCityAcfrEntities.mjs';

const ROOT = process.cwd();
const PDF_BASE = path.join(ROOT, '_acfr-work', 'sc-cities', 'acfr');
const MODES = ['revenue', 'operating'];

/**
 * Where the two readers legitimately differ, with the diagnosis.
 *
 * `delta` is (corroborating − record), exact. Both entries are the SAME defect
 * seen from two sides: `pdftotext -table` renders Rock Hill's General Fund
 * column at two character offsets.
 */
export const READER_DISAGREEMENTS = Object.freeze([
  {
    id: 'rock-hill-fy2024-revenue-two-offset',
    entityKey: 'rock-hill',
    fiscalYear: 2024,
    mode: 'revenue',
    /** `-table` reads 432,533 LESS than the coordinate reader and the page. */
    delta: -432533,
    recordTotal: 96194080,
    why: 'the -table reader drops `Fines and forfeitures`, whose General Fund cell is '
       + 'rendered ~24 characters right of the column (the two-offset defect). Its value '
       + 'IS 432,533 on the printed page, and the coordinate reader ties to the printed '
       + 'total exactly.',
  },
  {
    id: 'rock-hill-fy2025-operating-readable',
    entityKey: 'rock-hill',
    fiscalYear: 2025,
    mode: 'operating',
    /** ⚠ ZERO: the corroborating reader gets this year RIGHT. */
    delta: 0,
    recordTotal: 123434345,
    why: 'declared for the record rather than as an exception: `column_strategy=ordinal` '
       + 'breaks THIS year by 20,125 while fixing FY2024. It is the year that proves '
       + 'neither -table strategy is right for this issuer, which is why the entity moved '
       + 'to coordinates rather than to ordinal.',
  },
]);

export function disagreementFor({ entityKey, fiscalYear, mode }) {
  return READER_DISAGREEMENTS.find((d) => d.entityKey === entityKey
    && d.fiscalYear === fiscalYear && d.mode === mode) ?? null;
}

function pythonBin() {
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const p = path.join(local, 'Python', 'pythoncore-3.14-64', 'python.exe');
    if (existsSync(p)) return p;
  }
  return process.env.PYTHON || 'python';
}

function runReader(py, script, pdf, mode) {
  const r = spawnSync(py, [script, pdf, '--mode', mode], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) return { failed: (r.stderr || '').trim().split('\n').pop() };
  try { return { data: JSON.parse(r.stdout) }; } catch { return { failed: 'no JSON' }; }
}

export async function main() {
  const { values } = parseArgs({ options: { entity: { type: 'string' } } });
  const entities = scCityLoadableEntities()
    .filter((e) => e.corroboratingExtractor)
    .filter((e) => !values.entity || e.key === values.entity);

  if (!entities.length) {
    console.error('REFUSING: no entity declares a corroborating extractor. '
      + 'A check that measures nothing must fail.');
    process.exit(1);
  }

  const py = pythonBin();
  const problems = [];
  const observed = new Set();
  let compared = 0;
  let agreed = 0;

  for (const ent of entities) {
    console.log(`\n${ent.name} — ${ent.extractor} (record) vs ${ent.corroboratingExtractor} (corroborating)`);
    for (const fy of Object.keys(ent.facReports).map(Number).sort((a, b) => a - b)) {
      const pdf = path.join(PDF_BASE, ent.key, `${ent.key}_${fy}.pdf`);
      if (!existsSync(pdf)) continue;
      for (const mode of MODES) {
        const rec = runReader(py, ent.extractor, pdf, mode);
        if (rec.failed) { problems.push(`${ent.key} FY${fy} ${mode}: RECORD reader failed — ${rec.failed}`); continue; }
        if (rec.data.tie_delta !== 0) { problems.push(`${ent.key} FY${fy} ${mode}: record tie_delta ${rec.data.tie_delta}`); continue; }

        const cor = runReader(py, ent.corroboratingExtractor, pdf, mode);
        const declared = disagreementFor({ entityKey: ent.key, fiscalYear: fy, mode });

        if (cor.failed) {
          // A reader that cannot read a year corroborates nothing — it must be declared.
          if (declared) { observed.add(declared.id); console.log(`  FY${fy} ${mode}  corroborating reader could not read it — DECLARED (${declared.id})`); } else {
            problems.push(`${ent.key} FY${fy} ${mode}: corroborating reader failed and it is NOT declared — ${cor.failed}`);
          }
          continue;
        }

        compared += 1;
        const delta = cor.data.computed_total - rec.data.computed_total;
        if (delta === 0) {
          agreed += 1;
          if (declared && declared.delta === 0) observed.add(declared.id);
          continue;
        }
        if (declared && declared.delta === delta) {
          observed.add(declared.id);
          console.log(`  FY${fy} ${mode}  DECLARED DISAGREEMENT ${declared.id}: `
            + `${delta.toLocaleString()} — ${declared.why}`);
          continue;
        }
        problems.push(`${ent.key} FY${fy} ${mode}: readers disagree by ${delta.toLocaleString()} `
          + `(record ${rec.data.computed_total.toLocaleString()}, corroborating `
          + `${cor.data.computed_total.toLocaleString()})${declared ? ` — declared delta is ${declared.delta}` : ' and it is NOT declared'}`);
      }
    }
  }

  // ⚠⚠ A declared exception that names nothing excludes nothing.
  const inScope = READER_DISAGREEMENTS.filter((d) => entities.some((e) => e.key === d.entityKey));
  const unobserved = inScope.filter((d) => !observed.has(d.id));
  for (const d of unobserved) {
    problems.push(`declared disagreement ${d.id} was NOT observed — the register is stale, `
      + 'or the check that should have surfaced it is no longer running');
  }

  console.log(`\n${agreed}/${compared} entity-year-datasets agree exactly between two independent readers `
    + `(${inScope.length} declared disagreement${inScope.length === 1 ? '' : 's'}, all observed).`);

  if (compared === 0) {
    console.error('REFUSING: zero comparisons ran.');
    process.exit(1);
  }
  if (problems.length) {
    console.error(`\n  ⚠⚠ ${problems.length} PROBLEM(S):`);
    for (const p of problems) console.error(`      ${p}`);
    process.exit(1);
  }
  console.log('✅ the coordinate reader is corroborated by the character-grid reader.');
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('verifyScCityReaders.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
