/**
 * EV source-file discovery, with staleness + ambiguity warnings.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The EV refresh has now been bitten TWICE in one session by the same failure
 * shape, and neither instance produced an error:
 *
 *   1. Givebutter's `..._all.csv` LEDGER export matches the transactions regex,
 *      but `parseGiveButter` finds none of its columns → Give Butter silently
 *      vanished from income ($2,470.88 → $1,746.57).
 *   2. Patreon renamed its exports (`..._092026.csv`), the anchored regexes
 *      rejected them, and `findFile` fell through to the JUNE files sitting in
 *      the same directory → the page would have published stale numbers.
 *
 * Both produced a SMALLER, PLAUSIBLE number rather than a failure. That is the
 * class of bug this module exists to make loud: **a source going missing or
 * going stale must not look like a slightly different total.**
 *
 * DESIGN NOTE — why this does NOT just pick the newest match
 * ──────────────────────────────────────────────────────────
 * "Newest wins" is tempting and WRONG for the bank export. Beneficial State
 * Bank exports cover a DATE RANGE, not the full year; silently selecting the
 * newest one wipes Jan→range-start and publishes a single month of expenses.
 * The multi-file case genuinely requires a human (merge the bank files; pick
 * the right Givebutter shape), so selection semantics are UNCHANGED — first
 * readdir match, exactly as before — and the ambiguity is reported instead.
 *
 * Use `--strict-sources` in the calling script to turn warnings into exit 1.
 */

import fs from 'fs';
import path from 'path';

/** A matched source file older than this many days is reported as stale. */
export const STALE_DAYS = 45;

/** Accumulated warnings for this process, printed by reportSourceWarnings(). */
const warnings = [];

/** Test/CLI seam: clear accumulated warnings. */
export function resetSourceWarnings() {
  warnings.length = 0;
}

/** Number of warnings raised so far. */
export function sourceWarningCount() {
  return warnings.length;
}

function ageInDays(mtime, now) {
  return (now - mtime.getTime()) / 86_400_000;
}

/**
 * Find a source export by filename pattern.
 *
 * Selection is unchanged from the original one-liner (first readdir match), but
 * every skipped same-pattern sibling and every stale selection is recorded.
 *
 * @param {string} dir    directory to scan
 * @param {RegExp} re     filename pattern
 * @param {string} label  human name for the source, used in warnings
 * @returns {string|null} full path of the chosen file, or null if none matched
 */
export function findFile(dir, re, label = 'source') {
  const now = Date.now();
  const matches = fs.readdirSync(dir)
    .filter(n => re.test(n))
    .map(n => {
      const full = path.join(dir, n);
      return { name: n, full, mtime: fs.statSync(full).mtime };
    });

  if (matches.length === 0) return null;

  const chosen = matches[0];
  const skipped = matches.slice(1);

  if (skipped.length > 0) {
    const newest = matches.reduce((a, b) => (b.mtime > a.mtime ? b : a));
    warnings.push({
      kind: 'ambiguous',
      label,
      chosen,
      skipped,
      chosenIsNewest: newest.name === chosen.name,
    });
  }

  const age = ageInDays(chosen.mtime, now);
  if (age > STALE_DAYS) {
    warnings.push({ kind: 'stale', label, chosen, age });
  }

  return chosen.full;
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Print every accumulated warning as an unmissable end-of-run block.
 *
 * Deliberately printed AFTER the run summary as well as inline: the Givebutter
 * incident was missed precisely because the anomaly showed up as a number in
 * the summary, and anything printed before it had already scrolled away.
 *
 * @param {boolean} strict  when true, exit(1) if any warning was raised
 * @returns {number} warning count
 */
export function reportSourceWarnings(strict = false) {
  if (warnings.length === 0) return 0;

  const bar = '━'.repeat(78);
  console.warn(`\n${bar}`);
  console.warn(`⚠  SOURCE FILE WARNINGS (${warnings.length}) — the numbers above may be STALE`);
  console.warn(bar);

  for (const w of warnings) {
    if (w.kind === 'ambiguous') {
      console.warn(`\n⚠ ${w.label}: ${w.skipped.length + 1} files match — findFile took the FIRST, not the newest.`);
      console.warn(`    USING   ${w.chosen.name}  (${fmtDate(w.chosen.mtime)})`);
      for (const s of w.skipped) {
        console.warn(`    SKIPPED ${s.name}  (${fmtDate(s.mtime)})`);
      }
      if (!w.chosenIsNewest) {
        console.warn(`    ⛔ THE FILE IN USE IS NOT THE NEWEST MATCH. This is how stale data publishes.`);
      }
    } else if (w.kind === 'stale') {
      console.warn(`\n⚠ ${w.label}: in use is ${Math.floor(w.age)} days old (> ${STALE_DAYS}).`);
      console.warn(`    ${w.chosen.name}  (${fmtDate(w.chosen.mtime)})`);
      console.warn(`    A lagging export understates income — it never errors.`);
    }
  }

  console.warn(`\n→ Fix by curating a scratch dir with exactly ONE file per source`);
  console.warn(`  and re-running with --source-dir. See project_ev_financials_refresh_runbook.`);
  console.warn(`${bar}\n`);

  if (strict) {
    console.error('✖ --strict-sources: refusing to continue with source-file warnings.');
    process.exit(1);
  }
  return warnings.length;
}
