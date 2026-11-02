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
    // ⚠⚠ ATTRIBUTION, NOT ABSENCE. The mirror stores each id ONCE under one
    // source_file while a repo id may be listed in two files, so an id missing
    // HERE may be sitting in the mirror under its other file. Which of the two
    // it is decides whether there is anything to fix.
    const attributedElsewhere = onlyRepo.filter(
      (id) => [...mirrorByFile.values()].some((set) => set.has(id)));
    if (onlyRepo.length || onlyDb.length) {
      out.push({
        file, onlyRepo, onlyDb, attributedElsewhere, missingFile: false, unlisted: false,
      });
    }
  }
  return out;
}

/**
 * The union of every id the repo files list, and the union of every id the
 * mirror holds — the only comparison that can produce a verdict.
 *
 * ⚠⚠ WHY THE PER-FILE COMPARISON CANNOT. Measured 2026-10-31 over all 64
 * files and 521,052 distinct ids: exactly 81 ids are listed in MORE THAN ONE
 * repo file, and `liveSyncExcludedIds.json` holds all 81. That overlap is by
 * design — it is a SCOPE file, "a complete statement of its own scope, not a
 * diff", and it overlaps the milestone PROVENANCE files. The mirror stores
 * each id ONCE (`syncFrozenInvariantState.mjs` dedupes it, or the insert dies
 * on the primary key) under ONE source_file, so `compareExclusionSources`
 * reads the other file's copy as missing from the database and reports drift
 * that no sync can ever clear.
 *
 * Worse in the other direction: when the mirror attributes a shared id to the
 * file the repo does NOT list it under, the per-file comparison calls it
 * `only-in-db` and therefore BLOCKING — refusing a registration that should
 * proceed.
 *
 * Every consumer unions these files into a Set before computing anything, so
 * the unions agreeing is exactly what "the two lists are the same list" means.
 *
 * @param {{excluded_ids_files?: string[]}} baseline
 * @param {Map<string, Set<string>>} mirrorByFile
 * @param {(file: string) => string[] | null} readFile
 * @returns {{onlyRepo: string[], onlyDb: string[]}}
 */
export function compareExclusionUnions(baseline, mirrorByFile, readFile) {
  const repo = new Set();
  for (const file of baseline.excluded_ids_files ?? []) {
    const contents = readFile(file);
    if (contents === null) continue; // absent from this checkout — the unmerged-PR shape
    for (const id of contents) repo.add(id);
  }

  // ⚠ EVERY mirror file counts, including one the baseline never listed. An id
  // the database excludes is excluded whatever name it filed under.
  const db = new Set();
  for (const ids of mirrorByFile.values()) for (const id of ids) db.add(id);

  return {
    onlyRepo: [...repo].filter((id) => !db.has(id)),
    onlyDb: [...db].filter((id) => !repo.has(id)),
  };
}
