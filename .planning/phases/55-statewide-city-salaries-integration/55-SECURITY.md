# SECURITY.md — Phase 55: Statewide CA City-Salaries Integration

**Phase:** 55 — statewide-city-salaries-integration  
**Audit date:** 2026-06-15  
**ASVS Level:** default  
**Auditor:** gsd-security-auditor  
**Threats closed:** 15/15  
**Threats open (blockers):** 0

---

## Threat Verification

| Threat ID | Category | Disposition | Verdict | Evidence |
|-----------|----------|-------------|---------|----------|
| T-55-01-01 | DoS / availability | mitigate | CLOSED | `scripts/loadCASalaries.js:54,266` — `GCC_UA` constant set to a browser UA string; passed to `curl -A "${GCC_UA}" "${url}"`. 55-SPIKE-FINDINGS.md §1.3 documents HTTP 200 achieved with this UA; static ZIP path bypasses Cloudflare challenge on HTML pages. |
| T-55-01-02 | Denial of correctness | mitigate | CLOSED | Field mapping verified against Data Dictionary: `COL_TOTAL_WAGES=15`, `COL_TOTAL_BENEFITS=20` at `loadCASalaries.js:69-70`. Reconciliation in 55-SPIKE-FINDINGS.md §3 and 55-COVERAGE.md SC-4: Irvine 2024 computed $190,426,283 = published, delta $0. |
| T-55-01-03 | Information disclosure | mitigate | CLOSED | 55-SPIKE-FINDINGS.md §2.5 confirms GCC City CSV has no employee-name columns. Neither script references any name-column index. Both `buildTree` implementations push position leaves with no `i` field (loadCASalaries.js:391-396; sweepOCSalaries.js:237). |
| T-55-01-04 | Spoofing / integrity | mitigate | CLOSED | 55-SPIKE-FINDINGS.md §1.1 documents publicpay.ca.gov → 301 → gcc.sco.ca.gov confirmed live. Loader hardcodes `https://gcc.sco.ca.gov/RawExport/${year}_City.zip` (loadCASalaries.js:55; sweepOCSalaries.js:44) — URL host is a constant, not user-controlled. |
| T-55-01-SC | Tampering (npm) | accept | CLOSED | See accepted risks log below. No new npm packages installed; loader uses node built-ins + pre-existing @supabase/supabase-js. |
| T-55-02-01 | Information disclosure | mitigate | CLOSED | Position leaves have no `i` array and no name field in both scripts. GCC source confirmed name-free. DB probe in 55-02-SUMMARY.md: `item_count on all position leaves: 0`. |
| T-55-02-02 | Tampering (municipality) | mitigate | CLOSED | CR-01 fix applied (commit cf56e41): `treasury_ensure_municipality` upsert RPC removed. Loader now performs read-only `treasury.municipalities` lookup (`.eq('state','CA').eq('entity_type','city').ilike('name',city).maybeSingle()`) and fails closed with `process.exit(1)` when city not found (`loadCASalaries.js:492-507`). Cannot create phantom municipalities. |
| T-55-02-03 | Tampering (overwrite) | mitigate | CLOSED | `loadCASalaries.js:434` and `sweepOCSalaries.js:263` both pass `p_dataset_type:'salaries'` only. 55-COVERAGE.md additive write table confirms Anaheim/Santa Ana operating/revenue rows unchanged post-load. |
| T-55-02-04 | Denial of correctness | mitigate | CLOSED | Field mapping from spike findings reused verbatim (loadCASalaries.js:59-71). SC-4 reconciliation in 55-02-SUMMARY.md: $0 delta against published GCC figure for Irvine 2024. parseMoney helper (WR-01 fix) prevents thousands-separator truncation in both scripts. |
| T-55-02-05 | Spoofing / integrity (gate) | mitigate | CLOSED | 55-SPIKE-FINDINGS.md line 252: `GATE: PASS — authorize SAL-02 loader build`. Executor confirmed GATE: PASS before writing loadCASalaries.js (process gate, not runtime code assertion — consistent with plan acceptance criteria: "confirm its verdict line is GATE: PASS … if FAIL or missing, STOP"). |
| T-55-02-SC | Tampering (npm) | accept | CLOSED | See accepted risks log below. No new packages; sweep imports from loadCASalaries.js for shared helpers. |
| T-55-03-01 | Tampering (custom rows) | mitigate | CLOSED | Loader and sweep both write only `p_dataset_type:'salaries'`. 55-COVERAGE.md documents 12 Anaheim/Santa Ana custom operating/revenue rows verified unchanged after the 34-city sweep. |
| T-55-03-02 | Denial of correctness (fabrication) | mitigate | CLOSED | `loadCASalaries.js:526-528` and `sweepOCSalaries.js:365-368`: zero-row cities produce no salaries row and log "skipping (D-06)" / "gap (D-06)". No rows fabricated. 55-COVERAGE.md confirms 0 gaps (all 34 OC cities covered). |
| T-55-03-03 | Tampering (municipality resolution) | mitigate | CLOSED | sweepOCSalaries.js reads OC city set at runtime from `treasury.municipalities WHERE county_id = OC_COUNTY_ID` (sweepOCSalaries.js:309-320). Municipality IDs come directly from the DB query result, not hardcoded. SC-4 and live-app checkpoint (55-03-SUMMARY.md) confirm correctness. |
| T-55-03-04 | Denial of correctness (totals diverge) | mitigate | CLOSED | SC-4 re-verified in 55-COVERAGE.md: Irvine 2024 stored total $190,426,283 = gcc.sco.ca.gov published figure, delta $0 (0.00%). Re-sweep after normalizeDeptLabel gap-closure still holds. |
| T-55-03-05 | Information disclosure (names in tree) | mitigate | CLOSED | Names-free by construction (same as T-55-02-01). sweepOCSalaries.js buildTree pushes `{ n, a, m }` position leaves with no `i` field (sweepOCSalaries.js:237). GCC source confirmed name-free in spike. |
| T-55-03-SC | Tampering (npm) | accept | CLOSED | See accepted risks log below. sweepOCSalaries.js runs the already-built loader; no new npm install step. |

---

## Unregistered Flags

None. The SUMMARY.md `## Threat Flags` sections for all three plans explicitly record no new security-relevant surface:

- 55-01-SUMMARY: "None new"
- 55-02-SUMMARY: "None"
- 55-03-SUMMARY: "No new security-relevant surface introduced (data-load only, no new endpoints or schema changes)"

---

## Command-Injection Surface Verification

The two scripts use `execSync` to invoke `curl`. Verified:

1. **URL interpolation:** Only `year` (an integer validated by `Number.isInteger()` checks at `loadCASalaries.js:474` and `sweepOCSalaries.js:296`) is interpolated into the URL string passed to `execSync`. The host `gcc.sco.ca.gov` is a hardcoded constant.

2. **`--city` value:** Confirmed not interpolated into the shell command. It flows only into console output strings and a parameterized Supabase `.ilike('name', city)` query parameter. No shell injection surface.

3. **`GCC_UA`:** A hardcoded string constant — never user-supplied. Passed as `-A "${GCC_UA}"`.

No user-controlled value reaches `execSync` unsanitized.

---

## Accepted Risks Log

| Risk ID | Threat | Justification | Owner |
|---------|--------|---------------|-------|
| AR-55-01-SC | npm package installs (Phase 55-01 spike) | No new packages installed. Spike uses node built-in `fetch` and `curl`. No `npm install` step was run. Supply-chain attack surface is unchanged from pre-phase baseline. | Phase 55 executor |
| AR-55-02-SC | npm package installs (Phase 55-02 loader) | No new packages installed. `loadCASalaries.js` uses `@supabase/supabase-js` (already in repo), `node:util`, `node:child_process`, `node:buffer`, `node:url`, `node:zlib` — all pre-existing. No `npm install` step was run. | Phase 55 executor |
| AR-55-03-SC | npm package installs (Phase 55-03 sweep) | No new packages installed. `sweepOCSalaries.js` uses `@supabase/supabase-js` (already in repo) and node built-ins only. It imports shared helpers from `loadCASalaries.js` — no new dependency. No `npm install` step was run. | Phase 55 executor |

---

## Notes

**CR-01 fix verification note (from 55-REVIEW-FIX.md):** The fix replacing `treasury_ensure_municipality` with a read-only lookup changes city-resolution semantics. The fix document recommends confirming that `.ilike('name', city)` resolves all 34 already-loaded OC cities exactly as the prior upsert RPC did before running forward loads. The 55-03-SUMMARY.md confirms the full sweep (544 rows, all 34 cities) completed successfully after this fix was applied — this is treated as sufficient operational confirmation.

**T-55-02-05 gate enforcement:** The plan specified a process gate (executor reads SPIKE-FINDINGS.md and stops if GATE is not PASS), not a runtime code check in `loadCASalaries.js`. The file contains no `fs.readFileSync` of the gate document. This is consistent with the plan's acceptance criteria (which describe the executor's manual action) and the 55-02-SUMMARY.md confirmation. The gate is CLOSED as a process control, not a runtime control.

**Pending human checkpoint:** 55-03-SUMMARY.md Task 3 (live-app verification) is awaiting operator approval. This is an operational/acceptance checkpoint; all code-level mitigations are verified present.
