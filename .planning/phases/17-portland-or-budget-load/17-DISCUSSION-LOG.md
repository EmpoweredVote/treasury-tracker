# Phase 17: Portland OR Budget Load - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 17-Portland OR Budget Load
**Areas discussed:** Data source format, Budget types in scope, Fiscal year depth

---

## Data source format

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher figures it out | Standard approach — researcher checks opendata.portland.gov, confirms Socrata or finds actual endpoint | ✓ |
| I know it uses Socrata | Skip format discovery, focus on dataset ID and column mapping | |
| I know it's PDF / CSV only | Focus on download format and PDF/CSV loader selection | |

**User's choice:** Researcher figures it out

---

| Option | Description | Selected |
|--------|-------------|----------|
| Build a custom CSV loader (like SD) | If no Socrata, write a city-specific loader similar to loadSanDiegoCSV.js | ✓ |
| Use the PDF pipeline if needed | Fall back to bulkLoadPDF.js if no structured data | |
| Block on Socrata — skip non-Socrata cities | Only proceed if Portland is on Socrata | |

**User's choice:** Build a custom CSV loader (like SD) if not on Socrata

---

## Budget types in scope

| Option | Description | Selected |
|--------|-------------|----------|
| Operating + Revenue | Matches LA/SF/SD pattern | |
| Operating only | Faster to ship; revenue as follow-up | |
| Researcher decides based on availability | Let researcher scope based on what's cleanly available | ✓ |

**User's choice:** Researcher decides based on availability

---

## Fiscal year depth

| Option | Description | Selected |
|--------|-------------|----------|
| FY2025 + FY2026 only | CA cities pattern; fast, low cost | |
| Go back several years (like TX) | FY2018+; more enrichment cost and loader complexity | |
| Researcher checks what's cleanly available | Recommend depth based on data quality | ✓ |

**User's choice:** Researcher checks what's cleanly available

---

## Claude's Discretion

- `OR: 'Oregon'` added to `EntitySwitcher.tsx` STATE_LABELS — cosmetic, one-line, same pattern as TX fix applied earlier
- Population data approach (Census OR FIPS 41, `sub-est2024_41.csv`) — settled pattern from prior phases, no discussion needed
- Enrichment inclusion — assumed standard (all prior cities got enrichment)

## Deferred Ideas

None.
