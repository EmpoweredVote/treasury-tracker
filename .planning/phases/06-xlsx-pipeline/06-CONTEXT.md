# Phase 6: XLSX Pipeline - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a generic XLSX download pipeline that fetches Excel files from city websites, parses and deduplicates rows, and loads them into the treasury schema. Initial load covers Plano, McKinney, and Frisco — all available fiscal years. The loader must be reusable for any city with an XLSX export by changing only the `data_sources` row.

</domain>

<decisions>
## Implementation Decisions

### Download access
- Static direct URL only — loader does a simple HTTP GET against the URL stored in `data_sources`
- Follow HTTP redirects automatically (handles short links and CDN hops)
- No local caching — always re-download on each run to ensure latest data
- Fail fast on download error: log URL + HTTP status, exit non-zero, no partial load

### Dedup strategy
- Row hash composed of all content columns (every column in the row)
- Re-run behavior: skip-silent — rows whose hash already exists in the DB are not touched
- Corrections to source data require a manual re-seed (not silently applied on re-run)
- Always print a one-line summary at end of run: `Inserted: N | Skipped: N | Errors: N`
- `--force-reload` flag supported: clears existing rows for that data_sources row and re-inserts everything

### Multi-fiscal-year handling
- One `data_sources` row per city + dataset + fiscal year
- `fiscal_year` value comes from the `data_sources` config row, not from a column in the XLSX
- Missing `fiscal_year` in config = fail with a clear config error (not a default)
- Initial load scope: **all available fiscal years** for Plano, McKinney (transactions + payroll), and Frisco — not just latest
- Each year's data_sources row has its own download URL

### Parse error behavior
- Skip bad rows and log them (row number + reason), but enforce an error threshold
- If error rate exceeds ~5% of total rows, fail the entire load
- Auto-skip blank rows and header-duplicate rows (rows where a numeric field contains its column label)
- Parse errors printed to console only — no separate log file
- Successful load summary: one line, e.g. `Plano FY2025: 12,048 inserted | 0 skipped | 0 errors`

### Claude's Discretion
- Exact error threshold percentage (5% is the intent)
- XLSX parsing library choice (e.g., `xlsx`, `exceljs`)
- Internal batch size for DB inserts
- Column header normalization approach (trimming whitespace, lowercasing)

</decisions>

<specifics>
## Specific Ideas

- Pattern should mirror `bulkLoadBudget.js` / `bulkLoadTransactions.js` — column mapping lives entirely in `data_sources`, no city-specific code branches
- `data_sources.api_type = 'xlsx_download'`; same column mapping JSON convention as Socrata

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-xlsx-pipeline*
*Context gathered: 2026-05-01*
