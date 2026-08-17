/**
 * Calibration for CA-CITIES-01 — MEASURED from Modesto in Task 6.
 *
 * EMPTY ON PURPOSE until then.
 *
 * SCO and ACFR figures for the same city-year are expected to differ for
 * legitimate structural reasons: the State Controller's Cities Annual Report
 * uses its own account taxonomy, and fund groupings and transfer treatment need
 * not match a GAAP fund statement. Nobody in this project has ever measured how
 * large that difference normally is — LA City was checked during scoping as a
 * possible free sample and gives none, because its sources partition cleanly by
 * year (FY2003–20 SCO, FY2021–24 Socrata, FY2025 ACFR) with zero overlapping
 * city-years anywhere in the table.
 *
 * So the thresholds below are SENTINELS, not estimates. `tieAbs: 0` and
 * `tiePct: 0` mean nothing but an exact match ties, and an empty `structural`
 * catalogue means nothing can be explained. Together they block every divergent
 * year, so a load attempted before calibration fails loudly instead of quietly
 * overwriting production data with an unvalidated extraction.
 *
 * Task 6 replaces all three numbers with measured ones, sets `calibratedFrom`,
 * and registers each structural rule alongside the evidence that established it.
 * Thresholds are set from the SHAPE OF THE DELTA CLUSTER — never reverse-
 * engineered to make a particular year pass.
 */

export const CA_CALIBRATION = {
  /** Absolute dollar delta treated as agreement. Sentinel: exact match only. */
  tieAbs: 0,

  /** Fractional delta treated as agreement (0.001 = 0.1%). Sentinel: exact match only. */
  tiePct: 0,

  /**
   * An ACFR carrying fewer than this fraction of SCO's line items is "materially
   * coarser" and its year is held out of the automatic supersede. 0.5 is the
   * spec's starting value; Task 7 confirms or replaces it once Modesto's
   * granularity comparison exists.
   */
  depthRatio: 0.5,

  /**
   * Registered reasons a delta is expected. Each entry is
   * `{ id, note, test(ctx) -> boolean }` where `note` records the EVIDENCE, not
   * just the theory. Adding one is a deliberate act; widening a threshold to
   * clear a stubborn year is not an acceptable substitute for adding one.
   */
  structural: [],

  /** Set to e.g. 'Modesto FY2015-FY2024' in Task 6. Null means uncalibrated. */
  calibratedFrom: null,
};
