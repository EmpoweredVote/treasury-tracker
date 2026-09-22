import { describe, it, expect } from 'vitest';
import { transparencyFigures } from '../src/components/dashboard/orgTransparencyFigures';

/**
 * The donor-facing "raised" figures.
 *
 * ⭐ WHY THIS EXISTS. On 2026-09-22 a real $2 donation moved the revenue tree to
 * $6,140.40 while the reconciled summary stayed at $6,136 — only reconcileEV.js
 * writes that table. A donor who gives $2 and watches the number sit still is a
 * miss on impact as much as on transparency: the point is that they can look at
 * the page and think "I did that".
 *
 * `pending_gross` carries donations that arrived since the last reconcile. It is
 * derived from surviving webhook line items on every read (see
 * treasury.org_financial_summary_live), so it cannot drift or double-count.
 *
 * ⚠⚠ PENDING IS **RAISED**, NEVER **ON HAND**. balance / runway / recon_variance
 * are bank-sourced and must not move when a donation arrives — the money sits
 * with the platform until payout, minus fees. Nothing here touches them.
 *
 * ⚠ These are pure functions on purpose: this repo can run NO component tests
 * (a .test.tsx will not execute), so the arithmetic a donor sees has to live
 * somewhere the suite can actually reach.
 */

const summary = (over = {}) => ({ income_net: 5879.44, pending_gross: 0, goal_amount: 10000, ...over });

describe('transparencyFigures', () => {
  it('reports raised alone when nothing has arrived since the reconcile', () => {
    const f = transparencyFigures(summary());

    expect(f.raised).toBe(5879.44);
    expect(f.pending).toBe(0);
    expect(f.total).toBe(5879.44);
  });

  it('adds a donation that arrived since the reconcile to the total', () => {
    const f = transparencyFigures(summary({ pending_gross: 2 }));

    expect(f.raised).toBe(5879.44);
    expect(f.pending).toBe(2);
    expect(f.total).toBe(5881.44);
  });

  // ⚠ The API may not carry the field yet (older deploy, or the view not applied).
  // Absent must mean "nothing pending", i.e. exactly the previous behaviour.
  it('treats a missing pending_gross as zero rather than NaN', () => {
    const f = transparencyFigures({ income_net: 100, goal_amount: 200 });

    expect(f.pending).toBe(0);
    expect(f.total).toBe(100);
    expect(Number.isNaN(f.total)).toBe(false);
  });

  it('clamps a negative pending_gross to zero', () => {
    const f = transparencyFigures(summary({ pending_gross: -50 }));

    expect(f.pending).toBe(0);
    expect(f.total).toBe(5879.44);
  });

  it('fills the progress bar using raised plus pending', () => {
    const f = transparencyFigures({ income_net: 4000, pending_gross: 1000, goal_amount: 10000 });

    expect(f.pct).toBe(50);
  });

  it('caps the progress bar at 100 percent', () => {
    const f = transparencyFigures({ income_net: 9000, pending_gross: 5000, goal_amount: 10000 });

    expect(f.pct).toBe(100);
  });

  // ⭐ The moment worth getting right: the donation that crosses the line is the
  // donor's own, and the page should say so immediately.
  it('reaches the goal when pending is what crosses it', () => {
    const f = transparencyFigures({ income_net: 9999, pending_gross: 2, goal_amount: 10000 });

    expect(f.reached).toBe(true);
  });

  it('is not reached when raised plus pending is still short', () => {
    const f = transparencyFigures({ income_net: 9000, pending_gross: 2, goal_amount: 10000 });

    expect(f.reached).toBe(false);
  });

  // No goal set is the CURRENT state of the row in production (goal_amount is
  // NULL), so it must not produce NaN or a division by zero.
  it('handles an absent goal without dividing by zero', () => {
    const f = transparencyFigures({ income_net: 100, pending_gross: 2, goal_amount: null });

    expect(f.pct).toBe(0);
    expect(f.reached).toBe(false);
    expect(f.total).toBe(102);
  });
});
