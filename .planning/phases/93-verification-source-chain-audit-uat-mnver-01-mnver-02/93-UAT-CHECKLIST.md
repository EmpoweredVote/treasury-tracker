---
status: passed
phase: 93-verification-source-chain-audit-uat-mnver-01-mnver-02
requirements: [MNVER-02]
app: https://treasurytracker.empowered.vote
driver: Chris
created: 2026-06-27
signed_off: 2026-06-27
---

# Phase 93 — Minnesota Live-App UAT (MNVER-02)

**App:** https://treasurytracker.empowered.vote  ·  **Driver:** Chris  ·  **Recorder:** agent (blocking checkpoint)
Inform-tier / unauthenticated users have full read access — no login needed to view.

Spread: cities FY2012–2023, counties FY2013–2021, state node FY2023–2025. Mark each item **PASS / FAIL** (note anything off).

---

## A — Minneapolis (city) — FY2023

1. Search/select **Minneapolis** (MN). → loads as a city.
2. **Breadcrumb** shows US → Minnesota → Hennepin County → Minneapolis.
3. **Money Out** (operating) icicle renders; spot total ≈ **$1.19B** (FY2023). Top function = **Public Safety ≈ $333M**; a **Park & Recreation ≈ $213M** function is present.
4. **Icicle drill-down works** — click a depth-0 node (e.g. Public Safety or Taxes) → its child categories expand (2-level). ← the MN differentiator vs Ohio.
5. **Money In** (revenue) icicle renders; spot total ≈ **$1.19B**; **Taxes** is the largest, with **Property Taxes ≈ $477M** as a child; **Intergovernmental** present.
6. **Plain-language enrichment** shows on categories (Phase-92 descriptions; state-neutral, no $ figures, no other-locality names).
7. **Per-capita** renders (population 433,633).
8. **Source chip** = osa.state.mn.us (MN OSA City/County Finances Report).

## B — Hennepin County (county) — FY2021

9. Select **Hennepin County**. → renders as a county node.
10. **Cities-in-County** panel lists **Minneapolis** (+ other Hennepin cities).
11. **Money Out / Money In** icicles render with drill-down; revenue spot total ≈ **$1.85B**, operating ≈ **$1.83B**; **Property Taxes ≈ $915M**.
12. Enrichment + **per-capita** render (population 1,289,645); source chip = osa.state.mn.us.

## C — Minnesota state node — FY2023–2025

13. **Minnesota** selectable from the top-level State Governments picker.
14. **Money In** (General Fund revenue) renders; latest **FY2025 ≈ $35.5B**; largest source **Individual Income Taxes ≈ $17.8B**; drill/leaves include Sales, Corporate, etc.
15. **Money Out** (General Fund spending) renders; **FY2025 ≈ $35.1B**; largest **Health & Human Services ≈ $13.4B**, then **General Education ≈ $12.7B**.
16. **Year switch** works across FY2023 / FY2024 / FY2025.
17. **Source chip** = **State of Minnesota ACFR** (mn.gov/mmb) — NOT a generic/estimate label. (This replaced the old unsourced placeholder.)

---

## Summary
total: 17
passed: 17
issues: 0
pending: 0

Note (item 11): Hennepin County FY2021 displays Money Out **$1.8B** (stored $1,834,835,822) / Money In **$1.9B** (stored $1,851,255,583) — confirmed correct, reconciled to the published FY2021 ACFR (93-01, within 0.07%).

## Sign-off
Chris: ALL PASS (confirmed live)  Date: 2026-06-27
