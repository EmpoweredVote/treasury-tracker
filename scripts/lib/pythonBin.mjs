/**
 * Resolve a Python interpreter that actually runs Python.
 *
 * NO SHEBANG — library module under scripts/lib/, guarded by tests/waSao.test.mjs.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * On this machine `python`, `python3` and `py` on PATH are Microsoft Store ALIAS
 * STUBS. They exist, they are executable, and they do not run Python: they print
 * "Python was not found; run without arguments to install from the Microsoft
 * Store" and exit non-zero. The real interpreter is a per-user install at
 * %LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe — Python 3.14.3 with
 * pdfplumber 0.11.9 and openpyxl 3.1.5, running all 166 acfrGF selftests green —
 * which PATH does not reach.
 *
 * The consequence for this repo: `execFileSync('python', …)` silently picks the
 * stub, and every extractor invocation fails with a message about the Microsoft
 * Store rather than anything to do with the data. "The command exists" is not
 * evidence that it works, so this resolver probes for a real version string
 * instead of trusting a name.
 *
 * Override with PYTHON=/path/to/python if a different interpreter is wanted.
 */

import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

/** Text the Store alias prints instead of running. */
export const STORE_STUB_MARKER = 'Microsoft Store';

/** Candidates in priority order: explicit override, the known real install, then PATH names. */
export function candidates() {
  const local = process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local');
  return [
    process.env.PYTHON,
    path.join(local, 'Python', 'pythoncore-3.14-64', 'python.exe'),
    'python3',
    'python',
    'py',
  ].filter(Boolean);
}

/** Default prober: run `<cmd> --version` and return its combined output. */
const defaultProbe = (cmd) =>
  execFileSync(cmd, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * Return the first candidate that reports a genuine Python version.
 *
 * @param {string[]} cands
 * @param {(cmd: string) => string} probe  Injected for testing
 * @returns {string}
 */
export function pickInterpreter(cands, probe = defaultProbe) {
  for (const cmd of cands) {
    let out;
    try {
      out = probe(cmd);
    } catch {
      continue; // absent, or the stub exiting non-zero
    }
    if (typeof out !== 'string') continue;
    if (out.includes(STORE_STUB_MARKER)) continue; // present but not Python
    if (/^Python \d+\.\d+/m.test(out)) return cmd;
  }
  throw new Error(
    `No working Python interpreter found. Tried: ${cands.join(', ')}\n` +
      'Set PYTHON=/path/to/python.exe if it lives somewhere else. Note that a\n' +
      'Microsoft Store alias on PATH is NOT a working interpreter.'
  );
}

/** Convenience: resolve against the real environment, memoised. */
let cached = null;
export function resolvePython() {
  if (!cached) cached = pickInterpreter(candidates());
  return cached;
}
