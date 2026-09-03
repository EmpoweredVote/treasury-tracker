/**
 * Pennsylvania DCED names — turning the export's ALL-CAPS strings into names a
 * reader should see, and keeping 2,621 governments distinct while doing it.
 *
 * NO SHEBANG — tests import this module.
 *
 * ── ⚠⚠ 226 NAMES ARE SHARED BY MORE THAN ONE GOVERNMENT ────────────────────
 *
 * `FRANKLIN TWP` names **fifteen** different Pennsylvania townships. `LIBERTY
 * TWP` names eight, `HAMILTON TWP` five, and one second-class-township name is
 * shared by twenty-two governments.
 *
 * `treasury_ensure_municipality` keys on **(name, state, entity_type)** — all
 * three — so a bare `Franklin Township` would collapse fifteen governments into
 * ONE row carrying all fifteen budgets. Michigan shipped exactly this hazard and
 * solved it the same way: **county-qualify the name.**
 *
 * MEASURED: `(name, county)` is unique across all 2,572 municipalities — **zero
 * collisions** — so county-qualification is sufficient, not merely helpful.
 *
 * ⚠ Qualification is applied ONLY where it is needed:
 *   • every TOWNSHIP is qualified (210 colliding names among 1,457 second-class
 *     townships alone), which also matches Michigan's rendering;
 *   • a CITY or BOROUGH is qualified only when its bare name would collide with
 *     another government of the same entity_type. That is computed FROM THE DATA
 *     by `qualifyCollisions()`, not from a hand-written list, and the generator
 *     then asserts global uniqueness.
 *
 * ⚠⚠ THAT EXCEPTION IS LOAD-BEARING: `State College` and `Philadelphia` already
 * exist in `treasury.municipalities` with budget rows attached. Qualifying every
 * borough would rename State College to `State College, Centre County`, create a
 * SECOND row, and orphan the first.
 *
 * ── ⚠⚠ STRIP EXACTLY ONE TRAILING TYPE TOKEN, NEVER REPEATEDLY ─────────────
 *
 * Thirteen boroughs are legally named `... CITY`: `GROVE CITY BORO`,
 * `HOMER CITY BORO`, `UNION CITY BORO`, `MAHANOY CITY BORO` and so on. One strip
 * gives `Grove City`, which is right; a repeated strip gives `Grove`, which
 * names nothing.
 *
 * ⚠ And `OIL CITY` is typed `City` with NO second token, so stripping at all
 * gives `Oil`. That is the Everglades City trap from the Florida sweep, in the
 * same shape: a type word that IS part of the name. It is declared below.
 *
 * ── ⚠ THE SUFFIX SPELLING IS INCONSISTENT ──────────────────────────────────
 *
 * 1,546 `TWP` against 2 `TOWNSHIP`; 964 `BORO` against 3 `BOROUGH`; one `TOWN`.
 * Matching only the abbreviations silently leaves `TEMPLE  BOROUGH` and
 * `HARRIS TOWNSHIP` carrying a type word no other name has.
 *
 * ⚠ Many names also carry DOUBLE SPACES — `FRANKLIN  TWP`, `TEMPLE  BOROUGH`,
 * and `PHILADELPHIA  COUNTY` in the county report. Whitespace is collapsed
 * before anything else happens.
 */

/** The trailing type tokens DCED appends, longest spelling first. */
const TYPE_SUFFIX_RE = /\s+(TOWNSHIP|BOROUGH|COUNTY|TWP|BORO|CITY|TOWN)$/;

/**
 * ⚠ Governments whose trailing type word IS part of the name.
 *
 * Declared, not inferred, because nothing in the row distinguishes them: `OIL
 * CITY` and `CLAIRTON CITY` are the same shape and only one of them is the City
 * of Oil City.
 *
 * ⚠⚠ AND A DECLARED EXCEPTION THAT NAMES NOTHING EXCLUDES NOTHING. The first
 * draft of this entry carried the id `610203`, which is not Oil City. It was
 * well-formed, it named a plausible government, and it did nothing at all —
 * `OIL CITY` still rendered as `Oil`. Michigan shipped the identical shape and
 * found it only by reconciling a drop count. `assertExceptionsUsed()` below now
 * makes it impossible: every id here must match a row in the roster.
 */
export const NO_STRIP_IDS = Object.freeze({
  // Oil City, Venango County — the City of Oil City. Stripping gives "Oil".
  '610512': 'Oil City',
});

/**
 * ⚠ Names where title-casing produces the wrong letters.
 *
 * The `Mc` prefix is handled by RULE rather than by listing — see `titleCase`,
 * where one deterministic rule gets all sixteen `MC*` names right. Only these
 * two need declaring, and both were found by measurement rather than guessed.
 */
export const TITLE_CASE_EXCEPTIONS = Object.freeze({
  'S.N.P.J.': 'S.N.P.J.',   // a borough of 18 people; an acronym, not a word
  DUBOIS: 'DuBois',         // the City of DuBois capitalises its second syllable
});

/**
 * DCED `Municipality Type` -> TT `entity_type`.
 *
 * ⚠⚠ `borough` IS A NEW TT ENTITY TYPE, added for Pennsylvania's 968 boroughs
 * on Chris's call 2026-09-03. It mirrors Michigan's `village`: a sub-city
 * incorporated place that deserves its own label rather than being flattened
 * into `city`. It MUST be present in every `CITY_TIER_TYPES` set or coverage
 * matching silently stops finding boroughs — the defect Michigan's #131 found
 * for townships, where 1,240 governments could never match anything.
 *
 * ⚠ Both township classes map to one `entity_type`. First and second class is a
 * governance distinction (91 vs 1,457), not a different kind of place, and TT
 * already holds 1,251 Michigan townships under this value.
 */
export const TYPE_MAP = Object.freeze({
  City: 'city',
  Borough: 'borough',
  'First Class Township': 'township',
  'Second Class Township': 'township',
});

/** Which types get their county appended unconditionally. */
export const ALWAYS_QUALIFY = Object.freeze(new Set(['township']));

/**
 * ⚠ Bloomsburg is Pennsylvania's ONLY incorporated town. DCED types it
 * `Borough` while its published name says `BLOOMSBURG TOWN`; the Commonwealth
 * charters it as a town. TT already has a `town` entity_type (35 rows), so the
 * honest value is available and is used.
 */
export const TYPE_OVERRIDE_IDS = Object.freeze({
  '190153': 'town',   // BLOOMSBURG TOWN, Columbia County
});

/**
 * ⚠ Rows already in `treasury.municipalities` before this sweep, with budget
 * rows attached. The generator asserts it reproduces each name EXACTLY; a
 * one-character drift creates a second row and orphans the first.
 *
 * ⚠⚠ `State College` is currently typed `municipality` — the legacy Plano-era
 * Texas value. Chris's call 2026-09-03: NORMALISE IT IN PLACE to `borough`,
 * keeping the same row id, so PA ships one consistent convention and $0 moves.
 * `scripts/seedPaStatewide.mjs` does that update and asserts exactly one
 * State College row survives it.
 */
export const PA_EXISTING_TT_NAMES = Object.freeze([
  'Philadelphia',
  'State College',
  'Centre County',
]);

/**
 * ⚠⚠ COUNTY-PART STUBS FOR BOROUGHS THAT STRADDLE A COUNTY LINE.
 *
 * A Pennsylvania borough may lie in two counties, and DCED's Municipality ID
 * encodes the county in its first two digits — so ONE government gets TWO ids.
 * The minor part files a stub and the real filing sits under the major part:
 *
 *   ELLWOOD CITY BORO   370093 Lawrence  FY2015-2024, revenue $15-24M each year
 *                       040553 Beaver    FY2015 ONLY, revenue **$1**, population 0
 *   TUNNELHILL BORO     111683 Cambria   FY2015-2024, revenue $72-111k each year
 *                       070613 Blair     FY2015 ONLY, revenue **$1**, population 0
 *
 * ⚠ Both stubs are marked APPROVED, so the approval axis does not catch them,
 * and both disappear from the report entirely after FY2015.
 *
 * ⚠⚠ THIS IS NOT THE MILLEDGEVILLE RULE. That rule forbids hiding a VERIFIED
 * figure because it looks outlandish. A $1 revenue against 0 population is not
 * this government's finances at all — it is a county-part placeholder, and
 * loading it would list the SAME borough twice under two names, once with $1.
 * The government's real money is loaded in full under the other id.
 *
 * ⚠ `PLEASANTVILLE BORO` (050783 Bedford) and `FAIRVIEW BORO` (250363 Erie) are
 * the same shape but need no entry: they have ZERO approved years, so the
 * approval axis already excludes them.
 */
export const PLACEHOLDER_IDS = Object.freeze({
  '040553': 'Ellwood City county-part stub (Beaver): $1 revenue, 0 population, FY2015 only; '
    + 'the borough files in full under 370093 (Lawrence County)',
  '070613': 'Tunnelhill county-part stub (Blair): $1 revenue, 0 population, FY2015 only; '
    + 'the borough files in full under 111683 (Cambria County)',
});

/**
 * ⚠⚠ COUNTIES WITH NO SEPARATE GOVERNMENT TO LINK TO.
 *
 * `PHILADELPHIA  COUNTY` (510001, and yes it carries a double space) exists in
 * the county report for all ten years with a status of BLANK and revenue and
 * expenditure of ZERO — it never files, because Philadelphia is a consolidated
 * city-county and `PHILADELPHIA CITY` (510012) IS the county government.
 *
 * So Philadelphia's `County Name` names a county that has no TT row, exactly as
 * Jacksonville's names Duval in the Florida sweep. The link is left null with a
 * stated reason rather than pointing at a government that does not exist.
 */
export const PA_CONSOLIDATED = Object.freeze({
  'Philadelphia County': 'consolidated with the City of Philadelphia in 1854; Philadelphia files as '
    + 'the county government and the DCED county row (510001) is an empty placeholder that never files',
});

/**
 * ⚠⚠ THE FISCAL-YEAR START MONTH.
 *
 * Pennsylvania's local governments are overwhelmingly CALENDAR-year, and DCED's
 * own form is calendar-framed throughout ("Fund Balance/Retained Earnings
 * 12/31"). The federal audit record agrees: **611 of the 643 PA rows are month
 * 1.**
 *
 * ⚠ Within FY2015-FY2024 exactly ONE Pennsylvania municipality runs a different
 * year — **Philadelphia, month 7** — and that was settled by ORACLE rather than
 * argument in PR #113: DCED's Reporting Year 2023 `Total Taxes Revenues` of
 * $5,160,574,000 ties to the DOLLAR against the ACFR for the year ended June 30
 * 2023. DCED's "Reporting Year" IS the entity's own fiscal year; the 12/31
 * wording is boilerplate.
 *
 * Every other in-window exception in the census dissolves on inspection:
 *   Reading           month 1 for 1998-2009 and 2011-2024, month 7 for 2010 ALONE
 *                     — two rows, so the census reports a changeover and resolves
 *                     nothing, which is correct.
 *   Pennsburg Borough month 7 only in 2025, outside this window.
 *   Salisbury Twp / Unity Twp / Fairchance   month 7 or 8 only in 2001-2002.
 *
 * ⚠⚠ AND SEVERAL "PA" CENSUS ROWS ARE NOT PENNSYLVANIA GOVERNMENTS AT ALL:
 * `Nhs Bucks County`, `Nhs Chester County`, `The Arc Lackawanna County` and
 * `Lackawanna Transit System County` are nonprofits and authorities whose
 * auditee names merely END in "County", and `Hampstead` and `New Windsor` are
 * Maryland towns. A name-only lookup would hand a county government another
 * organisation's fiscal year.
 */
export const PA_DEFAULT_FISCAL_MONTH = 1;

export const FISCAL_MONTH_IDS = Object.freeze({
  // Philadelphia — oracle-confirmed against its own ACFR, PR #113.
  '510012': 7,
});

/**
 * May the federal audit census be consulted for this entity at all?
 *
 * ⚠⚠ NO, IF THE NAME NEEDED COUNTY QUALIFICATION. `Salisbury Township` names
 * more than one Pennsylvania township and the census records no county, so a
 * lookup cannot tell them apart. Michigan proved what happens next: `buildCensus`
 * merges two governments into one entry whose two months read as a fiscal-year
 * change that never happened. **A wrong CONFIRMATION is worse than no evidence**,
 * so the lookup is REFUSED and reported separately from "uncovered".
 */
export function censusMayName(entity) {
  return !entity.qualified;
}

/** Collapse whitespace. Applied before anything else looks at a name. */
export function tidy(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Strip ONE trailing type token.
 * ⚠ Never loops. `GROVE CITY BORO` -> `GROVE CITY`, and that is the answer.
 */
export function stripTypeSuffix(name) {
  return tidy(tidy(name).replace(TYPE_SUFFIX_RE, ''));
}

/**
 * ALL CAPS -> a name a reader should see.
 *
 * ⚠ The `Mc` rule is deterministic and was verified against all sixteen `MC*`
 * names in the corpus (McSherrystown, East McKeesport, McCandless, McKees Rocks,
 * McKeesport, McKean, McConnellsburg, McCalmont, McHenry, McIntyre, McNett,
 * McVeytown, McEwensville, McAdoo, McClure, McDonald) — every one correct.
 *
 * ⚠ Hyphenated segments are cased individually so `VALLEY-HI` becomes
 * `Valley-Hi` rather than `Valley-hi`.
 *
 * ⚠ ABBREVIATIONS ARE NOT EXPANDED. `MT JOY TWP` becomes `Mt Joy Township`, not
 * `Mount Joy Township`. Expanding is a rewrite of the publisher's string and can
 * be wrong; re-casing is deterministic and reversible. This is the same line
 * `stripAccountCode` draws for Florida.
 */
export function titleCase(name) {
  const t = tidy(name);
  if (TITLE_CASE_EXCEPTIONS[t]) return TITLE_CASE_EXCEPTIONS[t];
  return t
    .split(' ')
    .map((word) => word
      .split('-')
      .map((seg) => {
        if (!seg) return seg;
        // An acronym like S.N.P.J. keeps its shape.
        if (/^(?:[A-Z]\.)+$/.test(seg)) return seg;
        const lower = seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
        return lower.replace(/^Mc([a-z])/, (_, c) => `Mc${c.toUpperCase()}`);
      })
      .join('-'))
    .join(' ');
}

/** `BERKS` -> `Berks County`. */
export function countyDisplayName(countyName) {
  const bare = titleCase(stripTypeSuffix(countyName));
  return bare ? `${bare} County` : '';
}

/**
 * The base display name for one municipal row, before collision qualification.
 *
 * @param {{id:string, name:string, entityType:string}} rec
 */
export function baseDisplayName(rec) {
  if (NO_STRIP_IDS[rec.id]) return NO_STRIP_IDS[rec.id];
  return titleCase(stripTypeSuffix(rec.name));
}

/** `Franklin` + `Allegheny County` -> `Franklin Township, Allegheny County`. */
export function qualifiedName(base, entityType, county) {
  const kind = entityType === 'township' ? ' Township' : '';
  return `${base}${kind}, ${county}`;
}

/** A township's unqualified rendering, for the rare case it is not needed. */
export function townshipName(base) {
  return `${base} Township`;
}

/**
 * ⚠⚠ Every declared exception must actually match a government.
 *
 * Called by the generator over the full roster. A stale id here is not a
 * harmless leftover: it silently restores the very defect the entry exists to
 * prevent, and nothing else in the pipeline notices.
 *
 * @param {{id:string}[]} records
 */
export function assertExceptionsUsed(records) {
  const ids = new Set(records.map((r) => String(r.id)));
  const problems = [];
  for (const id of Object.keys(NO_STRIP_IDS)) {
    if (!ids.has(id)) {
      problems.push(`NO_STRIP_IDS names id ${id} (${NO_STRIP_IDS[id]}), which is in no roster row — `
        + 'the exception excludes nothing and the type word will be stripped anyway.');
    }
  }
  for (const id of Object.keys(TYPE_OVERRIDE_IDS)) {
    if (!ids.has(id)) {
      problems.push(`TYPE_OVERRIDE_IDS names id ${id}, which is in no roster row.`);
    }
  }
  for (const id of Object.keys(PLACEHOLDER_IDS)) {
    if (!ids.has(id)) {
      problems.push(`PLACEHOLDER_IDS names id ${id}, which is in no roster row — the exclusion `
        + 'excludes nothing and a $1 stub would load as a government.');
    }
  }
  return problems;
}

/**
 * ⚠ And every title-case exception must still be reachable, for the same reason.
 * @param {{name:string}[]} records
 */
export function assertTitleExceptionsUsed(records) {
  const stems = new Set(records.map((r) => stripTypeSuffix(r.name)));
  return Object.keys(TITLE_CASE_EXCEPTIONS)
    .filter((k) => !stems.has(k))
    .map((k) => `TITLE_CASE_EXCEPTIONS names ${JSON.stringify(k)}, which no roster name strips to.`);
}

/**
 * Assign a final display name to every municipal record.
 *
 * Townships are always county-qualified. A city or borough is qualified ONLY
 * when its base name would collide with another government of the same
 * entity_type — computed from the data, so a future year that introduces a new
 * collision is handled without editing a list.
 *
 * @param {{id:string, name:string, type:string, county:string}[]} records
 * @returns {{id:string, displayName:string, entityType:string, county:string,
 *            qualified:boolean, base:string}[]}
 */
export function assignDisplayNames(records) {
  const staged = records.map((r) => {
    const entityType = TYPE_OVERRIDE_IDS[r.id] || TYPE_MAP[r.type];
    if (!entityType) throw new Error(`Unknown DCED Municipality Type ${JSON.stringify(r.type)} for ${r.id}`);
    const county = countyDisplayName(r.county);
    if (!county) throw new Error(`Row ${r.id} (${r.name}) has no County Name`);
    return { id: r.id, base: baseDisplayName({ ...r, entityType }), entityType, county };
  });

  // ⚠ Collision is measured on the DISPLAY NAME ALONE, not on
  // (name, entity_type). The database would tolerate `Franklin` twice because
  // the two governments differ in type — Franklin Borough in Cambria County and
  // the City of Franklin in Venango County — but a READER seeing two identical
  // `Franklin` entries cannot tell which is which. Exactly one such pair exists
  // in the corpus, so qualifying on the name alone costs two names and removes
  // the ambiguity. State College and Philadelphia are unique and stay bare.
  const seen = new Map();
  for (const s of staged) seen.set(s.base, (seen.get(s.base) || 0) + 1);

  return staged.map((s) => {
    const collides = seen.get(s.base) > 1;
    const mustQualify = ALWAYS_QUALIFY.has(s.entityType) || collides;
    const displayName = mustQualify
      ? qualifiedName(s.base, s.entityType, s.county)
      : s.base;
    return { ...s, displayName, qualified: mustQualify };
  });
}
