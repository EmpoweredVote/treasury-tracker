import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ⚠⚠ THE GUARD FOR A LEAK THAT COST A SESSION.
 *
 * On 2026-10-17 scripted UI verification left NINE orphaned Vite servers
 * running. They exhausted the machine's memory, the harness began reaping
 * background shells, and Vite's own transforms started hanging — which reads
 * like a slow machine, not like self-inflicted load. The cause took far longer
 * to find than to fix.
 *
 * Two properties prevent it, and NEITHER is self-evident from reading the
 * script later, so they are pinned here:
 *
 *   1. `--strictPort`. Without it Vite SILENTLY MOVES TO THE NEXT FREE PORT,
 *      so every retry starts a server ALONGSIDE the last one. That is the
 *      multiplier that turns one leak into nine.
 *   2. Guaranteed teardown on every exit path, not just the happy one.
 *
 * ⚠ These are source-shape assertions. They cannot prove the script works —
 * the end-to-end behaviour was verified by running it against a real stale
 * Vite — but they do catch someone quietly dropping either property.
 */

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const wrapper = readFileSync(join(ROOT, 'scripts/withDevServer.mjs'), 'utf8');
const stopper = readFileSync(join(ROOT, 'scripts/stopDevServers.mjs'), 'utf8');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

describe('dev-server lifecycle', () => {
  it('⚠⚠ starts Vite with --strictPort, so a stale server is LOUD not silent', () => {
    expect(wrapper).toMatch(/--strictPort/);
  });

  it('⚠⚠ tears the server down on every exit path', () => {
    // A `finally` covers the normal and thrown paths...
    expect(wrapper).toMatch(/finally\s*\{\s*teardown\(\)/);
    // ...and these cover the paths that skip `finally` entirely.
    expect(wrapper).toMatch(/process\.on\('exit', teardown\)/);
    for (const sig of ['SIGINT', 'SIGTERM']) expect(wrapper).toContain(sig);
  });

  it('⚠ kills the whole process TREE on Windows', () => {
    // Vite spawns an esbuild child. Killing only the node process leaves it
    // holding the port — the same leak wearing a different hat.
    expect(wrapper).toMatch(/taskkill/);
    expect(wrapper).toMatch(/'\/T'/);
  });

  it('⚠⚠ readiness means OUR VITE answered, not merely that the port is occupied', () => {
    // The first version accepted any HTTP 200 on the port. Against a squatter
    // it announced "ready" and handed the child somebody else's server — a
    // silent wrong answer, worse than the leak it was written to prevent.
    expect(wrapper).toMatch(/@vite\/client/);
    expect(wrapper).toMatch(/createHotContext|__vite__|HMRContext/);
  });

  it('⚠ refuses to proceed when Vite dies before becoming ready', () => {
    expect(wrapper).toMatch(/exitCode !== null/);
    expect(wrapper).toMatch(/dev:stop/); // names the remedy, not just the fault
  });

  it('⚠ the sweeper only ever kills a NODE process', () => {
    // Guessing from a port alone could kill something else entirely.
    expect(stopper).toMatch(/isNode\(/);
    expect(stopper).toMatch(/not a node process/);
  });

  it('exposes both commands so nobody needs to start Vite by hand', () => {
    expect(pkg.scripts['with:dev']).toBe('node scripts/withDevServer.mjs');
    expect(pkg.scripts['dev:stop']).toBe('node scripts/stopDevServers.mjs');
  });

  it('⚠ defaults off Vite’s own 5173, so it cannot collide with a human’s dev server', () => {
    expect(wrapper).toMatch(/TT_DEV_PORT \|\| 5174/);
  });
});
