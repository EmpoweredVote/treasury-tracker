#!/usr/bin/env node
/**
 * Reconcile TT's OSC-derived school-district General Fund figures against the
 * districts' OWN AUDITED ACFRs, fetched from the Federal Audit Clearinghouse.
 *
 * This is spec §11.1 — `docs/superpowers/specs/2026-10-11-ny-school-districts-design.md`.
 * Findings: `docs/superpowers/plans/NY-SCHOOLS-FAC-RECON.md`.
 *
 * ⭐ THE RULE IT TESTS, which is a DEFINITIONAL difference, not an error:
 *
 *     OSC revenue      ==  ACFR `Total revenues`     + other financing SOURCES
 *     OSC expenditure  ==  ACFR `Total expenditures` + other financing USES
 *
 * OSC's AFR folds other financing sources and uses INTO revenue and
 * expenditure; the ACFR reports them below the line. Comparing the two
 * `Total revenues` figures directly makes a faithful filing look wrong by the
 * size of its transfers — for Rochester FY2021, by $86.3m on the spending side.
 *
 * ⚠ A YEAR WHOSE ACFR NETS ITS TRANSFERS CANNOT BE RECONCILED AT ALL, and is
 * reported as NOT RECONCILABLE rather than as a mismatch. Buffalo prints
 * "Operating transfers, net" from FY2020, so the gross inflow — the very
 * quantity the rule needs — is absent from the document. That is a limit of the
 * ACFR's presentation, not evidence against OSC.
 *
 * ⚠ FAC STARTS AT AUDIT YEAR 2016. Nineteen of the thirty-one loaded years
 * (FY1995–FY2015) have no audit route; they are printed as such and never
 * counted as checked.
 *
 *   node scripts/reconcileNyOscSchoolsFac.mjs --fetch   # download the ACFRs
 *   node scripts/reconcileNyOscSchoolsFac.mjs           # reconcile
 *   node scripts/reconcileNyOscSchoolsFac.mjs --district 260548000000
 */
import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { join } from 'node:path';

import { SCHOOL_ARCHIVE_PATH, readYear, aggregateCityYear } from './lib/nyOsc.mjs';
import { NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES } from './data/nyOscSchoolFundPrefixes.mjs';
import { NY_SCHOOL_FAC_DISTRICTS, FAC_PDF_BASE } from './data/nyOscSchoolFacReports.mjs';
import { resolvePython } from './lib/pythonBin.mjs';

const SCHOOL = { registry: NY_SCHOOL_FUND_PREFIXES, governmentalTypes: SCHOOL_GOVERNMENTAL_TYPES };
const READER = 'scripts/lib/nySchoolAcfrGF.py';
// ⚠ gitignored: these are large third-party PDFs, never committed.
const PDF_ROOT = 'cache/fac-pdfs';
const CENTS = 0.5;

const { values } = parseArgs({
  options: {
    fetch: { type: 'boolean', default: false },
    district: { type: 'string' },
  },
});

const districts = values.district
  ? NY_SCHOOL_FAC_DISTRICTS.filter((d) => d.municipalCode === values.district)
  : NY_SCHOOL_FAC_DISTRICTS;
if (!districts.length) throw new Error(`no district with municipalCode ${values.district}`);

const dirFor = (d) => join(PDF_ROOT, d.auditeeEin);

if (values.fetch) {
  for (const d of districts) {
    mkdirSync(dirFor(d), { recursive: true });
    for (const [fy, reportId] of Object.entries(d.reports)) {
      const out = join(dirFor(d), `fy${fy}.pdf`);
      if (existsSync(out) && statSync(out).size > 0) { console.log(`  have   FY${fy}`); continue; }
      const res = await fetch(`${FAC_PDF_BASE}/${reportId}`);
      if (!res.ok) { console.log(`  ✗ FY${fy} ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      // ⚠ Prove it by its bytes. A portal that serves an HTML error with a 200
      // is the shape this project keeps meeting.
      if (buf.subarray(0, 5).toString() !== '%PDF-') {
        console.log(`  ✗ FY${fy} not a PDF (${buf.length} bytes)`); continue;
      }
      writeFileSync(out, buf);
      console.log(`  ✓ FY${fy} ${buf.length.toLocaleString()} bytes`);
    }
  }
  console.log('\nfetched. Re-run without --fetch to reconcile.');
  process.exit(0);
}

const py = resolvePython();
const readAcfr = (pdf) => {
  // ⚠ stderr is DISCARDED on purpose: pdfplumber emits font and trailer
  // warnings for several of these documents (Buffalo's whole GSAFAC era warns
  // "maximum recursion depth exceeded" on the PDF trailer) and they would
  // otherwise interleave with the table. The reader's own `ofs_check` is what
  // decides whether a read is trustworthy, not the absence of a warning.
  const out = execFileSync(py, ['-I', READER, pdf], {
    encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out);
};

const money = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 }));

let tied = 0, refused = 0, netted = 0, differs = 0, total = 0;

for (const d of districts) {
  console.log(`\n=== ${d.auditeeName} — EIN ${d.auditeeEin}, OSC code ${d.municipalCode} ===`);
  const dir = dirFor(d);
  const years = Object.keys(d.reports).map(Number).sort();

  // TT's own figures, re-derived from the archive with the SAME library the
  // loader used — not read back from the database, so this is reproducible
  // without credentials.
  const tt = {};
  for (const fy of years) {
    const rows = readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict')
      .filter((r) => r.municipalCode === d.municipalCode);
    if (!rows.length) continue;
    const g = (section) => {
      const a = aggregateCityYear(rows, { section, scope: 'general_fund', ...SCHOOL });
      return a.scope === 'unknown' ? null : a.total;
    };
    tt[fy] = { revenue: g('REVENUE'), expenditure: g('EXPENDITURE') };
  }

  console.log(`${'FY'.padEnd(5)}${'ACFR revenues'.padStart(16)}${'+ sources'.padStart(13)}`
    + `${'= expected'.padStart(16)}${'OSC / TT'.padStart(16)}${'Δ'.padStart(9)}  verdict`);
  for (const fy of years) {
    const pdf = join(dir, `fy${fy}.pdf`);
    if (!existsSync(pdf)) { console.log(`${String(fy).padEnd(5)}  (no pdf — run --fetch)`); continue; }
    const a = readAcfr(pdf);
    total += 1;
    if (a.error || a.revenues === undefined) {
      refused += 1;
      console.log(`${String(fy).padEnd(5)}  REFUSED — ${a.error || 'totals unreadable'}`);
      continue;
    }
    if (a.ofs_check !== undefined && Math.abs(a.ofs_check) > CENTS) {
      refused += 1;
      console.log(`${String(fy).padEnd(5)}  REFUSED — other-financing components do not rebuild the printed net (${a.ofs_check})`);
      continue;
    }
    if (a.transfers_netted) {
      netted += 1;
      console.log(`${String(fy).padEnd(5)}${money(a.revenues).padStart(16)}${'netted'.padStart(13)}`
        + `${'—'.padStart(16)}${money(tt[fy]?.revenue).padStart(16)}${'—'.padStart(9)}  NOT RECONCILABLE (ACFR nets its transfers)`);
      continue;
    }
    const expected = a.revenues + a.ofs_sources;
    const delta = expected - tt[fy].revenue;
    const ok = Math.abs(delta) < CENTS;
    if (ok) tied += 1; else differs += 1;
    console.log(`${String(fy).padEnd(5)}${money(a.revenues).padStart(16)}${money(a.ofs_sources).padStart(13)}`
      + `${money(expected).padStart(16)}${money(tt[fy].revenue).padStart(16)}${money(delta).padStart(9)}`
      + `  ${ok ? 'TIES to the dollar' : 'differs'}`);
  }
}

console.log(`\n${tied} tied to the dollar · ${differs} differ · ${netted} not reconcilable `
  + `(ACFR nets transfers) · ${refused} refused · ${total} documents read`);
console.log('⚠ FY1995–FY2015 have NO audit route: FAC begins at audit year 2016.');
