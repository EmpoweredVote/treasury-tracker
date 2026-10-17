/**
 * Run a command against a throwaway dev server, and ALWAYS take the server down.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── ⚠⚠ WHY THIS EXISTS ─────────────────────────────────────────────────────
 *
 * On 2026-10-17 a UI-verification session left **NINE** orphaned Vite servers
 * running. They exhausted the machine's memory, the harness started reaping
 * background shells, and — before anyone noticed the cause — Vite's own
 * transforms began hanging, which read like a slow machine rather than like
 * self-inflicted load. Two faults compounded:
 *
 *   1. **Vite SILENTLY MOVES TO THE NEXT FREE PORT** when the requested one is
 *      taken ("Port 5199 is in use, trying another one..."). So every retry
 *      started a server ALONGSIDE the previous one instead of failing. That is
 *      the multiplier that turned one leak into nine.
 *   2. **Nothing guaranteed teardown.** A driver that threw, timed out, or was
 *      killed left its server running forever.
 *
 * This script fixes both: `--strictPort` makes a stale server a LOUD failure,
 * and the server is killed in a `finally` plus on every exit signal, so no path
 * through this script leaves one behind.
 *
 * ⚠ USE THIS RATHER THAN STARTING `vite` BY HAND for any scripted browser
 * work. Starting one by hand is how the leak happened.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   npm run with:dev -- node path/to/driver.mjs http://localhost:5174 ...
 *   TT_DEV_PORT=5190 npm run with:dev -- <command...>
 *
 * The server's base URL is also exported to the child as `TT_DEV_URL`.
 *
 * ⚠ Defaults to port 5174, NOT Vite's 5173, so it cannot collide with a dev
 * server a human is already running.
 *
 * ⚠ `VITE_API_URL` is passed through. The local :5050 backend is usually not
 * running, so without it the app hangs on "Loading budget data..." — point it
 * at the production API (see project_local_ui_verify_workflow).
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.TT_DEV_PORT || 5174);
const BASE = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = Number(process.env.TT_DEV_READY_MS || 180_000);

const VITE = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(VITE)) {
  console.error(`Cannot find Vite at ${VITE} — run from the repo root.`);
  process.exit(2);
}

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error('Usage: node scripts/withDevServer.mjs <command> [args...]');
  process.exit(2);
}

let server = null;
let tornDown = false;

/**
 * ⚠⚠ ON WINDOWS, KILLING THE NODE PROCESS IS NOT ENOUGH. Vite spawns an
 * esbuild service as a child; `process.kill` leaves it running and holding the
 * port, which is its own flavour of the leak this script exists to prevent.
 * `taskkill /T` takes the whole tree.
 */
function teardown() {
  if (tornDown || !server || server.exitCode !== null) return;
  tornDown = true;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-server.pid, 'SIGTERM');
    }
  } catch {
    // Already gone. Nothing to do, and never let cleanup mask the real error.
  }
}

// Belt and braces: a `finally` covers the normal and thrown paths, these cover
// the ones that skip it entirely.
process.on('exit', teardown);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(sig, () => { teardown(); process.exit(130); });
}
process.on('uncaughtException', (err) => { teardown(); throw err; });

/**
 * ⚠⚠ "SOMETHING ANSWERS ON THE PORT" IS NOT "OUR VITE IS READY".
 *
 * The first version of this probe accepted any HTTP 200 on the port. Tested
 * against a squatter holding 5174, it announced "ready", handed the child that
 * URL, and the child happily drove SOMEBODY ELSE'S SERVER — while Vite had
 * already exited on the port clash. A silent wrong answer, which is worse than
 * the leak this script was written to prevent.
 *
 * So the probe asks for `/@vite/client`, a module only a Vite dev server
 * serves, and checks the body actually looks like it. A stale TT dev server
 * would still answer that — which is correct and intended: `--strictPort`
 * means ours never starts, Vite exits non-zero, and the clash is reported.
 */
async function isOurVite() {
  try {
    const res = await fetch(`${BASE}/@vite/client`, { signal: AbortSignal.timeout(2_000) });
    if (!res.ok) return false;
    const body = await res.text();
    return /createHotContext|__vite__|HMRContext/.test(body);
  } catch {
    return false;
  }
}

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // ⚠ Checked FIRST and again after the probe: strictPort makes a port clash
    // an immediate non-zero exit, and that must surface as a failure rather
    // than be raced past by whatever is already answering on the port.
    if (server.exitCode !== null) {
      throw new Error(
        `Vite exited (code ${server.exitCode}) before becoming ready — port ${PORT} is `
        + `probably already in use. Run \`npm run dev:stop\` to clear stale servers.`,
      );
    }
    if (await isOurVite()) return;
  }
  throw new Error(`Vite did not become ready on ${BASE} within ${READY_TIMEOUT_MS}ms.`);
}

async function main() {
  server = spawn(
    process.execPath,
    [VITE, '--port', String(PORT), '--strictPort', '--logLevel', 'warn'],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: process.platform !== 'win32',
      env: process.env,
    },
  );

  try {
    await waitForReady();
    console.log(`[with-dev-server] ready on ${BASE}`);

    // ⚠ NO `shell: true` ON THE HAPPY PATH. Node deprecated passing args with
    // a shell (DEP0190) because the args are concatenated unescaped. Most
    // commands — `node`, an absolute path, a .exe — spawn fine without one.
    // Only a Windows batch wrapper (`npx`, `npm`) needs a shell, so fall back
    // to one ONLY after a genuine ENOENT rather than reaching for it first.
    const env = { ...process.env, TT_DEV_URL: BASE };
    let child = spawn(command[0], command.slice(1), { stdio: 'inherit', env });
    const spawnErr = await Promise.race([
      once(child, 'error').then(([e]) => e),
      once(child, 'spawn').then(() => null),
    ]);
    if (spawnErr) {
      if (spawnErr.code !== 'ENOENT' || process.platform !== 'win32') throw spawnErr;
      child = spawn(command[0], command.slice(1), { stdio: 'inherit', env, shell: true });
    }
    const [code] = await once(child, 'close');
    return code ?? 0;
  } finally {
    teardown();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[with-dev-server] ${err.message}`);
    process.exit(1);
  });
