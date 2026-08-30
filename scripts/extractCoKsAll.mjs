/**
 * Run every Colorado + Kansas ACFR extraction for Knight session 7b and cache
 * the result as JSON, one file per entity-year-mode.
 *
 * NO SHEBANG — tests import `EXTRACTORS`.
 *
 * Usage:
 *   node scripts/extractCoKsAll.mjs --in _acfr-work/coks --out _acfr-work/coks/extracted
 *   node scripts/extractCoKsAll.mjs --entity wichita
 *
 * ⚠ EVERY EXTRACTION IS A TIE GATE. `acfrGF.py` exits non-zero when the
 * computed component sum does not equal the issuer's own printed total, so a
 * mis-parse cannot reach the loader. Failures are collected and REPORTED — a
 * year that will not parse is a documented gap, never a silently missing row
 * and never a $0.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { CO_KS_WINDOWS } from './data/coKsAcfrSources.mjs';

/** ⚠ One extractor per entity — the four documents disagree on structure, on
 * units, on the name of the debt parent and on whether "revenue" is plural. */
export const EXTRACTORS = Object.freeze({
  'boulder': 'scripts/extractBoulderCO.py',
  'boulder-county': 'scripts/extractBoulderCountyCO.py',
  'wichita': 'scripts/extractWichitaKS.py',
  'sedgwick-county': 'scripts/extractSedgwickCountyKS.py',
});

/**
 * ⚠ Years whose DOCUMENT cannot be parsed, with the reason. Declared so the
 * absence is a recorded decision rather than a silent hole in a series.
 */
export const KNOWN_DOCUMENT_GAPS = Object.freeze({
  'wichita-2001': 'image-only scan (30 chars/page, producer "eCopy, Inc."); '
    + 'neighbours FY2000 and FY2002 are born-digital',
  'wichita-2008': 'image-only scan (20 chars/page); neighbours FY2007 and FY2009 '
    + 'are born-digital',
  'sedgwick-county-2005': "HTTP 404 — the county's own listing links "
    + '/media/28020/2005_cafr.pdf and that URL is dead',
  // ⚠⚠ A THIRD DEFECT CLASS, and not a scan. The FY2019 document is
  // born-digital (1,270 chars/page) but its governmental-funds statement is set
  // in a font subset with a custom encoding and NO ToUnicode map, so pdftotext
  // emits a uniform -29 byte shift: `6('*:,&. &2817< .$16$6` is
  // "SEDGWICK COUNTY, KANSAS", `3URSHUW\ WD[HV` is "Property taxes",
  // `H[SHQGLWXUHV` is "expenditures".
  //
  // The shift is uniform and therefore trivially reversible — which is exactly
  // the trap. THE NUMBERS DO NOT SURVIVE AT ALL: every data column on that page
  // extracts EMPTY, so there is nothing to decode. Recovering the labels would
  // produce a perfectly readable statement with no money in it.
  //
  // ⚠ The same document also emits 411 form-feed chunks across 175 real pages,
  // fragmenting the statement so that no single chunk carries all of the
  // library's page-qualifying markers. Either fault alone would have blocked it.
  //
  // ⭐ RECOVERY ROUTE, NOT YET TAKEN: FAC lists a `SEDGWICK COUNTY` filing for
  // audit year 2019, so its report_id would very likely serve a clean copy the
  // way it did for all seven City of Boulder years. Blocked here only by the
  // DEMO_KEY rate limit; a real FAC API key would close this gap.
  'sedgwick-county-2019': 'statement page has a custom font encoding (uniform '
    + '-29 shift) AND no numbers survive extraction; 411 form-feed chunks over '
    + '175 pages. FAC has an audit-year-2019 filing — a likely recovery route.',
});

const PYTHON = process.env.TT_PYTHON
  || `${process.env.LOCALAPPDATA}\\Python\\pythoncore-3.14-64\\python.exe`;

export function extractOne(pythonPath, script, pdf, mode) {
  const out = execFileSync(pythonPath, [script, pdf, '--mode', mode], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

export async function main() {
  const { values } = parseArgs({
    options: {
      in: { type: 'string', default: '_acfr-work/coks' },
      out: { type: 'string', default: '_acfr-work/coks/extracted' },
      entity: { type: 'string' },
    },
  });
  mkdirSync(values.out, { recursive: true });

  const entities = values.entity ? [values.entity] : Object.keys(CO_KS_WINDOWS);
  let ok = 0;
  const failures = [];
  const gaps = [];

  for (const key of entities) {
    for (const fy of CO_KS_WINDOWS[key]) {
      const stem = `${key}-${fy}`;
      if (KNOWN_DOCUMENT_GAPS[stem]) { gaps.push(`${stem}: ${KNOWN_DOCUMENT_GAPS[stem]}`); continue; }
      const pdf = join(values.in, `${stem}.pdf`);
      if (!existsSync(pdf)) { failures.push(`${stem}: PDF not fetched`); continue; }
      for (const mode of ['revenue', 'operating']) {
        try {
          const data = extractOne(PYTHON, EXTRACTORS[key], pdf, mode);
          // ⚠ Belt and braces: the extractor already exits non-zero on a
          // non-zero tie, but a future change to that contract must not turn
          // into a silently loaded mis-parse.
          if (data.tie_delta !== 0) throw new Error(`tie_delta ${data.tie_delta}`);
          if (!data.tree || !Array.isArray(data.tree.c) || data.tree.c.length === 0) {
            throw new Error('empty tree');
          }
          writeFileSync(join(values.out, `${stem}-${mode}.json`), JSON.stringify(data));
          ok += 1;
          console.log(`  ${stem} ${mode.padEnd(9)} ${String(data.tree.a).padStart(14)}  page ${data.statement_page}`);
        } catch (err) {
          const msg = String(err.stderr || err.message).trim().split('\n').slice(-2).join(' | ');
          failures.push(`${stem} ${mode}: ${msg.slice(0, 180)}`);
          console.log(`  FAILED ${stem} ${mode}`);
        }
      }
    }
  }

  console.log(`\nExtracted ${ok} trees.`);
  if (gaps.length) {
    console.log(`\nDECLARED DOCUMENT GAPS (${gaps.length}) — reported, never written as $0:`);
    for (const g of gaps) console.log(`  - ${g}`);
  }
  if (failures.length) {
    console.log(`\nFAILURES (${failures.length}):`);
    for (const f of failures) console.log(`  ! ${f}`);
  }
  if (ok === 0) {
    console.error('REFUSING: nothing extracted. A gate that measured nothing must fail.');
    process.exit(1);
  }
  return { ok, failures, gaps };
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('extractCoKsAll.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
