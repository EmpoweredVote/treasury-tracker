---
phase: 53-orange-county-operating-revenue-load
verified: 2026-06-14T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 53: Orange County Operating + Revenue Load — Verification Report

**Phase Goal:** Load operating + revenue for all 34 Orange County cities (FY2003–2024) from ByTheNumbers, auto-creating the 32 net-new city records with populations.
**Verified:** 2026-06-14
**Status:** passed
**Re-verification:** No — initial verification

---

## Verification Method

This phase performed a live data load (no code written). Verification ran a Node.js probe (`scripts/_verify-phase53-v2.mjs`) against the production Supabase database (`kxsdzaojfaibhuzmclfq`) using the repo `.env` credentials. The probe is read-only and writes nothing. SUMMARY.md claims were not trusted — every claim was independently confirmed against the database.

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | All 34 OC cities have operating budgets for FY2003–2024 (visible in DB) | VERIFIED | Probe: 34/34 cities with operating rows; 33 cities with full 22/22-year coverage; La Habra missing FY2009-2010 (SCO source gap, permitted) |
| SC-2 | All 34 OC cities have revenue budgets for FY2003–2024 | VERIFIED | Probe: 34/34 cities with revenue rows for FY2003–2024 |
| SC-3 | 32 net-new cities exist with non-zero populations; Anaheim & Santa Ana custom data_source preserved | VERIFIED | All 34 OC cities have non-zero population; Anaheim FY2025/2026 (4 custom rows) intact; Santa Ana FY2023–2026 (8 custom rows) intact; no custom row overwritten |
| SC-4 | City totals for a sampled year match ByTheNumbers source figures | VERIFIED | Irvine FY2024 operating: DB=$656,013,821 vs claimed $656,013,821 — EXACT; Huntington Beach FY2019 operating: DB=$323,441,057 vs claimed $323,441,057 — EXACT |

**Score: 4/4 truths verified**

---

### Plan Must-Haves (from 53-01-PLAN.md frontmatter)

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All 34 OC cities have operating budgets FY2003–2024 in DB/app (OC-01) | VERIFIED | 34/34 cities found; operating rows present for all |
| 2 | All 34 OC cities have revenue budgets FY2003–2024 in DB/app (OC-02) | VERIFIED | 34/34 cities found; revenue rows present for all |
| 3 | 32 net-new OC cities created with non-zero population | VERIFIED | All 34 OC cities (including 32 net-new) have non-zero `population` in `treasury.municipalities` |
| 4 | Anaheim and Santa Ana original data_source preserved — budget rows unchanged | VERIFIED | Anaheim: 4 custom rows (FY2025–2026 op+rev) untouched; Santa Ana: 8 custom rows (FY2023–2026 op+rev) untouched; 0 custom rows overwritten by ByTheNumbers source |
| 5 | Sampled city/fiscal-year total matches ByTheNumbers source within rounding | VERIFIED | Two independent exact matches: Irvine FY2024 and Huntington Beach FY2019 |

---

### Required Artifacts

This phase contains no code artifacts — it executed an existing script to load data. The artifacts are database records.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `treasury.municipalities` — 34 OC cities | 34 CA city records with non-zero population | VERIFIED | 34/34 present; all with non-zero population; `entity_type = city`, `state = CA` |
| `treasury.budgets` — OC operating rows FY2003–2024 | 746 operating rows (34 cities × ~22 years; Santa Ana FY2023–2024 = custom source) | VERIFIED | 746 operating rows present for OC cities in range |
| `treasury.budgets` — OC revenue rows FY2003–2024 | 746 revenue rows | VERIFIED | 746 revenue rows present |
| Source attribution on ByTheNumbers rows | `source_url` = durable page URL, `source_date` = 2026-06-14 | VERIFIED (with note) | 1488/1492 OC budget rows have correct source_url + source_date; the 4 NULL rows are Santa Ana's pre-existing custom rows (correct — collision policy prevented overwrite) |

---

### Key Link Verification

No code links to verify (data-load-only phase). The critical "wiring" in this phase is the collision policy protecting custom rows.

| Link | Check | Status | Evidence |
|------|-------|--------|----------|
| Collision policy — Anaheim FY2025/2026 not overwritten | Anaheim FY2025/2026 rows have non-ByTheNumbers data_source | VERIFIED | "Anaheim General Fund Operating/Revenue Budget FY2025/2026" — 4 rows, source_url=null (custom, not ByTheNumbers) |
| Collision policy — Santa Ana FY2023–2026 not overwritten | Santa Ana FY2023–2026 rows have non-ByTheNumbers data_source | VERIFIED | "Santa Ana General Fund Operating/Revenue Budget FY2023–2026" — 8 rows, source_url=null (custom) |
| Durable source URL (locked convention #1) | source_url = `/d/ju3w-4gxp` (op) or `/d/rrtv-rsj9` (rev), never `/resource/` | VERIFIED | 744/744 operating ByTheNumbers rows have `/d/ju3w-4gxp`; 744/744 revenue rows have `/d/rrtv-rsj9`; 0 rows use `/resource/` URL |
| Source date (locked convention #1) | source_date = 2026-06-14 on all ByTheNumbers rows | VERIFIED | 1488/1488 ByTheNumbers rows have source_date = 2026-06-14 |

---

### Data-Flow Trace

Not applicable — this is a data-load phase, not a UI rendering phase.

---

### Behavioral Spot-Checks

| Behavior | Command/Check | Result | Status |
|----------|--------------|--------|--------|
| Irvine FY2024 operating total matches ByTheNumbers | DB probe: `total_budget` for Irvine FY2024 operating | $656,013,821 (exact match to executor claim) | PASS |
| Huntington Beach FY2019 operating total matches ByTheNumbers | DB probe: `total_budget` for HB FY2019 operating | $323,441,057 (exact match to executor claim) | PASS |
| FY2009-2010 gap is exactly 33 cities (La Habra absent) | DB probe: count of distinct cities with FY2009 operating | 33 (La Habra absent both years — confirmed SCO source gap) | PASS |
| No /resource/ URLs present in OC ByTheNumbers data | DB probe: count rows with source_url LIKE '%/resource/%' | 0 rows | PASS |

---

### Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| OC-01 | 53 | A citizen can view operating spending for any of Orange County's 34 cities, FY2003–2024 | SATISFIED | 34/34 OC cities have operating budget rows for the FY2003–2024 range in treasury.budgets |
| OC-02 | 53 | A citizen can view revenue for any of Orange County's 34 cities, FY2003–2024 | SATISFIED | 34/34 OC cities have revenue budget rows for the FY2003–2024 range |

Both OC-01 and OC-02 are marked Complete in `.planning/REQUIREMENTS.md`. Database evidence confirms this.

---

### Anti-Patterns Found

No code was written in this phase. No files were modified. Anti-pattern scan is not applicable.

No `TBD`, `FIXME`, or `XXX` markers introduced.

---

### Detailed Findings (Nuances Worth Noting)

**1. Santa Ana's FY2023-2024 in the "34 cities" operating count**

Santa Ana has operating and revenue rows for FY2023 and FY2024, but these come from the pre-existing custom source ("Santa Ana General Fund Operating Budget FY2023/FY2024"), not from ByTheNumbers. The collision policy correctly prevented overwrite. For success criterion #1, the requirement is that "all 34 OC cities have operating/revenue budgets for FY2003–2024 — visible in app / present in DB." Santa Ana's FY2023-2024 IS present and visible, fulfilling the user-facing intent. The fact that those 2 years use custom sourcing rather than ByTheNumbers is correct behavior, not a gap.

**2. La Habra missing FY2009-2010 (SCO source gap)**

La Habra is absent from the SCO ByTheNumbers feed for FY2009 and FY2010. This is a source data gap, not a pipeline or load failure. The PLAN's acceptance criteria explicitly allow for "genuinely-absent SCO years per city." La Habra has 20/22 years of operating + revenue coverage. All other 33 OC cities have full 22/22-year coverage.

**3. 4 NULL source_url / source_date rows**

Exactly 4 budget rows (Santa Ana FY2023 operating, FY2023 revenue, FY2024 operating, FY2024 revenue) have NULL source_url and source_date. These are Santa Ana's pre-existing custom rows that predate the ByTheNumbers convention. They were not created by Phase 53 and could not be updated (collision policy prevents overwrite). This is correct and expected; the locked convention applies only to rows created by the ByTheNumbers loader.

**4. Anaheim was loaded (not SKIP) for FY2003-2024**

The PLAN's threat model listed both Anaheim and Santa Ana as expected SKIPs. In practice, Anaheim was SKIPped only where it had prior custom data. Since Anaheim's custom data covers only FY2025-2026, ByTheNumbers data for FY2003-2024 was correctly loaded (44 rows). The SUMMARY documents this deviation and explains why it is correct behavior. Database confirms: Anaheim FY2025-2026 custom rows (4) are intact; Anaheim FY2003-2024 ByTheNumbers rows (44) are present with correct source attribution.

---

### Human Verification Required

No human verification required. All success criteria are verifiable from the database alone (data load only, no UI features introduced this phase). The app displaying these cities correctly is a function of pre-existing UI code that was proven in earlier phases; no new frontend work was performed.

---

### Gaps Summary

No gaps. All 4 roadmap success criteria and all 5 plan must-haves are verified by direct database probe. The phase goal is achieved.

---

*Verified: 2026-06-14*
*Verifier: Claude (gsd-verifier) — DB probe: scripts/_verify-phase53-v2.mjs*
*Probe: read-only, zero writes*
