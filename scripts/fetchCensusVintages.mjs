/**
 * Download Census Bureau subcounty population files for a state.
 *
 * ⚠⚠ WHY OLDER VINTAGES EXIST HERE AT ALL. TT types an entity from the census
 * and never from the word a publisher prints — DCA's City/Town designator
 * contradicts the census in 20 of 530 Georgia municipalities. But the file TT
 * reads is Vintage 2024, and a 2024 vintage cannot name a government that
 * stopped existing before 2024, so the discipline that protects every live
 * entity silently refuses every dead one. These files are how a dead
 * government is still typed BY THE CENSUS rather than by a guess.
 *
 * ⚠ The directory segment is the SERIES, not the vintage: vintage 2013 lives
 * under 2010-2013, vintage 2019 under 2010-2019. There is no single pattern to
 * derive — each is declared.
 *
 * Free, keyless, public. Writes to `cache/`, which is gitignored; the committed
 * fixtures under `tests/fixtures/census/` are what tests read.
 *
 * Usage:
 *   node scripts/fetchCensusVintages.mjs 13          # Georgia, default ladder
 *   node scripts/fetchCensusVintages.mjs 13 2019     # one vintage
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www2.census.gov/programs-surveys/popest/datasets';

export const VINTAGE_URLS = Object.freeze({
  2024: (fips) => `${BASE}/2020-2024/cities/totals/sub-est2024_${fips}.csv`,
  2019: (fips) => `${BASE}/2010-2019/cities/totals/sub-est2019_${fips}.csv`,
  2014: (fips) => `${BASE}/2010-2014/cities/totals/sub-est2014_${fips}.csv`,
  2013: (fips) => `${BASE}/2010-2013/cities/totals/sub-est2013_${fips}.csv`,
});

export async function fetchVintages(stateFips, vintages = [2024, 2019, 2014, 2013], log = console.log) {
  const out = [];
  mkdirSync(join(ROOT, 'cache'), { recursive: true });
  for (const v of vintages) {
    const dest = join(ROOT, `cache/sub-est${v}_${stateFips}.csv`);
    if (existsSync(dest)) {
      log(`  vintage ${v}: already cached`);
      out.push({ vintage: v, dest, cached: true });
      continue;
    }
    const url = VINTAGE_URLS[v]?.(stateFips);
    if (!url) throw new Error(`no URL declared for vintage ${v}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`vintage ${v} for state ${stateFips}: HTTP ${res.status} from ${url}`);
    const body = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, body);
    log(`  vintage ${v}: ${body.length} bytes -> ${dest}`);
    out.push({ vintage: v, dest, cached: false });
  }
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const fips = process.argv[2] ?? '13';
  const vintages = process.argv[3] ? [Number(process.argv[3])] : undefined;
  await fetchVintages(fips, vintages);
}
