/**
 * A first-party census of LOCAL GOVERNMENT fiscal calendars, per state, built
 * from the Federal Audit Clearinghouse.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * Every government expending >= $750k of federal awards files a Single Audit,
 * and the FAC publishes the AUDITED PERIOD of that filing. The period is the
 * auditee's own submission, made under federal penalty — a first-party statement
 * of its fiscal year. Censusing it answers "what calendar does this entity run"
 * for a whole state at once, instead of one charter or ACFR at a time.
 *
 * The extracts under `docs/<STATE>/fac-<state>-...csv` are built from the FAC's
 * BULK download, which needs no API key and has no rate limit:
 *
 *     https://app.fac.gov/dissemination/public-data/gsa/full/general.csv
 *
 * (~266 MB, ~413k rows, audit years 2016+; it 302-redirects to a presigned S3
 * URL valid for 30 seconds, so follow redirects and use GET — a HEAD request is
 * signed differently and 403s. `api.fac.gov` serves the same table but needs a
 * key and `DEMO_KEY` is capped at 30/hour, 50/day.)
 *
 * ── Why a state's "usual" month is never the answer ─────────────────────────
 * This census exists because the *generalisation* keeps being wrong:
 *
 *   CA — "cities are July"          → 5 municipalities run October, and TWO OF
 *                                     THEM ARE GENERAL-LAW cities, so the
 *                                     charter-city framing missed them entirely.
 *   TX — "locals are October"       → 581 of 647 are, but 66 ARE NOT, including
 *                                     HOUSTON (July) and EL PASO (September),
 *                                     the state's 2nd and 6th largest cities,
 *                                     and 42 entities on a JANUARY calendar —
 *                                     mostly counties.
 *   MD — "locals are July"          → all 74 observed entities are, and that is
 *                                     a MEASUREMENT, not an assumption. It is
 *                                     the first state in this arc where the
 *                                     generalisation actually held.
 *
 * ⚠ So a state-wide `CORRECT_MONTH` is a DEFAULT, never a fact about an entity.
 * `censusMonthFor()` is the fact. Consult it before applying any default.
 *
 * ── What a census CANNOT tell you ───────────────────────────────────────────
 *   (a) Coverage begins at audit year 2016. A calendar change made earlier is
 *       invisible. (Huntington Beach's 2017 change was caught only because it
 *       falls inside the window.) FAC publishes a separate HISTORIC file for
 *       1998-2015 which would close this; it is not yet loaded.
 *   (b) An entity below the $750k federal threshold never files, so absence
 *       from the census is NOT evidence of the usual calendar.
 *   (c) A period's END does not reveal its LENGTH. In a changeover year the
 *       audit covers a SHORT stub that still begins in the OLD month, so the
 *       month inferred here is wrong in exactly that year — see
 *       `changeoverYears()`.
 *
 * ⚠ The federal record is not clean, and every filter below exists because
 * something real got through: `auditee_state` said CA for "CITY OF GROTON,
 * CONNECTICUT" and TX for Alamogordo and Santa Fe NM and Tulsa OK (all now
 * excluded by ZIP); housing commissions, MHMR authorities and community
 * supervision departments arrive shaped like counties; and the same entity
 * appears in both UPPER CASE and Mixed Case across years.
 */

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const REPO = path.resolve(HERE, '..', '..');

/**
 * Per-state configuration.
 *
 * `dominantMonth` is the state's MODAL calendar — useful for reporting which
 * entities are exceptional, and never to be used as an entity's month.
 */
export const STATES = {
  CA: {
    state: 'CA',
    csv: path.join(REPO, 'docs', 'CA', 'fac-ca-city-fiscal-year-ends.csv'),
    dominantMonth: 7,
    kinds: ['municipality'],
    // CA counties are settled by statute — Cal. Gov. Code § 29001(e), "'Budget
    // year' means the fiscal year (July 1 through June 30)" — and are cited in
    // scripts/lib/loaderFiscalCalendars.mjs, so they are not censused here.
    baseline: { records: 2678, entities: 439, exceptions: 5 },
  },
  TX: {
    state: 'TX',
    csv: path.join(REPO, 'docs', 'TX', 'fac-tx-local-fiscal-year-ends.csv'),
    dominantMonth: 10,
    kinds: ['municipality', 'county'],
    baseline: { records: 2892, entities: 647, exceptions: 66 },
  },
  MD: {
    state: 'MD',
    csv: path.join(REPO, 'docs', 'MD', 'fac-md-local-fiscal-year-ends.csv'),
    dominantMonth: 7,
    kinds: ['municipality', 'county'],
    baseline: { records: 393, entities: 74, exceptions: 0 },
  },
};

/** The audit years every extract covers. A finding outside this is unproven. */
export const WINDOW = { firstAuditYear: 2016, lastAuditYear: 2026 };

const HEADER = 'entity,kind,audit_year,fy_start_date,fy_end_date,audit_period_covered';

/** Parse one committed extract. Deliberately strict — a malformed row throws. */
export function readEvidence(stateCode) {
  const cfg = STATES[stateCode];
  if (!cfg) throw new Error(`no census configured for ${stateCode}`);
  const text = fs.readFileSync(cfg.csv, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines.shift();
  if (header !== HEADER) throw new Error(`unexpected header in ${cfg.csv}: ${header}`);
  return lines.map((line, i) => {
    const [entity, kind, auditYear, fyStart, fyEnd, period] = line.split(',');
    if (!entity || !/^\d{4}$/.test(auditYear ?? '') || !cfg.kinds.includes(kind)) {
      throw new Error(`malformed record at line ${i + 2} of ${cfg.csv}: ${line}`);
    }
    return { entity, kind, auditYear: Number(auditYear), fyStart, fyEnd, period };
  });
}

/**
 * entity -> { kind, byMonth: Map(startMonth -> [auditYears]) }.
 *
 * ⚠ The start month is derived from the period END, not from `fy_start_date`.
 * The FAC's start dates are unreliable: many carry the PRIOR period's end
 * (`2016-09-30 -> 2017-09-30`), and Torrance FY2020 reads
 * `2019-07-02 -> 2020-07-01`, a one-day-shifted transcription of an ordinary
 * July-June year. The END is the audited fact; the start month follows from it.
 */
export function buildCensus(stateCode, records = readEvidence(stateCode)) {
  const census = new Map();
  for (const r of records) {
    if (r.period !== 'annual') continue;
    const endMonth = Number((r.fyEnd ?? '').slice(5, 7));
    if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) continue;
    const startMonth = (endMonth % 12) + 1;
    const entry = census.get(r.entity) ?? { name: r.entity, kind: r.kind, byMonth: new Map() };
    entry.byMonth.set(startMonth, [...(entry.byMonth.get(startMonth) ?? []), r.auditYear].sort());
    census.set(r.entity, entry);
  }
  return census;
}

/**
 * The audit years in which an entity's implied start month differs from the year
 * before — the year its calendar changed over.
 *
 * ⚠⚠ THE CENSUS IS BLIND IN EXACTLY THIS YEAR. A changeover produces a SHORT
 * period (Huntington Beach's was nine months, Oct 1 2017 - Jun 30 2018) whose
 * END is on the new calendar but whose START is still on the old one. A period's
 * end does not tell you its length, so a changeover year must be settled from a
 * document that states the period outright, never from this census.
 */
export function changeoverYears(entry) {
  const byYear = new Map();
  for (const [month, years] of entry.byMonth) for (const y of years) byYear.set(y, month);
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < years.length; i += 1) {
    if (byYear.get(years[i]) !== byYear.get(years[i - 1])) out.push(years[i]);
  }
  return out;
}

/**
 * A month seen in exactly ONE audit year, while another month is seen in several,
 * is a transcription artefact rather than a calendar — Torrance's stray
 * `2020-07-01`. Real calendars and real changeovers both persist.
 */
function realMonths(entry) {
  const months = [...entry.byMonth.entries()]
    .map(([month, years]) => ({ month, years }))
    .sort((a, b) => b.years.length - a.years.length);
  if (months.length < 2) return { real: months, stray: [] };
  const real = months.filter((m) => m.years.length > 1);
  if (real.length === 0) return { real: months.slice(0, 1), stray: months.slice(1) };
  return { real, stray: months.filter((m) => !real.includes(m)) };
}

/**
 * Every entity whose calendar is not the state's dominant month — i.e. every
 * entity for which applying the state default would be WRONG.
 */
export function exceptions(stateCode, census = buildCensus(stateCode)) {
  const { dominantMonth } = STATES[stateCode];
  const out = [];
  for (const entry of census.values()) {
    const { real, stray } = realMonths(entry);
    if (real.every((m) => m.month === dominantMonth)) continue;
    out.push({
      name: entry.name,
      kind: entry.kind,
      months: real.map((m) => ({ month: m.month, years: m.years })).sort((a, b) => a.months - b.months),
      strayYears: stray.flatMap((m) => m.years),
      changed: real.length > 1,
      changeoverYears: changeoverYears(entry),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What the census says one entity's fiscal year starts in, for one fiscal year.
 *
 * Returns `{ month, auditYears }`, or `{ unknown: reason }`. **`unknown` is not
 * a licence to apply the state default** — it means nobody has evidence, which
 * is exactly when a loader should refuse rather than guess.
 */
export function censusMonthFor(stateCode, entityName, fiscalYear) {
  const census = buildCensus(stateCode);
  const entry = census.get(entityName);
  if (!entry) {
    return { unknown: `${entityName}, ${stateCode} filed no Single Audit in ${WINDOW.firstAuditYear}-`
      + `${WINDOW.lastAuditYear} (or spends under the $750k federal threshold). Absence is not `
      + `evidence of month ${STATES[stateCode].dominantMonth} — read a document.` };
  }
  const { real } = realMonths(entry);
  if (fiscalYear === undefined || fiscalYear === null) {
    if (real.length > 1) {
      return { unknown: `${entityName}, ${stateCode} CHANGED its fiscal year `
        + `(${real.map((m) => `month ${m.month} in ${m.years.join('/')}`).join('; ')}) — `
        + 'a month cannot be resolved without a fiscal year' };
    }
    return { month: real[0].month, auditYears: real[0].years };
  }
  const fy = Number(fiscalYear);
  if (!Number.isInteger(fy)) return { unknown: `unparseable fiscal year ${JSON.stringify(fiscalYear)}` };
  if (changeoverYears(entry).includes(fy)) {
    return { unknown: `FY${fy} is ${entityName}'s CHANGEOVER year: the audited period ends on the `
      + 'new calendar but begins on the old one, and its length is not recorded here. '
      + 'Read the entity\'s own statements for that year.' };
  }
  for (const m of real) if (m.years.includes(fy)) return { month: m.month, auditYears: m.years };
  // Outside the observed years: report the surrounding evidence, do not extrapolate.
  const nearest = real.find((m) => m.years.some((y) => y > fy)) ?? real[real.length - 1];
  return { unknown: `FY${fy} is outside the audited years for ${entityName} `
    + `(observed ${real.map((m) => `month ${m.month}: ${m.years[0]}-${m.years[m.years.length - 1]}`).join('; ')}). `
    + `Nearest evidence says month ${nearest.month}, but this census does not extrapolate.` };
}

/**
 * The guard a loader should call before writing a fiscal-year start month.
 *
 * Returns `{ ok: true }` when the census has no evidence for this entity/year —
 * silence is not disagreement — and `{ error }` when the month about to be
 * written CONTRADICTS the entity's own federally filed audit.
 *
 * ⚠ This exists because a loader takes ONE month for a whole multi-entity run.
 * Loading Texas with `10` is right 581 times out of 647 and WRONG for Houston,
 * El Paso and 42 January counties — and nothing would fail, because this column
 * moves no dollar and every tie test would still pass at $0. That is exactly how
 * a hardcoded month survived four milestones.
 */
export function censusGuard(entityName, stateCode, month, fiscalYear) {
  if (!STATES[stateCode]) return { ok: true };                 // no census for this state yet
  if (month === undefined || month === null) return { ok: true };
  const seen = censusMonthFor(stateCode, entityName, fiscalYear);
  if (seen.unknown) return { ok: true, unknown: seen.unknown };
  if (Number(month) === seen.month) return { ok: true, month: seen.month };
  return {
    error: `month ${month} contradicts the federal audit record for ${entityName}, ${stateCode}`
      + `${fiscalYear ? ` in FY${fiscalYear}` : ''}: its own Single Audit filings for `
      + `${seen.auditYears[0]}-${seen.auditYears[seen.auditYears.length - 1]} report a fiscal year `
      + `starting in month ${seen.month}. See ${path.relative(REPO, STATES[stateCode].csv)}. `
      + 'Correct the month, restrict the run, or — if the census is wrong — say why in the '
      + "entity's registry entry.",
  };
}
