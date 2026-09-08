/**
 * Generate — and re-verify — the committed Indiana statewide roster.
 *
 * NO SHEBANG — tests/inStatewideRoster.test.mjs imports this module.
 *
 * Usage:
 *   node scripts/buildInStatewideRoster.mjs --dir _acfr-work/in --write
 *   node scripts/buildInStatewideRoster.mjs --dir _acfr-work/in --check
 *
 * ── WHY THE ROSTER IS COMMITTED AND NOT DERIVED AT LOAD TIME ────────────────
 *
 * Deriving it needs the 122 MB city receipts extract, so a committed JSON lets
 * the seeder, the loader and the tests share ONE authoritative list of 660
 * governments without a download. `--check` re-derives it from the extracts and
 * refuses on any difference, which is what stops the file going stale — the
 * pattern `buildMnOsaAuditBranch.mjs --check` established.
 *
 * ⚠ The generated file is compared BYTE FOR BYTE by --check, so `*.json` is
 * pinned to LF in .gitattributes. A Windows checkout that rewrote it to CRLF
 * would report STALE on a file identical in content — that exact failure is why
 * the rule exists (PR #147).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { readRosterFromExtracts, coverageByYear } from './lib/inStatewideRoster.mjs';

export const ROSTER_FILE = 'scripts/data/inStatewideRoster.json';

/** The exact bytes the roster file should hold for a given roster. */
export function serialise(roster) {
  return `${JSON.stringify({
    _what: 'Every Indiana city, town and county Gateway files an Annual Financial '
      + 'Report for. GENERATED — do not hand-edit. Re-derive and verify with '
      + 'node scripts/buildInStatewideRoster.mjs --dir <extracts> --check',
    _source: 'https://gateway.ifionline.org/public/download.aspx — Annual Financial '
      + 'Reports / Detailed Receipts, unit types City/Town and County, year All',
    _identity: 'sboa_id is the key. (cnty_cd, unit_code) is unique within these two '
      + 'extracts but NOT in the All extract, where 77 keys carry two governments.',
    generated_from_extracts: 'rec_city_ALL.txt, rec_county_ALL.txt',
    counts: {
      total: roster.length,
      city: roster.filter((e) => e.entityType === 'city').length,
      town: roster.filter((e) => e.entityType === 'town').length,
      county: roster.filter((e) => e.entityType === 'county').length,
    },
    entities: roster,
  }, null, 1)}\n`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/in' },
      write: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
    },
  });
  if (!values.write && !values.check) {
    console.error('Pass --write or --check.');
    process.exit(1);
  }

  const roster = await readRosterFromExtracts(values.dir);
  const counts = {
    city: roster.filter((e) => e.entityType === 'city').length,
    town: roster.filter((e) => e.entityType === 'town').length,
    county: roster.filter((e) => e.entityType === 'county').length,
  };
  console.log(`roster: ${roster.length} governments  `
    + `(${counts.city} cities, ${counts.town} towns, ${counts.county} counties)`);

  // ⚠ A roster that came back empty, or with one type missing, is not a roster.
  if (roster.length === 0) throw new Error('REFUSING: the roster is empty');
  for (const [t, n] of Object.entries(counts)) {
    if (n === 0) throw new Error(`REFUSING: the roster contains no ${t}`);
  }

  console.log('\nper-year coverage (a thin year is reported, never discovered later):');
  console.log('  year   city   town  county');
  for (const [y, c] of coverageByYear(roster)) {
    console.log(`  ${y}  ${String(c.city).padStart(5)}  ${String(c.town).padStart(5)}  ${String(c.county).padStart(6)}`);
  }

  const bytes = serialise(roster);
  if (values.write) {
    writeFileSync(ROSTER_FILE, bytes, 'utf8');
    // ⚠ Buffer.byteLength, not String.length — the header strings contain em-dashes,
    // 3 UTF-8 bytes each and one JS char, so the two disagree by 4 on this file.
    console.log(`\nwrote ${ROSTER_FILE} (${roster.length} entities, `
      + `${Buffer.byteLength(bytes, 'utf8')} bytes)`);
    return;
  }

  let onDisk;
  try {
    onDisk = readFileSync(ROSTER_FILE, 'utf8');
  } catch {
    console.error(`\n✗ ${ROSTER_FILE} does not exist. Generate it with --write.`);
    process.exit(1);
  }
  if (onDisk !== bytes) {
    console.error(`\n✗ STALE: ${ROSTER_FILE} does not match what the extracts produce.`);
    const a = JSON.parse(onDisk).entities ?? [];
    const b = roster;
    const ids = (x) => new Set(x.map((e) => e.sboaId));
    const [A, B] = [ids(a), ids(b)];
    const gone = [...A].filter((x) => !B.has(x));
    const added = [...B].filter((x) => !A.has(x));
    console.error(`  committed ${a.length} entities · extracts produce ${b.length}`);
    if (gone.length) console.error(`  in the file but NOT in the extracts: ${gone.slice(0, 10).join(', ')}`);
    if (added.length) console.error(`  in the extracts but NOT in the file: ${added.slice(0, 10).join(', ')}`);
    if (!gone.length && !added.length) {
      console.error('  the same governments — so a NAME, TYPE, CODE or YEAR SET changed.');
    }
    console.error('  Re-run with --write once you know why it moved.');
    process.exit(1);
  }
  console.log(`\n✅ ${ROSTER_FILE} matches the extracts byte for byte.`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('buildInStatewideRoster.mjs')) await main();
