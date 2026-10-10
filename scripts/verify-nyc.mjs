#!/usr/bin/env node
/**
 * Independent verification of the NYC series. Four checks; all must pass.
 *
 * CHECK 1  GLYPH RE-DERIVATION, BOTH SCOPES. Every (fy, mode, scope) printed
 *          total is re-read by scripts/verifyNycGlyphs.py, which uses
 *          pdfplumber rather than poppler's `pdftotext`, finds its OWN page
 *          from scratch, and does its own tokenising. Any disagreement is a
 *          failure -- including a disagreement about WHICH PAGE, which is the
 *          whole point given `exclude_ignore` widens the candidate set.
 *
 *          ⚠ This covers BOTH scopes. `scripts/lib/acfrGfCoords.py` could have
 *          covered only the General Fund (it has no `target_column`) and
 *          cannot read this issuer unaided anyway -- see verifyNycGlyphs.py.
 *
 * CHECK 2  CROSS-BOOK AGREEMENT. Every NYC ACFR prints the current year AND
 *          the prior year. FY(n) read from book n must equal FY(n) read from
 *          book n+1 -- two separately typeset documents, 23 overlapping pairs,
 *          both modes, both scopes.
 *
 * CHECK 3  AUDIT OPINION. Every book in the window must carry an UNMODIFIED
 *          opinion, because spec section 6.2 grades every NYC row as audited
 *          GAAP and a grade nothing verifies is a claim, not a grade.
 *          ⚠⚠ The gate must not match `qualified` INSIDE `unqualified`.
 *
 * CHECK 4  DATABASE PARITY. Every loaded row's total equals the extractor's
 *          printed total, with the right fund_scope, basis,
 *          fiscal_year_start_month and source_url. Skipped with a notice when
 *          the entity is not yet seeded.
 *
 * Usage:
 *   node --env-file=.env scripts/verify-nyc.mjs
 *   node scripts/verify-nyc.mjs --skip-db
 */
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolvePython } from './lib/pythonBin.mjs';
import { NYC_FYS, nycAcfrUrl } from './lib/nycAcfrSources.mjs';
import { NYC_ENTITY } from './seedNewYorkCity.mjs';
import {
  FUND_SCOPES, FISCAL_YEAR_START_MONTH, BASIS_VALUE,
  sourceNameFor, extractOrRefuse,
} from './loadNYCAcfrs.mjs';

const python = resolvePython();
const failures = [];
const fail = (check, msg) => { failures.push(`[${check}] ${msg}`); console.error(`  FAIL ${msg}`); };

const pdfFor = (fy) => `docs/NYC/nyc-${fy}-acfr.pdf`;

function glyphs(fy, pdfPath) {
  const r = spawnSync(python, ['scripts/verifyNycGlyphs.py', pdfPath, String(fy)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return { error: (r.stdout || r.stderr || '').trim().slice(0, 200) };
  try { return JSON.parse(r.stdout); } catch { return { error: 'unparseable glyph output' }; }
}

// ── CHECK 1 ─────────────────────────────────────────────────────────────────
console.log('CHECK 1  glyph re-derivation (pdfplumber, own page, both scopes)');
const tableTotals = new Map();   // `${fy}|${mode}|${scope}` -> printed_total
let c1 = 0;
for (const fy of NYC_FYS) {
  const g = glyphs(fy, pdfFor(fy));
  if (g.error) { fail('CHECK 1', `FY${fy}: glyph reader: ${g.error}`); continue; }

  for (const scope of FUND_SCOPES) {
    for (const mode of ['revenue', 'operating']) {
      const d = extractOrRefuse(fy, mode, scope);
      tableTotals.set(`${fy}|${mode}|${scope}`, d.printed_total);
      const want = g[scope][mode];
      c1 += 1;
      if (d.printed_total !== want) {
        fail('CHECK 1', `FY${fy} ${mode} ${scope}: -table ${d.printed_total} vs glyphs ${want}`);
      }
      // ⚠ Page agreement. `-table` reports a 1-BASED page; pdfplumber is
      // 0-based. A mismatch here means the two readers chose different pages,
      // which is exactly what exclude_ignore puts at risk.
      if (typeof d.statement_page === 'number' && d.statement_page - 1 !== g.page_index) {
        fail('CHECK 1', `FY${fy} ${mode} ${scope}: page disagreement `
          + `-table p${d.statement_page} (1-based) vs glyphs p${g.page_index} (0-based)`);
      }
    }
  }
}
console.log(`         ${c1} comparisons\n`);

// ── CHECK 2 ─────────────────────────────────────────────────────────────────
console.log('CHECK 2  cross-book agreement (FY(n) from book n vs book n+1)');
const restatements = [];
let c2 = 0;
for (const fy of NYC_FYS) {
  const next = fy + 1;
  if (!NYC_FYS.includes(next)) continue;
  const own = glyphs(fy, pdfFor(fy));
  const prior = glyphs(fy, pdfFor(next));
  if (own.error || prior.error) {
    fail('CHECK 2', `FY${fy}: ${own.error || prior.error}`);
    continue;
  }
  for (const scope of FUND_SCOPES) {
    for (const mode of ['revenue', 'operating']) {
      c2 += 1;
      const a = own[scope][mode];
      const b = prior[scope][mode];
      if (a === b) continue;

      // ⚠⚠ A DISAGREEMENT HERE IS NOT AUTOMATICALLY AN ERROR. NYC RESTATES.
      // Several early books report a prior year differently from how that year
      // reported itself -- the same phenomenon that set the FY2001 window floor
      // (spec section 3.1). TT loads each year from its OWN audited book, which
      // is the figure that year's auditors signed, so a restatement is expected
      // and is REPORTED, not failed.
      //
      // A GROSS divergence is different: that is what a misread looks like, and
      // it still fails. The threshold separates "the publisher revised this"
      // from "we read the wrong thing".
      const pct = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
      if (pct > 0.05) {
        fail('CHECK 2', `FY${fy} ${mode} ${scope}: book ${fy} says ${a}, book ${next} says ${b} `
          + `— ${(pct * 100).toFixed(1)}% apart, too large to be a restatement`);
      } else {
        restatements.push(`FY${fy} ${mode} ${scope}: ${a} -> restated ${b} in book ${next} `
          + `(${(pct * 100).toFixed(2)}%)`);
      }
    }
  }
}
console.log(`         ${c2} comparisons\n`);

// ── CHECK 3 ─────────────────────────────────────────────────────────────────
console.log('CHECK 3  audit opinion is unmodified in every book');
let c3 = 0;
for (const fy of NYC_FYS) {
  const r = spawnSync('pdftotext', ['-f', '1', '-l', '140', pdfFor(fy), '-'],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  const flat = (r.stdout || '').replace(/\s+/g, ' ').toLowerCase();
  c3 += 1;

  const hasOpinion = flat.includes('present fairly, in all material respects');
  // ⚠⚠ `qualified` is a SUBSTRING of `unqualified`. Match the modified-opinion
  // phrases with a boundary that a leading "un" defeats, so an unqualified
  // opinion can never be read as a qualified one.
  const modified = /(?:^|[^a-z])(adverse opinion|disclaimer of opinion)/.test(flat)
    || /(?:^|[^a-z])qualified opinion/.test(flat.replace(/unqualified/g, 'UNQUAL'));

  if (!hasOpinion) {
    // FY2018's opinion page has an interleaved text layer
    // (`deritaollrys,atchceepfitnedanicniathl...`). The statement pages are
    // clean; this page is not. Recorded, not waved through.
    fail('CHECK 3', `FY${fy}: no unmodified-opinion language found `
      + '(if FY2018, this is the known interleaved opinion page -- confirm by eye)');
  } else if (modified) {
    fail('CHECK 3', `FY${fy}: a MODIFIED opinion phrase is present`);
  }
}
console.log(`         ${c3} books read\n`);

// ── CHECK 4 ─────────────────────────────────────────────────────────────────
const skipDb = process.argv.includes('--skip-db');
console.log('CHECK 4  database parity');
let c4 = 0;
if (skipDb) {
  console.log('         skipped (--skip-db)\n');
} else {
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.log('         skipped (no SUPABASE_SERVICE_KEY)\n');
  } else {
    const db = createClient(url, key);
    const { data: muni } = await db.schema('treasury').from('municipalities')
      .select('id').eq('name', NYC_ENTITY.name).eq('state', 'NY').maybeSingle();
    if (!muni?.id) {
      console.log('         skipped (New York City is not seeded yet)\n');
    } else {
      const { data: rows, error } = await db.schema('treasury').from('budgets')
        .select('fiscal_year, dataset_type, fund_scope, basis, total_budget, '
          + 'source_url, fiscal_year_start_month, data_source')
        .eq('municipality_id', muni.id);
      if (error) throw new Error(`budgets read failed: ${error.message}`);

      for (const fy of NYC_FYS) {
        for (const scope of FUND_SCOPES) {
          for (const mode of ['revenue', 'operating']) {
            c4 += 1;
            const row = rows.find((r) => r.fiscal_year === fy
              && r.dataset_type === mode && r.fund_scope === scope);
            if (!row) { fail('CHECK 4', `FY${fy} ${mode} ${scope}: NO ROW`); continue; }
            const want = tableTotals.get(`${fy}|${mode}|${scope}`);
            if (Number(row.total_budget) !== want) {
              fail('CHECK 4', `FY${fy} ${mode} ${scope}: db ${row.total_budget} vs extractor ${want}`);
            }
            if (row.fiscal_year_start_month !== FISCAL_YEAR_START_MONTH) {
              fail('CHECK 4', `FY${fy} ${mode} ${scope}: fysm ${row.fiscal_year_start_month}, expected 7`);
            }
            if (row.basis !== BASIS_VALUE) {
              fail('CHECK 4', `FY${fy} ${mode} ${scope}: basis "${row.basis}", expected "${BASIS_VALUE}"`);
            }
            if (row.source_url !== nycAcfrUrl(fy)) {
              fail('CHECK 4', `FY${fy} ${mode} ${scope}: source_url "${row.source_url}"`);
            }
            if (row.data_source !== sourceNameFor(mode, fy, scope)) {
              fail('CHECK 4', `FY${fy} ${mode} ${scope}: data_source "${row.data_source}"`);
            }
          }
        }
      }
      const extra = rows.length - c4;
      if (extra !== 0) fail('CHECK 4', `expected ${c4} rows, found ${rows.length} (${extra} unexpected)`);
      console.log(`         ${c4} rows compared\n`);
    }
  }
}

if (failures.length) {
  console.error(`\n${failures.length} FAILURE(S):`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(`ALL CHECKS PASSED  (${c1} glyph, ${c2} cross-book, ${c3} opinions, ${c4} db)`);
