# 46-03 Summary — DoD Audit Opacity + Phase Verification

**Executed:** 2026-06-12 | **Status:** Complete

## The official record (Task 1)

Source chain attempted in order: comptroller.defense.gov (403 even via WebFetch) → dodig.mil (403 even via WebFetch) → GAO High-Risk report via WebFetch (reachable, but the fetched portion lacked audit specifics) → **WINNER: the FY2025 Financial Report of the U.S. Government on fiscal.treasury.gov (curl-friendly), which embeds GAO's Independent Auditor's Report**. Verbatim, p. 211:

> "The Department of Defense and Security Assistance Accounts received disclaimers of opinion on their fiscal years 2025 and 2024 financial statements."

PDF committed knowledge: `docs/federal/fy2025-financial-report.pdf` (9.4MB, fetched 2026-06-12); GAO audit section extracted to `docs/federal/fr_gao_audit.txt`.

**No-inference rule applied:** the source states two specific fiscal years; no "consecutive since FY2018"-style count appears anywhere in the report (grep verified). Metric value = 2 with a label quoting the exact sentence and stating the counting rule. No human-download checkpoint needed.

## Three touchpoints, one citation (Task 2)

1. `dod_consecutive_failed_audits` metric (value 2, as_of 2025-09-30, source_url = the exact PDF) + `us-financial-report` registry row.
2. MethodologyPanel "Can these numbers be audited?" — renders only when the metric exists, count computed from it, structural framing (Treasury totals are official; the audit concerns DoD's internal accounting), SourceChip to the PDF.
3. National Defense + DoD enrichment descriptions carry the audit sentence (evidence_summary updated; reloaded via loadFederalEnrichment.js — 27 rows, idempotent).

## Phase verification (Task 3)

46-VERIFICATION.md: SRC-01/02/03/04 all PASS; sourcing sweep clean (27/27 cited; sampled URLs 200); zero universal rows; build green.

## Deviations from plan

defense.gov/dodig.mil both blocked even via WebFetch — the Financial Report path (4th candidate, discovered during execution) is BETTER than the planned ones: current-year, GAO-authored, Treasury-hosted, curl-friendly, and it covers every agency's audit status in one document (useful for future opacity flags beyond DoD).
