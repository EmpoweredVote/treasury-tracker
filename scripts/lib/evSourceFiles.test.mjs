/**
 * Regression tests for EV source-file discovery.
 *
 * These lock down the two things that have actually bitten the refresh, both of
 * which failed SILENTLY — producing a smaller, plausible number rather than an
 * error:
 *
 *   - Patreon's period suffix (`..._092026.csv`) must match, and the
 *     earnings/detailed split must survive the loosened pattern.
 *   - A skipped sibling or a stale selection must raise a warning.
 *
 * Uses a temp dir with synthetic filenames — never reads data/ev-sources/,
 * which is gitignored and absent on a fresh clone.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  findFile,
  resetSourceWarnings,
  sourceWarningCount,
  STALE_DAYS,
} from './evSourceFiles.js';

// The patterns as used by the loaders — kept here verbatim so a change to
// either side breaks a test rather than a refresh.
const RE_PAT_EARNINGS = /patreon.*analytics-earnings.*\.csv$/i;
const RE_PAT_DETAILED = /patreon.*detailed-earnings.*\.csv$/i;
const RE_GIVEBUTTER = /givebutter.*transactions.*\.csv$/i;

// Every Patreon export shape seen in data/ev-sources/ as of 2026-09-20.
const PATREON_FILES = [
  'patreon_creator-analytics-detailed-earnings.csv',
  'Patreon_creator-analytics-detailed-earnings_092026.csv',
  'patreon_creator-analytics-earnings.csv',
  'Patreon_creator-analytics-earnings_092026.csv',
  'patreon_creator-analytics-payouts.csv',
  'Patreon_creator-analytics-payouts_092026.csv',
  'patreon_creator-analytics-refunds.csv',
];

let dir;

function write(name, mtime) {
  const full = path.join(dir, name);
  fs.writeFileSync(full, 'x');
  if (mtime) fs.utimesSync(full, mtime, mtime);
  return full;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-src-'));
  resetSourceWarnings();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('Patreon filename patterns', () => {
  it('matches the period-suffixed export Patreon now produces', () => {
    write('Patreon_creator-analytics-earnings_092026.csv');
    expect(findFile(dir, RE_PAT_EARNINGS, 'pat')).not.toBeNull();
  });

  it('still matches the old unsuffixed export', () => {
    write('patreon_creator-analytics-earnings.csv');
    expect(findFile(dir, RE_PAT_EARNINGS, 'pat')).not.toBeNull();
  });

  it('earnings never swallows detailed/payouts/refunds, suffixed or not', () => {
    // The whole safety argument for loosening: the detailed file's substring is
    // "analytics-DETAILED-earnings", which "analytics-earnings" cannot match.
    const earningsOnly = PATREON_FILES.filter(n => RE_PAT_EARNINGS.test(n));
    expect(earningsOnly).toEqual([
      'patreon_creator-analytics-earnings.csv',
      'Patreon_creator-analytics-earnings_092026.csv',
    ]);
  });

  it('detailed matches only the two detailed files', () => {
    const detailedOnly = PATREON_FILES.filter(n => RE_PAT_DETAILED.test(n));
    expect(detailedOnly).toEqual([
      'patreon_creator-analytics-detailed-earnings.csv',
      'Patreon_creator-analytics-detailed-earnings_092026.csv',
    ]);
  });

  it('the two patterns never select the same file', () => {
    const both = PATREON_FILES.filter(n => RE_PAT_EARNINGS.test(n) && RE_PAT_DETAILED.test(n));
    expect(both).toEqual([]);
  });
});

describe('ambiguity warnings', () => {
  it('warns when a same-pattern sibling is skipped', () => {
    write('patreon_creator-analytics-earnings.csv', daysAgo(1));
    write('Patreon_creator-analytics-earnings_092026.csv', daysAgo(1));
    findFile(dir, RE_PAT_EARNINGS, 'Patreon earnings');
    expect(sourceWarningCount()).toBe(1);
  });

  it('is silent when exactly one fresh file matches', () => {
    write('Patreon_creator-analytics-earnings_092026.csv', daysAgo(1));
    findFile(dir, RE_PAT_EARNINGS, 'Patreon earnings');
    expect(sourceWarningCount()).toBe(0);
  });

  it('flags the Givebutter _all ledger export as a competing match', () => {
    // The `_all` export parses to ZERO income; it must never be picked silently.
    write('GiveButter_transactions-2026-09-20-1756800189.csv', daysAgo(1));
    write('GiveButter_transactions-2026-09-20-202234_all.csv', daysAgo(1));
    findFile(dir, RE_GIVEBUTTER, 'Givebutter transactions');
    expect(sourceWarningCount()).toBe(1);
  });
});

describe('staleness warnings', () => {
  it('warns when the selected file is older than STALE_DAYS', () => {
    write('Patreon_creator-analytics-earnings_092026.csv', daysAgo(STALE_DAYS + 10));
    findFile(dir, RE_PAT_EARNINGS, 'Patreon earnings');
    expect(sourceWarningCount()).toBe(1);
  });

  it('does not warn on a file just inside the window', () => {
    write('Patreon_creator-analytics-earnings_092026.csv', daysAgo(STALE_DAYS - 5));
    findFile(dir, RE_PAT_EARNINGS, 'Patreon earnings');
    expect(sourceWarningCount()).toBe(0);
  });
});

describe('selection semantics are unchanged', () => {
  it('still returns the FIRST readdir match, not the newest', () => {
    // Deliberate: "newest wins" is WRONG for the bank export, which covers a
    // DATE RANGE — silently picking the newest wipes Jan->range-start. The
    // multi-file case needs a human, so it warns instead of guessing.
    write('beneficial_state_bank_export_20260620.csv', daysAgo(90));
    write('beneficial_state_bank_export_20260920.csv', daysAgo(1));
    const re = /beneficial.*state.*bank.*\.csv$/i;
    const first = fs.readdirSync(dir).find(n => re.test(n));
    expect(path.basename(findFile(dir, re, 'bank'))).toBe(first);
  });

  it('returns null when nothing matches', () => {
    write('unrelated.csv');
    expect(findFile(dir, RE_PAT_EARNINGS, 'pat')).toBeNull();
  });
});
