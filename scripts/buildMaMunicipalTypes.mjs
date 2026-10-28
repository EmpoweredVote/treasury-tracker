#!/usr/bin/env node
/**
 * Generate scripts/data/maMunicipalTypes.mjs — all 351 Massachusetts
 * municipalities with the type TT stores and the legal name it stores them
 * under.
 *
 *   node scripts/buildMaMunicipalTypes.mjs            # writes the file
 *   node scripts/buildMaMunicipalTypes.mjs --check    # fails if stale
 *
 * ── ⚠⚠ WHY THIS READS SUMLEV 061 AND NOT 162 ───────────────────────────────
 *
 * In New England the general-purpose government is the TOWN, which the census
 * carries as a county subdivision (SUMLEV 061), not as an incorporated place
 * (162). `scripts/lib/censusVintages.mjs` reads 162 only, which is right for
 * Georgia and wrong here: Massachusetts has 351 governments and the 2024 file
 * carries 351 rows at 061 against 58 at 162. Typing MA from 162 would leave
 * 293 governments unnamed by the census — and, worse, would type the handful
 * it DOES name off a row that says "Amherst Town city".
 *
 * ⚠ Measured 2026-10-28: 061 names all 351 with ZERO unmatched against TT's
 * roster and zero name collisions.
 *
 * ── ⚠⚠ THE THIRTEEN, AND WHY `censusType` AND `entityType` BOTH EXIST ──────
 *
 * Thirteen Massachusetts municipalities have a legal name ending in "Town" and
 * operate under a CITY charter, so the census names them `"Amherst Town city"`
 * — legal name "Amherst Town", census type `city`. TT types those `town`,
 * which is Chris's call (2026-10-28) on two grounds:
 *
 *   - It matches what each government calls itself. Barnstable is the Town of
 *     Barnstable; typing it `city` makes a public claim against its own name.
 *   - ⭐ It matches the line TT's own geofence work already drew. The 45 MA
 *     rows carrying `geoid_basis = census-pep-162-exact` are EXACTLY the 45
 *     plain-named census cities — zero on either side of the difference — so
 *     the 13 were already grouped with the towns on the geographic axis.
 *
 * Both values are kept in the output so the divergence is VISIBLE DATA rather
 * than a rule buried in this generator. A reader who disagrees can see exactly
 * which thirteen rows differ and why.
 *
 * ── ⚠⚠ THE KEY IS SQUASHED, NEVER THE RAW NAME ─────────────────────────────
 *
 * The census writes `Manchester-by-the-Sea`; TT and DLS write
 * `Manchester By The Sea`. Matching raw strings loses it. Every lookup goes
 * through `squashMa()` in scripts/lib/maNames.mjs, which is how the
 * zero-unmatched measurement above was obtained.
 *
 * ⚠ Generated. Do not hand-edit the output; change this and re-run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'cache', 'sub-est2024_25.csv');
const OUT = path.join(ROOT, 'scripts', 'data', 'maMunicipalTypes.mjs');

/** Massachusetts. */
const MA_FIPS = '25';
/** The census county-subdivision level — the MA town/city layer. */
const SUMLEV_MCD = '061';
/** Measured in the 2024 file, and asserted so a short read cannot pass. */
const EXPECTED_ROWS = 351;

/**
 * ⚠⚠ COLUMNS BY HEADER NAME, NEVER BY POSITION — the trap that typed four
 * Georgia governments as "Georgia". See scripts/lib/censusVintages.mjs.
 */
export function readMaMcd(file) {
  const text = readFileSync(file, 'latin1');
  const [head, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split(',').map((c) => c.trim());
  const ix = (n) => {
    const i = cols.indexOf(n);
    if (i < 0) throw new Error(`${file}: no ${n} column — header is ${head}`);
    return i;
  };
  // ⚠⚠ ZERO-PAD. The filename carries the bare fips, the STATE column inside
  // carries it padded. Comparing them unpadded matches nothing and returns an
  // EMPTY map — a total failure that reads like a measured refusal.
  const want = String(MA_FIPS).padStart(2, '0');

  const out = [];
  for (const line of lines) {
    const f = line.split(',');
    if (f[ix('SUMLEV')] !== SUMLEV_MCD) continue;
    if (f[ix('STATE')].padStart(2, '0') !== want) continue;
    const name = f[ix('NAME')].trim();
    const m = name.match(/^(.*)\s(city|town)$/);
    if (!m) throw new Error(`${file}: cannot read a type from ${JSON.stringify(name)}`);
    out.push({ legal: m[1].trim(), censusType: m[2] });
  }
  if (!out.length) throw new Error(`${file}: no SUMLEV ${SUMLEV_MCD} rows for state ${want}`);
  return out.sort((a, b) => a.legal.localeCompare(b.legal));
}

/**
 * The type TT stores.
 *
 * ⚠ A municipality whose LEGAL NAME ends in "Town" is a `town` here even when
 * the census types it `city`. See the header for the two grounds.
 */
export function ttTypeFor({ legal, censusType }) {
  return /\sTown$/.test(legal) ? 'town' : censusType;
}

function render(rows) {
  const diverge = rows.filter((r) => r.entityType !== r.censusType);
  const body = rows
    .map((r) => `  { legal: ${JSON.stringify(r.legal)}, censusType: ${JSON.stringify(r.censusType)}, `
      + `entityType: ${JSON.stringify(r.entityType)} },`)
    .join('\n');
  return `// NO SHEBANG — tests import this module.
/**
 * Massachusetts' 351 municipalities, typed from the census.
 *
 *     city   ${rows.filter((r) => r.entityType === 'city').length}
 *     town   ${rows.filter((r) => r.entityType === 'town').length}
 *
 * ⚠⚠ GENERATED by scripts/buildMaMunicipalTypes.mjs from Census Vintage 2024
 * SUMLEV 061 (county subdivisions — the New England town layer, NOT the 162
 * incorporated-place layer). Do not hand-edit; change the generator and re-run.
 * \`node scripts/buildMaMunicipalTypes.mjs --check\` fails if this has drifted.
 *
 * ⚠⚠ \`censusType\` IS WHAT THE CENSUS SAYS; \`entityType\` IS WHAT TT STORES.
 * They differ on exactly ${diverge.length} rows — the municipalities whose legal name ends
 * in "Town" and which operate under a city charter, which the census therefore
 * writes as e.g. "Amherst Town city". TT types those \`town\`: it matches each
 * government's own name, and it matches the line TT's geofence work already
 * drew (the 45 rows on \`geoid_basis = census-pep-162-exact\` are exactly the 45
 * plain-named census cities). The divergence is kept visible here rather than
 * hidden in the generator.
 *
 *     ${diverge.map((r) => r.legal).join('\n *     ')}
 *
 * ⚠⚠ \`legal\` IS NOT ALWAYS WHAT DLS PRINTS. The census writes
 * "Manchester-by-the-Sea"; DLS and TT write "Manchester By The Sea". Never
 * match these raw — go through \`squashMa()\` in scripts/lib/maNames.mjs.
 */

/** @typedef {{legal: string, censusType: 'city'|'town', entityType: 'city'|'town'}} MaMunicipality */

/** @type {MaMunicipality[]} */
export const MA_MUNICIPAL_TYPES = [
${body}
];
`;
}

function build() {
  const rows = readMaMcd(SOURCE).map((r) => ({ ...r, entityType: ttTypeFor(r) }));
  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(`expected ${EXPECTED_ROWS} MA municipalities at SUMLEV ${SUMLEV_MCD}, read ${rows.length}`);
  }
  // ⚠ A duplicate squashed key would silently make one government shadow
  // another at every lookup site. Asserted here, where it is cheap.
  const keys = new Set();
  for (const r of rows) {
    const k = r.legal.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (keys.has(k)) throw new Error(`duplicate squashed key for ${r.legal}`);
    keys.add(k);
  }
  return render(rows);
}

const text = build();
if (process.argv.includes('--check')) {
  const have = readFileSync(OUT, 'utf8');
  if (have !== text) {
    console.error(`✗ ${path.relative(ROOT, OUT)} is STALE — re-run scripts/buildMaMunicipalTypes.mjs`);
    process.exit(1);
  }
  console.log('✅ maMunicipalTypes.mjs matches the census file');
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}
