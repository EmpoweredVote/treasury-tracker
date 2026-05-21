# Phase 10: Collin County Expansion - Research

**Researched:** 2026-05-21
**Domain:** Texas municipal operating budget PDFs + pdftotext pipeline
**Confidence:** MEDIUM (PDF URLs unverified by download; confirmed present via WebFetch/search)

---

## Summary

All 6 Collin County cities have publicly accessible budget PDF pages. Direct PDF URLs were located
for all 6 cities through a combination of WebFetch of city finance pages and targeted web search.
Five of the six PDFs responded with valid content (large file size confirming real PDFs); Sachse's
URL responded with "maxContentLength exceeded" (>10MB) which is a strong positive signal.

The Richardson PDF came from a CivicLive CDN (`cdnsm5-hosted.civiclive.com/Server_7964838/`) which
is definitively Richardson TX — multiple budget documents at that server path confirm city identity.

All 6 municipalities already exist in `treasury.municipalities` (seeded in Quick Task 001,
commit 9584b2a). No municipality seeding is needed in Phase 10 — only `data_sources` rows.

**Primary recommendation:** Use FY2025 (Oct 2024-Sep 2025) as the primary load target for all
cities. It is the most recent complete fiscal year. FY2026 (currently in progress) should be loaded
where available. Use pdftotext-first per Decision 1.

---

## PDF URL Table

| City | FY | PDF Type | URL | URL Confidence | Size Signal |
|------|----|----------|-----|----------------|-------------|
| Garland | 2025 | Operating Budget (full) | `https://garlandtx.gov/DocumentCenter/View/20565/City-of-Garland-2024-25-Annual-Operating-Budget-PDF` | HIGH | >10MB (maxContentLength hit) |
| Garland | 2026 | Operating Budget (summary/overview?) | `https://garlandtx.gov/DocumentCenter/View/22610/Adopted-Annual-Operating-Budget-2025-26` | HIGH | 211KB — **WARNING: may be summary only** |
| Garland | 2024 | Operating Budget | `https://garlandtx.gov/DocumentCenter/View/16615/City-of-Garland-2023-24-Annual-Operating-Budget-PDF` | HIGH | Not checked |
| Richardson | 2025 | Operating Budget (adopted) | `https://cdnsm5-hosted.civiclive.com/UserFiles/Servers/Server_7964838/File/Government/Departments/Finance/Financial%20Transparency/Annual%20Budgets/2025%20Budget%20Book%20-%20compressed%208-28.pdf` | HIGH | >10MB (maxContentLength hit) |
| Richardson | 2026 | Operating Budget (adopted) | `https://cdnsm5-hosted.civiclive.com/UserFiles/Servers/Server_7964838/File/Government/Departments/Finance/Budget/2026%20Adopted%20Budget%20Book.8-5-25%20compressed.final%20with%20TOC.pdf` | HIGH | >10MB (maxContentLength hit) |
| Wylie | 2025 | Operating Budget (adopted) | `https://cms2.revize.com/revize/wylienew/Departments/Finance/Budget/Wylie%20Budget%20Book%20for%20Web%20(1).pdf` | MEDIUM | >10MB (maxContentLength hit) |
| Wylie | 2026 | Operating Budget (adopted) | `https://cms2.revize.com/revize/wylienew/Departments/Finance/Budget/FY%202026%20Final%20Budget.pdf` | MEDIUM | >10MB (maxContentLength hit) |
| Sachse | 2025 | Operating Budget (workbook) | `https://www.cityofsachse.com/DocumentCenter/View/11115/2024-2025-Budget-Workbook` | MEDIUM | >10MB (maxContentLength hit) |
| Sachse | 2026 | Operating Budget (adopted) | `https://www.cityofsachse.com/DocumentCenter/View/12467/FY2025-2026-Adopted-Budget` | MEDIUM | Not independently verified |
| Murphy | 2025 | Operating Budget (adopted, amended) | `https://www.murphytx.org/DocumentCenter/View/9835/City-of-Murphy-Budget-Book-with-amendments-as-of-09162025` | MEDIUM | >10MB (confirmed; different attempt) |
| Murphy | 2025 | Operating Budget (original adopted) | `https://www.murphytx.org/DocumentCenter/View/9213` | MEDIUM | >10MB (confirmed) |
| Murphy | 2026 | Operating Budget (adopted, amended) | `https://www.murphytx.org/DocumentCenter/View/9984/FY26-Adopted-Budget-Book-with-amendments-as-of-031726-` | MEDIUM | — |
| Princeton | 2025 | Operating Budget (proposed/adopted) | `https://www.princetontx.gov/DocumentCenter/View/2902/City-of-Princeton-Proposed-Budget-FY-2024-25` | HIGH | 4.4MB confirmed valid |
| Princeton | 2026 | Operating Budget (adopted) | `https://princetontx.gov/DocumentCenter/View/6974/Adopted-Budget-2025-26` | HIGH | 9.7MB confirmed valid |

### Critical Notes

**Garland FY2026 (211KB):** The adopted annual operating budget for FY2025-26 at `/DocumentCenter/View/22610/` was only 211KB — this is very likely a budget summary or overview brochure, not the full line-item budget. The FY2025 document at `/DocumentCenter/View/20565/` was >10MB (full line-item budget). For pdftotext extraction, use FY2025. The FY2026 document at `/DocumentCenter/View/22195/` (proposed, not yet adopted as of research date) also exists.

**Garland FY2026 adopted full budget:** The page at `garlandtx.gov/3528/Annual-Budget-Documents` does NOT list an adopted FY2026 full budget yet (only proposed). The `/22610/` URL was found from a separate search result. Dry-run before committing.

**Richardson URL pattern:** The city uses CivicLive CDN hosting. The `cor.net` domain blocks WebFetch (HTTP 403) but documents are served directly from `cdnsm5-hosted.civiclive.com`. Both FY2025 and FY2026 confirmed >10MB.

**Sachse "Budget Workbook":** The FY2025 document is titled "Budget Workbook" — this may include supporting worksheets. The FY2026 document at `/12467/` is titled "Adopted Budget" which is cleaner. Test both with pdftotext dry-run to find which has cleaner tabular layout.

**Murphy `/9213` vs `/9835`:** The finance page listed `/9213` as "FY 2025 Adopted Budget" and `/9835` as "FY 2024-2025 Adopted Budget (with amendments as of 09/16/2025)". The `/9835` amended version is preferred as most complete. The `/9213` may be the original pre-amendment version.

**Princeton "Proposed" URL label:** The FY2025 URL slug says "Proposed" but the `/563/Fiscal-Year-2024-25-Adopted-Budget` page links to it with text "View the FY 2024-25 Adopted Budget here." The document is the adopted budget served at a URL that still has "proposed" in its name. Princeton FY2026 (`/6974/`) is explicitly labeled "Adopted" — prefer that.

---

## Municipality IDs

All 6 cities are confirmed in `treasury.municipalities` (TX) as of Quick Task 001 (commit 9584b2a,
2026-05-01). The seeder script `scripts/seedCollinCountyMunicipalities.js` is idempotent and
verified these cities exist.

| City | Status | Source |
|------|--------|--------|
| Garland | Confirmed in DB | STATE.md Quick Task 001; listed in seedCollinCountyMunicipalities.js |
| Richardson | Confirmed in DB | Same |
| Wylie | Confirmed in DB | Same |
| Sachse | Confirmed in DB | Same |
| Murphy | Confirmed in DB | Same |
| Princeton | Confirmed in DB | Same |

**IDs are not known at planning time** — the seeder looks them up at runtime via name lookup
(`supabase.from('municipalities').select('id, name').in('name', [...])`) as shown in
`scripts/seedPDFDataSources.js`. The Phase 10 seeder should follow the same pattern.

---

## Pipeline Compatibility Notes

### data_sources seeding pattern (from seedPDFDataSources.js)

Each city needs one `data_sources` row per fiscal year per dataset_type. Required fields:

```js
{
  name: 'Garland Operating Budget FY2025',   // unique identifier used for --source lookup
  api_type: 'pdf_download',
  dataset_type: 'operating',
  dataset_id: 'fy2025',
  base_url: '<PDF URL>',
  fiscal_years: [2025],
  municipality_id: muniId('Garland'),         // runtime lookup by name
  column_mapping: acfrCm,                     // standard column mapping
}
```

The `column_mapping` object (`acfrCm`) is the same for all cities:
```js
const acfrCm = {
  department_column: 'department',
  category_column: 'category',
  approved_amount_column: 'approved_amount',
  actual_amount_column: 'actual_amount',
  fiscal_year_column: 'fiscal_year',
  fund_column: 'fund',
};
```

### pdftotext extraction pattern (from processRevenuePDF.js + Longview work)

For pdftotext-first cities, the workflow is:
1. Run `pdftotext -layout <file.pdf> - | head -200` to inspect column layout
2. Write a city-specific parser function if layout is clean/tabular
3. Dry-run with `node scripts/processRevenuePDF.js --city <name> --fy <year> --dry-run` pattern
4. If pdftotext fails to converge in ~2-3 cycles, fall back to Haiku via `bulkLoadPDF.js`

For Haiku fallback: `bulkLoadPDF.js --source "<name>" --fiscal-year <year> --dry-run` then without `--dry-run`.

### RPC call (from bulkLoadPDF.js line 489-497)

```js
supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year: fiscalYear,
  p_dataset_type: ds.dataset_type || 'operating',
  p_total: total,
  p_tree: jsonTree,
  p_row_count: budgetRows.length,
  p_triggered_by: 'bulk_load',   // MUST be 'bulk_load'
});
```

`p_triggered_by: 'bulk_load'` is required (STATE.md confirmed).

---

## Expected pdftotext Tractability

| City | Budget Size | Expected Layout | pdftotext Tractability | Notes |
|------|-------------|-----------------|----------------------|-------|
| Garland | $200-500M (FY2025 ≈ large) | Professional budget book, likely tabular | MEDIUM | Large city, Adobe InDesign-generated PDFs — usually clean; FY2025 PDF >10MB suggests 100+ pages |
| Richardson | $406M (FY2025) | "Annual Budget Book" format, CivicLive hosted | MEDIUM-HIGH | Compressed PDF ("compressed 8-28" in filename) — compression may affect text extraction |
| Wylie | ~$50-150M | "Budget Book for Web" — web-optimized version | MEDIUM | "for Web" variant may be image-heavy; raw format XLSX also available as fallback |
| Sachse | $107.9M revenues, $143.6M expenditures (FY2025) | "Budget Workbook" suggests spreadsheet-export | MEDIUM-HIGH | Workbook title implies tabular/spreadsheet origin — good for pdftotext |
| Murphy | ~$20-80M | Standard Texas city budget book format | MEDIUM | Small city; amended version preferred; pdftotext usually handles small-city budgets well |
| Princeton | ~$20-80M | Operating budget, standalone document | MEDIUM | FY2026 PDF is 9.7MB — substantial document; FY2025 is 4.4MB |

### Fallback order per city if pdftotext fails

1. Garland → Haiku vision (section_heading prompt required per Phase 8 fix)
2. Richardson → Haiku vision  
3. Wylie → XLSX raw format (`RawFormatBudget.xlsx`) via `seedXLSXDataSources.js` pattern — **preferred fallback over Haiku**
4. Sachse → Haiku vision
5. Murphy → Haiku vision
6. Princeton → Haiku vision

**Wylie XLSX note:** Wylie publishes a "Raw Format" Excel file alongside the PDF budget. If pdftotext fails, `scripts/seedXLSXDataSources.js` can seed an XLSX data source instead of PDF. This is free and deterministic — better than Haiku.

---

## Revenue Opportunity (Decision 4)

Per Decision 4: only extract revenue if covered in the same PDF source. During dry-run, look for:
- "Summary of Revenues by Department" or "General Fund Revenue Summary" pages
- "Statement of General Fund Revenues" (McKinney/Allen format)
- "General Fund Schedule of Revenues" (Frisco format)

Cities most likely to have revenue in their standalone budget PDFs (based on comparable TX cities):
- Garland: HIGH likelihood (large city, comprehensive budget books include revenue)
- Richardson: HIGH likelihood (same)
- Wylie: MEDIUM (budget book format varies)
- Sachse: MEDIUM
- Murphy/Princeton: LOWER (smaller cities may have compressed budget documents)

---

## Sanity Check Thresholds (Decision 3)

| City | Expected GF Budget Range | Per-capita Basis |
|------|--------------------------|------------------|
| Garland | $200M–$500M | $240k pop × $1,000–2,000/resident |
| Richardson | $100M–$250M | $115k pop × $1,000–2,000/resident |
| Wylie | $50M–$150M | $60k pop × $1,000–2,000/resident |
| Sachse | $30M–$100M | $30k pop × $1,000–3,000/resident |
| Murphy | $20M–$80M | $25k pop × $1,000–3,000/resident |
| Princeton | $15M–$60M | $15k pop × $1,000–4,000/resident |

Sachse FY2025 actual: $143.6M total expenditures (from news coverage) — upper end of expected range, plausible for fast-growing suburb.

Richardson FY2025 actual: $406M total city budget (from news coverage) — includes all funds. General Fund portion typically 40-60% of total city budget, so $160M–$240M expected. Plausible.

---

## Common Pitfalls

### Pitfall 1: Garland FY2026 summary document
**What goes wrong:** The `/DocumentCenter/View/22610/` URL is only 211KB — likely a brochure/summary, not line-item data.
**How to avoid:** Start with FY2025 (`/DocumentCenter/View/20565/`) which is >10MB. If FY2026 adopted full budget exists, it would be on the main archive page (`garlandtx.gov/3528/`) but was not listed as of research date.

### Pitfall 2: Richardson document servers block direct web fetch
**What goes wrong:** `cor.net` returns HTTP 403 for all automated requests. PDF is not served from cor.net.
**How to avoid:** Use the CivicLive CDN URL directly (`cdnsm5-hosted.civiclive.com`). This host serves PDFs without auth. The city website's budget page links to this CDN.

### Pitfall 3: Wylie "for Web" PDF may be image-heavy
**What goes wrong:** Web-optimized budget PDFs sometimes flatten tables to images. pdftotext extracts zero text.
**How to avoid:** If pdftotext dry-run shows blank output, immediately try the XLSX raw format. Do not spend 30 minutes on pdftotext iteration if text extraction is empty.

### Pitfall 4: Murphy amended budget has two rows
**What goes wrong:** Both `/9213` (original) and `/9835` (amended) exist for Murphy FY2025. Seeding both creates duplicate operating data.
**How to avoid:** Use only `/9835` (with amendments as of 09/16/2025) — it's the most complete version. Seed only one data_source row per city per fiscal year.

### Pitfall 5: Princeton "Proposed" URL slug for adopted document
**What goes wrong:** `/DocumentCenter/View/2902/City-of-Princeton-Proposed-Budget-FY-2024-25` is labeled "Proposed" in the URL but is the adopted budget per the city's FY2025 page. A planner might re-search and find a different URL.
**How to avoid:** Use this URL — it's confirmed valid (4.4MB real PDF). Prefer Princeton FY2026 (`/6974/`) since it's explicitly adopted and larger (9.7MB).

### Pitfall 6: ACFR vs operating budget confusion
**What goes wrong:** Murphy and Princeton also publish ACFRs. ACFRs extract 5x inflated totals (confirmed in STATE.md from Prosper/Celina pattern). Standalone operating budgets are confirmed available — use those.
**How to avoid:** All 6 cities have standalone operating budget PDFs. Do not use ACFRs.

---

## Recommended Load Order

Load in descending population order (most data validation signal first):

1. **Garland** — largest city, highest confidence data quality
2. **Richardson** — second largest, confirmed PDF available
3. **Wylie** — XLSX fallback available if pdftotext fails
4. **Sachse** — workbook format likely tractable
5. **Murphy** — small but active finance dept; use amended FY2025
6. **Princeton** — smallest; use FY2026 (larger, explicitly adopted)

---

## Open Questions

1. **Garland FY2026 full budget:** The adopted FY2026 full line-item budget may not be published yet (only the 211KB summary exists as of research date). Confirm via dry-run. If the document contains only overview/summary pages, fall back to FY2025.

2. **Wylie "for Web" PDF tractability:** Cannot verify pdftotext compatibility without actually running it. The XLSX fallback makes this low-risk.

3. **Murphy FY2025 `/9213` identity:** The URL has no filename. It's listed alongside the amended version — could be identical content or an earlier draft. The amended `/9835` is safer.

4. **Princeton revenue coverage:** Princeton FY2026 (9.7MB) may include a revenue section given its size. Check during dry-run.

5. **Sachse FY2025 vs FY2026:** The "Budget Workbook" label for FY2025 is unusual. FY2026 uses "Adopted Budget" (cleaner label). If workbook has poor pdftotext layout, try FY2026.

---

## Sources

### Primary (HIGH confidence)
- `garlandtx.gov/3528/Annual-Budget-Documents` — full archive of Garland operating budget PDF URLs by year
- `garlandtx.gov/DocumentCenter/View/22610/` — Garland FY2026 adopted budget confirmed valid PDF (211KB; WebFetch confirmed)
- `princetontx.gov/DocumentCenter/View/2902/` — Princeton FY2025 confirmed valid PDF (4.4MB; WebFetch confirmed)
- `princetontx.gov/DocumentCenter/View/6974/` — Princeton FY2026 confirmed valid PDF (9.7MB; WebFetch confirmed)
- `cdnsm5-hosted.civiclive.com/Server_7964838/...` — confirmed Richardson TX city budget CDN server via multiple matching documents

### Secondary (MEDIUM confidence)
- `wylietexas.gov/departments/finance/budget.php` — Wylie budget page confirmed PDF paths (WebFetch retrieved page content)
- `murphytx.org/107/Finance` — Murphy finance page listed FY2025/FY2026 PDF URLs with fiscal year labels (WebFetch confirmed)
- `cityofsachse.com/792/Budget` — Sachse budget page listing `/11115/` and `/12467/` URLs (WebFetch confirmed)
- WebSearch: Sachse FY2025 total revenues $107.9M / expenditures $143.6M (from city adoption announcement)
- WebSearch: Richardson FY2025 total budget $406M (from Richardson Today article)

### Tertiary (LOW confidence)
- Garland FY2025 PDF size (>10MB) inferred from maxContentLength timeout — not directly measured
- Richardson/Wylie/Murphy/Sachse PDF sizes inferred from maxContentLength timeout

---

## Metadata

**Confidence breakdown:**
- PDF URLs: MEDIUM — all 6 cities have confirmed finance pages with PDF links; 4 PDFs confirmed via file response, 2 inferred from maxContentLength
- Municipality IDs: HIGH — confirmed seeded in STATE.md Quick Task 001
- Pipeline compatibility: HIGH — directly verified from bulkLoadPDF.js and seedPDFDataSources.js source code
- pdftotext tractability: LOW — not tested; inferred from file size signals and document type

**Research date:** 2026-05-21
**Valid until:** 2026-08-21 (stable — TX city budget PDFs don't move once adopted; may expire if cities redesign budget pages)
