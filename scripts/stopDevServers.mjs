/**
 * Find and stop every Vite dev server this repo has left running.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ⚠⚠ THE SAFETY NET, NOT THE FIX. `scripts/withDevServer.mjs` is the fix: it
 * guarantees teardown so orphans are never created. This exists because on
 * 2026-10-17 NINE orphaned servers accumulated, exhausted the machine's memory
 * and made Vite's own transforms hang — and nothing in the repo could find
 * them. Diagnosing that cost far more than the cleanup did.
 *
 * ⚠ It reports what it found even when it kills nothing, because "none
 * running" is the answer you actually want when a dev server is behaving
 * strangely. A silent no-op would leave you no wiser.
 *
 * Usage:
 *   npm run dev:stop            # report and stop
 *   npm run dev:stop -- --dry   # report only
 */

import { execFileSync, spawnSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry');
const isWin = process.platform === 'win32';

/** Every PID listening on a plausible Vite port. */
function listeners() {
  const found = new Map(); // pid -> ports[]
  try {
    if (isWin) {
      const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/.test(line)) continue;
        // Matches 127.0.0.1:5174 and [::1]:5174 alike.
        const m = line.match(/:(\d{4,5})\s+\S+\s+LISTENING\s+(\d+)/);
        if (!m) continue;
        const port = Number(m[1]);
        const pid = Number(m[2]);
        if (port < 5100 || port > 5399) continue;
        if (!found.has(pid)) found.set(pid, []);
        if (!found.get(pid).includes(port)) found.get(pid).push(port);
      }
    } else {
      const out = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' });
      for (const line of out.split('\n')) {
        const m = line.match(/^\S+\s+(\d+).*:(\d{4,5})\s+\(LISTEN\)/);
        if (!m) continue;
        const pid = Number(m[1]);
        const port = Number(m[2]);
        if (port < 5100 || port > 5399) continue;
        if (!found.has(pid)) found.set(pid, []);
        if (!found.get(pid).includes(port)) found.get(pid).push(port);
      }
    }
  } catch {
    // netstat/lsof unavailable or returned non-zero — report nothing rather
    // than guessing at PIDs. Killing the wrong process is far worse than
    // missing one.
    return found;
  }
  return found;
}

/** ⚠ Only ever kill a NODE process. Never guess from the port alone. */
function isNode(pid) {
  try {
    if (isWin) {
      const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV'], { encoding: 'utf8' });
      return /^"node\.exe"/i.test(out.trim());
    }
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' });
    return /node/i.test(out.trim());
  } catch {
    return false;
  }
}

const found = listeners();
if (found.size === 0) {
  console.log('No dev server is listening on ports 5100-5399. Nothing to stop.');
  process.exit(0);
}

let stopped = 0;
let skipped = 0;
for (const [pid, ports] of found) {
  const where = `pid ${pid} on port${ports.length > 1 ? 's' : ''} ${ports.join(', ')}`;
  if (!isNode(pid)) {
    console.log(`  SKIP  ${where} — not a node process`);
    skipped++;
    continue;
  }
  if (dryRun) {
    console.log(`  would stop  ${where}`);
    stopped++;
    continue;
  }
  // /T because Vite spawns an esbuild child that otherwise keeps the port.
  const r = isWin
    ? spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    : spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
  if (r.status === 0) { console.log(`  stopped  ${where}`); stopped++; }
  else { console.log(`  FAILED to stop  ${where}`); skipped++; }
}

console.log(
  `\n${dryRun ? 'Would stop' : 'Stopped'} ${stopped} dev server(s)`
  + `${skipped ? `, skipped ${skipped}` : ''}.`,
);
if (!dryRun && stopped > 1) {
  console.log(
    '⚠ More than one was running. Use `npm run with:dev -- <command>` for scripted\n'
    + '  browser work — it guarantees teardown, which is how these accumulate.',
  );
}
