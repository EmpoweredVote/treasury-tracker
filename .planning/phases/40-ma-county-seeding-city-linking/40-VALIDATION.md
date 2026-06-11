---
phase: 40
slug: ma-county-seeding-city-linking
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-11
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification — no automated test suite for scripts/ |
| **Config file** | none |
| **Quick run command** | `node scripts/seedMACountyLinks.js --dry-run` |
| **Full suite command** | DB verification queries (see Per-Task map below) + human spot-check of 5 city pages |
| **Estimated runtime** | ~30 seconds (dry-run); ~2 min (live run + DB queries) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/seedMACountyLinks.js --dry-run`
- **After Wave 1 live run:** Run all 5 DB verification queries
- **Before `/gsd:verify-work`:** All DB queries green + human spot-check complete
- **Max feedback latency:** ~30 seconds (dry-run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | COUNTY-01, COUNTY-02 | — | N/A | cli | `node scripts/seedMACountyLinks.js --dry-run` | ❌ W0 | ⬜ pending |
| 40-01-02 | 01 | 1 | COUNTY-01, COUNTY-02 | — | N/A | db-query | `SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND entity_type='county'` | ✅ | ⬜ pending |
| 40-01-03 | 01 | 1 | COUNTY-02 | — | N/A | db-query | `SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND county_id IS NOT NULL` | ✅ | ⬜ pending |
| 40-01-04 | 01 | 1 | COUNTY-03, UI-01, UI-02 | — | N/A | manual | Open Plymouth, Taunton, Edgartown, Quincy, Barnstable city pages in app; open 5 county pages | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/seedMACountyLinks.js` — must be created in Task 40-01-01

*All other infrastructure (Supabase client, parseArgs, .env loading pattern) already exists.*

---

## DB Verification Queries

Run via MCP (`mcp__supabase-local__execute_sql`) after the live run:

**Query 1 — COUNTY-01: 5 county rows with population**
```sql
SELECT name, population, population_year
FROM treasury.municipalities
WHERE state='MA' AND entity_type='county'
ORDER BY name;
```
Expected: 5 rows — Barnstable County (232570), Bristol County (588593), Dukes County (21061), Norfolk County (740754), Plymouth County (542090); all population_year=2024.

**Query 2 — COUNTY-01: Total count**
```sql
SELECT COUNT(*) FROM treasury.municipalities
WHERE state='MA' AND entity_type='county' AND population > 0;
```
Expected: 5

**Query 3 — COUNTY-02: Total city count linked**
```sql
SELECT COUNT(*) FROM treasury.municipalities
WHERE state='MA' AND county_id IS NOT NULL;
```
Expected: 97 (or 96 if Gosnold not in DB — acceptable, script warns)

**Query 4 — COUNTY-02: Per-county breakdown**
```sql
SELECT m2.name AS county, COUNT(m1.id) AS city_count
FROM treasury.municipalities m1
JOIN treasury.municipalities m2 ON m1.county_id = m2.id
WHERE m1.state = 'MA' AND m1.entity_type = 'city'
GROUP BY m2.name
ORDER BY m2.name;
```
Expected: Barnstable County=15, Bristol County=20, Dukes County=7 (or 6), Norfolk County=28, Plymouth County=27

**Query 5 — Dissolved county guard: no cross-state or extra links**
```sql
SELECT COUNT(*) FROM treasury.municipalities
WHERE state != 'MA' AND county_id IN (
  SELECT id FROM treasury.municipalities WHERE state='MA' AND entity_type='county'
);
```
Expected: 0 (no non-MA cities linked to MA counties)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| County breadcrumb on city pages | COUNTY-03 | Requires browser rendering of live app | Open Plymouth, Taunton, Edgartown, Quincy, Barnstable city pages; each should show county breadcrumb chip |
| CitiesInCountyPanel on county pages | UI-01 | Requires browser rendering of live app | Open each of 5 county pages; panel should list cities as "Available now" chips |
| Per-capita on county pages | UI-02 | Requires browser rendering of live app | Open Barnstable County or Plymouth County page; should show $/resident figure |
| Negative: Boston shows no breadcrumb | COUNTY-02 | Validates dissolved-county guard | Open Boston city page; no county breadcrumb should appear (Suffolk County is dissolved) |
| No regression: LA County breadcrumb unchanged | COUNTY-02 | Cross-state regression | Open Los Angeles city page; should still show "Los Angeles County →" breadcrumb |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (seedMACountyLinks.js is the only new file)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (dry-run is instant)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
