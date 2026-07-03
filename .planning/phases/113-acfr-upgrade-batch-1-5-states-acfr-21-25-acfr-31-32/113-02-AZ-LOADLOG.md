# 113-02 — Arizona ACFR Load Log

**Date:** 2026-07-02
**Node:** Arizona `866036ee-20b2-4e3c-a4f3-5100659edf31` (resolved + asserted)
**Loaders:** `scripts/processAZAcfr.js` + `scripts/processAZRevenueAcfr.js`, UNITS=1_000 (thousands)

## FY2024 Durability Resolution (the locked Phase-113 decision)

Re-checked at load time (2026-07-02): the FY2024 node page (`gao.az.gov/resources/annual-comprehensive-financial-report-june-30-2024`) **still links only to the Google Drive share** (`drive.google.com/file/d/14FYCgTQPsu77pxLtz41E_Ba_0hCuMhwA` — same file ID as recon). No migrated `sites/default/files` URL exists. Per the locked decision, **FY2024 was loaded from the Drive link** (`uc?export=download` endpoint) with:
- an explicit non-durability caveat comment on the `SOURCES[2024]` entry in BOTH loaders (re-check for a migrated durable URL at the next AZ touch), and
- the Drive URL stamped as the row's `source_url` (verified in DB: `fy24_drive_url = true`).

The downloaded Drive PDF extracted cleanly and tie-confirmed to the recon's FY2024 totals — only the URL is fragile, not the data.

## WAF Access Log

- Homepage 403'd (Cloudflare challenge) but **node pages and direct `sites/default/files` PDFs fetched cleanly** with a cookie jar + per-year `Referer` headers — no re-blocks across ~50 requests this session (milder behavior than recon's session).
- **URL-resolution discovery (better than scraping):** gao.az.gov's Drupal **JSON:API is open** (`/jsonapi/file/file` with filename CONTAINS filters) — enumerated all 79 CAFR/ACFR file entities with exact `sites/default/files/{folder}/{filename}` paths in 4 requests. This bypassed the node-page scraping problem entirely (node pages link to `/media/{id}/edit` routes, not files).

## Load Disposition

| Item | Result |
|------|--------|
| FYs loaded | **FY2002–FY2024 (all 23), operating + revenue — no honest holes.** FY2025 correctly absent (not yet published; NASBO shows "Estimated") |
| FY2014 + FY2019 filename surprises | The only hosted FY2014 file is named `2014_CAFR-TOC.pdf` and FY2019's is `…2019 Opinion wosig.pdf` — **both are actually the complete reports** (3MB/6MB, full statements present, both tie $0). Names are misleading; content verified |
| Ties | All 23 years tie **$0ǂ** on both sections after 5 hand-verified positional fixes (below). Bookends: FY2024 = 44,045,434K ✅, FY2002 = 11,655,423K ✅ (both recon-exact) |
| Positional fixes (5 years, hand-verified) | GF "Transportation" expenditure values (FY2009 70K, FY2010 58K, FY2011 44K, FY2012 51K, FY2014 4K) — tiny values in mostly-blank rows that `pdftotext -table` shifted right of the GF column. Each verified against its printed row; each year's pre-fix diff matched its value exactly; all tie $0 after fix |

ǂ exact equality, no tolerance consumed

## NASBO Replacement (in place)

| FY | Pre-load NASBO operating (recon baseline) | Loaded ACFR operating (GAAP) |
|----|-------------------------------------------|------------------------------|
| 2023 | $16,001,000,000 | $45,055,595,000 |
| 2024 | $17,903,000,000 | $45,047,271,000 |

Post-load: **0 NASBO labels; one operating row per (AZ, fy)**.

## Scope Divergence (ACFR-31)

FY2024 ACFR GF revenues $44,045,434K vs NASBO $17,903M → **~2.46× — recon-pinned mechanism confirmed**: "Intergovernmental" (federal Medicaid/education passthrough) = $25,234,916K of the FY2024 GF total. Accepted-and-relabelled honestly (TX precedent); GAAP basis label on all 46 rows.

## Negative Lines / P2 Clamp (ACFR-32)

Two negative years found beyond recon's bookend check: **FY2013 "Earnings on investments" = −9,970K and FY2022 = −16,230K.** Both transcribed signed, rendered clamped with signed labels, root totals tie the printed statements.

## Idempotency + 0-Residue

- Re-ran `--fy 2023` live (both loaders): UPDATE-in-place, 0 net change.
- `data_sources` 'az-acfr-%' rows → **0**.

## Money In + Cohort

- 23 revenue rows → **Money In auto-enabled**.
- Cohort spot-check (CA/PA/NJ/OK/KS) unchanged this session.
