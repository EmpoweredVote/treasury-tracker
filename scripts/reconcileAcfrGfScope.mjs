#!/usr/bin/env node
/**
 * Scope reconciliation harness for the `… ACFR — General Fund …` row families.
 *
 * For every family it probes, it answers the ONE question that decides
 * `fund_scope`: **which column of the printed governmental-funds statement is
 * the figure in the database?** It does that by reading the statement with
 * `scripts/acfrPrintedTotal.py` (pdfplumber glyph coordinates), which shares no
 * code with any of the `pdftotext -table` extractors that loaded these rows, and
 * printing every printed fund column next to the stored figure.
 *
 * What it deliberately does NOT do is decide. It reports:
 *
 *   stored          the figure in treasury.budgets
 *   col0            the printed FIRST column (the General Fund, on every
 *                   governmental-funds statement in this corpus)
 *   factor          stored / col0 — must come out EXACTLY 1 or EXACTLY 1000,
 *                   which is also how the entity's `units` convention gets
 *                   confirmed rather than assumed (the $0 tie gate cannot see a
 *                   1000x error, so nothing else checks it)
 *   last            the printed LAST column, normally Total Governmental — the
 *                   discriminator. If `stored` matched THIS instead of col0, the
 *                   scope would be total_governmental, not general_fund.
 *   gfShare         col0 / last, so a reader can see at a glance that the stored
 *                   figure is a strict subset
 *
 * ⚠ `last` is "normally" Total Governmental, not always: an issuer who splits
 * fund columns across two pages prints only the first few on the statement page
 * and carries `Total` onto a continued page. Where the column count looks short,
 * the harness says so rather than calling the last column a total.
 *
 * PDFs are read from the local docs/<dir>/ caches left by the milestones that
 * loaded these rows. A family with no local cache is fetched from the
 * `source_url` STORED ON THE ROW ITSELF — not from a reconstructed URL — so the
 * document read is provably the document cited.
 *
 * Usage:
 *   node scripts/reconcileAcfrGfScope.mjs                     # every family
 *   node scripts/reconcileAcfrGfScope.mjs --family "City of Bend"
 *   node scripts/reconcileAcfrGfScope.mjs --probes 3          # years per family
 *   node scripts/reconcileAcfrGfScope.mjs --json out.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolvePython } from './lib/pythonBin.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const CACHE = path.join(ROOT, '_acfr-work', 'scope-recon-pdfs');
const PY = resolvePython();

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* absent is fine */ }
  }
}
loadEnv();

/**
 * Where each family's PDFs already live locally, and how their filenames encode
 * the fiscal year. Left null where no local cache exists — those get fetched
 * from the row's own source_url.
 */
const LOCAL = {
  'City of Bend': { dir: 'docs/Bend', re: /(\d{4})/ },
  'City of Seattle': { dir: 'docs/Seattle', re: /(\d{4})/ },
  'City of Sherwood': { dir: 'docs/Sherwood', re: /(\d{4})/ },
  'City of Tucson': { dir: 'docs/Tucson', re: /(\d{4})/ },
  'City of Beaverton': { dir: 'docs/Beaverton', re: /(\d{4})/ },
  'City of Hillsboro': { dir: 'docs/Hillsboro', re: /(\d{4})/ },
  'City of Tualatin': { dir: 'docs/Tualatin', re: /(\d{4})/ },
  'City of Cornelius': { dir: 'docs/Cornelius', re: /(\d{4})/ },
  'City of Tigard': { dir: 'docs/Tigard', re: /(\d{4})/ },
  Marana: { dir: 'docs/Marana', re: /(\d{4})/ },
  'Oro Valley': { dir: 'docs/OroValley', re: /(\d{4})/ },
  Sahuarita: { dir: 'docs/Sahuarita', re: /(\d{4})/ },
  'South Tucson': { dir: 'docs/SouthTucson', re: /(\d{4})/ },
};

function localPdfFor(family, fy) {
  const spec = LOCAL[family];
  if (!spec) return null;
  const dir = path.join(ROOT, spec.dir);
  if (!fs.existsSync(dir)) return null;
  const hits = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.pdf'))) {
    // A filename can carry several 4-digit runs ("2014-2015-acfr", "07_08_CAFR").
    // Accept the file when ANY of them equals the fiscal year, and when two
    // years appear (a straddling label) prefer the file whose LATER year matches,
    // since an ACFR is titled for the year it closes.
    const years = [...f.matchAll(/(\d{4})/g)].map((m) => Number(m[1])).filter((y) => y > 1990 && y < 2100);
    if (years.includes(fy)) hits.push({ f, last: Math.max(...years) });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => (a.last === fy ? -1 : b.last === fy ? 1 : 0));
  return path.join(dir, hits[0].f);
}

/**
 * Fetch a PDF, tolerating the two ways a government host breaks a plain fetch().
 *
 * 1. An INCOMPLETE TLS CHAIN. archives.obm.ohio.gov serves Ohio's state ACFRs
 *    without the intermediate certificate, so Node rejects it with
 *    UNABLE_TO_VERIFY_LEAF_SIGNATURE. That is a server misconfiguration, not a
 *    reason to skip the document — and NOT a reason to disable verification
 *    either. `curl` is tried second because it validates against the SYSTEM
 *    trust store, which has the intermediate. Verification stays on in both
 *    paths; nothing here passes `-k`.
 * 2. An unhandled throw killing the whole sweep. The first version of this let a
 *    single TLS failure abort the run with a stack trace, taking six unprobed
 *    families with it. Every failure mode now returns, so one bad host costs one
 *    line of output.
 */
async function fetchPdf(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100_000) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const accept = (buf) => {
    if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF')) return { error: 'not a PDF' };
    fs.writeFileSync(dest, buf);
    return dest;
  };

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TreasuryTracker/1.0',
        Accept: 'application/pdf,*/*',
        // Some portals gate on these; the OR milestones hit the same wall.
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return accept(Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    const why = e?.cause?.code || e?.message || 'fetch failed';
    const looksGood = () => fs.existsSync(dest) && fs.statSync(dest).size > 100_000
      && fs.readFileSync(dest).subarray(0, 5).toString('latin1').startsWith('%PDF');

    const curl = spawnSync('curl', ['-sL', '--max-time', '300', '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TreasuryTracker/1.0', '-o', dest, url],
    { encoding: 'buffer' });
    if (curl.status === 0 && looksGood()) return dest;

    // Third tier: PowerShell, which validates against the WINDOWS certificate
    // store and can complete a chain by fetching the intermediate via AIA.
    // archives.obm.ohio.gov (Ohio's state ACFRs) needs exactly this — Node and
    // git-bash curl both carry their own CA bundles and both fail it with
    // UNABLE_TO_VERIFY_LEAF_SIGNATURE / curl exit 60, while PowerShell succeeds.
    // Still a fully verified connection: no -k, no ServerCertificateValidationCallback.
    try { if (fs.existsSync(dest)) fs.rmSync(dest); } catch { /* fine */ }
    const ps = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      `try { Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -OutFile '${dest.replace(/'/g, "''")}' `
      + '-UseBasicParsing -TimeoutSec 300; exit 0 } catch { exit 1 }'], { encoding: 'utf8' });
    if (ps.status === 0 && looksGood()) return dest;

    try { if (fs.existsSync(dest)) fs.rmSync(dest); } catch { /* nothing to remove */ }
    return { error: `${why} (curl and PowerShell fallbacks also failed)` };
  }
}

function oracle(pdf) {
  const r = spawnSync(PY, [path.join(ROOT, 'scripts', 'acfrPrintedTotal.py'), pdf], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  try {
    const j = JSON.parse(r.stdout);
    return j.error ? { error: j.error } : j;
  } catch {
    return { error: (r.stderr || '').trim().split('\n').pop() || `exit ${r.status}` };
  }
}

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString());

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const onlyFamily = arg('--family');
  const probes = Number(arg('--probes') || 2);
  const jsonOut = arg('--json');

  const db = createClient(
    process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'treasury' } },
  );

  const { data: rows, error } = await db.from('budgets')
    .select('data_source, source_url, fiscal_year, dataset_type, total_budget')
    .like('data_source', '% ACFR — General Fund%')
    .not('data_source', 'like', '% State ACFR — General Fund%')
    .not('data_source', 'like', 'City of Austin ACFR — General Fund%')
    .not('data_source', 'like', 'Travis County ACFR — General Fund%')
    .order('data_source')
    .limit(2000);
  if (error) { console.error(error.message); process.exit(1); }

  const fams = {};
  for (const r of rows) {
    const fam = r.data_source.split(' ACFR')[0];
    (fams[fam] = fams[fam] || []).push(r);
  }

  const results = [];
  for (const [family, frows] of Object.entries(fams).sort((a, b) => b[1].length - a[1].length)) {
    if (onlyFamily && family !== onlyFamily) continue;
    const fys = [...new Set(frows.map((r) => r.fiscal_year))].sort((a, b) => a - b);
    // Probe the OLDEST and NEWEST year, then work inward: an issuer that
    // reorganised its statement mid-window shows up at the ends, not the middle.
    const picks = [];
    for (let i = 0; picks.length < Math.min(probes, fys.length); i++) {
      if (picks.length < probes) picks.push(fys[fys.length - 1 - Math.floor(i / 2)] ?? null);
      if (picks.length < probes && fys.length > 1) picks.push(fys[Math.floor(i / 2)] ?? null);
      if (i > fys.length) break;
    }
    const probeFys = [...new Set(picks.filter((x) => x != null))].slice(0, probes);

    console.log(`\n${'='.repeat(78)}\n${family}  (${frows.length} rows, FY${fys[0]}–FY${fys[fys.length - 1]})`);

    for (const fy of probeFys) {
      const forFy = frows.filter((r) => r.fiscal_year === fy);
      let pdf = localPdfFor(family, fy);
      let via = 'local';
      if (!pdf) {
        const url = forFy[0]?.source_url;
        if (!url) { console.log(`  FY${fy}: no local PDF and no source_url — SKIPPED`); continue; }
        const dest = path.join(CACHE, `${family.replace(/[^A-Za-z0-9]+/g, '-')}-${fy}.pdf`);
        const got = await fetchPdf(url, dest);
        if (got.error) { console.log(`  FY${fy}: fetch failed (${got.error}) — ${url}`); continue; }
        pdf = got; via = 'fetched';
      }
      const o = oracle(pdf);
      if (o.error) { console.log(`  FY${fy}: oracle FAILED — ${o.error}  [${path.basename(pdf)}]`); results.push({ family, fy, error: o.error }); continue; }

      console.log(`  FY${fy}  statement p${o.statement_page}  (${via}: ${path.basename(pdf)})`
        + (o.fiscal_year && o.fiscal_year !== fy ? `   ⚠ page says FY${o.fiscal_year}` : ''));

      for (const dataset of ['revenue', 'operating']) {
        const row = forFy.find((r) => r.dataset_type === dataset);
        if (!row) continue;
        const cols = dataset === 'revenue' ? o.revenue_columns : o.expenditure_columns;
        const stored = Number(row.total_budget);
        const col0 = cols[0];
        const last = cols[cols.length - 1];
        const factor = col0 ? stored / col0 : null;
        const exact = factor === 1 || factor === 1000;
        const gfShare = last ? (col0 / last) * 100 : null;
        console.log(`     ${dataset.padEnd(9)} stored ${fmt(stored).padStart(17)}  col0 ${fmt(col0).padStart(15)}`
          + `  factor ${exact ? `${factor}` : `${factor?.toFixed(6)} ✗`}`
          + `  last ${fmt(last).padStart(15)}  GF/last ${gfShare ? `${gfShare.toFixed(1)}%` : '—'}`
          + `  cols ${cols.length}`);
        results.push({ family, fy, dataset, stored, cols, factor, exact, gfShare });
      }
    }
  }

  const bad = results.filter((r) => r.error || !r.exact);
  console.log(`\n${results.length} probe(s); ${bad.length} needing attention.`);
  for (const b of bad) console.log(`  ⚠ ${b.family} FY${b.fy} ${b.dataset || ''} ${b.error || `factor ${b.factor}`}`);
  if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2)); console.log(`wrote ${jsonOut}`); }
}

await main();
