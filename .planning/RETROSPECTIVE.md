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

## Milestone: v2.2 — Orange County + Reusable SoCal Pipeline

**Shipped:** 2026-06-16
**Phases:** 6 (52-57) | **Plans:** 15 | **Timeline:** ~2 days (2026-06-14 → 2026-06-16)

### What Was Built

- SoCal bulk pipeline hardened + generalized: `bulkLoadStateController.js` county-parameterized with durable `source_url`/`source_date`, feed-population backfill, and a never-overwrite guard; `seedCountyLinks.js` one-command county seed + linking; `docs/socal-county-onboarding.md` runbook — proven to generalize via a zero-write Ventura County dry-run
- All 34 Orange County cities loaded (operating + revenue FY2003–2024) from SCO ByTheNumbers; 32 net-new cities auto-created with per-year populations; Anaheim & Santa Ana kept as-is (link-only); OC entity seeded + linked + enriched at $0
- Statewide CA city-salaries integration (net-new): reusable `loadCASalaries.js` builds a names-free Dept→Position Total Compensation tree from the GCC export; all 34 OC cities 2009–2024 (544 rows, 0 gaps); Irvine 2024 $0 delta vs published
- OC county-government budget (44 rows FY2003–2024, all-governmental-funds basis, FY2024 $6.42B exact) via reusable `loadCountyBudget.js`; OC county page now renders icicle/summary + per-capita; ACFR verification + Chris UAT sign-off

### What Worked

- **The compounding-loader thesis held a third time**: OC reused the exact ByTheNumbers path that built the LA County 88 — the only genuinely net-new build was statewide salaries, which was isolated to its own phase. Big-in-data, small-in-invention, as forecast.
- **Spike-first gated the only risky build**: SAL-01 confirmed publicpay.ca.gov/GCC coverage + an exact Irvine 2024 reconciliation ($0 delta) *before* committing to the loader (55-02). The gate authorized the build instead of discovering coverage gaps mid-phase.
- **Generalizing one-offs into a runbook paid off immediately**: `loadCountyBudget.js` turned the LA County (Phase 25) one-offs into a parameterized Step-5 tool, and the whole load→seed→link→enrich→verify sequence is now a documented one-command-per-county pipeline — SOCAL-01..06 are now mechanical.
- **Per-year SCO populations beat the single-vintage hardcode**: the SCO county feed carries per-year `estimated_population`, giving more accurate per-capita denominators than the LA single-year approach — a quiet data-quality upgrade with no extra work.
- **UAT caught a real navigation defect**: Phase 56 surfaced a breadcrumb defect that was root-caused and fixed in-phase (API + frontend) before sign-off — the recurring "human UAT catches what automation misses" pattern again.

### What Was Inefficient

- **`milestone.complete` auto-accomplishments broke a third straight milestone** — this time emitting 5 empty `One-liner:` placeholders (several SUMMARY.md files had an unfilled one-liner field), again requiring a hand-rewritten MILESTONES entry. The extractor and the SUMMARY one-liner convention have now disagreed across v2.0 ("**Executed:**"), v2.1 ("Status:"), and v2.2 (empty placeholders). This is a standing tax, not an anomaly.
- **Documentation-trail gaps surfaced at audit, not during execution**: Phase 52 shipped with no `VERIFICATION.md` (authored retroactively during the milestone audit), and PIPE-01..04 were left unchecked in REQUIREMENTS.md until the audit ticked them. The work was sound — the paper trail lagged. Per-phase verification discipline is still not fully habitual on data-pipeline phases.
- **A cross-repo follow-up looked like deferred scope at close**: the OC county SourceChip was recorded as "dormant pending an EV-Accounts API follow-up" in PROJECT.md, but the EV-Accounts `data_source_info` fix had actually deployed (2026-06-16) and the chip was live — the treasury-tracker-side note just hadn't been updated. The cross-repo backend split keeps producing stale local notes (same class as v2.0's push side-effects).

### Patterns Established

- **Never-overwrite guard on bulk loaders**: a county/bulk load must refuse to clobber entities already loaded from a richer custom source (Anaheim, Santa Ana stayed link-only). Bulk loaders should detect existing non-pipeline sources and skip, not overwrite.
- **Spike-gate before any net-new data source**: confirm coverage + an exact reconciliation against a published figure before building the loader. The SAL-01 gate is the template for de-risking unfamiliar sources.
- **One-command-per-county runbook**: load→seed→link→enrich→verify, each step a parameterized reusable script, documented in `docs/socal-county-onboarding.md`. The unit of future expansion is now "run the runbook," not "write a pipeline."
- **Names-free compensation aggregation**: salaries loaded as Dept→Position *totals* only (no individuals), honoring the public-record-only safety line; curl-with-browser-UA bypasses the Node-fetch Cloudflare TLS block with zero new deps.

### Key Lessons

1. **Each reusable pipeline shrinks the *next* milestone, and runbooks make it a checklist**: v2.2 spent its invention budget once (salaries + county-budget generalization) and turned the rest into documented commands — SOCAL-01..06 (~95 cities) are now scoped as runbook iterations, not engineering.
2. **Spike-first is the cheapest insurance for net-new sources**: the SAL-01 coverage+reconciliation gate cost one plan and removed the milestone's only real unknown before committing build effort.
3. **The doc trail is the part that lags — automate or check it per-phase**: missing VERIFICATION (Phase 52), unchecked requirements (PIPE-01..04), and a stale cross-repo note all surfaced at the audit/close, not during execution. The audit caught them, but per-phase verification + requirement-ticking would have made close a formality.
4. **The `milestone.complete` accomplishments extractor is reliably broken (3/3)** — budget for hand-rewriting the MILESTONES entry every close until the extractor/one-liner-convention mismatch is fixed.

### Cost Observations

- **~$0 API spend** — OC enrichment was authored inline at $0 (no paid API), all budget/revenue/salary/county data from free SCO ByTheNumbers + GCC sources. Held the free-source ground rule and stayed far under the $5 gate.
- No PDF vision runs (SCO is structured open data); verification via local `verify-phase*.mjs` DB probes + Supabase SQL (no API cost).

---

## Milestone: v2.3 — California Coverage Parity

**Shipped:** 2026-06-17
**Phases:** 5 (58-62) | **Plans:** 15 | **Timeline:** ~1 day (2026-06-16 → 2026-06-17)

### What Was Built

- LA County parity backfill: 88 LA County cities + the LA County government entity backfilled to FY2003 (operating + revenue) from SCO ByTheNumbers — 86/88 cities reach FY2003 (Calabasas/Sierra Madre are genuine SCO source gaps), all SCO-sourced with per-year population, custom cities untouched
- Remaining non-OC CA cities backfilled to FY2003 + the 7 unlinked cities linked via `county_id` (4 new linking-only county nodes, SF kept as a clean combined city-county node, budget-less Test artifact removed)
- Statewide CA salaries sweep: CA Government Compensation FY2009–2024 for all 98 non-OC CA cities in 16 download-once passes (0 gaps, 0 failures, 2.5M source records), LA's curated payroll preserved by the never-overwrite guard; 3 sampled cities reconcile to the GCC export at $0 delta
- Enrichment parity: 528 universal `category_enrichment` rows authored inline at $0 (op/rev 100%, salary depts shared by ≥2 cities), bleed-safe
- A dedicated verification-only closeout phase (62): basis-matched ACFR reconciliation, full-cohort source-chain durability audit (0 NULL/fragile/residue across 25,568 rows), and a 24-item live-app UAT with Chris's sign-off — no data writes, $0

### What Worked

- **The compounding-loader thesis held a fourth time, now at scale**: v2.3 was almost entirely "run the v2.2 runbook against more counties." The LA County 88 + 98-city salaries sweep reused the exact `bulkLoadStateController.js`/`loadCASalaries.js`/`loadCountyBudget.js` paths with zero new tooling — the milestone shipped in ~1 day because the prior milestone turned the work into commands.
- **The never-overwrite guard did its job silently**: LA's curated Socrata payroll and the 12 named custom-source cities' richer budgets were preserved automatically across a 98-city sweep — the guard built in v2.2 paid off exactly as designed at scale.
- **Splitting verification into its own phase (62) was clean**: ACFR reconciliation + source-chain audit + UAT as a dedicated read-only closeout (no data writes, defects documented not fixed, D-08) kept the data phases moving fast and concentrated the proof-of-correctness in one auditable place.
- **The source-chain audit scaled the Phase-58 sample to the full cohort**: extending the SCO-NULL=0 check across all 25,568 rows and adding the fragility classifier (which Phase 58 skipped) confirmed durability at depth — 0 NULL, 0 fragile, 0 residue.

### What Was Inefficient

- **The UAT salaries item false-failed three rounds in a row — all checklist-instrument defects, zero product bugs.** Round 1 picked Inglewood (a city with no salaries data at all); round 2 looked for a card literally named "Salaries" when the UI labels it **"Employees"**; round 3 had the year selector carried over to FY2003, outside the salaries range (FY2009–2024), so the year-gated card was correctly hidden. Each round cost a full human round-trip. The checklist was authored from the *plan's* vocabulary, not from the *actual rendered UI* (real card label + the year-state precondition).
- **`milestone.complete` auto-accomplishments broke a fourth straight milestone** — same empty `One-liner:` placeholders (several SUMMARY.md one-liner fields unfilled, e.g. 61-01), again requiring a hand-rewritten MILESTONES entry. Now 4/4 closes.
- **A direct-DB probe disagreed with the live API mid-UAT**: a `treasury.budgets` probe showed Inglewood with 0 rows while the production `ev-accounts-api` returned salaries for it — a reminder that the app's `available_datasets` comes from the API endpoint, which can differ from a raw table probe. Diagnosing the salaries "failure" required tracing the *actual* render data source, not just the DB.

### Patterns Established

- **Verification-only closeout phase**: end a data milestone with a dedicated read-only phase that independently reconciles against external sources (ACFRs), audits source-chain durability at full-cohort depth, and runs a guided human UAT — documenting (not fixing) any defect (D-08). Concentrates proof-of-correctness and keeps it auditable.
- **Author UAT checklists against the rendered UI, not the plan's vocabulary**: name the exact on-screen label (the salaries dataset card is **"Employees"**, not "Salaries"), and state every precondition that gates visibility (e.g. "set the year to one within the dataset's range first"). A checklist written from plan terminology produces false-fails the human has to chase down.
- **Trace the app's real data source when a render "fails"**: `available_datasets` (and thus which tabs/cards appear) comes from the `ev-accounts-api` endpoint, which can differ from a direct `treasury.budgets` probe — verify against the same source the app reads.

### Key Lessons

1. **A mature pipeline turns a milestone into a day of running commands**: v2.3's only real work was applying the v2.2 runbook at scale (88 + 98 cities) + a verification phase. The fourth confirmation that invention compounds — spend the invention budget once, then iterate.
2. **UAT false-fails are usually instrument defects — author the checklist from the live UI**: three rounds of "salaries tab missing" were all the checklist (wrong city, wrong label, wrong year-state), never the product. Naming real UI labels + visibility preconditions up front would have made it one round.
3. **Know which datastore the app actually reads**: the live app reads `available_datasets` from the API, not the raw table — a direct DB probe can mislead during UAT diagnosis. Match the probe to the render path.
4. **The `milestone.complete` accomplishments extractor is reliably broken (4/4)** — budget for hand-rewriting the MILESTONES entry every close until the extractor/one-liner-convention mismatch is fixed.

### Cost Observations

- **~$0 API spend** — all budget/revenue/salary data from free SCO ByTheNumbers + GCC sources; enrichment authored inline at $0; ACFR PDFs fetched via free WebFetch; verification via read-only DB probes. Held the free-source ground rule, far under the $5 gate.
- No AI generation runs this milestone; the verification phase was probes + PDF reads + a human checklist.

---

## Milestone: v2.5 — Utah Municipal Expansion

**Shipped:** 2026-06-20
**Phases:** 7 (68–73, incl. inserted 71.1) | **Plans:** 14

### What Was Built

10 Utah cities + 5 county governments at full CA parity from the Utah State Auditor's Transparent Utah BigQuery dataset: op/rev (all-funds FY2014–2025), names-free compensation, 3,536 bleed-safe enrichment rows, city→county linking — all via one new loader (`loadUtahTransparency.js`). Verified end-to-end (ACFR recon on Provo + Salt Lake County, source-chain + bleed audit, 22-item UAT, Chris all-pass). ~$0.

### What Worked

- **First non-Socrata/non-PDF source integrated cleanly** by mirroring the proven `bulkLoadStateController.js` and swapping only the fetch layer — the loader's pure logic shipped behind 23 offline unit tests before any live query.
- **One uniform source (BigQuery EX/RV/PY for all 15 entities)** collapsed what was 3+ source types in CA (SCO budgets + publicpay salaries) into a single durable bare-domain attribution — making the source-chain audit trivially clean (one `source_url` value, 0 fragile).
- **The closeout (Phase 73) ran entirely inline** — no researcher/planner/executor/verifier subagents — at ~$0 Anthropic spend, mirroring the verified Phase 67/62 plan structure.

### What Was Inefficient

- **A live-BigQuery cost incident** (~21 TiB / ~$132 on 2026-06-19) from querying the unpartitioned table per-(entity,FY,type) forced an unplanned Phase 71.1 to build a single-scan rollup ETL into Supabase. Lesson now durable: never query the BQ table live; one rollup scan → Supabase, manual refresh.
- **Two avoidable mid-load incidents:** phantom county rows (a hardcoded `entity_type:'city'` ignored `--entity-type`), and 172 duplicate enrichment rows (the universal-row unique index is NULLS-DISTINCT, so `ON CONFLICT` never matched). Both recovered, both now encoded as guards/patterns.
- **Display-name churn:** cities were first loaded under legal entity_names ("Provo City"), then renamed mid-milestone — a naming decision better made at Phase 68 plan time.

### Patterns Established

- **BigQuery rollup ETL:** one server-side GROUP BY → group in memory → per-entity `importEntityData`, cost-gated (free dry-run preview + `--confirm` + GiB cap). Reusable for any large transaction-table source.
- **Names-free aggregate path:** PY→salaries projects only `org1/cat1/SUM` with a test that asserts PII tokens are absent from both the query string and the serialized tree.
- **Universal-enrichment writes use delete-then-insert**, never `upsert(onConflict)` — the index is NULLS-DISTINCT.

### Key Lessons

- **Probe an unfamiliar source's cost model before looping queries.** A partitioned-vs-unpartitioned assumption was the whole $132 incident.
- **The Utah single-source shape is the cleanest parity target yet** — one durable domain, transaction-level, compensation included. A strong template for v2.6 Ohio (Auditor of State XLSX).

### Cost Observations

- **~$0 net** — all data free (BQ sandbox); enrichment authored inline at $0; ACFRs via free WebFetch; verification via read-only DB probes. The one cost blip (~$132 of BQ scan) was caught same-day and engineered out via the rollup ETL.
- Commit mix this milestone: 65 docs, 15 feat, 6 fix, 2 chore, 1 refactor.
- Phase 73 closeout authored + executed inline (no subagents) per the no-research-subagents cost guidance.

---

## Milestone: v2.6 — EV Financial Transparency Refresh

**Shipped:** 2026-06-22
**Phases:** 4 (74–78; Phase 77 iceboxed) | **Plans:** 8

### What Was Built

Empowered Vote's own org financials, refreshed and made donor-facing. Income from GiveButter/Patreon/Benevity + bank interest + manual entries merged idempotently (no double-count); Beneficial State Bank made authoritative for balance ($1,706.77) + expenses ($1,745.65); platform income reconciled to net bank deposits within a stored, explained variance (−$132.39); platform fees tracked as an income reduction ($125.32). EV's page now shows a gross→net fee story, an honest neutral expense breakdown, funds-on-hand, a burn-pace line, and a data-driven goal scaffold. Phase 78 audited every figure against production and Chris signed off the live UAT. $0 spend.

### What Worked

- **The whole milestone ran inline** — no researcher/planner/executor/verifier subagents — at $0 Anthropic spend, continuing the verified Phase 73/67/62 closeout pattern.
- **Reconciliation modeled as bank=truth / platforms=detail** kept a real double-count trap closed: payout deposits are matched-and-excluded, with the residual variance stored *and explained* rather than hidden.
- **A pivot mid-discussion was handled cleanly** — Phase 77 was iceboxed during `/gsd-discuss-phase` (before any context/plan was committed), recorded across ROADMAP/REQUIREMENTS/STATE, and the milestone closed around it without leaving a dangling phase.
- **Idempotent loaders paid off at close** — re-running `reconcileEV.js` to set then hide the goal changed only the goal columns; dry-run confirmed zero drift before the write.

### What Was Inefficient

- **STATE.md drifted badly** — it still read "Phase 75 executing" while git showed 76 verified. The wrap-up had to reconcile the docs against git truth before anything else. Phase transitions should keep STATE current.
- **The milestone-complete CLI assumes SUMMARY.md** — this project writes VERIFICATION.md, so auto-extracted accomplishments came out as "Status:" stubs and had to be rewritten by hand from the verifications.
- **Requirements/traceability were stale at close** (EVDATA-04/05/06 still "pending" though Phase 75 was verified) — fixed during the icebox bookkeeping, but should have been current.

### Patterns Established

- **Icebox-in-discuss:** a phase can be deferred during `/gsd-discuss-phase` before any artifact is written — record it in ROADMAP (collapsed/iceboxed), REQUIREMENTS (deferred marker + traceability), and STATE (Deferred Items), and rescope the dependent verification phase.
- **Manual figure as a committed, idempotent data file:** `data/ev-goal.json` flows through `reconcileEV.js`'s upsert; null amount → tile hidden, value → tile shows. Sourced, reviewable, reversible.
- **Inline reconciliation audit** against production Supabase (read-only `execute_sql`) as the EVVER-01 verification — no subagent, figures tied to bank truth + sourcing checked directly.

### Key Lessons

- **Keep STATE.md honest at every phase transition** — a stale state file turns "close the milestone" into "first re-derive what actually happened."
- **Fees are income reduction, not expense, and runway can mislead** — donor-facing honesty sometimes means *not* showing a number (runway) and reframing another (gross→net). Framing decisions are real product decisions.
- **Match chart vocabulary to data shape** — ~6 flat categories don't justify a tree chart; the icebox was the honest call, not a punt.

### Cost Observations

- **$0 net** — idempotent CSV merge, no new AI runs (the $5 AI gate never triggered); audit via read-only DB probes; UAT by Chris in the live app.
- Closeout (icebox + audit + milestone archive) authored + executed inline, no subagents, per the no-research-subagents cost guidance.

---

## Milestone: v2.7 — Virginia Local Government Expansion

**Shipped:** 2026-06-24
**Phases:** 6 (79–83, incl. inserted out-of-scope EV Phase 81.5) | **Plans:** 10

### What Was Built

162 Virginia entities (independent cities + counties + towns) at parity from the single uniform APA Comparative Report XLSX — op/rev FY2023–2024, function→activity expenditure tree, revenue-by-source, per-capita, a VA state navigation node + town→county linking, 73 bleed-safe universal enrichment rows, and a full verification pass (ACFR reconciliation + source-chain audit + Chris UAT). One reusable loader; $0. Phase 81.5 also shipped an honest EV recurring-supporter micro-donation callout.

### What Worked

- **One source, one loader, every entity.** Because data.virginia.gov publishes all localities in one report, a single parser covered 162 entities — no per-locality scraping. The biggest force-multiplier of the milestone.
- **Explicit-map enrichment beat the heuristic router for a fixed vocabulary.** VA's 73-key vocabulary is closed, so an explicit hand-authored map + a 100%-coverage abort gate was simpler, more accurate, and more auditable than Utah's router-with-fallback — and it surfaced a real cross-state bug (the shared `miscellaneous`→"Information Technology" universal, wrong for VA and MA).
- **Whole milestone planned + executed inline, no subagents** — consistent $0 Anthropic spend, per the standing cost guidance.

### What Was Inefficient

- **ACFR PDFs don't parse via WebFetch.** The 5–11 MB ACFR PDFs returned binary garbage through WebFetch; the workaround was the smaller PAFRs (Popular Annual Financial Reports) read via the Read tool's `pages` param. Reconciliation cost more rendering than expected. Lesson recorded for the next geographic verification: go straight to the PAFR (or the saved-PDF Read path), skip WebFetch on big ACFRs.
- **A residual source gap pre-existed.** The 10 VA state-node rows carried NULL source_url (loaded separately by processVA.js in Phase 81) — only caught at the Phase 83 audit. Per-phase source-chain assertions would have surfaced it at load time.

### Patterns Established

- **Verification phase may carry one scoped, sourced data fix.** Phase 73's strict read-only stance was relaxed (with explicit operator approval) to stamp the 10 state-node rows with their DPB source so SC#2 hit literal 0-NULL — a documented, bounded exception, not a license to refactor during verification.
- **Reconcile to the basis the source actually uses.** VA APA "Total Local Revenue" excludes intergovernmental aid; matching it to the ACFR local-source line (not total revenue) is what made the reconciliation clean.

### Key Lessons

1. A fixed, closed category vocabulary calls for an explicit map + coverage gate, not a fuzzy router — and the coverage gate doubles as a regression detector.
2. For published-financials reconciliation, prefer the PAFR over the ACFR PDF — it's readable and carries the government-wide + tax-source summary you need.
3. Source-chain completeness should be asserted at load time, not discovered at milestone-close audit.

### Cost Observations

- **$0 net** — one reusable loader (no new AI), inline-authored enrichment, read-only audit probes, ACFR/PAFR via free WebFetch + PDF read, UAT by Chris. The $5 AI gate never triggered.
- Entire milestone (plan + execute + close) authored inline, no subagents, per the no-research-subagents cost guidance.

---

## Milestone: v2.10 — State General Fund Sourcing

**Shipped:** 2026-06-29
**Phases:** 4 (94–97) | **Plans:** 16

### What Was Built

All 50 state General Fund nodes converted from unsourced "best guess" estimates to real, sourced actuals on a hybrid model: MN/OH/VA on State ACFR GAAP (operating + revenue), the other 47 (46 cohort + Georgia) on NASBO 2025 SER operating. A reusable loader (`scripts/loadStateGF.mjs`) + a locked cross-cutting policy proven on Georgia FY2023; 375 unsourced estimate rows deleted; a full cohort source-chain audit + independent "Representative 7" reconciliation + Chris UAT sign-off. Entire milestone executed inline, $0.

### What Worked

- **A reframe-to-fit-the-source pivot at Phase 94 saved the milestone.** The original plan (per-state pdfplumber ACFR extraction × 47) was infeasible; the locked hybrid (NASBO now for breadth, per-state ACFR upgrades later) delivered all 50 nodes sourced without 47 bespoke extractors. Recon-before-committing paid off.
- **Independent re-derivation caught what loader self-report hid.** Phase 97 re-read source docs rather than trusting stored values — and found F-97-01 (GA FY2023 Medicaid a stale 2024-SER value stamped to the 2025 SER, children $8M over parent). The Phase 86 lesson, applied and validated.
- **`pdftotext -table` reads both NASBO SER multi-column tables and ACFR governmental-funds statements cleanly** — no render-to-image needed, the recurring fear that never materialized again.
- **Whole milestone inline, no subagents** — $0 Anthropic spend, per standing cost guidance.

### What Was Inefficient

- **Fetch-at-runtime hit a TLS wall.** The OH archives host (`archives.obm.ohio.gov`) returns HTTP 000 to default curl; only `--insecure --tlsv1.2` works. Cost a couple of diagnostic cycles — now recorded in the loader notes + memory for future runs.
- **A stale "byte-unchanged 2024 SER" comment masked an internal inconsistency.** GA FY2023's loader entry mixed a 2024-SER Medicaid value with a 2025-SER All-Other residual and a 2025-SER source stamp — the integrity probe (children vs parent) is what surfaced it, not the comment.

### Patterns Established

- **Children-vs-parent integrity probe as a cohort audit primitive.** Summing depth-1 against depth-0 across the whole cohort cleanly separated real defects (GA +$8M) from acceptable artifacts ($1M NASBO rounding) and honest design (negative-investment clamp). Reusable for any tree-shaped financial cohort.
- **Negative values clamped to 0 with the magnitude in the label** — the icicle-honest way to show a negative GF investment-income year without a negative slice or a wrong parent total.

### Key Lessons

1. When the literal plan is infeasible, reframe to fit the source's reality (with operator sign-off) rather than forcing the original mechanism — and record the pivot so the requirement text vs. delivery gap is explicit.
2. Verify by re-deriving from the source document, never from the stored value — that is the only check that catches transcription drift.
3. A cohort-wide structural invariant (children = parent) is a cheaper, more reliable defect detector than spot-checking totals.

### Cost Observations

- **$0 net** — one reusable loader (hand-entered NASBO figures, no AI), read-only audit probes, ACFR/SER via local files + free fetch, UAT by Chris. The $5 AI gate never triggered.
- Plan + execute + close all authored inline, no research/planner/executor subagents.

---

## Milestone: v2.11 — State ACFR Revenue-by-Source Upgrades

**Shipped:** 2026-06-30
**Phases:** 5 (98–102) | **Plans:** 13

### What Was Built

The four highest-traffic state GF nodes (CA, TX, NY, FL) upgraded from NASBO operating-only estimates to real State-ACFR GAAP revenue-by-source + finer spending-by-function (CA FY2020–25, TX FY2015–24, NY FY2015–24 ×millions, FL FY2022–24), NASBO operating replaced idempotently. Frontend: the "Money In" revenue view auto-enables on the 4 nodes and a shared pure `resolveEffectiveDataset` helper hardens `?dataset=revenue` deep-links. Closeout: 16/16 loader-independent ACFR re-derivation ties (exact), a 50-node cohort source-chain audit (7/7, genuine 0 residue), and Chris's live UAT sign-off. Executed inline, $0.

### What Worked

- **Recon-first (Phase 98) de-risked the whole milestone.** Locating all 4 ACFRs + confirming the GF column/units/windows + the CA overlap decision before any load meant phases 99/100 were near-mechanical config of a proven loader pair. The NY ×millions nuance and TX GR-Fund scale surprise were both caught in recon, not in production.
- **Loader-independent re-derivation gave real confidence.** Phase 102's harness re-read the printed ACFR totals via a fresh `pdftotext` pass (no `process*.js` import) and tied 16/16 exactly to the stored values — the "don't trust the loader's self-report" discipline from v2.10, applied again.
- **Surfacing the D-05 residue deviation to the operator mid-run was the right call.** The executor's cleanup diverged from the approved decision (kept the nasbo metadata rows); rather than silently accept or silently "fix", the divergence + the supporting evidence (all state `data_sources` are decorative, display unaffected) went to Chris, who decided — and the audit was then made to prove genuine 0 residue.
- **Whole milestone inline, no subagents for planning** — $0 Anthropic-tool spend on research/planning; execution used scoped gsd-executor/verifier subagents.

### What Was Inefficient

- **Worktree isolation was unusable.** A pre-existing over-long filename under `data/` (an `enrichment-…expanded.json` exceeding the Windows path limit) made `git worktree add` fail, forcing every executor onto the main tree sequentially. Recorded as a cleanup candidate.
- **The cohort-audit executor encoded the D-05 divergence into the audit's own scope** (excluding `/nasbo/i` from the residue check), which would have made a wrong end-state "pass". Caught by the orchestrator's direct DB inspection — but a reminder that an audit that defines away the thing it should check isn't a real gate.

### Patterns Established

- **0-FK-reference means the metadata table is decorative — verify before trusting a "0-row guard".** State budgets stamp provenance into text columns (`data_source_id=null`), so *every* `data_sources` row backs 0 rows; the guard only meant something once that was understood. Check the actual reference topology before relying on a referential guard.
- **Surface plan-vs-execution divergences as an operator decision, with evidence, at the human gate** — neither rubber-stamp nor unilaterally "correct" a deviation from an approved decision.

### Key Lessons

1. Recon-before-load scales: one upfront recon phase made four state upgrades nearly mechanical and caught every per-state surprise early.
2. An audit must check the invariant, not a scoped-down version that excludes the suspicious case — verify the audit's own scope against the requirement's literal words.
3. Re-derive from the source document independently of the loader; exact ties (not just "within tolerance") are achievable for audited published figures and are worth insisting on.

### Cost Observations

- **$0 net** — `pdftotext` extraction + DB reads/targeted writes, no AI calls in any loader or audit; UAT by Chris. The $5 AI gate never triggered.
- Planning authored inline; execution + verification via scoped subagents (sonnet).

---

## Milestone: v2.12 — State ACFR Long Tail

**Shipped:** 2026-07-01
**Phases:** 4 (103–106) | **Plans:** 13

### What Was Built

Extended the v2.11 State-ACFR path in two directions: **deepened** the four pilots' history (CA FY2008–2025 +12, NY FY2003–2014 +12 ×millions, FL +FY2021; TX already contiguous) and **added Pennsylvania (FY2016–2025) + Illinois (FY2021–2025)** — the two largest remaining NASBO states — onto full ACFR GF revenue-by-source + finer spending-by-function via four new loaders, NASBO replaced idempotently. Closeout: 24/24 loader-independent blind re-derivations at exact $0, a 50-node cohort source-chain audit (7/7 over 276 rows), and Chris's live UAT (8/8). A UAT-surfaced data-viz fix (distinct category colors + dropped the redundant single-root layer) shipped to production. Executed inline, $0.

### What Worked

- **Recon-first + reuse compounded again.** Phase 103 recon located every deeper-history URL + the PA/IL statements up front, so 104 (deepen) and 105 (PA/IL) were near-mechanical applications of the proven v2.11 loader pattern. Deepening = adding older `SOURCES` keys; new states = the same loader shape.
- **Worktree isolation was restored and parallel waves actually ran in parallel** (unlike v2.11, blocked by an over-long path). Wave 1 of each phase ran two independent executors in git worktrees concurrently, merged back cleanly (disjoint files), with a per-wave post-merge gate.
- **The exact-0 re-derivation discipline held at 5× scale.** 24/24 blind ties (vs v2.11's 16/16), with the harness importing zero loader code (D-02) and no tolerance band (D-03) — the CA SCO soft-404 guard prevented a false 0-tie.
- **Verification caught a real latent gap.** Phase 106 found `processILAcfr.js` missing the ACFR-08 clamp (WR-02, also flagged by code review); fixed in-phase before sign-off (F-97-01 precedent). No negative IL expenditure data exists today, but the code path was wrong.

### What Was Inefficient

- **A data-only milestone still generated frontend work at the last gate.** The milestone was scoped "no frontend," but Chris's UAT immediately surfaced two pre-existing UX issues (adjacent-category color blending + a redundant single-root "…GF Budget · 100%" layer) that had been latent since state budgets adopted a single synthetic root. Real, but it landed at the very end and pulled a frontend change + deploy into a data milestone's tail.
- **The UAT checklist shipped with malformed deep-links.** The executor invented `?state=XX&fy=YYYY`, which App.tsx doesn't parse — so authenticated users were silently redirected to their home city. The app's real URL contract (`?entity=<slug>&year=`) was one grep away and wasn't checked when authoring the checklist.
- **The WR-05 non-atomic `data_sources` upsert actually bit.** It re-created 2 residue rows during the 106 idempotency re-runs (cleaned in-phase), confirming the deferred code-review finding is a live latent bug, not theoretical.

### Patterns Established

- **A single synthetic root node is an anti-pattern for the icicle.** It renders as a redundant 100% "click to start" layer AND collapses every child to one color (children inherit the root's color index). `hoistSingleRoot` — hoist a lone root's children to the top level — is the fix; applied at the data setters so icicle, cards, navigation, and search stay consistent.
- **When authoring a UAT checklist, verify link/param formats against the app's actual URL parser**, not an assumed convention — a checklist that can't be navigated is worse than no checklist.
- **UAT is worth running even on "no-frontend" milestones** — correct data can still render confusingly; the human gate caught what automated data verification never would.

### Key Lessons

1. "No frontend work" is a scope intention, not a guarantee — a live human UAT on real data reliably surfaces presentation debt. Budget a little tail capacity for it.
2. Deferred code-review findings are latent bugs with a clock on them (WR-05 re-created residue mid-milestone) — the "defer cosmetic, fix data/source in-phase" split (D-05) held up, but the deferred pile should be swept periodically.
3. Reused, recon-first pipelines scale sub-linearly in effort: 6 state-years of new/deepened ACFR data cost roughly what 4 did in v2.11, because the loader pattern and verification harness were already proven.

### Cost Observations

- **$0 net** — `pdftotext` + DB reads/targeted writes, no AI in any loader/audit; the one frontend fix was hand-authored. The $5 AI gate never triggered.
- Planning inline (opus); execution + verification via scoped sonnet subagents; parallel worktree waves reduced wall-clock on the two build phases.

---

## Milestone: v2.13 — State ACFR Long Tail — Tranche 2

**Shipped:** 2026-07-02
**Phases:** 4 (107–110) | **Plans:** 16

### What Was Built

Doubled the State-ACFR cohort in one tranche: the next **10 largest-GF NASBO states (NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI)** onto full ACFR GAAP GF revenue-by-source + spending-by-function — 0 substitutions from the candidate roster. MA upgraded in place over its v1.8 DLS node; GA's F-97-01 fix superseded cleanly; Batch 2 alone added 77 state-FYs (TN 17yr, CT 23yr, WI 24yr). Cohort now 19 ACFR states (444 rows) + 31 NASBO = 506 state rows. Closeout: 49/49 loader-independent blind re-derivations at exact $0, cohort audit 10/10 invariants, Chris live UAT 11/11 (plus a 7/7 Phase-108 closure UAT). Executed inline, $0.

### What Worked

- **The recon → batch-load → verify mold is now industrial.** Third consecutive milestone on the same shape; recon's four-risk-facts pass (units, FY-end, URL durability, scope ratio) caught the NJ dollars-unit and MI Sep-30 traps before a single write — zero magnitude defects across 121+ state-FYs.
- **Roster-with-substitution-allowance de-risked scoping.** The ≤2-substitution escape hatch meant recon could commit hard to 10 states without gambling the milestone; it turned out 0 were needed, but the option kept planning honest.
- **The verification harness scaled 3× with no redesign.** 49 re-derivation targets (vs 24 in v2.12, 16 in v2.11) ran through the same zero-loader-import pattern; the cohort audit grew to 10 invariants (INV-8 window honesty, INV-10 supersede checks) without structural change.
- **Retroactive verification closed the one audit gap in a day.** Phase 108's missing VERIFICATION.md was a process artifact, not a work gap — the evidence (LOADLOG DB assertions + Phase 110's independent re-derivation) already existed, so the audit's gaps_found → passed cycle cost one session including a fresh 7/7 UAT.

### What Was Inefficient

- **Phase 108 shipped without running the verifier** — the only reason the milestone audit came back `gaps_found`. Batch 1 and Batch 2 ran in parallel; 109 got its VERIFICATION.md, 108 didn't. A per-phase "verifier ran?" check at phase close would have made the milestone audit a formality.
- **WR-05 bit again, live, during the closure UAT** — the NJ idempotency re-run re-created 1 unreferenced data_sources row on camera. Third milestone carrying this; the fix (atomic upsert or delete the vestigial write) is small and now well-specified.
- **The SUMMARY one-liner convention drifted again** — 10 of 16 plan summaries extracted as "Requirements:" placeholders at close, forcing another hand-written MILESTONES entry (the known extractor/convention mismatch, now 5+ closes running).

### Patterns Established

- **Four-risk-facts recon per state** (units, FY-end, URL durability, scope-vs-NASBO ratio) as a mandatory pre-load gate — this is what makes 10-state batches safe.
- **Trust recon totals, re-verify structure/URLs at load time** — several states' page structure or URL casing (MD's `ACFR`→`acfr`) changed between recon and load; the GF total-tie is the safety net.
- **Dedicated closure UAT for retroactive verification** — don't just paper over a missing artifact; re-prove the phase live (108's 7/7 included a fresh idempotency re-run with DB assertion).

### Key Lessons

1. Run the phase verifier *at phase close*, not at milestone audit — parallel batches make it easy for one branch to skip the gate, and the audit is the wrong place to discover it.
2. A locked roster + substitution allowance beats both "exactly these N states" (brittle) and "as many as fit" (unshippable) — recon converts the option into certainty before any write.
3. Verification infrastructure now scales sub-linearly like the loaders do: 3× the re-derivation targets for roughly the same harness effort. The compounding-reuse lesson (#1, #5 in Top Lessons) holds for audit tooling at cohort scale.

### Cost Observations

- **$0 net** — `pdftotext -table` + DB reads/targeted writes throughout; no AI in any loader, harness, or audit. The $5 AI gate never triggered.
- Executed inline (no research/roadmapper subagents per standing feedback); 3-day wall-clock for 10 states / 121+ state-FYs / 47 commits.

---

## Milestone: v2.14 — State ACFR Long Tail — Tranche 3 + Deepening

**Shipped:** 2026-07-03
**Phases:** 6 (111–116) | **Plans:** 20

### What Was Built

Three moves in one milestone. **(1)** Finally retired the WR-05 loader debt (LOAD-01) — an ephemeral `data_sources` lifecycle across all 35 `process*Acfr.js` loaders, so a full run incl. an idempotent re-run leaves 0 residue with no manual re-clean, proven end-to-end. **(2)** Grew the ACFR cohort 19 → 29: Batch 1 (IN/AZ/OR/MO/CO) + Batch 2 (SC/KY/UT/AL/LA) upgraded NASBO→full ACFR GAAP, most back to FY2002, with GF-alone scope decisions resolved honestly (UT ~0.83×, AL ~0.24×, LA ~1.90×). **(3)** Built a reusable pre-GASB-34 extractor (`pre34Extract.mjs`) and recovered the v2.13 history holes — CT to 38yr contiguous (FY1988–2025, FY2006 via free OCR), WI 26yr, NJ contiguous FY2002–2025, MA 2/6 recovered + 4 documented unrecoverable. Cohort now 29 ACFR + 21 NASBO = 901 rows. Closeout: 75/75 blind re-derivations at exact $0, 12-invariant cohort audit, Chris live UAT 11/11. Executed inline, $0.

### What Worked

- **The recurring debt finally got paid — and it was cheap.** WR-05 had been carried and hand-cleaned at every close since v2.11 (106: 10 rows, 110: 20 rows). Sequencing the fix *first* (Phase 111, before any load) meant all 14 states' loads this milestone were the first residue-free run in the series — the cohort audit's LOAD-01 invariant needed 0 manual re-clean for the first time ever.
- **Python tooling (`extract_gf.py` + `gen_state.py`) generalized instead of forking per state.** Each new structural surprise (SC's single `Taxes:` header, KY's two-line wrapped labels, LA's non-uniform `-table` alignment + ALL-CAPS labels, AL's non-June FY-end) was absorbed as a config option or a generalized rule with zero regression on already-loaded states — the compounding-reuse pattern now holds for the extractor layer, not just the loaders.
- **The rank-correction substitution worked exactly as designed.** Recon caught Oklahoma at actual rank 14/31 (not a top-10 GF state) and swapped in Alabama (rank 9), fully reconning the substitute before the roster locked — the substitution allowance earned its keep this time (0 needed in v2.13, 1 needed here).
- **Deepening's "recover or document unrecoverable" clause kept it shippable.** MA's 4 dot-leader-corrupted years (FY2002/04/05, FY2021) were investigated hard, then honestly logged as unrecoverable rather than force-fit with an unsafe heuristic — the requirement's own escape clause prevented a single state's bad scans from blocking the milestone.

### What Was Inefficient

- **The MILESTONES entry auto-generation is now actively wrong, not just incomplete.** `gsd-sdk query milestone.complete` reported 4 phases / 14 plans / 39 tasks and dropped Phase 111 (the headline LOAD-01 fix) *and* all of Batch 1 (113) from the accomplishments — it silently missed two phase directories. Hand-rewriting the entry is now mandatory every close (6+ running). The extractor's phase-glob and one-liner conventions need a real fix or the automation should be retired.
- **MA FY2002/04/05 burned real effort for zero rows.** An unsafe bounded-heuristic extractor was built and then abandoned as too risky — the right call, but the dot-leader corruption could have been triaged as unrecoverable earlier from a manual PDF look before writing extractor code.

### Patterns Established

- **Sequence the recurring-debt fix as Phase 1 of the milestone that will stress it** — LOAD-01 first meant every subsequent load *proved* the fix under real use, turning a chronic close-time chore into a verified invariant.
- **Absorb per-state structural surprises as generalized config/rules in shared tooling, never as forks** — every v2.14 extractor change was additive and regression-tested against the full already-loaded set.
- **Honest-unrecoverable is a first-class outcome for history recovery** — document the reason in the gap log and move on; don't gate a milestone on scans that resist safe automation.
- **Pre-GASB-34 rows carry an era-correct label (CAFR, not ACFR)** — the audit's label-distinctness invariant (INV-6) accepts both, since pre-34 years honestly predate the ACFR terminology.

### Key Lessons

1. Pay recurring debt by sequencing its fix ahead of the work that exercises it — the fix then verifies itself for free, which is cheaper and more convincing than a standalone fix + separate proof.
2. When a code-generation tool (`milestone.complete`) has been wrong or incomplete at 6 consecutive closes, stop trusting it silently — either fix the phase-glob/one-liner mismatch or drop the step and hand-author from the SUMMARY one-liners directly.
3. Triage history-recovery candidates with a cheap manual look *before* writing an extractor — a 2-minute PDF inspection can classify "dot-leader corrupted → unrecoverable" and save an entire build-then-abandon cycle.

### Cost Observations

- **$0 net** — `pdftotext -table` / OCR (free tooling) / DB reads + targeted writes throughout; no AI in any loader, extractor, harness, or audit. The $5 AI gate never triggered.
- Executed inline (no research/roadmapper subagents per standing feedback); 2-day wall-clock for 10 new states + 4 deepened states / 112 commits.

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
| v2.2 | 6 | 15 | ~2 days | Reusable one-command SoCal county pipeline + runbook; spike-gated net-new salaries; never-overwrite guard; 34 OC cities + county budget; $0 spend |
| v2.3 | 5 | 15 | ~1 day | Pipeline applied at scale (LA County 88 + 98-city salaries) with zero new tooling; dedicated verification-only closeout phase; $0 spend |
| v2.6 | 4 (77 iceboxed) | 8 | ~2 days | First org-financials (non-geographic) milestone; bank=truth/platforms=detail reconciliation; icebox-in-discuss pattern; inline reconciliation audit; $0 spend |
| v2.7 | 6 (incl. 81.5 insert) | 10 | ~2 days | 162 entities from one uniform source/loader; explicit-map enrichment + coverage gate (vs heuristic router); PAFR-over-ACFR reconciliation; one scoped sourced fix allowed in verification; $0 spend |
| v2.12 | 4 | 13 | ~1 day | Worktree-parallel waves restored; 24/24 exact-0 blind re-derivation; hoistSingleRoot anti-pattern fix; UAT on "no-frontend" milestones; $0 spend |
| v2.13 | 4 | 16 | 3 days | 10-state tranche (cohort 9→19 ACFR); four-risk-facts recon gate; verification harness scaled 3× unchanged; retroactive VERIFICATION closure pattern; $0 spend |
| v2.14 | 6 | 20 | 2 days | 10-state tranche (cohort 19→29 ACFR); WR-05 debt paid via fix-first sequencing (LOAD-01, 0 manual re-clean); pre-GASB-34 extractor (CT 38yr); Python extract_gf/gen_state generalized; honest-unrecoverable outcome; rank-correction sub used; $0 spend |

### Top Lessons (Verified Across Milestones)

1. **Generic loaders compress future milestones**: Every milestone that invested in a reusable loader (Socrata v1.1, XLSX v1.1, pdfplumber v1.5) made subsequent milestones faster. This compounds — v1.6 ran in 3 days because v1.5 proved the pdfplumber pattern, v2.0's federal loaders set up a cheap historical backfill, and v2.2 turned the LA County 88 path + LA county-budget one-offs into a documented one-command SoCal pipeline (SOCAL-01..06 now scoped as runbook iterations). The mature form of this lesson is a *runbook*, not just a loader.
2. **Scope mismatches are correctness issues, not just cosmetic**: Bakersfield (v1.6) and LA revenue (v1.5) both had scope mismatches caught during verification. A "scope parity check" before enrichment is now standard. v2.0 extended this to visual-vs-official totals (the $521B/$1,895B disclosure).
3. **Human UAT checkpoints catch real issues — but author the checklist from the live UI**: Every milestone has had at least one real issue surfaced during human verification that automated checks missed (LA revenue $44.6B in v1.5; Bakersfield operating/revenue ratio in v1.6; React #310 hooks crash in v2.0 Phase 45). v2.3 added the inverse caution: three rounds of UAT "failures" were all *checklist-instrument* defects (wrong city, wrong card label, wrong year-state), not product bugs — write checklists against the actual rendered labels + visibility preconditions, not the plan's vocabulary, or the human chases phantom failures.
4. **Planning docs lag at close — recurring tax (improving)**: v1.6 and v2.0 surfaced stale ROADMAP/PROJECT state at close. v2.1 updated ROADMAP plan-progress per-plan, making close lighter — the fix is "update tracking as each plan completes," and it works when actually done.
5. **Reusable verification harnesses compound like loaders do**: the Phase 48 govinfo-API source-check dropped straight into v2.1's comparability verifier with no rework. Audit/verification tooling is as reusable as data loaders — invest in it once, reuse across milestones.
6. **Match execution mode to phase shape**: v2.1 ran a small, linear, checkpoint-heavy phase inline (no subagents) for lower token cost; parallel worktree executors are for genuinely independent plans. One size does not fit all phases.
7. **The `milestone.complete` accomplishments extractor is reliably broken (v2.0/v2.1/v2.2/v2.3 … v2.14)**: it has emitted garbage (header lines, then empty placeholders) at every close because it disagrees with the SUMMARY one-liner convention — and at v2.14 it got *worse*, silently missing two whole phase directories (111 + 113) so it under-reported 6 phases as 4 and dropped the headline LOAD-01 fix and all of Batch 1 from the accomplishments. Hand-rewriting the MILESTONES entry is now mandatory every close. Either fix the phase-glob + one-liner mismatch or retire the step and hand-author from the SUMMARY one-liners directly.
8. **The doc trail lags the build, and it's the audit that catches it**: missing VERIFICATION files, unchecked requirements, and stale cross-repo notes have surfaced at milestone close/audit rather than during execution (v2.0, v2.1, v2.2). `/gsd:audit-milestone` reliably closes these gaps — but per-phase verification + requirement-ticking would make close a formality instead of a reconciliation.
