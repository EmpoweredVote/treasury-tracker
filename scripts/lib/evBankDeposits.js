/**
 * Shared bank-deposit helpers for Empowered Vote reconciliation (Phase 75).
 *
 * The bank export's DEBITS are EV's expenses (loadEVBank.js). The DEPOSITS are
 * either platform payouts (the net of donations already counted from the platform
 * exports — must NOT be re-added as income, D-05) or bank-only income (interest;
 * future checks/grants). These helpers classify deposits by descriptor (D-04) so
 * reconcileEV.js can match payouts and loadEVDonations.js can re-home bank interest.
 *
 * Pure (no network) — imports parsing primitives from loadEVBank.js.
 */
import { money, bankYear, bankISO } from '../loadEVBank.js';

/**
 * Classify a bank deposit by its Description (D-04).
 * @returns {{kind: 'platform'|'interest'|'unmatched', source: string|null}}
 *   platform → source is the platform export key ('Give Butter' | 'Patreon' | 'Benevity')
 *   interest → source 'Bank Interest'
 *   unmatched → source null (flagged for manual classification, D-07)
 */
export function classifyDeposit(description) {
  const d = String(description || '');
  // platform checks first, then interest
  if (/Givebutter/i.test(d)) return { kind: 'platform', source: 'Give Butter' };
  if (/Patreon/i.test(d)) return { kind: 'platform', source: 'Patreon' };
  if (/AMER ONLINE GIV/i.test(d)) return { kind: 'platform', source: 'Benevity' }; // American Online Giving Foundation = Benevity disburser
  if (/Credit Interest/i.test(d)) return { kind: 'interest', source: 'Bank Interest' };
  return { kind: 'unmatched', source: null };
}

/**
 * Extract positive (credit) rows for the target fiscal year.
 * @returns {Array<{date: string, iso: string|null, desc: string, amount: number}>}
 */
export function extractDeposits(rows, fy) {
  const out = [];
  for (const r of rows) {
    const amt = money(r['Amount']);
    if (amt <= 0) continue;             // skip debits/zero
    if (bankYear(r['Date']) !== fy) continue;
    out.push({ date: r['Date'], iso: bankISO(r['Date']), desc: r['Description'] || '', amount: amt });
  }
  return out;
}
