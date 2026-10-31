/**
 * Compare the frozen-exclusion REPO FILES against the DATABASE MIRROR.
 *
 * NO SHEBANG — a test imports this module.
 *
 * ⚠⚠ WHY THIS EXISTS. The frozen invariant is enforced from TWO exclusion
 * lists that are supposed to be the same list:
 *
 *   scopeBaseline.json.excluded_ids_files   read by the JS tools
 *                                           (registerCreatedRows, backup diff)
 *   treasury.frozen_excluded_ids            read by the in-database
 *                                           frozen_invariant_status() RPC
 *
 * When they drift, the two tools report DIFFERENT deficits and
 * `registerCreatedRows` refuses to write. Its message reads as "your load is
 * wrong" — and on 2026-10-31 nothing about the load was wrong. It cost an
 * investigation to discover the difference was four rows belonging to an
 * UNMERGED PULL REQUEST whose data had already been loaded to production: the
 * rows were in the database and in the mirror, and their bookkeeping files
 * existed only on that PR's branch.
 *
 * That is a normal, recurring situation in this repo — production runs ahead
 * of `main` by whatever is loaded but not yet merged — so the drift needs a
 * name rather than an investigation each time.
 *
 * ⚠⚠ LIVE DRIFT AND STALE DRIFT ARE DIFFERENT PROBLEMS, and conflating them
 * is why the raw count misleads. An id that no longer matches a budget row
 * cannot change any invariant: it is bookkeeping litter. An id that DOES match
 * a live row moves the deficit by one and will block the next registration.
 * Only the live count is actionable.
 */

/**
 * @param {{excluded_ids_files?: string[]}} baseline  parsed scopeBaseline.json
 * @param {Map<string, Set<string>>} mirrorByFile     db ids grouped by source_file
 * @param {(file: string) => string[] | null} readFile  repo file reader; null when absent
 * @returns {{file: string, onlyRepo: string[], onlyDb: string[], missingFile: boolean,
 *            unlisted: boolean}[]}
 */
export function compareExclusionSources(baseline, mirrorByFile, readFile) {
  const listed = baseline.excluded_ids_files ?? [];
  const files = [...new Set([...listed, ...mirrorByFile.keys()])].sort();
  const out = [];

  for (const file of files) {
    const mirror = mirrorByFile.get(file) ?? new Set();
    const contents = readFile(file);

    if (contents === null) {
      // In the database but the repo file is absent — the unmerged-PR shape.
      out.push({ file, onlyRepo: [], onlyDb: [...mirror], missingFile: true, unlisted: false });
      continue;
    }
    const repo = new Set(contents);
    if (!listed.includes(file)) {
      out.push({ file, onlyRepo: [], onlyDb: [...mirror], missingFile: false, unlisted: true });
      continue;
    }

    const onlyRepo = [...repo].filter((id) => !mirror.has(id));
    const onlyDb = [...mirror].filter((id) => !repo.has(id));
    if (onlyRepo.length || onlyDb.length) {
      out.push({ file, onlyRepo, onlyDb, missingFile: false, unlisted: false });
    }
  }
  return out;
}

/**
 * Split drifting ids into the ones that can move an invariant and the ones
 * that cannot.
 *
 * ⚠ `liveIds` is the set of ids that currently exist as budget rows. An id
 * absent from it is stale litter: real, worth cleaning, and incapable of
 * changing any count.
 */
export function splitLiveAndStale(drift, liveIds) {
  let live = 0;
  let stale = 0;
  for (const d of drift) {
    for (const id of [...d.onlyRepo, ...d.onlyDb]) {
      if (liveIds.has(id)) live += 1; else stale += 1;
    }
  }
  return { live, stale };
}
