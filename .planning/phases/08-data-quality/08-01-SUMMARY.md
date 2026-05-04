---
phase: 08
plan: 01
name: PDF Pipeline Fixes — max_tokens Guard and Cross-Page Section Context
subsystem: pdf-pipeline
tags: [haiku, extraction, max-tokens, section-heading, data-sources, frisco]
status: complete
completed: 2026-05-04
duration: ~4 minutes

dependency-graph:
  requires: [07-pdf-haiku-vision]
  provides: [corrected-haiku-pipeline, frisco-data-source]
  affects: [08-02-re-extraction, 08-03-frisco-extraction]

tech-stack:
  added: []
  patterns:
    - cross-page section context via prompt injection
    - stop_reason guard for deterministic truncation (no retry)
    - per-processPDF-call state (not module-level) to prevent bleed

key-files:
  created: []
  modified:
    - scripts/bulkLoadPDF.js
    - scripts/seedPDFDataSources.js

decisions:
  - "max_tokens=8192 (sufficient for dense ACFR; 64k unnecessary and costly)"
  - "section_heading via two-pass prompt (more reliable than row-value heuristics)"
  - "currentSection scoped per processPDF call to prevent cross-document bleed"
  - "stop_reason guard returns confidence=0 without retry (truncation is deterministic)"
---

# Phase 8 Plan 01: PDF Pipeline Fixes — max_tokens Guard and Cross-Page Section Context — Summary

**One-liner:** Fixed two root-cause pipeline defects in bulkLoadPDF.js — JSON truncation (max_tokens 2048→8192, stop_reason guard) and Unknown-department dominance (section_heading prompt + per-page context carry-forward) — and seeded Frisco Operating Budget FY2026 data_source.

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Fix max_tokens truncation: 2048→8192 + stop_reason guard | 47b6196 | scripts/bulkLoadPDF.js |
| 2 | Add cross-page section_heading context to extraction | 35a8922 | scripts/bulkLoadPDF.js |
| 3 | Add Frisco Operating Budget FY2026 data_source + run seeder | 2724531 | scripts/seedPDFDataSources.js |

---

## Change Details

### Task 1 — max_tokens fix (bulkLoadPDF.js)

**Line range:** ~273–309 (callHaikuWithRetry)

Changes:
- Line 293: `max_tokens: 2048` → `max_tokens: 8192`
- Lines 302–309: Added `stop_reason === 'max_tokens'` guard immediately after `messages.create`, before reading `response.content[0].text`. Returns `{ page_type: 'other', confidence: 0, reason: 'max_tokens_truncation: response truncated, JSON incomplete', rows: [] }` without retrying or parsing.

Rationale: Haiku 4.5 supports 64k output tokens; 8192 handles the worst realistic dense ACFR page (~40 line items × ~200 tokens each) without unnecessary cost. Truncation is deterministic — retrying would reproduce the same truncated JSON, so the guard returns immediately.

### Task 2 — Cross-page section_heading context (bulkLoadPDF.js)

**Change A — EXTRACTION_PROMPT_BASE (lines ~185–218):**
- Renamed `EXTRACTION_PROMPT` → `EXTRACTION_PROMPT_BASE`
- Added `"section_heading": "Public Safety"` to budget_table example JSON
- Added `"section_heading": null` to narrative example JSON
- Added section_heading rule: returns visible ACFR section header or null
- Added context injection note explaining the runtime `Context: Current ACFR section is "..."` line

**Change B — buildExtractionPrompt helper (lines ~220–228):**
```javascript
function buildExtractionPrompt(sectionContext) {
  if (!sectionContext) return EXTRACTION_PROMPT_BASE;
  return EXTRACTION_PROMPT_BASE + '\n\nContext: Current ACFR section is "' + sectionContext + '". Apply as department for rows without an explicit department header.';
}
```

**Change C — validateExtractionResult (lines ~260–262):**
Added after rows array check:
```javascript
if ('section_heading' in obj && obj.section_heading !== null && (typeof obj.section_heading !== 'string' || obj.section_heading.trim() === '')) {
  return { ok: false, reason: 'Schema violation: section_heading must be null or non-empty string' };
}
```
Missing field (older responses) treated as null — not rejected.

**Change D — callHaikuWithRetry signature + processPDF loop:**
- callHaikuWithRetry: added `prompt` as 3rd parameter; `text: EXTRACTION_PROMPT` → `text: prompt`
- processPDF: declared `let currentSection = null;` inside function (line ~374), scoped per-call
- Per-page loop: builds `const prompt = buildExtractionPrompt(currentSection)` and passes to callHaikuWithRetry
- After result: updates `currentSection` from `result.section_heading` if present (before page_type check, so heading pages advance context even when not budget_table)
- Row collection: `if (!row.department && currentSection) row.department = currentSection`

### Task 3 — Frisco data_source (seedPDFDataSources.js)

- Added `FRISCO_BUDGET_FY2026` URL constant (line 44)
- Added `'Frisco'` to municipalities `.in()` array (line 70)
- Added `Frisco Operating Budget FY2026` entry after Celina, before Plano FY2019 (lines 119–127)

**Seeder live run output (key lines):**
```
Upserting: Frisco Operating Budget FY2026
  (inserted new row)
  id:           de4a6008-0c7b-43b4-ab19-5f60ed400303
  api_type:     pdf_download
  dataset_type: operating
  dataset_id:   fy2026
  fiscal_years: [2026]
  base_url:     https://www.friscotexas.gov/DocumentCenter/View/39479/Budget-Fiscal-Year-26-PDF

Verification: treasury_list_source_ids returns 24 pdf_download row(s).
```

**`--list` output (operating pdf_download sources visible):**
```
Allen ACFR FY2025 (operating, FY2025)
Celina ACFR FY2025 (operating, FY2025)
Frisco Operating Budget FY2026 (operating, FY2026)
Plano Operating Budget FY2019 (operating, FY2019)
Plano Operating Budget FY2020 (operating, FY2020)
Plano Operating Budget FY2022 (operating, FY2022)
Plano Operating Budget FY2023 (operating, FY2023)
Plano Operating Budget FY2024 (operating, FY2024)
Plano Operating Budget FY2025 (operating, FY2025)
Plano Operating Budget FY2026 (operating, FY2026)
Prosper ACFR FY2025 (operating, FY2025)
```
(11 operating pdf_download entries — Allen, Celina, Frisco, 7 Plano FY, Prosper)

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| max_tokens=8192 | Dense ACFR page ~40 rows × ~200 tokens ≈ 8000; 64k is unnecessary and would increase cost |
| stop_reason guard returns without retry | Truncation is deterministic — retrying produces same truncated output |
| section_heading via prompt injection | More reliable than post-hoc row-value heuristics; lets Haiku use visual context |
| currentSection scoped inside processPDF | Per-call scope prevents cross-document bleed when multiple PDFs processed in same process |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Next Phase Readiness

Plans 02 and 03 can now run against the fixed pipeline:
- Plan 02: Re-extract Allen, Prosper, Celina ACFRs against corrected pipeline
- Plan 03: Extract Frisco Operating Budget FY2026 (data_source now seeded as de4a6008)

No blockers. Both downstream plans can proceed immediately.
