#!/usr/bin/env node
/**
 * Reconcile TT's OSC-derived NY COUNTY General Fund figures against the
 * counties' OWN AUDITED ACFRs, fetched from the Federal Audit Clearinghouse.
 *
 * This is §11.1 of
 * `docs/superpowers/specs/2026-10-19-ny-towns-villages-counties-design.md`,
 * and the county analogue of #272's school-district reconciliation.
 * Findings: `docs/superpowers/plans/NY-COUNTIES-FAC-RECON.md`.
 *
 * ⭐ THE RULE IT TESTS — a DEFINITIONAL difference, not an error:
 *
 *     OSC revenue      ==  ACFR `Total revenues`     + other financing SOURCES
 *     OSC expenditure  ==  ACFR `Total expenditures` + other financing USES
 *
 * OSC's AFR folds other financing sources and uses INTO revenue and
 * expenditure; the ACFR reports them below the line. Comparing the two
 * `Total revenues` lines directly makes a faithful filing look wrong by the
 * size of its transfers.
 *
 * ⭐⭐ WHY THIS EXISTS AT ALL. OSC publishes LINE ITEMS ONLY — there is no
 * total row anywhere in the source — so TT's totals are `Σ items` BY
 * CONSTRUCTION and "total = sum of items" proves nothing. The load's own
 * verifier establishes that TT read OSC faithfully. ONLY this establishes
 * whether OSC is RIGHT.
 *
 * ⚠⚠ THE READER IS THE DISTRICTS' READER, UNCHANGED. `nySchoolAcfrGF.py`
 * anchors the General Fund column on a TOTAL row rather than on a layout, so
 * it reads a county's governmental-funds statement without modification —
 * tested before a line of this script was written. Its 33 selftests therefore
 * still cover this path, and its `ofs_check` (do the other-financing
 * components rebuild the printed net?) is what decides whether a read is
 * trustworthy, not the absence of a warning.
 *
 * ⚠ FAC BEGINS AT AUDIT YEAR 2016, and a county only appears in a year it
 * expended $750k of federal awards. TT loads FY1995-FY2025, so TWENTY-ONE of
 * the thirty-one loaded years have no audit route and are never counted as
 * checked.
 *
 *   node scripts/reconcileNyOscCountiesFac.mjs --fetch   # download the ACFRs
 *   node scripts/reconcileNyOscCountiesFac.mjs           # reconcile
 *   node scripts/reconcileNyOscCountiesFac.mjs --county 010100000000
 */
import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { join } from 'node:path';

import { readYear, aggregateCityYear, archiveFor } from './lib/nyOsc.mjs';
import {
  NY_MUNICIPAL_FUND_PREFIXES, MUNICIPAL_GOVERNMENTAL_TYPES,
} from './data/nyOscMunicipalFundPrefixes.mjs';
import { NY_COUNTY_FAC_REPORTS, FAC_PDF_BASE } from './data/nyOscCountyFacReports.mjs';
import { resolvePython } from './lib/pythonBin.mjs';

const REG = {
  registry: NY_MUNICIPAL_FUND_PREFIXES,
  governmentalTypes: MUNICIPAL_GOVERNMENTAL_TYPES,
};
const ARCHIVE = archiveFor('County').path;
const READER = 'scripts/lib/nySchoolAcfrGF.py';
// ⚠ gitignored: these are large third-party PDFs, never committed.
const PDF_ROOT = 'cache/fac-pdfs';
const CENTS = 0.5;

const { values } = parseArgs({
  options: {
    fetch: { type: 'boolean', default: false },
    county: { type: 'string' },
  },
});

const counties = values.county
  ? NY_COUNTY_FAC_REPORTS.filter((c) => c.municipalCode === values.county)
  : NY_COUNTY_FAC_REPORTS;
if (!counties.length) throw new Error(`no county with municipalCode ${values.county}`);

const dirFor = (c) => join(PDF_ROOT, c.auditeeEin);

if (values.fetch) {
  for (const c of counties) {
    console.log(`\n${c.displayName} County — EIN ${c.auditeeEin}`);
    mkdirSync(dirFor(c), { recursive: true });
    for (const [fy, reportId] of Object.entries(c.reports)) {
      const out = join(dirFor(c), `fy${fy}.pdf`);
      if (existsSync(out) && statSync(out).size > 0) { console.log(`  have   FY${fy}`); continue; }
      const res = await fetch(`${FAC_PDF_BASE}/${reportId}`);
      if (!res.ok) { console.log(`  ✗ FY${fy} ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      // ⚠ Prove it by its bytes. A portal that serves an HTML error page with a
      // 200 is the shape this project keeps meeting.
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
  // warnings for several of these documents and they would otherwise
  // interleave with the JSON. `ofs_check` decides trustworthiness, not silence.
  const out = execFileSync(py, ['-I', READER, pdf], {
    encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out);
};

const money = (n) => (n === null || n === undefined
  ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 }));

const tally = { tied: 0, close: 0, differs: 0, netted: 0, refused: 0, total: 0 };
const deltas = [];

for (const c of counties) {
  console.log(`\n=== ${c.displayName} County — EIN ${c.auditeeEin}, OSC code ${c.municipalCode} ===`);
  const dir = dirFor(c);
  const years = Object.keys(c.reports).map(Number).sort((a, b) => a - b);

  // TT's own figures, re-derived from the archive with the SAME library the
  // loader used — not read back from the database, so this runs with no
  // credential and is reproducible by anyone holding the zip.
  const tt = {};
  for (const fy of years) {
    const rows = readYear(ARCHIVE, fy, 'County').filter((r) => r.municipalCode === c.municipalCode);
    if (!rows.length) continue;
    const g = (section) => {
      const a = aggregateCityYear(rows, { section, scope: 'general_fund', ...REG });
      return a.scope === 'unknown' ? null : a.total;
    };
    tt[fy] = { revenue: g('REVENUE'), expenditure: g('EXPENDITURE') };
  }

  const head = (what) => console.log(`\n  ${what}\n  ${'FY'.padEnd(5)}`
    + `${'ACFR total'.padStart(16)}${'+ other fin.'.padStart(14)}${'= expected'.padStart(16)}`
    + `${'OSC / TT'.padStart(16)}${'Δ'.padStart(11)}  verdict`);

  for (const side of ['revenue', 'expenditure']) {
    head(side === 'revenue' ? 'REVENUE  (ACFR total revenues + other financing SOURCES)'
      : 'EXPENDITURE  (ACFR total expenditures + other financing USES)');
    for (const fy of years) {
      const pdf = join(dir, `fy${fy}.pdf`);
      if (!existsSync(pdf)) { console.log(`  ${String(fy).padEnd(5)}  (no pdf — run --fetch)`); continue; }
      const a = readAcfr(pdf);
      if (side === 'revenue') tally.total += 1;

      if (a.error || a.revenues === undefined) {
        if (side === 'revenue') tally.refused += 1;
        console.log(`  ${String(fy).padEnd(5)}  REFUSED — ${a.error || 'totals unreadable'}`);
        continue;
      }
      // ⚠ The components must rebuild the printed net, or the read is not
      // trusted at all — a partially-read other-financing block would make a
      // faithful filing look wrong.
      if (a.ofs_check !== undefined && Math.abs(a.ofs_check) > CENTS) {
        if (side === 'revenue') tally.refused += 1;
        console.log(`  ${String(fy).padEnd(5)}  REFUSED — other-financing components do not `
          + `rebuild the printed net (${a.ofs_check})`);
        continue;
      }
      // ⚠ A NETTED statement cannot be reconciled AT ALL, and that is not a
      // mismatch: the rule needs the GROSS inflow, which the document does not
      // contain. Buffalo's district hit this from FY2020 in #272.
      if (a.transfers_netted) {
        if (side === 'revenue') tally.netted += 1;
        console.log(`  ${String(fy).padEnd(5)}${money(a.revenues).padStart(16)}`
          + `${'netted'.padStart(14)}${'—'.padStart(16)}`
          + `${money(tt[fy]?.[side]).padStart(16)}${'—'.padStart(11)}`
          + '  NOT RECONCILABLE (ACFR nets its transfers)');
        continue;
      }

      const acfrTotal = side === 'revenue' ? a.revenues : a.expenditures;
      // ⚠ `ofs_uses` is printed NEGATIVE in the statement; OSC folds the
      // magnitude into expenditure, so the sign is removed here rather than in
      // the reader, which reports what the document says.
      const otherFin = side === 'revenue' ? a.ofs_sources : Math.abs(a.ofs_uses);
      const ours = tt[fy]?.[side];
      if (ours === null || ours === undefined) {
        console.log(`  ${String(fy).padEnd(5)}  (TT has no comparable figure)`);
        continue;
      }
      const expected = acfrTotal + otherFin;
      const delta = expected - ours;
      deltas.push({ county: c.displayName, fy, side, delta, expected, ours });

      let verdict;
      if (Math.abs(delta) < CENTS) { verdict = 'TIES to the dollar'; if (side === 'revenue') tally.tied += 1; }
      else if (Math.abs(delta) / Math.max(1, Math.abs(expected)) < 1e-6) {
        verdict = 'ties within rounding'; if (side === 'revenue') tally.close += 1;
      } else { verdict = 'DIFFERS'; if (side === 'revenue') tally.differs += 1; }

      console.log(`  ${String(fy).padEnd(5)}${money(acfrTotal).padStart(16)}${money(otherFin).padStart(14)}`
        + `${money(expected).padStart(16)}${money(ours).padStart(16)}${money(delta).padStart(11)}`
        + `  ${verdict}`);
    }
  }
}

// ── Summary, counted per SIDE rather than per document ──────────────────────
const bySide = {};
for (const d of deltas) {
  const k = d.side;
  bySide[k] ??= { n: 0, tied: 0, close: 0, worst: 0, worstAt: null };
  bySide[k].n += 1;
  if (Math.abs(d.delta) < CENTS) bySide[k].tied += 1;
  // ⚠ "within rounding" is a RELATIVE test, because these figures span
  // $40m to $830m and a fixed dollar threshold would mean something different
  // at each end. 1e-6 is one part per million.
  else if (Math.abs(d.delta) / Math.max(1, Math.abs(d.expected)) < 1e-6) bySide[k].close += 1;
  if (Math.abs(d.delta) > Math.abs(bySide[k].worst)) {
    bySide[k].worst = d.delta;
    bySide[k].worstAt = `${d.county} FY${d.fy}`;
  }
}
console.log('\n── summary ──');
for (const [side, s] of Object.entries(bySide)) {
  console.log(`  ${side.padEnd(12)} ${s.tied}/${s.n} tie to the dollar, `
    + `${s.tied + s.close}/${s.n} within one part per million; `
    + `largest residual ${money(s.worst)} (${s.worstAt})`);
}

/**
 * ⭐⭐ THE CHECK THAT TURNED A PILE OF RESIDUALS INTO A FINDING.
 *
 * Where a county-year does NOT tie, the revenue residual and the expenditure
 * residual are very often THE SAME NUMBER — Tompkins FY2019 is +6,284,003 and
 * +6,284,001, Orange FY2016 is -102,004 and -102,004. That is not a
 * coincidence and it is not two independent errors.
 *
 *     (ACFR_rev + sources) - OSC_rev  ==  (ACFR_exp + uses) - OSC_exp
 *
 * rearranges to
 *
 *     (ACFR_rev - ACFR_exp) + (sources - uses)  ==  OSC_rev - OSC_exp
 *
 * — the two publishers agree on the NET CHANGE IN FUND BALANCE while
 * disagreeing on the GROSS revenue and expenditure by one shared amount. That
 * is the signature of a presentation difference (an item one source reports
 * gross and the other nets, or an intra-fund flow one eliminates), NOT of a
 * figure being wrong.
 *
 * ⚠ It is reported, never used to excuse a residual. A year where the two
 * residuals AGREE is corroborated on its bottom line and unexplained on its
 * gross; a year where they DISAGREE is not corroborated at all.
 */
const byYear = new Map();
for (const d of deltas) {
  const k = `${d.county}|${d.fy}`;
  byYear.set(k, { ...(byYear.get(k) ?? {}), [d.side]: d.delta });
}
let netAgree = 0;
let netDiffer = 0;
const netOffenders = [];
for (const [k, v] of byYear) {
  if (v.revenue === undefined || v.expenditure === undefined) continue;
  // ⚠ $100, and the number is EVIDENCED rather than tuned: on the county-years
  // that reconcile outright, the reader's residual against the ACFR runs up to
  // $48 on figures of $40m-$830m. A threshold below its demonstrated precision
  // would count reader noise as a disagreement.
  if (Math.abs(v.revenue - v.expenditure) < 100) netAgree += 1;
  else { netDiffer += 1; netOffenders.push(`${k} (rev ${money(v.revenue)} vs exp ${money(v.expenditure)})`); }
}
console.log(`\n  net change in fund balance: ${netAgree}/${netAgree + netDiffer} county-years where the`);
console.log('  revenue and expenditure residuals are THE SAME NUMBER — the two publishers agree on');
console.log('  the bottom line and differ only on gross presentation.');
if (netOffenders.length) {
  console.log(`  ${netDiffer} county-year(s) where they do NOT agree, and which are therefore not`);
  console.log('  corroborated at all:');
  for (const o of netOffenders) console.log(`      ${o}`);
}
console.log(`  ${tally.total} documents read · ${tally.refused} refused · `
  + `${tally.netted} not reconcilable (ACFR nets transfers)`);
console.log('\n⚠ FAC begins at audit year 2016, and a county appears only in a year it');
console.log('  expended $750k of federal awards. TT loads FY1995-FY2025, so 21 of the 31');
console.log('  loaded years have NO audit route and are not claimed as checked here.');
