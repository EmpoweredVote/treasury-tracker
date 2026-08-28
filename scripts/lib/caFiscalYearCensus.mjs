/**
 * The EVIDENCED census of California municipal fiscal-year calendars.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * California sets NO municipal fiscal year by statute, so every CA city's
 * calendar is a fact to be read off a document, never derived from a rule. The
 * previous pass scoped that audit to the 121 CHARTER cities, on the reasoning
 * that only a charter city has an instrument to deviate from July–June.
 *
 * ⚠⚠ THAT SCOPE WAS WRONG, AND THIS CENSUS IS WHAT PROVED IT. Of the three CA
 * cities found running an October fiscal year in this pass, TWO ARE NOT CHARTER
 * CITIES: South Lake Tahoe (October in every year observed) and El Segundo
 * (October through FY2021). Neither would ever have been examined. Do not
 * re-scope a California fiscal-calendar question to charter cities.
 *
 * ── The oracle ──────────────────────────────────────────────────────────────
 * `docs/CA/fac-ca-city-fiscal-year-ends.csv` is an extract from the FEDERAL
 * AUDIT CLEARINGHOUSE (api.fac.gov), which publishes the audited fiscal PERIOD
 * of every Single Audit filed under the Uniform Guidance. The period is the
 * auditee's own submission — a first-party statement of its fiscal year, filed
 * under federal penalty, for every city that expends >= $750k of federal awards.
 *
 * It was rebuilt with:
 *
 *   curl -H "X-Api-Key: $FAC_API_KEY" \
 *     'https://api.fac.gov/general?auditee_state=eq.CA
 *        &entity_type=in.(local,"local government")
 *        &select=auditee_name,fy_start_date,fy_end_date,audit_year,audit_period_covered
 *        &order=auditee_name.asc,audit_year.asc&limit=1000&offset=N'
 *
 * then filtered to auditees named `CITY OF …` / `TOWN OF …` / `CITY AND COUNTY
 * OF …`. `DEMO_KEY` works for small pulls and is rate-limited to 30/hour.
 *
 * ⚠ VALIDATED AGAINST KNOWN CASES BEFORE IT WAS TRUSTED. The census reproduces
 * Inglewood and Long Beach as September-30 cities — the two carve-outs already
 * evidenced by hand from their ACFRs (PRs #60, #68) — without being told. A
 * gate that cannot rediscover what you already know is not a gate.
 *
 * ── What this census DOES NOT cover (state the gaps, never imply completeness) ─
 *   (a) FY2016 EARLIEST. The FAC dissemination data begins at audit year 2016,
 *       and TT holds CA rows back to FY2003. A city that changed its fiscal year
 *       BEFORE 2016 shows only its post-change calendar here. Huntington Beach
 *       is the proof that such changes happen; it changed in 2017 and was caught
 *       only because that is inside the window.
 *   (b) TOWNS ARE NOT YET INCLUDED. The pull was truncated by the DEMO_KEY rate
 *       limit before the `TOWN OF …` block, so ~20 CA towns are absent. Truckee,
 *       the only CHARTER town, was evidenced separately from its own ACFR series
 *       ("for the fiscal year ended June 30", 2006-07 through 2024-25). Close
 *       this by re-running the query above with `&auditee_name=ilike.town of*`.
 *   (c) CITIES BELOW THE $750k FEDERAL THRESHOLD NEVER FILE. Sand City is the
 *       one charter city this pass could not evidence at all — it files no
 *       Single Audit, publishes no audited statements online, and its code host
 *       refuses automated fetches. It is recorded as UNEVIDENCED, not as July.
 *
 * ⚠ ABSENCE FROM THE NON-JUNE LIST IS EVIDENCE ONLY FOR THE YEARS OBSERVED.
 * It is not a claim about a year outside the audit window.
 */

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

/** The committed FAC extract this census is derived from. */
export const EVIDENCE_CSV = path.resolve(HERE, '..', '..', 'docs', 'CA', 'fac-ca-city-fiscal-year-ends.csv');

/** The audit years the extract covers. A finding outside this range is unproven. */
export const WINDOW = { firstAuditYear: 2016, lastAuditYear: 2025 };

/**
 * Measured when the census was built. A refreshed CSV that moves these is not a
 * silent improvement — it means the federal record changed and the non-June set
 * must be re-read.
 */
export const BASELINE = { records: 2624, auditees: 427, nonJulyCities: 5 };

/**
 * The one charter city with no evidence of any kind.
 *
 * ⚠ It sits at month 7 in the database and is LEFT there — this pass did not
 * move it, because moving an unevidenced row is exactly the failure the whole
 * arc exists to prevent. It is named so the gap is visible.
 */
export const UNEVIDENCED = [
  {
    name: 'Sand City', state: 'CA', charter: true, storedMonth: 7,
    why: 'Files no Single Audit (population ~350, far below the $750k federal '
      + 'threshold); publishes no audited financial statements online; '
      + 'codepublishing.com and municipal.codes both refuse automated fetches. '
      + 'Its own FY 24-25 budget uses split-year labelling and reports balances '
      + '"as of June 30, 2024", which SUGGESTS July–June but does not state it.',
  },
];

/** Auditee-name forms that are NOT a municipality and must not enter the census. */
const NOT_A_CITY = [/HOUSING AUTHORITY/i, /SUCCESSOR AGENCY/i, /FINANCING AUTHORITY/i];

/** `CITY OF SANTA ANA` -> `Santa Ana`. Returns null for non-municipal auditees. */
export function cityNameFromAuditee(auditee) {
  if (typeof auditee !== 'string') return null;
  if (NOT_A_CITY.some((p) => p.test(auditee))) return null;
  const m = /^(?:CITY AND COUNTY OF|CITY OF|TOWN OF)\s+(.+?)(?:,?\s*CALIFORNIA)?$/i.exec(auditee.trim());
  if (!m) return null;
  return m[1].trim().toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Parse the committed extract. Deliberately strict — a malformed row throws. */
export function readEvidence(csvPath = EVIDENCE_CSV) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines.shift();
  if (header !== 'auditee,audit_year,fy_start_date,fy_end_date,audit_period_covered') {
    throw new Error(`unexpected header in ${csvPath}: ${header}`);
  }
  return lines.map((line, i) => {
    const [auditee, auditYear, fyStart, fyEnd, period] = line.split(',');
    if (!auditee || !/^\d{4}$/.test(auditYear ?? '')) {
      throw new Error(`malformed record at line ${i + 2} of ${csvPath}: ${line}`);
    }
    return { auditee, auditYear: Number(auditYear), fyStart, fyEnd, period };
  });
}

/**
 * The census: city -> the fiscal-year START months its audited periods imply,
 * with the years each was observed.
 *
 * ⚠ The START month is derived from the period END, not from `fy_start_date`.
 * The FAC's start dates are unreliable — many records carry the PRIOR period's
 * end date (e.g. `2016-09-30 -> 2017-09-30`), and Torrance FY2020 reads
 * `2019-07-02 -> 2020-07-01`, a one-day-shifted transcription of an ordinary
 * July–June year. The END date is the audited fact; the start month follows.
 */
export function buildCensus(records = readEvidence()) {
  const census = new Map();
  for (const r of records) {
    if (r.period !== 'annual') continue;
    const city = cityNameFromAuditee(r.auditee);
    if (!city) continue;
    const endMonth = Number((r.fyEnd ?? '').slice(5, 7));
    if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) continue;
    // A period ending in month M began in month M+1 of the prior year.
    const startMonth = (endMonth % 12) + 1;
    const entry = census.get(city) ?? { name: city, byMonth: new Map(), auditYears: [] };
    const years = entry.byMonth.get(startMonth) ?? [];
    years.push(r.auditYear);
    entry.byMonth.set(startMonth, years);
    entry.auditYears.push(r.auditYear);
    census.set(city, entry);
  }
  return census;
}

/**
 * Every city whose audited periods imply a fiscal year NOT starting in July.
 *
 * This is the list that must stay in lockstep with the exception registry: a
 * city that appears here and is not declared in `caCityFiscalExceptions.mjs` is
 * a fiscal calendar nobody has acted on.
 *
 * ⚠ Torrance's stray `2020-07-01` end date is a transcription artefact, not an
 * August fiscal year. A month seen in exactly ONE audit year is not treated as a
 * calendar, so a city whose only non-July month is such a stray drops out of
 * this list entirely — Torrance does, and it is genuinely July–June. Any city
 * that KEEPS a real non-July calendar reports its stray years alongside it.
 */
export function nonJulyCities(census = buildCensus()) {
  const out = [];
  for (const entry of census.values()) {
    const months = [...entry.byMonth.entries()]
      .map(([month, years]) => ({ month, years: years.slice().sort() }))
      .sort((a, b) => b.years.length - a.years.length);
    const real = months.filter((m) => m.years.length > 1 || m.month !== 8);
    const stray = months.filter((m) => !real.includes(m));
    if (real.length === 1 && real[0].month === 7 && stray.length === 0) continue;
    if (real.every((m) => m.month === 7)) continue;
    out.push({
      name: entry.name,
      months: real,
      strayYears: stray.flatMap((m) => m.years),
      changed: real.length > 1,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The audit years in which a city's implied start month DIFFERS from the year
 * before — i.e. the year its calendar changed over.
 *
 * ⚠⚠ THE CENSUS IS BLIND IN EXACTLY THIS YEAR, and the lockstep test found it.
 * `buildCensus` derives a start month from the period END, because that is the
 * audited fact. In a changeover year that inference is WRONG: Huntington Beach's
 * FY2018 audit ends 2018-06-30, so the census reads "starts in July", but the
 * period is the NINE-MONTH stub that began 2017-10-01 and therefore starts in
 * October. A period's end does not tell you its length.
 *
 * So a changeover year is the one year where the census must defer to a document
 * that states the period outright. Every other year it can stand on its own.
 */
export function changeoverYears(entry) {
  const byYear = new Map();
  for (const [month, years] of entry.byMonth ?? []) for (const y of years) byYear.set(y, month);
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < years.length; i += 1) {
    if (byYear.get(years[i]) !== byYear.get(years[i - 1])) out.push(years[i]);
  }
  return out;
}
