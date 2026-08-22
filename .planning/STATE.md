---
gsd_state_version: 1.0
milestone: v2.30
milestone_name: SCOPE-04 — Derived Total Governmental + the enterprise slice
status: "v2.30 SCOPE-04 SHIPPED — merged to main as `d1e77c3` (PR #52) and tagged `v2.30`. 7,650 derived Total Governmental rows across 488 CA entities. ⚠ UAT outstanding on v2.25, v2.26, v2.27, v2.29 and v2.30."
stopped_at: "SCOPE-04 COMPLETE and shipped. Nothing outstanding in the milestone itself. ⚠ TOP FOLLOW-UP: the successor-agency scope gap is UNMEASURED beyond Napa — derived_TG excludes redevelopment successor-agency funds while the UI labels it Total Governmental, and NO arithmetic gate can surface it because both figures are individually correct. The 15 unread sample targets in scripts/data/scope04VerificationSample.json should be read for successor-agency MAGNITUDE, not for a tie. Also open: the 12 rootless $0 rows, and the /treasury/cities payload projection in C:/EV-Accounts."
last_updated: "2026-08-22T00:00:00.000Z"
last_activity: 2026-08-22
last_activity_desc: "SCOPE-04 executed end to end. 7,650 derived TG rows written, 8 quarantined, 6 excluded (negative enterprise). ⚠ TWO harnesses were found DEAD before the milestone could use them: figures_frozen had been red since v2.27 and was UNRECONSTRUCTABLE (LA-02 deleted 11 rows, 4 ids never preserved) — rebased 3bc12db8 -> 4cce9d6a with full accounting; and the duplicate rule went stale for the THIRD time in this arc. ⚠ A racing paged read invented 27 rows of drift I first reported as pre-existing — never run a partition gate during a load. ⚠ The stopping rule was NOT met: 1 of 16 sample targets assessed, Chris directed the write anyway. ⚠ derived_TG excludes successor-agency funds and its magnitude is UNMEASURED beyond Napa — disclosed in the UI by ruling, not hidden."
progress:
  total_phases: 14
  completed_phases: 14
  total_plans: 0
  completed_plans: 0
  percent: 100
---

> ⚠ **THE `progress.total_phases` ABOVE COUNTS TASKS, NOT GSD PHASES.**
> v2.22 ran on a `docs/superpowers/` plan, not on `/gsd-plan-phase`. **There are no
> `.planning/phases/` directories for it** and there never will be — do not go looking for
> `138-*`. The artifact of record is
> `docs/superpowers/plans/2026-08-14-bainbridge-island-kitsap-onboarding.md` (12 tasks) and
> its spec sibling in `docs/superpowers/specs/`. `docs/*` is gitignored; both are tracked by
> **force-add** (`git add -f`), the established convention in this repo.
>
> ⚠ **`.planning/` MISSED v2.21 AND v2.22 ENTIRELY, AND CARRIED v2.23 STALE FOR A DAY.**
> The `v2.21` tag exists in git but the milestone appears in neither `ROADMAP.md` nor
> `MILESTONES.md`; v2.22 was never tagged at all; and v2.23's entries still read "awaiting
> Chris UAT before tag" on 2026-08-17, by which time the tag had existed at `40aa706` since
> 2026-08-16. All corrected at the v2.24 close. **Tagging and updating `.planning/` are one
> step, not two** — this has now failed three milestones running.

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-16 — v2.18 Pima County Municipalities STARTED)

**Core value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.
**Current focus:** **SCOPE-04 SPECCED AND PLANNED on `feat/scope-04` — 13 tasks, execution not started, zero database writes so far.** Read `docs/superpowers/specs/2026-08-21-scope-04-design.md`, then `docs/superpowers/plans/2026-08-21-scope-04.md`.

## Current Position

Milestone: **v2.30 SCOPE-04 — Derived Total Governmental + the enterprise slice — ✅ SHIPPED 2026-08-22, merged `d1e77c3` (PR #52), tag `v2.30`**
Task: milestone on a `docs/superpowers/` plan, not GSD phases — see the banner above
Status: **All 13 tasks executed. 7,650 derived rows live in the database.** Gates at close: `npm test` **552 passed / 35 files**, `npm run build` clean, `acfrGF.selftest.py` **166 passed**, `verify-fund-scope.mjs` **all checks passed**, `verify-budget-axes.mjs` **all checks passed**. ⚠ **UAT not run.**

**488 California entities now have a second, honestly-labelled fund scope.** Modesto FY2024 renders **$588.0M → $291.6M** on selecting Total Governmental — 50.4% of its "city budget" is water, sewer, solid waste, airport and internal service funds, not the tax-funded city. Every derived figure carries `derivation='derived'`, the inert *computed by Treasury Tracker* label, and a disclosure of what the scope excludes. Full working: `docs/superpowers/plans/SCOPE-04-CLOSEOUT.md`.

⚠ **The API change is ALREADY LIVE IN PRODUCTION** — EmpoweredVote/ev-accounts#135, merged and deployed *before* the write, which is the intended ordering: without it every derived row would render unmarked. TT's own merge is what remains.

⚠ **TWO verification harnesses were found DEAD before this milestone could use them.** `figures_frozen` had been red since **v2.27** and was **unreconstructable** — LA-02 deleted 11 rows on Chris's call and only 7 of their ids were preserved — so it was rebased `3bc12db8` → `4cce9d6a` with the full accounting in `scopeBaseline.json` `_rebased_at_v2_30`. Separately the duplicate rule went stale for the **third time in this arc**. Root cause both times: a baseline that milestones add rows past without updating. `excluded_ids_files` is a **list** now, so each milestone appends its own.

⚠ **The stopping rule was NOT met as written.** It asked for ≥10 assessable city-years; **1 of 16** was assessed before Chris directed the write. Two controls tie exactly and Napa reconciles to the dollar, but the sample is short.

⚠ **`derived_TG` is the SCO's governmental scope, NOT an ACFR's "Total Governmental Funds"** — they differ by successor-agency funds. Immaterial at Napa ($23 / $18,524); **magnitude elsewhere UNMEASURED**. Ruled 2026-08-22: keep the name, disclose the exclusion. No arithmetic gate can ever surface this, because both figures are individually correct.

⚠ **UAT is outstanding on five milestones** — v2.25, v2.26, v2.27, v2.29 and now v2.30.

**Next: UAT, and the successor-agency magnitude question.** The five-milestone UAT backlog (v2.25–v2.30) is the largest this project has carried. The 15 unread SCOPE-04 sample targets are committed and should be read for successor-agency magnitude rather than for a tie — that is the number nobody has.

⚠ **Re-measured against the live database on 2026-08-21 and the 2026-08-19 probe reproduces exactly**: 8,516 era-B rows, **7,664 eligible across 488 entities**, 852 skipped (no enterprise root, so there is no second scope to create), 44 flagged for negative enterprise amounts, 6 of those caught by the `derived_TG <= all_funds_total` gate. Modesto FY2024 still ties to the dollar: `588,042,068 − 296,400,946 = 291,641,122`.

⚠ **Every `all_funds` row in the database is California** — 8,528 era-B and 14,752 era-A rows across 533 entities, and **zero rows in any other state**. So the CO DOLA compendium cannot validate a single derived row; its contribution would be a *published* Total Governmental for Colorado, which is a separate load blocked on an access request. Confirmed by query, not assumed.

<details>
<summary>Previous milestone — v2.25 SCOPE-02 — Basis, Reporting Entity, and One Series per (scope, basis) (shipped 2026-08-18, tag `v2.25`)</summary>

Milestone: **v2.25 SCOPE-02 — Basis, Reporting Entity, and One Series per (scope, basis) — ✅ SHIPPED 2026-08-18, tag `v2.25`**
Task: 14 of 14 complete (superpowers plan, not GSD phases — see the banner above)
Status: **The seam is closed in production.** PRs #16 and #17 merged; the API change shipped separately from EV-Accounts and is live. **Chris's UAT sign-off is still outstanding.**

**Fresno's spending no longer falls 44% in a year it didn't.** Its all-funds actuals series now runs FY2018→FY2024 continuously — $822M · $874M · $938M · $1,079M · $1,187M · $1,380M · $1,474M — where it previously stopped at FY2019 and dropped onto the city's adopted General Fund budget. Those budget rows now sit alongside as a separate, labelled series.

| | |
|---|---|
| `basis` | actual 53,404 · unknown 26,358 · adopted 165 |
| `reporting_entity` | unknown 56,399 · incl_component_units 21,794 · primary_government 1,734 |
| Backfilled | **12 rows, 0 measured gaps** (Fresno FY2020–24, Riverside + Santa Ana FY2023–24, Oakland FY2024) |
| Rows | 79,927 → **79,939** |
| Pre-existing figures changed | **ZERO** — `3bc12db8…82a2`, unchanged from v2.24 |

⚠ **Three of the seven seams are still reported, and that is correct.** Long Beach, Anaheim and Bakersfield cannot be backfilled — SCO ends at FY2024 and their adopted rows begin at FY2025. All three carry 22 evidenced actual years, so the app draws FY2003–2024 continuously and renders FY2025 as a **gap**. `detectSeams` flags them only because it groups scope-blind and now compares rows from two different series. **The criterion predates the series model; the code is right.** Full working: `docs/superpowers/plans/SCOPE-02-CLOSEOUT.md`.

</details>

<details>
<summary>Previous milestone — v2.24 SCOPE-01 — Fund Scope on Every Row (shipped 2026-08-17, tag `v2.24`)</summary>

Status: `fund_scope` live on all 79,927 rows. UAT passed; PR #15 merged from `feat/scope-01`; tagged.

**53,404 rows (66.8%) classified from 8 evidenced registry entries. 26,523 (33.2%), across 1,066 entities and 2,084 source strings, are honestly `unknown`** — and that is the milestone's headline result, not a shortfall. Before SCOPE-01 every one of those rows was displayed as though its scope were known and comparable.

| `fund_scope` | Rows | % | Entities | Sources |
|---|---|---|---|---|
| `total_governmental` | 28,410 | 35.5% | 1,286 | 2 |
| **`unknown`** | **26,523** | **33.2%** | **1,066** | **2,084** |
| `all_funds` | 23,260 | 29.1% | 533 | 4 |
| `general_fund` | 1,734 | 2.2% | 54 | 1,734 |

⚠ **`general_fund` at 2.2% is provisional, not an end state.** MA DLS alone is 16,816 rows almost certainly General Fund, blocked on one document. If MA lands, `general_fund` goes to ~23% and `unknown` drops to ~12%.

**ZERO figures moved** — the id-keyed `sha256(id | total_budget)` digest is unchanged, as are row count, `sum(total_budget)`, category sums and line-item sums.

⚠ **The seam this milestone was built to expose is worse than the seven CA cities we knew about.** 26 seams across 15 entities, including **Anaheim −70.1%** and **Santa Ana −62.5%** — the 2nd and 4th largest in the database, both with **no disclosure anywhere in the app** — and **Nevada −57.5%**, a state node. **Every seam today involves `unknown`; zero are between two established scopes**, so the queue is "classification incomplete", not "two known scopes in conflict".

⚠ **The queue splits in two and conflating them wastes effort.** Large negative steps are genuine scope breaks. Small or positive steps — San Diego revenue **+16.6%**, SF +0.7% — mean the city's own-source figure is probably all-funds too; those are sources awaiting a registry entry, not cliffs. Nobody should be sent to "fix" San Francisco's 0.7%.

Last activity: 2026-08-17 — UAT passed, one defect found and fixed (`e5806be`), PR #15 merged, tagged.

## Task Overview — v2.24 SCOPE-01 — Fund Scope on Every Row

| # | Task | Outcome |
|---|------|---------|
| 1 | Source family enumeration | ✅ 3,824 strings partitioned, zero unclaimed/double-claimed; **corrected the plan in three places** — MA is the 3rd-largest bloc (16,816 rows) filed under "Other", and "CA State Controller" is two unrelated sources |
| 2 | The matcher + first entry | ✅ `scripts/lib/fundScope.mjs` + registry; **an unevidenced entry cannot classify** |
| 3 | The column + baseline | ✅ migration applied; CHECK **mutation-tested in both directions**; digest identical before/after |
| 4 | Per-source reconciliation | ✅ 8 entries evidenced, 6 tying to the dollar. **MA, MN OSA and VA each produced a finding instead of a classification** |
| 5 | Classify | ✅ partition gate passed on every expected count exactly; 53,404 classified, no figure moved |
| 6 | Seam detector | ✅ 7/7 required (drift ≤ 0.05pt), **26 found**; a change into or out of `unknown` IS a seam |
| 7 | Duplicate detector | ✅ zero live — **mutation-tested two ways** because zero is otherwise unfalsifiable |
| 8 | Coverage + no-figure-moved proof | ✅ **two digests**, after the harness found the flaw in its own baseline |
| 9 | API (EV-Accounts) | ✅ **eight sites, not the plan's six**; merged `112d4320`, live in production |
| 10 | Scope label + explainer + guard | ✅ copy approved; **Step 4 shipped as a guard, not a filter — the surfaces it named do not exist** |
| 11 | Closeout + planning files | ✅ UAT passed, PR #15 merged, `.planning/` updated, tagged |

⚠ **UAT found a defect nothing else could catch.** The scope chips had **no colour coding at all**: `ScopeLabel` styled its three verified scopes against an `ev-blue` scale this project has never had, and its unverified chip with `bg-ev-gray-50` where the token is `ev-gray-050`. All six classes were dropped — `bg-*` fell to transparent and `border-*` to `currentColor`, so the VERIFIED chips got a dark border and no tint while "scope not established" came out the **softest chip on the page**. Exactly inverted, and `vite build`, `tsc` and **298 tests** were all green: Tailwind discards an unknown colour class silently, and jsdom does not run Tailwind, so no rendering test can see it. **Only reading `getComputedStyle` off the running app catches this class of bug.** Fixed to `ev-skyblue` and guarded by `ScopeLabel.tokens.test.ts`, which parses the token list out of `index.css` and is mutation-tested.

<details>
<summary>Previous milestone — v2.23 WA-CITIES-01 — Six Largest WA Cities (shipped 2026-08-16, tag `v2.23`)</summary>

**214 new General Fund rows live in production; the WA cohort is 286 rows.** Merged `--no-ff` to `main` as `bb59682`, tagged `v2.23` at `40aa706`.

Tacoma 38 rows · Spokane 40 · Vancouver 38 · Bellevue 24 · Kent 36 · Everett 38, plus four nav-only county nodes (Pierce, Spokane, Clark, Snohomish); Bellevue and Kent sit under the **existing** King County node.

Verification at close: re-derivation **286/286** at exactly $0 with 0 blockers · audit **8/8** across 286 rows · tether definitive (all 12 WA entities NOT COVERED, the documented cross-repo Essentials gap) · **203** vitest · **166** acfrGF selftests · check (h) and all four new enrichment guards mutation-tested.

⚠ **Two production data defects were found and repaired during this milestone, both invisible to every arithmetic gate:** ten corrupted labels on Kent (including one that filed $193,673 of capital spending inside a debt-service subtotal) and two letter-spaced labels on Bellevue. Both are written up in `docs/superpowers/plans/WA-CITIES-01-CLOSEOUT.md`. The Kent case carries the milestone's most transferable lesson: **when a harness reader disagrees with a document, do not conclude the loaded data is fine because the reader is provably wrong** — the extractor usually shares the defect, since both were written from the same misreading.
Last activity: 2026-08-15 — merged, pushed, and a latent Windows test bug fixed on top (see below)

**Coverage — 72 rows, not the 84 originally scoped.** Bainbridge Island FY2004, 2005, 2007, 2008, FY2012–2025 (18 years) and Kitsap County FY2004–2016, FY2020–2024 (18 years), operating + revenue for each. Six years are deliberately unloaded, **all for source-document reasons and none for a parser reason**: Bainbridge FY2006 (image-only scan), FY2009 (ciphered digits — the bounded contiguous-offset decode found no map that tied, so it was dropped as designed rather than escalated), FY2010 (labels decode, money digits absent from the text stream) and FY2011 (CCITT stencil scans); Kitsap FY2017–FY2019 (labels present, digits absent) and FY2025 (not yet audited). In FY2010/FY2011 the only readable General Fund detail is a **budget-basis** schedule, which must never be published under a GAAP label.

**Provenance.** Both entities come from ONE host, `portal.sao.wa.gov` (MCAG 0461 / 0132), so every row cites a State Auditor filing = audit-attested. ⚠ **Report-type names are INVERTED** for FY2014+: the type called *Annual Comprehensive Financial Report* is a 4–5pp opinion letter, while *Financial and Federal* / *Financial* carries the statements. Select by CONTENT (page count ≥ 40 + statement anchor), never by type name.

**All 33 printed-total residues were adjudicated individually** by rendering each page (`pdftoppm -r 160`) and reading the General column off the image — never off the text layer, never by widening tolerance. Each is a registered EXACT delta; the loaded value is always the component sum, so every row still ties at $0 against its own line items.

**🔑 A NEW DEFECT CLASS, found and fixed in production.** Bainbridge FY2013 revenue had shipped a category *and* line item named `_______…_______ Interest and Investment Revenue` — 49 underscores from a horizontal rule the PDF draws in its left margin, which `pdftotext -table` flattens onto the front of that row. **The figure was correct and the row tied at $0**, so the loader, the tie gate and the blind re-derivation all passed it. This is the dash-zero lesson in another costume: **a label defect is invisible to any arithmetic gate.** Fixed narrowly in `scripts/lib/acfrGF.py` (`_recover_label_past_leading_rule`); scanning **168 PDFs** across every entity using that shared library found the pattern in **WA SAO filings only** — zero hits in Seattle, King County, Tucson/Pima or any Oregon city. Audit check (e) now asserts the label *surface* directly so the class cannot recur silently.

**⚠ A LATENT WINDOWS BUG SURFACED AT THE MERGE — always re-run `npm test` after a checkout.** `scripts/lib/waSao.mjs` carried a `#!/usr/bin/env node` shebang. Git's `core.autocrlf` rewrites files to CRLF on checkout, and **Vite's shebang strip matches `#!.*\n`, where JS regex `.` does not match `\r`** — so the shebang survived, the parser hit a leading `#`, and all 15 tests in `tests/waSao.test.mjs` vanished behind a bare `SyntaxError: Invalid or unexpected token` **naming no file and no line**. `node --check` and `esbuild` both accept the file; only the Vite path was affected, and that asymmetry is the diagnostic. Not caused by the merge — the branch was green only because those files still had LF. Fixed by removing the shebang (it is a pure library) and guarded by a test asserting no `scripts/lib/*.mjs` starts with `#!` (mutation-tested).

**Two documented gaps, neither a TT defect.** Essentials' `coverage.json` (2026-08-15) carries exactly one WA city and one WA county — Seattle and King County — so neither new entity paints a tether icon; same outcome as v2.20 Madison and permitted by PIMA-09. And no shared-bucket banner asset exists for either entity (every plausible slug returns `NoSuchKey`), so both use the Wikipedia fallback, which resolves. ⚠ **OPEN, pre-existing:** `cities/seattle.jpg` and `cities/king-county.jpg` DO exist in the bucket but are absent from `CURATED_CITY_BANNERS` in `src/utils/wikiImage.ts`, so v2.21's own entities fall through to Wikipedia while curated licensed assets sit unused. Fixing it needs each credit transcribed from Essentials' `buildingImages.js` — **never infer a credit from a filename** (RI's comma-twin).

## Task Overview — v2.23 WA-CITIES-01 — Six Largest WA Cities

| # | Task | Outcome |
|---|------|---------|
| 1 | WA entity roster + MCAG decoy guard | ✅ `scripts/lib/waRoster.mjs`; all 10 MCAGs resolved live — the plan's four guessed county MCAGs were **all wrong** |
| 2 | Tacoma recon | ✅ 22 filings, statements confirmed — the self-publishing-GAAP risk did NOT materialise |
| 3 | Tacoma extractor | ✅ 19 years on ONE config; exposed 4 reader-defect classes |
| 4 | Seed cities + 4 nav-only counties | ✅ King County REUSED from v2.21, never recreated |
| 5 | Load Tacoma + adjudicate residues | ✅ 38 rows, zero residues (prints in thousands) |
| 6 | Generalise the 3 harnesses to the roster | ✅ `verify-bainbridge-*` → `verify-wa-*`; 4 real bugs found by the port |
| 7 | Spokane | ✅ 40 rows; found `-table` form feeds are NOT page breaks |
| 8 | Vancouver | ✅ 38 rows, 2 adjudicated $1 residues; "General Obligation" is not a GF column |
| 9 | Bellevue | ✅ 24 rows, 11 residues; inverted tree (capital outlay is a PARENT) |
| 10 | Kent | ✅ 36 rows; **10 corrupted production labels found + repaired**; approved floor deviation |
| 11 | Everett | ✅ 38 rows; the plainest issuer of the six; 2 more reader classes |
| 12 | Enrichment, all six cities | ✅ 93 rows, live-derived coverage; **found 2 letter-spaced Bellevue labels** |
| 13 | Full verification | ✅ 286/286 · 8/8 · tether definitive; (h) + 4 new guards mutation-tested |
| 14 | Closeout + planning files | ✅ closeout written, `.planning/` updated — **UAT + re-scope + tag pending Chris** |

⚠ **The one thing NOT done: Chris's UAT sign-off** (Task 14 Step 2) and the Phase D re-scope conversation (Step 4). The branch is merged to `main` untagged; the tag is Step 5 and waits on sign-off.

## Task Overview — v2.22 Bainbridge Island, WA + Kitsap County Onboarding

| # | Task | Outcome |
|---|------|---------|
| 1 | WA SAO client | ✅ `scripts/lib/waSao.mjs` + content guard (`classifyReport`) |
| 2 | Fetch 42 source PDFs | ✅ ARN manifests pinned in `fetchBainbridgeKitsap.mjs` |
| 3 | Seed both municipalities | ✅ WA OFM Apr-1-2025 populations (BI 25,530 / Kitsap 288,900) |
| 4 | Bainbridge extractor | ✅ two eras — `extractBainbridge.py` + `extractBainbridgeEarly.py` |
| 5 | Kitsap extractor | ✅ `extractKitsap.py`; established that a $0 tie CANNOT detect wrong-page selection |
| 6 | FY2009 font recovery | ✅ closed as a **documented drop** — no candidate map tied |
| 7 | Shared loader core | ✅ `scripts/lib/waSaoLoad.mjs`; per-capita band re-derived to `[100, 10000]` |
| 8 | Load + adjudicate residues | ✅ 72 rows; all 33 residues adjudicated individually |
| 9 | Blind re-derivation harness | ✅ 72/72 at exactly $0, 0 blockers; ambiguous page identity is FATAL |
| 10 | Audit harness | ✅ 8 checks (a,b,c,d,e,h,f,g); (h) mutation-tested |
| 11 | Enrichment | ✅ 38 rows, 100% coverage, all municipality-scoped |
| 12 | Tether + presentation | ✅ both NOT COVERED (documented); banners left on default |

**Verification at close (all green on `main`, post-merge):** `npm test` 6 files / **93 tests** · `npm run test:acfr` **125** · blind re-derivation **72/72 at $0, 0 blockers** · source-chain audit **8/8** · tether definitive.

**Two claims to state carefully.** The independent-document cross-check (kitsap.gov copies) covers **10 of the 72 rows**, never all 72 — the other 62 are verified against one document each. And **there is no `budgets.statement_page` column**: the extractors emit it but `treasury_sync_budget_tree` has nowhere to put it, so audit check (h) re-resolves the statement page from the PDF's own printed identity rather than asserting a field that would pass vacuously forever.

<details>
<summary>Previous milestone — v2.20 Madison, WI + Dane County (shipped 2026-07-28) — the last GSD-phased milestone</summary>

**UAT item 15 — Essentials tether absent on Madison = documented cross-repo gap, no TT change.** Essentials' published `coverage.json` (2026-07-28) carries **0 WI cities and 0 WI counties**; Wisconsin appears only as a state. TT correctly resolves `null` and paints no icon, exactly as the v2.16 contract specifies. Fix belongs in the Essentials repo. The requirement explicitly permits this outcome when documented — ticked.

**UAT item 16 — source chip fixed and shipped.** It rendered `source_date` as "· fetched {date}", false wherever `source_date` is a period end — **1,801 rows across 67 entities** app-wide (Madison WI said "fetched 2024-12-31"; Bend FY2006 said "fetched 2006-06-30"). Pre-existing, not caused by v2.20. Now **"· as of {date}"** in the chip and the aria-label, misleading doc comments rewritten. Chris was reading production, where it was still wrong because the whole v2.20 branch was unmerged — shipped by merging to `main`. **That lesson recurred in v2.22 and drove the decision to merge immediately after UAT.** Follow-up: the prop is still `fetchDate` and the API field still `fetchedAt`, the naming that produced the bug.

### Phase Overview — v2.20 Madison, WI + Dane County Onboarding

| Phase | Name | Requirements | Depends on | Status |
|-------|------|--------------|------------|--------|
| 135 | Recon + Loader | MAD-01, MAD-02, MAD-03 | — | ✅ Executed (10/10 tie; 14/14 tests) |
| 136 | Seed + Load + Enrichment | MAD-04, MAD-05, MAD-06, MAD-07 | 135 | ✅ Executed (20 rows live, 100% enriched) |
| 137 | Verification + Live UAT | MAD-08, MAD-09 | 135, 136 | ✅ Executed (20/20 rows Δ$0; Chris UAT signed 2026-07-28) |

**Critical path:** 135 → 136 → 137. Madison + Dane County onto TT from the **WI DOR CMREB statewide workbook** (`CMREB<YYYY>.xlsx`, free/no-auth, all 1,921 WI municipalities + 72 counties, CY2020–CY2024) — a bulk source in the Ohio-AOS mold, so this clones `loadOhioAOS.js` and needs **no PDF extractor**. A 2026-07-27 probe verified an exact built-in tie gate: nine printed-subtotal identities re-derived against components across **9,608 rows × 5 years = 86,472 checks, 0 failures**. Phase 135 reconciles Madison's CMREB figures against the city's own FY2024 ACFR, settles the basis verdict (§4 of the scoping brief) with written evidence, and builds `loadWICMREB.js` with the nine-identity gate + generic `--entity-type city|county` / per-muni selection so the deferred statewide fan-out is a flag flip. Phase 136 seeds Madison + **Dane County as a full entity** (not nav-only like Pima — the `Counties` sheet carries its own data), loads 20 rows via source-safe `treasury_sync_budget_tree`, labels provenance honestly as **unaudited self-reported MFR data** (MAD-06), and enriches to 100% bleed-safe. Phase 137 = blind re-derivation of all 20 rows from the workbook → source-chain audit → tether check → Chris UAT. **Constraints:** free XLSX only ($0 / $5 AI gate); **all-governmental-funds** basis as the source defines it (not GF-only); calendar-year FY; source-safe never-overwrite; executed inline (no subagents). **Watch:** this is the first **unaudited** city in TT — labelling is a requirement, not a nicety; collision risk with existing `Madison, MN` / `Madison County, OH` / `Madison County, VA` rows. **Deferred:** statewide fan-out (WI-CITIES-01), villages/towns (WI-TOWNS-01), Madison ACFR deepening to FY2015 (MAD-ACFR-01), pre-2020 history, salaries.

<details>
<summary>Previous milestone — v2.18 Pima County Municipalities (shipped 2026-07-17)</summary>

| Phase | Name | Requirements | Depends on | Status |
|-------|------|--------------|------------|--------|
| 131 | Recon + Extractors | PIMA-01, PIMA-02, PIMA-03 | — | ✅ Executed (44/44 ties $0) |
| 132 | Data Model + Load + Enrichment | PIMA-04, PIMA-05, PIMA-06 | 131 | ✅ Executed (44 rows, $0 re-derive, 100% enrich) |
| 133 | Verification + Live UAT | PIMA-07, PIMA-08, PIMA-09 | 131, 132 | ✅ Executed (Chris UAT 34/34) |

**Critical path:** 131 → 132 → 133. A 4-municipality onboarding (Oro Valley, Marana, Sahuarita, South Tucson) on the proven Tucson pipeline (`seedTucsonArizona.js` → `extractTucson.py` → `processTucson.js`), all linked under the **existing Pima County node** (no new county node). Phase 131 enumerates each municipality's published ACFR years, pins durable per-year URLs, proves clean `pdftotext -table` extraction of the **General Fund** column (bookend-tie $0), locks each clean window, **resolves South Tucson's source (ACFR vs AZ Auditor General AFR) with an explicit verdict**, and builds/extends the extractor. Phase 132 seeds each municipality + links to Pima County (breadcrumb + Cities-in-County panel alongside Tucson), loads GF operating + revenue via source-safe `treasury_sync_budget_tree` (never-overwrite, durable `source_url`+`source_date`, per-capita, Money In auto-enable), and enriches to 100% bleed-safe coverage. Phase 133 = loader-independent blind re-derivation ($0 delta) → source-chain audit (0 residue) → Chris live UAT → confirm the v2.16 Essentials tether icon on each new banner (PIMA-09; cross-repo coverage gap documented if absent). **Constraints:** free ACFR PDFs only ($0 / $5 AI gate); **General Fund** basis (all-funds deferred); source-safe never-overwrite; every figure durably sourced; executed inline (no subagents). **Recon-gated:** South Tucson (~5,600 pop) may need a source exception or defer. **Deferred:** Pima County's own budget (nav node only), all-funds view, salaries, Maricopa/other AZ cities.

</details>

</details>

</details>

</details>

## Deferred Items

### Carried at v2.25 close (2026-08-18)

Full working: `docs/superpowers/plans/SCOPE-02-CLOSEOUT.md`.

| Category | Item | Status |
|----------|------|--------|
| **data** | **MA DLS — 16,816 rows, 21% of the database** | **OPEN, and still the highest-value single task anywhere in this project** — and it sits in none of the SCOPE milestones. One ACFR from a town that runs its own schools moves `general_fund` from 2.2% to ~23% and `unknown` from 33% to ~12%. Newton, Somerville and Arlington all return HTTP 403 to scripted fetches, which is precisely why it keeps not happening |
| **harness** | `verify-fund-scope.mjs` now reports a false alarm on EVERY run | **OPEN.** It compares against SCOPE-01's whole-table digest, which the 12 legitimate new rows move, and it never got the exclusion mechanism. **A harness nobody believes is worse than no harness** — retire or update it before it trains people to ignore a red result |
| **instrument** | `detectSeams` is scope-blind | **OPEN.** For a dual-row city-year it can register a spurious `fy_gap=0` seam between two legally-coexisting rows, polluting the ~37-seam backlog. **Fix the instrument before triaging with it** |
| **defect** | `bulkLoadStateController.js` checks `rows_inserted` but never `result.error` | **OPEN.** The RPC's ambiguity guard returns `{error}` as a *successful* PostgREST call, so a future hit undercounts silently with no output. Did not fire during this backfill |
| tooling | No lint for raw control characters in source | **OPEN.** The raw-NUL trap fired **three separate times** in this milestone; it makes git classify a file as binary and destroys its diff and blame. Three is a pattern, not bad luck |
| schema | The RPC key omits `period_label` | **open** — fails closed only on ≥2-way collisions. If exactly one row matches but differs in `period_label` it would overwrite silently. No current loader can reach it; CA SCO has no TQ rows |
| docs | SCOPE-01's `fundScopeRegistry.mjs` says "seven taxonomies" where RECON §4.3 says **eight** | **open** — corrected in the new basis registry; the shipped SCOPE-01 file still carries the error |
| ui | `ScopeLabel.tsx:84` keys the basis chip off `TONE['general_fund']` rather than the in-scope `VERIFIED_TONE` | **open, cosmetic** — safe only while a test asserts the three fund-scope tones are identical |
| ⛔ cost | Transparent Utah | **unchanged — NEVER reconcile by querying BigQuery.** Unpartitioned, full-scan, ~$132 surprise bill on 2026-06-19. Use a free SLC/Provo ACFR PDF |


### Carried at v2.24 close (2026-08-17)

Everything below is SCOPE-02's inheritance unless marked otherwise. Full working in
`docs/superpowers/plans/SCOPE-01-RECON.md`.

| Category | Item | Status |
|----------|------|--------|
| **data** | **MA DLS — 16,816 rows, 21% of the database, the largest single block of `unknown`** | **OPEN, and the most valuable remaining reconciliation.** Expenditures point clearly at `general_fund` (2.59% from the ACFR vs 20.35% from Total Governmental), but the DLS revenue report's `Transfers` column is an **all-governmental-funds** figure (+1.69% vs all-funds transfers, +414% vs GF), making its published total a hybrid. Needs one ACFR from a town that runs **its own schools** — Amherst is a regional-school-district town and a poor witness; Newton, Somerville and Arlington all return HTTP 403 to scripted fetches |
| **schema** | **`reporting_entity`** (`primary_government` / `incl_component_units` / `unknown`) | **OPEN — Chris's decision, SCOPE-02.** State-collected forms consolidate HRA/EDA/TIF component units city ACFRs present separately. **The comparison filter must then check BOTH columns**, which is why `isComparableScope()` is a list-based predicate and not an inline `!== 'unknown'`. Affects MN OSA, Ohio AOS, VA APA, MN counties ≈ 29,000 rows |
| **data** | The 26-seam queue | **OPEN — SCOPE-02's work queue.** Split it in two first: large negative steps are real breaks, small/positive ones are sources awaiting an entry |
| **disclosure** | Anaheim, Santa Ana and Los Angeles have no `cityBasisNotes` entry | **OPEN.** Anaheim and Santa Ana are the 2nd and 4th largest seams in the database. **Better than authoring three notes: derive the disclosure from `fund_scope` and retire the curated map**, which drifts silently because nothing measures its completeness |
| **data** | VA **Exhibit B1** — load intergovernmental aid | **OPEN.** VA revenue is Exhibit B *"Total **Local** Revenue"* and runs 59.6%–102.3% of expenditures depending on aid dependence. The 304 rows are hidden as `dataset_type = 'revenue_local_only'`; restore `revenue` once B1 lands. **Incomplete, not unclassified** — no `fund_scope` value can express a horizontal slice |
| **evidence** | A second CA county probe to harden `ca-sco-county-rev` | **OPEN.** The registry's only entry without a dollar tie. A test asserts it stays the only one. What would overturn it: a residue concentrated in a fund-shaped line, or one-directional in sign |
| **evidence** | CA publicpay structural reconciliation (7,682 rows) | **OPEN, low urgency.** 479 of 482 cities pair it against the all-funds SCO total, so "payroll as a share of spending" reads correctly today. The exceptions carry a GF-only budget document, which **overstates** payroll's share |
| ⛔ **cost** | Transparent Utah (539 rows) | **OPEN — and must NEVER be reconciled by querying BigQuery.** Unpartitioned; every query full-scans; ~$132 surprise bill on 2026-06-19. The rows are already in Supabase — use a free SLC/Provo ACFR PDF |
| schema | SCOPE-01 deliberately did NOT widen the unique index | **by design** — nothing creates a second-scope row until SCOPE-02, so widening early opens a double-count hazard for no benefit. SCOPE-02 owns it, with the read-path/summation guards |
| data-hygiene | `dataset_type = 'salary'` (6 rows) is a typo of `salaries`; `all_funds_requirements` is a `dataset_type` encoding a fund scope | **open, not SCOPE-01's to fix** |
| tech-debt | `DatasetTabs.tsx:149` carries the same dead `bg-ev-gray-50` class the UAT defect was made of | **open, cosmetic, pre-existing** |

### Carried at v2.23 close (2026-08-16)

| Category | Item | Status |
|----------|------|--------|
| ~~**sign-off**~~ | ~~Chris UAT + Phase D re-scope + the `v2.23` tag~~ | ✅ **CLOSED** — tagged `v2.23` at `40aa706` on 2026-08-16. The Phase D re-scope conversation was overtaken by SCOPE-01 |
| source-guard | `classifyReport` passes a document whose **table of contents** names the statement even when the statement pages are unreadable | **open** — Everett FY2005/FY2010 both passed the fetch guard and were caught only by the page-identity probe. Tighten in the next WA milestone |
| tech-debt | `scripts/lib/acfrGF.py` still splits pages naively on form feeds | **open, harmless today** — its `statement_page` is never persisted, but it disagrees with audit check (h). `-table` form feeds are NOT page breaks |
| tech-debt | `verify-wa-audit.mjs` deliberately DUPLICATES the page-identity regexes rather than importing them | **accepted** — but it has already cost one round of divergence. Fix such a regex in BOTH files |
| cross-repo | Essentials `coverage.json` carries no record for any of the 12 WA entities | **documented gap, not a TT change** — TT correctly paints no tether icon |
| data | 19 source-document refusals across the six cities; no OCR recovery attempted | **deliberate** — every one is a defect in the filing, itemised in the closeout |
| decision | Config registry vs per-file extractors (spec §5) | **DECIDED: keep per-file.** The registry wins on the spec's stated criterion (zero per-city code, by AST parse) but the criterion measured the wrong cost — see closeout §6 |

### Carried at v2.22 close (2026-08-15)

None of these block anything; all were surfaced during v2.22 and deliberately not fixed inside it.

| Category | Item | Status |
|----------|------|--------|
| cross-repo | Essentials `coverage.json` carries no Bainbridge Island / Kitsap County record | **documented gap, not a TT change** — TT correctly paints no tether icon. Belongs to the Essentials repo, same as v2.20's WI gap |
| presentation | `cities/seattle.jpg` + `cities/king-county.jpg` exist in the shared bucket but are absent from `CURATED_CITY_BANNERS` | **open** — v2.21's entities fall through to Wikipedia while licensed assets sit unused. Needs each credit TRANSCRIBED from Essentials' `buildingImages.js`; never infer from a filename |
| planning-debt | `.planning/ROADMAP.md` + `MILESTONES.md` have no v2.21 or v2.22 entry | **open** — both milestones ran on superpowers plans. STATE.md now records v2.22; the roadmap still ends at v2.20 |
| naming | SourceChip prop is still `fetchDate`, API field still `fetchedAt` | **deferred from v2.20** — the naming that produced the "fetched" vs "as of" bug |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | **deferred** — frontend-routing follow-up carried since v2.12 |

### Acknowledged at v2.19 close (2026-07-21)

Open-artifact audit at v2.19 close surfaced 1 item, non-blocking (acknowledged & proceed). Not v2.19 work — Phase 134 was verified end-to-end (build/tests + Chris live UAT 6/6, 0 issues):

| Category | Item | Status |
|----------|------|--------|
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | **deferred** — frontend-routing follow-up carried since v2.12; still the only genuinely-open item |

**v2.19 follow-up (documented, not fixed):** the CTC chip's per-location gating fetches CTC collections via the ev-accounts-api `/trivia/collections` proxy; if that endpoint is auth-gated, anonymous visitors won't see the CTC chip (degrades cleanly). Expose a public CTC catalog (parity with Essentials' public `coverage.json`) to close this.

### Acknowledged at v2.18 close (2026-07-17)

Open-artifact audit at v2.18 close surfaced 6 items, all non-blocking (Chris chose Proceed & defer). None are v2.18 (Pima municipalities) work — Phase 133 verified the whole milestone end-to-end (PIMA-07 loader-independent blind re-derivation 44/44 FY×mode + every category + every leaf $0 + source-chain audit a–e clean; PIMA-08 Chris live UAT 34/34; PIMA-09 tether confirmed COVERED on all four banners). Code-review findings CR-01/CR-02/WR-01 in the verify harnesses were fixed (commit e9bd430):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 133 `133-UAT-CHECKLIST.md` | passed — 0 open scenarios (Chris signed off 2026-07-17; audit flags it only because the file exists) |
| context_question | Phase 131 `131-CONTEXT.md` | **resolved** — recon/scoping questions answered during Phase 131 execution (South Tucson verdict = load-from-ACFR FY2019–2022, FY2019–2024 window); artifact flagged only because the file exists |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | **deferred** — frontend-routing follow-up carried from v2.12/v2.16/v2.17; still the only genuinely-open item |
| quick_task | 001-create-treasury-tracker-entries-for-ever | **complete, not orphaned** — Collin County TX seeder (live in DB); "missing" is the SUMMARY-filename detection quirk |
| quick_task | 002-add-longview-tx-revenue | **complete, not orphaned** — Longview TX FY2026 revenue loaded (live in DB) |
| quick_task | 003-longview-operating-budget | **complete, not orphaned** — Longview TX FY2026 operating budget loaded (live in DB) |

### Acknowledged at v2.17 close (2026-07-11)

Open-artifact audit at v2.17 close surfaced 5 items, all non-blocking (Chris chose Acknowledge & proceed). None are v2.17 (Tucson onboarding) work — Phase 130 verified the whole milestone end-to-end (TUC-07 loader-independent re-derivation 20/20 FY×mode + every leaf $0 + clean source-chain audit; TUC-08 Chris live UAT 15/15; TUC-09 tether confirmed COVERED on both banners):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 130 `130-UAT-CHECKLIST.md` | passed — 0 open scenarios (Chris signed off 2026-07-11; audit flags it only because the file exists) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | **deferred** — frontend-routing follow-up carried from v2.12/v2.16; still the only genuinely-open item |
| quick_task | 001-create-treasury-tracker-entries-for-ever | **complete, not orphaned** — Collin County TX seeder (live in DB); "missing" is the SUMMARY-filename detection quirk |
| quick_task | 002-add-longview-tx-revenue | **complete, not orphaned** — Longview TX FY2026 revenue loaded (live in DB) |
| quick_task | 003-longview-operating-budget | **complete, not orphaned** — Longview TX FY2026 operating budget loaded (live in DB) |

### Acknowledged at v2.16 close (2026-07-08)

Open-artifact audit at v2.16 close surfaced 5 items, all non-blocking (Chris chose Acknowledge & proceed). None are v2.16 (Tethered Icons) work — Phase 127 verified the whole milestone end-to-end (TETH-03 7/7 headless matrix against live catalog + real DB entities; VER-01 Chris live-app sign-off 2026-07-08, 0 defects):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 127 `127-UAT.md` | passed — 0 open scenarios (Chris signed off 2026-07-08; audit flags it only because the file exists and its custom format isn't parsed) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | **deferred** — frontend-routing follow-up carried from v2.12; the only genuinely-open item |
| quick_task | 001-create-treasury-tracker-entries-for-ever | **complete, not orphaned** — Collin County TX seeder (live in DB); "missing" is the SUMMARY-filename detection quirk (per v2.15 correction) |
| quick_task | 002-add-longview-tx-revenue | **complete, not orphaned** — Longview TX FY2026 revenue loaded (live in DB) |
| quick_task | 003-longview-operating-budget | **complete, not orphaned** — Longview TX FY2026 operating budget loaded (live in DB) |

### Acknowledged at v2.15 close (2026-07-06)

Open-artifact audit at v2.15 close surfaced 5 items, all non-blocking. None are v2.15 blockers — Phase 124 verified the whole milestone end-to-end (VER-09 149/151 blind re-derivation exact $0 + 14/14 cohort audit incl. NASBORT-01 + 50/50-ACFR; VER-10 Chris live UAT 12/12 all-pass):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 124 `124-UAT-CHECKLIST.md` | passed — 0 pending scenarios (Chris signed off 12/12 2026-07-05; flagged only because the file exists) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | **deferred** — frontend-routing follow-up carried from v2.12; the only genuinely-open item |
| quick_task | 001-create-treasury-tracker-entries-for-ever | **complete, not orphaned** — Collin County TX municipality seeder (28 munis, live in DB). `status: complete` added to frontmatter; the audit's "missing" is a SUMMARY-filename detection quirk (`NNN-SUMMARY.md` short-id form vs the full-dirname form the handler expects) |
| quick_task | 002-add-longview-tx-revenue | **complete, not orphaned** — Longview TX FY2026 revenue loaded (commits 7b68c08/a4ce792/5bcad47), live in DB |
| quick_task | 003-longview-operating-budget | **complete, not orphaned** — Longview TX FY2026 operating budget loaded (27 depts, $104.8M, commit 0eb1f6d), live in DB |

Note: the v2.14-close notes below mislabelled the three quick tasks as "orphaned (file missing)" — they are in fact completed loads with PLAN + SUMMARY files; corrected here.

### Acknowledged at v2.14 close (2026-07-03)

Open-artifact audit at v2.14 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.14 blockers — Phase 116 verified the whole milestone end-to-end (VER-07 75/75 blind re-derivation exact $0 + 12-invariant cohort audit; VER-08 Chris live UAT 11/11 all-pass) and the milestone audit closed PASSED 20/20:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 116 `116-UAT-CHECKLIST.md` | passed — 0 pending scenarios (Chris signed off 11/11 2026-07-03; flagged only because the file exists) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | deferred — frontend-routing follow-up carried from v2.12 |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.14 |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.14 |

**v2.14 tech debt (documented, not fixed — all advisory, none affect figure correctness/tie-outs/sourcing; see milestones/v2.14-MILESTONE-AUDIT.md):** WR-04..07 loader error-path robustness (`process.exit(2)` inside `try` bypasses `finally` residue cleanup; swallowed select error; mid-run partial-load risk — fleet-wide, self-heals on next run's start-delete, **never manifested in any v2.14 run**); AL "Charges"→"Changes" category-label drift (`processALAcfr.js` FY2018+, unverified against source PDF, ties unaffected — worth a source spot-check); UT trailing-space category name (`processUTAcfr.js:111`, cosmetic); NJ phantom-comment referencing a non-existent `isolateNJStatement()` guard (guard logic lives only in the loadlog). **RESOLVED this milestone:** WR-05 data_sources residue → fixed by LOAD-01 (Phase 111), proven end-to-end. **Nyquist:** VALIDATION.md exists for 111/115/116 (all compliant); 112 is doc-only recon (N/A); 113/114 data loads are covered by Phase 116's 75/75 blind re-derivation (stronger than a formal harness) — optional `/gsd-validate-phase 113`/`114` if complete paperwork is wanted.

### Acknowledged at v2.13 close (2026-07-02)

Open-artifact audit at v2.13 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.13 blockers — Phase 110 verified the whole milestone end-to-end (VER-05 49/49 independent re-derivation + 10/10 cohort audit; VER-06 Chris live UAT 11/11 all-pass) and the milestone audit closed at 18/18:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 110 `110-UAT-CHECKLIST.md` | passed — 0 pending scenarios (Chris signed off 11/11 2026-07-01; flagged only because the file exists) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | deferred — frontend-routing follow-up carried from v2.12 |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.13 |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.13 |

**v2.13 follow-ups (documented, not fixed):** WR-05 loader data_sources residue (recurs on every `process*Acfr.js` run until the upsert is atomic; re-cleaned in 110-02 + after the 108-closure NJ re-run); recoverable history holes (MA FY2001/02/04/05/14/21, CT FY2006 OCR, NJ pre-FY2020, CT/WI pre-GASB-34 — need a pre-GASB-34 extractor + basis label); state-node hero banners default to Wikipedia's lead image = low-res state flag (cosmetic; fix paths diagnosed in 108-UAT.md Gaps).

### Acknowledged at v2.6 close (2026-06-22)

Items acknowledged and deferred at v2.6 milestone close on 2026-06-22:

| Category | Item | Status | Note |
|----------|------|--------|------|
| phase | 77-where-the-money-goes-graphic (EVVIZ-01) | iceboxed | Deliberate icebox — flat 6-category data makes a dedicated graphic low-value; revisit in a future milestone |
| quick_task | 001-create-treasury-tracker-entries-for-ever | missing | Unrelated to v2.6 (city-data); stub with no recorded work |
| quick_task | 002-add-longview-tx-revenue | missing | Unrelated to v2.6 (Longview TX city-data) |
| quick_task | 003-longview-operating-budget | missing | Unrelated to v2.6 (Longview TX city-data) |

**Re-deferred at v2.11 milestone close (2026-06-29):** the same 3 Longview-TX quick-task stubs (001/002/003) resurfaced in the v2.11 pre-close audit — they remain unrelated to the State ACFR milestone and stay deferred (Chris-acknowledged). The Phase 101 verification gap from the same audit was *resolved* (closed by Phase 102 VER-02 UAT sign-off), not deferred.

### v2.6 EV Financial Transparency Refresh context

- **Scope:** Empowered Vote's OWN organizational financials (not geographic). Refresh donation/income figures by idempotently combining all sources, add a donor-facing transparency view, and add an actual "where the money goes" spend graphic. *(Graphic — Phase 77/EVVIZ-01 — ICEBOXED 2026-06-22; deferred to a future milestone.)*
- **Sources (all idempotent CSV merge — no live API this milestone):**
  - **GiveButter** — primary; already has live webhook → Supabase rows. Fresh export must dedup against webhook rows by `external_id`.
  - **Patreon** — recurring donations, CSV export.
  - **Benevity** — workplace/matching giving, export.
  - **Beneficial State Bank** — transaction CSV export confirmed available (Chris, 2026-06-20). **Authoritative for cash balance + expenses.**
  - **Manual / off-platform** — checks, grants, in-kind.
- **🔑 Reconciliation rule (design at Phase 75 plan time):** bank = balance/expense truth; platforms = income detail. A platform payout deposited in the bank must NOT be counted twice on top of the platform donations that produced it (deposits arrive net of platform fees).
- **EV is all-volunteer, $0 staff comp** — expense breakdown should make this obvious (reinforces the donor story).
- **Inputs still needed from Chris:** the fundraising **goal figure** (EVVIEW-04); the current set of expense categories the bank debits should roll up into.
- **Constraints:** free/low-cost only (unfunded nonprofit); $5 AI-spend gate — estimate before any AI run; every displayed figure sourced (platform export, bank statement, or manual-entry record). Live host `treasurytracker.empowered.vote`.
- **Reuse:** `scripts/loadEVFinances.js` (CSV → Supabase), the existing webhook dedup (`external_id` + source columns), the nonprofit display mode / brand-tile system, and the verification/source-chain + UAT pattern from prior milestones.
- **Parked:** Ohio geographic milestone (recon'd, `reference_ohio_aos_financial_data`) — a future candidate, not v2.6.

## Phase Overview

| Phase | Name | Requirements | Depends on | Status |
|-------|------|--------------|------------|--------|
| 74 | Donation Source Refresh (Idempotent Income Merge) | EVDATA-01, EVDATA-02, EVDATA-03 | — | ✅ COMPLETE — verified, Chris UAT all-pass 2026-06-20 |
| 75 | Bank Truth + Reconciliation | EVDATA-04, EVDATA-05, EVDATA-06 | 74 | ✅ COMPLETE — verified 2026-06-21 |
| 76 | Donor-Facing Transparency View | EVVIEW-01..04 | 75 | ✅ COMPLETE — verified, Chris live UAT 2026-06-21 |
| 77 | "Where the Money Goes" Graphic | EVVIZ-01 | 76 | 🧊 ICEBOXED 2026-06-22 (deferred — see ROADMAP) |
| 78 | Reconciliation Audit + Live-App UAT | EVVER-01, EVVER-02 | 74–76 | ▶ Starting (wrap-up) |

**Critical path:** 74 → 75 → 76 → 78 (77 iceboxed). Phase 78 verifies the refreshed figures + transparency view.
**Constraint:** Idempotent CSV merge; free/low-cost only ($5 AI gate); every figure sourced; bank authoritative for balance + expenses, platforms for income detail (never double-count).

## Accumulated Context

### v2.6 Phase 74 close (2026-06-20)

- **Phase 74 COMPLETE + verified.** FY2026 EV donation income refreshed from platform exports: GiveButter $703, Patreon $370, Benevity $1,475, Interest $0.51 = **$2,548.51** (was $1,256.51). Idempotent, dedup'd (export-baseline + webhook-delta), aggregate-only (no donor PII). `scripts/loadEVDonations.js` + tests; `loadEVFinances.js` writes expenses only now (D-08). Chris UAT all-pass.
- **Benevity FY basis = disbursement date (cash basis)** — matches the bank. Fixed a cross-year double-count: 14 Dec-2025 gifts ($207.50) were in both FY2025 (old sheet) and FY2026; removed from FY2025 (→ $2,340.01).
- **Phase 75 expense side PULLED FORWARD (Chris asked):** `scripts/loadEVBank.js` loads every Beneficial State Bank debit as the FY operating dataset. FY2026 operating $969.33 (stale sheet) → **$1,745.65** (bank truth): AI & Research $820.60 (Anthropic $680.60!), Infra & Hosting $473.43, Design $410.31, Domains $39.95, Bank Fees $1.36. Idempotent + tested, source='bank'. No transfers/payroll (all-volunteer).
- **🔑 Phase 75 remaining:** cash balance ($1,706.77 @ 6/17) + runway; deposit↔donation reconciliation (gross donations vs. net deposits — don't double-count); manual/off-platform entries; **track + display platform fees** (~$125/FY, captured by loadEVDonations D-09 but currently dropped — Chris explicitly wants these visible, the cost-of-fundraising story).

### Roadmap Evolution

- Phase 71.1 inserted after Phase 71: Single-scan rollup ETL — replace per-(entity,FY,type) live BigQuery queries (full-table scans, ~$132/day) with one rollup scan into Supabase; manual refresh (URGENT)

### v2.0 Foundation Documents

- `.planning/v2.0-FEDERAL-BRIEF.md` — mission, ground rules, sourcing architecture, phase shape
- `.planning/v2.0-recon/RECON.md` — verified sources, pinned figures, data structure findings, IA decisions
- `.planning/v2.0-recon/samples/` — raw API samples (MTS tables 4/5/9, USAspending, OMB xlsx)
- Auto-memory: `project_federal_tracker_ground_rules.md`

### Ground Rules (Chris, 2026-06-12)

1. No paid APIs; LLM spend under the $5 gate
2. NEVER create or display unsourced data or text
3. No reflexive deep icicles — visualization fits the data
4. Explainers: Tier 1 from fetched authoritative text only; Tier 2 origins from Congress.gov/GovInfo structured records
5. Safety line: official public record only — no personal info, no targeting
6. Transparency about opacity (DoD failed audits flagged with GAO/OIG citation)

### IA Decisions (locked 2026-06-12)

- Headline year: FY2025 actuals; FY2026 FYTD as secondary "this year so far" strip
- Landing: proportional Mandatory/Discretionary/Net Interest bands + permanent deficit strip
- Function lens default; agency lens behind toggle
- Outlays consistently (MTS/OMB); USAspending obligations never headline figures

### Pinned Sourced Figures (recon 2026-06-12)

- FY2025 actuals: receipts $5,236.4B / outlays $7,011.1B / deficit $1,774.7B (OMB Hist 1.1)
- FY2025 split: Discretionary $1,875.1B (Def $893.6B / Nondef $981.5B), Mandatory ~$4,165.9B, Net Interest ~$970B (OMB Hist 8.1)
- FY2026 FYTD thru May: outlays $4,901.9B, receipts $3,655.6B; Net Interest $722.7B > Defense $630.9B (MTS T9)
- Debt: $39.213T (Debt to the Penny, 2026-06-10)

### Phase 45 Inputs (from Phase 44 execution)

- US entity id `0098c405-65e1-426f-8e5f-0fcbe2a900c0`; datasets live: operating (function lens, $7,532.2B displayed), revenue ($5,234.6B), federal_agency (agency lens, $8,905.0B displayed)
- Landing bands + deficit strip data: treasury.federal_annual_summary (64 years; FY2025 official: receipts $5,236.4B / outlays $7,011.1B / deficit $1,774.7B / mandatory $4,165.9B / disc def $893.6B / disc nondef $981.5B / net interest $970.1B)
- Live strip: federal_context_metrics fytd_receipts/fytd_outlays/total_public_debt/fytd_interest_expense
- DISCLOSURES OWED (44-VERIFICATION §Known disclosures): visual totals exceed official net (function +$521.1B, agency +$1,895.5B excluded negatives); 67 disclosure metrics enumerate every exclusion; offsetting items are negative '(offsetting)' line items in the data
- budgets.data_source_id FK → source_registry (NOT data_sources) — the source-chip join; all 3 federal rows linked
- BudgetIcicle now normalizes child widths by sum-of-children (App.tsx federal_agency excluded from tab list — Phase 45 builds the lens toggle)

### Phase 44 Loader Contract (from 43-03 audit)

- **getCities visibility is gated on `treasury.budgets`** metadata rows (one per fiscal_year × dataset_type), NOT on operating_budgets line items — loaders must write both
- `treasury.budgets` NOT NULLs: fiscal_year, dataset_type, total_budget, fiscal_year_start_month — federal uses **fiscal_year_start_month = 10**
- Federal line-item rows MUST populate source_name (registry key), source_url, source_date — columns live as of 43-01
- Registry keys available: treasury-fiscal-data, omb-historical-tables, usaspending, congress-gov, govinfo
- The US entity appears in the app automatically when the first treasury.budgets row lands (no feature flag)

### Technical Gotchas (verified during recon)

- Fiscal Data API: `page[size]` must be URL-encoded (`page%5Bsize%5D`)
- OMB xlsx: needs browser User-Agent; URL is `/omb/information-resources/budget/historical-tables/` (moved)
- MTS Table 5: "Total--" rows appear at mixed levels — walk parent_id, never sum "Total--" rows
- USAspending explorer total = obligations ($10.3T FY2025) ≠ outlays ($7.0T); has "Unreported Data" line
- CBO + GAO: entire domains 403 non-browser clients — manual download fallback
- openpyxl available in local Python; parses OMB tables cleanly

### API Cost Threshold

$5 per run — estimate before running AI enrichment. Recon estimate for full federal enrichment: <$0.50 (~65 generation calls with fetched context). Re-estimate before each run.

### Known Tech Debt (carried from v1.7–v1.9)

- Oakland revenue (OpenGov embedded chart format) — deferred
- Fresno + Riverside revenue (no extractable GF revenue section) — deferred
- San Jose FY2016–2020 (older PDF format) — deferred
- Phase 07, 14, 22, 25 verification files — human_needed, shipped milestones
- MA GF Expenditures report type (re-add path in 37-01-SUMMARY.md)

## Session Continuity

Last session: 2026-08-18
Stopped at: **v2.25 SCOPE-02 CLOSED.** PRs #16 and #17 merged, `.planning/` updated, tagged `v2.25`. UAT sign-off still outstanding. Working tree clean.
Resume file: `docs/superpowers/plans/SCOPE-02-CLOSEOUT.md`

### Next Session

**RESUME AT: one of two things, and they are not the same size.**

**The highest-value task is not in any SCOPE milestone: one MA ACFR.** 16,816 rows — 21% of the database — are `unknown` because the MA DLS revenue report's `Transfers` column is an all-governmental-funds figure, making its published total a hybrid. Expenditures point clearly at `general_fund` (2.59% from the ACFR vs 20.35% from Total Governmental). It needs **one audited document from a town that runs its own schools** — Amherst is a regional-school-district town and a poor witness. Newton, Somerville and Arlington all return HTTP 403 to scripted fetches, so this needs a human or another route, which is exactly why it keeps not happening. Landing it moves `general_fund` from 2.2% to ~23% and `unknown` from 33% to ~12%.

**Otherwise SCOPE-03**, which is scoped but not planned: the GF ⇄ Total Governmental ⇄ All Funds toggle, and making the enterprise slice visible. Its foundation is now in place. Read, in this order:

1. `docs/superpowers/plans/SCOPE-02-CLOSEOUT.md`
2. `docs/superpowers/plans/SCOPE-01-CLOSEOUT.md` and `SCOPE-01-RECON.md`

**Chris's framing, which is the point of the whole arc:** the transfer between an enterprise fund and the general fund is where money gets quietly reclassified, and a tool that only ever shows one total cannot show that movement. Enterprise/ISF is **59% of Long Beach, 52% of Anaheim, 50% of Modesto** — under a GF-only view, more than half the city is invisible.

⚠ **Fix the instruments before triaging the seam backlog with them.** Two are known-broken and both are cheap:
* `verify-fund-scope.mjs` reports a false alarm on every run — it never got the exclusion mechanism. A harness nobody believes is worse than no harness.
* `detectSeams` is scope-blind, so it manufactures phantom zero-gap seams for legally-coexisting rows. Redefining what a "seam" means once series exist is a genuine SCOPE-03 design question.

⚠ **Traps this arc has already paid for. Do not rediscover them:**
* **A raw NUL byte in source makes git treat the file as binary**, killing diff and blame. It fired **three times** in SCOPE-02 alone. Write `U+0000`, never the byte.
* **`npm run build` is the CI gate, not `npx tsc --noEmit`** — the latter does not build project references and passes on errors CI fails.
* **Tailwind drops an undefined colour class silently.** There is no `ev-blue`; light steps are three-digit (`ev-gray-050`). Only `getComputedStyle` off the running app catches it.
* **`dotenv` is not installed** — `node -r dotenv/config` fails. Use `set -a && source .env && set +a`.
* **PostgREST round-trips bare numerics lossily** past ~15–17 significant figures. Select `total_budget::text` when a digest depends on it.
* **A `data_source` string is not evidence.** Read the loader's actual input files.
* ⛔ **Never query Utah's BigQuery table** — unpartitioned, ~$132 on 2026-06-19.

To start the next one: `/gsd-new-milestone`. If it runs as a superpowers spec + plan again, **tag and update `.planning/` in the same step** — that drifted on four milestones running before v2.24 and v2.25 fixed it.


## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| (v2.0 not yet started) | — | — | — |
| Phase 53 P53-01 | 40 minutes | 5 tasks | 0 files |
| Phase 55 P55-02 | 45min | 3 tasks | 1 files |
| Phase 55 P55-03 | 25min | 2 tasks | 2 files |
| Phase 57 P57-01 | 75min | 5 tasks | 1 files |
| Phase 57 P57-02 | 35min | 3 tasks | 4 files |
| Phase 58 P58-01 | 90min | 5 tasks | 1 file (baseline.md) |
| Phase 62 P62-01 | 50min | 3 tasks | 1 files |
| Phase 62 P62-02 | 30min | 3 tasks | 1 files |
| Phase 62 P62-03 | 45min | 3 tasks | 2 files |
| Phase 81-towns-virginia-data-model-linking P01 | 35 | 4 tasks | 3 files |
| Phase 81-towns-virginia-data-model-linking P02 | 30min | 2 tasks | 3 files |
| Phase 81-towns-virginia-data-model-linking PP03 | 35min | 4 tasks | 5 files |
| Phase 81.5 P01 | 40min | 3 tasks | 2 files |
| Phase 81.5 P02 | 14min | 3 tasks | 2 files |
| Phase 84 P01 | 35min | 3 tasks | 2 files |
| Phase 84 P02 | 30min | 2 tasks | 1 files |
| Phase 85 P01 | 40min | 3 tasks | 3 files |
| Phase 85-city-loads P02 | 23min | 4 tasks | 1 files |
| Phase 86 P86-01 | 7m | 3 tasks | 4 files |
| Phase 86-county-loads-data-model-linking P86-02 | 95min | 4 tasks | 4 files |
| Phase 86-county-loads-data-model-linking P03 | 25min | 3 tasks | 1 files |
| Phase 86-county-loads-data-model-linking P04 | 45min | 3 tasks | 3 files |
| Phase 86-county-loads-data-model-linking P05 | 90min | 4 tasks | 2 files |
| Phase 87-enrichment-parity P87-01 | 11 minutes | 3 tasks | 5 files |
| Phase 88-verification-source-chain-audit-uat P01 | 40 | 2 tasks | 1 files |
| Phase 88 P02 | 23 | 3 tasks | 2 files |
| Phase 92-enrichment-parity-mnenr-01 P01 | 20min | 3 tasks | 5 files |
| Phase 95 P03 | 45 | 2 tasks | 2 files |
| Phase 95 P05 | 5 | 2 tasks | 1 file |
| Phase 96-remaining-states-sgfs-04 P03 | 45 | 2 tasks | 1 files |
| Phase 96-remaining-states-sgfs-04 P04 | 45 | 2 tasks | 1 files |
| Phase 96 P05 | 25min | 2 tasks | 1 files |
| Phase 96-remaining-states-sgfs-04 P06 | 9min | 2 tasks | 1 files |
| Phase 101 P01 | 8min | 3 tasks | 2 files |
| Phase 102-verification-source-chain-audit-uat-ver-01-ver-02 P01 | 45min | 2 tasks | 1 files |
| Phase 102 P02 | 30 | 3 tasks | 2 files |
| Phase 104 P04 | 35min | 4 tasks | 1 files |
| Phase 107-recon P107-01 | 180 | 3 tasks | 1 files |
| Phase 107-recon-acfr-source-location-roster-lock-overlap-resolution-re P107-02 | 120 | 3 tasks | 1 files |
| Phase 107-recon-acfr-source-location-roster-lock-overlap-resolution-re P107-03 | 6min | 2 tasks | 1 files |
| Phase 112 P03 | 95min | 3 tasks | 1 files |
| Phase 114 P01 | 17min | 3 tasks | 3 files |
| Phase 114-02 PP02 | 45min | 3 tasks | 3 files |
| Phase 114 P03 | 20min | 3 tasks | 3 files |
| Phase 114 P04 | 25min | 3 tasks | 3 files |
| Phase 114 P05 | 70min | 3 tasks | 3 files |
| Phase 115 P01 | 32min | 3 tasks | 3 files |
| Phase 115-deepening-recoverable-holes-pre-gasb-34-extractor P02 | 65min | 3 tasks | 6 files |
| Phase 115 P03 | 50min | 3 tasks | 5 files |
| Phase 116 P01 | 40min | 3 tasks | 2 files |
| Phase 116-verification-source-chain-audit-uat-ver-07-ver-08 P02 | 25min | 3 tasks | 2 files |
| Phase 119 P01 | 60min | 3 tasks | 3 files |
| Phase 119 P02 | 35min | 3 tasks | 2 files |
| Phase 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42 PP03 | 55min | 3 tasks | 2 files |
| Phase 120 P01 | 15min | 3 tasks | 1 files |
| Phase 120 P03 | 45min | 3 tasks | 3 files |
| Phase 120 P04 | 40min | 3 tasks | 3 files |
| Phase 120 P05 | 15min | 3 tasks | 3 files |
| Phase 121 P01 | 30min | 3 tasks | 3 files |
| Phase 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53 P03 | 105min | 3 tasks | 3 files |
| Phase 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53 P04 | 40min | 3 tasks | 3 files |
| Phase 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53 P121-05 | 25min | 3 tasks | 3 files |
| Phase 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53 P121-06 | 55min | 3 tasks | 4 files |
| Phase 124 P01 | 60min | 2 tasks | 2 files |
| Phase 124 P02 | 65min | 2 tasks | 2 files |
| Phase 124 P03 | 20min | 2 tasks | 1 files |
| Phase 125 P125 | 25min | 4 tasks | 9 files |
| Phase 126 P126 | 16min | 5 tasks | 12 files |
| Phase 129-data-model-load-enrichment P01 | 35min | 2 tasks | 1 files |
| Phase 129 P02 | 45min | 3 tasks | 1 files |
| Phase 129 PP03 | 30min | 2 tasks | 3 files |
| Phase 133-verification-live-uat P133-01 | 55min | 5 tasks | 3 files |
| Phase 133-verification-live-uat PP133-02 | 5min | 2 tasks | 2 files |
| Phase 133-verification-live-uat P133-03 | 87min | 3 tasks | 3 files |

## Decisions

| Decision | Context |
|----------|---------|
| Recon before roadmap (Option 2) | Pulled live samples from every source before writing phases; caught CBO/GAO blocking and the obligations-vs-outlays trap before they could derail a phase |
| FY2025 actuals as headline year | Complete, final, sourced; FY2026 FYTD as live strip — partial-year proportions can mislead |
| Function lens default, agency toggle | "What it's for" is the citizen question; ~20 clean categories vs 800-row agency hierarchy |
| MTS/OMB outlays canonical; USAspending drill-down only | $3.3T gap between obligations and outlays; mixing them would corrupt headline figures |
| 6 phases (43–48), recon folded in | Brief's draft Phase A completed pre-roadmap; B–G became 43–48 |

- [Phase ?]: curl execSync for GCC download: Node 24 fetch blocked by Cloudflare TLS; curl with same browser UA returns HTTP 200, zero new deps
- [55-03]: Year-outer/city-inner sweep: downloads each GCC ZIP once for all 34 OC cities — 16 downloads total vs naive 544; sweepOCSalaries.js
- [55-03]: All 34 OC cities covered by GCC 2009–2024; zero gaps; SC-4 Irvine 2024 exact match delta=$0; 544 salaries rows, 313,085 records loaded
- [Phase ?]: SCO county feed carries per-year estimated_population — no --population fallback needed for OC; per-year denominators (2.98M-3.15M FY2003-2024) more accurate than LA single-year hardcode
- [Phase ?]: loadCountyBudget.js generalizes LA County one-offs into one parameterized script (D-07); is the runbook Step 5 tool for any future CA county budget load
- [Phase ?]: ACFR cross-check FY2010: SCO all-governmental-funds 3.007B vs ACFR gov-activities approx 2.35B; delta is documented variance (all-funds basis includes internal service + proprietary funds)
- [Phase ?]: County SourceChip separate block from federal controls to prevent regression
- [Phase ?]: EV-Accounts data_source_info follow-up: API returns null for county/city rows; needs to construct from source_url/source_date/data_source columns
- [58-01]: Calabasas (FY2004+) and Sierra Madre (FY2006+) are genuine SCO source gaps — both cities excluded from SCO FY2003 feed; 86 of 88 LA County cities reach FY2003
- [58-01]: Long Beach FY2022 operating corrected from $634M to $4,249M by re-sync — prior value was an earlier partial SCO load; all-governmental-funds is the correct basis
- [58-01]: 37 remaining NULL source_url are non-SCO custom rows (LA Socrata/Payroll, LB GF, WeHo Demand Register) — out of scope for SCO loader; SCO-source NULL = 0
- [58-04]: 4/4 sampled cities (Burbank, Glendale, Pasadena, Santa Monica) reach FY2003 with /d/ source_url; population non-zero for per-capita
- [58-04]: County entity 44 op+rev rows FY2003-2024; NULL=0; FY2024 $37.577B op / $39.322B rev confirmed; salaries 5 rows + 88 cities all unchanged
- [58-04]: 3 custom cities byte-for-byte unchanged: LA FY2024 op $19,974.3M (Socrata), LB GF FY2025-2026 intact, WeHo Demand Register 9 rows intact
- [58-04]: Basis note gating confirmed by code inspection — cityBasisNotes map has exactly 2 keys (Long Beach|CA, West Hollywood|CA); all other entities return null (no render)
- [58-04]: Formal ACFR reconciliation, source-chain audit, and Chris UAT deferred to Phase 62 (D-09 honored)
- [Phase ?]: FY2023 selected as ACFR reconciliation year; government-wide Statement of Activities is basis-matched comparator
- [Phase ?]: Glendale + Burbank ACFRs inaccessible via free CLI (CDN blocks); FOLLOW-UP per D-08; SCO source-loop + Phase 60 /usr/bin/bash-delta corroboration documents presumptive PASS
- [Phase ?]: signoff-all-pass: all 24 UAT checklist items PASS (Chris, 2026-06-17); VER-04 satisfied
- [Phase ?]: Employees card is year-gated (App.tsx availableDatasetTypes); year=2003 hides salaries tab for FY2009-2024 cohort — correct behavior confirmed UAT
- [Phase ?]: D-08 UX flag: show Employees card for any year salaries exist + prompt year switch (v2.4 candidate, not fixed in phase 62)
- [Phase ?]: Towns stored with BARE display names — zero town/city collisions; 6 town/county overlaps (Bedford, Culpeper, Orange, Pulaski, Tazewell, Wise) safe because counties carry County suffix
- [Phase ?]: Exhibit A town population fallback: col4=name col2=population section-scoped No.-reset; fires only when Exhibit H returns null; cities/counties unchanged
- [Phase ?]: 3 towns absent from ALL published XLSX years (Big Stone Gap, Clifton Forge, Vinton) - documented source gaps, no phantom municipalities; future re-run picks them up idempotently
- [81-02]: Virginia state node pre-existed with prior General Fund budget data (10 rows, source_url=null); seeder returns existing node idempotently; pre-existing data left untouched (different source, no never-overwrite conflict)
- [81-02]: Warren County absent from Phase 80 load (93/95 counties); Front Royal skipped in seeder; vaTownCounties.json has correct entry for auto-link on future re-run
- [81-02]: 33 VA towns linked to parent county via county_id; 4 skipped (3 towns not in DB, 1 county not in DB); idempotent re-run confirmed 0 writes
- [81.5-01]: Benevity = exactly 1 recurring supporter (Chris Andrew's Cisco company-match, 61 rows, 1 donor) — hard rule with code comment; excluded from median
- [81.5-01]: Lean carrier for micro-donation aggregates: item_count + description JSON (_evMicro namespace) on Donations category; no backend schema change, frontend parses in Plan 81.5-02
- [81.5-01]: FY2026 reconciled: 9 supporters (3 GB + 5 Patreon + 1 Benevity), median $10/mo, persisted item_count=9
- [Phase ?]: [85-01]: enumerateCities uses revTotalCol OR expTotalCol (either finite) to skip blank/footer rows — handles rows where one total column may be zero
- [Phase ?]: [85-01]: GAAP→CASH→MOD Map-based assignment: first basis whose workbook contains the city wins; FY2024 dry-run: 245 cities (235 GAAP + 7 CASH + 3 MOD), zero writes, zero failures (D-02)
- [Phase ?]: [85-02]: Zero cross-FY residual across FY2016-2025 — every OI_Demographics city has financial rows; ohioCityResidual.json cities=[] is the durable no-phantom record
- [Phase ?]: [85-02]: FY2025 workbook is preliminary (196 GAAP cities vs ~235-244 in prior years) — loaded as-is per audit completion timing; partial FY noted
- [Phase ?]: Rule 1 bug fix: CASH/MOD county workbooks omit County suffix; normalised in batch driver
- [Phase ?]: [86-02]: Allen County consistent source-gap residual FY2016-2025 — documented in ohioCountyResidual.json, not created as municipality
- [Phase ?]: [86-02]: Ohio state node has pre-existing General Fund data (10 rows, different source) — preserved by never-overwrite guard per VA 81-02 precedent
- [Phase ?]: [86-02]: 249/253 OH cities linked to county via workbook OI_Demographics County column; 4 link-residual (Delphos+Lima=Allen County not loaded, Germantown+Ironton=absent from workbook)
- [86-04]: County GAAP layout is headerRow=6/expTotalCol=32 (not city's row-7/col-35); county CASH/MOD has entityCol=1 (not city CASH's 2); detectLayout gains entityType arg defaulting to 'city'
- [86-04]: Allen County was in the workbook at row 7 (first data row) all along — dropped because city layout misread it as the header row; 64 GAAP counties now enumerated; Franklin County rev=$1,811,422,000 (col 16) / exp=$1,913,193,000 (col 32)
- [Phase ?]: LSC URLs used for OH state-node source stamp; seedOHState.js Step C changed to direct data_sources table query (RPC truncates at 1000 rows)
- [Phase ?]: [88-02]: 4 OH population=0 entities fixed (Ironton+3 counties) from 2020 Census P.L. 94-171
- [Phase ?]: pdftotext -table mode works cleanly for Ohio ACFR two-page spread; all 12 checksums 0 diff
- [Phase ?]: FY2022 OH Investment Income -570453k net loss: P2 clamp applied in revenue loader; audited total 44323336k carried verbatim
- [95-05]: Per-state keep-windows enforced: OH_KEEP=[2020..2025] (6 years), VA_KEEP=[2022..2025] (4 years) — a shared window would have wrongly deleted Ohio FY2020/FY2021 actuals
- [95-05]: 4 OH/VA FY2026 estimate rows (lsc.ohio.gov + dpb.virginia.gov false-provenance) deleted; 4 data_sources rows corrected to ACFR landing pages; all 4 DB probes PASS; idempotent
- [Phase ?]: CO Transportation GF = 1M not zero per NASBO Table 21
- [Phase ?]: 102-02 cohort audit
- [Phase ?]: 107-03: All 10 roster states IN (0 deferred); MA in-place upgrade (no stale data_sources); GA F-97-01 superseded cleanly; NJ=dollars not thousands; MI=September-30 FY-end custom loader
- [Phase ?]: Rank-correction substitution: Oklahoma (weakest named ACFR candidate, actual NASBO rank 14/31) substituted for Alabama (rank 9, next-largest un-upgraded state) per D-01; one round only, OK carried to ACFRX-03 with recon preserved
- [Phase ?]: All 10 locked-roster ACFR states + Alabama substitute confirmed clean NASBO-only nodes via read-only DB probe (zero data_sources residue) — no in-place-upgrade plan needed anywhere in tranche 3, simpler than Phase 107
- [Phase ?]: Alabama's ACFR General Fund is ~0.24x its NASBO GF (narrowest divergence in the v2.14 tranche) due to its constitutional GF/Education-Trust-Fund dual-budget split; flagged as a Phase-114 load-time decision, not resolved in recon
- [Phase 114-01]: SC's printed statement puts a single 'Taxes:' header ahead of ALL revenue lines (confirmed all 24 years) -- fixed via a new gen_state.py rev_boundary config option rather than hand-authoring category names
- [Phase 114-01]: Loaded the full FY2002-FY2025 SC window (24 years) with zero honest holes -- every year tied exactly on first extraction pass
- [Phase ?]: FY2023 KY ACFR PDF has no ToUnicode CMap on any embedded font (garbles the whole document) -- omitted as honest hole, distinct from FY2002's OCR-scan case where the numeric table still extracted cleanly
- [Phase ?]: extract_gf.py pending-prefix accumulator fixes two-line wrapped category labels generically (KY discovered it, reusable for future states)
- [Phase ?]: KY's ~1.09x near-parity vs NASBO matches IN's mechanism: Federal reported through a separate major fund column, not consolidated into GF
- [Phase 114-03]: UT GF-alone scope decision (ACFR-31): loaded the printed General Fund column alone, not a GF+Income Tax Fund composite -- the tranche's one narrower-than-NASBO state (~0.83x-0.91x), driven by the Amendment G constitutional income-tax earmark in a separate major fund
- [Phase 114-03]: UT gen_state.py default_rev_name generalized to pluralize a label already ending in singular Tax (e.g. Sales and Use Tax -> Sales and Use Taxes) instead of appending a redundant taxes suffix -- reusable fix
- [Phase 114]: AL GF-alone scope decision (ACFR-31): loaded printed General Fund column alone, not GF+Education Trust Fund composite -- 0.24x narrower than NASBO (tranche's narrowest), corroborated by GF+ETF ~1.04x NASBO (constitutional dual-budget driver)
- [Phase 114]: gen_state.py generalized with fy_end + fiscal_year_start_month config options (MI Sep-30 precedent) for AL rather than a bespoke loader -- reusable for future non-June-30 states
- [Phase 114]: LA GF-alone (ACFR-31): ~1.90x NASBO divergence driven by ~99% federal Intergovernmental Revenues in the GF; own-source state taxes booked entirely to the separate Bond Security & Redemption Fund column -- unique structural driver in the tranche
- [Phase 114]: extract_gf.py generalized with a position-anchor/first-cell fallback for non-uniform pdftotext -table alignment (LA FY2003-2005) and a whitespace-tolerant statement-header regex (LA FY2016-2019) -- zero regression on 96 already-loaded SC/KY/UT/AL state-years
- [Phase 114]: gen_state.py generalized with smart_title() ALL-CAPS source-label title-casing and a Current/Intergovernmental expenditure-subsection disambiguation rule -- both discovered by LA, reusable for future states
- [Phase 115]: NJ has no pre-GASB-34 boundary -- FY2002 (its first ACFR year) is the archive's edge — NJ adopted GASB 34 in FY2002 itself, so all 18 candidate years FY2002-2019 use the modern statement format and all tie exactly
- [Phase 115]: Kept NJ loaders' embedded-data architecture rather than converting to CT-style runtime parsing — Guarantees zero risk to already-loaded FY2020-2025 rows; newly-recovered years extracted once via the shared parser, verified tied, then embedded as static data
- [Phase 115-02]: pre34Extract.mjs (position-anchored) ties all 14 CT pre-34 years exactly; WI 2000-2001 within TOL; CT FY2006 recovered via free OCR — Zero honest holes in CT/WI deepening; OCR cross-verified row-by-row against printed row totals
- [Phase 115-03]: FY2001 recovered by widening pre34Extract.mjs lookahead window (superset, zero CT/WI regression); FY2002/04/05 dot-leader corruption left as honest hole after abandoning an unsafe bounded-heuristic extractor
- [Phase 116]: MA FY2014 title-anchor bugfix + both pre-flagged rounding-note candidates (WI FY2001, MA FY2014) tied exact $0 — Harness whitespace-tolerant title regex fix; loadlog rounding notes were internal loader printed-vs-line-sum reconciliation, not printed-vs-stored discrepancies
- [Phase 116-02]: INV-6 label regex accepts both ACFR and CAFR (case-insensitive) since pre-GASB-34 rows honestly carry the era-correct CAFR term
- [Phase 116-02]: KY FY2023 modeled as a documented exception in INV-6 (allows 1 NASBO-labelled row) and INV-11 (operating includes FY2023, revenue excludes it)
- [Phase 116-02]: LOAD-01 proven end-to-end: SC + CT FY2025 re-run via guarded treasury_sync_budget_tree = 0 net change, 0 data_sources residue with no manual re-clean
- [Phase ?]: Iowa revenue tree total resolves to NET REVENUES (gross minus Less revenue refunds contra), not gross
- [Phase ?]: Iowa FY2008 omitted as honest hole -- RC4-encrypted PDF, zero-length text extraction on pdftotext and pypdf, no OCR/qpdf tooling available (KY FY2023 precedent)
- [Phase ?]: gen_state.py default_exp_name() generalized with a Capital Outlay dual-subsection disambiguation rule (LA Intergovernmental precedent), reusable for future states
- [Phase 119]: KS: loaded full FY2019-2025 window, zero honest holes; extract_gf.py wide-layout position-anchor (CO/MO precedent) isolated the 8-column General column with no code changes
- [Phase ?]: [119-03]: ME window narrowed to FY2002-2025 (24yr, not the recon's aspirational FY2000-2025 26yr) -- FY2000/FY2001 are pre-GASB-34 COMBINED-statement years with no distinct General column; extract_gf.py correctly reported 'statement not found' rather than mis-transcribing
- [Phase ?]: [119-03]: ME June-30 FY-end confirmed on all 26 downloaded covers (not just recon bookends) -- the pre-recon 'non-June to watch' flag is fully resolved with full-window evidence
- [Phase 120-01]: NE ACFR GF ~1.19x NASBO GF (smallest divergence in Batch 3) accepted and relabelled honestly — NE General Fund is ~91% own-source (Income Tax + Sales/Use Tax); federal flows post to a separate Federal Fund column, not General
- [Phase 120-01]: extract_gf.py generalized: U+FFFD treated as a DASH_TOKEN — Fixes a silent column-shift bug on PDFs (NE FY2024) that render blank GF cells as an invalid UTF-8 byte (0xAD soft hyphen) instead of ASCII dash
- [Phase ?]: NH ACFR GF ~3.22x NASBO GF (widest divergence in Batch 3) accepted and relabelled honestly -- Federal Government (48%) + Special Taxes consolidated into GAAP General column
- [Phase ?]: NH fetched via Wayback Machine mirror (CDX API timestamp resolution + if_ modifier URLs) rather than browser-download -- das.nh.gov/www.das.nh.gov Akamai-blocks all automated fetch, harder than tn.gov precedent
- [Phase ?]: NM ACFR GF ~3.06x NASBO GF accepted honestly -- federal passthrough (38% of GF) plus own-source oil/gas royalties (Rentals and Royalties $5.35B FY2024) both consolidated into the GENERAL FUND column
- [Phase ?]: NM FY2020/FY2021 left as an honest gap -- only DFA's own narrower single-agency 341 filings found for those years, not the statewide 341-A ACFR
- [Phase ?]: NM FY2022 image-only statement page hand-transcribed from Phase 117's already-rendered PNGs, independently re-summed to $0 diff, confirming the recon's own hand-verification
- [Phase ?]: NM FY2023 opaque filename discovered live via a Wayback CDX directory-listing crawl of the known 2024 upload folder -- reusable pattern for unlinked-landing-page opaque-slug states
- [Phase 120-05]: ND ACFR GF ~1.57x NASBO (mildest divergence in Batch 3) accepted and relabelled honestly -- own-source Sales/Use + Oil/Gas/Coal taxes dominate GF; federal booked to separate Federal column
- [Phase 120-05]: UNITS=1 dollars hard-set for ND (the ND units trap) -- both bookends dollar-exact confirmed
- [Phase 120-05]: FY2021 -nd filename suffix exception special-cased in SOURCES map (2021-acfr-nd.pdf) rather than assumed derivable
- [Phase 121-01]: extract_gf.py flat() fix generalizes letter-spaced total-row label detection (OK FY2013 discovered it), zero regression across cohort
- [Phase 121-01]: OK FY2019 hand-transcribed from rendered PNG (image-embedded statement table, no text layer), re-summed to $0 diff, NM FY2022 precedent
- [Phase 121-01]: OK ACFR GF ~3.35x NASBO GF (widest in Batch 4) accepted and relabelled honestly -- Federal Grants consolidated into GENERAL column
- [Phase 121-03]: extract_gf.py generalized to match singular 'Revenue:'/'Total Revenue' statement labels -- SD is the first cohort state with singular labels; safe superset, zero regression on the plural-labeled cohort
- [Phase 121-03]: SD 9-year whole-document-scanned/unrenderable PDF hand-transcription (2003-2011 excl. 2002) generalizes the IA FY2008 single-year precedent to a systematic multi-year pattern
- [Phase 121-03]: SD ACFR GF ~1.03x NASBO GF (smallest divergence in the entire v2.15 milestone) -- federal-passthrough revenue routes to non-GF fund columns, keeping GF near-parity
- [Phase 121-04]: VT ACFR-51: UNITS=1 dollars hard-set; extract_gf.py split_row() generalized for zero/one-whitespace dot-leader defect (VT FY2024/2025), zero regression vs ND/SD/MT/NE; ~1.01x near-parity vs NASBO (smallest divergence in Batch 4); FY2023/FY2024 NASBO replaced in place
- [Phase ?]: WV: rev_boundary='Intergovernmental' clears the single 'Taxes:' header (SC/MS/MT precedent); zero hand-patches, all 6 FY2020-2025 years tied exactly on first pass
- [Phase ?]: WV ACFR GF ~3.52x NASBO GF (2nd-largest in Batch 4) accepted and relabelled honestly -- Intergovernmental federal-passthrough ~47% of GF plus nearly all state taxes consolidated into General
- [Phase 121-06]: WY ACFR GF ~2.43x NASBO GF driven by an unusual DUAL mechanism -- Investment Income (largest single GF revenue line, $1.41B FY2025, Permanent Mineral Trust Fund earnings) PLUS Federal ($1.11B) both consolidated into the General column, distinct from every other Batch-4 state's single-driver divergence
- [Phase 121-06]: WY's FY2020 URL is absent from the 117 recon's own SOURCES enumeration (jumps FY2019->FY2021) -- discovered live off sao.wyo.gov/publications/ during the load, no honest hole resulted
- [Phase 121-06]: WY colon-less 'Taxes'/'Current'/'Debt Service' subsection headers (3rd instance of the VT precedent in this cohort) fixed via a dedicated wy_assemble.py post-process pass -- labels only, all 21 years re-verified tying identically before/after
- [Phase 121-06]: MILESTONE: Wyoming (ACFR-53) was the final state -- all 50 US states now carry a State-ACFR-sourced General Fund (revenue-by-source + spending-by-function), completing Batches 1-4 (Phases 118-121) ahead of Phase 123 (NASBO Retirement) and Phase 124 (Verification+UAT)
- [Phase ?]: [Phase 124-01]: ID FY2004's ~$22/$29 rounding delta is EXPLAINED (verbatim per the 118-05 loadlog's own documented mixed-unit whole-dollar/thousands normalization), not fixed -- pre-approved loader rounding artifact, not a transcription defect
- [Phase ?]: [Phase 124-01]: IA's NET REVENUES tie is re-keyed directly from the printed NET REVENUES row rather than recomputed as GROSS minus refunds -- the printed statement already bakes in that arithmetic
- [Phase ?]: [Phase 124-01]: OCR-independent checks (NM FY2022, OK FY2019, SD FY2007/FY2010) render+OCR the source PDF fresh every harness run rather than reusing prior PNG renders, to keep the independence claim auditable
- [Phase ?]: [Phase 124-01]: VER-09a result -- 149/151 loader-independent re-derivation checks tie exact $0 across all 21 v2.15 final-tail states + the exhaustive 24-state-FY CA/FL deepening set; 2 explained (ID FY2004 rounding)
- [Phase 124-02]: Fixed a PostgREST 1,000-row pagination gap in the cohort audit before it could corrupt invariants (cohort now totals 1,560 rows, exceeding the default cap)
- [Phase 124-02]: INV-2 allowlists the one documented CA persistent data_sources registry row (ca-acfr-gf-operating) per 122-03-DEEP05-CLOSEOUT.md rather than flagging it as WR-05 residue
- [Phase 124-02]: loadStateGF.mjs --dry-run cannot exercise the isAcfrOccupied guard (returns before the DB read) — verified the guard instead by applying it directly against live data, confirming 0 intended writes to any of the 50 ACFR nodes
- [Phase 124-03]: VER-10 live-app UAT — Chris signed off 12/12 anchors PASS (2026-07-05), 0 defects fixed in-phase; closes the v2.15 human capstone (all 50 states on ACFR)
- [Phase 125]: Federal target string used verbatim as confirmed byte-for-byte by essentials repo (browse_federal_officials=1&browse_label=United+States)
- [Phase 125]: strip() (trailing County / , ST) + normalizePlace() applied identically to entity name and catalog label -- state equality alone disambiguates Washington County OR vs UT
- [Phase 125]: Cross-repo deferral note upgraded from pending to RESOLVED after a live smoke test proved both Essentials-side deliverables (coverage.json+CORS, federal browse route) are already live on production
- [Phase 126]: Registry mirrors Essentials fixed order [essentials, compass, readrank]; only essentials live, compass/readrank always resolve null (reserved, no placeholder icons)
- [Phase 126]: Icon chips always use the -light SVG symbol on a semi-transparent navy chip in both TT themes, no theme branching on the symbol
- [Phase 126]: A covered city/county with no geoid resolves to null (no icon) this phase; flagged for Phase 127 UAT to revisit a label-only fallback
- [Phase 126]: Suppressed a react-hooks/refs (eslint-plugin-react-hooks v7 compiler rule) false positive on @floating-ui/react's refs.setFloating with a scoped eslint-disable-line
- [Phase 129-01]: Pinned real Census Vintage 2024 populations (Tucson 554013, Pima County 1080149) via live curl to www2.census.gov CSVs, not the ~542k/~1.06M planning-doc placeholders
- [Phase 129]: [129-02] toBudgetTree() i[]-multi-item recipe (not further c[] nesting) confirmed against 4 loaders + live _treasury_insert_tree contract as the correct 2-level RPC-write pattern — Matches processPortland.js/loadFederalAgencies.js precedent; plan's D-08 wording followed literally
- [Phase 129]: [129-02] Live load complete: 20/20 Tucson budgets rows (10 FY x operating+revenue), independent re-derivation ties 128-RECON.md printed totals at exact $0, idempotent (0 net change on re-run), 0 data_sources residue — processTucson.js via treasury_sync_budget_tree; py -3 used instead of python (env quirk)
- [Phase ?]: 129-03: Tucson operating tree's drill-down leaves live in budget_line_items (i[] recipe), not depth-1 budget_categories; enrichment worklist derives from the 15 depth-0 keys (true 100% of what is enrichable) -- no schema change
- [Phase 133-01]: Generalized OV label-quirk disposition to a value-based pairing (not hardcoded strings) so it catches both the pdftotext glyph-split rendering and a source-PDF typo without weakening the harness's independence claim
- [Phase 133-01]: D-04 reachability check broadened to accept Wayback-CDX-corroborated historical 200/application-pdf snapshots for documented WAF-blocked origins that return a non-403 anti-bot response (South Tucson returned a soft-404)
- [Phase 133-verification-live-uat]: PIMA-09 tether verdict: all 4 new Pima munis (Oro Valley, Marana, Sahuarita, South Tucson) COVERED on live Essentials coverage.json — Essentials v22.0 deep-seeds already publish city records for all four with correct Census GEOIDs; no cross-repo gap, no TT code change needed
- [Phase 133-03]: Corrected 133-UAT-CHECKLIST.md total_scenarios from 24 to 34 (actual full scenario count across sections A-G) before recording Chris's all-pass sign-off

## Deferred Items

Carried forward from v1.7–v1.9 (see Known Tech Debt above). New in v2.0 planning:

| Category | Item | Status |
|----------|------|--------|
| data | CBO program descriptions as explainer source | cbo.gov bot-blocks; manual download workflow if needed |
| feature | Votes/amendments exploration hub | Future milestone — the eventual mission destination |
| feature | Sourcing backfill to cities/states | After the standard is proven federally |
| milestone | **Historical backfill — prior fiscal years (FY2024 ← back) at v2.0 detail** | RECOMMENDED NEXT (Chris asked 2026-06-12). Cheap parts already done: annual_summary already holds 64 years (FY1962+); explainers (name_key-keyed) + program origins (law-keyed, not year-keyed) are year-independent and need ZERO rework. Real work = iterate the OMB loader (Hist 3.2 outlays-by-function, 4.1/5.1 by-agency) across prior years + recompute per-year visual-vs-official disclosures + revenue-by-source per year + YearSelector wiring. Watch: function/agency definitions drift over decades (comparability notes); per-year actuals vs estimates. Same free sources + same loader pattern as 44. |

### Acknowledged at v2.12 close (2026-07-01)

Open-artifact audit at v2.12 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.12 blockers — Phase 106 verified the whole milestone end-to-end (VER-03 independent re-derivation 24/24 exact + cohort audit 7/7; VER-04 Chris live-app UAT 8/8 all-pass); all 8 v2.12 requirements Complete:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 106 `106-UAT-CHECKLIST.md` | passed — 0 pending scenarios (Chris signed off 8/8 2026-06-30, status:passed frontmatter set) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | deferred — signed-in users hit an unrecognized deep-link get sent to their home city; frontend-routing follow-up (canonical `?entity=` links fixed; deeper UX logged) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.12 |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.12 |

**v2.12 follow-ups (documented, not fixed):** authenticated deep-link redirect UX smoothing (todo above); Phase-104 deepening holes (NY ≤FY2002, CA FY2002–2007, FL ≤FY2020) intentionally absent-by-design (recorded + honest in UI, verified PASS by D-06); 105 code-review non-blocking items WR-01/03/04/05 (clamp root-vs-child invariant, validate() tolerance, `strict:false` arg parsing, non-atomic `data_sources` upsert — the WR-05 pattern re-created 2 residue rows during 106 idempotency re-runs, cleaned in-phase); next-tranche NASBO→ACFR upgrades (ACFRX-01/02, future milestone).

### Acknowledged at v2.5 close (2026-06-20)

Open-artifact audit at v2.5 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.5 blockers — Phase 73 verified the whole milestone end-to-end (UVER-01 ACFR recon + source-chain audit, UVER-02 Chris UAT all-pass):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 73 `73-03-UAT-CHECKLIST.md` | 0 pending scenarios (flagged only because the file lacks status frontmatter; UAT signed off all-pass 2026-06-20, recorded in 73-03-SUMMARY + 73-VERIFICATION) |
| verification_gap | Phase 71 `71-VERIFICATION.md` | `human_needed` — salaries human-UAT flag; functionally satisfied by Phase 73's all-pass UAT (which exercised salaries). Stale flag. |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to Utah |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to Utah |

**v2.5 follow-ups (from Phase 73, D-73-07/08 — documented, not fixed):** 4 pre-existing non-P72 `$`-leak universal enrichment rows (2026-03-28 origin: parking meter, harbor/port, sewer, solid waste enterprise fund) — bleed-safety cleanup; Salt Lake County FY2025 salaries (1 absent combo, fills on next FY2025-complete rollup refresh).

### Acknowledged at v2.7 close (2026-06-23)

Open-artifact audit at v2.7 close surfaced 6 items, all non-blocking and acknowledged (deferred). None are v2.7 blockers — Phase 83 verified the whole milestone end-to-end (VAVER-01 ACFR recon + source-chain audit, VAVER-02 Chris UAT all-pass); all VA requirements Complete:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 81 `81-HUMAN-UAT.md` | resolved — 0 open scenarios |
| uat_gap | Phase 81.5 `81.5-HUMAN-UAT.md` | resolved — 0 open scenarios |
| uat_gap | Phase 83 `83-03-UAT-CHECKLIST.md` | 0 open scenarios — flagged `unknown` only because the checklist lacks status frontmatter; Chris signed off all-pass 2026-06-23 (recorded in 83-03-SUMMARY + 83-VERIFICATION) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to VA |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to VA |

**v2.7 follow-ups (from Phases 80/83 — documented, not fixed):** 6 localities absent in ALL published XLSX years (cities Colonial Heights/Emporia/Hopewell/Norton; counties Lee/Warren — multi-year-overdue audits) + Covington/Alleghany null population (FY2024 school-consolidation footnote) — picked up idempotently on a future re-run; 3 towns absent from all XLSX years (Big Stone Gap, Clifton Forge, Vinton).

### Acknowledged at v2.10 close (2026-06-29)

Open-artifact audit at v2.10 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.10 blockers — Phase 97 verified the whole milestone end-to-end (SGFS-05 cohort source-chain audit + "Representative 7" reconciliation + Chris UAT 21/21 all-pass); all 5 SGFS requirements Complete:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 93 `93-UAT-CHECKLIST.md` | passed — 0 open scenarios (v2.9, already shipped) |
| uat_gap | Phase 97 `97-UAT-CHECKLIST.md` | passed — 0 open scenarios; status:passed frontmatter added at close (Chris signed off 21/21 2026-06-29) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.10 |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.10 |

**v2.10 follow-ups (from Phase 97 — documented, not fixed):** cohort revenue-by-source (NASBO has none per-state → future per-state ACFR upgrades for high-traffic states, the OH/VA path); MN FY1997–2007 history + the MN FY2008 operating $8.79M categorization gap (0.055%, needs FY2008 ACFR re-extraction); minor frontend `?dataset=revenue` URL robustness on operating-only nodes (normal navigation unaffected).

### Acknowledged at v2.2 close (2026-06-16)

Open-artifact audit at v2.2 close surfaced 4 items, all non-blocking and acknowledged (re-deferred). None are v2.2 blockers — all phases 52–57 have VERIFICATION files and the milestone audit PASSED 16/16:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 57 `57-HUMAN-UAT.md` | passed — 0 pending scenarios (flagged only because the file exists; UAT signed off) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, also acknowledged at v2.0 + v2.1 close |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview effort; see untracked scripts/_verify-longview-temp.mjs |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview effort |

### Acknowledged at v2.3 close (2026-06-17)

Open-artifact audit at v2.3 close surfaced 4 items, all non-blocking and acknowledged (re-deferred). None are v2.3 blockers — Phase 62 verified the milestone end-to-end (VER-03 + VER-04, 4/4):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 62 `62-03-UAT-CHECKLIST.md` | 0 pending scenarios (flagged only because the file exists; UAT signed off all-pass 2026-06-17) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at v2.0/v2.1/v2.2 closes |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview effort |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview effort |

**v2.4 follow-ups (from Phase 62, D-08 — documented, not fixed):** Glendale + Burbank ACFR reconciliation via manual browser download (CDN blocks CLI); the "Employees" salaries-card year-gating UX (show whenever salaries exist for any year + prompt year switch); the 5,226 single-city salary department-name canonicalization long tail (from Phase 61).

### Acknowledged at v2.0 close (2026-06-13)

Open-artifact audit at milestone close surfaced 5 stale/orphaned items, acknowledged and deferred (none are v2.0 blockers — all phases 43–48 have complete VERIFICATION files):

| Category | Item | Status |
|----------|------|--------|
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — unrelated to v2.0 federal work |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview effort; see untracked scripts/_verify-longview-temp.mjs |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview effort |
| uat_gap | (unnamed) | empty/orphaned entry — no v2.0 UAT gap (Phase 48 UAT signed off) |
| verification_gap | (unnamed, human_needed) | matches pre-existing Phase 07/14/22/25 human_needed debt (shipped milestones) |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
