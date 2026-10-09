/**
 * Find commits whose content exists on this disk and nowhere else.
 *
 * NO SHEBANG — kept importable (the shebang/CRLF guard covers any module a test
 * imports; see scripts/checkStagedNulBytes.mjs).
 *
 * ── THE RULE, AND THE THREE THAT FAILED BEFORE IT ───────────────────────────
 * "Not reachable from a remote ref" is NOT "not backed up". A squash-merged
 * branch keeps its original commits locally forever: unreachable from every
 * remote ref, patch-ids gone, content safely on the baseline. A checkout with
 * a few dozen merged branches is almost entirely made of these.
 *
 * Measured against a real repo on 2026-10-07:
 *
 *   - matching commit SUBJECTS against the baseline — broken by a rewritten
 *     squash subject, and every merge commit reads as unbacked. 7 false
 *     positives.
 *   - `git cherry` / patch-id — a squash fuses N patches into one new id, so
 *     every commit of every squashed branch reads as absent. 16 false
 *     positives.
 *   - comparing each file against the baseline's CURRENT blob — reports work
 *     that shipped long ago as unverifiable the moment anyone edits that file
 *     afterwards. 5 false positives, found by running this tool for real.
 *
 * What holds up: **does this file's exact blob appear anywhere in the
 * baseline's history?** Content once committed to the baseline is backed up
 * forever, whatever became of that path since — and the search is by blob
 * alone, with no path filter, so content that shipped under a different name
 * is still found.
 *
 * Three ways a file is not exposure:
 *   landed      — its blob is in the baseline's history.
 *   superseded  — a LATER unpushed commit on this branch replaced it, so the
 *                 draft cannot be the thing that is lost.
 *   deleted     — removing a file introduces no content (`--diff-filter=AM`).
 *                 Counting its path would flag every cleanup commit ever made.
 *
 * Everything else is EXPOSED: this content exists in no other copy of the repo.
 *
 * Merges are diffed against their FIRST PARENT. Plain `git show --name-only`
 * prints nothing for a merge, which reads as "no files" and lets a conflict
 * resolution through unexamined.
 *
 * ⚠ The flag for that is `--diff-merges=first-parent`, NOT `-m --first-parent`.
 * The latter reads exactly like it should work and does not: measured on git
 * 2.52.0, `-m --first-parent` emits the files of EVERY parent's diff, so an
 * ordinary `git merge master` reports the whole branch's work as introduced by
 * the merge commit — turning every merge into a false exposure.
 *
 * ⚠ This module only ever READS. It runs against other people's checkouts,
 * where a checkout, a new ref or a written object would be an intrusion.
 */

import { execFileSync } from 'child_process';

/** Candidate baselines, in the order they are probed when none is given. */
export const DEFAULT_BASELINES = ['origin/HEAD', 'origin/main', 'origin/master'];

/**
 * A git runner bound to one working directory.
 * Returns trimmed stdout; throws on non-zero exit.
 */
export function makeGitRunner(cwd) {
  return (args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

/** Run and return null instead of throwing — for existence probes. */
function tryGit(git, args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

/** The first candidate baseline that resolves, or null if the repo has no remote. */
export function resolveBaseline(git, preferred) {
  for (const ref of preferred ? [preferred] : DEFAULT_BASELINES) {
    if (tryGit(git, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return ref;
  }
  return null;
}

/** Files a commit ADDED or MODIFIED, merges taken against their first parent. */
export function filesIntroduced(git, sha) {
  return lines(
    git([
      'diff-tree', '--no-commit-id', '--name-only', '-r', '--root',
      '--diff-merges=first-parent', '--diff-filter=AM', sha,
    ]),
  );
}

/**
 * Is this exact blob anywhere in the baseline's history?
 *
 * ⚠ Deliberately NO pathspec: the same content committed under a different
 * name is still backed up, and a squash that renames a file in review is
 * common enough that a path filter would report it as single-copy.
 *
 * A hit stops immediately; a miss walks the baseline's history, which is why
 * the result is cached per blob for the life of the scan.
 */
export function blobOnBaseline(git, baseline, blob, cache = new Map(), file) {
  if (cache.has(blob)) return cache.get(blob);

  // Fast path: most merged work is still the baseline's CURRENT content, and
  // one rev-parse beats walking history. A miss here proves nothing (the
  // baseline may simply have moved on), so it falls through rather than
  // answering. Measured over 77 refs in two repos: 3m34s without it, 1m07s
  // with — same verdict both ways, 0 exposed and 56 backed.
  if (file && tryGit(git, ['rev-parse', '--verify', '--quiet', `${baseline}:${file}`]) === blob) {
    cache.set(blob, true);
    return true;
  }

  const hit = Boolean(
    tryGit(git, ['log', baseline, '--format=%h', `--find-object=${blob}`, '--max-count=1']),
  );
  cache.set(blob, hit);
  return hit;
}

/**
 * Scan a REPOSITORY — every local branch, plus any detached worktree HEAD.
 *
 * ⚠⚠ NOT just the checked-out branch. Scanning only HEAD gives a clean
 * bill of health to every branch nobody happens to have open, and "I am about
 * to delete these stale branches" is exactly when someone asks this question.
 * That is a FALSE ALL-CLEAR, the one failure this tool must never produce. It
 * shipped that way for about an hour on 2026-10-09 and was caught by a
 * pre-flight written for a branch prune.
 *
 * Branches are repository-global, so this runs ONCE per repo, not per
 * worktree. A detached HEAD belongs to no branch and is scanned separately.
 *
 * @param git       a runner from makeGitRunner()
 * @param baseline  ref to compare against; probed from DEFAULT_BASELINES if omitted
 * @param extraRefs commit-ish values to scan beyond refs/heads (detached HEADs)
 * @returns {baseline, unpushed, refsScanned, exposed[], backed[], superseded[], note?}
 */
export function analyzeRepo(git, { baseline, extraRefs = [] } = {}) {
  const base = resolveBaseline(git, baseline);

  if (!base) {
    return {
      baseline: null, unpushed: 0, refsScanned: 0,
      exposed: [], backed: [], superseded: [],
      note: 'no remote baseline — nothing here is known to be backed up',
    };
  }

  const refs = [
    ...lines(tryGit(git, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])),
    ...extraRefs,
  ];

  const report = {
    baseline: base, unpushed: 0, refsScanned: refs.length,
    exposed: [], backed: [], superseded: [],
  };
  const cache = new Map();
  const seen = new Map();

  for (const ref of refs) {
    // Newest first, so a path already seen belongs to a LATER commit on THIS ref.
    const shas = lines(tryGit(git, ['rev-list', ref, '--not', '--remotes']));
    const replacedLater = new Set();

    for (const sha of shas) {
      const already = seen.get(sha);
      if (already) {
        if (!already.branches.includes(ref)) already.branches.push(ref);
        for (const file of filesIntroduced(git, sha)) replacedLater.add(file);
        continue;
      }

      const files = filesIntroduced(git, sha);
      const absent = [];
      let landed = 0;
      let stale = 0;

      for (const file of files) {
        if (replacedLater.has(file)) {
          stale += 1;
          continue;
        }
        if (blobOnBaseline(git, base, git(['rev-parse', sha + ':' + file]), cache, file)) landed += 1;
        else absent.push(file);
      }
      for (const file of files) replacedLater.add(file);

      const row = { sha, subject: git(['log', '-1', '--format=%s', sha]), branches: [ref], files: absent };
      seen.set(sha, row);
      report.unpushed += 1;

      if (absent.length) report.exposed.push(row);
      else if (stale && !landed) report.superseded.push(row);
      else report.backed.push(row);
    }
  }
  return report;
}

/** Every working directory of a repository, including the main one. */
export function listWorktrees(git) {
  const out = [];
  for (const line of lines(tryGit(git, ['worktree', 'list', '--porcelain']))) {
    if (line.startsWith('worktree ')) out.push(line.slice('worktree '.length));
  }
  return out;
}
