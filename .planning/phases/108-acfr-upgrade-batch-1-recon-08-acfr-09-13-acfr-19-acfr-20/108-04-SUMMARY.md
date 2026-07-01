# 108-04 SUMMARY — Georgia ACFR Upgrade (+ F-97-01 supersede)

**Requirements:** ACFR-12, ACFR-19, ACFR-20, RECON-08 · **Status:** COMPLETE (5-yr full window, 0 holes) · **Spend:** $0

## What shipped
- `scripts/processGAAcfr.js` + `scripts/processGARevenueAcfr.js` (parser-based, reuse `maAcfrExtract.mjs`).
- GA state node (`6eb7dd4a`) NASBO→ACFR GAAP: GF revenue-by-source (12 sources) + spending-by-function (~8–9), **FY2021–2025 (full clean window, 0 holes)**.

## Bookends (exact)
FY2025 rev **68,445,055K** ✅, FY2021 **55,378,103K** ✅ (GF 1st column: General Fund | Capital Projects | Nonmajor | Total).

## F-97-01 supersede (RECON-07) — CONFIRMED
Pre-load GA FY2023 NASBO operating = $29,266M (the v2.10 Phase-97 Medicaid-corrected value). Post-load: FY2023 operating row is now the ACFR GAAP actual **$59,893,783K**, written at the same `(6eb7dd4a, 2023, 'operating')` key. DB shows **0 NASBO rows** on the GA node — no F-97-01 orphan competing with the ACFR row. Supersede clean.

## NASBO replacement / DB (verified)
Pre-load: 2 NASBO operating (FY2023 $29,266M, FY2024 $34,594M), no revenue. Post-load: 5 op + 5 rev, 0 NASBO, 0 null source_url, FY2021–2025. Fresh data_sources `ga-acfr-gf-operating` / `ga-acfr-gf-revenue`.

## URLs (load-time discovery)
Recon's Drupal slugs (`fy-2025-acfr` etc.) all 404'd. Real opaque slugs enumerated from `sao.georgia.gov/swar/acfr` + `/historical-acfr-reports`: FY2021 `2021acfrfinal070122bdpdf`, FY2022 `2022-acfr-final-securedpdf`, FY2023 `2023-acfr-final-securepdf`, FY2024 `2024-acfr-42525-securedv2pdf`, FY2025 `2025-acfr-21325-securedpdf`.

## Accept-relabel (ACFR-19)
GA ACFR GF ~**1.98× NASBO** ("Intergovernmental - Federal" ~$27.8B inside GAAP GF). Relabelled honestly.

## P2 clamp (ACFR-20)
"Interest and Other Investment Income" positive in loaded years; clamp wired, not triggered.

## Idempotency / Money In / cohort
GA --fy 2025 re-run → 0 change. 5 revenue rows → Money In on. Loaders node-scoped to Georgia; cohort untouched (RECON-08; Phase 110 = authoritative audit).

## Parser note
The GA-required fix (`Revenues:`/`Expenditures:` colon in the section header) was generalized into `maAcfrExtract.mjs` — a safe change that also recovered 2 extra MA years (FY2003/FY2006) and 2 extra NC years (FY2012/FY2013), with no regressions (tie-gate guarantees only exact-tying years load).

## Deferred
GA pre-FY2021 not discoverable on SAO site (recon gap confirmed).
