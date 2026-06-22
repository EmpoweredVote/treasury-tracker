---
phase: 79-va-apa-source-loader
status: passed
verified: 2026-06-22
method: inline goal-backward (no subagent — per feedback_no_research_subagents); executed inline
requirements: [VASRC-01, VASRC-02]
---

# Phase 79 Verification — VA APA Source + Loader

**Goal (ROADMAP):** A reusable loader turns the VA APA Comparative Report XLSX into the tracker's budget tree for any locality, proven on a sample, with the available fiscal-year range determined.

## Success criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Loader parses revenue (B/B-1/B-2) + expenditure (C + C1…C8 function→activity tree), sourced | ✅ | `scripts/loadVAComparativeReport.js`: `buildExpenditureTree` (function→activity, Exhibit C + C1..C8), `buildRevenueTree` (source→sub-source, Exhibit B + B2), `data_source='Virginia APA Comparative Report'` + per-FY `source_url` + `source_date`. Uniform "next header is Per Capita" node detection; raw-$ only. |
| 2 | Alexandria FY2024 dry-run reproduces ≈$864M exp / ≈$874M rev, zero writes | ✅ | Dry-run: operating **$863,578,347** (exact), revenue **$874,230,660** (exact), pop **158,591**. Falls Church also parses cleanly (pop 15,675). No DB writes. |
| 3 | Available XLSX fiscal-year range determined + floor documented | ✅ | `scripts/vaApaDatasets.json` (CKAN-probed): **FY2023 + FY2024** are the only XLSX years on data.virginia.gov; floor = **FY2023**; FY2024 final preferred over amended. Pre-FY2023 = PDF-only (out of scope D-03). |
| 4 | Offline unit tests (column mapping, function→activity tree, raw-$ vs derived) | ✅ | `node --test scripts/loadVAComparativeReport.test.mjs` → **7/7 pass**: totals tie, Public Safety has activity children, GPT sub-source breakout, per-capita value never leaks as an amount, population from Exhibit H, Falls Church generalizes. |

## Requirements

- **VASRC-01** (reusable loader → budget tree, sourced) — ✅ loader + parser + write path (mirrors Utah RPC path + never-overwrite guard) + 7/7 tests.
- **VASRC-02** (available XLSX FY range + documented floor) — ✅ `scripts/vaApaDatasets.json`, floor FY2023.

## Implementation decisions / deviations (executor)

- **Revenue = Total Local Revenue ($874M for Alexandria), local sources only.** Intergovernmental aid (Exhibit B-1, ~$204M) is intentionally **excluded** this phase: it is not local revenue, the report headlines "Total Local Revenue", and including it would imply a false surplus vs. the $864M expenditure side. Resolves the contradictory note in CONTEXT D-02. Revisit if an all-sources revenue view is wanted (future).
- **Education function degrades to a LEAF** for localities not listed in Exhibit C6 (cities with a dependent/fiscally-separate school division). The Exhibit C function total stays correct; only the activity breakdown is omitted. Best-effort drill — no crash.
- **Single-child top-level nodes collapse** (no empty sub-level), per D-02.

## 🚩 Scope flag for Phase 80 / the milestone (IMPORTANT)

The v2.7 scope decision was **"deep history (FY2015+)"** — but the recon-confirmed reality is that **only FY2023 + FY2024 are published as XLSX** on data.virginia.gov. Pre-FY2023 reports are PDF-only on apa.virginia.gov (JS-gated, not machine-readable) and are out of scope per CONTEXT D-03 (XLSX-only, no PDF backfill).

**Therefore v2.7, as scoped, can deliver only FY2023–FY2024 from the XLSX source** (all 174 localities, both years). This needs a milestone-scope decision before Phase 80:
1. Accept 2-year XLSX coverage (FY2023–FY2024) — still all-174-localities at parity; OR
2. Pursue PDF backfill for older years (slow path, currently deferred D-03) — would reopen scope; OR
3. Investigate whether the APA publishes older years as Excel off-portal (the apa.virginia.gov reports page is JS-gated — would need a browser/manual check).

Recorded here, in `scripts/vaApaDatasets.json` `_meta.note`, and surfaced to Chris at phase close.

## Tests / live checks

- `node --test scripts/loadVAComparativeReport.test.mjs` → 7/7 pass.
- Alexandria + Falls Church FY2024 dry-runs reproduce report totals; zero writes (no live DB mutation this phase).
- FY2023 XLSX downloaded + confirmed same 19-sheet structure (loader will work unchanged).

## Verdict: PASSED

Both requirements satisfied. Loader proven and ready for Phase 80 bulk load — pending the milestone-scope decision on the FY2023–FY2024 history reality.
