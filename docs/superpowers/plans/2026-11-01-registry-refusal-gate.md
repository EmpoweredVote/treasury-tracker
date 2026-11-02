# Registry Refusal Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it impossible to write a budget row whose source family no registry entry matches, or which carries no `source_url`.

**Architecture:** The gate lives in `treasury_sync_city_budget` — the one chokepoint all 34 JS call sites funnel through — backed by a table mirroring the four registries' match patterns, synced by a script. A cheap network-free preflight gives loaders the same answer before they spend money or time. Because the RPC reports failure *inside* a successful PostgREST call and 32 callers ignore that payload, routing every caller through `classifySyncResult` is Task 1 and not optional.

**Tech Stack:** Node ESM, vitest, Supabase/Postgres, `supabase/migrations/*.sql` applied via `mcp__supabase-local__apply_migration`.

**Spec:** `docs/superpowers/specs/2026-11-01-registry-refusal-gate-design.md`

## Global Constraints

- The frozen invariant is **62,587 / `60098de6`** and must be unchanged at every commit. `npm run verify:frozen` after any task that touches the database. **Never regenerate `figures_frozen` to make it pass.**
- The gate tests whether a registry entry **matches** a family. It never tests whether a value is non-`unknown`. A family whose cited answer is `unknown` passes.
- All four axis registries must match: `AUDIT_GRADE_REGISTRY`, `FUND_SCOPE_REGISTRY`, `BASIS_REGISTRY`, `ACCOUNTING_BASIS_REGISTRY`. `REPORTING_ENTITY_REGISTRY` is **not** in scope.
- DDL goes through `mcp__supabase-local__apply_migration`, named `202611NNNNNN_<slug>.sql`, then verified.
- Any new SECURITY DEFINER function must `revoke all on function … from public, anon;` in the same migration, and `npm run verify:grants` must stay green.
- Logic goes in `scripts/lib/*.mjs` so it is unit-testable without a database. No shebang in `scripts/lib/` — it breaks the Vite transform on a CRLF checkout.
- Tests must not read gitignored directories without a loud skip guard. Before pushing, run the suite with `cache/`, `_oh-recon/` and `docs/OhioAOS/` hidden.
- Never push to `main`; branch and open a PR.

## Review Focus

Five things the spec implies that no task's happy path exercises. Each has a test added to the task that owns the code.

1. **A JS regex that does not mean the same thing in Postgres.** `(?:…)`, lookahead, `\d`, and inline flags are not POSIX. A pattern that silently fails to match re-creates the exact bug this gate prevents. — Task 2.
2. **A `data_source` containing regex metacharacters or a `%`.** Family names here include `—`, `(`, `)`, `.` and `+`. — Task 2.
3. **A stale mirror.** Someone adds a registry entry and forgets to sync, so the gate refuses a family that *is* registered. This is the single most likely cause of someone disabling the gate. — Task 4.
4. **An empty-string `source_url`, not just NULL.** 24,947 rows are `null or ''`; a NOT NULL check alone misses half the shape. — Task 5.
5. **A refusal arriving at a caller that previously swallowed it.** Without this the Task 1 prerequisite is unverified. — Task 1.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/registeredFamilies.mjs` | **new.** Pure: given the four registries, produce the mirror rows; given a `data_source`, say which axes match. No DB, no I/O. |
| `scripts/lib/rpcResult.mjs` | modify. Add the `unregistered-family` outcome to `classifySyncResult`. |
| `scripts/syncRegisteredFamilies.mjs` | **new.** Entry point. Writes the mirror table from the registries; `--check` exits non-zero when stale. |
| `scripts/verifyProvenanceGate.mjs` | **new.** Entry point. The ratchet over existing debt. `npm run verify:provenance`. |
| `supabase/migrations/202611NNNNNN_registered_source_families.sql` | **new.** The mirror table. |
| `supabase/migrations/202611NNNNNN_sync_city_budget_registry_gate.sql` | **new.** The refusal inside the RPC. |
| 32 loader scripts | modify. Import and use `classifySyncResult`. |

---

### Task 1: Every RPC caller can hear a refusal

The prerequisite. Until this lands, a refusal is a silent no-op at 32 of 34 call sites.

**Files:**
- Modify: `scripts/lib/rpcResult.mjs`
- Modify: the 32 scripts listed under "32 of 34 call sites cannot currently hear a refusal" in the spec
- Test: `tests/rpcResult.test.mjs`

**Interfaces:**
- Produces: `classifySyncResult(result) -> { outcome: 'success'|'refused'|'empty', error: string|null, rowsInserted: number }` — `outcome: 'refused'` is what every caller must treat as a failure and a non-zero exit.

- [ ] **Step 1: Write the failing test** — in `tests/rpcResult.test.mjs`, `classifySyncResult({ error: 'unregistered source family: Transparent Utah' })` returns `outcome: 'refused'` and carries the message; `classifySyncResult({ rows_inserted: 0 })` returns `outcome: 'empty'`, **not** `'refused'`.
- [ ] **Step 2: Run `npx vitest run tests/rpcResult.test.mjs`** — expect FAIL.
- [ ] **Step 3: Extend `classifySyncResult` in `scripts/lib/rpcResult.mjs`** to return the three outcomes above. Keep the existing behaviour for every error string it already classifies.
- [ ] **Step 4: Run the test** — expect PASS.
- [ ] **Step 5: Write the Review-Focus #5 test** — pick `loadVAComparativeReport.js`, inject a stubbed client whose RPC returns `{ error: 'unregistered source family: X' }`, and assert the loader exits non-zero and prints the message. This is the test that proves the prerequisite, so it goes in before the 32 edits, not after.
- [ ] **Step 6: Run it** — expect FAIL.
- [ ] **Step 7: Change the 32 scripts** to import `classifySyncResult` and fail on `outcome: 'refused'`. Mechanical and repetitive; keep each script's existing success logging.
- [ ] **Step 8: Run `npm test`** — expect PASS, and no loader's existing tests broken.
- [ ] **Step 9: Commit.** `fix(loaders): every RPC caller can hear a refusal`

---

### Task 2: Which families are registered — the pure logic

**Files:**
- Create: `scripts/lib/registeredFamilies.mjs`
- Test: `tests/registeredFamilies.test.mjs`

**Interfaces:**
- Produces:
  - `matchedAxes(dataSource) -> { audit_grade: string|null, fund_scope: string|null, basis: string|null, accounting_basis: string|null }` — each value is the matching entry's `id`, or `null`.
  - `isFullyRegistered(dataSource) -> boolean` — true only when all four are non-null.
  - `mirrorRows() -> Array<{ axis: string, entry_id: string, pattern: string }>` — `pattern` is a **POSIX** regex for Postgres `~`.
  - `suggestEntry(dataSource, fiscalYears) -> string` — the paste-ready entry text.

- [ ] **Step 1: Write the failing tests.** (a) a `data_source` matching all four returns four ids and `isFullyRegistered` true; (b) one matching three returns a `null` and false; (c) **Review Focus #2** — a family name containing `—`, `(`, `)` and `.` matches correctly and its generated pattern escapes the metacharacters; (d) **Review Focus #1** — `mirrorRows()` emits no `(?:`, no `(?=`, no `\d`, and no inline `(?i)`, asserted over **every entry in all four live registries**, not a fixture.
- [ ] **Step 2: Run `npx vitest run tests/registeredFamilies.test.mjs`** — expect FAIL, module not found.
- [ ] **Step 3: Implement the four functions.** Reuse the registries' own matching so JS-side answers cannot drift from the stamping scripts. For `mirrorRows`, translate each `match` to POSIX: `(?:` → `(`, `\d` → `[0-9]`, and **throw** on any construct with no POSIX equivalent rather than emitting something that silently will not match.
- [ ] **Step 4: Run the tests** — expect PASS.
- [ ] **Step 5: Write the equivalence proof** — a test that, for every entry in all four registries, generates a sample string the JS regex matches and asserts the POSIX pattern matches it too, using Postgres' own engine via one `select … ~ …` round trip. Skip loudly with a named reason when no database is configured.
- [ ] **Step 6: Run it** — expect PASS, and confirm it SKIPS (not passes) with the database unset.
- [ ] **Step 7: Commit.** `feat(gate): which source families are registered, and their POSIX patterns`

---

### Task 3: The mirror table

**Files:**
- Create: `supabase/migrations/202611NNNNNN_registered_source_families.sql`
- Create: `scripts/syncRegisteredFamilies.mjs`
- Test: `tests/registeredFamiliesSync.test.mjs`

**Interfaces:**
- Consumes: `mirrorRows()` from Task 2.
- Produces: table `treasury.registered_source_families (axis text, entry_id text, pattern text, primary key (axis, entry_id))`; `node scripts/syncRegisteredFamilies.mjs [--check]`.

- [ ] **Step 1: Write the failing test** — the sync's diff is computed by a pure helper `diffMirror(wanted, actual) -> { insert, update, delete }`; assert it is **set-based**, so a row present twice on one side and once on the other is not reported as drift. ⚠ `diffFrozenExclusionMirror.mjs` reports 81 ids forever because it compares file-by-file; do not repeat it.
- [ ] **Step 2: Run it** — expect FAIL.
- [ ] **Step 3: Apply the migration** via `mcp__supabase-local__apply_migration`. Table only, no function, so no grant revoke needed — confirm with `npm run verify:grants`.
- [ ] **Step 4: Implement `diffMirror` and the sync script.** `--check` writes nothing and exits 1 when the mirror differs from the registries.
- [ ] **Step 5: Run the test and the sync** — expect PASS; then `node scripts/syncRegisteredFamilies.mjs --check` exits 0.
- [ ] **Step 6: Verify** `npm run verify:frozen` is 62,587 / `60098de6`.
- [ ] **Step 7: Commit.** `feat(gate): mirror the registry patterns into the database`

---

### Task 4: The preflight

**Files:**
- Modify: `scripts/lib/registeredFamilies.mjs`
- Modify: `scripts/loadUtahTransparency.js`, `scripts/loadOhioAOS.js`, `scripts/loadVAComparativeReport.js`
- Test: `tests/registeredFamilies.test.mjs`

**Interfaces:**
- Produces: `assertRegisteredFamily(dataSource, { fiscalYears })` — returns undefined, or throws an `Error` whose message names the unmatched axes and contains the `suggestEntry` text.

- [ ] **Step 1: Write the failing tests.** (a) an unregistered family throws, and the message contains both the family name and a paste-ready entry; (b) a registered one does not throw; (c) **Review Focus #3** — the error message tells the reader to run `node scripts/syncRegisteredFamilies.mjs` when the registries match but the mirror does not, so a stale mirror does not read as "you forgot to classify this".
- [ ] **Step 2: Run them** — expect FAIL.
- [ ] **Step 3: Implement `assertRegisteredFamily`.** Network-free and database-free: it reads the registries directly, not the mirror.
- [ ] **Step 4: Run the tests** — expect PASS.
- [ ] **Step 5: Call it in the three loaders, before any fetch.** In `loadUtahTransparency.js` it must come **before** the BigQuery scan — that is the whole point; a refusal after the scan has already cost money.
- [ ] **Step 6: Verify by running** `node scripts/loadUtahTransparency.js --rollup` with Utah unregistered and confirming it exits **without** reaching BigQuery. ⚠ Do not pass `--confirm`. The preview is free; a billed scan is not.
- [ ] **Step 7: Commit.** `feat(gate): a preflight, so an unregistered family costs nothing to discover`

---

### Task 5: The refusal in the RPC

**Files:**
- Create: `supabase/migrations/202611NNNNNN_sync_city_budget_registry_gate.sql`
- Test: `tests/registryGateRpc.test.mjs`

**Interfaces:**
- Consumes: `treasury.registered_source_families` from Task 3; `classifySyncResult` from Task 1.
- Produces: the RPC returns `{"error": "unregistered source family: <name> (unmatched: audit_grade, basis)"}` and inserts nothing.

- [ ] **Step 1: Write the failing test** — call the RPC with a `data_source` of `ZZZ Test Family` and assert `classifySyncResult` gives `outcome: 'refused'` **and** that `select count(*) from treasury.budgets where data_source = 'ZZZ Test Family'` is 0. Skip loudly without a database.
- [ ] **Step 2: Run it** — expect FAIL: the row is written.
- [ ] **Step 3: Write the second failing test — Review Focus #4** — the RPC refuses `p_source_url` of `''` as well as NULL, with a distinct message.
- [ ] **Step 4: Run it** — expect FAIL.
- [ ] **Step 5: Apply the migration.** Both checks run **before** any insert and return the `{error}` shape the existing blanket handler already uses, so `classifySyncResult` sees them. ⚠ Guard the registry check so all four axes must match.
- [ ] **Step 6: Run both tests** — expect PASS. Then delete the test rows if any leaked and confirm `npm run verify:frozen` is 62,587 / `60098de6`.
- [ ] **Step 7: Run `npm run verify:grants`** — expect PASS, 16 accepted exposures, nothing new.
- [ ] **Step 8: Commit.** `feat(gate): the RPC refuses an unregistered family and a row with no link`

---

### Task 6: The ratchet over existing debt

**Files:**
- Create: `scripts/verifyProvenanceGate.mjs`
- Modify: `package.json` (add `verify:provenance`)
- Test: `tests/provenanceRatchet.test.mjs`

**Interfaces:**
- Produces: `npm run verify:provenance`; a pure `summarizeProvenanceDebt(rows, baseline) -> { worse: [], same: [], better: [] }` in `scripts/lib/registeredFamilies.mjs`.
- Baselines, measured 2026-11-01: **1,302** rows unknown on all four axes; **24,947** rows with no `source_url`.

- [ ] **Step 1: Write the failing test** — a source one row worse than baseline fails; equal passes; better passes and reports the improvement.
- [ ] **Step 2: Run it** — expect FAIL.
- [ ] **Step 3: Implement `summarizeProvenanceDebt` and the script**, following `scripts/verifyTotalsTieToTree.mjs` for shape, including its `--print-sql` and `--check <rows.json>` offline paths.
- [ ] **Step 4: Run the test and `npm run verify:provenance`** — expect PASS against the two baselines above.
- [ ] **Step 5: Commit.** `feat(gate): ratchet the existing provenance debt`

---

### Task 7: Classify Virginia — the dogfood

**Evidence work, not code.** Done by hand, deliberately, to learn what the generated entry in Task 4 should contain. Do this **after** Task 1 and **before** Task 4 is finalised.

**Files:**
- Modify: `scripts/data/auditGradeRegistry.mjs`, `fundScopeRegistry.mjs`, `basisRegistry.mjs`, `accountingBasisRegistry.mjs`
- Test: `tests/auditGradeRegistry.test.mjs`

- [ ] **Step 1: Read the source.** The 608 rows carry 3 links, e.g. `https://data.virginia.gov/dataset/2024-amended-comparative-report-of-local-government-revenues-and-expenditures`. Establish from the APA's own publication whether these figures are audited, their fund scope, and their basis. **Record what the document says, not what seems likely** — an entry whose value is not `unknown` must carry evidence, and `validateAxisRegistry` enforces that.
- [ ] **Step 2: Write the failing test** — `gradeFor()` on a real Virginia `data_source` returns the established value and entry id; a fiscal year outside the window read returns `unknown`. ⚠ Enumerate the years; a bare `FY\d{4}` grades a future filing off a document nobody opened.
- [ ] **Step 3: Run it** — expect FAIL.
- [ ] **Step 4: Add the four entries**, byte-identical in `match`, as the LA load established.
- [ ] **Step 5: Run `npx vitest run tests/auditGradeRegistry.test.mjs` and `node scripts/verifyAxisStamps.mjs --like "Virginia APA%"`** — expect PASS.
- [ ] **Step 6: Stamp the 608 rows** with the existing stamping scripts, then re-run `verify:provenance` and confirm the 1,302 baseline drops by 608. Confirm `verify:frozen` unchanged.
- [ ] **Step 7: Commit.** `feat(va): classify the APA Comparative Report on all four axes`

---

### Task 8: Classify Utah through the new path, then arm

**Files:**
- Modify: the four registries
- Test: `tests/auditGradeRegistry.test.mjs`

- [ ] **Step 1: Run `node scripts/loadUtahTransparency.js --rollup`** (preview only — **never `--confirm`**) and confirm the Task 4 preflight refuses it and prints a paste-ready entry, before BigQuery is touched.
- [ ] **Step 2: Establish the evidence** from the State Auditor's published description of Transparent Utah. ⚠ Zero BigQuery: a registry entry is read from what the publisher says about its data, never from re-querying it.
- [ ] **Step 3: Write the failing test, run it, add the entries, run it again** — same shape as Task 7.
- [ ] **Step 4: Re-run the preflight** and confirm it now passes.
- [ ] **Step 5: Run the full suite, the build, `verify:frozen`, `verify:totals`, `verify:grants`, `verify:provenance`** — all green, frozen at 62,587 / `60098de6`.
- [ ] **Step 6: Run the CI simulation** with `cache/`, `_oh-recon/` and `docs/OhioAOS/` hidden; confirm 0 failures and that new tests **skip** rather than error.
- [ ] **Step 7: Commit and open the PR.** `feat(ut): classify Transparent Utah, and arm the gate`

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task. The spec's two explicit non-goals — draining the backlog and checking that a link resolves — have no task, by design.
- **Left open deliberately:** whether Utah's bare `https://transparent.utah.gov` counts as "directly to the source". It is a present link, so it passes this gate; the spec flags it as a separate decision.
- **Proportion:** eight tasks, one of which is mechanical (Task 1's 32 edits) and two of which are evidence work. The plan is shorter than the code it describes.
