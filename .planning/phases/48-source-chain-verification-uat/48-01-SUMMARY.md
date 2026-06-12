# 48-01 Summary — Source-Chain Audit

**Executed:** 2026-06-12 | **Status:** Complete — 61/61 URLs PASS, zero FAIL, zero HUMAN-CHECK

- `scripts/auditFederalSources.mjs` — re-runnable auditor: pulls the full claim
  inventory live from the DB (225 rows across 10 surfaces → 61 unique URLs),
  applies the per-domain strategy (GET+UA / govinfo-via-API / browser-marked),
  verifies the budgets→source_registry chain incl. `data_source_info` in the
  production API for all 3 federal datasets, writes `48-audit-results.json`.
- Playwright content-match pass cleared all 26 bot-walled URLs: congress.gov
  bill/cosponsor pages matched their fetched titles, gao.gov matched, and all 7
  bioguide member pages matched sponsor surnames (case-insensitive — the SPA
  renders names uppercase, which caused 6 first-pass false misses).
- VERIFY-01 satisfied: report committed (`48-AUDIT.md`), zero silent failures,
  human-check residue empty.

## Deviations from plan

1. **One infrastructure fix surfaced:** `treasury.source_registry` had no
   service_role grant (loaders/auditors couldn't read it) — fixed via migration
   `20260612180000_grant_service_role_source_registry`.
2. **The expected HUMAN-CHECK residue is empty** — congress.gov's 403 wall is
   client-based only; a real browser engine passes and content-matches. 48-02's
   checklist drops the URL-residue section and keeps the rendered-chain clicks.
