/**
 * Rebuild the per-state fiscal-calendar evidence extracts under `docs/<STATE>/`
 * from the Federal Audit Clearinghouse bulk download.
 *
 *     node scripts/buildFacFiscalYearCensus.mjs --download        # fetch + build
 *     node scripts/buildFacFiscalYearCensus.mjs --input path.csv  # build from a local copy
 *     node scripts/buildFacFiscalYearCensus.mjs --input path.csv --check
 *
 *     # …and the 1998-2015 half, which lives in a separate archive:
 *     curl -L -o census.zip https://app.fac.gov/dissemination/public-data/census/csv/census-1998-2015.zip
 *     unzip -q census.zip -d census/        # 413 MB, yields <year>/ELECAUDITHEADER.csv
 *     node scripts/buildFacFiscalYearCensus.mjs --input general.csv --historic-dir census/
 *
 * ⚠ BOTH HALVES OR NEITHER. The extracts are rebuilt wholesale, so running with
 * `--input` alone rewrites them WITHOUT the historic years and silently throws
 * away 1998-2015. The builder refuses to write a smaller extract than the one
 * already committed unless `--shrink` is passed.
 *
 * ⚠ NO SHEBANG, even though this file is executable. `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`, and
 * `tests/facCensusBuilder.test.mjs` imports the classification rules from here.
 * Run it with `node scripts/buildFacFiscalYearCensus.mjs`.
 *
 * ── Why this script is committed ────────────────────────────────────────────
 * The extracts are EVIDENCE, and evidence that cannot be regenerated is a
 * screenshot. Every filter below exists because something real got through it,
 * and each one is a pure exported function with tests
 * (`tests/facCensusBuilder.test.mjs`) — the classification is where all the
 * defects in this work actually lived:
 *
 *   • `auditee_state` is SELF-REPORTED AND SOMETIMES WRONG. A CA query returned
 *     "CITY OF GROTON, CONNECTICUT"; TX returned Alamogordo NM, Santa Fe NM and
 *     Tulsa OK. ⚠ Santa Fe is the dangerous one — there is also a Santa Fe,
 *     TEXAS, and the New Mexico rows made the Texas city look like it had
 *     changed its fiscal year. The ZIP prefix settles it.
 *   • Institutions arrive shaped like governments: housing commissions, MHMR
 *     authorities, community-supervision departments and appraisal districts all
 *     end in "… County" and would enter a county census as counties.
 *   • The SAME entity appears as "ANDERSON COUNTY" and "Anderson County" across
 *     years, and as "CITY OF X" and "CITY OF X, TEXAS". Without normalisation
 *     one entity becomes two, each with half its history.
 *
 * ⚠ Read the bulk file as STRICT UTF-8. Reading it with a replacement-character
 * fallback silently corrupted "St. Mary's County" into "St. Mary?s County",
 * which then split that county in two.
 *
 * The bulk file needs no API key and has no rate limit (~266 MB, ~413k rows,
 * audit years 2016+). It 302-redirects to a presigned S3 URL valid for 30
 * seconds, so follow redirects and use GET — HEAD is signed differently and 403s.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

export const BULK_URL = 'https://app.fac.gov/dissemination/public-data/gsa/full/general.csv';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
);

/**
 * Per-state extract targets.
 *
 * ⚠ CA COUNTIES ARE DELIBERATELY EXCLUDED — Cal. Gov. Code § 29001(e) fixes them
 * at July–June by statute and that citation already lives in
 * `scripts/lib/loaderFiscalCalendars.mjs`. TX and MD have no such statute, so
 * their counties are censused.
 */
/**
 * Every jurisdiction censused, and which kinds of government the census claims
 * to cover there.
 *
 * ⚠ CA COUNTIES ARE DELIBERATELY EXCLUDED — Cal. Gov. Code § 29001(e) fixes them
 * at July–June by statute, and that citation already lives in
 * `scripts/lib/loaderFiscalCalendars.mjs`. No other state has such a statute, so
 * everywhere else the counties are censused.
 *
 * ⚠ THERE IS NO PER-STATE "CORRECT MONTH" HERE, ON PURPOSE. A state's modal
 * calendar is MEASURED from the evidence at read time
 * (`dominantMonthFor()` in facFiscalYearCensus.mjs), never declared. Declaring
 * 53 months by hand is how a wrong generalisation gets locked in — and the
 * measurements show why: Michigan municipalities are modally July while
 * Michigan TOWNSHIPS are April, Illinois municipalities are MAY while Illinois
 * counties are DECEMBER, and Utah counties are January while Utah cities are
 * July.
 */
const ALL_KINDS = ['municipality', 'county', 'township'];
export const TARGETS = Object.fromEntries([
  'AL', 'AK', 'AZ', 'AR', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY', 'MD', 'PR', 'GU', 'VI', 'AS', 'MP',
].map((s) => [s, { kinds: ALL_KINDS }]).concat([['CA', { kinds: ['municipality'] }]]));

/** The single national evidence file every state's census is read out of. */
export const EVIDENCE_FILE = 'docs/fac/fac-local-fiscal-year-ends.csv';

const STATE_WORD = {
  AL: 'ALABAMA', AK: 'ALASKA', AZ: 'ARIZONA', AR: 'ARKANSAS', CA: 'CALIFORNIA', CO: 'COLORADO',
  CT: 'CONNECTICUT', DE: 'DELAWARE', DC: 'DISTRICT OF COLUMBIA', FL: 'FLORIDA', GA: 'GEORGIA',
  HI: 'HAWAII', ID: 'IDAHO', IL: 'ILLINOIS', IN: 'INDIANA', IA: 'IOWA', KS: 'KANSAS',
  KY: 'KENTUCKY', LA: 'LOUISIANA', ME: 'MAINE', MD: 'MARYLAND', MA: 'MASSACHUSETTS',
  MI: 'MICHIGAN', MN: 'MINNESOTA', MS: 'MISSISSIPPI', MO: 'MISSOURI', MT: 'MONTANA',
  NE: 'NEBRASKA', NV: 'NEVADA', NH: 'NEW HAMPSHIRE', NJ: 'NEW JERSEY', NM: 'NEW MEXICO',
  NY: 'NEW YORK', NC: 'NORTH CAROLINA', ND: 'NORTH DAKOTA', OH: 'OHIO', OK: 'OKLAHOMA',
  OR: 'OREGON', PA: 'PENNSYLVANIA', RI: 'RHODE ISLAND', SC: 'SOUTH CAROLINA', SD: 'SOUTH DAKOTA',
  TN: 'TENNESSEE', TX: 'TEXAS', UT: 'UTAH', VT: 'VERMONT', VA: 'VIRGINIA', WA: 'WASHINGTON',
  WV: 'WEST VIRGINIA', WI: 'WISCONSIN', WY: 'WYOMING', PR: 'PUERTO RICO', GU: 'GUAM',
  VI: 'VIRGIN ISLANDS', AS: 'AMERICAN SAMOA', MP: 'NORTHERN MARIANA ISLANDS',
};

/** `, TEXAS` / `, TX` — a trailing state name is noise, and it splits entities. */
export function stateSuffix(stateCode) {
  const word = STATE_WORD[stateCode];
  // ⚠ `\\s` — inside a TEMPLATE LITERAL a single `\s` collapses to a bare "s",
  // which silently turned this into `,?s*` and stopped stripping state suffixes.
  return new RegExp(`,?\\s*(?:${word ? `${word}|` : ''}${stateCode})$`, 'i');
}

/**
 * Organisation words that can NEVER be part of a place name. Applied to any
 * name, in any form.
 */
export const NOT_A_GOVERNMENT = new RegExp([
  // ⚠ `\\b` — in a JS string literal `'\b'` is the BACKSPACE character, not a
  // word boundary. Written that way these patterns match nothing and every
  // institution sails through, silently.
  'HOUSING', 'SUCCESSOR AGENCY', 'FINANCING', 'DEPARTMENT', '\\bDEPT\\b', '\\bDISTRICT\\b',
  '\\bAUTHORITY\\b', '\\bISD\\b', 'SCHOOL', 'ACADEMY', 'HOSPITAL', 'LIBRARY', 'TRANSIT',
  'APPRAISAL', 'COUNCIL OF GOVERNMENTS', '\\bBOARD\\b', 'EMERGENCY', 'SUPERVISION',
  'COMMISSION\\b', '\\bMHMR\\b', 'REDEVELOPMENT', 'RETIREMENT', 'PENSION', 'CHAMBER',
  'ASSOCIATION', '\\bFUND\\b', '\\bMUD\\b', 'AND AFFILIATES', '\\bINC\\b', '\\bLLC\\b',
  'FOUNDATION', 'CHURCH', 'MINISTR', 'COMMUNITY ACTION', 'HEAD START', 'COUNCIL ON AGING',
  'ECONOMIC OPPORTUNITY', 'MEDICAL', 'UNIVERSITY OF', '\\bCONSORTIUM\\b',
  // ⚠ Each of these reached a census as a COUNTY, because the organisation's
  // name ends in one: "Ywca Clark County", "Workforce Development Council
  // Snohomish County", "Family And Children First Council Mahoning County",
  // "Hardin County Educational Services Hardin County". A city's economic
  // development authority ("New Ulm EDA") arrived as a municipality the same way.
  '\\bYWCA\\b', '\\bYMCA\\b', 'WORKFORCE', 'EDUCATIONAL', '\\bEDA\\b', 'CHILDREN',
  '\\bFAMILY\\b', 'EXEMPTED', '\\bSERVICES\\b',
  // ⚠ These read as place-name words too — "State College" PA, "University
  // Park" TX/MD, "Center" MN, "Waterville" ME — so they are rejected only in
  // the AMBIGUOUS forms below, never when a leading "CITY OF"/"BOROUGH OF"
  // has already established that the auditee IS a government.
].join('|'), 'i');

/**
 * The narrower list for names that ALREADY announce themselves as governments
 * with a leading form. Here the remainder is a place name, so only words that
 * name a SUB-entity of a government may reject it.
 *
 * ⚠ "BOROUGH OF STATE COLLEGE" (Pennsylvania) was rejected by the broad list
 * because its NAME contains "COLLEGE". A filter that drops real governments is
 * as wrong as one that admits fake ones, and it fails silently in both
 * directions.
 */
export const NOT_A_GOVERNMENT_TAIL = new RegExp([
  // ⚠ `\\b`, not `\b` — the SAME backspace bug as the list above, left in this
  // one, and it let "THE CITY OF PRATTVILLE AIRPORT AUTHORITY" through as a
  // municipality named "Prattville Airport Authority". Fixing one escaped list
  // is not fixing the class.
  'HOUSING', 'SCHOOL DISTRICT', '\\bAUTHORITY\\b', 'COMMISSION\\b', 'DEPARTMENT', '\\bDEPT\\b',
  '\\bAGENCY\\b', '\\bDISTRICT\\b', 'AND AFFILIATES', '\\bINC\\b', '\\bLLC\\b', 'FOUNDATION',
  'ASSOCIATION', 'SUCCESSOR', 'REDEVELOPMENT', 'PENSION', 'RETIREMENT', '\\bMHMR\\b',
  '\\bBOARD OF\\b', 'COUNCIL OF GOVERNMENTS', 'UTILITIES', '\\bFUND\\b', 'MEDICAL',
  '\\bAIRPORT\\b', '\\bPORT\\b', '\\bTRUST\\b',
  // ⚠ Louisiana school districts are "<PLACE> PARISH/CITY SCHOOL BOARD", and
  // they file as "CITY OF BAKER SCHOOL BOARD" — a LEADING municipal form whose
  // remainder is a school district. Only the narrow tail list guards that path,
  // and it listed "SCHOOL DISTRICT" but not "SCHOOL" or "BOARD".
  '\\bSCHOOL\\b', '\\bBOARD\\b',
].join('|'), 'i');

/**
 * A parenthetical naming the GOVERNING BODY is the same government —
 * "CITY OF ROCKVILLE (MAYOR AND COUNCIL)" is Rockville. ⚠ Left alone it split
 * Rockville into THREE entities ("Rockville", "…(mayor & Council)",
 * "…(mayor And Council)"), each holding part of the history.
 *
 * Any OTHER parenthetical names a DIFFERENT body — "CITY OF EASTON (THE EASTON
 * UTILITIES COMMISION)", whose misspelling slips past the COMMISSION filter —
 * and is rejected rather than silently merged into the town.
 */
const GOVERNING_BODY_PAREN = /\s*\((?:THE\s+)?(?:MAYOR\s*(?:AND|&)\s*(?:CITY\s*)?COUNCIL|CITY\s*COUNCIL|TOWN\s*COUNCIL|COUNTY\s*COMMISSIONERS|COMMISSIONERS)\)\s*$/i;

/**
 * Every general-purpose local government form the national record uses. Counted
 * over 170,974 modern local-government records, the shapes that matter are:
 * CITY OF (22.5k), TOWN OF (6.4k), "X COUNTY" (7.8k), COUNTY OF (3.5k),
 * VILLAGE OF (1.3k), MUNICIPALITY OF (818), TOWNSHIP OF (579), BOROUGH OF (521),
 * "X TOWNSHIP" (400), "X CITY" (312), "X PARISH" (130), CHARTER TOWNSHIP OF,
 * CITY AND BOROUGH OF (Alaska), CITY AND COUNTY OF, PARISH OF (Louisiana).
 *
 * ⚠ TOWNSHIPS ARE THEIR OWN KIND. In MI, NJ, PA and OH they are governments with
 * their own calendars — Michigan townships are modally APRIL while Michigan
 * municipalities are July — so folding them into "municipality" would invent a
 * false mixture in exactly the states where the calendar is least uniform.
 */
/**
 * ⚠ CONSOLIDATED CITY-COUNTIES ARE MUNICIPALITIES HERE. "CITY AND COUNTY OF SAN
 * FRANCISCO", "CITY AND COUNTY OF DENVER", "CITY AND BOROUGH OF JUNEAU" are one
 * government doing both jobs, and TT holds them as CITIES. Classing them as
 * counties dropped San Francisco out of the California census entirely, because
 * CA censuses only municipalities — a silent loss of the state's second-largest
 * city.
 */
const MUNI = /^(?:THE\s+)?(?:CITY AND COUNTY OF\s+|CITY AND BOROUGH OF\s+|(?:CITY|TOWN|VILLAGE|BOROUGH|MUNICIPALITY)\s+OF\s+)(.+)$/i
/**
 * ⚠ NO TRAILING "… VILLAGE". Nationally that form is 14 records, and it is the
 * shape of RETIREMENT COMMUNITIES and NONPROFITS — "Canterbury Village",
 * "First Community Village", "Sonoma County Children's Village" all entered the
 * census as cities — while in Ohio "… EXEMPTED VILLAGE" is a SCHOOL DISTRICT.
 * Real villages file as "VILLAGE OF X" (1,341 records), which the leading form
 * already catches. A weak pattern that adds 14 records and a dozen impostors is
 * a net loss.
 */
const MUNI_TRAILING = /^([A-Za-z][A-Za-z.' ]+?)\s+(?:CITY|TOWN|BOROUGH)$/i;
const TWP = /^(?:THE\s+)?(?:CHARTER\s+)?TOWNSHIP\s+OF\s+(.+)$/i;
const TWP_TRAILING = /^([A-Za-z][A-Za-z.' ]+?)\s+(?:CHARTER\s+)?TOWNSHIP$/i;
const COMMISSIONERS_MUNI = /^THE COMMISSIONERS OF\s+(.+)$/i;

/**
 * Counties file under four shapes, and missing one SILENTLY UNDER-COUNTS the
 * census rather than failing:
 *
 *   "TRAVIS COUNTY"                       — the common form
 *   "COUNTY COMMISSIONERS OF KENT COUNTY" — Maryland's governing-body form
 *   "COUNTY OF EL PASO, TEXAS"            — 43 Texas counties file this way and
 *                                           were dropped by an earlier version
 *                                           of this file, which recognised only
 *                                           names ENDING in "County"
 *   "BOWIE, COUNTY OF"                    — inverted, and real
 */
const CNTY_TRAILING = /^(?:THE\s+)?(?:COUNTY OF COMMISSIONERS OF\s+|COUNTY COMMISSIONERS OF\s+|COMMISSIONERS OF\s+|COUNTY OF\s+)?([A-Za-z][A-Za-z.' ]+?)\s+(?:COUNTY|PARISH)$/i;
const CNTY_LEADING = /^(?:THE\s+)?(?:COUNTY OF|PARISH OF)\s+([A-Za-z][A-Za-z.' ]+)$/i;
const CNTY_INVERTED = /^([A-Za-z][A-Za-z.' ]+?),\s*COUNTY OF$/i;

/** Title Case that survives apostrophes and periods: "ST. MARY'S" -> "St. Mary's". */
export function titleize(s) {
  const lower = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return lower.replace(/(^|[\s.\-'])([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/'S\b/g, "'s");
}

/**
 * ⚠⚠ A MAILING ZIP IS NOT A JURISDICTION. For three states I filtered on
 * hand-written ZIP ranges, which caught four real impostors. Nationally the same
 * rule drops ~1,400 LEGITIMATE records: 41 Ohio governments file from a West
 * Virginia address, 39 Pennsylvania ones from New Jersey, and so on across every
 * border. A small government's mailing address is routinely across a state line.
 *
 * So the ZIP is used to DEMOTE rather than to exclude. The prefix->state map is
 * derived from the corpus itself by majority vote — no hand-typed table to get
 * wrong — and a record is dropped only when its ZIP points at another state AND
 * the same entity has other records whose ZIP agrees. That kills the case that
 * actually corrupts a census (Santa Fe NEW MEXICO filed under TX, which made
 * Santa Fe TEXAS look like it had changed its fiscal year) while keeping every
 * entity whose whole filing history is mailed from next door.
 */
export function zipPrefixStateMap(votes) {
  const map = new Map();
  for (const [prefix, counts] of votes) {
    let best = null;
    for (const [st, n] of counts) if (!best || n > best[1]) best = [st, n];
    if (best && best[1] >= 3) map.set(prefix, best[0]);
  }
  return map;
}

/** The 3-digit prefix of a ZIP, or null when it is not usable. */
export function zipPrefix(zip) {
  const p = String(zip ?? '').trim().slice(0, 3);
  return /^\d{3}$/.test(p) ? p : null;
}

/**
 * Drop only the records that both disagree with their ZIP and belong to an
 * entity that has agreeing records. Returns the kept records.
 */
export function demoteZipMismatches(records, prefixMap) {
  const hasAgreeing = new Set();
  for (const r of records) {
    const st = prefixMap.get(zipPrefix(r.zip) ?? '');
    if (!st || st === r.state) hasAgreeing.add(`${r.state}|${r.entity}`);
  }
  return records.filter((r) => {
    const st = prefixMap.get(zipPrefix(r.zip) ?? '');
    if (!st || st === r.state) return true;
    return !hasAgreeing.has(`${r.state}|${r.entity}`);
  });
}

/**
 * Classify one auditee name into `{ kind, entity }`, or null if it is not a
 * general-purpose local government of that state.
 */
export function classifyAuditee(rawName, stateCode) {
  if (typeof rawName !== 'string' || rawName.trim() === '') return null;
  const target = TARGETS[stateCode];
  if (!target) return null;

  let name = rawName.replace(/\s+/g, ' ').trim().replace(/^"|"$/g, '').replace(/\.$/, '').trim()
    .replace(GOVERNING_BODY_PAREN, '')
    .replace(stateSuffix(stateCode), '')
    .trim().replace(/,$/, '').trim();
  // ⚠ Utah cities are legally "<Name> City Corporation" — "BRIGHAM CITY
  // CORPORATION", "CLEARFIELD CITY CORPORATION". Stripping that legal tail is
  // what keeps them in the census, while "LUCAS COUNTY LAND REUTILIZATION
  // CORPORATION" (not a <place> CITY/TOWN CORPORATION) stays out.
  name = name.replace(/\s+(?:CITY|TOWN)\s+CORPORATION$/i, (mm) => mm.replace(/\s+CORPORATION$/i, ''));
  if (/[()]/.test(name)) return null;     // a survivor names a DIFFERENT body

  // ⚠ COUNTY FORMS FIRST. "CITY AND COUNTY OF SAN FRANCISCO" and "CITY AND
  // BOROUGH OF JUNEAU" both begin "CITY AND", which the municipal pattern would
  // otherwise claim.
  const cLead = CNTY_LEADING.exec(name);
  const cTrail = CNTY_TRAILING.exec(name) ?? CNTY_INVERTED.exec(name);
  const tLead = TWP.exec(name);
  const tTrail = TWP_TRAILING.exec(name);
  const mLead = MUNI.exec(name) ?? COMMISSIONERS_MUNI.exec(name);
  const mTrail = MUNI_TRAILING.exec(name);

  // A LEADING form proves this is a government and the rest is a place name.
  const lead = cLead ? ['county', cLead[1]] : tLead ? ['township', tLead[1]]
    : mLead ? ['municipality', mLead[1]] : null;
  if (lead) {
    if (NOT_A_GOVERNMENT_TAIL.test(lead[1])) return null;
    return finish(lead[0], lead[1], name, stateCode, target);
  }

  // A TRAILING form is weaker evidence, so the broad reject list applies — and
  // ⚠ THE WHOLE NAME IS THE ENTITY, never the stem. "SALT LAKE CITY" is Salt
  // Lake City; "OKLAHOMA CITY" is Oklahoma City; "CEDAR CITY" (Utah) really is
  // named Cedar City while "ALPINE CITY" is the city of Alpine — nothing in the
  // string distinguishes them, so guessing a stem would invent names and
  // silently split entities. Counties and townships already work this way.
  if (NOT_A_GOVERNMENT.test(name)) return null;
  const trail = cTrail ? ['county', name] : tTrail ? ['township', name]
    : mTrail ? ['municipality', name] : null;
  if (!trail) return null;
  return finish(trail[0], trail[1], name, stateCode, target);
}

function finish(kind, rawEntity, fullName, stateCode, target) {
  let entity = titleize(rawEntity).replace(/\.$/, '').trim();
  if (/ Of /.test(entity) || entity.length < 2) return null;
  // ⚠ A county's name is at most three words — "Prince George's", "St. Mary's",
  // "Jim Wells", "San Patricio", "Live Oak". Four or more before "County" means
  // an organisation named after one, which is how several YWCAs and councils
  // entered county censuses.
  if (kind === 'county' && entity.split(/\s+/).filter((w) => !/^(County|Parish)$/i.test(w)).length > 3) return null;
  if (kind === 'county' && !/ (County|Parish)$/i.test(entity)) {
    // Louisiana calls them parishes; Alaska's consolidated boroughs keep County
    // only when the record itself said so.
    entity += /PARISH/i.test(fullName) || stateCode === 'LA' ? ' Parish' : ' County';
  }
  if (kind === 'township' && !/ Township$/i.test(entity)) entity += ' Township';
  if (!target.kinds.includes(kind)) return null;
  if (entity.includes(',') || entity.includes('"')) return null;
  return { kind, entity };
}

/**
 * The Census-era (1998-2015) archive uses different column names and a coded
 * period field. ⚠ It also carries NO usable entity type — `ENTITY_TYPE` is
 * blank and `TYPEOFENTITY` is an undocumented numeric code — so the name and
 * ZIP filters are the ONLY thing separating governments from everything else in
 * that half. They are the same filters, which is why they are tested.
 */
export const PERIOD_FROM_CENSUS = { A: 'annual', B: 'biennial', O: 'other' };

/**
 * ⚠⚠ THE HISTORIC HALF STATES A STUB'S LENGTH OUTRIGHT, and the modern half
 * does not. `PERIODCOVERED='O'` with `NUMBERMONTHS=9` is a fiscal-year
 * changeover announcing itself — Fort Bend County's nine months to 2002-09-30,
 * Corpus Christi's fourteen to 2014-09-30. In the 2016+ data every stub is
 * still labelled "annual" (Huntington Beach's nine-month FY2018 among them), so
 * there the changeover has to be inferred. Keep `number_months`.
 */
async function readHistoric(dir, rows, counts) {
  const years = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name)).map((d) => d.name).sort();
  if (years.length === 0) throw new Error(`no <year>/ directories under ${dir}`);
  for (const year of years) {
    const file = path.join(dir, year, 'ELECAUDITHEADER.csv');
    if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
    const rl = readline.createInterface({
      input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity,
    });
    let idx = null;
    let pending = '';
    for await (const raw of rl) {
      // Census-era rows contain embedded newlines inside quoted fields; join
      // until the quotes balance rather than dropping the row.
      const line = pending + raw;
      if ((line.match(/"/g) ?? []).length % 2 === 1) { pending = `${line}\n`; continue; }
      pending = '';
      const f = splitCsv(line);
      if (idx === null) {
        idx = {};
        for (const c of ['AUDITEENAME', 'STATE', 'ZIPCODE', 'AUDITYEAR', 'FYENDDATE',
          'FYSTARTDATE', 'PERIODCOVERED', 'NUMBERMONTHS']) {
          idx[c] = f.indexOf(c);
          if (idx[c] < 0) throw new Error(`${file} is missing the "${c}" column`);
        }
        continue;
      }
      const state = (f[idx.STATE] ?? '').trim().toUpperCase();
      if (!TARGETS[state]) continue;
      counts.seen += 1;
      const zp = zipPrefix(f[idx.ZIPCODE]);
      if (zp) counts.votes.set(zp, (counts.votes.get(zp) ?? new Map()).set(state, ((counts.votes.get(zp) ?? new Map()).get(state) ?? 0) + 1));
      const cls = classifyAuditee(f[idx.AUDITEENAME], state);
      if (!cls) continue;
      const period = PERIOD_FROM_CENSUS[(f[idx.PERIODCOVERED] ?? '').trim().toUpperCase()];
      if (!period) continue;
      const rec = {
        entity: cls.entity,
        kind: cls.kind,
        audit_year: (f[idx.AUDITYEAR] ?? '').trim(),
        fy_start_date: (f[idx.FYSTARTDATE] ?? '').slice(0, 10),
        fy_end_date: (f[idx.FYENDDATE] ?? '').slice(0, 10),
        audit_period_covered: period,
        number_months: (f[idx.NUMBERMONTHS] ?? '').trim(),
        state, zip: f[idx.ZIPCODE],
      };
      if (!/^\d{4}$/.test(rec.audit_year)) continue;
      rows[state].set(`${rec.entity}|${rec.audit_year}|${rec.fy_end_date}`, rec);
    }
  }
  return years;
}

async function build(inputPath, historicDir, check, shrink) {
  const wanted = Object.keys(TARGETS);
  const rows = Object.fromEntries(wanted.map((s) => [s, new Map()]));
  const counts = { seen: 0, votes: new Map() };
  let historicYears = [];
  if (historicDir) historicYears = await readHistoric(historicDir, rows, counts);

  if (inputPath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),  // ⚠ strict UTF-8
    crlfDelay: Infinity,
  });
  let header = null;
  let idx = {};
  for await (const line of rl) {
    if (header === null) {
      header = splitCsv(line);
      for (const f of ['auditee_name', 'auditee_state', 'auditee_zip', 'entity_type', 'audit_year',
        'fy_start_date', 'fy_end_date', 'audit_period_covered', 'number_months']) {
        idx[f] = header.indexOf(f);
        if (idx[f] < 0) throw new Error(`bulk file is missing the "${f}" column`);
      }
      continue;
    }
    const f = splitCsv(line);
    const state = f[idx.auditee_state];
    if (!wanted.includes(state)) continue;
    const type = (f[idx.entity_type] ?? '').trim();
    if (type !== 'local' && type !== 'local government') continue;
    counts.seen += 1;
    const zp = zipPrefix(f[idx.auditee_zip]);
    if (zp) counts.votes.set(zp, (counts.votes.get(zp) ?? new Map()).set(state, ((counts.votes.get(zp) ?? new Map()).get(state) ?? 0) + 1));
    const cls = classifyAuditee(f[idx.auditee_name], state);
    if (!cls) continue;
    const rec = {
      entity: cls.entity, kind: cls.kind, audit_year: f[idx.audit_year],
      fy_start_date: f[idx.fy_start_date], fy_end_date: f[idx.fy_end_date],
      audit_period_covered: f[idx.audit_period_covered],
      number_months: (f[idx.number_months] ?? '').trim(),
      state, zip: f[idx.auditee_zip],
    };
    rows[state].set(`${rec.entity}|${rec.audit_year}|${rec.fy_end_date}`, rec);
  }
  }
  const seen = counts.seen;
  if (historicYears.length) console.log(`historic years read: ${historicYears[0]}-${historicYears[historicYears.length - 1]}`);

  // ⚠ ZIP DEMOTION, not exclusion — see zipPrefixStateMap above. Applied here,
  // after both halves are read, because it needs to know whether an entity has
  // ANY in-state-looking record before discarding an out-of-state-looking one.
  const prefixMap = zipPrefixStateMap(counts.votes);
  let demoted = 0;
  for (const state of wanted) {
    const kept = new Set(demoteZipMismatches([...rows[state].values()], prefixMap));
    for (const [k, v] of [...rows[state]]) if (!kept.has(v)) { rows[state].delete(k); demoted += 1; }
  }
  console.log(`ZIP demotion dropped ${demoted} records that both disagree with their ZIP and belong to an entity with agreeing records`);

  // ── Collapse to ERAS ──────────────────────────────────────────────────────
  // ⚠ One row per audit record would be ~120k rows / ~7 MB of tracked CSV for a
  // national census. Collapsing each entity's annual records into one row per
  // START MONTH, with the audit years as compact ranges, holds exactly what the
  // census needs — entity -> month -> years — at a fraction of the weight.
  // Non-annual periods stay as their own rows: a stub's LENGTH is evidence.
  const out = [];
  for (const state of wanted) {
    const byEntity = new Map();
    for (const r of rows[state].values()) {
      const e = byEntity.get(r.entity) ?? { kind: r.kind, annual: new Map(), odd: [] };
      if (r.audit_period_covered === 'annual') {
        const endMonth = Number((r.fy_end_date ?? '').slice(5, 7));
        if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) continue;
        const startMonth = (endMonth % 12) + 1;         // period END is the audited fact
        e.annual.set(startMonth, [...(e.annual.get(startMonth) ?? []), Number(r.audit_year)]);
      } else {
        e.odd.push(r);
      }
      byEntity.set(r.entity, e);
    }
    for (const [entity, e] of [...byEntity].sort((a, b) => a[0].localeCompare(b[0]))) {
      for (const [month, years] of [...e.annual].sort((a, b) => a[0] - b[0])) {
        out.push([state, entity, e.kind, 'annual', month, '', compactYears(years)]);
      }
      for (const r of e.odd.sort((a, b) => a.audit_year.localeCompare(b.audit_year))) {
        out.push([state, entity, e.kind, r.audit_period_covered, '', r.number_months ?? '', r.audit_year]);
      }
    }
  }
  const csv = [HEADER].concat(out.map((r) => r.join(','))).join('\n') + '\n';
  const dest = path.join(ROOT, EVIDENCE_FILE);
  const existing = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
  const existingRows = existing ? existing.trim().split('\n').length - 1 : 0;
  const entities = new Set(out.map((r) => `${r[0]}|${r[1]}`)).size;
  // ⚠ The file is rebuilt WHOLESALE, so a run missing an input half would
  // silently drop years. A smaller extract is a data loss, not an update.
  if (!check && existingRows > out.length && !shrink) {
    console.error(`FATAL: the evidence would shrink from ${existingRows} to ${out.length} rows. `
      + 'Both halves or neither — re-run with --historic-dir, or pass --shrink if you mean it.');
    process.exit(1);
  }
  if (check) {
    const same = existing === csv;
    console.log(`${out.length} rows, ${entities} entities across ${wanted.length} jurisdictions — `
      + `${same ? 'unchanged' : '⚠ DIFFERS from the committed evidence'}`);
    console.log(`(${seen} local-government records read)`);
    if (!same) {
      console.error('\nThe federal record has moved. Re-read the exceptions before committing: a NEW');
      console.error('non-dominant entity is a fiscal calendar nobody has acted on.');
      process.exit(1);
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, csv);
  console.log(`wrote ${out.length} rows, ${entities} entities across ${wanted.length} jurisdictions -> ${EVIDENCE_FILE}`);
  console.log(`(${seen} local-government records read)`);
}

/** `[1998,1999,2000,2002]` -> `"1998-2000 2002"`. Ranges keep the file small. */
export function compactYears(years) {
  const ys = [...new Set(years)].sort((a, b) => a - b);
  const parts = [];
  let i = 0;
  while (i < ys.length) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j += 1;
    parts.push(j > i ? `${ys[i]}-${ys[j]}` : `${ys[i]}`);
    i = j + 1;
  }
  return parts.join(' ');
}

/** The inverse of `compactYears`. */
export function expandYears(text) {
  const out = [];
  for (const part of String(text ?? '').trim().split(/\s+/).filter(Boolean)) {
    const m = /^(\d{4})-(\d{4})$/.exec(part);
    if (m) { for (let y = Number(m[1]); y <= Number(m[2]); y += 1) out.push(y); } else out.push(Number(part));
  }
  return out;
}

export const HEADER = 'state,entity,kind,period,start_month,number_months,audit_years';

/** Minimal CSV field splitter — handles the quoted, comma-bearing auditee names. */
export function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const shrink = argv.includes('--shrink');
  const historicDir = argv.includes('--historic-dir') ? argv[argv.indexOf('--historic-dir') + 1] : null;
  let input = argv.includes('--input') ? argv[argv.indexOf('--input') + 1] : null;
  if (argv.includes('--download')) {
    input = path.join(ROOT, '.fac-general.csv');
    console.log(`Downloading ${BULK_URL} …`);
    const res = await fetch(BULK_URL, { redirect: 'follow' });
    if (!res.ok) { console.error(`FATAL: download failed with HTTP ${res.status}`); process.exit(1); }
    fs.writeFileSync(input, Buffer.from(await res.arrayBuffer()));
    console.log(`  saved ${(fs.statSync(input).size / 1e6).toFixed(0)} MB`);
  }
  if (!input && !historicDir) {
    console.error('Give --download, or --input <FAC bulk general.csv>, and/or --historic-dir <unzipped census-1998-2015>.');
    process.exit(1);
  }
  await build(input, historicDir, check, shrink);
}

if (process.argv[1]?.endsWith('buildFacFiscalYearCensus.mjs')) await main();
