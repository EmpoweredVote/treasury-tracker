/**
 * California cities whose fiscal year is NOT July–June, with the evidence.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * California sets NO municipal fiscal year by statute. There is no § 56A here to
 * bind every city to one calendar the way Massachusetts does, and no default in
 * the Government Code for cities the way ch. 35 § 16 provides for counties. A
 * CHARTER city is therefore free to choose, and 121 of California's 482
 * municipalities are charter cities.
 *
 * So "CA cities are July–June" is a generalisation with real exceptions, and
 * `bulkLoadStateController.js` takes ONE `--fiscal-year-start-month` for a whole
 * multi-city run. An operator loading Los Angeles County with `7` would flatten
 * every exception in this file back to the wrong value in a single command, and
 * nothing would fail — the column moves no dollar, so every tie test would still
 * pass at $0. That is exactly how the original hardcode survived four milestones.
 *
 * This registry is what makes that command REFUSE instead.
 *
 * ⚠ ABSENCE FROM THIS LIST IS NOT EVIDENCE OF JULY. It only means nobody has
 * checked for the years in question. `scripts/lib/caFiscalYearCensus.mjs` now
 * carries a first-party census of 427 CA cities for audit years 2016-2025, and
 * `tests/caFiscalYearCensus.test.mjs` fails the build if that census contains a
 * non-July city this file does not declare. That closes the gap FORWARD, not
 * backward: the census cannot see a change made before 2016.
 *
 * ⚠⚠ TWO OF THE FIVE EXCEPTIONS BELOW ARE NOT CHARTER CITIES. The previous pass
 * scoped this audit to the 121 charter cities, reasoning that only a charter
 * city can set its own fiscal year. South Lake Tahoe and El Segundo are both
 * general-law cities running an October year, so that premise is FALSE and the
 * charter list was never the right frame. Do not narrow a CA fiscal-calendar
 * question to charter cities again.
 */

/**
 * ⚠ Keyed on (name, state). Name alone would be reckless: there is a Long Beach
 * in New York, Washington and Mississippi, and a web search for "Long Beach city
 * charter fiscal year" returns the NEW YORK city's budget reviews first.
 */
export const CA_FISCAL_EXCEPTIONS = [
  {
    name: 'Inglewood',
    state: 'CA',
    month: 10,
    authority: 'City of Inglewood ACFR FY2020-2021 cover page: "FOR THE YEAR ENDED '
      + 'SEPTEMBER 30, 2021"; corroborated by its FY2022 single audit report. '
      + 'Charter city. See scripts/lib/inglewoodFiscalCalendar.mjs (PR #60).',
  },
  {
    name: 'Long Beach',
    state: 'CA',
    month: 10,
    authority: 'City of Long Beach FY2025 ACFR cover page: "For the Fiscal Year '
      + 'Ended September 30, 2025"; corroborated by the FY25 Adopted Budget: '
      + '"The FY 25 Budget covers the period of October 1, 2024 through '
      + 'September 30, 2025." Charter city since 1921. '
      + 'See scripts/lib/longBeachFiscalCalendar.mjs.',
  },
  {
    name: 'South Lake Tahoe',
    state: 'CA',
    month: 10,
    // ⚠ NOT a charter city, and therefore never in the charter-city audit set.
    // It was found only by censusing every CA city's federally filed audit.
    authority: 'City of South Lake Tahoe CAFR, cityofslt.gov: "For the fiscal '
      + 'year ended September 30, 2016", repeated in its MD&A heading; its '
      + 'statistical section runs an unbroken "Last Ten Fiscal Years" series '
      + 'FY2007-FY2016 on that calendar. Corroborated by ten consecutive '
      + 'September-30 Single Audit periods, FY2016-FY2025 '
      + '(docs/CA/fac-ca-city-fiscal-year-ends.csv). GENERAL-LAW city.',
  },
  {
    name: 'Huntington Beach',
    state: 'CA',
    // ⚠ CHANGED ITS FISCAL YEAR. A single month cannot describe this city.
    schedule: [
      { throughFiscalYear: 2018, month: 10 },
      { month: 7 },
    ],
    authority: 'City of Huntington Beach CAFR "FOR THE NINE-MONTH PERIOD ENDED '
      + 'JUNE 30, 2018", MD&A: "The City changed its fiscal year end from '
      + 'September 30th to June 30th effective October 1, 2017", and the '
      + 'transmittal letter: "the City Council\'s adoption of a new fiscal year '
      + 'end, from September 30 to June 30". FY2018 is therefore a NINE-MONTH '
      + 'stub that still BEGINS in October, which is why it takes 10 and not 7. '
      + 'Corroborated by September-30 audit periods FY2016-FY2017 and June-30 '
      + 'from FY2018 (docs/CA/fac-ca-city-fiscal-year-ends.csv).',
  },
  {
    name: 'El Segundo',
    state: 'CA',
    // ⚠ NOT a charter city, and it changed TWICE — the earlier change was
    // invisible until the FAC's 1998-2015 archive was merged in. Its FY1998
    // audit ends 1998-06-30 and every audit from FY1999 to FY2020 ends 09-30, so
    // it moved to October in 1999 and back to July in 2022.
    // ⚠ TT holds no El Segundo row before FY2003, so the 1998 era is INERT here;
    // it is recorded because leaving a known era out is how a later widening of
    // scope silently picks the wrong month.
    schedule: [
      { throughFiscalYear: 1998, month: 7 },
      { throughFiscalYear: 2021, month: 10 },
      { month: 7 },
    ],
    authority: 'City of El Segundo Single Audit filings state the audited period '
      + 'directly: FY2020 covers "2019-10-01 -> 2020-09-30" and FY2022 covers '
      + 'July 2021 -> "2022-06-30" (docs/CA/fac-ca-city-fiscal-year-ends.csv), '
      + 'so the changeover period is Oct 1 2020 - Jun 30 2021, and the city\'s '
      + 'FY2021-2022 budget is a 12-month July-June cycle adopted 2021-06-15. '
      + 'TT\'s own SCO revenue series independently shows FY2021 at 0.825 of '
      + 'both neighbours - the nine-month stub. (Its EXPENDITURE line does not '
      + 'dip, because 2021 pension-obligation-bond proceeds inflate it; that is '
      + 'why the stub had to be read off revenue.) GENERAL-LAW city.',
  },
];

/** The exception for a city, or null. Both name AND state must match. */
export function fiscalExceptionFor(name, state) {
  return CA_FISCAL_EXCEPTIONS.find((e) => e.name === name && e.state === state) ?? null;
}

/**
 * The evidenced month for one entry in one fiscal year.
 *
 * Returns `{ month }`, or `{ error }` when the entry is a SCHEDULE and no fiscal
 * year was supplied.
 *
 * ⚠ A missing fiscal year is an ERROR, not a default to the current calendar.
 * Huntington Beach ran October through FY2018 and July after it; answering
 * "7" for an unspecified year would silently mislabel sixteen years of history,
 * and — because this column moves no dollar — every tie test would still pass.
 * That is precisely how the original hardcoded `7` survived four milestones.
 */
export function monthForEntry(exc, fiscalYear) {
  if (!exc.schedule) return { month: exc.month };
  if (fiscalYear === undefined || fiscalYear === null || fiscalYear === '') {
    return {
      error: `${exc.name}, ${exc.state} CHANGED its fiscal year, so a month cannot `
        + 'be resolved without a fiscal year. Pass one. '
        + exc.schedule.map((s) => (s.throughFiscalYear
          ? `through FY${s.throughFiscalYear}: month ${s.month}`
          : `after that: month ${s.month}`)).join('; ') + `. ${exc.authority}`,
    };
  }
  const fy = Number(fiscalYear);
  if (!Number.isInteger(fy)) {
    return { error: `unparseable fiscal year ${JSON.stringify(fiscalYear)} for ${exc.name}, ${exc.state}` };
  }
  for (const step of exc.schedule) {
    if (step.throughFiscalYear === undefined || fy <= step.throughFiscalYear) return { month: step.month };
  }
  // Unreachable while the last step is open-ended; guarded so a malformed
  // schedule refuses instead of returning undefined.
  return { error: `no schedule step covers FY${fy} for ${exc.name}, ${exc.state}` };
}

/**
 * The month a loader should pass for one city, given whatever the operator asked
 * for on the command line.
 *
 * Returns `{ month }` — the evidenced month for a known exception, or the
 * operator's value (possibly `undefined`, meaning "let the RPC inherit") for
 * every other city — or `{ error }` when the operator's explicit value
 * CONTRADICTS evidence we hold.
 *
 * A contradiction is an error rather than a silent override because the operator
 * may have meant something this code cannot see; and it is not silently accepted
 * because the whole point of the registry is that a global flag must not be able
 * to overwrite a checked value.
 */
export function monthForCity(name, state, requestedMonth, fiscalYear) {
  const exc = fiscalExceptionFor(name, state);
  if (!exc) return { month: requestedMonth };
  const evidenced = monthForEntry(exc, fiscalYear);
  if (evidenced.error) return evidenced;
  if (requestedMonth === undefined || requestedMonth === null) return { month: evidenced.month };
  if (Number(requestedMonth) !== evidenced.month) {
    const when = exc.schedule ? ` in FY${fiscalYear}` : '';
    return {
      error: `--fiscal-year-start-month ${requestedMonth} contradicts evidence for `
        + `${name}, ${state}, whose fiscal year starts in month ${evidenced.month}${when}. ${exc.authority} `
        + 'Re-run without the flag (the RPC inherits per city), or restrict the run '
        + `with --city, or correct the evidence in scripts/lib/caCityFiscalExceptions.mjs.`,
    };
  }
  return { month: evidenced.month };
}
