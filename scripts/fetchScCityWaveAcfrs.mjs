/**
 * Fetch the wave-1 South Carolina city ACFRs and write their provenance manifests.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Writes, per entity:
 *   _acfr-work/sc-cities/acfr/<key>/<key>_<fy>.pdf
 *   _acfr-work/sc-cities/acfr/<key>/manifest.json
 *
 * ⚠ ONE DIRECTORY PER ENTITY, NOT ONE SHARED ONE. `acfrGfLoad.readManifest` keys
 * the manifest by fiscal year alone, so two entities sharing a directory would
 * silently overwrite each other's provenance and attribute one city's document to
 * the other's rows. Session 6a's note; kept.
 *
 * ⭐ The bytes come from the Federal Audit Clearinghouse: the complete audited
 * reporting package, free, NO API KEY, NO WAF, at a permanent per-report id.
 * (Only the METADATA api at api.fac.gov needs `X-Api-Key`.) These are the
 * auditee's own submissions filed under federal penalty — first-party documents,
 * not third-party summaries.
 *
 * ⚠ The manifest records the URL THAT SERVED THE BYTES plus a sha256, so any
 * figure can be reproduced from the exact file that was parsed. The `source_url`
 * stamped on loaded rows is a different question — the CITY's publication page,
 * where a reader goes.
 *
 * Usage:
 *   node scripts/fetchScCityWaveAcfrs.mjs             # skips files already present
 *   node scripts/fetchScCityWaveAcfrs.mjs --force
 *   node scripts/fetchScCityWaveAcfrs.mjs --entity charleston
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { FAC_PDF_BASE, SC_CITY_ENTITIES } from './data/scCityAcfrEntities.mjs';

const ROOT = process.cwd();
const BASE = path.join(ROOT, '_acfr-work', 'sc-cities', 'acfr');

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
      + 'FAC serves an HTML error page with HTTP 200 for an id it cannot find. '
      + 'Check the report id in scripts/data/scCityAcfrEntities.mjs.');
  }
}

async function main() {
  const { values } = parseArgs({
    options: { force: { type: 'boolean', default: false }, entity: { type: 'string' } },
  });

  const entities = values.entity
    ? SC_CITY_ENTITIES.filter((e) => e.key === values.entity)
    : SC_CITY_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);

  let fetched = 0;
  let skipped = 0;

  for (const entity of entities) {
    const dir = path.join(BASE, entity.key);
    mkdirSync(dir, { recursive: true });
    const manifestPath = path.join(dir, 'manifest.json');
    const manifest = existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, 'utf8'))
      : {};

    const years = Object.keys(entity.facReports).map(Number).sort((a, b) => a - b);
    console.log(`\n${entity.name} (${entity.entityType}) — EIN ${entity.facEin}, ${years.length} filings`);

    for (const fy of years) {
      const reportId = entity.facReports[fy];
      const url = `${FAC_PDF_BASE}/${reportId}`;
      const file = path.join(dir, `${entity.key}_${fy}.pdf`);

      if (existsSync(file) && !values.force) {
        skipped += 1;
        console.log(`  FY${fy}  present (${statSync(file).size.toLocaleString()} bytes)`);
        continue;
      }

      const r = spawnSync('curl', ['-sS', '-L', '--max-time', '300', '-o', file, url], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`curl failed for ${entity.key} FY${fy}: ${r.stderr}`);
      assertPdf(file);

      const bytes = statSync(file).size;
      const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
      manifest[String(fy)] = { fy, url, reportId, bytes, pages: pageCount(file), sha256 };
      fetched += 1;
      console.log(`  FY${fy}  ${bytes.toLocaleString()} bytes  ${manifest[String(fy)].pages} pages  ${reportId}`);
    }

    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  console.log(`\n${fetched} fetched, ${skipped} already present.`);
  // ⚠⚠ A fetch that fetched nothing and found nothing must not look like success.
  if (fetched === 0 && skipped === 0) {
    console.error('REFUSING: no documents were fetched or found.');
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('fetchScCityWaveAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
