import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.mjs', 'scripts/**/*.test.mjs'],
    // ⚠⚠ THIS IS A FIX TO THE CLASS, NOT TO ANOTHER INSTANCE.
    //
    // Dozens of tests here walk the source tree or read fixture workbooks, so
    // their duration is a property of the MACHINE, not of the code under test.
    // Measured on an idle machine they take 1-3s; observed failing runs ran
    // about 8x slower under disk contention, which puts anything over roughly
    // 625ms idle past vitest's 5,000ms default. The result is an intermittent
    // red that looks like a finding rather than a timeout — noControlBytesInSource
    // reports as "finds no C0 control byte ... failing", i.e. as though a control
    // byte HAD been found, because the assertion never ran.
    //
    // The repo has fixed this FOUR times by adding `}, 60_000)` to whichever
    // test just broke: SCOPE-02 (noUnconstrainedBudgetSums), #145
    // (frozenBaselineIntegrity), 2026-09-11 (noControlBytesInSource). Each time
    // the siblings were left exposed, and re-deriving the class on 2026-09-21
    // found four more still unprotected — loadOhioAOS (2,646ms idle),
    // flStatewide (1,668ms), loadVAComparativeReport (1,320ms) and
    // noDirectEnsureMunicipalityRpc (1,133ms).
    //
    // A per-test timeout cannot fix this, because the next filesystem test
    // written has to REMEMBER to carry one — which is the defect's own shape.
    // A safe default fixes it for tests nobody has written yet.
    //
    // ⚠ This does NOT retire the per-test convention: the explicit 60_000 and
    // 120_000 values already in the suite are higher and still win, and a test
    // that genuinely needs longer should still say so at the call site.
    //
    // ⚠ It does not break the diagnostic trick either — a CLI flag overrides
    // this, so `npx vitest run --testTimeout=1` still proves which tests carry
    // their own budget. See reference_ci_and_io_test_timeouts.
    testTimeout: 30_000,
  },
});
