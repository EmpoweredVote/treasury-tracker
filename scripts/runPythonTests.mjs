/**
 * Run the Python extractor selftests, on CI and on a developer machine.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Usage:
 *   npm run test:acfr
 *   PYTHON=/path/to/python npm run test:acfr
 *
 * ── ⚠⚠ WHY THIS EXISTS: 222 TESTS THAT CI HAD NEVER RUN ────────────────────
 *
 * `build-check.yml` ran `npm ci`, `npm run build` and `npm test` — vitest only.
 * So all 183 `acfrGF` selftests and 39 `acfrGfCoords` selftests had NEVER
 * executed on a pull request, for the life of the repo. They pin genuinely
 * subtle rules — dash-zero rows, welded-label indent, row chaining, the
 * parent/root-leaf inversion, statement_page resolution — and every one of them
 * was inert on CI.
 *
 * ⭐⭐ This is the same omission the workflow's own comment records for vitest,
 * which only became a required check in August 2026. Third occurrence. Ask of
 * EVERY harness: does anything actually run it?
 *
 * ⚠ `test:acfr` previously invoked `py -3` directly. That works on the primary
 * developer machine TODAY — but the Store-alias trap that `lib/pythonBin.mjs`
 * exists for can be re-armed by a Windows update, and CI has no `py` at all. The
 * interpreter is therefore RESOLVED, not named.
 *
 * ── ⚠⚠ A SUITE THAT CANNOT RUN IS A FAILURE, NOT A SKIP ────────────────────
 *
 * `acfrGfCoords` imports pdfplumber. The tempting behaviour is to skip that
 * suite when the dependency is absent and exit 0 — which would rebuild exactly
 * the condition this script was written to end: a green gate measuring nothing.
 * A missing dependency exits NON-ZERO and names what to install, and a run that
 * ran no suite at all refuses.
 */
import { spawnSync } from 'node:child_process';

// ⚠ Interpreter resolution is NOT reimplemented here. `resolvePython()` already
// probes for a real version string, rejects the Microsoft Store alias and honours
// $PYTHON; it is guarded by tests/waSao.test.mjs and used by ~15 scripts. A
// second copy is how the two drift apart.
import { resolvePython } from './lib/pythonBin.mjs';

const SUITES = [
  // ⚠ stdlib-only, which is why these 183 can run absolutely anywhere.
  { name: 'acfrGF', file: 'scripts/lib/acfrGF.selftest.py', requires: [] },
  // ⚠ imports pdfplumber at module load — see requirements-dev.txt.
  { name: 'acfrGfCoords', file: 'scripts/lib/acfrGfCoords.selftest.py', requires: ['pdfplumber'] },
];

let py;
try {
  py = resolvePython();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
console.log(`interpreter: ${py}\n`);

/**
 * ⚠ Checked BEFORE running the suite, so a missing module reports itself in one
 * line instead of surfacing as an ImportError buried in unittest output.
 */
function missingModules(mods) {
  return mods.filter((m) => spawnSync(py, ['-c', `import ${m}`], { stdio: 'ignore' }).status !== 0);
}

let failed = 0;
let ran = 0;
for (const s of SUITES) {
  const missing = missingModules(s.requires);
  if (missing.length) {
    console.error(`✗ ${s.name}: cannot run — missing ${missing.join(', ')}. Install with:  `
      + `${py} -m pip install -r requirements-dev.txt`);
    failed += 1;
    continue;
  }
  const r = spawnSync(py, [s.file], { stdio: 'inherit' });
  ran += 1;
  if (r.status !== 0) failed += 1;
}

// ⚠⚠ A run that ran NOTHING must not look like success — the whole point.
if (ran === 0 && failed === 0) {
  console.error('REFUSING: no Python suite ran.');
  process.exit(1);
}
if (failed) {
  console.error(`\n✗ ${failed} Python suite(s) failed or could not run.`);
  process.exit(1);
}
console.log(`\n✅ ${ran} Python suite(s) passed, ${SUITES.length} declared.`);
