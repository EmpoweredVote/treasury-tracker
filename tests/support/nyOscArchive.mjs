// NOT a `.test.mjs` file, so vitest's include globs do not collect it — see
// vitest.config.ts and tests/vitestCollectsEveryTestFile.test.mjs.
/**
 * Shared guard for the NY OSC tests that read the real 12.5 MB archive.
 *
 * `docs/NY/city_all_years.zip` is gitignored, so CI genuinely cannot have it
 * and these tests can only run on a machine that has fetched it. That is
 * acceptable — but a run where they VANISHED must say so out loud, or they
 * become a harness nobody runs.
 *
 * ⚠⚠ THE SKIP COUNT IS DERIVED, NEVER WRITTEN DOWN. The first version of this
 * warning hardcoded "4 archive-backed tests SKIPPED" and was already wrong by
 * the time it reached CI, which skipped 11: tests were added beside it without
 * anyone updating the digit. A count maintained by hand next to a growing list
 * drifts, and a warning that misstates its own scope is worse than none —
 * it tells a reader the gap is smaller than it is.
 */
import { existsSync } from 'node:fs';
import { it as vitestIt } from 'vitest';

import { ARCHIVE_PATH } from '../../scripts/lib/nyOsc.mjs';

/** True only when the export exists AND the file is on disk. */
export const haveArchive = typeof ARCHIVE_PATH === 'string'
  && ARCHIVE_PATH.length > 0
  && existsSync(ARCHIVE_PATH);

/**
 * Build a per-file `archiveIt`.
 *
 * ⚠ One instance PER TEST FILE. The counter is closed over, so two files
 * cannot report each other's skips as their own.
 *
 * `have` and `itFn` are injectable so the counting itself is testable without
 * deleting the archive — see tests/nyOscArchiveHelper.test.mjs.
 */
export function makeArchiveIt({ have = haveArchive, itFn = vitestIt } = {}) {
  let skipped = 0;

  const archiveIt = (name, fn) => {
    if (have) return itFn(name, fn);
    skipped += 1;
    return itFn.skip(name, fn);
  };

  archiveIt.skippedCount = () => skipped;

  /** The message, or null when there is nothing to announce. */
  archiveIt.warningText = () => {
    if (have || skipped === 0) return null;
    return `\n  ⚠ ${ARCHIVE_PATH} absent — ${skipped} archive-backed `
      + `test${skipped === 1 ? '' : 's'} SKIPPED. `
      + 'Run `node scripts/fetchNyOsc.mjs` to enable them.\n';
  };

  /**
   * Print it. Call from a plain `it(...)` so the announcement is itself a
   * visible, passing test rather than incidental console output — by the time
   * any test body runs, every `archiveIt` registration has already happened,
   * so the count is final.
   */
  archiveIt.warnIfMissing = () => {
    const msg = archiveIt.warningText();
    if (msg) console.warn(msg);
    return msg;
  };

  return archiveIt;
}
