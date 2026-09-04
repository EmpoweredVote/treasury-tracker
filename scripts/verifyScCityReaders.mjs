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

import {
  scCityLoadableEntities, SC_CITY_NO_TABLE_CORROBORATOR,
} from './data/scCityAcfrEntities.mjs';
import { KNOWN_DOCUMENT_GAPS, stemFor } from './extractScCitiesAll.mjs';

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
  // ── City of North Charleston ────────────────────────────────────────────
  // ⚠ Four of its eight loaded extractions are corroborated to the DOLLAR
  // (FY2021/FY2022/FY2025 revenue and FY2025 operating). These four are the
  // character grid meeting the very defects the coordinate reader was
  // configured for, and each is named rather than waved through.
  //
  // ⭐ Worth recording: on FY2021 the corroborating reader independently
  // computes `Current` = 109,369,135, the SAME figure the record reader reads.
  // The two agree on the components and part company only on what the grid
  // sweeps in around them, which is why this is a reader limit and not a doubt
  // about the money.
  {
    id: 'north-charleston-fy2021-operating-grid',
    entityKey: 'north-charleston',
    fiscalYear: 2021,
    mode: 'operating',
    /** ⚠ null: the corroborating reader does not return a total at all here —
     *  it exits on its own tie failure. A future run that DID return one would
     *  not match this entry and would be reported, which is the intent. */
    delta: null,
    recordTotal: 113143394,
    why: 'the character grid reads the split leading `1` literally (printed total '
       + '13,143,394 instead of 113,143,394) and sweeps adjacent fund columns into '
       + 'the rows, computing 135,594,802. It agrees with the record reader on '
       + '`Current` = 109,369,135.',
  },
  {
    id: 'north-charleston-fy2022-operating-grid',
    entityKey: 'north-charleston',
    fiscalYear: 2022,
    mode: 'operating',
    delta: null,
    recordTotal: 124120138,
    why: 'same defect class: the grid computes 136,115,265 against a printed '
       + '124,120,138, sweeping figures from neighbouring fund columns into the '
       + 'expenditure rows.',
  },
  {
    id: 'north-charleston-fy2024-revenue-grid',
    entityKey: 'north-charleston',
    fiscalYear: 2024,
    mode: 'revenue',
    delta: null,
    recordTotal: 162291262,
    why: 'the grid assigns NOTHING to the General Fund column on this page and '
       + 'computes 0 — the page furniture at x0 ~32 that the coordinate reader '
       + 'drops by `left_margin` shifts every -table column assignment.',
  },
  {
    id: 'north-charleston-fy2024-operating-grid',
    entityKey: 'north-charleston',
    fiscalYear: 2024,
    mode: 'operating',
    delta: null,
    recordTotal: 144062880,
    why: 'same page, same cause: the grid computes 180,433,728 against a printed '
       + '144,062,880.',
  },
  // ── City of Spartanburg ─────────────────────────────────────────────────
  // ⚠ 18 of its 20 extractions are corroborated to the DOLLAR. Both failures are
  // the SAME document: `pdftotext -table` mis-renders the FY2018 statement page
  // and mixes the two sections. This is the diagnosed reason the entity is on
  // the coordinate reader at all, so it is named rather than waved through.
  {
    id: 'spartanburg-fy2018-revenue-grid',
    entityKey: 'spartanburg',
    fiscalYear: 2018,
    mode: 'revenue',
    delta: null,
    recordTotal: 37209254,
    why: 'the character grid reads 5,975,414 MORE than the page — exactly `Policy '
       + 'Formulation and Administration`, an EXPENDITURE line, pulled into the revenue '
       + 'section. Both -table column strategies produce this same delta.',
  },
  {
    id: 'spartanburg-fy2018-operating-grid',
    entityKey: 'spartanburg',
    fiscalYear: 2018,
    mode: 'operating',
    delta: null,
    recordTotal: 36404820,
    why: 'same page: the grid finds NO printed expenditure total (`printed_total: '
       + 'null`) and computes 66,011,076 against a printed 36,404,820. The coordinate '
       + 'reader reads the same page cleanly and ties at $0.',
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
  const loadable = scCityLoadableEntities();

  // ⚠⚠ EVERY COORDINATE ENTITY MUST BE ACCOUNTED FOR — the filter below used to
  // select `.filter(e => e.corroboratingExtractor)` and nothing else, so a
  // coordinate entity that declared no corroborator was skipped IN SILENCE and
  // this gate reported success having never looked at it. That is the campaign's
  // own recurring defect (a gate that measures nothing), so it is now a hard
  // error: a coordinate entity is either corroborated by the other reader or
  // named in SC_CITY_NO_TABLE_CORROBORATOR with its diagnosis and substitute.
  const coords = loadable.filter((e) => /Coords\.py$/.test(e.extractor || ''));
  const unaccounted = coords.filter(
    (e) => !e.corroboratingExtractor && !(e.key in SC_CITY_NO_TABLE_CORROBORATOR));
  if (unaccounted.length) {
    console.error('REFUSING: these coordinate entities declare neither a '
      + 'corroborating extractor nor an exemption in SC_CITY_NO_TABLE_CORROBORATOR: '
      + `${unaccounted.map((e) => e.key).join(', ')}.`);
    process.exit(1);
  }

  // ⚠ And a declared exemption that is NOT needed fails too, exactly as a
  // declared-but-unobserved READER_DISAGREEMENT does — otherwise dead permission
  // accumulates and a later entity inherits it by name.
  const needless = Object.keys(SC_CITY_NO_TABLE_CORROBORATOR).filter((key) => {
    const e = loadable.find((x) => x.key === key);
    return e && e.corroboratingExtractor;
  });
  if (needless.length) {
    console.error('REFUSING: these entities are exempted from -table corroboration '
      + `but DO declare a corroborating extractor: ${needless.join(', ')}. `
      + 'Remove the exemption or the extractor.');
    process.exit(1);
  }
  for (const [key, ex] of Object.entries(SC_CITY_NO_TABLE_CORROBORATOR)) {
    console.log(`${key} — NO -table corroborator, by diagnosis. Substitute: ${ex.substitute.split('—')[0].trim()}`);
    console.log(`  result: ${ex.substituteResult}`);
  }

  const entities = loadable
    .filter((e) => e.corroboratingExtractor)
    .filter((e) => !values.entity || e.key === values.entity);

  if (!entities.length && !values.entity) {
    console.error('REFUSING: no entity declares a corroborating extractor. '
      + 'A check that measures nothing must fail.');
    process.exit(1);
  }

  const py = pythonBin();
  const problems = [];
  const observed = new Set();
  const skipped = [];
  let compared = 0;
  let agreed = 0;

  for (const ent of entities) {
    console.log(`\n${ent.name} — ${ent.extractor} (record) vs ${ent.corroboratingExtractor} (corroborating)`);
    for (const fy of Object.keys(ent.facReports).map(Number).sort((a, b) => a - b)) {
      // ⚠ A year whose DOCUMENT is already declared unreadable has nothing to
      // corroborate — the record reader cannot read it either, and that is
      // stated, with its cause and its second publisher, in KNOWN_DOCUMENT_GAPS.
      // Re-declaring it here would be the same fact in two registries, and the
      // one that rots is the one nobody reads.
      const gap = KNOWN_DOCUMENT_GAPS[stemFor(ent.key, fy)];
      if (gap) { skipped.push(`${ent.key} FY${fy}: ${gap.slice(0, 60)}...`); continue; }

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

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} entity-year(s) whose document is declared unreadable:`);
    for (const k of skipped) console.log(`  ${k}`);
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
