/**
 * CA-CITIES-01 cross-source reconciliation.
 *
 * Compares one extracted ACFR city-year against the State Controller row already
 * in the database for the same (muni, fy, dataset). Pure: no DB, no filesystem,
 * no network — so the gate that decides whether real production data gets
 * overwritten is testable without a PDF, and a future CA cohort inherits a
 * tested gate instead of re-deriving one.
 *
 * NO SHEBANG — a `#!` on any module under scripts/lib/ breaks `npm test` on
 * Windows, and a test guards it (commit 40aa706).
 *
 * ── The failure direction ────────────────────────────────────────────────────
 * THE DEFAULT IS UNEXPLAINED. A divergence is only ever downgraded to EXPLAINED
 * by a rule deliberately registered with the evidence that established it. A
 * missing catalogue, a malformed rule, a rule that throws, a zero denominator —
 * every one of them leaves the year blocked. Nothing is waved through by
 * absence, because the destructive direction here is "supersede", not "skip".
 *
 * Spec: docs/superpowers/specs/2026-08-16-ca-cities-01-design.md §4
 */

/**
 * @typedef {object} Tree
 * @property {number} total
 * @property {{name: string, amount: number}[]} categories
 * @property {number} lineItemCount
 */

/**
 * @typedef {object} Calibration
 * @property {number} tieAbs     Absolute dollar delta treated as agreement
 * @property {number} tiePct     Fractional delta treated as agreement (0.001 = 0.1%)
 * @property {number} depthRatio ACFR line items below this fraction of SCO's is "materially coarser"
 * @property {{id: string, note: string, test: (ctx: object) => boolean}[]} structural
 */

export const BUCKET = {
  TIE: 'TIE',
  EXPLAINED: 'EXPLAINED',
  UNEXPLAINED: 'UNEXPLAINED',
};

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * Reconcile one city-year.
 *
 * @param {Tree} acfr        The audited figures we would load
 * @param {Tree} sco         The State Controller figures already in production
 * @param {Calibration} cal
 * @returns {{bucket: string, reason: string|null, deltaAbs: number, deltaPct: number,
 *            depthFlag: boolean, depth: object, unmatchedAcfr: string[],
 *            unmatchedSco: string[], loadable: boolean}}
 */
export function reconcile(acfr, sco, cal) {
  const acfrCats = acfr.categories ?? [];
  const scoCats = sco.categories ?? [];

  const deltaAbs = acfr.total - sco.total;

  // A zero SCO total makes a percentage meaningless rather than infinite. It also
  // must NOT be allowed to tie on the absolute threshold: $500 reported against
  // nothing reported is a total divergence, not a small delta. Reading it the
  // naive way would silently tie every year where SCO carried no figure — the
  // exact years most in need of a look.
  const scoIsZero = sco.total === 0;
  const deltaPct = scoIsZero ? (deltaAbs === 0 ? 0 : 1) : deltaAbs / sco.total;

  const acfrNames = new Map(acfrCats.map((c) => [norm(c.name), c.name]));
  const scoNames = new Map(scoCats.map((c) => [norm(c.name), c.name]));
  const unmatchedAcfr = [...acfrNames].filter(([k]) => !scoNames.has(k)).map(([, v]) => v);
  const unmatchedSco = [...scoNames].filter(([k]) => !acfrNames.has(k)).map(([, v]) => v);

  const depth = {
    acfrCategories: acfrCats.length,
    scoCategories: scoCats.length,
    acfrLineItems: acfr.lineItemCount,
    scoLineItems: sco.lineItemCount,
  };

  // Orthogonal to the bucket on purpose: a year can tie to the dollar and still
  // be held back, because superseding a 32-category / 83-line-item SCO tree with
  // a 6-line ACFR summary upgrades provenance while downgrading what a reader can
  // actually see. That trade-off is a human call, not an automatic one.
  const depthFlag = sco.lineItemCount > 0
    && acfr.lineItemCount < sco.lineItemCount * cal.depthRatio;

  const ties = scoIsZero
    ? deltaAbs === 0
    : Math.abs(deltaAbs) <= cal.tieAbs || Math.abs(deltaPct) <= cal.tiePct;

  let bucket = BUCKET.UNEXPLAINED;
  let reason = null;

  if (ties) {
    bucket = BUCKET.TIE;
  } else {
    const ctx = { acfr, sco, deltaAbs, deltaPct, unmatchedAcfr, unmatchedSco, depth };
    for (const rule of cal.structural ?? []) {
      let hit = false;
      try {
        hit = rule.test(ctx) === true;
      } catch {
        hit = false; // a broken rule never explains anything
      }
      if (hit) {
        bucket = BUCKET.EXPLAINED;
        reason = rule.id;
        break;
      }
    }
  }

  const loadable = bucket !== BUCKET.UNEXPLAINED && !depthFlag;

  return {
    bucket,
    reason,
    deltaAbs,
    deltaPct,
    depthFlag,
    depth,
    unmatchedAcfr,
    unmatchedSco,
    loadable,
  };
}
