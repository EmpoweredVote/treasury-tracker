/**
 * Batch-extract the Indiana county TOTAL GOVERNMENTAL FUNDS series (wave 1).
 *
 * NO SHEBANG — tests import `KNOWN_DOCUMENT_GAPS`, `stemFor` and `loadableYearsFor`.
 *
 * Usage:
 *   node scripts/extractInCountiesAll.mjs
 *   node scripts/extractInCountiesAll.mjs --entity hamilton --fy 2024
 *   node scripts/extractInCountiesAll.mjs --out _acfr-work/in-counties/extracted
 *
 * Runs each county's thin `acfrGF.py` wrapper over each fetched document and
 * writes `<key>-<fy>-<mode>.json`. Refuses to write anything whose `tie_delta`
 * is not 0.
 *
 * ── ⚠⚠ THE TIE PROVES THE READ, NEVER THE SHAPE ────────────────────────────
 *
 * Every extraction here ties at $0, and that is necessary, not sufficient. The
 * structures were determined by reading each issuer's own printed statement page
 * and adding the leaves up by hand. ELEVEN documented failure modes produce a
 * WRONG TREE THAT TIES AT $0, and wave 1 walked into two of them:
 *
 *   • Marion prints `Capital outlay` as a ROOT LEAF; Allen and Hamilton print
 *     `Capital outlay:` as a PARENT with five children; Lake prints no
 *     `Current:` heading at all. Copying one county's `parents` onto its
 *     neighbour reparents whole branches and still ties to the cent.
 *   • Hamilton prints the label `Other:` TWICE ON ONE PAGE at two different
 *     levels. Read without `revenue_subparents` it produced ten revenue roots
 *     where the page prints seven — at a tie of exactly $0.
 *
 * ── THREE KINDS OF ABSENCE, NONE OF THEM $0 ────────────────────────────────
 *
 *   COVERAGE GAP   no filing at FAC for that county-year (the $750k Single
 *                  Audit threshold, not a publishing decision)
 *   BASIS GAP      a filing exists and is audited, but it is an SBOA
 *                  REGULATORY-BASIS report with no governmental-funds statement
 *                  in it. 459 of Indiana's 562 county filings are these.
 *   DOCUMENT GAP   the filing exists and is GAAP but cannot be read
 *
 * Wave 1 has coverage gaps (Lake FY2019/FY2025, Allen FY2025), six basis gaps
 * (all Lake) and NO document gaps.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  IN_COUNTY_BASIS_GAPS, IN_COUNTY_COVERAGE_GAPS, IN_COUNTY_DEFERRED,
  inCountyLoadableEntities, inCountyYearsFor,
} from './data/inCountyAcfrEntities.mjs';
import { resolvePython } from './lib/pythonBin.mjs';

const ROOT = process.cwd();
export const PDF_BASE = path.join(ROOT, '_acfr-work', 'in-counties', 'acfr');
export const DEFAULT_OUT = path.join(ROOT, '_acfr-work', 'in-counties', 'extracted');
export const MODES = ['revenue', 'operating'];

/**
 * Documents that exist, are GAAP, and still cannot be read, with the CAUSE.
 *
 * ⚠ EMPTY through waves 1 and 2 — all 55 loadable documents read and tied. Kept
 * because a gap must be DECLARED with its cause rather than skipped, and because
 * an empty map is a measured statement rather than an absent one.
 *
 * ⚠⚠⚠ WAVE 3 OPENED IT. Porter County FY2022 is the family's FIRST document gap
 * — and the how-to's own instruction ("check other publishers before declaring a
 * year lost, and check more than one") was followed to the end before declaring
 * it. THREE publishers, THREE distinct files, all unreadable in the same place.
 */
export const KNOWN_DOCUMENT_GAPS = Object.freeze({
  'porter-2022': 'IMAGE-ONLY STATEMENTS. The FAC copy (2022-12-GSAFAC-0000037032, 22.9 MB, '
    + '223 pages) carries a text layer on only 20 of its pages — the auditor\'s report and the '
    + 'single-audit schedules at the back — and `Total revenues` appears NOWHERE in it. '
    + '`scripts/tools/acfrDocQuality.py` scores it 174 chars/page against 1,649-2,344 for '
    + 'Porter\'s five other years, and 3 numeric statement pages against 95-158. '
    + '⚠⚠ THREE PUBLISHERS WERE CHECKED AND ALL THREE ARE DAMAGED, WHICH IS WHAT MAKES THIS A '
    + 'DOCUMENT GAP RATHER THAN A BAD COPY: the Indiana State Board of Accounts copy '
    + '(in.gov/sboa/WebReports/85053A.pdf, 24.8 MB, 226 pages) scores 182 chars/page, and '
    + 'Porter County\'s OWN copy (portercountyin.gov DocumentCenter/View/24007, 68.0 MB, 206 '
    + 'pages) scores 1 char/page and was produced by a TOSHIBA e-STUDIO4528A — the county '
    + 'printed its audited report and scanned it back in. Three different sha256s, one damaged '
    + 'document. '
    + '⭐ NOTE WHAT THIS BREAKS: the auditor\'s report IS born-digital in the FAC copy, so an '
    + 'opinion gate reads this document perfectly while there is nothing whatever to extract. '
    + 'A grading pass is not an extraction pass. '
    + 'Porter therefore loads FIVE years, not six. Never interpolated, never a $0.',
});

export function stemFor(entityKey, fiscalYear) {
  return `${entityKey}-${fiscalYear}`;
}

/**
 * The fiscal years of one entity this route can actually load: FAC filings,
 * minus the ones whose filing is not GAAP.
 *
 * ⚠⚠ ONE FUNCTION, USED BY THE FETCHER'S REPORT, THE EXTRACTOR AND THE LOADER.
 * SC wave 5's lesson: FOUR call sites iterated the filing list directly, and
 * three of them silently skipped a year the fourth had fetched and
 * quality-checked. The COUNT was the only signal it had happened.
 */
export function loadableYearsFor(entity) {
  const basis = IN_COUNTY_BASIS_GAPS[entity.key] || {};
  return inCountyYearsFor(entity).filter((fy) => !basis[fy]);
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
    ? inCountyLoadableEntities().filter((e) => e.key === values.entity)
    : inCountyLoadableEntities();
  if (!entities.length) throw new Error(`No loadable entity matched ${values.entity}`);

  mkdirSync(values.out, { recursive: true });
  // ⚠ Never hard-code the interpreter path — `resolvePython` PROBES for one that
  // actually runs Python rather than trusting a name on PATH.
  const py = resolvePython();

  let written = 0;
  const failures = [];
  const gaps = [];

  for (const ent of entities) {
    if (!ent.extractor) throw new Error(`${ent.key} has no extractor declared`);
    const years = loadableYearsFor(ent);
    console.log(`\n${ent.name} — ${years.length} loadable document(s)`);

    for (const fy of years) {
      if (values.fy && Number(values.fy) !== fy) continue;
      const stem = stemFor(ent.key, fy);
      if (KNOWN_DOCUMENT_GAPS[stem]) { gaps.push(`${stem}: ${KNOWN_DOCUMENT_GAPS[stem]}`); continue; }

      // ⚠⚠ A MISSING FILE IS A FAILURE, NOT A GAP. The three gap maps say what
      // is absent and WHY; a year that reaches here has no declared reason to be
      // absent, so "not fetched" means the fetch did not run — and reporting it
      // beside the declared gaps would make an incomplete run read like a
      // complete one with known holes. The count is otherwise the only signal.
      const pdf = path.join(PDF_BASE, ent.key, `${ent.key}_${fy}.pdf`);
      if (!existsSync(pdf)) {
        failures.push(`${stem}: PDF not fetched — run \`node scripts/fetchInCountyAcfrs.mjs `
          + `--entity ${ent.key}\`. This year has no declared coverage, basis or document `
          + 'gap, so its absence is unexplained.');
        continue;
      }

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
        //
        // ⚠⚠ ONE EXCEPTION, AND IT IS NOT A TOLERANCE: a delta the wrapper's own
        // `source_rounding` registry DECLARED for this exact (fiscal_year, mode)
        // and the library confirmed. Porter FY2020 is the family's first — the
        // county's General Fund column is a dollar short of its own printed
        // total and the Total Governmental column carries it. A different delta
        // in the same year, or an undeclared one, still fails here.
        if (data.tie_delta !== 0
            && !(data.source_rounding_accepted !== null
                 && data.source_rounding_accepted === data.tie_delta)) {
          failures.push(`${stem} ${mode}: tie_delta ${data.tie_delta}`);
          continue;
        }
        if (Number(data.fiscal_year) !== fy) {
          failures.push(`${stem} ${mode}: document reports FY${data.fiscal_year}, expected FY${fy}`);
          continue;
        }
        // ⚠⚠ THE ROOT LABEL MUST NAME THE SCOPE THAT WAS READ. `scope_label()`
        // derives it from `target_column`, so this catches a wrapper that lost
        // `target_column='last'` — which would silently return the GENERAL FUND
        // under a total-governmental label, at a $0 tie. Failure mode 11.
        if (!String(data.tree?.n || '').startsWith('Total Governmental Funds')) {
          failures.push(`${stem} ${mode}: tree root is "${data.tree?.n}", not a Total `
            + 'Governmental Funds scope — the wrapper is not reading the column this '
            + 'family loads');
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
    console.log('\nDECLARED DOCUMENT GAPS — never written as $0:');
    for (const g of gaps) console.log(`  ${g}`);
  }
  for (const [key, years] of Object.entries(IN_COUNTY_BASIS_GAPS)) {
    for (const [fy, why] of Object.entries(years)) {
      console.log(`  BASIS GAP ${key} FY${fy}: ${why}`);
    }
  }
  for (const [key, years] of Object.entries(IN_COUNTY_COVERAGE_GAPS)) {
    for (const [fy, why] of Object.entries(years)) {
      console.log(`  COVERAGE GAP ${key} FY${fy}: ${why}`);
    }
  }
  for (const [key, d] of Object.entries(IN_COUNTY_DEFERRED)) {
    console.log(`\nDEFERRED ENTITY — ${key}: ${d.reason}`);
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

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('extractInCountiesAll.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
