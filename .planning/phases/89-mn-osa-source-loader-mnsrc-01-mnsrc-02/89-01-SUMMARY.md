---
phase: 89-mn-osa-source-loader-mnsrc-01-mnsrc-02
plan: 01
completed: 2026-06-27
requirements: [MNSRC-02]
status: complete
---

# 89-01 SUMMARY — MN OSA Recon, Manifest, Tree-Map, County-Layout Pin

## What was built

The verified, committed foundation for the MN loader (recon half of MNSRC-02 + the D-08 county-layout de-risk). All $0 (free, no-auth static files; no AI spend).

- **`scripts/mnOsaDatasets.json`** — per-FY city + county XLSX URL manifest. Slugs scraped verbatim from the OSA cities + counties landing pages (the `/media/<slug>/` segment is opaque — never guessed). All 20 recorded URLs verified resolving (HTTP 200 ranged GET).
- **`scripts/mnOsaTreeMap.json`** — label-based 3-level-where-natural hierarchy spec (8 revenue groups, 17 expenditure functions) consumed by 89-02's builders.
- **`_mn-recon/cired_23_data.xlsx`** (city FY2023, 1.6 MB) + **`_mn-recon/county_21_data.xlsx`** (county FY2021, 162 KB) downloaded; `_mn-recon/` gitignored.

## Key facts pinned

- **City XLSX range: FY2012–FY2023** (continuous; floor 2012, better than the recon's ~2015 guess). Pre-2012 = `.zip`/`.csv` (out of scope).
- **County XLSX range: FY2013–FY2017 + FY2019–FY2021** (gaps at 2012/2018; FY2022–2023 publish reports only). **County data LAGS cities — latest county = FY2021.** FY2006–2011 county files are legacy `.xls` (binary, NOT exceljs-readable) — out of scope.
- **County file naming shifts**: `cored_<YY>_data.xlsx` (FY2013–17) → `county_<YY>_data.xlsx` (FY2019–21); `county_21` is literally `county_21_-data.xlsx` (extra dash).
- `Governmental Funds` sheet: **header row 1, data row 2**. City = 859 rows × 148 cols; County = 87 rows × 144 cols. Identity (city): GovEntityID, Entity Name, ParentEntityName, Entity Type, ClassCode, GAAPInd, Population, FinancialYear. `GAAPInd` holds literal `"GAAP"`/`"Cash"`. FinancialYear confirmed (cired_23 → 2023).
- Revenue core total = `Total Revenues` (excl. `Total Revenues & Other Sources`); expenditure core total = `Total Expenditures` (excl. `& Other Uses`) — D-05.

## County-vs-city layout divergences (D-08 — the Ohio lesson, caught BEFORE bulk)

| Aspect | City (`cired_23`) | County (`county_21`) | Handling |
|---|---|---|---|
| `GovEntityID`, `ClassCode` | present | **absent** | not needed (match by Entity Name) |
| `ParentEntityName` | col 3 | **absent** | `entityCounty` → '' for counties (they have no parent) |
| **`GAAPInd` basis flag** | col 6 | **absent entirely** | `entityBasis` → null for counties; document (no basis flag in county source) |
| Financial cols start | col 12 | col 8 (shifted) | **label-driven matching, never indices** |
| `WheelageTax` | absent | col 15 | included in Taxes leaves (skipped where absent) |
| `Total Revenues` / `Total Expenditures` | 74 / 143 | 69 / 139 | label-matched |
| Label typo: Economic | `Ecenomic Development Capital Outlay` | `Economic Development...` (correct) | `label_aliases` ecenomic→economic |
| Label typo: Conservation | `Conservation of Natural...` | `Conservation ofNatural...` (no space) | normalization strips spaces → ties |
| Junk cols | — | `Current Expend 1`, `Total Capital Outaly1` | listed in `validation_only_totals`, never placed |

**Mitigation contract for 89-02:** match every column by NORMALIZED label (lowercase, strip non-alphanumeric) + the one `label_aliases` entry; resolve identity columns by label and return null/'' when absent (county GAAPInd/ParentEntityName); validate each subtotal-group's child sum ties to the workbook subtotal (D-03). The tree-sum-ties-to-Total gate (89-04) is the final backstop against any mis-mapped column.

## Decisions honored
- D-01/D-02 (3-level where natural; current/capital deepest leaves) — encoded in tree-map.
- D-03 (subtotals as parents, not extra leaves; cross-cutting rollups validation-only) — `subtotal_label` + `validation_only_totals`.
- D-04 (Intergovernmental included as top-level group with Federal/State/County-Local children).
- D-05 (core `Total Revenues`/`Total Expenditures`; `& Other` variants excluded).
- D-08 (county layout verified independently; divergences documented above).

## Files
- Created: `scripts/mnOsaDatasets.json`, `scripts/mnOsaTreeMap.json`, `.planning/.../89-01-SUMMARY.md`
- Modified: `.gitignore` (added `_mn-recon/`)
- Downloaded (gitignored): `_mn-recon/cired_23_data.xlsx`, `_mn-recon/county_21_data.xlsx`

## Self-Check: PASSED
- Manifest valid JSON, 12 FY entries, all 20 URLs resolve, county_url present where county XLSX exists.
- Tree-map valid JSON; Intergovernmental is a 3-level group (subtotal `Total Intergovernmental Revenues` → Federal/State/County-Local); cross-function rollups in `validation_only_totals`.
- Both recon workbooks open in exceljs; county layout verified independently with divergences documented.

## Handoff to 89-02
The loader consumes `mnOsaTreeMap.json` (label-normalized matching + alias) and `mnOsaDatasets.json` (`resolveSourceUrl(fy, entityType)`), defaults county basis to null (no GAAPInd), and returns '' for county parent. Proof entities for 89-04: Minneapolis (FY2023 city), a Cash-basis city (GAAPInd='Cash', e.g. "Ada"/"Adams" per recon row 2/3), one county (FY2021).
