/**
 * Tests for the single-copy commit detector.
 *
 * ── WHY THIS EXISTS, AND WHY THE OBVIOUS CHECKS ARE NOT IT ──────────────────
 * On 2026-10-07 a working copy held five commits that existed on no remote ref
 * and nowhere else on earth: a new migration and a whole service with its
 * tests. Finding them meant separating real exposure from 52 commits that only
 * LOOKED unpushed. Four filters were measured against that repo. Three lied:
 *
 *   - commit SUBJECTS matched against the baseline — blind to a squash merge
 *     whose subject was rewritten, and every merge commit reads as unbacked.
 *     7 false positives.
 *   - `git cherry` (patch-id) — a squash fuses N patches into one new id, so
 *     every commit of every squashed branch reads as absent. 16 false
 *     positives.
 *   - comparing each file against the baseline's CURRENT content — reports
 *     work that shipped months ago as unverifiable the moment anyone edits
 *     that file afterwards. 5 false positives, found by running it for real.
 *
 * What holds up is asking whether each file's exact BLOB appears anywhere in
 * the baseline's history. Content that was committed to the baseline is backed
 * up forever, whatever happened to that path since.
 *
 * Fixtures build real git repositories in a temp dir — the behaviour under
 * test IS git semantics, so mocking it would test the mock.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { analyzeRepo, makeGitRunner } from './singleCopyCommits.mjs';

let dir;
let git;

function run(...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

function write(file, text) {
  fs.writeFileSync(path.join(dir, file), text, 'utf8');
}

function commit(message) {
  run('add', '-A');
  run('-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', message);
  return run('rev-parse', 'HEAD');
}

/** Move the remote-tracking ref to the current master. No network, no bare repo. */
function publishMaster() {
  run('update-ref', 'refs/remotes/origin/master', run('rev-parse', 'master'));
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'single-copy-'));
  run('init', '-q', '-b', 'master', '.');
  // Keeps the suite's output pristine: without this, every fixture write prints
  // "LF will be replaced by CRLF" on Windows.
  run('config', 'core.autocrlf', 'false');
  git = makeGitRunner(dir);

  write('base.txt', 'base\n');
  commit('base');
  publishMaster();
  run('checkout', '-q', '-b', 'work');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('analyzeRepo', () => {
  it('reports nothing when every commit is on a remote ref', () => {
    const report = analyzeRepo(git);
    expect(report.unpushed).toBe(0);
    expect(report.exposed).toEqual([]);
  });

  it('calls a squash-merged commit BACKED even when the subject was rewritten', () => {
    // The 7-false-positive case. The branch commit is unreachable from every
    // remote ref and its patch-id is gone, but its content shipped.
    write('feature.txt', 'shipped\n');
    commit('feat: the branch wording');

    run('checkout', '-q', 'master');
    write('feature.txt', 'shipped\n');
    commit('feat: the maintainer rewrote this subject (#412)');
    publishMaster();
    run('checkout', '-q', 'work');

    const report = analyzeRepo(git);
    expect(report.unpushed).toBe(1);
    expect(report.exposed).toEqual([]);
    expect(report.backed).toHaveLength(1);
  });

  it('calls a commit BACKED when its content shipped and the baseline then moved on', () => {
    // ⚠ THE FALSE POSITIVE THIS TOOL ITSELF PRODUCED on its first real run.
    // Comparing against the baseline's CURRENT blob reports five-month-old
    // merged work as unverifiable, because someone edited the file afterwards.
    // The content is on the baseline's history and is backed up forever.
    write('shared.ts', 'the branch version\n');
    commit('feat: the work');

    run('checkout', '-q', 'master');
    write('shared.ts', 'the branch version\n');
    commit('feat: the work (#903)');
    write('shared.ts', 'master kept editing it afterwards\n');
    commit('chore: later, unrelated edit');
    publishMaster();
    run('checkout', '-q', 'work');

    const report = analyzeRepo(git);
    expect(report.exposed).toEqual([]);
    expect(report.backed).toHaveLength(1);
  });

  it('finds content that shipped under a DIFFERENT path', () => {
    // A squash that also moved the file. Searching history by blob with a path
    // filter would miss this; searching by blob alone finds it.
    write('old-name.ts', 'the table\n');
    commit('refactor: extract the table');

    run('checkout', '-q', 'master');
    write('new-name.ts', 'the table\n');
    commit('refactor: extract the table, renamed in review (#905)');
    publishMaster();
    run('checkout', '-q', 'work');

    expect(analyzeRepo(git).exposed).toEqual([]);
  });

  it('reports a commit whose content is in no baseline commit, and names the file', () => {
    write('CC_0188_new_migration.sql', 'alter table questions add column options_scale jsonb;\n');
    const sha = commit('feat: add a migration that exists nowhere else');

    const report = analyzeRepo(git);
    expect(report.exposed).toHaveLength(1);
    expect(report.exposed[0].sha).toBe(sha);
    expect(report.exposed[0].files).toEqual(['CC_0188_new_migration.sql']);
    expect(report.backed).toEqual([]);
  });

  it('does not report an intermediate version a later commit on the branch replaced', () => {
    // Only the branch's FINAL content can be lost. Flagging every superseded
    // draft would bury the one line that matters under the branch's history.
    write('draft.ts', 'first attempt\n');
    commit('wip: first attempt');
    write('draft.ts', 'second attempt\n');
    const last = commit('wip: second attempt');

    const report = analyzeRepo(git);
    expect(report.exposed).toHaveLength(1);
    expect(report.exposed[0].sha).toBe(last);
    expect(report.superseded).toHaveLength(1);
  });

  it('finds exposed work on a branch that is NOT checked out', () => {
    // ⚠ THE FALSE ALL-CLEAR. Scanning only HEAD means every branch nobody has
    // checked out is invisible — and pruning stale branches is exactly when
    // someone asks this question. A tool that answers "clean" there is worse
    // than no tool.
    write('on-head.txt', 'head work' + String.fromCharCode(10));
    commit('feat: work on the checked-out branch');
    run('checkout', '-q', '-b', 'forgotten');
    write('only-here.sql', 'create table nobody_else_has (id int);' + String.fromCharCode(10));
    const hidden = commit('feat: work on a branch nobody has open');
    run('checkout', '-q', 'work');

    const report = analyzeRepo(git);
    const row = report.exposed.find((c) => c.sha === hidden);
    expect(row, 'a branch that is not HEAD must still be scanned').toBeDefined();
    expect(row.files).toEqual(['only-here.sql']);
    expect(row.branches).toContain('forgotten');
  });

  it('does not call a deletion exposure', () => {
    // A commit that only removes a file introduces no content that could be
    // lost. Counting its path would flag every cleanup commit ever made.
    run('checkout', '-q', 'master');
    write('doomed.txt', 'bye\n');
    commit('chore: add a file that will be deleted');
    publishMaster();
    run('checkout', '-q', 'work');
    run('merge', '-q', 'master');
    fs.rmSync(path.join(dir, 'doomed.txt'));
    commit('chore: delete it');

    expect(analyzeRepo(git).exposed).toEqual([]);
  });

  it('classifies a merge commit against its first parent, not against nothing', () => {
    // `git show --name-only` prints NOTHING for a merge, so a naive reader sees
    // "no files" and lets a conflict resolution through unexamined.
    run('checkout', '-q', 'master');
    write('from-master.txt', 'm\n');
    commit('chore: master moves');
    publishMaster();
    run('checkout', '-q', 'work');
    write('on-branch.txt', 'b\n');
    commit('feat: branch work');
    run('-c', 'user.name=T', '-c', 'user.email=t@example.com',
        'merge', '-q', '--no-ff', 'master', '-m', 'Merge branch master into work');

    const report = analyzeRepo(git);
    // The merge introduces only master's file, which is on the baseline; the
    // branch's own commit is the single-copy one.
    expect(report.exposed.map((c) => c.subject)).toEqual(['feat: branch work']);
  });

  it('refuses to call anything backed when there is no remote baseline', () => {
    // ⚠ A repo with no remote cannot be said to have its work backed up — the
    // opposite, in fact. INCONCLUSIVE, never clean.
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'single-copy-noremote-'));
    try {
      execFileSync('git', ['init', '-q', '-b', 'master', '.'], { cwd: bare });
      execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: bare });
      execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.com',
        'commit', '-q', '--allow-empty', '-m', 'solo'], { cwd: bare });
      const report = analyzeRepo(makeGitRunner(bare));
      expect(report.baseline).toBeNull();
      expect(report.note).toMatch(/no remote baseline/);
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });
});
