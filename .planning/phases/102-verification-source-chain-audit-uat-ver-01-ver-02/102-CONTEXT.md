# Phase 102: Verification + Source-Chain Audit + UAT (VER-01, VER-02) - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

The milestone-closing **proof** phase for v2.11. Prove the 4-node ACFR upgrade (CA/TX/NY/FL) is **real, independently sourced, and residue-free** across the full 50-node state cohort, then earn Chris's live sign-off. No new data loading and no new UI — verification, audit, cleanup-of-residue, and UAT only.

**In scope:**
- **VER-01a — Independent re-derivation:** for each of the 4 upgraded states, re-read the ACFR printed General-Fund total a *second time, independently of the loader's own extraction*, and confirm it ties to the value already stored in `treasury.budgets`. Depth = **newest displayed FY + one older bookend FY per state** (8 FY-statements total).
- **VER-01b — 50-node cohort source-chain audit:** a DB-query audit across all 50 state nodes asserting 0 NULL / fragile / residue / out-of-window / dup / orphan rows, and that every *displayed* row is basis-labelled. Un-upgraded NASBO states must still pass.
- **Residue cleanup:** delete the now-0-row cosmetic `*-gf-operating-nasbo` stale `data_sources` left from phases 99/100.
- **Inline gap-closure:** fix any data-integrity defect the audit surfaces, then re-run the audit to green.
- **VER-02 — Live-app UAT:** Claude-driven guided walkthrough of the **live production app** (treasurytracker.empowered.vote) across the 4 upgraded nodes, ending in Chris's sign-off.

**Out of scope:**
- Any new data **loading** (done in 99/100) — verification only, except residue-delete + inline integrity fixes.
- **Extending historical windows / deepening coverage** (esp. FL's 3-year window) — explicitly kept out; deferred to the "State ACFR Long Tail" follow-up milestone (see Deferred).
- The frontend revenue-view + deep-link work (done in 101).
- Backend / ev-accounts-api changes (separate repo, unchanged).
- Accepted limitations that are NOT defects: flat revenue-tree no-drill-down ([[project_flat_source_icicle_limitation]]); TX GR-Fund ~3× NASBO scale (relabelled honestly); P2 negative-category clamp firing.
</domain>

<decisions>
## Implementation Decisions

### Independent re-derivation (VER-01a)
- **D-01:** Depth = **newest displayed FY + one older bookend FY per state** (8 FY-statements: CA, TX, NY, FL × 2). NOT every loaded FY — the loaders already ran a per-FY tie-check gate at load, so the Phase-102 job is a *loader-independent* second read of the user-facing year + a window edge, not an exhaustive re-extraction. (Chris: "Newest FY + bookend is fine.")
- **D-02:** **Independence** means do NOT trust the loader's extraction or its self-reported tie — open the ACFR PDF afresh, read the printed GF "Total revenues" / "Total expenditures" line, apply the documented unit multiplier (NY ×1,000,000; CA/TX/FL ×1,000), and compare to the value currently stored in `treasury.budgets` for that (node, FY, dataset).
- **D-03:** **Tolerance = exact-to-printed-total** (these are audited, published figures and should tie to the dollar after unit scaling); a **$10M fallback** band is allowed only to absorb rounding, mirroring the loaders' `validate()` gate. Any miss beyond $10M is a defect → inline gap-closure (D-08).
- **D-04:** "Newest displayed FY" = the FY the node shows by default in the app (newest operating year); "bookend" = the oldest FY in that state's loaded window (CA FY2020, TX FY2015, NY FY2015, FL FY2022). Tie-confirmed bookends from recon are the expected anchors (e.g. NY FY2024 Total revenues $93,894M; CA FY2025 $221,591,201K; FL FY2022 $57,241,428K).

### Stale data_source residue (VER-01b)
- **D-05:** **Delete** the cosmetic `*-gf-operating-nasbo` (and analogous `*-gf-*`) stale `data_sources` that now back 0 live rows after the ACFR replace. Leaving them contradicts VER-01's "0 … residue" requirement. (Chris: "Delete them.") Reuse/extend `scripts/cleanupStaleStateGFDataSources.mjs`, guarded by its existing 0-live-rows assertion so a populated source can never be deleted.

### Cohort audit failure handling (VER-01b)
- **D-06:** **Fix inline (gap-closure)** any data-integrity defect the 50-node audit surfaces — NULL/missing basis label, orphan, dup, out-of-window, fragile/residue row — then re-run the audit until green. (Chris: "Fix inline.") This is the milestone-closing phase; closing on a known-dirty cohort is not acceptable.
- **D-07:** **Escalation boundary:** only a defect requiring a *full re-load* or a *scope change* (e.g. a whole FY extracted wrong, needing re-extraction) gets escalated/logged rather than hot-fixed; pure integrity/labelling/residue defects are fixed inline.

### Live-app UAT + sign-off (VER-02)
- **D-08:** **Claude drives, Chris signs off, against live production** (treasurytracker.empowered.vote, post-deploy — the bundle pushed at the close of Phase 101). Verify the deploy has propagated before starting. (Chris: "I drive, you sign off — on prod.")
- **D-09:** Per upgraded node, the UAT walkthrough captures evidence for: revenue-by-source ("Money In") renders + enabled; spending-by-function renders; **basis label** present + honest (ACFR GAAP vs NASBO budgetary); **source chip** present (URL + date); plus the 4 phase-101-deferred browser-smoke items folded in — NY FY2024 ≈ $93.9B revenue tree; FL FY2022 P2-clamp labels ("(net loss — shown at 0)") visible; `?dataset=revenue` deep-link lands on revenue for an upgraded node; and falls back to operating (no empty card) on a NASBO node.
- **D-10:** Present the captured evidence as a per-node checklist for Chris's explicit sign-off; sign-off is the gate that closes VER-02 (and the milestone).

### Process
- **D-11:** Coverage windows are **frozen as loaded** (CA FY2020–25, TX FY2015–24, NY FY2015–24, FL FY2022–24). No window extension in this phase. (Chris: "keep v2.11 as-is, deepen FL later.") Because the loaders are built + parameterized, a later deepening = add older URLs to the `SOURCES` map + re-run; it is incremental, not a rebuild.
- **D-12:** Follow the repo's established verification idiom — a phase-scoped `verify-phase102.mjs`-style DB-query script (cf. `verify-phase56.mjs`, `auditFederalSources.mjs`, `verifyComparabilitySources.mjs`) — for the cohort audit + the re-derivation comparison harness. `$0` spend, `pdftotext -table` for the independent PDF re-read (no AI calls).

### Claude's Discretion
- Exact SQL/queries and report layout of the cohort audit script; how the independent re-read is captured (the method just has to be loader-independent and reproducible).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + policy
- `.planning/REQUIREMENTS.md` — VER-01 (independent reconciliation + clean 50-node source-chain audit), VER-02 (live UAT + sign-off); + the "State ACFR Long Tail" future requirement (deeper history).
- `.planning/ROADMAP.md` — Phase 102 entry (3 success criteria) + v2.11 constraints (free sources only, $0/$5 AI gate, GAAP basis, basis-labelled, idempotent never-overwrite).

### What was loaded (the values to verify against)
- `.planning/phases/99-california-texas-acfr-upgrade-acfr-01-acfr-02-acfr-05-recon-/99-CONTEXT.md` — CA/TX windows, units, GF column labels, tie-confirmed bookends, TX GR-Fund scope note.
- `.planning/phases/100-new-york-florida-acfr-upgrade-acfr-03-acfr-04-acfr-05/100-CONTEXT.md` — NY/FL windows, units (NY ×millions), GF column labels, tie-confirmed bookends, FYE dates.
- `.planning/phases/99-…/99-01-SUMMARY.md` and `.planning/phases/100-…/100-0{2,3}-SUMMARY.md` — the actual loaded totals / loader self-reports (the figures the independent re-derivation must NOT simply trust, but compare against).
- `.planning/phases/98-recon-…/98-ACFR-SOURCES.md` — per-state located statement, GF column, durable per-year ACFR URLs, page numbers (the source docs for the independent re-read).

### Source-chain / audit + cleanup idioms to reuse
- `scripts/cleanupStaleStateGFDataSources.mjs` — extend for the residue delete (0-live-rows guarded).
- `scripts/verify-phase56.mjs`, `scripts/verifyComparabilitySources.mjs`, `scripts/auditFederalSources.mjs` — repo-established phase-scoped DB-audit script shapes to model `verify-phase102` on.
- `scripts/loadStateGF.mjs` — the NASBO fallback loader; exports `clampForRender`/`categoryLabel`/`dataSourceLabel` and documents the `(muni,fy,dataset)` key + basis-label conventions the audit checks.
- `scripts/process{CA,TX,NY,FL}*.js` + `process{CA,TX,NY,FL}RevenueAcfr.js` — the loaders whose stored output is being independently re-derived (read for unit multipliers + GF page-finders, but the re-read must be done independently of them).

### Frontend (UAT surface)
- `src/App.tsx` (`availableDatasetTypes`, mount deep-link, `handleEntityChange`), `src/components/datasets/DatasetTabs.tsx`, `src/utils/resolveDataset.ts` — the phase-101 revenue-view + deep-link code the UAT exercises.
- App URL: treasurytracker.empowered.vote ([[feedback_app_url]]).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cleanupStaleStateGFDataSources.mjs` — already deletes stale state-GF data_sources with a 0-live-rows safety assertion; extend its target list for the residue delete (D-05).
- The `verify-phaseNN.mjs` family + `auditFederalSources.mjs` — established phase-scoped DB-audit script pattern; model the 50-node cohort audit + re-derivation comparison harness on these.
- The 4 state loaders (+ recon's durable ACFR URLs in `98-ACFR-SOURCES.md`) give the exact PDFs + page/units for the independent re-read — but the re-derivation must read the printed total itself, not call the loader.

### Established Patterns
- `pdftotext -table` is the proven clean GF-statement extractor (recon + 99/100) — use it for the independent re-read too; `$0`/no-AI.
- Per-node basis label + source chip keep the mixed-basis cohort (4 ACFR-GAAP + 46 NASBO-budgetary) honest — the audit asserts every displayed row carries one.
- NASBO budgets rows carry `data_source_id = null` (provenance stamped into `data_source`/`source_url`/`source_date` text per policy P4) — so stale `*-gf-*` data_sources legitimately show 0 live rows; the 0-row assertion is what makes the residue-delete safe.

### Integration Points
- The audit reads the whole `treasury.budgets` state cohort; the 4 ACFR nodes must verify clean AND the 46 NASBO nodes must stay untouched/clean (no collateral from the upgrade).
- UAT exercises the deployed phase-101 frontend against the prod API.
</code_context>

<specifics>
## Specific Ideas
- Verification anchors (independent re-read targets): NY FY2024 GF Total revenues $93,894M (×1e6); CA FY2020 $155,923,876K / FY2025 $221,591,201K; TX FY2015 GR-Fund $95,574,830K / FY2024 $161,416,562K; FL FY2022 $57,241,428K / FY2024 $59,810,603K (all ×1e3 except NY).
- UAT clamp anchor: FL FY2022 shows the clamped negative categories at $0 with "(net loss — shown at 0)" labels.
- NASBO fallback anchor for the deep-link UAT: any state NOT in CA/TX/NY/FL/MN/OH/VA.
</specifics>

<deferred>
## Deferred Ideas
- **Deepen historical coverage — the "State ACFR Long Tail" follow-up milestone.** Extend the loaded windows below their current floors, esp. **FL (only FY2022–24 today)**, plus CA pre-FY2020, NY pre-FY2015, TX FY2016 alt-id. Chris confirmed: keep v2.11 as-is, deepen FL later. Cheap to do later — the parameterized loaders just need older URLs added to each `SOURCES` map + a re-run (not a rebuild). Tracked in REQUIREMENTS.md "State ACFR Long Tail."
- Flat-revenue-tree drill-down / enrichment-on-leaf-click ([[project_flat_source_icicle_limitation]]) — accepted limitation, separate concern.
</deferred>

---

*Phase: 102-verification-source-chain-audit-uat-ver-01-ver-02*
*Context gathered: 2026-06-29*
