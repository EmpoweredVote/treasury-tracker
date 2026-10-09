/**
 * On-demand single-copy check: `npm run check:single-copy [-- <repo> ...]`
 *
 * NO SHEBANG — kept importable (the shebang/CRLF guard covers any module a test
 * imports; see scripts/checkStagedNulBytes.mjs).
 *
 * Answers one question, for every working directory of every repo named:
 * **is there committed work here that exists nowhere else?**
 *
 * ── WHY THIS IS NOT `git log --not --remotes` ───────────────────────────────
 * On 2026-10-07 a checkout reported 57 commits "not on any remote". Fifty-two
 * of them were squash-merged branches whose content was safely on master; five
 * were a new migration and a whole service with its tests, existing on one
 * disk and nowhere on earth. A gate that cries wolf 52 times out of 57 is a
 * gate nobody reads, which is how the five stayed invisible for a week.
 *
 * The classification rule, and the two filters that failed before it, are
 * documented in scripts/lib/singleCopyCommits.mjs.
 *
 * ⚠ READ-ONLY, BY DESIGN. It is meant to be pointed at other people's
 * checkouts — including ⛔ C:/EV-Accounts, where a checkout, a new ref or a
 * written object would be an intrusion. It runs `rev-list`, `diff-tree`,
 * `rev-parse` and `status`; it writes nothing, fetches nothing, and needs no
 * network. That also means it compares against the remote refs this machine
 * last FETCHED: a branch pushed from elsewhere since then still reads as
 * exposed until someone fetches. False alarm, never a false all-clear.
 *
 * Run it before clearing a session, or any time the answer to "do we have
 * anything to push?" needs to be better than a guess.
 *
 * Exit codes:  0 nothing single-copy   1 EXPOSED work found   2 INCONCLUSIVE
 *
 * ⚠ Set via process.exitCode, never process.exit(): on Windows the latter
 * aborts with a libuv assertion AFTER the message prints, so a legitimate
 * finding reads as a crash.
 */

import path from 'path';
import { analyzeWorktree, listWorktrees, makeGitRunner } from './lib/singleCopyCommits.mjs';

function parseArgs(argv) {
  const repos = [];
  let baseline;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--baseline') {
      baseline = argv[i + 1];
      i += 1;
    } else if (!argv[i].startsWith('-')) {
      repos.push(argv[i]);
    }
  }
  return { repos: repos.length ? repos : [process.cwd()], baseline };
}

function main() {
  const { repos, baseline } = parseArgs(process.argv.slice(2));

  let exposed = 0;
  let backed = 0;
  let inconclusive = 0;
  let scanned = 0;
  let dirty = 0;

  for (const repo of repos) {
    let worktrees;
    try {
      worktrees = listWorktrees(makeGitRunner(repo));
    } catch {
      console.log(`\n${repo}\n  ⚠ INCONCLUSIVE — not a git repository, or git could not read it`);
      inconclusive += 1;
      continue;
    }

    console.log(`\n${repo}  (${worktrees.length} working ${worktrees.length === 1 ? 'tree' : 'trees'})`);

    for (const wt of worktrees) {
      scanned += 1;
      let report;
      try {
        report = analyzeWorktree(makeGitRunner(wt), { baseline });
      } catch (err) {
        console.log(`  ⚠ INCONCLUSIVE  ${path.basename(wt)} — ${err.message.split('\n')[0]}`);
        inconclusive += 1;
        continue;
      }

      if (report.dirty) dirty += report.dirty;

      if (report.note) {
        console.log(`  ⚠ INCONCLUSIVE  ${path.basename(wt)} — ${report.note}`);
        inconclusive += 1;
        continue;
      }

      for (const row of report.exposed) {
        exposed += 1;
        console.log(`  ⛔ EXPOSED  ${row.sha.slice(0, 9)}  ${row.subject}`);
        console.log(`       on ${report.branch}, in ${path.basename(wt)}`);
        for (const f of row.files) console.log(`       absent from ${report.baseline}:  ${f}`);
      }
      backed += report.backed.length + report.superseded.length;
    }
  }

  console.log(
    `\nscanned ${scanned} working ${scanned === 1 ? 'tree' : 'trees'} — ${exposed} exposed, ` +
      `${backed} already on the baseline, ${inconclusive} inconclusive`,
  );
  if (dirty) {
    console.log(
      `${dirty} uncommitted change${dirty === 1 ? '' : 's'} to tracked files (also single-copy, but that is ordinary work in progress — not counted as a finding)`,
    );
  }

  if (exposed) {
    console.log(
      '\nTo back one up without pushing someone else\'s branch:\n' +
        '  git -C <worktree> bundle create <name>.bundle <merge-base>..<branch>\n' +
        'Thin, read-only, and restorable from any clone that has the prerequisite.',
    );
    process.exitCode = 1;
  } else if (inconclusive) {
    process.exitCode = 2;
  }
}

main();
