---
phase: 35
slug: ca-state-3-level-icicle-pilot
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-08
---

# Phase 35 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| script → Supabase RPC | Service-role key from `.env` crosses into the DB via `treasury_sync_budget_tree` | Service-role credentials; sentinel budget writes must be cleaned up |
| Excel file → Python reader | Local trusted file (`docs/California/Historical_Expenditures.xlsx`), read-only | No untrusted input; local disk only |
| enrichCategories.js → Anthropic API | ANTHROPIC_API_KEY sent to Claude API for depth-2 node enrichment | API key; enrichment prompts containing budget category names |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-35-01 | Tampering | Sentinel FY9998 budget left in DB | mitigate | Mandatory cleanup in Plan 01 Task 2 deletes FY9998 budget; SELECT confirmed 0 rows (35-01-SUMMARY.md) | closed |
| T-35-02 | Information Disclosure | Service-role key in throwaway test script | mitigate | Temp script used `.env` loadEnv idiom (no hardcoded key); script deleted after run (35-01-SUMMARY.md) | closed |
| T-35-03 | Tampering | Sentinel write collides with real CA data | accept | FY9998 is outside the real 2022-2026 range and the $150B sanity band; RPC called directly, not via processCA.js | closed |
| T-35-04 | Information Disclosure | Hardcoded `kxsdzaojfaibhuzmclfq` SUPABASE_URL fallback in processCA.js | mitigate | D-12 edit removed fallback string; missing SUPABASE_URL now exits(2) with clear error; string confirmed absent from processCA.js (35-02-SUMMARY.md) | closed |
| T-35-05 | Tampering | `buildNLevelTree` double-counts or drops rows | mitigate | FY2026 dry-run total = $228,365,858,000 (diff $0 vs Phase 33); all 5 FYs within $150B-$300B sanity band (35-02-SUMMARY.md) | closed |
| T-35-06 | Tampering | Function-name strings used as JS Map keys | accept | Strings used only as object/Map keys and node names; no eval, no shell, no SQL string-building (RPC uses parameterized p_tree) | closed |
| T-35-07 | Tampering | Live reload corrupts or double-counts CA data | mitigate | FY2026 post-reload total = $228,365,858,000 (unchanged); all FYs inside sanity band; RPC in-place replacement leaves no orphans (35-03-SUMMARY.md, 35-VERIFICATION.md) | closed |
| T-35-08 | Tampering | Live reload wipes existing depth-0 enrichments | mitigate | 12/12 depth-0 enrichments (name-keyed) survived reload intact; confirmed before AND after enrichment run (35-VERIFICATION.md D-08 survival: PASS) | closed |
| T-35-09 | Denial of Service / Cost | Runaway enrichment API spend | mitigate | Blocking $5 cost-gate decision checkpoint with mandatory dry-run count; actual spend ~$0.06 (35-03-SUMMARY.md, 35-VERIFICATION.md) | closed |
| T-35-10 | Information Disclosure | API keys printed to logs | mitigate | Preflight confirmed env vars are SET without echoing values; keys read from env, never hardcoded (35-03-SUMMARY.md) | closed |
| T-35-SC | Tampering | npm/pip/cargo package installs | mitigate | Zero new packages installed across all 3 plans (RESEARCH.md Package Legitimacy Audit confirmed; all summaries' threat surface scans note no new packages) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-35-01 | T-35-03 | Sentinel FY9998 write is temporally isolated and outside real fiscal-year range; $150B sanity band does not apply when calling RPC directly; collision with real CA data is structurally impossible | Plan author (plan time) | 2026-06-08 |
| AR-35-02 | T-35-06 | Function-name strings (e.g. 'Local Assistance', 'State Operations') are used only as JS object keys and icicle node labels; they never enter eval, shell commands, or parameterized SQL strings — RPC receives a pre-built JSON tree object | Plan author (plan time) | 2026-06-08 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-08 | 11 | 11 | 0 | gsd-secure-phase (automated) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-08
