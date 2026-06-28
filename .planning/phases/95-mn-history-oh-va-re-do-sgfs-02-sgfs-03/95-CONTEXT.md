# Phase 95: MN History + OH/VA Re-do (SGFS-02, SGFS-03) - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Remediate the three state nodes that the Phase-93 discovery flagged as wrong, using the Phase-94 locked policy:
- **SGFS-02 — extend Minnesota** (already real ACFR FY2023–25) **back through the modern GASB-34 era**, real GAAP actuals, each year sourced; apply the locked negative-revenue rule to FY2022.
- **SGFS-03 — re-do Ohio + Virginia**, whose General Fund rows are *estimate-grade with legitimate-looking source URLs* (false provenance — the worst case), replacing them with **real State-ACFR GAAP actuals** (operating + revenue) and correcting the prior false stamps.

This is the first application of the Phase-94 hybrid to real remediation. **OH + VA are the first "high-traffic ACFR upgrades"** the hybrid anticipated — NOT NASBO. The bulk NASBO cohort (~46 states) is Phase 96; cohort verification is Phase 97.

**In scope:** MN FY2008–2025 (operating + revenue); OH + VA full ACFR (operating + revenue) for all closed FYs with a published ACFR.
**Out of scope:** the other ~46 states (Phase 96); MN FY1997–2007 (deferred, below); non-General-Fund data; budgetary/forecast figures; cohort verification/UAT (Phase 97).
</domain>

<decisions>
## Implementation Decisions

### OH/VA sourcing (SGFS-03)
- **D-95-01:** **OH + VA = full ACFR upgrade (GAAP), both operating + revenue.** Treat them as the high-priority first ACFR upgrades, matching MN's gold-standard. This reconciles the original REQUIREMENTS.md ("real State-ACFR GAAP actuals") with the Phase-94 hybrid — OH/VA do NOT use the NASBO loader; the NASBO path is for the Phase-96 cohort.
- **D-95-02:** **Revenue comes from the ACFR too** (follows from D-95-01) — OH/VA keep a real revenue-by-source tree (no operating-only thinning), GAAP basis.
- **D-95-03:** **FY window = closed years with a published ACFR.** Per-state (windows now differ): **OH = FY2020–FY2025** (all six ACFRs are on hand at `C:\tmp\Ohio\` — extended from the original FY2022–2025 estimate per Chris 2026-06-28, "do it once"); **VA = FY2022–FY2025** (research-confirmed published window). **Remove the FY2026 (and any future/no-actual) estimate rows** per policy P1 (actuals-only) + P5 (no fabrication) — better absent than a labelled estimate. The existing false stamps (OH `lsc.ohio.gov/budget`, VA `dpb.virginia.gov/budget` with NULL source_date) are corrected by replacing the rows with ACFR-sourced data + re-stamping to the ACFR URL. NB: OH's two-page-spread statement misaligns under `pdftotext` (GENERAL FUND column = first data column on the LEFT page) → use `pdftoppm` render-to-image (confirmed FY2024 page 50; checksums TOTAL EXP 45,119,494K / TOTAL REV 45,752,716K, thousands).

### Minnesota history (SGFS-02)
- **D-95-04:** **MN depth = FY2008–2025 (the modern GASB-34 era).** FY2023–25 already loaded; this adds **FY2008–FY2022** (operating + revenue). Probe confirmed all these ACFRs have extractable text and the modern "Governmental Funds — Statement of Revenues, Expenditures…" structure (FY2008 + FY2014 verified). One consistent extraction approach across the era.
- **D-95-05:** **MN FY2022 negative-revenue** (GF investment losses) → apply the locked Phase-94 policy **P2** verbatim: render area = `max(amount, 0)`, retain the true signed value in the leaf label (flagged), and carry the source's reported total as the node total (do NOT recompute from clamped leaves).

### Carried forward from Phase 94 (LOCKED — do not re-litigate)
- **D-95-06:** Every node carries a **mandatory per-node basis label** (P3). MN/OH/VA all become **GAAP** nodes: `data_source = "State of <State> ACFR — General Fund (FY<y> actual, GAAP basis)"`. (OH/VA thereby move OFF their estimate/budgetary basis onto GAAP — consistent with MN.)
- **D-95-07:** Source-stamp contract (P4): targeted post-RPC `UPDATE` sets `source_url` (resolving ACFR PDF) + `source_date` (fiscal-year-end) + `data_source`; **never** `treasury_sync_city_budget`; 0-NULL invariant. Idempotent (P6).

### Claude's Discretion
- Whether OH/VA get dedicated ACFR loaders or a generalized state-ACFR loader adapted from `processMN.js` — planner's call; the MN per-FY `SOURCES`-map + RPC + post-RPC-stamp shape is the proven pattern.
- Exact category taxonomy per state (each ACFR's own GF function/source line names, used verbatim) — set during extraction, validated to published Total Expenditures / Net Revenues.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked policy + sourcing decision (Phase 94)
- `.planning/phases/94-extractor-policy-sgfs-01/94-01-POLICY.md` — the cross-cutting rules this phase MUST follow: P1 actuals-only FY window, P2 negative-category render rule, P3 mandatory per-node basis label, P4 0-NULL source-stamp contract, P5 no-fabrication, P6 idempotency + targeted write.
- `.planning/phases/94-extractor-policy-sgfs-01/94-01-SPIKE.md` — the hybrid decision + "ACFR upgrade for high-traffic states" framing (OH/VA are those upgrades) + build-time findings (basis labels, pdftotext misalignment → render-to-image).

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §SGFS-02, §SGFS-03 — note: the "ACFR GAAP actuals" framing for OH/VA is now realized (D-95-01).
- `.planning/ROADMAP.md` §"Phase 95" — goal + success criteria.

### The proven ACFR template (the pattern to generalize)
- `scripts/processMN.js` + `scripts/processMNRevenue.js` — per-FY `SOURCES` map, `treasury_sync_budget_tree` RPC, post-RPC source-stamp UPDATE, `validate()` sum check, `buildTree()` shape. The MN-history and OH/VA loaders follow this.

### Source PDFs
- `C:\tmp\Minn\` — MN ACFR PDFs 1997–2025. FY2008–2025 needed (e.g. `2008_tcm1059-232154.pdf`, `2014-ACFR_tcm1059-125168.pdf`, `2021 - Final ACFR - accessible_tcm1059-513497.pdf`, `2022 - Final ACFR accessible_tcm1059-552884.pdf`).
- OH ACFR — published by Ohio OBM (Office of Budget & Management); VA ACFR — Virginia Dept of Accounts (`doa.virginia.gov`). **Researcher: find the exact ACFR PDF URLs + the Governmental Funds GENERAL FUND column per FY.** (NOT the current LSC/DPB budget pages — those are the falsely-sourced estimates being replaced.)

### Memory
- `project_state_node_unsourced_estimates` — cohort facts + ACFR watch-outs: use GAAP (not budgetary) GF column; some expenditure tables come out column-jumbled in pdftotext → render the page to an image and read it (proven in Phase 94); RPC does not set source_url/date → post-RPC UPDATE.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/processMN.js` / `processMNRevenue.js` — the ACFR loader template (per-FY data + `SOURCES` map, RPC, post-RPC stamp, sum validation). MN-history extends these in place (add FY2008–2022 entries); OH/VA get the same shape.
- Phase-94 extraction technique — render the ACFR page to a PNG (`pdftoppm -r 300`) and read the GENERAL FUND column visually + checksum-validate, when `pdftotext` columns misalign.

### Established Patterns
- `treasury_sync_budget_tree` RPC keys budget rows on **(municipality_id, fiscal_year, dataset_type)** → updates the existing row in place (no duplicates); rebuilds depth-1 category tree from the jsonTree.
- Source provenance is set by a **targeted post-RPC `UPDATE`** on the budget row; the RPC does not set it. Do **not** set `budgets.data_source_id` (FK target differs from where loaders write — Phase-94 finding); carry provenance via `source_url`/`source_date`/`data_source`.
- Tree shape: `[{ n: "<State> General Fund Budget"/"Revenue", a: total, c: [{ n, a, i: [] }] }]` (1-level).

### Integration Points
- `treasury.municipalities` — MN/OH/VA state nodes already exist (`entity_type='state'`).
- `treasury.budgets` — existing OH/VA estimate rows (FY2022–2026) get replaced/removed; MN gets new FY2008–2022 rows.
- The current `scripts/processOH.js` / `processOHRevenue.js` / `processVA.js` / `processVARevenue.js` are **LSC/DPB estimate-grade** (OH = appropriations Budget-in-Brief; VA = "estimated for all years", NULL source_date) — their data is **superseded** by ACFR-sourced rows. `scripts/loadStateGF.mjs` (NASBO) is NOT used here.
</code_context>

<specifics>
## Specific Ideas

- "Do it once so we don't come back" — drove the MN depth choice; resolved to FY2008–2025 (the comparable modern era) rather than 1997, because pre-GASB-34 (FY1997–2001) uses a different combined-statement structure that doesn't map to the modern taxonomy.
- OH/VA were called out as **highest priority** precisely because they *look* sourced (real-looking URLs) but are estimates — the false provenance is more dangerous than an obvious NULL.
</specifics>

<deferred>
## Deferred Ideas

- **MN FY1997–2007** — pre/early-GASB-34 ACFRs (different combined-statement format, bespoke per-year mapping, weaker comparability). Deferred; revisit only if a comparable mapping is later justified. PDFs are on hand in `C:\tmp\Minn`.
- **The remaining ~46 state nodes** — Phase 96 (SGFS-04), via the NASBO cohort loader.
- **Cohort-wide source-chain audit + UAT** — Phase 97 (SGFS-05).
</deferred>

---

*Phase: 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03*
*Context gathered: 2026-06-27*
