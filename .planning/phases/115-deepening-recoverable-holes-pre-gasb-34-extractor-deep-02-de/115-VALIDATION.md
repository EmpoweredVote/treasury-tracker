---
phase: 115
slug: deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
---

# Phase 115 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — loader-embedded per-FY tie gates (node CLI `--dry-run`) |
| **Config file** | none — Wave 0 not needed (gates ship inside each loader) |
| **Quick run command** | `node scripts/process{ST}Acfr.js --dry-run --fy <year>` (+ Revenue twin) |
| **Full suite command** | all four states' loaders (op + rev) `--dry-run`, exit 0 |
| **Estimated runtime** | ~10–60 s per loader (cached PDFs; downloads add time on first run) |

---

## Sampling Rate

- **After every task commit:** Run the affected loader(s) `--dry-run` for the years touched — every recovered year must print a PASS tie.
- **After every plan wave:** Run the plan's loaders full `--dry-run` (exit 0) + read-only DB selects for live-loaded years.
- **Before `/gsd:verify-work`:** All 8 loader binaries (MA/CT/NJ/WI × op/rev) `--dry-run` green; DB spot-checks pass.
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 115-01/T1 | 01 | 1 | DEEP-03 (NJ) | — | never-overwrite; tie-or-skip | CLI tie gate | `node scripts/processNJAcfr.js --dry-run` | yes (loader) | planned |
| 115-01/T2 | 01 | 1 | DEEP-03 (NJ) | — | idempotent live load, 0 residue | DB select | read-only node select script | yes | planned |
| 115-02/T1 | 02 | 1 | DEEP-02 | — | pre-34 rows basis-labelled | CLI tie gate | `node scripts/processCTAcfr.js --dry-run --fy 1995` | new (extractor) | planned |
| 115-02/T2 | 02 | 1 | DEEP-03 (CT2006) | — | OCR transcription must tie or be logged unrecoverable | CLI tie gate | `node scripts/processCTAcfr.js --dry-run --fy 2006` | yes | planned |
| 115-02/T3 | 02 | 1 | DEEP-04 | — | modern rows untouched | DB select | read-only node select script | yes | planned |
| 115-03/T1 | 03 | 2 | DEEP-03 (MA) | — | tie-or-hole per recovered year | CLI tie gate | `node scripts/processMAAcfr.js --dry-run --fy 2014` | yes | planned |
| 115-03/T2 | 03 | 2 | DEEP-03 (MA) | — | idempotent live load, 0 residue | DB select | read-only node select script | yes | planned |

---
*Phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de*
