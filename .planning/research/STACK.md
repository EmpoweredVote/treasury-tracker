# Stack Research: v1.6 California City Expansion
**Researched:** 2026-06-03

## Summary

Of the seven target cities, only two (San Jose and Oakland) run confirmed Socrata portals compatible with `bulkLoadBudget.js`. Long Beach uses OpenDataSoft (not Socrata), Sacramento uses ArcGIS-based open data, and Fresno, Riverside (city), and Bakersfield publish budget data as PDFs with no confirmed machine-readable API. Five of seven cities require PDF loaders; Bakersfield needs a quick API probe before assigning a loader.

## City-by-City Assessment

### Long Beach, CA
- **Open data portal:** https://data.longbeach.gov/
- **Platform:** OpenDataSoft (NOT Socrata — confirmed via portal footer referencing "Huwise/OpenDataSoft"; uses its own REST API, not SODA)
- **Socrata:** No
- **Budget dataset:** Budget documents available as PDF at https://www.longbeach.gov/finance/city-budget-and-finances/budget/ — no machine-readable budget dataset confirmed on the open data portal
- **Recommended loader:** bulkLoadPDF.js (Claude Haiku vision) or Python pdfplumber
- **Notes:** data.longbeach.gov has an API console but it is OpenDataSoft's proprietary API. bulkLoadBudget.js is incompatible without a new OpenDataSoft adapter. PDF approach avoids that dependency.

### San Jose, CA
- **Open data portal:** https://data.sanjoseca.gov/
- **Platform:** Socrata (confirmed — data.sanjoseca.gov is a Socrata-hosted portal)
- **Socrata:** Yes
- **Budget dataset:** No specific dataset ID confirmed. Portal has budget data but dataset ID requires a direct search on data.sanjoseca.gov for "operating budget" or "expenditures." Fallback PDFs at https://www.sanjoseca.gov/your-government/departments-offices/office-of-the-city-manager/budget/budget-documents
- **Recommended loader:** bulkLoadBudget.js — contingent on confirming a budget dataset exists with a usable department-level schema
- **Notes:** If no structured budget dataset is found on the Socrata portal, fall back to PDF approach.

### Sacramento, CA
- **Open data portal:** https://data.cityofsacramento.org/ (also https://data-saccity.opendata.arcgis.com/)
- **Platform:** ArcGIS Online (NOT Socrata — confirmed via search showing ArcGIS Online hosting)
- **Socrata:** No
- **Budget dataset:** Budget available as PDF at cityofsacramento.gov. No structured API budget dataset found.
- **Recommended loader:** bulkLoadPDF.js (Claude Haiku vision) or Python pdfplumber
- **Notes:** Sacramento's open data portal is ArcGIS-based. SODA API does not apply.

### Oakland, CA
- **Open data portal:** https://data.oaklandca.gov/
- **Platform:** Socrata (confirmed — multiple datasets documented at dev.socrata.com/foundry/data.oaklandca.gov/)
- **Socrata:** Yes
- **Budget dataset:** Portal covers "budget, governmental spending, taxes, revenues, and expenses." Specific dataset ID not confirmed — requires a direct search on data.oaklandca.gov. Example confirmed Socrata dataset IDs on this domain: dxdg-872h, 4jcx-enxf, ppgh-7dqv.
- **Recommended loader:** bulkLoadBudget.js — contingent on confirming a budget dataset with usable department-level schema
- **Notes:** Oakland is the strongest Socrata candidate. Verify dataset existence and column schema before building the phase plan.

### Fresno, CA
- **Open data portal:** None found. City GIS data is in a separate ArcGIS hub (County level only: datasharing-cofgisonline.hub.arcgis.com).
- **Socrata:** No
- **Budget dataset:** PDF only. Financial reports confirmed at https://www.fresno.gov/finance/financial-reports/ — all documents are PDF with no CSV or API alternative available.
- **Recommended loader:** bulkLoadPDF.js (Claude Haiku vision) or Python pdfplumber
- **Notes:** Fresno has no city-level open data portal. PDF quality should be verified before committing to a loader approach — check whether the budget PDFs are text-based or scanned.

### Riverside, CA
- **Open data portal:** https://riversideca.gov/transparency/data/ ("Engage Riverside") — a custom city transparency site, NOT Socrata
- **Platform:** Custom city transparency portal. Riverside County has Socrata (riversideco-ca.data.socrata.com) but that is the county, not the city.
- **Socrata:** No (city); County yes — but county is out of scope
- **Budget dataset:** PDF at https://riversideca.gov/finance/budget.asp — FY 2024-2026 Budget Book is a multi-year PDF. No structured API dataset found for city operating expenditures.
- **Recommended loader:** bulkLoadPDF.js (Claude Haiku vision) or Python pdfplumber
- **Notes:** Do not confuse Riverside County (has Socrata) with City of Riverside (does not). City budget is a multi-year PDF book requiring extraction.

### Bakersfield, CA
- **Open data portal:** https://bakersfielddatalibrary-cob.opendata.arcgis.com/ (ArcGIS-based general data library)
- **Platform:** ArcGIS Open Data for general data. Budget at https://budget.bakersfieldcity.us/#/view-data uses an interactive Open Budget viewer — URL pattern matches Socrata Open Budget hosting but no SODA endpoint confirmed.
- **Socrata:** Unclear — budget.bakersfieldcity.us strongly resembles the Socrata Open Budget product (same URL convention as other Socrata budget sites) but no downloadable dataset or API endpoint was confirmed
- **Budget dataset:** budget.bakersfieldcity.us — interactive viewer with revenues, expenditures, capital improvements. No CSV download or SODA API confirmed.
- **Recommended loader:** Needs investigation — probe GET https://budget.bakersfieldcity.us/api/views to check for SODA response. If confirmed Socrata, use bulkLoadBudget.js; if not, use bulkLoadPDF.js.
- **Notes:** If the budget viewer is backed by Socrata, dataset IDs will be discoverable. This is worth a 15-minute investigation before defaulting to PDF.

## Loader Assignment Summary

| City | Platform | Socrata | Recommended Loader |
|------|----------|---------|-------------------|
| Long Beach | OpenDataSoft | No | bulkLoadPDF.js |
| San Jose | Socrata | Yes | bulkLoadBudget.js (verify dataset ID first) |
| Sacramento | ArcGIS Online | No | bulkLoadPDF.js |
| Oakland | Socrata | Yes | bulkLoadBudget.js (verify dataset ID first) |
| Fresno | None | No | bulkLoadPDF.js |
| Riverside | Custom | No | bulkLoadPDF.js |
| Bakersfield | ArcGIS + custom budget viewer | Unclear | Needs investigation |

## New Dependencies Needed

None — existing loaders cover all confirmed scenarios. If Bakersfield is confirmed as Socrata Open Budget, `bulkLoadBudget.js` applies with no new dependencies. PDF-based cities use existing `bulkLoadPDF.js` and/or `pdfplumber` infrastructure.

## Cities Needing Manual Investigation

- **Bakersfield** — Probe `GET https://budget.bakersfieldcity.us/api/views` before assigning loader. If JSON returns dataset records, it's Socrata and `bulkLoadBudget.js` applies.
- **San Jose** — Socrata portal confirmed but no budget dataset ID found. Search data.sanjoseca.gov for "operating budget" or "expenditures" to find a dataset with department-level columns.
- **Oakland** — Socrata portal confirmed but no budget dataset ID found. Search data.oaklandca.gov for budget/expenditures dataset; confirm it has department/category columns compatible with the existing loader schema.
- **Long Beach** — PDF budget quality unknown. Verify that longbeach.gov/finance budget PDFs are text-based (not scanned) before committing to pdfplumber vs. Claude Haiku vision loader.
