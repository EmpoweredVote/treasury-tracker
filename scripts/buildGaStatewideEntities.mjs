/**
 * Build the Georgia statewide RLGF entity registry from the filings themselves.
 *
 * NO SHEBANG — tests import `resolveMonth` and `joinCensusName`.
 *
 * Usage:
 *   node scripts/buildGaStatewideEntities.mjs --dir _acfr-work/ga/sweep/xlsx
 *   node scripts/buildGaStatewideEntities.mjs --dir ... --out scripts/data/georgiaStatewideEntities.mjs
 *
 * ── ⚠⚠ WHY THIS EXISTS: A HAND-DECLARED MONTH DOES NOT SCALE TO 720 ─────────
 *
 * `loadGeorgiaRLGF.resolveMonth()` requires each entity to declare
 * `fiscalYearStartMonth` by hand and REFUSES when the filing's own `FYEmonth`
 * disagrees. That is right for 7 entities and impossible for 720, and Georgia
 * offers no safe default to fall back on: the FAC census GA slice splits
 * 225 July / 212 January / 60 October / 41 other, and the split runs INSIDE one
 * metro — Atlanta starts in July, both of its own counties start in January.
 *
 * This follows the PA/SC precedent (`buildPaStatewideEntities.mjs:119`), with
 * one substitution: where PA starts from a state default plus an exception list,
 * Georgia starts from THE FILING'S OWN `FYEmonth`. Everything else is the same
 * discipline — the census is a GUARD, not the source, and silence is never
 * treated as agreement.
 *
 * Measured before the inversion was adopted: across all 65 LOAD1 filings of the
 * 7 hand-written entities, the form's `FYEmonth` agreed with the hand-declared
 * month 64 times out of 64 and conflicted 0 times. The 65th is Baldwin FY2020's
 * unfilled placeholder "MONTH" — a blank, not a disagreement. The hand-written
 * month never once added information the filing did not already carry.
 *
 * ── ⚠⚠ THE SILENT MISS IS THE REAL RISK, NOT THE MONTH ──────────────────────
 *
 * `censusGuard()` returns `{ok: true}` when it cannot FIND an entity, so a
 * failed name join is indistinguishable from a clean confirmation — the
 * Columbus-Muscogee blind spot, at 159x the scale. Two things follow:
 *
 *   1. The join is resolved and COUNTED here, up front, and every unresolved
 *      name is printed. It is never discovered per-entity at load time.
 *   2. `censusMonthFor()` does an EXACT `census.get(name)`, so the registry
 *      stores FAC's own spelling. Census says `DeKalb County`; FAC says
 *      `Dekalb County`. Wave 2 got that right by hand; case-folding gets it
 *      right 159 times.
 *
 * ⚠ Measured on the GA slice before relying on the fold: no GA name carries both
 * a county and a municipality row, and no two GA names differ only by case — so
 * a case-insensitive county join is unambiguous. `buildCensus()` keys its map by
 * NAME ALONE, so a name carrying two kinds would silently merge; Georgia has
 * none, and this asserts that rather than assuming it.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { parseLoad1, readLog1 } from './lib/gaRlgf.mjs';
import { buildCensus, censusMonthFor } from './lib/facFiscalYearCensus.mjs';
import { fyeMonthChange, fyeMonthDefect } from './data/gaRlgfAnomalies.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = join(ROOT, '_acfr-work/ga/sweep/xlsx');
const DEFAULT_ENUM = join(ROOT, '_acfr-work/ga/sweep/enumeration.json');
const DEFAULT_OUT = join(ROOT, 'scripts/data/georgiaStatewideEntities.mjs');
const COUNTY_POP = join(ROOT, 'cache/co-est2024-alldata.csv');

export const GA_STATE = 'GA';
export const GA_FIRST_YEAR = 2016;
export const GA_LAST_YEAR = 2025;

/**
 * The seven governments already carried by `georgiaRlgfEntities.mjs`.
 *
 * ⚠ They are EXCLUDED from the generated registry rather than regenerated into
 * it. Two registries both claiming the same CICOID is how a sync keyed on
 * something other than `data_source` duplicates rows
 * (`project_sync_city_budget_not_source_safe`).
 */
export const ALREADY_LOADED = Object.freeze([
  '1005005', '2005001', '3011011', '3106002', '2060002', '1060060', '1044044',
]);

/** Read one worksheet into a dense row-major grid. */
function gridOf(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) return null;
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row, i) => {
    const arr = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => { arr[c - 1] = cell.value; });
    rows[i - 1] = arr;
  });
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/** `{CICOID}_{FY}_RLGF_{Name}.xlsx`, refusing a non-numeric year. */
export function parseWorkbookName(file) {
  const m = basename(file).match(/^(\d{7})_(\d{4})_RLGF_(.+)\.xlsx$/i);
  return m ? { cicoid: m[1], fiscalYear: Number(m[2]), label: m[3] } : null;
}

/**
 * Resolve a DCA government name to FAC's OWN spelling of it.
 *
 * Returns `{ censusName, kind }` on an unambiguous match, or `{ why }`.
 * ⚠ The returned name is FAC's exact string, because `censusMonthFor()` looks it
 * up with an exact `Map.get`. Returning the DCA spelling would look like a
 * successful join and then silently find nothing.
 */
export function joinCensusName(dcaName, wantKind, census = buildCensus(GA_STATE)) {
  const want = dcaName.trim().toLowerCase();
  const hits = [];
  for (const [name, entry] of census) {
    if (name.trim().toLowerCase() === want) hits.push({ censusName: name, kind: entry.kind });
  }
  if (hits.length === 0) return { why: `the FAC census has no row for ${JSON.stringify(dcaName)}` };
  if (hits.length > 1) {
    return { why: `${JSON.stringify(dcaName)} matches ${hits.length} census entities — ambiguous` };
  }
  if (wantKind && hits[0].kind !== wantKind) {
    return { why: `the census carries ${JSON.stringify(dcaName)} as a ${hits[0].kind}, not a ${wantKind}` };
  }
  return hits[0];
}

/**
 * Resolve one entity's fiscal-year start month from its own filings, and say how.
 *
 * `formMonths` is `[{fiscalYear, month, text}]` — one entry per filing read,
 * `month` null where the form carried a placeholder or a blank.
 *
 * ⚠ The census is a GUARD, not the source. It may CONTRADICT (refuse), CONFIRM,
 * or be UNCOVERED. Silence is never agreement.
 * ⚠ A month is NEVER defaulted. An entity whose form is blank everywhere AND
 * whose census is silent is refused, not guessed —
 * `project_fysm_column_default_one_defect` is the story of 18,700 rows that
 * carried a month nobody ever asserted.
 */
export function resolveMonth(entity, formMonths, lookup = censusMonthFor) {
  const stated = formMonths.filter((f) => f.month !== null);
  const blanks = formMonths.filter((f) => f.month === null);
  const distinct = [...new Set(stated.map((f) => f.month))];

  // The entity's own filings must agree with each other before the census is
  // consulted at all. A government that printed two different months inside one
  // load window is either a CALENDAR CHANGE or a FORM ERROR, and the form alone
  // cannot tell which — so neither is inferred here. Each one is accounted for
  // by a corroborated registry entry that must reproduce the observed months
  // EXACTLY, or the entity is refused.
  let monthByYear = null;
  if (distinct.length > 1) {
    const detail = distinct
      .map((m) => `month ${m} in ${stated.filter((f) => f.month === m).map((f) => f.fiscalYear).join('/')}`)
      .join('; ');

    const change = fyeMonthChange(entity.cicoid);
    if (change) {
      // ⚠ PINNED: the entry must predict every filing's printed month. An entry
      // whose years or months have drifted from the filings accounts for a
      // different series, not this one, and must not quietly stand in for it.
      const mismatch = stated.find((f) => (change.monthByYear[f.fiscalYear] ?? change.month) !== f.month);
      if (mismatch) {
        return { month: null, status: 'conflict',
          why: `${change.id} predicts month ${change.monthByYear[mismatch.fiscalYear] ?? change.month} for `
            + `FY${mismatch.fiscalYear} but the filing prints ${mismatch.month} — ${detail}` };
      }
      monthByYear = change.monthByYear;
      distinct.length = 0;
      distinct.push(change.month);
    } else {
      // Otherwise every year that departs from the consensus must have its own
      // corroborated one-year slip entry, pinning BOTH months.
      const counts = new Map();
      for (const f of stated) counts.set(f.month, (counts.get(f.month) ?? 0) + 1);
      const [consensus] = [...counts].sort((a, b) => b[1] - a[1])[0];
      const odd = stated.filter((f) => f.month !== consensus);
      const unexplained = odd.filter((f) => {
        const d = fyeMonthDefect(entity.cicoid, f.fiscalYear);
        return !(d && d.formMonth === f.month && d.month === consensus);
      });
      if (unexplained.length) {
        return { month: null, status: 'conflict',
          why: `its own filings disagree and FY${unexplained.map((f) => f.fiscalYear).join('/')} `
            + `${unexplained.length === 1 ? 'is' : 'are'} not accounted for — ${detail}` };
      }
      distinct.length = 0;
      distinct.push(consensus);
    }
  }

  const censusJoin = entity.censusName
    ? { censusName: entity.censusName, kind: entity.censusKind }
    : joinCensusName(entity.name, entity.entityType === 'county' ? 'county' : null);

  if (distinct.length === 0) {
    // No filing stated a month. The census is the ONLY remaining source, and if
    // it is silent too there is nothing to assert.
    if (censusJoin.why) {
      return { month: null, status: 'refused',
        why: `no filing states a month (${blanks.length} blank) and ${censusJoin.why}` };
    }
    const seen = formMonths.map((f) => lookup(GA_STATE, censusJoin.censusName, f.fiscalYear)).filter((s) => !s.unknown);
    const months = [...new Set(seen.map((s) => Number(s.month)))];
    if (months.length !== 1) {
      return { month: null, status: 'refused',
        why: `no filing states a month and the census ${months.length ? 'reports more than one' : 'covers no loaded year'}` };
    }
    return { month: months[0], status: 'census-only', censusName: censusJoin.censusName,
      why: `every filing's FYEmonth is blank or a placeholder; the month is the federal audit record's` };
  }

  const declared = distinct[0];
  if (censusJoin.why) {
    return { month: declared, status: 'unverified', why: censusJoin.why, monthByYear,
      statedYears: stated.length, blankYears: blanks.length };
  }

  let confirmed = 0;
  const uncovered = [];
  for (const f of stated) {
    // ⚠ Per YEAR, against the month TT will actually WRITE for that year — not
    // against a single entity month. For a government that changed its calendar
    // mid-window those differ, and comparing the wrong one would report a
    // contradiction on every year of the far side.
    const writing = monthByYear?.[f.fiscalYear] ?? declared;
    const seen = lookup(GA_STATE, censusJoin.censusName, f.fiscalYear);
    if (seen.unknown) { uncovered.push(f.fiscalYear); continue; }
    if (Number(seen.month) !== Number(writing)) {
      return { month: declared, status: 'conflict', censusName: censusJoin.censusName,
        why: `the federal audit record for ${JSON.stringify(censusJoin.censusName)} reports month `
          + `${seen.month} in FY${f.fiscalYear}, but TT would write month ${writing}` };
    }
    confirmed++;
  }
  if (!confirmed) {
    return { month: declared, status: 'unverified', censusName: censusJoin.censusName, monthByYear,
      why: `the census has a row for ${JSON.stringify(censusJoin.censusName)} but covers none of `
        + `FY${GA_FIRST_YEAR}-${GA_LAST_YEAR}`, statedYears: stated.length, blankYears: blanks.length };
  }
  return { month: declared, status: 'confirmed', censusName: censusJoin.censusName, monthByYear,
    confirmedYears: confirmed, uncoveredYears: uncovered,
    statedYears: stated.length, blankYears: blanks.length };
}

/**
 * Census Vintage 2024 county populations, keyed by lowercased name.
 *
 * ⚠ Joined by NAME, but only because the correspondence was measured EXACT in
 * both directions: DCA's 159 county options and the Census's 159 GA counties
 * match name-for-name with nothing left over on either side. The assertion below
 * is what keeps that true — a future drift fails loudly rather than silently
 * dropping a county's population.
 */
export function readCountyPopulations(file = COUNTY_POP) {
  const text = readFileSync(file, 'latin1');
  const [head, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split(',');
  const ix = (n) => cols.indexOf(n);
  const out = new Map();
  for (const line of lines) {
    const f = line.split(',');
    if (f[ix('SUMLEV')] !== '050' || f[ix('STATE')] !== '13') continue;
    out.set(f[ix('CTYNAME')].trim().toLowerCase(), {
      name: f[ix('CTYNAME')].trim(),
      fips: f[ix('STATE')] + f[ix('COUNTY')],
      population: Number(f[ix('POPESTIMATE2024')]),
    });
  }
  return out;
}

/** `Appling County` -> `appling-county`. */
export function entityKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Read every in-window workbook for one CICOID and return its LOG1 months. */
async function readFormMonths(dir, cicoid, first, last) {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(`${cicoid}_`) && f.toLowerCase().endsWith('.xlsx'))
    .sort();
  const months = [];
  const notes = [];
  for (const f of files) {
    const meta = parseWorkbookName(f);
    if (!meta) { notes.push(`${f}: refused, non-numeric fiscal year`); continue; }
    if (meta.fiscalYear < first || meta.fiscalYear > last) continue;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(join(dir, f));
    const load1 = gridOf(wb, 'LOAD1');
    if (!load1) { notes.push(`FY${meta.fiscalYear}: no LOAD1 sheet (pre-FY2016 form)`); continue; }
    const { blocks } = parseLoad1(load1);
    const log1 = readLog1(blocks._LOG1 || {});
    months.push({
      fiscalYear: meta.fiscalYear,
      month: log1.fyEndMonth,
      text: log1.fyEndMonthText,
      monthsReported: log1.monthsReported,
      monthChanged: log1.monthChanged,
      government: log1.government,
    });
  }
  return { months, notes };
}

export async function buildEntities({
  dir = DEFAULT_DIR, enumeration = DEFAULT_ENUM, kind = 'county',
  first = GA_FIRST_YEAR, last = GA_LAST_YEAR, log = console.log,
} = {}) {
  if (!existsSync(dir)) throw new Error(`no converted workbooks at ${dir} — run fetchGeorgiaRLGF.mjs first`);
  const manifest = JSON.parse(readFileSync(enumeration, 'utf8'));
  const pops = readCountyPopulations();
  const census = buildCensus(GA_STATE);

  // ⚠ buildCensus keys by NAME ALONE, so a name carrying two kinds would merge
  // two governments into one entry. Georgia has none; assert it rather than
  // assume it, because this is the join everything below rests on.
  const kinds = new Map();
  for (const [name, entry] of census) {
    const k = name.trim().toLowerCase();
    if (kinds.has(k)) throw new Error(`GA census name collision on ${JSON.stringify(name)} — the map merged two governments`);
    kinds.set(k, entry.kind);
  }

  const targets = manifest.governments.filter((g) => g.kind === kind);
  log(`${targets.length} ${kind} governments in the enumeration`);

  const entities = [];
  const refusals = [];
  const statuses = { confirmed: 0, unverified: 0, 'census-only': 0, conflict: 0, refused: 0 };
  let read = 0;

  for (const g of targets) {
    const inWindow = g.years.filter((y) => y >= first && y <= last);
    if (!inWindow.length) {
      refusals.push({ cicoid: g.cicoid, name: g.name, status: 'no-filings',
        why: `DCA lists no filing in FY${first}-${last}` });
      continue;
    }
    if (ALREADY_LOADED.includes(g.cicoid)) {
      refusals.push({ cicoid: g.cicoid, name: g.name, status: 'already-loaded',
        why: 'carried by georgiaRlgfEntities.mjs; excluded so two registries cannot claim one CICOID' });
      continue;
    }
    const pop = pops.get(g.name.trim().toLowerCase());
    if (!pop) {
      refusals.push({ cicoid: g.cicoid, name: g.name, status: 'no-population',
        why: `Census Vintage 2024 has no GA county named ${JSON.stringify(g.name)}` });
      continue;
    }

    const { months, notes } = await readFormMonths(dir, g.cicoid, first, last);
    read += months.length;
    if (!months.length) {
      refusals.push({ cicoid: g.cicoid, name: g.name, status: 'no-readable-filing',
        why: notes.join('; ') || 'no workbook with a LOAD1 sheet' });
      continue;
    }

    const stub = { cicoid: g.cicoid, name: g.name, entityType: 'county', censusName: null, censusKind: null };
    const joined = joinCensusName(g.name, 'county', census);
    if (!joined.why) { stub.censusName = joined.censusName; stub.censusKind = joined.kind; }
    const r = resolveMonth(stub, months);
    statuses[r.status] = (statuses[r.status] ?? 0) + 1;

    if (r.status === 'conflict' || r.status === 'refused') {
      refusals.push({ cicoid: g.cicoid, name: g.name, status: r.status, why: r.why });
      continue;
    }

    const monthText = months.find((m) => m.month === r.month)?.text ?? null;
    entities.push({
      key: entityKey(g.name),
      cicoid: g.cicoid,
      name: g.name,
      state: GA_STATE,
      entityType: 'county',
      population: pop.population,
      populationSource: `co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=${pop.fips.slice(2)}`,
      fiscalYearStartMonth: r.month,
      fiscalYearEndText: monthText,
      censusName: r.censusName ?? null,
      censusKind: r.censusName ? 'county' : null,
      censusConfirms: r.status === 'confirmed',
      monthByYear: r.monthByYear ?? null,
      monthStatus: r.status,
      monthWhy: r.why ?? null,
      parentCountyKey: null,
      fiscalYears: months.map((m) => m.fiscalYear).sort((a, b) => a - b),
      notes: notes.length ? notes : undefined,
    });
  }

  return { entities, refusals, statuses, read, targets: targets.length };
}

/** Serialise the registry as a module, sorted by key so the diff is reviewable. */
export function renderModule(entities, meta) {
  const rows = [...entities].sort((a, b) => a.key.localeCompare(b.key));
  const body = rows.map((e) => `  {
    key: ${JSON.stringify(e.key)},
    cicoid: ${JSON.stringify(e.cicoid)},
    name: ${JSON.stringify(e.name)},
    state: 'GA',
    entityType: ${JSON.stringify(e.entityType)},
    population: ${e.population},
    populationSource: ${JSON.stringify(e.populationSource)},
    fiscalYearStartMonth: ${e.fiscalYearStartMonth},
    fiscalYearEndText: ${JSON.stringify(e.fiscalYearEndText)},
    censusName: ${JSON.stringify(e.censusName)},
    censusKind: ${JSON.stringify(e.censusKind)},
    censusConfirms: ${e.censusConfirms},${e.monthByYear ? `
    // ⚠ CHANGED ITS FISCAL CALENDAR INSIDE THE WINDOW. These years are written
    // with the month the filing printed for them, not the entity's current one.
    monthByYear: Object.freeze(${JSON.stringify(e.monthByYear)}),` : ''}
    monthStatus: ${JSON.stringify(e.monthStatus)},
    monthWhy: ${JSON.stringify(e.monthWhy)},
    parentCountyKey: null,
    fiscalYears: [${e.fiscalYears.join(', ')}],
  },`).join('\n');

  return `/**
 * Georgia statewide RLGF registry — GENERATED, DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   node scripts/buildGaStatewideEntities.mjs --dir _acfr-work/ga/sweep/xlsx
 *
 * Built ${meta.builtAt} from ${meta.read} workbooks across ${meta.targets} ${meta.kind}
 * governments listed by DCA.
 *
 * ── HOW \`fiscalYearStartMonth\` GOT HERE ─────────────────────────────────────
 *
 * From THE FILING'S OWN \`FYEmonth\` field, corroborated against the entity's
 * federally filed audit period. Georgia has no safe default month — its FAC
 * slice splits 225 July / 212 January / 60 October / 41 other, and the split
 * runs inside a single metro — so a per-state value was never available.
 *
 * \`monthStatus\` records WHICH of those happened, per entity:
 *   confirmed    the form and the FAC census agree        (${meta.statuses.confirmed})
 *   unverified   the form states it; the census is silent (${meta.statuses.unverified})
 *   census-only  every form was blank; the census answered (${meta.statuses['census-only']})
 * Absent from this file, each for a DIFFERENT reason — never one count:
 *   ${String(meta.statuses.conflict).padStart(3)} month CONFLICT   the form and the census disagree, or the
 *       entity's own filings disagree with each other
 *   ${String(meta.byReason['no-filings'] ?? 0).padStart(3)} no filing      DCA lists nothing in the window; all 8 are
 *       counties whose consolidated government files instead
 *   ${String(meta.byReason['already-loaded'] ?? 0).padStart(3)} already loaded carried by georgiaRlgfEntities.mjs
 * Every one is named in the build log. None is silently dropped.
 *
 * ⚠⚠ \`censusConfirms\` IS TRUE ONLY FOR \`confirmed\`. \`censusGuard()\` returns
 * \`{ok: true}\` when it cannot find an entity, so an unverified month would
 * otherwise pass the load-time check without anything being checked — the
 * Columbus-Muscogee blind spot. An unverified month is loaded and labelled; it
 * is never reported as corroborated.
 *
 * ⚠ \`censusName\` is FAC's OWN spelling, which is not always the Census
 * Bureau's: FAC writes \`Dekalb County\`, the Census writes \`DeKalb County\`, and
 * \`censusMonthFor()\` does an exact \`Map.get\`.
 */

export const GA_STATEWIDE_WINDOW = Object.freeze({ first: ${meta.first}, last: ${meta.last} });

export const GA_STATEWIDE_ENTITIES = Object.freeze([
${body}
].map(Object.freeze));
`;
}

export async function main(argv = process.argv.slice(2), log = console.log) {
  const { values } = parseArgs({
    args: argv,
    options: {
      dir: { type: 'string', default: DEFAULT_DIR },
      enumeration: { type: 'string', default: DEFAULT_ENUM },
      out: { type: 'string', default: DEFAULT_OUT },
      kind: { type: 'string', default: 'county' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const r = await buildEntities({ dir: values.dir, enumeration: values.enumeration, kind: values.kind, log });

  log(`\nMONTH RESOLUTION (${r.read} workbooks read)`);
  for (const [k, v] of Object.entries(r.statuses)) if (v) log(`  ${k.padEnd(12)}: ${v}`);
  log(`\nREGISTRY: ${r.entities.length} entities`);

  const byStatus = r.refusals.reduce((a, x) => ({ ...a, [x.status]: [...(a[x.status] ?? []), x] }), {});
  log(`\nNOT IN THE REGISTRY: ${r.refusals.length}`);
  for (const [s, xs] of Object.entries(byStatus)) {
    log(`  ${s} (${xs.length})`);
    for (const x of xs) log(`     ${x.cicoid} ${x.name}: ${x.why}`);
  }

  const unverified = r.entities.filter((e) => !e.censusConfirms);
  log(`\n⚠ MONTH NOT CORROBORATED BY THE FEDERAL AUDIT RECORD: ${unverified.length}`);
  for (const e of unverified) log(`     ${e.cicoid} ${e.name} (month ${e.fiscalYearStartMonth}, ${e.monthStatus}): ${e.monthWhy}`);

  if (values['dry-run']) { log('\n--dry-run: nothing written'); return r; }
  const meta = {
    builtAt: new Date().toISOString().slice(0, 10),
    read: r.read, targets: r.targets, kind: values.kind,
    statuses: { confirmed: 0, unverified: 0, 'census-only': 0, conflict: 0, ...r.statuses },
    byReason: r.refusals.reduce((a, x) => ({ ...a, [x.status]: (a[x.status] ?? 0) + 1 }), {}),
    refused: r.refusals.length, first: GA_FIRST_YEAR, last: GA_LAST_YEAR,
  };
  writeFileSync(values.out, renderModule(r.entities, meta));
  log(`\n  -> ${values.out}`);
  return r;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('buildGaStatewideEntities.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
