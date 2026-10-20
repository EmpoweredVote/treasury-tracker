#!/usr/bin/env node
/**
 * Generate scripts/data/nyOscMunicipalEntities.mjs — the 933 towns, 561
 * villages and 57 counties, with the display name each will be stored under.
 *
 * Spec: docs/superpowers/specs/2026-10-19-ny-towns-villages-counties-design.md §3.2, §8.3
 *
 *   node scripts/buildNyOscMunicipalEntities.mjs            # writes the file
 *   node scripts/buildNyOscMunicipalEntities.mjs --check    # fails if stale
 *
 * ⚠⚠ THE ROSTER IS BUILT FROM EVERY ACCOUNT-CODE SECTION, NOT FROM `readYear`.
 * This is an ENTITY list, not a row list. `readYear` keeps only REVENUE and
 * EXPENDITURE, and in the districts load a government that filed GL/FBNP and
 * nothing else vanished from a `readYear`-built roster, taking with it the
 * alias that stopped one district forking into two. Both routes are built here
 * and asserted equal, so if a future snapshot introduces such a government the
 * difference is reported rather than silently absorbed.
 *
 * ⚠ Generated. Do not hand-edit the output; change this and re-run.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import {
  readYear, parseCsv, archiveFor, MUNICIPAL_CLASSES,
  MUNICIPAL_FIRST_YEAR, MUNICIPAL_LAST_YEAR, assertMunicipalRoster,
} from './lib/nyOsc.mjs';
import { resolvePython } from './lib/pythonBin.mjs';
import { execFileSync } from 'node:child_process';

const OUT = 'scripts/data/nyOscMunicipalEntities.mjs';
const CHECK = process.argv.includes('--check');

/**
 * Every row of one member, including the sections `readYear` drops.
 *
 * ⚠ The python call passes the zip path and member as `sys.argv`, never
 * interpolated into the `-c` program, and runs under `-I` so a planted
 * `zipfile.py` beside the archive cannot be imported. Keep it that way.
 */
function readYearAllSections(zipPath, year, memberClass) {
  const text = execFileSync(resolvePython(), ['-I', '-c',
    'import sys,zipfile;sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode("utf-8-sig",errors="replace"))',
    zipPath, `${year}_${memberClass}.csv`,
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512, stdio: ['ignore', 'pipe', 'pipe'] });
  const grid = parseCsv(text);
  const header = grid[0];
  const ix = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const col of ['MUNICIPAL_CODE', 'ENTITY_NAME', 'COUNTY', 'CLASS_DESCRIPTION']) {
    if (ix[col] === undefined) throw new Error(`${year}_${memberClass}.csv lacks ${col}`);
  }
  return grid.slice(1)
    .filter((r) => r.length === header.length)
    .map((r) => ({
      municipalCode: r[ix.MUNICIPAL_CODE],
      entityName: r[ix.ENTITY_NAME],
      county: r[ix.COUNTY],
      classDescription: r[ix.CLASS_DESCRIPTION],
    }));
}

/**
 * ⚠ Strip the publisher's prefix, and REFUSE anything that does not carry it.
 * `ENTITY_NAME` is `Town of X` in 100% of rows in all three classes, measured;
 * a silent fallback to the raw string would store "Town of Adams" for one
 * government and "Adams" for the rest, which is a fork waiting for a re-run.
 *
 * ⚠⚠ STRIP EXACTLY ONE PREFIX, NEVER REPEATEDLY. OSC prints
 * `Village of Village of The Branch`, because that Suffolk County village is
 * LEGALLY NAMED "Village of The Branch". One strip gives the right answer; a
 * loop gives "The Branch", which names nothing. Identical in shape to
 * Pennsylvania's thirteen `... CITY BORO` boroughs, where one strip gives
 * "Grove City" and two give "Grove" — see scripts/data/paNameRules.mjs.
 */
const DOUBLED_PREFIX = Object.freeze({
  Village: ['Village of Village of The Branch'],
  Town: [],
  County: [],
});

function bareName(entityName, namePrefix) {
  if (!entityName.startsWith(namePrefix)) {
    throw new Error(
      `REFUSING: "${entityName}" does not start with "${namePrefix}" — the publisher's `
      + 'naming changed and the display name cannot be derived safely');
  }
  const bare = entityName.slice(namePrefix.length).trim();
  if (!bare) throw new Error(`REFUSING: "${entityName}" has no name after the prefix`);
  return bare;
}

/**
 * ⚠ A county column that already says "County" must not become
 * "Albion, Orleans County County". OSC prints the bare county name ("Orleans"),
 * but asserting it beats assuming it.
 */
function qualify(bare, county) {
  const c = county.trim();
  if (!c) throw new Error(`REFUSING: "${bare}" has no COUNTY to qualify with`);
  return /\bcounty$/i.test(c) ? `${bare}, ${c}` : `${bare}, ${c} County`;
}

const all = [];
const summary = [];

for (const memberClass of MUNICIPAL_CLASSES) {
  const archive = archiveFor(memberClass);
  const byCode = new Map();
  const loadable = new Set();

  for (let fy = MUNICIPAL_FIRST_YEAR; fy <= MUNICIPAL_LAST_YEAR; fy++) {
    for (const r of readYearAllSections(archive.path, fy, memberClass)) {
      const prior = byCode.get(r.municipalCode);
      if (prior) {
        prior.names.add(r.entityName);
        prior.counties.add(r.county);
        prior.classes.add(r.classDescription);
      } else {
        byCode.set(r.municipalCode, {
          names: new Set([r.entityName]),
          counties: new Set([r.county]),
          classes: new Set([r.classDescription]),
        });
      }
    }
    for (const r of readYear(archive.path, fy, memberClass)) loadable.add(r.municipalCode);
  }

  // ⚠ Present vs loadable — the districts' trap. Measured zero in all three
  // classes on 2026-10-19; reported rather than assumed, because a government
  // that files only balance-sheet rows would otherwise be seeded with no
  // budget row ever to attach to it.
  const presentOnly = [...byCode.keys()].filter((c) => !loadable.has(c));
  if (presentOnly.length) {
    throw new Error(
      `REFUSING: ${presentOnly.length} ${memberClass} code(s) file no revenue or `
      + `expenditure row in FY${MUNICIPAL_FIRST_YEAR}-FY${MUNICIPAL_LAST_YEAR} and would be `
      + `seeded with nothing to attach: ${presentOnly.join(', ')}`);
  }

  const rows = [];
  for (const [municipalCode, v] of byCode) {
    // ⚠ One spelling per code, asserted. The districts published two codes
    // under two spellings each and needed alias rows; these three classes
    // publish exactly one, and if that ever changes it must surface here
    // rather than fork a government.
    if (v.names.size !== 1) {
      throw new Error(
        `REFUSING: code ${municipalCode} is published under ${v.names.size} spellings `
        + `(${[...v.names].join(' / ')}) — this roster has no alias mechanism`);
    }
    if (v.classes.size !== 1 || !v.classes.has(memberClass)) {
      throw new Error(
        `REFUSING: code ${municipalCode} carries CLASS_DESCRIPTION `
        + `${[...v.classes].join(' / ')} inside the ${memberClass} archive`);
    }
    if (v.counties.size !== 1) {
      throw new Error(
        `REFUSING: code ${municipalCode} is published under ${v.counties.size} counties `
        + `(${[...v.counties].join(' / ')}) — county-qualification would not be stable`);
    }
    const [entityName] = v.names;
    const [county] = v.counties;
    rows.push({
      municipalCode,
      bare: bareName(entityName, archive.namePrefix),
      county,
      entityType: archive.entityType,
    });
  }

  // ⚠⚠ THE DOUBLED-PREFIX EXCEPTION IS DECLARED, AND BOTH DIRECTIONS ARE
  // ASSERTED. A declaration that matches no government is a stale rule nobody
  // notices; a government that doubles its prefix without being declared is a
  // name this generator has silently mangled.
  const doubled = [...byCode.values()]
    .map((v) => [...v.names][0])
    .filter((n) => n.slice(archive.namePrefix.length).startsWith(archive.namePrefix.trimEnd()))
    .sort();
  const declared = [...DOUBLED_PREFIX[memberClass]].sort();
  if (JSON.stringify(doubled) !== JSON.stringify(declared)) {
    throw new Error(
      `REFUSING: ${memberClass} governments whose name doubles the publisher's prefix are `
      + `${JSON.stringify(doubled)}, but DOUBLED_PREFIX declares ${JSON.stringify(declared)}. `
      + 'Each is a government legally named "Village of X" — one strip is right, two name '
      + 'nothing. Update the declaration deliberately, never the stripper.');
  }

  // ⚠⚠ QUALIFICATION IS COMPUTED FROM THE DATA, never from a hand-written
  // list. Ten town names are each shared by two towns; villages and counties
  // share none. A hand list would go stale the first time OSC adds or
  // dissolves a government.
  const nameCount = new Map();
  for (const r of rows) nameCount.set(r.bare, (nameCount.get(r.bare) ?? 0) + 1);

  const qualified = [];
  for (const r of rows) {
    const collides = nameCount.get(r.bare) > 1;
    qualified.push({
      municipalCode: r.municipalCode,
      name: collides ? qualify(r.bare, r.county) : r.bare,
      county: r.county,
      entityType: r.entityType,
      memberClass,
      ...(collides ? { qualified: true } : {}),
    });
  }
  qualified.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  // The seeder's own pre-flight, run here too so a stale generated file cannot
  // reach a seeder at all.
  assertMunicipalRoster(qualified, memberClass);

  const nQualified = qualified.filter((q) => q.qualified).length;
  summary.push(`${memberClass}: ${qualified.length} governments, ${nQualified} county-qualified`);
  all.push(...qualified);
}

const body = all.map((e) => '  { municipalCode: ' + JSON.stringify(e.municipalCode)
  + ', name: ' + JSON.stringify(e.name)
  + ', county: ' + JSON.stringify(e.county)
  + ', entityType: ' + JSON.stringify(e.entityType)
  + ', memberClass: ' + JSON.stringify(e.memberClass)
  + (e.qualified ? ', qualified: true' : '')
  + ' },').join('\n');

const counts = MUNICIPAL_CLASSES
  .map((c) => ` *     ${c.padEnd(8)} ${String(all.filter((e) => e.memberClass === c).length).padStart(4)}`)
  .join('\n');

const file = `// NO SHEBANG — tests import this module.
/**
 * New York's towns, villages and counties as OSC's own archives list them,
 * FY${MUNICIPAL_FIRST_YEAR}-FY${MUNICIPAL_LAST_YEAR}.
 *
${counts}
 *
 * ⚠⚠ GENERATED by scripts/buildNyOscMunicipalEntities.mjs. Do not hand-edit;
 * change the generator and re-run. \`npm run ny:check-municipal-roster\` fails
 * if this file and the archives have drifted apart.
 *
 * ⚠⚠ \`municipalCode\` IS THE JOIN KEY, NEVER \`name\`. It is OSC's own stable
 * id, it survives a re-spelling, and it is globally unique across all three
 * archives (measured: zero codes appear in more than one class).
 *
 * ⚠⚠ TEN TOWN NAMES ARE EACH SHARED BY TWO TOWNS — Albion, Ashland, Brighton,
 * Chester, Clinton, Dickinson, Franklin, Fremont, Greenville and Lewis.
 * \`treasury_ensure_municipality\` keys on (name, state, entity_type), so a bare
 * \`Albion\` would collapse two governments into ONE row carrying both budgets.
 * Those are county-qualified — \`Albion, Orleans County\` — in Pennsylvania's
 * measured form, and \`qualified: true\` marks each one. Villages and counties
 * collide on nothing.
 *
 * ⚠ 223 town/village name pairs are shared ACROSS classes. That is not a
 * collision: entity_type differs and they are different governments.
 *
 * ⚠⚠ \`Village of The Branch\` IS A NAME, NOT AN UNSTRIPPED PREFIX. OSC prints
 * it as \`Village of Village of The Branch\`, because that Suffolk County
 * village is legally named "Village of The Branch". Exactly one prefix is
 * stripped; stripping twice would give "The Branch", which names nothing.
 * Pennsylvania's thirteen \`... CITY BORO\` boroughs are the same shape.
 *
 * ⚠ \`county\` is OSC's own COUNTY column, read from the same row as the name.
 * No geocoding is involved anywhere in this load.
 */
export const NY_MUNICIPAL_ENTITIES = Object.freeze([
${body}
]);
`;

if (CHECK) {
  const onDisk = readFileSync(OUT, 'utf8');
  if (onDisk !== file) {
    console.error(`REFUSING: ${OUT} is stale — re-run `
      + 'node scripts/buildNyOscMunicipalEntities.mjs');
    process.exit(1);
  }
  console.log(`${OUT} matches the archives (${all.length} governments)`);
} else {
  writeFileSync(OUT, file);
  console.log(`wrote ${OUT}`);
}
for (const s of summary) console.log(`  ${s}`);
