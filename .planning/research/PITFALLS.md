# Domain Pitfalls — MA DLS Municipal Budget Load (v1.8)

**Domain:** Bulk municipal budget data load from MA DLS Gateway (351 cities × 2 data types = 702 source loads)
**Researched:** 2026-06-09
**Context:** `scrapeMaDLS.js` already built and partially parameterized; pitfalls apply to operating it at scale, interpreting its output correctly, and running enrichment safely.
**Confidence:** HIGH for pitfalls derived from reading the actual scraper code and portal responses; MEDIUM for filing-gap frequency and portal downtime patterns

---

## Critical Pitfalls

### Pitfall 1: AWSALB Sticky-Session Cookie Rotation Breaks HTML Pagination

**What goes wrong:** The MA DLS portal runs behind AWS Application Load Balancer. Every response sets a new `AWSALB` cookie value. If pagination requests use the rotated cookie, they hit a different backend instance that has no `rdDataCache` in memory. The paginated requests return empty tables or silent redirects. The scraper writes debug HTML only when row count is zero — a response that returns an HTML error page without the expected table ID will trigger the debug dump, but the run appears to "succeed" with far fewer than 351 records.

**Why it happens:** `rdDataCache` is a server-side key tied to the originating backend instance. The scraper comment in `scrapeViaHtml` already calls this out: "Always use the original cookies from the initial GET." The risk is that any future maintenance changes the cookie-passing logic in pagination loops.

**Consequences:** Silent data loss. The scraper runs to completion. The output JSON has, say, 49 records instead of 351 (one page's worth). The `--load` step processes only those 49 towns. The other 302 get no budget data.

**Prevention:**
- Never update the `cookies` variable inside pagination loops. The `getPage` return value has a `cookies` field — ignore it during pagination; use only the cookies captured from the initial GET.
- After every `--scrape` run, validate: `records.length === 351` (or within 5 of 351 to allow for very small towns with all-zero rows). Fail loudly if below 340. The current code logs the count but does not throw.
- Prefer the Excel export path — it requires only 2 HTTP requests (initial GET + export POST) instead of 8 page fetches, so cookie rotation never becomes relevant.

---

### Pitfall 2: Schedule A "Special Revenue Funds" is Not a Department-Based Operating Budget

**What goes wrong:** The scraper labels `special-revenue` as `datasetType: 'operating'`. But Schedule A Special Revenue Funds is a fund-type classification — the top-level categories are "Federal General Government Grants", "Federal Public Safety Grants", "State Grants", "Receipts Reserved for Appropriation", "Revolving Funds", "Other Special Revenue." Displaying this as "operating budget" alongside TX/CA/OR cities makes MA cities look like their entire operation is grant-funded. A citizen looking at Weymouth, MA and Dallas, TX will see completely different category names for what the app labels the same dataset type.

**Why it happens:** Special Revenue Funds is what the MA DLS portal makes most accessible — it is the first and most prominent Schedule A tab. The scraper was built around it. But the General Fund Expenditures by Function report (`gf-expenditures` in the scraper, `rdreport: 'ScheduleA.GF.ExpendituresByFunctionMain'`) is the structural equivalent of what other states call the operating budget. Its categories are: General Government, Public Safety, Education, Public Works, Human Services, Culture and Recreation, Debt Service, Intergovernmental.

**Consequences:** Citizens see "Federal Education Grants" as a category for MA cities while seeing "Public Safety" for TX cities — both labeled "Operating Budget" in the UI. This is the most visible data quality problem in the entire milestone.

**Prevention — concrete decision required:**

Use `gf-expenditures` (General Fund Expenditures by Function) as the primary `operating` dataset for MA. This maps to departments and matches TX/CA/OR display. The scraper already defines this report — verify the rdreport value is correct with `--explore gf-expenditures` before loading.

Keep Special Revenue Funds as a separate supplemental dataset (`dataset_type: 'special-revenue'`) or defer it entirely to a post-v1.8 phase. Do not load it as `dataset_type: 'operating'`.

**Phase to address:** Phase decision before any --load runs for operating data.

---

### Pitfall 3: rdDataCache Expires Between Initial GET and Excel Export POST

**What goes wrong:** The Excel export URL (`?rdReportFormat=NativeExcel&rdExportTableID=...&rdDataCache=<N>`) requires a valid server-side cache entry. If too much time elapses between the initial GET (which creates the cache) and the export POST, the server returns an HTML page instead of an `.xlsx` file. The scraper's `tryExcelExport` function detects this via `content-type` inspection and falls back to HTML pagination. However, for the `revenue-by-source` report, HTML pagination is POST-based and sends all 351 municipality checkbox values per page — a large payload where mid-run session loss is harder to detect.

**Why it happens:** The `DELAY_MS = 1500` sleep between the initial GET and the Excel POST is usually short enough. But if the Node process is CPU-stalled (e.g., other async work), the delay can stretch. On slow connections or under server load, cache entries expire sooner.

**Consequences:** The scraper continues but switches to the slower, less reliable HTML pagination path. For `revenue-by-source`, POST-based pagination failures leave silent gaps. The output JSON has fewer than 351 records.

**Prevention:**
- Keep `DELAY_MS` at 1500ms or less between initial GET and Excel export. Do not add extra logging, DB queries, or file I/O between these two steps.
- Always save raw Excel bytes to `scripts/output/raw_<report>_<fy>.xlsx` (the scraper already does this). If DB load fails, re-run `--load --file` from the saved JSON rather than re-scraping.
- If Excel returns HTML in more than 2 consecutive attempts on different days, the portal's cache TTL may have been reduced — reduce any intermediate delays to near-zero for the GET→POST sequence.

---

## Moderate Pitfalls

### Pitfall 4: Municipality Name Mismatch Between DLS Report and the municipalities Table

**What goes wrong:** The loader (`loadToSupabase`) matches municipalities by `name` and `state = 'MA'`. If the municipalities table has a slightly different spelling than what DLS reports (which are the authoritative source for MA names), the row is silently skipped. The loader logs one warning when the first skip occurs, then stops logging further skips.

**High-risk names:** Manchester-by-the-Sea, North Attleborough (DLS) vs. North Attleboro (common abbreviation), Aquinnah (formerly Gay Head), Gosnold, West Tisbury, Chilmark, Tisbury.

**Why it happens:** The `seedMunicipalities` function inserts names verbatim from DLS records. If the municipalities table was pre-seeded by a different route (Census FIPS names, a prior script), hyphenation and abbreviation may differ.

**Prevention:**
- Always run `--seed` from the scraped JSON before `--load`. The seeder uses `maybeSingle()` on name+state and inserts only if not found — this ensures DLS-exact names are in the table.
- After `--load`, verify: `SELECT COUNT(DISTINCT municipality_id) FROM treasury.data_sources WHERE api_type = 'ma-dls'`. If below 345, query for the skipped names and compare to DLS.

---

### Pitfall 5: Small Towns Return All-Zero Rows for Certain Fund Types

**What goes wrong:** Very small towns (Gosnold ~75 people, Monroe ~121, Hawley ~337, Windsor ~825) may have no activity in certain Special Revenue fund types (no federal grants, no revolving funds). The scraper correctly calls `parseAmount` on empty cells and gets 0. The loader skips municipalities where `tree.length === 0` (all amounts were zero). The town ends up in the municipalities table with no budget record, and the frontend displays "No budget data available."

**Why it happens:** DLS includes a row for every town in every report regardless of activity. A row of all-zero amounts is valid data meaning "this town had no activity in this fund type." The scraper correctly skips zero rows from the tree, but a town with only zeros produces an empty tree.

**Consequences for `gf-expenditures`:** Extremely unlikely. All 351 towns have at least school expenses and road maintenance in their general fund. The zero-tree problem is specific to fund-type reports (Special Revenue, Federal Grants) where small towns genuinely have no activity.

**Prevention:**
- When using `gf-expenditures` as the operating dataset, expect near-zero data gaps.
- Add explicit logging when `tree.length === 0`: output the municipality name so operator can verify it is a genuine data gap rather than a parsing failure.
- Accept that Gosnold and 3-4 other island/rural towns may have no displayable data. Do not create placeholder zero-budget records.

---

### Pitfall 6: Fiscal Year Gaps — Towns That Filed Late or Not at All

**What goes wrong:** Schedule A submissions are due December 31 after the fiscal year end (June 30). As of June 2026, FY2025 data may be missing for 5-20 towns that filed late or are under DOR fiscal oversight. The scraper requests FY2025 but those towns simply have no row in the report. The output JSON records fewer than 351 municipalities without identifying which ones are absent.

**Why it happens:** DLS data is "extracted real-time based on the municipal submission." Non-filers are invisible in the report — they are not represented as zero rows.

**Prevention:**
- Run with `--fy 2024` as a primary option for the initial load. FY2024 data is essentially complete for all 351 towns.
- If FY2025 is desired, run the scrape and check `records.length`. If below 345, default to FY2024 instead.
- Do not attempt to load both FY2024 and FY2025 in the same initial milestone — pick one complete year and note it in the data source description.

---

### Pitfall 7: Dual Hostname Redirect Invalidates Session Cookies

**What goes wrong:** The DLS portal has two active hostnames: `dlsgateway.dor.state.ma.us` and `dls-gw.dor.state.ma.us`. Report pages under the first host return HTTP 301 redirects to the second. Node's `fetch` follows redirects, but session cookies issued for `dls-gw.dor.state.ma.us` are scoped to that domain. If a pagination request accidentally uses a URL containing `dlsgateway.dor.state.ma.us`, the redirect changes the effective domain and the cookie is not sent with the redirected request — the session is lost.

**Prevention:** The scraper hardcodes `BASE_URL = 'https://dls-gw.dor.state.ma.us/reports/rdpage.aspx'`. Never change this constant and never mix the two hostnames within a single scrape run. When adding new reports, verify their rdreport value on `dls-gw.*`, not on `dlsgateway.*`.

---

## Minor Pitfalls

### Pitfall 8: Revenue-by-Source Column Header Misalignment

**What goes wrong:** The `revenue-by-source` report uses `<th>` elements with `colspan`/`rowspan` attributes. The standard `parseTable` th-extraction counts them wrong, misaligning column names with data values. The scraper overrides this with a hardcoded `columnNames` array.

**Prevention:** Never remove or modify the `columnNames` override in the `revenue-by-source` report definition. If DLS adds a new column to the report in a future fiscal year, this hardcoded array will silently misalign — verify with `--explore revenue-by-source` on any new year before loading.

---

### Pitfall 9: Portal Downtime Causes Partial Scrape Output

**What goes wrong:** The DLS Gateway has been observed to have maintenance windows, particularly around fiscal year close (late June–early July) and sporadic off-hours outages. A full-state HTML pagination scrape takes 10-20 minutes. A mid-run HTTP 503 causes the in-progress report to have partial row counts, but the scraper may not fail — it may write a partial output JSON and report success.

**Prevention:**
- Run scrapes off-peak. The Excel export path finishes in under 5 minutes for all 351 municipalities (2-3 HTTP requests total). Prefer Excel export to minimize exposure to downtime.
- Avoid running in late June/early July when MA fiscal year closes and DLS has historically been under higher load.
- Always validate record counts before loading.

---

### Pitfall 10: All 351 MA Municipalities Inserted as entity_type 'city'

**What goes wrong:** Massachusetts has 14 legally incorporated cities and 337 towns. Towns are governed by Town Meeting (or Representative Town Meeting), not a Mayor/City Council. The `enrichCategories.js` entity_type 'city' prompt says "This is a city government with a mayor and city council" — factually incorrect for 337 MA municipalities.

**Consequences:** Enrichment descriptions reference "the city council" for towns governed by a Board of Selectmen. This is cosmetic inaccuracy, not a data loading bug.

**Prevention:** Accept entity_type 'city' for all MA municipalities in v1.8. This matches existing behavior for TX/CA/OR. Add a `'town'` entity type with MA-specific enrichment prompt context in a future phase. Add a `TODO` comment in `buildEntityContext` in `enrichCategories.js` noting this gap.

---

## Enrichment Cost Gate

**Risk:** Running `enrichCategories.js --all --state MA` without a `--limit` flag can approach or exceed the $5 approval threshold.

**Concrete estimate — operating budget only (gf-expenditures):**

| Variable | Value |
|----------|-------|
| Cities | 351 |
| Categories per city (gf-expenditures) | ~8 functional categories |
| Total enrichment calls | ~2,800 |
| Input tokens per call | ~700 (prompt + category name + amounts) |
| Output tokens per call | ~200 (JSON response) |
| Total input tokens | 1.96M |
| Total output tokens | 560K |
| Cost at Haiku 4.5 ($1/MTok in, $5/MTok out) | $1.96 + $2.80 = **$4.76** |

This is just under the $5 threshold. Cost exceeds $5 if any of these occur:
- Revenue dataset is also enriched in the same run (+$3-4 for ~2,100 additional calls)
- `--depth 1` or `--depth all` is passed (subcategory enrichment multiplies call count by 2-4x)
- `--force` is used re-enriching already-covered categories

**Mandatory gate procedure:**

1. Run with `--limit 50 --dry-run` first to verify prompt quality for MA town categories
2. Use `--skip-universal` to skip categories already enriched from other cities (e.g., "Debt Service", "General Government" may already be universal)
3. First real run: `--limit 200 --state MA` — monitor actual token usage in Anthropic console before proceeding
4. Never run `--all --state MA` without `--limit` on the first attempt
5. Run operating and revenue enrichment in separate sessions — confirm operating cost is under $3 before starting revenue

**Cost reduction option:** The Anthropic Batch API reduces Haiku 4.5 to $0.50/MTok input and $2.50/MTok output — halving estimated cost to ~$2.38 for operating budget. `enrichCategories.js` does not currently use the Batch API; adding batch support is the most impactful cost reduction available for a 351-city run.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| MA operating data scrape | Cookie rotation + HTML pagination drops to 49 records | Validate records >= 340; prefer Excel export; save raw bytes |
| MA operating dataset choice | Special Revenue Funds mislabeled as 'operating' | Use gf-expenditures as operating; verify rdreport value with --explore first |
| MA revenue data scrape | POST-based pagination (revenue-by-source) more fragile | Prioritize Excel export; never update cookies during pagination |
| Municipality seed step | Name mismatches for hyphenated/island towns | Run --seed before --load; query data_sources count after |
| FY selection | FY2025 may be incomplete for 5-20 towns | Default to FY2024 unless FY2025 count >= 345 |
| Small town data gaps | Towns < 500 pop may return all-zero rows | Accept; add explicit logging when tree.length === 0 |
| Dual hostname | URL with dlsgateway.* loses session cookie | Keep BASE_URL as dls-gw.* always |
| Enrichment run | Operating + revenue combined may exceed $5 | Use --limit; run operating first; use --dry-run; use --skip-universal |
| entity_type for towns | 337 Town Meeting towns labeled 'city' | Accept for v1.8; add TODO comment for future 'town' entity type |
