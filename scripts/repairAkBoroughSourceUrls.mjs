/**
 * One-time repair: replace the EXPIRING presigned S3 link stamped as
 * `source_url` on every Alaska borough ACFR row with the citable FAC endpoint.
 *
 * NO SHEBANG — kept importable.
 *
 * ── ⚠⚠ WHAT WENT WRONG, AND WHY NO GATE SAW IT ────────────────────────────
 *
 * `fetchAkBoroughs.mjs` recorded `res.url` — the URL that ACTUALLY SERVED the
 * bytes — in its manifest, which is the right rule everywhere else in this repo
 * and the wrong one here. The Federal Audit Clearinghouse answers
 *
 *     https://app.fac.gov/dissemination/report/pdf/<report_id>
 *
 * with a 302 to a PRESIGNED S3 OBJECT whose own query string reads
 * `X-Amz-Expires=30`. Thirty SECONDS. That string became the `source_url` of
 * 139 rows in #299 and of 114 more in the wave-1 load, and it was dead before
 * the load that wrote it had finished.
 *
 * Every figure is correct. Every tie held. Nothing in the frozen invariant, the
 * tie gate, the per-capita guard or the scope sweep looks at a URL, so the one
 * thing that was broken is the one thing a reader would click.
 *
 * ⚠ THE REPLACEMENT IS NOT A GUESS. It is the exact string
 * `documentUrlFor(key, fy)` built and `fetchAkBoroughs.mjs` requested; the
 * download succeeding is the proof it resolves. The ephemeral URL is retained
 * in the manifest as `servedUrl` for the record and is never offered to anyone.
 *
 * ── ⚠ WHY THIS IS AN UPDATE AND NOT A RE-LOAD ────────────────────────────
 *
 * Re-running the loader would fix the URL and MINT NEW `budgets.id`s for every
 * row it touched, staling the id-keyed frozen-figure registry (see
 * reference_frozen_figure_invariant). This writes one column, in place, on rows
 * identified by id. No total moves, so the frozen digest cannot move either —
 * which this script re-asserts for you at the end rather than assuming.
 *
 * Usage:
 *   node --env-file=.env scripts/repairAkBoroughSourceUrls.mjs --dry-run
 *   node --env-file=.env scripts/repairAkBoroughSourceUrls.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

import { AK_BOROUGHS, FAC_PDF_BASE } from './lib/akBoroughSources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

/** A presigned link is the thing being removed; refuse to write one back. */
const PRESIGNED = /[?&]X-Amz-(Expires|Signature)=/i;

function manifestFor(key) {
  const p = path.join(ROOT, 'docs/AkBoroughs', key, 'manifest.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const db = createClient(url, key, { db: { schema: 'treasury' } });

let scanned = 0; let repaired = 0; let alreadyOk = 0; const problems = [];

for (const ent of AK_BOROUGHS) {
  const manifest = manifestFor(ent.key);
  const { data: muni, error: mErr } = await db.from('municipalities')
    .select('id').eq('state', 'AK').eq('name', ent.name).maybeSingle();
  if (mErr || !muni) { problems.push(`${ent.name}: entity not found`); continue; }

  const { data: rows, error } = await db.from('budgets')
    .select('id, fiscal_year, dataset_type, source_url')
    .eq('municipality_id', muni.id);
  if (error) { problems.push(`${ent.name}: ${error.message}`); continue; }

  for (const row of rows) {
    scanned += 1;
    const rec = manifest[String(row.fiscal_year)];
    if (!rec?.report_id) {
      problems.push(`${ent.name} FY${row.fiscal_year}: no manifest entry — cannot name a URL`);
      continue;
    }
    const want = `${FAC_PDF_BASE}${rec.report_id}`;
    if (PRESIGNED.test(want)) { problems.push(`${ent.name} FY${row.fiscal_year}: built a presigned URL`); continue; }
    if (row.source_url === want) { alreadyOk += 1; continue; }
    if (!PRESIGNED.test(row.source_url ?? '')) {
      // ⚠ Not ours to rewrite. Anchorage is in this family and is fetched from
      // muni.org, so its rows already carry a perfectly good publisher URL.
      problems.push(`${ent.name} FY${row.fiscal_year} ${row.dataset_type}: `
        + `source_url is not presigned and not the expected FAC URL — left alone`);
      continue;
    }
    if (!DRY) {
      const { error: uErr } = await db.from('budgets').update({ source_url: want }).eq('id', row.id);
      if (uErr) { problems.push(`${ent.name} FY${row.fiscal_year}: ${uErr.message}`); continue; }
    }
    repaired += 1;
  }
  console.log(`  ${ent.name.padEnd(30)} ${rows.length} row(s)`);
}

console.log(`\nscanned ${scanned}  ${DRY ? 'would repair' : 'repaired'} ${repaired}  already citable ${alreadyOk}`);
if (problems.length) {
  console.log(`\n⚠ ${problems.length} row(s) reported, NOT written:`);
  for (const p of problems.slice(0, 20)) console.log(`  ! ${p}`);
  if (problems.length > 20) console.log(`  … and ${problems.length - 20} more`);
}
if (!DRY) console.log('\nNext: npm run verify:frozen — no total moved, so the digest must not either.');
