---
phase: 25
slug: la-county-data-completion-county-city-linking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No automated test framework — verification via DB queries + API checks + manual UI |
| **Config file** | none |
| **Quick run command** | `node scripts/loadLACountyOperating.js --dry-run` |
| **Full suite command** | Supabase DB queries (see Per-Task map) + manual UI walkthrough |
| **Estimated runtime** | ~2 minutes (DB queries + manual checks) |

---

## Sampling Rate

- **After every task commit:** Run the relevant DB verification query from the Per-Task map
- **After every plan wave:** Full DB state verification + API response check
- **Before `/gsd-verify-work`:** Manual UI walkthrough — county page + city breadcrumb
- **Max feedback latency:** ~5 minutes per task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-T1 | 01 | 1 | D-01 | — | N/A | DB query | `SELECT count(*) FROM treasury.budgets WHERE municipality_id='f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1' AND dataset_type IN ('operating','revenue')` → 0 after delete | ✅ | ⬜ pending |
| 25-01-T2 | 01 | 1 | D-01/D-02 | — | N/A | DB query | `SELECT fiscal_year, total_budget FROM treasury.budgets WHERE municipality_id='f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1' AND dataset_type='operating' ORDER BY fiscal_year` → 4 rows (FY2021~32B, FY2022~33B, FY2023~35B, FY2024~38B) | ✅ | ⬜ pending |
| 25-01-T3 | 01 | 1 | D-01/D-02 | — | N/A | DB query | Same for dataset_type='revenue' → 4 rows (FY2021~32B, FY2022~34B, FY2023~36B, FY2024~39B) | ✅ | ⬜ pending |
| 25-01-T4 | 01 | 1 | D-03 | — | N/A | DB query | `SELECT population, population_year FROM treasury.municipalities WHERE id='f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1'` → 10014009, 2020 | ✅ | ⬜ pending |
| 25-01-T5 | 01 | 1 | D-01 | — | N/A | DB query | `SELECT count(*) FROM treasury.budgets WHERE municipality_id='f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1' AND data_source_id IS NULL AND dataset_type IN ('operating','revenue')` → 0 | ✅ | ⬜ pending |
| 25-02-T1 | 02 | 2 | D-04/D-05 | — | N/A | DB query | `SELECT column_name FROM information_schema.columns WHERE table_schema='treasury' AND table_name='municipalities' AND column_name='county_id'` → 1 row | ✅ | ⬜ pending |
| 25-02-T2 | 02 | 2 | D-04 | — | N/A | DB query | `SELECT count(*) FROM treasury.municipalities WHERE county_id='f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1'` → 88 | ✅ | ⬜ pending |
| 25-02-T3 | 02 | 2 | D-05 | — | N/A | DB query | San Diego city, Sacramento city, Berkeley, Fremont each have non-null county_id | ✅ | ⬜ pending |
| 25-02-T4 | 02 | 2 | D-06 | — | N/A | DB query | `SELECT county_id FROM treasury.municipalities WHERE name='San Francisco' AND state='CA'` → null | ✅ | ⬜ pending |
| 25-03-T1 | 03 | 3 | D-09 | — | N/A | API check | `curl https://ev-accounts-api.onrender.com/api/treasury/cities` → LA city entry includes county_id field | ✅ | ⬜ pending |
| 25-03-T2 | 03 | 3 | D-09 | — | N/A | manual | Select Los Angeles city → breadcrumb shows "Los Angeles County" above city name, clickable | ⬜ W3 | ⬜ pending |
| 25-03-T3 | 03 | 3 | D-07/D-08 | — | N/A | manual | Select LA County entity → budget tabs render + "Cities in Los Angeles County" panel appears below with "Available now" and "Coming soon" sections | ⬜ W3 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test files needed. All verification is via SQL queries against the live Supabase DB and manual UI walkthrough.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| County breadcrumb appears on city pages with county_id | D-09 | No E2E test framework | Select LA city (e.g. "Los Angeles"), check breadcrumb above city name shows "Los Angeles County →" as a clickable element |
| County page Cities panel renders with correct sections | D-07/D-08 | No E2E test framework | Select "Los Angeles County" entity, scroll below budget — verify "Cities in Los Angeles County" panel with "Available now" (clickable) and "Coming soon" (not clickable) sections |
| Per-capita figures render for LA County | D-03 | Dependent on population fix | After Plan 01, select LA County, confirm per-capita values appear in PlainLanguageSummary (10M population) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 minutes
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
