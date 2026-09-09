/**
 * Fetch the wave-1 Indiana county ACFRs and write their provenance manifests.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Writes, per entity:
 *   _acfr-work/in-counties/acfr/<key>/<key>_<fy>.pdf
 *   _acfr-work/in-counties/acfr/<key>/manifest.json
 *
 * ⚠ ONE DIRECTORY PER ENTITY, NOT ONE SHARED ONE. A manifest keyed by fiscal
 * year alone would let two entities sharing a directory overwrite each other's
 * provenance and attribute one county's document to the other's rows.
 *
 * ⭐ The bytes come from the Federal Audit Clearinghouse: the complete audited
 * reporting package, free, NO API KEY, NO WAF, at a permanent per-report id.
 * (Only the METADATA api at api.fac.gov needs `X-Api-Key`, and its `DEMO_KEY` is
 * 10 requests an HOUR.) These are the auditee's own submissions filed under
 * federal penalty — first-party documents, not third-party summaries.
 *
 * ⚠ The manifest records the URL THAT SERVED THE BYTES plus a sha256, so any
 * figure can be reproduced from the exact file that was parsed. The `source_url`
 * stamped on loaded rows is a different question — the COUNTY's publication
 * page, where a reader goes.
 *
 * Usage:
 *   node scripts/fetchInCountyAcfrs.mjs                 # skips files already present
 *   node scripts/fetchInCountyAcfrs.mjs --force
 *   node scripts/fetchInCountyAcfrs.mjs --entity lake
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  FAC_PDF_BASE, IN_COUNTY_ENTITIES, IN_COUNTY_COVERAGE_GAPS, inCountyFilingsFor,
} from './data/inCountyAcfrEntities.mjs';

const ROOT = process.cwd();
export const PDF_BASE = path.join(ROOT, '_acfr-work', 'in-counties', 'acfr');

/** Page count via pdfinfo, so the manifest records what was actually received. */
function pageCount(file) {
  const r = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const m = /^Pages:\s+(\d+)$/m.exec(r.stdout || '');
  return m ? Number(m[1]) : null;
}

/**
 * ⚠⚠ REFUSE A NON-PDF. FAC returns an HTML error page with HTTP 200 for an id it
 * cannot serve, and a 40KB HTML file saved as `.pdf` fails LATER and confusingly —
 * `pdftotext` emits nothing and it reads exactly like an image-only scan. Check
 * the magic bytes at fetch time, where the cause is obvious.
 */
function assertPdf(file) {
  const head = readFileSync(file).subarray(0, 5).toString('latin1');
  if (head !== '%PDF-') {
    throw new Error(`${path.basename(file)} is not a PDF (starts ${JSON.stringify(head)}) — `
      + 'FAC serves an HTML error page with HTTP 200 for an id it cannot find. Check the '
      + 'report id in scripts/data/inCountyFacRoster.json.');
  }
}

export async function main() {
  const { values } = parseArgs({
    options: { force: { type: 'boolean', default: false }, entity: { type: 'string' } },
  });

  const entities = values.entity
    ? IN_COUNTY_ENTITIES.filter((e) => e.key === values.entity)
    : IN_COUNTY_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);

  let fetched = 0;
  let skipped = 0;

  for (const entity of entities) {
    const dir = path.join(PDF_BASE, entity.key);
    mkdirSync(dir, { recursive: true });
    const manifestPath = path.join(dir, 'manifest.json');
    const manifest = existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, 'utf8'))
      : {};

    const filings = inCountyFilingsFor(entity);
    console.log(`\n${entity.name} — EIN ${entity.facEin}, ${filings.length} filings`);

    for (const { fy, reportId, ein } of filings) {
      const file = path.join(dir, `${entity.key}_${fy}.pdf`);

      if (existsSync(file) && !values.force) {
        skipped += 1;
        console.log(`  FY${fy}  present (${statSync(file).size.toLocaleString()} bytes)`);
        // ⚠ A file already on disk still needs its provenance recorded — a
        // manifest that only covers this run's downloads is a manifest with
        // holes exactly where the cache is warmest.
        if (!manifest[String(fy)]) {
          assertPdf(file);
          manifest[String(fy)] = {
            fy,
            url: `${FAC_PDF_BASE}/${reportId}`,
            reportId,
            ein,
            publisher: 'fac',
            bytes: statSync(file).size,
            pages: pageCount(file),
            sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
          };
        }
        continue;
      }

      const url = `${FAC_PDF_BASE}/${reportId}`;
      const r = spawnSync('curl', ['-sS', '-L', '--max-time', '600', '-o', file, url], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`curl failed for ${entity.key} FY${fy}: ${r.stderr}`);
      assertPdf(file);

      const bytes = statSync(file).size;
      const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
      manifest[String(fy)] = {
        fy, url, reportId, ein, publisher: 'fac', bytes, pages: pageCount(file), sha256,
      };
      fetched += 1;
      console.log(`  FY${fy}  ${bytes.toLocaleString()} bytes  `
        + `${manifest[String(fy)].pages} pages  ${reportId}`);
    }

    for (const [fy, why] of Object.entries(IN_COUNTY_COVERAGE_GAPS[entity.key] || {})) {
      console.log(`  FY${fy}  COVERAGE GAP — ${why}`);
    }

    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  console.log(`\n${fetched} fetched, ${skipped} already present.`);
  // ⚠⚠ A fetch that fetched nothing and found nothing must not look like success.
  if (fetched === 0 && skipped === 0) {
    console.error('REFUSING: no documents were fetched or found.');
    process.exit(1);
  }
  return fetched;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('fetchInCountyAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
