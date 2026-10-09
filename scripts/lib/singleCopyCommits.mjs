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
export function blobOnBaseline(git, baseline, blob, cache = new Map()) {
  if (cache.has(blob)) return cache.get(blob);
  const hit = Boolean(
    tryGit(git, ['log', baseline, '--format=%h', `--find-object=${blob}`, '--max-count=1']),
  );
  cache.set(blob, hit);
  return hit;
}

/**
 * Scan one working directory.
 *
 * @param git       a runner from makeGitRunner()
 * @param baseline  ref to compare against; probed from DEFAULT_BASELINES if omitted
 * @returns {{branch, baseline, unpushed, dirty, exposed[], backed[], superseded[], note?}}
 */
export function analyzeWorktree(git, { baseline } = {}) {
  const branch = tryGit(git, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? '(unknown)';
  const dirty = lines(tryGit(git, ['status', '--porcelain', '--untracked-files=no'])).length;
  const base = resolveBaseline(git, baseline);

  if (!base) {
    return {
      branch, baseline: null, unpushed: 0, dirty,
      exposed: [], backed: [], superseded: [],
      note: 'no remote baseline — nothing here is known to be backed up',
    };
  }

  // Newest first, so a path seen already belongs to a LATER commit.
  const shas = lines(tryGit(git, ['rev-list', 'HEAD', '--not', '--remotes']));
  const report = {
    branch, baseline: base, unpushed: shas.length, dirty,
    exposed: [], backed: [], superseded: [],
  };

  const cache = new Map();
  const replacedLater = new Set();

  for (const sha of shas) {
    const subject = git(['log', '-1', '--format=%s', sha]);
    const files = filesIntroduced(git, sha);
    const absent = [];
    let landed = 0;
    let stale = 0;

    for (const file of files) {
      if (replacedLater.has(file)) {
        stale += 1;
        continue;
      }
      if (blobOnBaseline(git, base, git(['rev-parse', `${sha}:${file}`]), cache)) landed += 1;
      else absent.push(file);
    }
    for (const file of files) replacedLater.add(file);

    if (absent.length) report.exposed.push({ sha, subject, verdict: 'exposed', files: absent });
    else if (stale && !landed) report.superseded.push({ sha, subject, verdict: 'superseded', files: [] });
    else report.backed.push({ sha, subject, verdict: 'backed', files: [] });
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
