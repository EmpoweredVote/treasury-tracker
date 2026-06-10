---
phase: 37-ma-loader-hardening
security_audit_date: 2026-06-10
asvs_level: 1
auditor: claude-sonnet-4-6 (automated)
threats_total: 10
threats_closed: 10
threats_open: 0
result: SECURED
---

# Phase 37 — MA Loader Hardening: Security Audit

## Summary

All 10 declared threats verified. 6 `mitigate` threats have confirmed code/config evidence. 4 `accept` threats recorded as accepted risk. 0 open threats.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-37-01 | Tampering | mitigate (exclusion override) | CLOSED | `gf-expenditures` absent from REPORTS[] — grep finds zero matches for `gf-expenditures` in scripts/scrapeMaDLS.js; comment block at lines 74-80 documents the exclusion rationale. Tampering threat eliminated by removal, not correction. |
| T-37-02 | Information Disclosure | accept | CLOSED | Accepted risk — file contains only public MA DLS HTML and DOR-code/municipality data (public records); no secrets. |
| T-37-03 | Denial of Service | mitigate | CLOSED | `DELAY_MS = 1500` at scrapeMaDLS.js:51; `sleep(DELAY_MS * 2)` between explore iterations at lines 740, 768; `sleep(DELAY_MS)` between pagination pages at lines 301, 388, 405, 420, 427. |
| T-37-SC-01 | Tampering | accept | CLOSED | Accepted risk — no new package installs; node:fs and @supabase/supabase-js already imported at lines 29-35. |
| T-37-04 | Tampering | mitigate | CLOSED | `readProgress()` at scrapeMaDLS.js:59-65 wraps `JSON.parse(readFileSync(...))` in try/catch returning `{}` on any error — malformed ledger triggers fresh start, never crash. |
| T-37-05 | Tampering | mitigate | CLOSED | `Array.isArray(existingDs.fiscal_years)` guard at scrapeMaDLS.js:645; `.includes(fiscalYear)` dedup check at line 646 gates the `.update({ fiscal_years: [...existingFiscalYears, fiscalYear] })` at lines 647-651. |
| T-37-06 | Repudiation | mitigate | CLOSED | Per-city `writeProgress(progress)` at scrapeMaDLS.js:671 (zero-amount skip branch) and line 691 (successful RPC branch), both inside the record loop. Key format `${report.name}:${fiscalYear}` at line 586 prevents report collision. Progress file never deleted (permanent ledger per D-04). |
| T-37-07 | Information Disclosure | mitigate | CLOSED | `.gitignore` line 49: `scripts/output/` — excludes progress ledger and all scrape JSON from version control. |
| T-37-08 | Denial of Service | accept | CLOSED | Accepted risk — `writeFileSync` per-record write (~1-2ms) is negligible against `DELAY_MS=1500` HTTP delay; synchronous write chosen for crash-safety. |
| T-37-SC-02 | Tampering | accept | CLOSED | Accepted risk — no new package installs; existing imports only (node:fs, @supabase/supabase-js, exceljs at lines 29-35). |

---

## Detailed Mitigation Evidence

### T-37-01: gf-expenditures removal (Exclusion Override)

The declared mitigation plan stated "LOAD-01 discovery confirms the value before any city write — blocking human checkpoint." The 37-01-SUMMARY.md documents an accepted override: the report was removed from REPORTS[] entirely after exhaustive automated search proved the rdreport is undiscoverable without browser network inspection.

Verification: `grep gf-expenditures scripts/scrapeMaDLS.js` returns zero matches. REPORTS[] contains only `special-revenue` (line 83) and `revenue-by-source` (line 93). A comment block at lines 74-80 documents the exclusion. The tampering threat (wrong rdreport labeling non-operating data as operating across 351 cities) is fully eliminated by exclusion.

### T-37-03: Rate-limiting delay

- `DELAY_MS = 1500` constant: scrapeMaDLS.js:51
- `sleep(DELAY_MS * 2)` between explores: lines 740, 768
- `sleep(DELAY_MS)` between pagination requests: lines 301, 388, 405, 420, 427
- `sleep(DELAY_MS)` before Excel export attempt: line 405

### T-37-04: readProgress try/catch

```
scrapeMaDLS.js:59-65
function readProgress() {
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return {};
  }
}
```

### T-37-05: fiscal_years Array.isArray + includes dedup

```
scrapeMaDLS.js:645-651
const existingFiscalYears = Array.isArray(existingDs.fiscal_years) ? existingDs.fiscal_years : [];
if (!existingFiscalYears.includes(fiscalYear)) {
  ... .update({ fiscal_years: [...existingFiscalYears, fiscalYear] }) ...
}
```

SELECT also correctly fetches `id, fiscal_years` (not just `id`) at line 607.

### T-37-06: Per-city writeProgress

Two write sites confirmed inside the record loop:
- Line 671: zero-amount record skip path — city recorded so re-runs skip the DB query
- Line 691: successful RPC path — `loaded++` followed by `alreadyLoaded.add(record.dorCode); progress[progressKey] = [...alreadyLoaded]; writeProgress(progress)`

End-of-run summary at line 697: `if (checkpointSkipped > 0) console.log(\`Skipped ${checkpointSkipped} already loaded (checkpoint)\`)`.

### T-37-07: .gitignore scripts/output/

`.gitignore:49` — `scripts/output/` line present, under the comment `# MA DLS scraper output — large JSON files and progress ledger`.

---

## Unregistered Flags

37-02-SUMMARY.md `## Threat Flags` section states: "None. No new network endpoints, auth paths, or trust boundaries introduced."

No unregistered flags to record.

---

## Accepted Risks Log

| Threat ID | Risk | Rationale |
|-----------|------|-----------|
| T-37-02 | explore_gf-expenditures.html on disk | Contains only public MA DLS report HTML and DOR-code/municipality data (public records); no credentials, PII, or internal data |
| T-37-SC-01 | Supply chain — npm installs | No new packages installed; all imports pre-exist at scrapeMaDLS.js lines 29-35 |
| T-37-08 | per-record writeFileSync in 351-row loop | ~1-2ms per write negligible against DELAY_MS=1500 HTTP delay; synchronous write required for crash-safety guarantee |
| T-37-SC-02 | Supply chain — npm installs (Plan 02) | Same as T-37-SC-01; confirmed no new packages |
