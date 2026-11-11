/**
 * ⚠⚠⚠ 24,354 BUDGETS CITED A STATEWIDE DATASET AS THEIR SOURCE.
 *
 * Every CA State Controller budget — 480 cities and 57 counties, FY2003-2025 —
 * carried one of four URLs:
 *
 *     https://bythenumbers.sco.ca.gov/d/ju3w-4gxp     (city expenditures)
 *     https://bythenumbers.sco.ca.gov/d/rrtv-rsj9     (city revenues)
 *     https://bythenumbers.sco.ca.gov/d/uctr-c2j8     (county expenditures)
 *     https://bythenumbers.sco.ca.gov/d/emxv-k8xv     (county revenues)
 *
 * A reader of Torrance's FY2023 page clicked "source" and arrived at a grid of
 * every city in California for every year. The figure was traceable in
 * principle and untraceable in practice, which is #380's lesson one level up:
 * a landing page is not a weaker citation, it is a wrong one.
 *
 * ⭐ THE PUBLISHER HAS A PER-ENTITY VIEW AND IT TIES TO THE CENT. The SCO runs
 * cities.bythenumbers.sco.ca.gov and counties.bythenumbers.sco.ca.gov, and
 * their own totals for an entity-year equal what TT stores: 24,352 of 24,354
 * matched exactly on 2026-11-11 (the two that did not were a real defect — see
 * the Berkeley note in the migration).
 *
 * ── ⚠⚠ WHY THESE CANNOT BE LIVENESS-CHECKED, AND WHAT REPLACES IT ─────────
 *
 * The per-entity view is an Angular `#!` route. A fragment NEVER REACHES THE
 * SERVER, so the host answers every one of these with the same 236,927-byte
 * shell — measured against a real entity, a fake entity and complete nonsense,
 * all identical. An HTTP probe therefore cannot tell a correct citation from a
 * typo, and 24,354 of them would add hours to every `verify:source-urls` run
 * and ~24k requests to a state government site to learn nothing.
 *
 * ⛔ So this family is exempt from per-URL liveness and verified a STRONGER
 * way instead: `scoTieCensus()` asks the publisher's own totals API — one call
 * per (year, branch, corpus), 92 in all — and compares every stored figure to
 * the publisher's. A 200 says a server answered; a tie says the number is
 * theirs.
 */

export const SCO_DATASET_PAGES = Object.freeze([
  'https://bythenumbers.sco.ca.gov/d/ju3w-4gxp',
  'https://bythenumbers.sco.ca.gov/d/rrtv-rsj9',
  'https://bythenumbers.sco.ca.gov/d/uctr-c2j8',
  'https://bythenumbers.sco.ca.gov/d/emxv-k8xv',
]);

export const SCO_ENTITY_HOSTS = Object.freeze([
  'cities.bythenumbers.sco.ca.gov',
  'counties.bythenumbers.sco.ca.gov',
]);

/** cities vs counties is a different SUBDOMAIN, not a query parameter. */
export function scoCorpus(entityType) {
  return entityType === 'county' ? 'counties' : 'cities';
}

/**
 * ⚠ The publisher labels a county "Merced", not "Merced County". Getting this
 * wrong silently yields a page with no entity on it — and since the shell
 * answers 200 regardless, nothing downstream would notice. All 57 counties in
 * this corpus carry the " County" suffix in TT; all 537 labels matched the
 * publisher after stripping it.
 */
export function scoOrg1(name, entityType) {
  const n = String(name || '').trim();
  return entityType === 'county' ? n.replace(/\s+County$/i, '') : n;
}

/** `operating` and `revenue` are the app's own route segments. Verified: a
 * guessed segment (`revenues`, `funding`, `income`) renders a page with the
 * entity absent, at HTTP 200. */
export function scoBranch(datasetType) {
  return datasetType === 'revenue' ? 'revenue' : 'operating';
}

export function scoEntityUrl({ entityName, entityType, fiscalYear, datasetType }) {
  // ⚠ The migration's FENCE 1 refuses a county whose name does not carry the
  // " County" suffix, because stripping it is how the publisher's label is
  // derived. This mirrors that exactly: SQL and JS are two implementations of
  // one rule, and letting them disagree is how reader_link_census() went stale.
  if (entityType === 'county' && !/\s+County$/i.test(String(entityName || '').trim())) {
    throw new Error(`scoEntityUrl: county name ${JSON.stringify(entityName)} does not end in " County"`);
  }
  const org1 = scoOrg1(entityName, entityType);
  if (!org1) throw new Error('scoEntityUrl: empty entity name');
  if (!/^\d{4}$/.test(String(fiscalYear))) {
    throw new Error(`scoEntityUrl: fiscal year ${fiscalYear} is not four digits`);
  }
  return `https://${scoCorpus(entityType)}.bythenumbers.sco.ca.gov/#!/year/${fiscalYear}`
    + `/${scoBranch(datasetType)}/0/entity_name/${encodeURIComponent(org1)}/0/category`;
}

/** The shape the migration writes, so a test can hold SQL and JS to one rule. */
export const SCO_ENTITY_URL_RE =
  /^https:\/\/(cities|counties)\.bythenumbers\.sco\.ca\.gov\/#!\/year\/\d{4}\/(operating|revenue)\/0\/entity_name\/[^/\s]+\/0\/category$/;

export function isScoEntityUrl(url) {
  return typeof url === 'string' && SCO_ENTITY_URL_RE.test(url);
}

/**
 * Compare stored totals to the publisher's own.
 *
 * `rows`:  { id, entityName, entityType, fiscalYear, datasetType, total }
 * `published`: Map of `${corpus}|${branch}|${year}|${org1}` -> Number
 *
 * ⚠ An entity-year the publisher does not list is `absent`, never a mismatch.
 * The SCO simply has no filing for some entity-years, and calling that a
 * disagreement would invent failures — #373's distinction again.
 */
export function judgeScoTie(rows, published) {
  const tie = [];
  const mismatch = [];
  const absent = [];
  for (const r of rows) {
    const key = `${scoCorpus(r.entityType)}|${scoBranch(r.datasetType)}|${r.fiscalYear}`
      + `|${scoOrg1(r.entityName, r.entityType)}`;
    const pub = published.get(key);
    if (pub === undefined || pub === null) { absent.push(r); continue; }
    if (Math.round(Number(pub)) === Math.round(Number(r.total))) tie.push(r.id);
    else mismatch.push({ ...r, publisher: Math.round(Number(pub)), diff: Math.round(Number(pub)) - Math.round(Number(r.total)) });
  }
  return { checked: rows.length, tie: tie.length, mismatch, absent };
}

export function scoTieIsClean(t) {
  return t.mismatch.length === 0;
}

/** One request per (corpus, branch, year) returns EVERY entity's total for it. */
export function scoTotalsUrl(corpus, branch, year) {
  return `https://${corpus}.bythenumbers.sco.ca.gov/api/${branch === 'revenue' ? 'revenue' : 'opex'}`
    + `/chart_data.json?page=0&limit=1000&sort_field=total&sort=desc&year=${year}&child_entity=org1`;
}
