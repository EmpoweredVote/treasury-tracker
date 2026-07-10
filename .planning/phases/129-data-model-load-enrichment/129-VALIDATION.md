---
phase: 129
slug: data-model-load-enrichment
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-10
---

# Phase 129 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Validation here is a **deterministic $0 re-derivation tie + idempotency + coverage assertion**,
> not a unit-test suite — the source printed totals and the live loaded set are the oracles.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None introduced — validation = DB re-derivation vs. `128-RECON.md` printed totals, idempotency re-run, and 100%-coverage assertions |
| **Config file** | none |
| **Quick run command** | `node scripts/processTucson.js --fy 2024 --dry-run` (inspect mapped tree + total) |
| **Full suite command** | dry-run both modes all FYs → live load → re-read DB totals (delta 0) → re-run (0 net change) → `loadTucsonEnrichment.mjs` dry-run coverage |
| **Estimated runtime** | ~3–8 s per FY per mode (pdftotext + parse + RPC) |

---

## Sampling Rate

- **After every task commit:** run the relevant dry-run (loader tie / enrichment coverage) for the FY(s) touched.
- **After every plan wave:** W1 → seeder idempotency (DB has 1 Tucson + 1 Pima, linked); W2 → full-window DB re-derivation $0 + source-chain + idempotency; W3 → 100% enrichment coverage + bleed check.
- **Before phase close (Phase 130 UAT):** every windowed FY re-derives $0 in both modes; every row sourced; enrichment 100%.
- **Max feedback latency:** < 60 s (full window re-derivation).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 129-01-01 | 01 | 1 | TUC-03 | T-129-01 | Idempotent upsert (no duplicate node); pinned Census population | integration | Query `municipalities` → exactly 1 Tucson (city, AZ, pop>0); re-run = 0 net change | ❌ W0 | ⬜ pending |
| 129-01-02 | 01 | 1 | TUC-04 | T-129-01 | `county_id` set only when NULL/same (no silent repoint) | integration | Query → 1 Pima County (county, AZ, pop>0); `Tucson.county_id == Pima.id`; re-run idempotent | ❌ W0 | ⬜ pending |
| 129-02-01 | 02 | 2 | TUC-05 | T-129-02 | spawnSync args-array; extractor `tie_delta==0` gate; controlled readdir | integration | `processTucson.js --dry-run` (+`--revenue`) all FYs; mapped total == printed total, delta 0 | ❌ W0 | ⬜ pending |
| 129-02-02 | 02 | 2 | TUC-05 | T-129-02 | Source-safe RPC only; ephemeral data_sources; per-FY sanity ceiling | integration | Live load → re-read DB leaves per FY×mode == `128-RECON.md` total (delta 0); every row source_url/source_date non-null; 0 data_sources residue | ❌ W0 | ⬜ pending |
| 129-02-03 | 02 | 2 | TUC-05 | — | Runs on main (gitignored PDFs) | integration | 20 Tucson budgets rows (2/FY); `dataset_type='revenue'` present (Money In); per-capita finite; 2nd run 0 net change | ❌ W0 | ⬜ pending |
| 129-03-01 | 03 | 3 | TUC-06 | T-129-03 | Worklist from live DB; universal text generic; 0 API calls | integration | `loadTucsonEnrichment.mjs` dry-run → `covered/total` = 100%; no `$`/city name in universal text | ❌ W0 | ⬜ pending |
| 129-03-02 | 03 | 3 | TUC-06 | T-129-03 | Universal delete-then-insert (NULLS-DISTINCT); scoped rows carry Tucson id | integration | `--apply` → every loaded name_key has a matching enrichment row; no dup universals; 2nd `--apply` 0 net new | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Tucson municipality + Pima County node seeded (Plan 129-01) before any load.
- [ ] `docs/Tucson/*.pdf` present (from Phase 128; gitignored via `docs/*`; on `main`, not a worktree).
- [ ] `pdftotext` (poppler) + `python` on PATH — confirmed in Phase 128.
- [ ] `SUPABASE_SERVICE_KEY` in env for live-write tasks.

*No test framework install required — the tie / coverage / idempotency assertions are self-contained in the loaders + DB queries.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Breadcrumb `US → Arizona → Pima County → Tucson` + Cities-in-County panel render in the live app | TUC-04 | Visual app-render check (deferred to Phase 130 UAT); the DB link is machine-checked here | (Phase 130) open Tucson in the app; confirm breadcrumb + Cities-in-County panel |
| Icicle drill-down, Money In/Out toggle, source chips visually correct | TUC-05 | Visual app behavior (Phase 130 UAT); data preconditions machine-checked here | (Phase 130) drill Current → functions; toggle Money In; hover a category for its source chip |
| Enrichment reads well / is genuinely useful per category | TUC-06 | Editorial judgment, not a machine oracle | (Phase 130) spot-read enrichment on a sample of Tucson categories |

---

## Validation Sign-Off

- [ ] Tucson (city) + Pima County (node) seeded, linked, idempotent (Plan 129-01)
- [ ] Every windowed FY re-derives $0 vs `128-RECON.md` in both modes, re-read from the DB (Plan 129-02)
- [ ] Every loaded row carries `source_url` + `source_date`; `data_sources` residue == 0; re-run 0 net change
- [ ] Money In auto-enables; per-capita renders from seeded 2024 population
- [ ] 100% of loaded Tucson category `name_keys` enriched; universal rows bleed-safe; idempotent; $0 (Plan 129-03)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
