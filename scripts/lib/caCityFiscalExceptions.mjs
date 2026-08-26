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
 * checked. Of the 121 CA charter cities, 2 have been checked and both were wrong;
 * the other 119 are unexamined. Do not read this file as a complete census.
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
];

/** The exception for a city, or null. Both name AND state must match. */
export function fiscalExceptionFor(name, state) {
  return CA_FISCAL_EXCEPTIONS.find((e) => e.name === name && e.state === state) ?? null;
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
export function monthForCity(name, state, requestedMonth) {
  const exc = fiscalExceptionFor(name, state);
  if (!exc) return { month: requestedMonth };
  if (requestedMonth === undefined || requestedMonth === null) return { month: exc.month };
  if (Number(requestedMonth) !== exc.month) {
    return {
      error: `--fiscal-year-start-month ${requestedMonth} contradicts evidence for `
        + `${name}, ${state}, whose fiscal year starts in month ${exc.month}. ${exc.authority} `
        + 'Re-run without the flag (the RPC inherits per city), or restrict the run '
        + `with --city, or correct the evidence in scripts/lib/caCityFiscalExceptions.mjs.`,
    };
  }
  return { month: exc.month };
}
