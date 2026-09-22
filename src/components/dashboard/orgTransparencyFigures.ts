/**
 * The donor-facing "raised" arithmetic, kept pure and separate from the panel.
 *
 * ⚠ This repo can run NO component tests (a .test.tsx will not execute — see
 * tests/ and vitest.config.ts include globs), so the numbers a donor actually
 * reads have to live somewhere the suite can reach. Tested in
 * tests/orgTransparencyFigures.test.mjs.
 *
 * ── ⚠⚠ RAISED, NEVER ON HAND ───────────────────────────────────────────────
 * `pending_gross` is money the platform has received since the last reconcile.
 * It is NOT in the bank yet: Givebutter holds it until payout, minus fees
 * (measured 2026-09-22 — platform net $1,871.78 vs matched bank deposits
 * $1,193.45, a $678.33 gap that IS the undeposited payouts). So it belongs to
 * "raised" and must never be added to `balance`, `runway_months` or
 * `recon_variance`, which are bank-sourced and correctly stay as-of their date.
 *
 * ── Why gross, with no fee estimate ────────────────────────────────────────
 * The fee is only known at payout. Estimating one would put a number on the
 * page that no source states, which is the one thing this project does not do.
 * The donation's gross is a fact; it is shown as its own line rather than
 * folded into a reconciled figure it would slightly overstate.
 */

export interface TransparencySummaryInput {
  income_net: number;
  /** Donations arrived since the last reconcile. Absent on an API that predates it. */
  pending_gross?: number | null;
  goal_amount?: number | null;
}

export interface TransparencyFigures {
  /** The reconciled figure, exactly as published. */
  raised: number;
  /** Arrived since the reconcile. Zero when everything is reconciled. */
  pending: number;
  /** raised + pending — what the progress bar fills to. */
  total: number;
  /** 0–100, capped. 0 when no goal is set. */
  pct: number;
  reached: boolean;
}

export function transparencyFigures(summary: TransparencySummaryInput): TransparencyFigures {
  const raised = Number(summary.income_net) || 0;

  // ⚠ `?? 0` then clamp: an absent field must mean "nothing pending" (the exact
  // previous behaviour), and a negative can never reduce the published figure.
  const pending = Math.max(0, Number(summary.pending_gross ?? 0) || 0);

  const total = raised + pending;
  const goal = Number(summary.goal_amount ?? 0) || 0;

  // goal_amount is NULL in production today, so guard the division rather than
  // rendering NaN%.
  const pct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  const reached = goal > 0 && total >= goal;

  return { raised, pending, total, pct, reached };
}
