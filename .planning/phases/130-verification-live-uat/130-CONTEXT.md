# Phase 130: Verification + Live UAT - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

The verification + live-UAT capstone of **v2.17 Tucson, AZ City Onboarding**. Phases 128 (recon + extractor) and 129 (data model + load + enrichment) shipped and are verified at the DB level. Phase 130 proves every *displayed* Tucson figure is real and durably sourced, confirms the whole experience live, and confirms the v2.16 Essentials tether — closing three requirements:

1. **TUC-07** — loader-independent blind re-derivation of every loaded FY's GF revenue + expenditure figures **directly from the source ACFR PDFs** ($0 delta), plus a full source-chain audit (0 NULL/fragile/residue).
2. **TUC-08** — Chris signs off a live-app UAT across Tucson + Pima County + Arizona.
3. **TUC-09** — confirm the Essentials tethered icon on Tucson's banner (or document a cross-repo coverage gap).

**What's new vs. Phase 129's verification:** 129 already independently re-summed all 20 FY×mode from the DB and tied them to `128-RECON.md`'s printed totals at $0. Phase 130's higher bar is a **second, independent extraction path that reads the PDFs themselves** (not the DB, not `128-RECON.md`, not `extractTucson.py`) and confirms DB == PDF.

**Out of scope (fence):** No new data, no new FYs (FY2025 not yet published — honest boundary), no schema/RPC changes, no frontend code changes. Pima County's own government budget stays out (nav node only). The only code touched is a small, data-neutral hardening of `processTucson.js` (see D-05) — no re-load.
</domain>

<decisions>
## Implementation Decisions

### Re-derivation rigor (TUC-07)
- **D-01 — Full 20/20 coverage.** Blind-re-derive all 10 FYs × (revenue + expenditure) — every loaded FY×mode, not a sample. The corpus is only 10 PDFs, so full coverage is cheap and matches prior-milestone practice (149/151, 49/49 blind re-derivations).
- **D-02 — Fresh independent script.** Write a throwaway re-derivation script whose GF-column parsing/summing logic is written **from scratch** — it MUST NOT import or call `scripts/extractTucson.py`. It reads each PDF via `pdftotext -table` and compares its independently-computed figures against the **live production DB values pulled independently**. This satisfies "loader-independent, directly from the source ACFR." Deterministic + re-runnable (avoids hand-sum error across ~200 figures).
- **D-03 — Full tree, all FYs.** Re-derive **every displayed leaf** — the 10 revenue sources and the 2-level expenditure-by-function tree (Current → 5 functions; Capital outlay; Capital projects; Debt service → Principal/Interest/Fiscal agent fees) — for all 10 FYs, matching each against the live DB `budget_line_items`/`budget_categories`. Not just the two roll-up totals: this proves "every displayed figure is real," which is the phase goal. Reading the whole GF column already, so per-leaf is nearly free.
- **D-03a — Pass target = $0 delta** on every re-derived figure. A non-zero delta is a blocker unless it traces to a documented honest cause (e.g. the FY2021/FY2022 cosmetic merged-label quirk — which must still tie at the total/parent level).

### Source-chain audit (TUC-07)
- **D-04 — Full audit.** Machine-assert against the live DB: (a) all 20 `budgets` rows have non-null `source_url` + `source_date`; (b) each `source_url` **resolves to a reachable, correct-per-FY** tucsonaz.gov ACFR PDF (not merely non-null — actually the right document for that FY); (c) **0 orphan `data_sources` residue** for `dataset_id ilike 'tucson%'`; (d) no stale/overwritten labels; (e) both the Tucson municipality row and the Pima County nav-node row carry population + Census provenance. Extends 129's checks with the URL-resolves and correct-per-FY dimensions.

### Known WARNING debt (from 129-REVIEW.md)
- **D-05 — Fix both inline (small, data-neutral hardening of `scripts/processTucson.js`).**
  - **CR-01:** wrap the ephemeral `data_sources` cleanup so it runs on **every per-FY failure path** (a `finally`/per-FY `catch` around the six `process.exit(2)` sites, ~lines 306–351) — closes the residue-on-a-future-failed-re-run gap.
  - **WR-01:** remove the **dead pre-load delete** in `loadFiscalYear` (~lines 260–263) that filters on `data_source_id`, a column the RPC never populates — misleading dead code; real idempotency is the RPC's own `(municipality_id, fiscal_year, dataset_type)` upsert.
  - **Neither fix changes shipped data** (happy path already proved 0 residue; both touch failure-path / dead code). **No re-load.** After editing, smoke-check: re-run the loader once to confirm idempotency still nets 0 change and the guard logic behaves, and re-run the source-chain audit (D-04) to confirm still-clean.

### Live UAT (TUC-08)
- **D-06 — Formal `130-UAT-CHECKLIST.md` @ production.** Numbered pass/fail scenarios with status frontmatter, run by Chris against the **live app at `treasurytracker.empowered.vote`** (the project's real URL). Matches every prior milestone-close sign-off (12/12, 11/11). Durable signed artifact for the milestone-close audit.
- **D-07 — Baseline scenarios (from TUC-08):** 2-level icicle drill-down (operating: `Current`/`Debt service` → children), Money In/Out toggle, per-capita ($/resident) display, source chips, and `US → Arizona → Pima County → Tucson` breadcrumb + Cities-in-County panel navigation — exercised across Tucson + Pima County + Arizona.
- **D-08 — Extra scenarios (all four selected):**
  - **AZ state regression** — the existing Arizona state node (v2.14 ACFR) still renders correctly and was not disturbed by the Tucson load.
  - **Year switcher / era labels** — drill several FYs (not just FY2024); the year switcher works and per-FY era-variant labels render honestly (labels are per-FY, not normalized).
  - **FY21/FY22 merged-label quirk** — the two cosmetic merged revenue-category labels (from `extractTucson.py`'s wrapped-label buffer, per 129 `deferred-items.md`) display acceptably and their Tucson-scoped enrichment explains the quirk.
  - **FY2025-absence empty state** — FY2025 (not yet published) is simply absent; no broken/empty render or phantom zero row.

### Tether confirmation (TUC-09)
- **D-09 — Determine-then-confirm.** Fetch the live `coverage.json` from `essentials.empowered.vote` and run `matchEntityToCoverage` for Tucson (`entity_type=city`, `state=AZ`) and Pima (`entity_type=county`, `state=AZ`) to compute the **expected** icon state (covered → GEOID, or null). Then Chris confirms the live banner render **matches the prediction**. Yields a definitive covered/not-covered verdict and turns UAT into a confirmation, guarding against a silent match/fetch bug.
- **D-10 — Gap = doc + remediation pointer.** If `coverage.json` does not cover Tucson/Pima (either outcome requires **no TT code change** — the v2.16 mechanism is already generic), record it in `130-VERIFICATION.md` as an **expected cross-repo Essentials coverage gap** AND point concretely at the fix: Essentials must add a **Tucson city record** (label / `state=AZ` / Census GEOID) to its generated coverage catalog. Reference the Essentials repo at `C:/transparent motivations/essentials` (`src/lib/coverage.js` normalizePlace source of truth; the generated `coverage.json`). The icon then appears automatically once Essentials publishes — no TT redeploy.

### Claude's Discretion
- Exact plan/task decomposition, re-derivation-script internals, log formatting, and checklist scenario wording.
- Whether the re-derivation script and the source-chain audit are one script or two.
- Execution is **inline** (no gsd-verifier / research subagents — per project token/machine-strain policy); direct DB queries + PDF reads.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + scope
- `.planning/REQUIREMENTS.md` — TUC-07, TUC-08, TUC-09 (exact acceptance language) + traceability table (still shows "○ Not started" for TUC-07..09; update on close).
- `.planning/TUCSON-SCOPING.md` §0 (FY2024 ACFR layout probe = grounding figures) + §4 Phase-3 description.
- `.planning/ROADMAP.md` — Phase 130 success criteria (v2.17 block).

### Source of truth for re-derivation (TUC-07)
- `.planning/phases/128-recon-extractor/128-RECON.md` — locked FY2015–FY2024 window, durable per-FY tucsonaz.gov PDF URLs, printed GF totals + tie deltas, era vocabulary variance. **The re-derivation must be independent of this file's numbers** (re-read the PDFs) but uses its per-FY URLs to locate each PDF.
- `scripts/extractTucson.py` — the Phase 128 extractor. **The Phase 130 re-derivation script MUST NOT import or reuse it** (loader-independence, D-02).
- Tucson ACFR PDFs land in `docs/Tucson/` (gitignored; load/verify on `main`, not a worktree).

### Prior verification (do not re-do; build on)
- `.planning/phases/129-data-model-load-enrichment/129-VERIFICATION.md` — DB-level re-sum (20/20 tie $0), 15/15 enrichment coverage, 0 residue on happy path; the two WARNING items (CR-01, WR-01) this phase now fixes (D-05).
- `.planning/phases/129-data-model-load-enrichment/129-REVIEW.md` — full text of CR-01 / WR-01 findings (line numbers, exact defect).
- `.planning/phases/129-data-model-load-enrichment/129-CONTEXT.md` — D-01..D-12 load/model/enrichment decisions (basis, RPC, source-stamp pattern).
- `.planning/phases/129-data-model-load-enrichment/deferred-items.md` — the FY2021/FY2022 merged-label quirk (D-08 UAT scenario).

### Code touched / referenced
- `scripts/processTucson.js` — the loader hardened in D-05 (CR-01 ~lines 306–351; WR-01 ~lines 260–263).
- `src/utils/essentialsCoverage.ts` — `fetchCoverage()`, `matchEntityToCoverage()`, `ESSENTIALS_URL` (default `https://essentials.empowered.vote`); the deterministic matcher used to pre-determine the tether verdict (D-09).
- `src/components/FeatureIconRow.tsx`, `src/utils/featureIcons.ts`, `src/App.tsx` — the tether render path (context only; **no changes** this phase).

### Cross-repo (TUC-09 remediation pointer)
- `C:/transparent motivations/essentials` — Essentials repo; `src/lib/coverage.js` (normalizePlace source of truth) + its generated `coverage.json`. Where a Tucson city record would be added if the gap is confirmed (D-10).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/utils/essentialsCoverage.ts`** — `matchEntityToCoverage(entity, catalog)` is pure + deterministic. The re-derivation of the *expected* tether state (D-09) can call it directly (or mirror its logic in a small Node probe) against a freshly-fetched `coverage.json`. City tier matches on `state=AZ` + normalized name ≈ "tucson"; county tier on Pima.
- **Prior milestone verification harnesses** — the blind-re-derivation + cohort-audit scripts from v2.15 Phase 124 / v2.14 Phase 116 (direct-Supabase-query + PDF-read pattern) are the analog for D-01..D-04.
- **UAT-CHECKLIST.md precedent** — prior phases (127, 124, 116, 106, 97…) shipped a numbered checklist with status frontmatter; copy that shape for `130-UAT-CHECKLIST.md`.

### Established Patterns
- Ephemeral `data_sources` lifecycle (WR-05 / LOAD-01): `budgets` rows carry text-stamp provenance; a persistent `data_sources` row is unreferenceable residue → the D-04 residue check and the D-05 CR-01 fix both enforce this.
- Live production is the source of truth for verification queries (not SUMMARY narrative) — this milestone's verifiers query Supabase directly.

### Integration Points
- The icicle/Money-In render path runs through the external `ev-accounts-api` service (not in this repo) via `src/data/dataLoader.ts` — the reason the *visual* render is UAT-confirmed (TUC-08) rather than machine-verified. DB data shape was already confirmed correct in 129.
- Tether render depends on a **live cross-origin fetch** of Essentials' `coverage.json`; a failed/absent fetch degrades to no-icon (never breaks the banner) — D-09 must distinguish "not covered" from "fetch failed."
</code_context>

<specifics>
## Specific Ideas

- **FY2024 grounding figures** (must reproduce at $0): GF revenue **$773,493,270** / GF expenditure **$648,657,363** / Excess **$124,835,907**. FY2024 operating `Current` = $559,483,332 (5 children); `Debt service` = $59,871,756 (Principal $41.33M + Interest $18.52M + Fiscal agent fees $23,555).
- Full window: **FY2015–FY2024**, 20 `budgets` rows (10 FY × operating/revenue), 15 distinct enrichment keys, all currently 0-residue.
- Tucson: `id=e97d7a75-…`, city/AZ, pop 554,013 (2024). Pima County: `id=b799043e-…`, county/AZ, pop 1,080,149 (2024); `Tucson.county_id === Pima.id`.
- The re-derivation should re-read PDFs with `pdftotext -table` (the same tool, but a from-scratch parser) — `-layout` scrambles the multi-fund columns per the §0 probe.
</specifics>

<deferred>
## Deferred Ideas

- **Essentials coverage add for Tucson** — if D-10's gap is confirmed, adding the Tucson city record to Essentials' catalog is cross-repo work (Essentials milestone), not TT.
- FY2025 Tucson ACFR (publishes ~late 2026) — future idempotent re-run.
- Pre-FY2015 Tucson history, Pima County's own budget, OpenGov adopted-budget forward-year layer — all noted in 129-CONTEXT.md deferred list.
- TUC-SAL-01 (Tucson employee compensation) — needs a Tucson-specific comp source; out of this milestone.

None of the above are Phase 130 scope — discussion stayed within verify + UAT.
</deferred>

---

*Phase: 130-verification-live-uat*
*Context gathered: 2026-07-10 (inline)*
