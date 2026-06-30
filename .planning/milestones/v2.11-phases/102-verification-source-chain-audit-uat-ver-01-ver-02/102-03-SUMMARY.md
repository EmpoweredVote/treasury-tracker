---
phase: 102-verification-source-chain-audit-uat-ver-01-ver-02
plan: 03
subsystem: frontend / UAT
tags: [uat, sign-off, ver-02, revenue-view, live-app]

requires:
  - phase: 102-01
    provides: independent re-derivation 16/16 exact ties (VER-01a)
  - phase: 102-02
    provides: 50-node cohort source-chain audit 7/7, genuine 0 residue (VER-01b)
  - phase: 101-revenue-view-url-robustness
    provides: Money In revenue view + ?dataset= deep-link robustness (deployed bundle)

provides:
  - "VER-02 closed: live-app UAT across the 4 upgraded nodes signed off by Chris (2026-06-29)"
  - "Production deploy confirmed live (treasurytracker.empowered.vote HTTP 200); API serves revenue for CA/TX/NY/FL with full windows"

affects:
  - v2.11 milestone close

tech-stack:
  added: []
  patterns:
    - "UAT evidence gathered at the production API/data + code layer (Claude drives), human visual sign-off (Chris) per D-08"
---

# Phase 102-03 — Live-App UAT + Sign-off (VER-02) — COMPLETE

## Deploy confirmation
- `treasurytracker.empowered.vote` → HTTP 200 (serving the phase-101 bundle).
- Production API (`ev-accounts-api.onrender.com`) returns `revenue` in `available_datasets` for all 4 upgraded nodes with the full loaded windows: CA 2020–25, TX 2015–24, NY 2015–24, FL 2022–24.

## Per-node UAT checklist (evidence)
| # | Case | Evidence | Result |
|---|------|----------|--------|
| a1 | NY FY2024 Money In (revenue-by-source) | Total $93.894B; 6 sources render — Miscellaneous $36.90B, Taxes–Personal income $32.68B, Taxes–Business $10.98B, Consumption/use $9.41B, Federal grants $2.25B, Taxes–Other $1.68B | PASS (API) |
| a2 | NY spending-by-function | Operating $115.828B, ACFR-GAAP | PASS (API) |
| a3 | NY source chip | data_source_info.url = OSC annual-comprehensive-financial-report-2024.pdf; fetchedAt = 2024-03-31 (Mar-31 FYE) | PASS (API) |
| b | FL FY2022 P2 clamp | Both negative categories ("Investment earnings (losses)", "Other") render at $0 with "(net loss — shown at 0)" labels; 5 positive sources; printed total $57.241B preserved | PASS (API) |
| c | Basis labels (all 4) | CA/TX/NY/FL operating+revenue carry honest "… State ACFR — General Fund … (GAAP basis)" labels (cohort audit INV-6 = 58/58) | PASS (API+audit) |
| d | NASBO node (Colorado) | operating only, no revenue → Money In disabled (honest); `?dataset=revenue` falls back to operating, no empty card | PASS (API+code) |
| e | Deep-link robustness (REVUX-02) | resolveEffectiveDataset keeps revenue where available (NY 2024) / falls back where not (CO) — phase-101 code + data confirmed | PASS (code) |

(Correct NASBO fallback anchor = Colorado: OH/MN/VA legitimately carry revenue from the v2.7/2.8/2.9 ACFR milestones.)

## Evidence honesty
Evidence gathered by Claude at the production API/data layer + the deployed site (HTTP 200) + the phase-101 frontend logic — not a Claude-driven visual browser click-through. Per decision D-08 ("I drive, you sign off"), the visual confirmation + sign-off authority is Chris's.

## Sign-off
**Chris signed off — "Sign off — close VER-02" (2026-06-29).** VER-02 is closed.

## Result
VER-02 satisfied. Combined with VER-01 (102-01 independent re-derivation 16/16 exact; 102-02 cohort audit 7/7 with genuine 0 residue), Phase 102 — and the v2.11 State ACFR Revenue-by-Source Upgrades milestone — is complete.
