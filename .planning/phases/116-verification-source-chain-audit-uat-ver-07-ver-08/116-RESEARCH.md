# Phase 116 Research — Verification + Source-Chain Audit + UAT (tranche 3 + deepening)

**Researched:** 2026-07-03 (inline, this session — no researcher subagent per project feedback)
**Phase requirement IDs:** VER-07, VER-08

## RESEARCH COMPLETE

---

## 1. What this phase verifies (the surface produced by 113/114/115)

**Tranche 3 (new ACFR states, 10)** — phases 113 + 114:

| State | Node id (prefix) | Window | Notes for re-derivation / audit |
|-------|------------------|--------|---------------------------------|
| IN | 7eb77ada | FY2002–FY2025 | thousands |
| AZ | 866036ee | FY2002–FY2024 | thousands; **FY2024 sourced via a Google-Drive link (caveat in 113-02 loadlog)** — re-derive FY2024 from the same Drive PDF, flag if it dies |
| OR | 7686da27 | FY2022–FY2025 | thousands |
| MO | 21892bb7 | FY2012–FY2025 | thousands; **6 clamped negative years** (P2 clamp — bar = printed root/control total) |
| CO | 89d2aff1 | FY2023–FY2025 | thousands; **TABOR negative clamped both years** |
| SC | f0024b19 | FY2002–FY2025 | thousands; ~1.46× NASBO basis-driver documented |
| KY | 6d9dfe88 | FY2002–FY2025 | thousands; **FY2023 honest hole** (broken font PDF) — do NOT sample; confirm absent-by-design |
| UT | 740cffee | FY2019–FY2025 | thousands; narrower-than-NASBO (Amendment G); **FY2022 negative investment income clamp** |
| AL | bc953061 | FY2002–FY2025 | thousands; **Sep-30 FY-end** → source_date {fy}-09-30, fiscal_year_start_month=10; 0.24× dual-budget |
| LA | b7e9e7cd | FY2002–FY2025 | thousands; ~99% federal intergovernmental GF composition |

**Deepening (existing nodes, extended windows) — phase 115:**

| State | New window | New years to re-derive | Basis label |
|-------|-----------|------------------------|-------------|
| NJ | FY2002–FY2025 (was 2020–2025) | FY2002–FY2019 (18 new), 0 holes | GAAP basis; **UNITS=1 (dollars, only such state)** |
| CT | FY1988–FY2025 (was 2002–2025) | FY1988–FY2001 (pre-34) + FY2006 (OCR-recovered) | **FY1988–2001 = "pre-GASB-34 combined statement basis"**; FY2006 = GAAP basis |
| WI | FY2000–FY2025 (was 2002–2025) | FY2000–FY2001 (pre-34) | **pre-GASB-34 combined statement basis** (one −2K rounding diff on a WI pre-34 year — documented) |
| MA | FY2001–FY2025 with holes | FY2001 (pre-34), FY2014 (recovered) | FY2001 = pre-GASB-34 basis; FY2014 = GAAP. **Holes FY2002/2004/2005/2021** = documented-unrecoverable, confirm absent-by-design |

**Cohort now:** 29 ACFR states (9 v2.11 + 10 v2.13 + 10 tranche-3) + 21 NASBO states = 50.
- v2.11 (9): CA TX NY FL MN OH VA PA IL
- v2.13 (10): NJ MA NC GA MD TN CT WI WA MI
- tranche-3 (10): IN AZ OR MO CO SC KY UT AL LA

## 2. The three-plan mold (proven in phase 110, shipped v2.13)

Phase 110 is the exact analog and passed (49/49 re-derivation, 10/10 cohort invariants, Chris UAT 11/11). Reuse its structure and its harness templates verbatim as the starting point:
- **Plan 01 — blind re-derivation (VER-07 part a):** `scripts/verify-phase116-rederive.mjs` modeled on `scripts/verify-phase110-rederive.mjs`. INDEPENDENCE RULE: import ZERO `scripts/process*.js` loaders and ZERO shared parser modules (`maAcfrExtract.mjs`, `pre34Extract.mjs`, `njAcfrExtract.mjs`) — re-key the GF column with the harness's own minimal extraction. Exact-0 bar. Sample = risk-weighted (bookends + documented middles + every clamp/caveat year).
- **Plan 02 — cohort source-chain audit (VER-07 parts b+c, VER-08):** `scripts/verify-phase116-cohort-audit.mjs` modeled on `scripts/verify-phase110-cohort-audit.mjs`. Invariants INV-1..INV-7 over the 29-ACFR/21-NASBO cohort; **new INV: pre-GASB-34 basis-label distinctness** (CT FY1988–2001, WI FY2000–2001, MA FY2001 rows carry the pre-34 label, visibly different from GAAP rows on the same node); LOAD-01 end-to-end (0 data_sources residue with NO manual re-clean — the WR-05 debt is FIXED as of phase 111, so residue re-cleaning should no longer be needed; prove it).
- **Plan 03 — live-app UAT (VER-08 sign-off):** `116-UAT-CHECKLIST.md` — anchor set across upgraded tranche-3 states + deepened history years (revenue-by-source, spending-by-function, basis labels **incl. pre-GASB-34**, source chips, Money In, **year selector reaching the deepened years** e.g. CT 1988, NJ 2002, MA 2001) + a NASBO control regression. Chris sign-off.

## 3. Key correctness bars (carried forward from 106/110, unchanged)

- **Exact-0 delta** on re-derivation; the ONLY acceptable non-zero dispositions are documented printed-vs-line-sum rounding notes from the loadlogs (recorded verbatim with reference). No tolerance band. The WI pre-34 −2K note is a known candidate; MO/CO/UT clamp years use the printed root/control total (nets the negative) as the bar.
- **Soft-404 guard** on every PDF fetch: Content-Type application/pdf + multi-MB payload, never HTTP 200 alone. AZ FY2024 Drive link + tn.gov-class UA quirks apply to specific states (read the loadlog).
- **Per-year URLs come from the LOADLOGs**, not the loader SOURCES maps (recon URLs unreliable; loadlogs record what was actually fetched). For deepened years, the 115 loadlogs record the NJ/CT/WI/MA per-year URLs (NJ FY2018/2019 have literal-space filenames requiring %20).
- **Idempotency:** re-run one representative loader per batch (e.g. one tranche-3 state + one deepened state) for a single FY via the guarded `treasury_sync_budget_tree` path (NEVER `treasury_sync_city_budget` — not source-safe); expect 0 net change. Then re-query data_sources for residue — with the phase-111 fix, expect 0 without manual cleanup (that IS the LOAD-01 end-to-end proof).

## 4. Honest-hole reconciliation (PASS conditions, do not re-litigate)

Absent-by-design (confirm present-in-DB where loaded, absent where documented):
- KY FY2023 (broken-font PDF, NASBO row retained per 114-02 loadlog)
- MA FY2002/2004/2005 (dot-leader digit-interleaving), MA FY2021 (font cipher) — 115-03 documented-unrecoverable
- AZ stops at FY2024 (FY2025 not yet sourced at load)
- Window floors are recon/format-locked (OR FY2022, CO FY2023, MO FY2012, UT FY2019; deepening floors CT FY1988, WI FY2000 = pre-GASB-34 boundary/multi-file era edge, NJ FY2002 = archive edge)

## 5. Cost / safety

- $0 spend: read-only DB + local PDF re-extraction (pdftotext) + optional pdftoppm/tesseract already installed. No paid AI APIs. No BigQuery.
- All DB writes in this phase are idempotency re-runs through the guarded loader path only; no new data loads.

## Validation Architecture

- **No unit-test framework** — verification IS the deliverable: two read-only/idempotent harnesses with hard exit-0/2 gates + a human UAT checklist.
- **Quick check (per task):** run the harness under construction; exit 0 = all ties/invariants pass.
- **Full check (per plan):** re-derivation harness exits 0 (every sampled FY exact-0 or documented); cohort audit exits 0 (all invariants); UAT anchors recorded PASS.
- **Phase gate (pre-complete):** both harnesses exit 0 + Chris UAT sign-off recorded in 116-UAT-CHECKLIST.md.

---
*Phase: 116 — researched inline 2026-07-03*
