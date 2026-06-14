# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.6 — California City Expansion

**Shipped:** 2026-06-06
**Phases:** 6 | **Plans:** 20 | **Timeline:** 3 days (2026-06-04 → 2026-06-06)

### What Was Built

- Sacramento loaded in < 1 day via existing loadSacramentoCSV.js — fastest phase in milestone because the loader already existed
- Oakland (GPF biennial ~$800M/yr) and San Jose (GF ~$1.7B) loaded via pdfplumber; 50 enrichment rows; all 6 criteria PASS
- Long Beach (GF $634M–$773M, Port excluded) and Bakersfield (GF $412–427M, scope corrected inline) loaded; Bakersfield scope fix discovered and applied during verification
- Fresno (GF ~$483M, enterprise excluded) and Riverside (biennial ~$1.45B/yr, RPU excluded) loaded; revenue deferred for both
- Anaheim (GF $491–530M) and Santa Ana (GF $404–424M) loaded with revenue and enrichment; all 6 criteria PASS
- Longview TX revenue enrichment closed as carry-forward (2 corrupted names fixed, 36 rows added in < 1 day)

### What Worked

- **Pre-written loaders eliminate phases**: Sacramento's `loadSacramentoCSV.js` and Longview's carry-forward took < 1 day combined. Investing in reusable loaders during prior phases compresses future milestone scope dramatically.
- **Pattern convergence**: pdfplumber + extractCity.py + processCity.js is now a well-worn pattern. Phases 29–31 executed faster than Phases 26–28 because the team knew exactly what to build.
- **Inline scope fixes during verification**: Bakersfield's operating/revenue scope mismatch (all-funds ~$762M vs GF revenue ~$370M) was caught and fixed during Phase 29-04 enrichment/verification — before shipping. Scope parity checks before enrichment are now standard.
- **Analytical cost estimation over `--dry-run`**: Discovered that `enrichCategories.js --dry-run` still calls the AI API (only skips DB write), defeating the cost gate. Analytical estimation from DB category counts + token pricing became the standard approach — accurate and free.
- **$0.10 per-city-pair enrichment gate held**: Every enrichment phase came in under $0.10 combined (Sacramento $0, Oakland+San Jose ~$0.03, Long Beach+Bakersfield $0.0666, Fresno+Riverside ~$0.03, Anaheim+Santa Ana ~$0.05).

### What Was Inefficient

- **Phase 28 status not updated in real-time**: ROADMAP.md showed "3/4 plans / In Progress" after 28-04 completed, causing confusion at milestone close. ROADMAP and PROJECT.md should be updated as each plan completes, not deferred.
- **`enrichCategories.js --city` mode resets progress file**: Single-city mode resets `.enrichment-progress.json` on each run, causing Phase 31 to overwrite Anaheim data with Santa Ana data. Required manual consolidation. The `--all` mode accumulates properly; DB is the authoritative source of truth.
- **Oakland revenue deferred unexpectedly**: Research indicated Oakland might have extractable revenue data, but the live source (OpenGov embedded chart) turned out not to be pdfplumber-accessible. A pre-phase source verification step could surface this earlier.

### Patterns Established

- **Scope parity check before enrichment**: Before marking a phase complete, verify that operating and revenue use the same fund scope (GF vs all-funds). A 2x ratio is a red flag.
- **Analytical enrichment cost estimation**: Query DB for unique name_keys per city, multiply by ~$0.00148/call (claude-haiku-4-5-20251001 as of June 2026), sum across cities. More accurate than `--dry-run` and costs nothing.
- **`--city` mode resets progress; DB is truth**: For multi-city enrichment runs, use `--all` mode or manually consolidate after individual runs. Always verify enrichment completeness via DB query, not progress file.
- **pdfplumber + extractCity.py + processCity.js**: The CA PDF pipeline pattern is mature. New city phases can be planned confidently at 3–4 plans (seed → extract → load → enrich+verify).

### Key Lessons

1. **Invest in shared loaders early**: Sacramento took < 1 day because the loader was pre-written. Every reusable loader eliminates a milestone phase. When a data source is identified, write the loader even if loading is deferred.
2. **Verify revenue source accessibility before planning**: Oakland revenue was planned but the source format (OpenGov embedded chart) wasn't accessible via pdfplumber. A 30-minute pre-research step per city would catch this.
3. **ROADMAP is stale if not updated per-plan**: The milestone close revealed ROADMAP.md showing Phase 28 as "3/4 plans / In Progress" when it was complete. Update ROADMAP progress table immediately after each plan completes.
4. **Enterprise fund scope matters for comparability**: The operating/revenue comparison is only meaningful when both use the same scope. GF-to-GF or all-funds-to-all-funds — mixing scopes (as happened with Bakersfield) creates a misleading ~2x ratio.

### Cost Observations

- Enrichment cost: ~$0.16 total across 9 cities (well under $5 threshold)
- No expensive PDF vision pipeline runs (all CA cities used pdfplumber text extraction)
- Notable: Sacramento was $0 in enrichment (pre-existing rows from research phase)

---

## Milestone: v2.0 — Federal Treasury Tracker

**Shipped:** 2026-06-13
**Phases:** 6 (43-48) | **Plans:** 20 | **Timeline:** ~1 day (2026-06-12 → 2026-06-13)

*(Retro entries for v1.7–v1.9 were not logged at the time; trends table updated for v2.0.)*

### What Was Built

- Federal entity end-to-end on the proven Phase 32 'state' pattern; always-sourced schema (source_name/url/date columns, program_details table) — no city/county/state regression
- US FY2025 budget both lenses (function 18→61→1,613 nodes = OMB Hist 1.1 exactly; agency 29 depts vs MTS T5 identity 0.006%), OMB 8.1 split, 64-yr history, FY2026 FYTD, $39.2T debt — every row sourced
- Federal landing (first-split bands + deficit strip), function/agency lens toggle, source chip on every figure, per-capita/per-taxpayer/%-of-total scales
- 27 Tier-1 sourced explainers authored from fetched text only ($0 API); DoD failed-audit opacity flagged with GAO disclaimer
- 15-program origins pilot from Congress.gov+GovInfo, every claim linked, zero LLM; foundational sponsor-boundary notes
- Source-chain audit (225 rows / 61 URLs → 61/61 PASS) + Chris UAT sign-off; US pinned first on landing with a flag tile

### What Worked

- **Recon before roadmap paid off again**: pulling live samples from every federal source up front caught the CBO/GAO bot-walls and the obligations-vs-outlays trap *before* any phase depended on them. Zero source surprises mid-build.
- **The always-sourced standard cost almost nothing**: inline-authored explainers hit $0 API, and program origins needed no LLM at all (pure structured fetch). Free data APIs throughout. The "never unsourced" ground rule turned out cheaper than generation, not more expensive.
- **Per-phase verification made the milestone audit redundant**: every phase shipped its own VERIFICATION.md, and Phase 48 was itself a cross-phase source-chain audit + UAT. Closing without a separate `/gsd:audit-milestone` was safe because the coverage already existed.
- **Domain-aware verification beat naive status checks**: the audit only worked because it knew govinfo SPAs 200 on any path (→ verify via API) and congress.gov 403s non-browser clients (→ verify via real browser content match). A plain `curl` status sweep would have produced both false passes and false fails.

### What Was Inefficient

- **Planning docs lagged the build**: PROJECT.md was stuck at v1.9/Phase 41, the retrospective at v1.6, and REQUIREMENTS.md checkboxes were never ticked during execution — all had to be reconciled in one batch at close. Per-phase doc updates (the v1.6 lesson) still aren't habitual.
- **`milestone.complete` auto-accomplishments were garbage**: summary-extract grabbed the literal "**Executed:**" header line from each SUMMARY.md, producing 20 identical bullets that had to be hand-rewritten. The SUMMARY one-liner convention and the extractor disagree.
- **Cross-repo backend caused push side-effects**: the federal backend lives in the separate ev-accounts repo (push-to-master → Render). Phase 45 inadvertently published 91 pre-existing local commits, and Phase 47 carried 2 unrelated phase-117 commits. Flagged both times, but the shared-repo flow needs a pre-push check.

### Patterns Established

- **Always-sourced UI standard**: every figure gets a SourceChip (name + fetch date + link); every Tier-2 claim stores a paired source URL. Reusable for the city/state sourcing backfill.
- **Two-tier origins**: modern programs via Congress.gov bill detail (full sponsor/cosponsor set); foundational pre-1973 via GovInfo STATUTE with an honest sponsor-boundary note — never fill missing structured data from model memory.
- **Fetched-title mapping gate**: a program→enabling-act claim is only made if the *fetched* official title supports it; unconfirmable → skip with rationale. Kept the origins list honest (Head Start skipped, Post-9/11 GI Bill skipped).
- **Year-independent enrichment**: explainers key on category name, origins key on the enabling law — neither depends on fiscal year. This is why historical backfill is cheap.

### Key Lessons

1. **Sourcing can be cheaper than generation**: the $0 outcome (inline explainers + zero-LLM origins) shows the always-sourced rule isn't a cost burden — fetching/authoring from the record beats paying to generate.
2. **Trust content, not status codes, for bot-walled sources**: per-domain verification (API for SPAs, real browser for 403-walls) is mandatory for any external-link audit.
3. **The expensive work is year-independent**: with explainers and origins keyed to category/law rather than year, a multi-year historical backfill is mostly mechanical loader iteration — the next milestone is bigger in data, smaller in invention.
4. **Update planning docs per-phase, not at close**: this is the third milestone to surface stale ROADMAP/PROJECT state at close. The lag is now a recurring tax.

### Cost Observations

- **~$0 API spend for the entire milestone**: explainers authored inline, origins fetched deterministically (no LLM), all data from free government APIs (Treasury Fiscal Data, OMB, MTS, Congress.gov/GovInfo). Well under the $5 gate.
- Verification used a local Playwright chromium (no API cost) for bot-walled URL + UAT pre-flight checks.

---

## Milestone: v2.1 — Federal History

**Shipped:** 2026-06-14
**Phases:** 3 (49-51) | **Plans:** 13 | **Timeline:** ~2 days (2026-06-13 → 2026-06-14)

### What Was Built

- Prior federal fiscal years FY1976→FY2024 brought to v2.0 detail — function (OMB Hist 3.2 / PBD), agency (rebuilt from PBD, not MTS), revenue (Hist 2.1) per year + the FY1976 Transition Quarter; 150 budgets / ~135K line items; per-year visual-vs-official disclosures; every row sourced; $0 spend
- Federal YearSelector wiring — FY1976–FY2025 + the TQ selectable via a centralized `parsePeriod`/`buildPeriodTokens` period model; trees + landing bands + deficit strip switch per period; per-year per-capita/per-taxpayer denominators (FRED pop + IRS returns) with honest gaps disclosed
- Source-chain durability (repointed every metric URL off version-specific xlsx/raw-API to stable human pages; audit FAIL 0, 0 fragile URLs), sourced comparability notes (TQ + function drift + 5 Cabinet reorganizations, each verified against its GovInfo public-law record), rendered in-app with source chips; Chris UAT sign-off on prod

### What Worked

- **The v2.0 prediction held exactly**: "the expensive work is year-independent → historical backfill is mostly mechanical loader iteration." Explainers (name-keyed) and origins (law-keyed) carried over with zero rework; the milestone was big in data, small in invention — as forecast.
- **Inline execution beat subagent spawning for a small linear phase**: Phase 51 (3 incomplete plans, 2 of them interactive checkpoints, strict 49→50→51 dependency) ran inline on the main loop — no worktree/subagent overhead — which fit the token-economy constraint and handled the human checkpoints naturally.
- **GovInfo as the durability anchor**: pointing comparability sources at `BUDGET-YYYY-TAB` (Historical Tables intro) and `STATUTE-…`/`PLAW-…` records — verified via `api.govinfo.gov` rather than page status — gave stable, audit-checkable URLs. The Phase 48 govinfo-API pattern dropped straight into the new comparability verifier.
- **No-model-memory rule forced real verification, caught nothing wrong but proved the chain**: every comparability claim (incl. the HEW→HHS redesignation) was read from the fetched law text (93 STAT. 694 §509), not asserted — exactly the milestone's core promise.

### What Was Inefficient

- **`milestone.complete` auto-accomplishments broke again** — this time grabbing the literal "Status:" line from each SUMMARY 13×. Second milestone running (v2.0 hit the same class of bug with "**Executed:**"). The extractor and the SUMMARY one-liner convention still disagree; hand-rewriting the MILESTONES entry is now expected, not exceptional.
- **PLAW vs STATUTE coverage boundary cost a detour**: GovInfo PLAW packages only cover 1995+ (104th Congress), so the three pre-1995 laws (Energy/Education/VA) 404'd as PLAW and had to be resolved to their `STATUTE-NN-PgNNN` granules by title-match. Worth knowing up front for any future public-law sourcing.

### Patterns Established

- **Durable source URLs over fetch URLs**: the metric `source_url` points at a stable human page (`…/supplemental-materials/`, `…/historical-tables/`, GovInfo app details); the exact xlsx/API endpoint lives only as the loader's fetch URL / `data_sources.base_url`. Durability is now a checked invariant (regex SQL assertion → 0 fragile URLs).
- **GovInfo public-law sourcing split**: ≥104th Congress (1995+) → `PLAW-NNNpublNN`; older → `STATUTE-NN-PgNNN` granule (matched by Act title, law number confirmed against the record). Both verify via `api.govinfo.gov`.
- **Static JSON import for small sourced content**: `data/*.json` (the git-reviewed audit trail) imported into the frontend via `resolveJsonModule` + a cross-root import — $0, no API/DB/backend change. Survives `tsc -b`.

### Key Lessons

1. **Year-independent design is the real ROI**: the v2.0 decision to key explainers on name and origins on law (not year) is what made an entire historical-backfill milestone cheap and mechanical. Architectural choices that decouple from the partition dimension pay off a milestone later.
2. **Match execution mode to phase shape**: small, linear, checkpoint-heavy phases are cheaper and simpler run inline than fanned out to worktree subagents. Reserve parallel executors for genuinely independent, parallelizable plans.
3. **The auto-accomplishments extractor is reliably broken** — budget for hand-writing the MILESTONES entry every close until the extractor/convention mismatch is fixed.
4. **Per-plan doc updates finally happened** — ROADMAP plan-progress was updated as each plan completed this milestone (via `roadmap.update-plan-progress`), so close was lighter than v2.0's batch reconciliation. The recurring "docs lag at close" tax was smaller this time.

### Cost Observations

- **$0 API spend** — no LLM calls anywhere (comparability authored from fetched text; verification via WebFetch + `api.govinfo.gov` + Supabase SQL). Held the milestone's hard constraint.
- Inline (no-subagent) execution of Phase 51 avoided per-plan fresh-context token costs — a deliberate token-economy choice for a small phase.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Timeline | Key Change |
|-----------|--------|-------|----------|------------|
| v1.0 | 4 | 9 | 1 day | GSD system initialized |
| v1.1 | 3 | 9 | 12 days | Generic loaders (Socrata, XLSX, PDF vision) |
| v1.2 | 3 | 9 | 18 days | pdftotext pipeline for text-based PDFs |
| v1.3 | 4 | 9 | 1 day | Revenue + enrichment patterns mature |
| v1.4 | 2 | 8 | 1 day | CA expansion (Socrata + CSV generalize) |
| v1.5 | 9 | 24 | 3 days | OR pdfplumber pipeline established; all-funds scope fix |
| v1.6 | 6 | 20 | 3 days | CA pdfplumber pattern proven across 9 cities |
| v1.7–v1.9 | 12 | ~30 | — | (not logged) CA state + deep icicles, MA all-cities, MA county linking |
| v2.0 | 6 | 20 | ~1 day | Federal entity + always-sourced standard; $0 enrichment; domain-aware source audit |
| v2.1 | 3 | 13 | ~2 days | Federal history backfill (year-independent design validated); inline execution for small phase; durable source URLs; $0 spend |

### Top Lessons (Verified Across Milestones)

1. **Generic loaders compress future milestones**: Every milestone that invested in a reusable loader (Socrata v1.1, XLSX v1.1, pdfplumber v1.5) made subsequent milestones faster. This compounds — v1.6 ran in 3 days because v1.5 proved the pdfplumber pattern, and v2.0's federal loaders set up a cheap historical backfill.
2. **Scope mismatches are correctness issues, not just cosmetic**: Bakersfield (v1.6) and LA revenue (v1.5) both had scope mismatches caught during verification. A "scope parity check" before enrichment is now standard. v2.0 extended this to visual-vs-official totals (the $521B/$1,895B disclosure).
3. **Human UAT checkpoints catch real issues**: Every milestone has had at least one real issue surfaced during human verification that automated checks missed (LA revenue $44.6B in v1.5; Bakersfield operating/revenue ratio in v1.6; React #310 hooks crash in v2.0 Phase 45).
4. **Planning docs lag at close — recurring tax (improving)**: v1.6 and v2.0 surfaced stale ROADMAP/PROJECT state at close. v2.1 updated ROADMAP plan-progress per-plan, making close lighter — the fix is "update tracking as each plan completes," and it works when actually done.
5. **Reusable verification harnesses compound like loaders do**: the Phase 48 govinfo-API source-check dropped straight into v2.1's comparability verifier with no rework. Audit/verification tooling is as reusable as data loaders — invest in it once, reuse across milestones.
6. **Match execution mode to phase shape**: v2.1 ran a small, linear, checkpoint-heavy phase inline (no subagents) for lower token cost; parallel worktree executors are for genuinely independent plans. One size does not fit all phases.
