# Milestones — Treasury Tracker / Empowered Vote Financials

> ⚠ **v2.21 through v2.25 have no GSD phases.** All ran on `docs/superpowers/` specs + plans
> rather than `/gsd-plan-phase`, so their unit of work is a numbered **task**, not a phase,
> and there are no `.planning/phases/` directories or `milestones/vX.Y-*` archives for them.
> Phase numbering stops at **137** (v2.20); a future GSD-phased milestone continues from 138.
> The v2.21 and v2.22 entries were written on 2026-08-15, after the fact.
>
> ⚠ **v2.20 is missing from this file too** — a pre-existing gap, not created here. It *was*
> a GSD-phased milestone (135–137) and it *is* in `ROADMAP.md` and archived to
> `milestones/v2.20-*`; it simply never got a write-up here at its close. A pointer stub sits
> in sequence below so the ordering does not read as "v2.20 never happened", but it is a
> pointer, not a summary — the archive is the record.

## v2.31 NC-DURHAM-AVL-01 — Durham, Asheville, and the report that is not the county's (Shipped: 2026-08-24, UAT pending)

**North Carolina's first LOCAL entities.** The state had only its state node. 116 General
Fund rows across four governments — City of Durham FY2009–24 (32), Durham County FY2005–25
(42), City of Asheville FY2021–25 (10), Buncombe County FY2008 + FY2011–25 (32) — all GAAP
actuals, all whole dollars, all tying at exactly $0.

⚠ **The guard this milestone exists for was WRONG on its first version, and the fixture
proved it.** Buncombe County and the Buncombe County **Board of Education** each publish an
ACFR. The schools' FY2024 report is a genuine 137-page PDF saying "Buncombe County" and
"June 30, 2024" on its cover, and it outranks the county's own report in search. Magic
bytes, byte size, page count and the fiscal-year check all pass on it. A guard that required
the issuer's name and forbade the neighbour's **accepted the impostor** — "Buncombe County
Board of Education" *contains* "Buncombe County", and because every real county ACFR names
its school board as a component unit, the exception that stopped the guard rejecting all 16
real years is exactly what let the fake one through. A cover-page rule fails too: **21 of 58
reports have an image-only page 1**. What holds is POSITIVE EVIDENCE OF AUTHORSHIP — an
any-of governing-body marker, measured across all 58 files. Counties say *county manager*;
cities say *mayor*; a school board says *superintendent*.

⚠ **A SIGN FLIP in shipped code.** Asheville FY2022 emits its negative investment earnings
as two words 0.1pt apart — a lone `(` then `372,058)` — and the merge rule required every
fragment to contain a digit, so `parse_money` returned **+372,058 for a printed (372,058)**.
It surfaced only because the components then over-summed by exactly twice the figure. Had
that row been last, it would have shipped inverted. Colorado was re-verified rather than
assumed after the fix.

The reader is chosen **per entity on a diagnosed cause**, never per year by which one tied —
that is curve-fitting, the LA-01 error. Durham County reads by glyph coordinates because
`-table` renders its General Fund column at two character offsets in FY2006–11 (FY2008's
four dropped rows sum to 8,630,391 = its exact tie delta); Asheville because FY2021–22
letter-space every glyph on the page.

**Gates:** `npm test` 616/616 · `npm run build` clean · `acfrGF.selftest.py` 166/166 ·
`verify-colorado.mjs` 64 rows / 58 corroborated ALL PASSED · 116/116 rows tie at $0 ·
both partition gates green, table total 87,726 → 87,842 (exactly +116).

Closeout: `docs/superpowers/plans/NC-DURHAM-AVL-01-CLOSEOUT.md`.

---

## v2.30 SCOPE-04 — Derived Total Governmental, and the enterprise slice (Shipped: 2026-08-22, tag `v2.30`, UAT ✅ 2026-08-23)

**488 California entities gained a second, honestly-labelled fund scope.** 7,650 derived
Total Governmental rows, so a reader can see how much of a "city budget" is the tax-funded
government and how much is its utilities. Modesto FY2024: All Funds **$588.0M** → Total
Governmental **$291.6M**, the difference being $296.4M of water, sewer, solid waste, airport
and internal service funds. **50.4% of Modesto's "city budget" is not the tax-funded city.**

`TG = Σ governmental roots`, never `all_funds − enterprise` — algebraically identical here,
but immune to enterprise-side defects. Classification is a NEGATIVE match, so the loader
commits the 51-name era-B vocabulary and **refuses to derive on any unrecognised root**.

Every derived figure declares itself three ways: `derivation='derived'` (a new column,
DEFAULT `'published'`, so no existing row was rewritten), the inert label *computed by
Treasury Tracker*, and a disclosure naming what the scope excludes.

⚠ **The scope caveat, disclosed rather than hidden.** `derived_TG` is the State Controller's
governmental scope, which is NOT identical to an ACFR's "Total Governmental Funds" — the two
differ by redevelopment successor-agency funds. Proven at Napa FY2017 to the dollar
(`97,277,497 − 18,524 + 79,307 = 97,338,280`). Both figures are individually correct, so no
arithmetic gate can surface it. Chris's ruling: keep the name, disclose the exclusion. The
magnitude beyond Napa is **unmeasured**, and the copy never claims it is small.

⚠ **The stopping rule was NOT met as written.** It asked for ≥10 assessable city-years;
**1 of 16** was assessed before Chris directed the milestone to the write. Two independent
controls (Cerritos, Lakewood FY2017) tie exactly and Napa reconciles to the dollar, but the
sample is short and the closeout says so.

**Five defects that move no dollar figure**, so no tie test could have caught any:
the figure invariant had been **dead since v2.27** and was unreconstructable (LA-02 deleted
11 rows; 4 of their ids were never preserved) — repaired and rebased with full accounting;
the fund-scope registry would have **un-derived all 7,664 rows** on the next stamper run;
the disclosure copy **had no renderer** and the copy around it said "published" three times;
a **racing paged read invented 27 rows of drift** that did not exist; and
`_treasury_insert_tree` **swaps two amount columns**.

✅ **UAT RUN AND PASSED 2026-08-23 — 8 of 10 tests.** Record:
`docs/superpowers/plans/SCOPE-04-UAT.md`. Deployment was verified live BEFORE testing (the
API answers with `derivation`, the deployed bundle carries the marker, the heading and the
successor-agency sentence), so nothing was blocked. Confirmed from a reader's seat: the
toggle moves Modesto to the dollar ($588,042,068 → $291,641,122 out, $643,894,826 →
$322,089,879 in); the derived series names itself and the heading reads *"Which set of
figures"*; the successor-agency disclosure renders beside the derived figure and only there;
the enterprise slice appears and disappears as six categories (11 roots → 5); Napa FY2017
reads **$97,734,023**, the one derived figure with a printed-ACFR oracle behind it; a county
gap is 11% where a city's is 50%; the deep link carries the choice; **Seattle is unchanged**.

⚠ **The two failures were both found off-script by Chris, and NEITHER was SCOPE-04's own
work.** They were pre-existing paths that SCOPE-04 made REACHABLE by giving 488 CA entities
a second series — before this, nearly every CA entity had one series, so no series had
missing years and no reader could select an uncovered one. **Six defects, five fixed
test-first in PR #54:**

| | what a reader saw | |
|---|---|---|
| G1 | arriving on an Employees link blanked BOTH budget tiles — *"not published in ."* — on **480 CA entities** | fixed `1680ed5` |
| G6 | picking an uncovered year left "FY 2018" on the label while the tiles said the figure was not published and the chart drew nothing — a **stale load stamping state over a newer one** | fixed `fe0b03a` |
| G5 | the year-clamp note **had never rendered once**: the effect cleared the note its own `setSelectedYear` re-run had just set | fixed `fe0b03a` |
| G2 | clicking a leaf dimmed **every** row to 40% with nothing clickable — "the icicle doesn't work" | fixed `5b84bdb` |
| G3 | 36 children of a drilled root in one identical fill, 2 labels legible | fixed `6d21f08` — lightness per child, hue untouched |
| G4 | drilling hides the dataset tabs and the pills; the breadcrumb is the only way back | **open** — deliberate today, a product decision |

⚠ **No arithmetic gate could have found any of the six.** Every figure involved was correct.
What was wrong was *which* figure was on screen, whether the reader was told, and whether the
thing they clicked did anything. Three of the five fixes had to move logic OUT of components
into pure modules first, because this repo can run **no component tests** — a React cleanup
flag would have shipped with no regression guard at all.

Full working: `docs/superpowers/plans/SCOPE-04-CLOSEOUT.md`, `SCOPE-04-RECON.md` and
`SCOPE-04-UAT.md`. API change: EmpoweredVote/ev-accounts#135.

## v2.29 CO-SPRINGS-EPC-01 — Colorado Springs + El Paso County (Shipped: 2026-08-21, tag `v2.29`, UAT ✅ 2026-08-23)

**Tasks completed:** onboarding milestone on a `docs/superpowers/` plan, not GSD phases — closeout: `docs/superpowers/plans/CO-SPRINGS-EPC-01-CLOSEOUT.md`

✅ **UAT PASSED 2026-08-23 — 9 of 9 tests, no defects found.** Record:
`docs/superpowers/plans/CO-SPRINGS-EPC-01-UAT.md`. Both windows draw complete, the figures
match the printed ACFRs to the dollar (Springs FY2024 $422,363,896 out / $371,035,085 in;
El Paso FY2024 $289,511,043 / $308,220,434), no unit error anywhere, the chip names each
entity's own audited report and links to the real PDF, the city nests under its county, and
neither the CO state node nor any out-of-state entity was disturbed.

Two things the UAT settled that the closeout could not:
1. ✅ **The double-encoded em-dash is FIXED** — logged here as pre-existing and global
   (every em-dash label, incl. the 1,448 state-ACFR rows), owed by `C:\EV-Accounts`. Clean
   U+2014 on the wire and on screen. A defect this milestone reported as open is closed.
2. ✅ **The calendar fiscal year IS reader-visible**, via the source chip's
   `as of 2024-12-31`. The Texas-hardcoded fiscal calendar was one of the six defects here
   and it moves no dollar figure; AUSTIN-TRAVIS-01 UAT had to withdraw its fiscal-calendar
   tests as unmeetable, so this is the FIRST time that defect class has been checkable by a
   human — possible only because the city chip started rendering in PR #38, after that UAT.

⚠ Follow-up raised and ACCEPTED rather than fixed: **a missing year is silent about why.**
El Paso offers FY2005 then jumps to FY2009, and a visitor cannot tell FY2006–08 are
documents we decline to parse rather than years never published. Chris's call: acceptable
next to inventing a figure or trusting a statement we cannot read.

**The headline:** Colorado's first **local** entities — 64 General Fund rows of ACFR GAAP actuals. Colorado Springs FY2012–FY2025 (28 rows) and El Paso County FY2005 + FY2009–FY2025 (36 rows), both whole dollars, both on a **calendar** fiscal year. Before this the state had only its state node.

- **🔑 Six real defects found and fixed, four of them tied at exactly $0 while being wrong.** The `$0` tie gate is blind to all four; each needed a different instrument. This is the milestone's substance.
- **🔑 The shared Texas loader hardcoded Texas's fiscal calendar.** Reused as-is it would have stamped a September period end and an October start month onto rows that close December 31 — **no dollar figure changes, so nothing downstream notices**. `state`, `fyEndMonthDay` and `fiscalYearStartMonth` are now **required and cross-checked for mutual agreement**; `txAcfrLoad.mjs` → `acfrGfLoad.mjs`.
- ⚠ **All 27 Colorado Springs links are pdf.js viewer shells** — every one returns HTTP 200 `text/html` from a `.pdf` URL. Assets are *resolved* from the shell, never reconstructed: the files sit under five Drupal conventions, and FY2022+ embed the **upload month**.
- ⚠ **The city's statement title is unmatchable.** It prints its own name down the right margin, so "EXPENDITURES" and "AND CHANGES" are separated by the word COLORADO. Fixed with a `statement_anchor`, with page-by-page proof that **Exhibit 6 — a budgetary-basis budget-and-actual decoy — stays excluded**.
- **🔑 El Paso County defeats BOTH `acfrGF` column strategies**, each confirmed to the dollar: `positional` by a GF column rendered at two character offsets (FY2020's dropped rows sum to its 7,761,496 delta exactly), `ordinal` by the TABOR figure printed *inside* the revenue label (FY2024 delta = 122,194,544 − 4,477,783). **Selecting whichever tied $0 would have been curve-fitting** — the error that got the LA-01 verdict retracted — so a coordinate reader was built instead, and the `-table` readers were kept as cross-checks.
- **New tool: `scripts/acfrGfComponents.py`** reads **every** General Fund component row from glyph coordinates, closing the follow-up v2.27 left open and **unblocking Austin FY2002–FY2009**. It locates the column by an edge derived from two total rows that must agree, and **refuses the page rather than guessing** when they disagree.
- ⚠ **Wrapped TABOR labels published as fragments** (`limitation)`, `$15,174,442`) while the amounts were right and the tie was $0. Fixed with an opt-in weld behind **two** coordinate guards — the second added because the first still fused `Highway user taxes Intergovernmental`.
- **21 of 53 candidate years excluded, every one diagnosed:** image-only scans where `pdftotext` returns *zero* characters (Springs FY1999–FY2011, El Paso FY2000–FY2004 — needs OCR), and El Paso FY2006–FY2008's genuinely different statement, titled "Statement of Revenues **and Changes in Fund Balances**" and split *horizontally across two pages*.

**Verification:** `verify-colorado.mjs` → **64 rows checked, ALL CHECKS PASSED, 58 corroborated by a second implementation.** The two entities are cross-checked in **opposite directions** — each loaded by one reader and checked by the other — and the 6 rows neither `-table` strategy can read are **reported by name, not folded into the pass count**. Regression: `verify-austin-travis.mjs` → **76 rows, ALL CHECKS PASSED**, so the shared-lib refactor moved nothing.

**Tests:** `npm test` **504 passed / 33 files** (16 new) · `acfrGF.selftest.py` **166 passed** · `npm run build` clean.

**Merged:** PR #47 → `main` as `02f93d0`, 22 files, +2,838/−27. Every gate was independently re-run at merge time rather than taken from the PR body.

⚠ UAT was not run at tag time; re-verified 2026-08-23, see above. ✅ The `data_source` double-encoding noted here is **FIXED** upstream in `C:\EV-Accounts` — clean U+2014 on the wire and on screen.

**Archive:** none — not a GSD-phased milestone.

---

## v2.28 LA-02 — LA City's severed history is repaired (Shipped: 2026-08-20, tag `v2.28`)

**Tasks completed:** remediation milestone on a `docs/superpowers/` plan — scoping: `docs/superpowers/plans/LA-02-SCOPING.md`, closeout: `LA-02-CLOSEOUT.md`. **Writes were made to PRODUCTION**, backed up first.

**The headline:** Money In and Money Out both run **FY2003–FY2024 `all_funds/actual` from the CA State Controller — 22 consecutive years, one source, 0 `unknown` rows, 0 NULL `source_url`s, 0 seams.** The UI shows one series and no toggle, and LA no longer appears in the seam report at all.

- **🔑 The bug was a LABEL, not the data.** The rows blamed on `Socrata: data.lacity.org` were never Socrata. Revenue was **always** SCO — the loader re-derived it **dollar-identical 4 of 4 years** — and the operating rows were LA's **FMS appropriation ledger**, a different animal entirely.
- **🔑 FY2026 counted $4.77B of TRAN activity alongside itself.** Tax and Revenue Anticipation Note proceeds are *borrowing*, not spending; they inflated the figure by 16.5%. FY2025 and FY2026 **withdrawn**.
- ⚠ **SCO publishes through FY2024, and nobody had checked.** That one unverified assumption bounded the entire repair. Re-checked 2026-08-21: **SCO has zero FY2025 rows for any entity** — never backfill FY2025 from the ACFR, it would re-create the seam.
- **🔑 An earlier "Socrata IS all_funds" verdict was CURVE-FITTED and retracted** (PR #39) before this work could build on it.
- **The audit found the mislabel is LA-only** — 0 portal labels anywhere else in the database, and 0 of 56 CA rows match.
- ⚠ **`treasury_sync_city_budget` never updates `data_source` and keys on `fund_scope`+`basis`**, so writing a new scope **INSERTS a duplicate** rather than overwriting. Load, verify, then delete the superseded rows — never assume a replacement happened.
- ⚠ **`budget_categories` is FLAT and holds every tree level.** Sum the ROOTS (`parent_id is null`), not all rows, or totals come out 2–3× too high.
- **🔑 THE LESSON: check what a figure IS before modelling its scope.** One provenance-API call plus a total beat two ACFRs and 384 combinations of hypotheses.

**Verification:** `verify-scope-seams.mjs` → **21 seams, down from 22, with LA gone** and SCOPE-02's four still closed. `npm test` **479/479** · `npm run build` clean · NUL-byte lint 13/13.

**Merged:** PR #40 → `main` as `1f74b6a`, preceded by the retraction in PR #39.

**Follow-ups that shipped separately:** the actuals-tense copy fix (#41), the SCO fiscal-year watch as a GitHub Actions job (#42, #43, #45), and durable restorable backups (#46).

⚠ **UAT not run at tag time.**

**Archive:** none — not a GSD-phased milestone.

---

## v2.27 AUSTIN-TRAVIS-01 — Austin, Travis County, and every ACFR General Fund row (Shipped: 2026-08-19, tag `v2.27`, UAT ✅ re-verified 2026-08-23)

✅ **UAT RE-VERIFIED 2026-08-23 — 5 of 5 on re-run.** The original UAT (2026-08-20) left one
failure and two withdrawn tests, all three about whether a reader can tell what PERIOD a
figure covers. Record: `docs/superpowers/plans/AUSTIN-TRAVIS-01-UAT.md`, re-verification
section.

| original | then | now |
|---|---|---|
| test 5 — provenance visible | ❌ issue, major — *"I don't see sept 30 anywhere on austin"* | ✅ **resolved** — PR #38 added `city` to the source-chip types (county-only since Phase 57, never widened) |
| test 6 — a June-30 entity's fiscal year | ⊘ withdrawn, unmeetable | ✅ **satisfied** via Bend's `as of 2024-06-30` |
| test 7 — New York's April fiscal year | ⊘ withdrawn, unmeetable | ⚠ **still unmeetable — the reason no longer holds** |

⚠ **One item left, and it is a DECISION, not a defect.** `MUNICIPAL_SOURCE_CHIP_TYPES`
excludes `state` because "nobody has checked the quality of state `data_source_info` yet —
it is a candidate, not a decision". **That check is now done: 10 of 10 state nodes carry a
display name, a real source URL, and an as-of date matching that state's own fiscal year
end** — NY 03-31, TX 08-31, AL/MI 09-30, and six more at 06-30. One `Set` entry would close
test 7.

Figures re-confirmed live: Austin FY2024 $1,347,127,000 out / $1,280,826,000 in (the only
entity in the app whose source prints in thousands); Travis FY2024 $888,757,389 /
$1,030,822,292; Travis FY2004 $270,078,987 / $283,615,180, its chip still resolving
`fy2004-cafr.pdf` under the pre-GFOA-rename name. Austin FY2002–09 correctly still absent —
CO-SPRINGS unblocked those years, it never loaded them.

⚠ The em-dash double-encoding this entry recorded as open is **FIXED** (see v2.29 UAT).

**Tasks completed:** onboarding milestone on a `docs/superpowers/` plan — closeout: `docs/superpowers/plans/AUSTIN-TRAVIS-01-CLOSEOUT.md`, reconciliations: `AUSTIN-TRAVIS-01-SCOPE-RECON.md` and `ACFR-GF-CLASSIFICATION-RECON.md`

**The headline:** 76 General Fund rows of ACFR GAAP actuals — City of Austin FY2010–FY2025 (32 rows, **thousands**) and Travis County FY2004–FY2025 (44 rows, whole dollars) — and then **every remaining `ACFR — General Fund` row in the database got classified**: **336 rows** across 5 evidenced registry entries, with whole-table `unknown` falling by exactly 336 on each of the three axes.

- **🔑 Verified by an INDEPENDENT oracle, because the obvious check is tautological.** The database's `total = Σ items` test *cannot* fail — the loader computes the total from the items it just parsed. A separate pdfplumber reader was written to read the same statements from glyph coordinates. ⚠ **The same tautology later bit the SCOPE-04 handoff**, whose "0 of 23,260 rows tie" green light is guaranteed by construction.
- **🔑 Four failure modes that each tie at exactly $0 while being wrong**, none of them findable without the oracle: Austin FY1998–FY2001 tie at $0 while being **1000× wrong** (whole dollars, not thousands); a renamed lease line mis-nested FY2022 with an identical $0 tie; Austin **ciphers its header digit glyphs**, rendering "September 32, 2222"; and `pdftotext -table` places the GF column at two different character positions, so 7 of 9 sources read $0.
- ⚠ **Austin FY2002–FY2009 left unloadable** for that last reason. *(v2.29's coordinate reader unblocks it.)*
- ⚠ **Austin publishes through a Widen DAM.** Every legacy `austintexas.gov` CAFR path is a 404, and `/view/pdf/` serves **HTML**; the working form is `/content/<id>/pdf/`.
- ⚠ **Travis County's host is `tctransparency`.** A WebFetch summary **invented** `financialtransparency`, which 404s everywhere — a fabricated hostname that reads as entirely plausible.
- ⚠ **Both stampers write `unknown` on a FRESH row**, so re-running a loader silently **un-classifies** its own output.
- **A pre-existing gate failure surfaced and was fixed.** `stampBudgetAxes.mjs`'s `EXPECTED_BASIS_ROWS` still held the pre-backfill 10,438 / 10,446 for the two CA SCO entries while `classifyFundScope.mjs` had already been corrected to 10,448 / 10,448 — so that gate had been failing since the SCOPE-02 Task 10 backfill, independently of this milestone.
- ⚠ **The general `/ACFR — General Fund/` pattern was NOT used.** It claims 1,784 rows, sweeping in the 1,448 already owned by `state-acfr-gf`. The registry entries are anchored to entity names on purpose; the 260 rows across sixteen other families were then closed deliberately, per family, with evidence.

**Tests:** `npm test` **471 passed / 30 files** (8 new) · `acfrGF.selftest.py` **166 passed** · `npm run build` clean.

**Merged:** PR #37 → `main` as `34caf9a`.

⚠ **UAT not run at tag time.**

**Archive:** none — not a GSD-phased milestone.

---

## v2.26 SCOPE-03 — The Series Toggle (Shipped: 2026-08-19, tag `v2.26`)

**Tasks completed:** 10 of 10 (no GSD phases — spec: `docs/superpowers/specs/2026-08-18-scope-03-design.md`, plan: `docs/superpowers/plans/2026-08-18-scope-03.md`, closeout: `docs/superpowers/plans/SCOPE-03-CLOSEOUT.md`)

**The headline:** 91 budget rows across 17 entities were in the database and unreachable in the UI. SCOPE-02's `chooseDisplaySeries` picks one series and holds it — correct, and what killed the Long Beach cliff — but everything it did not pick became invisible. The reader can now choose. **Zero database writes**: no migration, no row, no EV-Accounts change.

- **🔑 The request was reframed by measurement, and the first measurement was wrong.** Chris asked for a General Fund / All Funds toggle. **Zero** entity+dataset pairs carry two different *known* fund scopes, so that control would have shown two permanently disabled buttons for every city in the country. But querying `fund_scope` alone said "nothing to toggle at all"; querying `(fund_scope, basis)` — SCOPE-02's actual series identity — found **28 multi-series pairs across 17 entities**, 26 of them differing on *basis*. So this ships as a **series** toggle. ⚠ Same error shape as SCOPE-02's Premise 2: **querying one axis when the data varies on two.**
- **🔑 Two silent defects found by reading, killed by mutation tests.** `loadBudgetData`'s cache key omitted `fund_scope`/`basis` — harmless until the caller can choose, then it returns the previously cached *other* series' figure. And `availableYears` was series-blind. ⚠ Its filter must be applied to `buildPeriodTokens`' **input**, never its output: the FY1976 Transition Quarter token is synthesised from a `period_label` row, and Federal (the only TQ entity) has a single series, so no multi-series fixture could catch it.
- **🔑 Three things only the running app caught, none of them in the plan.** (1) The default series was coupled to the **active tab** — switching Money In/Money Out silently switched series, defeating the shared selection; found on Plano, fixed by seeding the default once per entity. (2) `erasableSyntaxOnly` rejects constructor parameter properties: `npm test` passed, `npm run build` failed TS1294 — the reason `npx tsc --noEmit` is not the gate. (3) **Los Angeles was already broken on `main`** — it renders no tiles and error text at its landing year, because `loadBudgetData` threw when the displayed series had no row for the year. Verified side by side in a throwaway worktree. SCOPE-03 fixes it as a side effect.
- **Longview TX (§3.1)** is the one entity whose two datasets each hold one series and hold *different* ones, so shared selection drops a tile that renders today. Chris ruled to honour the rule; `scripts/verify-series-shape.mjs` ships to catch the next one, since the seam detectors compare *within* a dataset and would never see it.
- **🔑 NUL bytes four and five.** `.planning/STATE.md` held a raw `U+0000` — inside the line warning against NUL bytes — making git treat the file as binary. ⚠ And **this milestone's own plan** had been committed as `Bin 0 → 86484 bytes`, an unreviewable binary blob, again from a literal NUL inside a warning *about* NUL bytes. Both fixed here. The **lint** SCOPE-02 asked for is written but lives on `chore/nul-byte-lint`, reviewed separately so this milestone stays SCOPE-03 only. ⚠ Traps recorded there: the filter **cannot** ask git whether a file is binary (that is the symptom, so a corrupted `.ts` would exclude itself); `LC_ALL=C grep -P '\x00'` errors on the locale and reports a clean repo it never read; `sed -i` strips every CR; and `perl`'s `s/\x00/\\0/` no-ops because `\0` in a replacement is an octal NUL.
- ⚠ **This repo cannot run component tests and none exist.** `vitest.config.ts` is `environment: 'node'` and its `include` never collects `.test.tsx`; a `.test.tsx` file **silently does not run**. Testable logic must live in pure modules.

**Tests:** 458 passing / 29 files (from 445 / 28). `npm run build` clean.

**Merged:** PR #31 → `main` as `4cd598b`, 19 files, +4,670/−877. Tagged `v2.26` in the same commit as this entry — the thing v2.21 through v2.23 each got wrong in a different way.

**Follow-up, deliberately separate:** the NUL-byte lint and its pre-commit hook ship as PR #32, not as part of this milestone. ⚠ Its `build` check had never run while it was stacked on `feat/scope-03`: `build-check.yml` triggers on `pull_request` with `branches: [main]`, and retargeting a base does **not** re-fire it — a close/reopen does. **A stacked PR in this repo is untested until it points at `main`.**

**Archive:** none — no `milestones/v2.26-*` directory (not a GSD-phased milestone).

---

## v2.25 SCOPE-02 — Basis, Reporting Entity, and One Series per (scope, basis) (Shipped: 2026-08-18, tag `v2.25`)

**Tasks completed:** 14 of 14 (no GSD phases — spec: `docs/superpowers/specs/2026-08-17-scope-02-design.md`, plan: `docs/superpowers/plans/2026-08-17-scope-02.md`, closeout: `docs/superpowers/plans/SCOPE-02-CLOSEOUT.md`)

**Delivered:** `basis` and `reporting_entity` on `treasury.budgets`, both stamped from evidenced registries; the unique index widened so one city-year can hold two genuinely published figures; **12 rows of State Controller all-funds actuals backfilled that the old index had been keeping out**; and a series model under which one series is never continued by another. **Fresno's spending no longer falls 44% in a year it didn't.** Rows 79,927 → 79,939. Merged as PRs #16 and #17; the API change shipped separately from EV-Accounts.

**Key accomplishments:**

- **🔑 Three premises were tested and all three failed**, before a line of the plan was written. The milestone was specced twice, and each break made it smaller and better founded. This is the substance of the work, not a preamble.
- **"Total Governmental is derivable from the SCO row" — false for 63% of rows.** The SCO cities report restructures at FY2017. In FY2003–2016 it is a **function** taxonomy spanning all funds: Modesto FY2016→FY2017 shows `Health` vanishing and `Transportation` collapsing by $45M, because solid waste was inside Health and transit inside Transportation. No subset of era-A roots equals the enterprise funds. ⚠ **A regex over root names would have subtracted `Public Utilities` in era A and produced figures too high in a way no arithmetic gate could see**, sitting between two correct years on a chart. Derived Total Governmental was dropped from the milestone and moved to SCOPE-03.
- **🔑 "The seam is a fund-scope change" — it is two changes stacked.** SCO publishes **actuals**; the city rows that follow are **adopted budgets**, and several cities carry FY2026 rows for a year that has not closed. `basis` was `fund_scope` before SCOPE-01: an axis the data varies on that the schema could not express, so the app silently drew across it.
- **🔑 "The recent years need new documents" — some were already published, and the index kept them out.** SCO published through FY2024, but Fresno FY2020–2024, Riverside and Santa Ana FY2023–2024 and Oakland FY2024 were absent because a budget-document row held the key and the loader's never-overwrite policy skipped them every time. **Part of the seam was missing data, not mislabelled data.**
- **ZERO pre-existing figures moved.** `sha256(id | total_budget)` over every row except the twelve created is `3bc12db8…82a2` — byte-identical to v2.24 and to the value SCOPE-01 recorded independently. Verified after every database step.
- **🔑 The figure invariant was inverted rather than accepted as specced.** The plan wanted a committed list of all 79,927 v2.24 ids. Measurement showed **`created_at` is NULL on 79,899 of them**, so the plan's timestamp fallback would have silently excluded 99.96% of rows and left the invariant nearly vacuous — and the id list would have been a ~3MB permanent artifact. It became an **exclusion** over the ~12 ids the backfill records. An unrecorded id fails the harness **loudly**.
- **🔑 A real precision bug surfaced in the harness.** `fetchScopeRows` read `total_budget` as a bare numeric and PostgREST's JSON round-trip loses digits past ~15–17 significant figures (`43283121.249999955`). The digest could not reproduce until the select became `total_budget::text`.
- **The RPC was targeting a narrower key than the index.** `treasury_sync_city_budget` looked up by `(muni, fy, dataset_type)` only; with two rows it would have overwritten an arbitrary one's tree while keeping its `data_source` label — writing SCO actuals into a row labelled as a city's adopted budget. Now key-complete, and it **refuses** on an ambiguous target rather than guessing. ⚠ The old 9-argument overload **survived `CREATE OR REPLACE`** and had to be dropped explicitly; two callable versions would have reintroduced the ambiguity by another route.
- **🔑 Three of the seven seams are not closed, and that is correct.** Long Beach, Anaheim and Bakersfield cannot be backfilled — SCO ends at FY2024 and their adopted rows begin at FY2025. All three carry 22 evidenced actual years, so the display rule draws FY2003–2024 continuously and renders FY2025 as a **gap**, which is what the spec asks for. `detectSeams` still flags them because it groups **scope-blind** and now compares rows from two different series. **The criterion predates the series model; the Definition of Done's phrasing was defective, not the code.** An independent final review verified the reasoning rather than accepting it.
- **Everything mutation-tested.** Both CHECK constraints in the rejecting direction; the widened index proven to permit the intended pair **and** still reject a true duplicate; the new summation lint proven able to fail before being trusted.
- **The review loop caught three defects that would otherwise have shipped:** a **literal NUL byte** that made git classify `budgetSeries.ts` as binary and destroyed its diff and blame — while the implementer's report described a space delimiter that was never there, caught only by a reviewer hex-dumping the blob; **two `unknown` guard clauses in `areComparable` that no test pinned**; and the surviving RPC overload. ⚠ **The raw-NUL trap fired three separate times in this milestone.** Three is a pattern, not bad luck — it wants a lint.
- **Verification at close:** `npm run build` clean · `npm test` **370 passed / 22 files** · frozen figure invariant unchanged · 249 pre-existing rows for the backfilled cities unchanged on all four axes · 0 measured backfill gaps · final whole-branch review with **no blocking findings**.

**Known deferred at close:** `verify-fund-scope.mjs` now reports a false alarm on every run — it compares against SCOPE-01's whole-table digest, which the twelve legitimate rows move, and never got the exclusion mechanism; **a harness nobody believes is worse than no harness**, so retire or update it. `detectSeams` scope-blindness can register a spurious zero-gap seam for a dual-row city-year, polluting the ~37-seam backlog — fix the instrument before triaging with it. `bulkLoadStateController.js` checks `rows_inserted` but never `result.error`, so the RPC's ambiguity guard would undercount silently. The RPC key omits `period_label` and so fails closed only on ≥2-way collisions. SCOPE-01's own `fundScopeRegistry.mjs` says "seven taxonomies" where RECON §4.3 says eight. And **still the highest-value single task anywhere in this project, and in none of these milestones: one MA ACFR from a town that runs its own schools** unblocks 16,816 rows — 21% of the database — moving `general_fund` from 2.2% to ~23%.

**Archive:** none — no `milestones/v2.25-*` directory (not a GSD-phased milestone).

---

## v2.24 SCOPE-01 — Fund Scope on Every Row (Shipped: 2026-08-17, tag `v2.24`)

**Tasks completed:** 11 of 11 (no GSD phases — spec: `docs/superpowers/specs/2026-08-16-scope-01-design.md`, plan: `docs/superpowers/plans/2026-08-16-scope-01.md`, evidence: `docs/superpowers/plans/SCOPE-01-RECON.md`, closeout: `docs/superpowers/plans/SCOPE-01-CLOSEOUT.md`)

**Delivered:** `treasury.budgets.fund_scope` — `general_fund` · `total_governmental` · `all_funds` · `unknown`, CHECK-constrained — stamped across all **79,927 rows**, plus a reader-facing scope chip and explainer, a comparison guard, and three verification harnesses. **53,404 rows (66.8%) classified from 8 evidenced registry entries; 26,523 (33.2%) across 1,066 entities are honestly `unknown`.** No figure moved. Free documents, $0 spend, executed inline (no subagents). PR #15, merged from `feat/scope-01`; the API change shipped separately in EV-Accounts (`112d4320`) and is live.

**Key accomplishments:**

- **The honest headline is the third we could NOT classify.** Before this milestone every one of those 26,523 rows was displayed as though its scope were known and comparable. `unknown` is a result, not a shortfall, and the harness refuses to hide it. **Six strings carry 51,670 rows; 2,084 strings carry the unclassified 26,523** — coverage is cheap at the head and expensive in the tail, which is why the tail is where `unknown` is the right answer rather than a number to grind down.
- **Classification is per SOURCE and only against an independent document.** An unevidenced registry entry *cannot* classify: `classify()` returns `unknown` when the matching entry has no evidence, whatever its `scope` claims. That is what stops a name heuristic validated on one city becoming a fact for 21,794 MN OSA rows.
- **🔑 The MA label trap — the milestone's own method applied to itself, and it failed.** `X — MA DLS Schedule A — Special Revenue Funds` (1,560 rows / 336 towns) contains **General Fund expenditures**. `docs/MA/` holds only `GenFundExpenditures{2002..2025}.xlsx` and `GenFundRevenues{...}.xlsx`; no SRF file was ever loaded, the stored figures equal `Total Expenditures` in the GF file exactly (Arlington $191,585,207), and the label split is arbitrary — 26–51 towns a year carry the GF label for the *same* years ~300 carry the SRF label. A fifth CHECK value, `special_revenue`, had already been added on that false premise; it was dropped again (migration `20260817000100`) after verifying zero rows held it. **Read the loader's actual input files before believing a `data_source` string.**
- **🔑 "CA State Controller" is two unrelated sources sharing a prefix.** `^CA State Controller` claims 30,942 rows, but 7,682 are `— Government Compensation in California (publicpay.ca.gov)`, a different SCO program the Modesto reconciliation never covered. The registry uses fully anchored per-string patterns rather than resting the distinction on the ASCII-hyphen/em-dash tell.
- **The eight entries, and what proves each:** Modesto FY2024 ties the SCO city expenditure and revenue rows **to the dollar** ($588,042,068 / $643,894,826); Stanislaus FY2024 ties county expenditures to **$6 on $1.4bn**; Utah **and** Connecticut FY2024 tie the state-ACFR General Fund column exactly on both sides; Spokane **and** Tacoma FY2019 tie exactly on both sides **in two different units**, which also proves the loader normalised per document; Ohio AOS is the strongest discriminator anywhere here, because the publisher prints General Fund and Total Governmental as *separate tabs of one file*.
- **The registry's weakest link is labelled as such rather than presented as equivalent.** `ca-sco-county-rev` is the only entry without a dollar tie. It rests on a 0.547% residue decomposing across seven taxonomies with **mixed signs** — five SCO-higher, three SCO-lower, the signature of two schedules bucketing money differently rather than of a missing fund — plus $218.8M of enterprise and internal-service revenue sitting *inside the row being classified*. Nearest rival scope is 29× further away. **A test asserts it stays the only entry lacking a dollar tie**, and what would overturn it is written down.
- **🔑 A fourth dimension the milestone does not model, found by measurement.** MN OSA's fund composition is unambiguous (`total_governmental`) but its **reporting entity** is wider than a city ACFR's primary government: it consolidates HRA/EDA/TIF component units, running ~7% high statewide and ~17–22% for TIF-heavy cities. Measured across all 852 cities in the workbook — 60.3% carry nonzero TIF/HRA/EDA. Chris's call was to classify on fund type now and make `reporting_entity` an explicit SCOPE-02 deliverable. **This sets the rule for every state-collected form** — MN OSA, Ohio AOS, VA APA and MN counties, ≈29,000 rows.
- **VA revenue was a completeness defect, not a scope one.** Exhibit B is *"Total **Local** Revenue"* and excludes intergovernmental aid — stored revenue runs 59.6%–102.3% of expenditures depending on how aid-dependent the locality is. No `fund_scope` value can express a horizontal slice. The 304 rows were hidden by relabelling `dataset_type` → `revenue_local_only`, which is simultaneously the hide and a truer label.
- **🔑 The only working lever for hiding rows, established by measurement.** A `display_suppressed` column **cannot** work: EV-Accounts serves treasury reads with explicit column lists so a new column is invisible, and `/treasury/cities` builds `available_datasets` with no source information, so the frontend would keep offering a tab that then failed to load. `src/App.tsx` matches dataset types by explicit **allow-list**, so relabelling `dataset_type` hides rows immediately, loses no data and cannot break the UI.
- **The seam detector found 26 seams across 15 entities — 19 nobody had listed.** All seven required CA cities were found with every drift ≤ 0.05 percentage points against figures CA-CITIES-01 measured independently. The load-bearing design decision: **a change into or out of `unknown` IS a seam** — every one of the seven known cities transitions `all_funds`→`unknown`, so a detector comparing only two *known* scopes would have reported zero and looked clean. New findings include **Nevada −57.5%** (a state node), **Long Beach revenue −77.5%**, worse than its −75.0% operating seam, and a Kentucky one-year **notch** rather than a handover.
- **The queue splits in two, and conflating them wastes effort.** Large negative steps are genuine scope breaks. Small or positive ones — San Diego revenue **+16.6%**, SF +0.7% — mean the city's own-source figure is probably all-funds too; those are sources awaiting a registry entry, not cliffs. Nobody should be sent to "fix" San Francisco's 0.7%.
- **🔑 Two digests, because one conflates two different failures.** The Task 3 baseline was keyed on `dataset_type`, a **mutable label**, so the deliberate VA relabel moved it while every figure stayed identical. The harness now carries the id-keyed `sha256(id | total_budget)` as the **figure invariant** that must never move, and the composite as a change-detector allowed to move when a committed migration explains it. A digest keyed on a mutable label conflates "a figure moved" with "a label changed", and a harness that cries wolf gets ignored.
- **Everything mutation-tested rather than asserted.** The CHECK constraint was tested in both directions in a rolled-back `DO` block — a constraint whose rejecting branch has never fired is a constraint nobody has tested. The duplicate detector reads **zero** live, which is an unfalsifiable result on its own, so it was mutation-tested two ways: in memory and in a rolled-back transaction, both firing on exactly the mutated city-year and nothing else. Its grouping deliberately **excludes** `period_label`, and a test asserts that, because adding it would split the federal FY1976 Transition Quarter pairs and make the double-count hazard invisible by construction.
- **🔑 Task 10's premise was wrong, and saying so was worth more than the filter.** The plan called for holding `unknown` rows out of "browse grids and per-capita rankings", and UAT was warned grids would visibly shrink by hundreds of cities. **Neither surface exists** — every cross-entity panel shows names and links, and all five per-capita computations are single-entity. So Step 4 shipped as a **guard**, not a filter: `isComparableScope()` pins the failure direction so absent, null and unrecognised values all return `false`, and a comparison surface built later cannot slip an unlabelled figure onto a shared axis.
- **🔑 The hand-curated disclosure map has three holes, and this is the argument for the milestone in one table.** `cityBasisNotes` covers 7 of the 10 seam cities; **Anaheim (−70.1%) and Santa Ana (−62.5%) are the 2nd and 4th largest seams in the database and carry no disclosure at all**, plus Los Angeles. A curated list drifts silently because nothing measures whether it is complete. The seam detector does measure it.
- **🔑 A UAT defect nothing else could catch: the scope chips had no colour coding.** `ScopeLabel` styled its three verified scopes against an `ev-blue` scale this project has never had, and its unverified chip with `bg-ev-gray-50` where the token is `ev-gray-050`. All six classes were dropped — `bg-*` fell to transparent and `border-*` to `currentColor`, so the VERIFIED chips rendered a dark border and no tint while "scope not established" came out the **softest chip on the page**. Exactly inverted. `vite build` clean, `tsc` clean, **298 tests green**: Tailwind discards an unknown colour class silently and jsdom does not run Tailwind, so only reading `getComputedStyle` off the running app sees it. Fixed to `ev-skyblue` (Chris's call at UAT) and guarded by `ScopeLabel.tokens.test.ts`, which parses the token list out of `index.css` and is mutation-tested to fail on the original bug.
- **Verification at close:** `verify-fund-scope.mjs` all checks (8 entries evidenced, every row a legal value, both digests stable) · `verify-scope-seams.mjs` 7/7 required, 26 found · `verify-scope-duplicates.mjs --mutation-test` fires on exactly the mutated row · `npm test` **304 passed / 17 files** · `tsc --noEmit` + `vite build` clean. The API was re-verified live at UAT: `/treasury/cities` carries **79,927** `fund_scope` values, one per row, distribution matching the database exactly.

**Known deferred at close:** `general_fund` sits at 2.2% and **that is not the end state** — MA DLS alone is 16,816 rows almost certainly General Fund, blocked on one WAF-free ACFR from a town that runs its own schools (Newton, Somerville and Arlington all returned HTTP 403; Amherst is a poor sole witness because it belongs to a regional school district). If MA lands, `general_fund` goes to ~23% and `unknown` drops to ~12%. Also open: the `reporting_entity` column and the two-column comparison filter (≈29,000 rows); the 26-seam queue, split into real breaks vs classification gaps; the three undisclosed seams — better fixed by deriving disclosure from `fund_scope` than by authoring three more curated notes; VA Exhibit B1 so VA revenue becomes a whole-revenue figure; a second CA county probe to harden `ca-sco-county-rev`; CA publicpay's structural reconciliation (unrun, though 479 of 482 cities pair it against the all-funds SCO total so today's "payroll as a share of spending" reading is sound); Transparent Utah, which **must never be reconciled by querying BigQuery** — unpartitioned, full-scan, ~$132 surprise bill on 2026-06-19 — use a free SLC/Provo ACFR PDF. Two data-hygiene notes, neither this milestone's to fix: `dataset_type = 'salary'` (6 rows) is a typo of `salaries`, and `DatasetTabs.tsx:149` carries the same dead `bg-ev-gray-50` class.

**Archive:** none — no `milestones/v2.24-*` directory (not a GSD-phased milestone).

---

## v2.23 WA-CITIES-01 — Six Largest WA Cities (Shipped: 2026-08-16, tag `v2.23` at `40aa706`)

**Tasks completed:** 14 of 14 (no GSD phases — plan: `docs/superpowers/plans/2026-08-15-wa-cities-01.md`, spec: `docs/superpowers/specs/2026-08-15-wa-cities-01-design.md`, closeout: `docs/superpowers/plans/WA-CITIES-01-CLOSEOUT.md`)

**Delivered:** Tacoma, Spokane, Vancouver, Bellevue, Kent and Everett onboarded on General Fund GAAP actuals from the WA State Auditor's bound statements — **214 budget rows** and **93 municipality-scoped enrichment rows** — plus four nav-only county nodes (Pierce, Spokane, Clark, Snohomish), with Bellevue and Kent under the **existing** King County node. With v2.22's Kitsap and Bainbridge, the WA cohort is **286 rows under one roster** (`scripts/lib/waRoster.mjs`), read by the seeder, every loader and all three harnesses so they cannot drift apart. Free PDFs, $0 spend, executed inline (no subagents). Merged `bb59682` to main and pushed; tagged `v2.23` at `40aa706` on 2026-08-16.

> ⚠ This entry read *"not tagged — awaiting Chris UAT"* until 2026-08-17, by which time the tag had existed for a day. Corrected during the v2.24 close. **Tagging and updating `.planning/` are one step, not two** — v2.21 and v2.22 never reached this file at all, and v2.23 reached it stale.

**Key accomplishments:**

- **The milestone's largest open risk did not materialise.** The spec named it: Tacoma, Spokane or Vancouver might file only an opinion letter with the SAO, forcing a v2.21-style own-ACFR fetcher or substitution of the next largest city. All six carry full bound statements in every year of every window, and the Tacoma pilot answered it at first fetch. **No substitution, no second fetcher, no second extractor shape.**
- **Per-city FY floors, four of six running to the top of the manifest:** Tacoma 19 years, Spokane 20, Vancouver 19, Bellevue 12, Kent 18, Everett 19. The floor rule ended exactly ONE window (Bellevue — four consecutive image-only scans) and was deliberately overridden in exactly one (Kent, Chris-approved: FY2019+FY2020 are consecutive unreadable years, but the 15 years below the gap parse on the SAME config, so reading below it needed no work — the rule's stated purpose).
- **🔑 Ten corrupted labels found in production and repaired (Kent).** `Lodging Other`, `Real estate excise tax Lodging Other`, `Contributions and Donations Other miscellaneous revenue`, `Fire District #` (truncated from `Fire District # 37 Contract`), and `Issuance costs Capital outlay` — the last of which also filed **$193,673 of capital spending inside the debt-service subtotal**. Every figure was right and every row tied at $0. **The lesson worth the most in this milestone:** the three "harness gaps" logged against Kent were reader defects whose fix *immediately exposed the same defects in the extractor*, because both had been written from the same misreading of the page. Never conclude the loaded data is fine because the reader is provably wrong.
- **🔑 Two letter-spaced labels found in production and repaired (Bellevue FY2015/16):** `Premi ums /contri buti ons` and `Tra ns porta ti on`. Invisible to every arithmetic gate **and to the re-derivation**, because both sides of that comparison read the same defective text layer. Found only by deriving Task 12's enrichment worklist from production rather than from the extractor configs. Audit check (e) now carries the check that found them, keyed on the artifact's signature: two labels of one entity whose letters match once whitespace is removed but which still differ once case is folded — entity-wide, because the correctly-spelled twin is in another fiscal year. Pure capitalisation differences are deliberately not flagged (23 benign families across the corpus).
- **Thirteen reader-defect classes**, with transcribed fixtures. The two most expensive: **`pdftotext -table` form feeds are NOT page breaks** (Spokane FY2019 is 176 pages → 455 chunks; its statement is chunk 63 but PDF page 37), and **`-layout` cannot be trusted to preserve indentation** (Kent FY2006 p.28 emits every label at column 0 — heading, child and root leaf alike). Nesting evidence now comes from `-lineprinter` true geometry only, which **removes** a renderer rather than adding one.
- **A row carrying no money in any column is one of THREE things**, not one: a colon-less group heading, a genuine two-line label, or a line item printed empty in every column. Told apart from the page's own printed nesting geometry, established from its colon headings. The extractor side declares the empty ones per city (`CityConfig.empty_rows`) because the library default is *right* elsewhere — Bend, Seattle and Beaverton all have genuine wrapped labels.
- **A section can be made ENTIRELY of incomplete rows** (Kent FY2004–FY2011 operating), so its column bands cannot be corroborated from inside it. They are now corroborated from the other section of the same page — `-table` reflows the whole page onto one grid — with the section's own rows still tried first, so no previously-passing page changed, and every use of the weaker path printed in the summary rather than kept quiet.
- **Blind re-derivation, 286/286 at exactly $0, 0 blockers**, importing nothing from the extractors: two unlike column readings required to agree on every row, page identity asserted four independent ways, ambiguity FATAL rather than resolved by document order.
- **Eight-check source-chain audit, 8/8 across 286 rows**, with 143 pinned sha256 digests. Check (e) was also *corrected*: scoped to real siblings within one category, because compared across the whole row it fired 45 times on Kent's `Taxes / Other` and caught nothing.
- **Enrichment coverage derived LIVE from production** — 93 rows over every live depth-0 category, every row scoped to a `municipality_id` (NULL-scoped baseline 4738 before and after), each carrying a fund-scope caveat naming **that city's own** excluded funds read from its own filing. Several materially change interpretation: Tacoma runs an electric **power** utility, Everett runs **transit**, and Vancouver funds **fire** service, all outside the General Fund.
- **Verification at close:** `npm test` 10 files / 203 tests · `npm run test:acfr` 166 · re-derivation 286/286 · audit 8/8 · tether definitive. Check (h) **and all four new enrichment guards** mutation-tested rather than assumed live — three of the four had been satisfied on their first dry-run, so "0 leaks" was otherwise indistinguishable from "the guard is inert".
- **Two spec questions answered from evidence, not guessed.** (§4) The report-type inversion **holds below FY2014 and is more extreme there** — pre-FY2014 filings typed *Annual Comprehensive Financial Report* are 2–3pp auditor's opinion letters (tested at FY2007/2009/2012 against a 99pp *Financial and Federal* for the same year). (§5) The config registry **would** win on the spec's stated criterion — an AST parse shows zero per-city code in all six extractors — but the criterion was aimed at the wrong cost: the "shared bug needs six edits" fear never materialised (every library fix was one edit in `acfrGF.py`), while 65–95% of each file is per-city prose that a registry would displace. **Recommendation: keep per-file.**

**Known deferred at close:** Chris UAT and the Phase D re-scope conversation (rest-of-WA batch size, whether county finances are as cheap as they look, whether the floor rule should be loosened to what Kent actually did — the closeout recommends yes). `classifyReport` passes a document whose **table of contents** names the statement even when the statement pages are unreadable (Everett FY2005/FY2010) — worth tightening next WA milestone. `acfrGF.py` still splits pages naively on form feeds; harmless (its `statement_page` is never persisted) but it disagrees with audit (h). No tether icon on any of the twelve WA entities — a documented cross-repo Essentials gap, not a TT defect. Nineteen source-document refusals, every one a defect in the filing; no OCR recovery attempted.

**Archive:** none — no `milestones/v2.23-*` directory (not a GSD-phased milestone).

---

## v2.22 Bainbridge Island, WA + Kitsap County Onboarding (Shipped: 2026-08-15)

**Tasks completed:** 12 of 12 (no GSD phases — plan: `docs/superpowers/plans/2026-08-14-bainbridge-island-kitsap-onboarding.md`)

**Delivered:** The City of Bainbridge Island, WA and Kitsap County, WA onboarded on General Fund GAAP actuals — **72 budget rows** (18 fiscal years each × operating + revenue) and **38 municipality-scoped enrichment rows** — beneath a new Kitsap County node under Washington. Both entities come from ONE source, the WA State Auditor's ReportSearch (MCAG 0461 / 0132), which publishes the *bound audited statements*, so every row carries audit-attested provenance. Free PDFs, $0 spend, executed inline (no subagents). Merged `a5ac920`, pushed `496e28e`; Chris UAT passed.

**Key accomplishments:**

- **Source client + content guard:** `scripts/lib/waSao.mjs` selects reports by CONTENT (page count ≥ 40 + located statement anchor), because **the report-type names are INVERTED for FY2014+** — the type called *Annual Comprehensive Financial Report* is a 4–5pp opinion letter while *Financial and Federal* / *Financial* carries the statements. This corrects v2.21's over-general claim that the SAO does not publish statements: it binds them for everyone except large self-publishing GAAP filers.
- **Two extractors for Bainbridge, one for Kitsap:** FY2004–2008 print a genuinely different expenditure tree (no `Current` parent) from FY2012+, so the era split is expressed in the loader rather than bent into one config. Both entities print **whole dollars** — the opposite of v2.21's thousands — and the tie is unit-invariant, so per-capita is the guard.
- **Six years deliberately unloaded, every one a source-document refusal and none a parser failure:** Bainbridge FY2006 (image-only scan), FY2009 (ciphered digits — a bounded contiguous-offset decode was attempted and no candidate map tied, so it was dropped as designed rather than escalated to an unbounded search), FY2010 (labels decode, money digits absent from the stream), FY2011 (CCITT stencil scans); Kitsap FY2017–FY2019 (font defect), FY2025 (not yet audited). In FY2010/FY2011 the only readable GF detail is a **budget-basis** schedule, which must not be published under a GAAP label.
- **All 33 printed-total residues adjudicated individually** by rendering each page (`pdftoppm -r 160`) and reading the General column off the image — never off the text layer, never by widening tolerance. Each is a registered EXACT delta; the loaded value is always the component sum, so every row still ties at $0 against its own line items.
- **Blind re-derivation, 72/72 at exactly $0, 0 blockers**, on a path importing nothing from the extractors. **Ambiguous statement-page identity is FATAL, not a warning:** Task 5 established that a $0 tie cannot detect wrong-page selection — with Kitsap's anchor disabled, 10 of 13 singular-titled years silently selected a different fund's schedule and **9 of them tied at $0**. Kitsap FY2020–FY2024 additionally agree with a physically different copy on `kitsap.gov`; **that cross-check covers 10 of the 72 rows, not all 72.**
- **Eight-check source-chain audit** (coverage incl. exclusions, tie integrity with all 33 acceptances named, provenance with 36 pinned sha256 digests, per-capita units, label integrity, page identity, hierarchy, enrichment scoping). Check (h) does **not** read a stored `statement_page` — there is no such column, so asserting it would pass vacuously forever; it re-resolves the page from the PDF's own printed identity instead, and was **mutation-tested** to prove it can fail.
- **🔑 Found and fixed a new defect class in production:** Bainbridge FY2013 revenue had shipped a category *and* line item named `______…______ Interest and Investment Revenue` — a horizontal rule the PDF draws in its left margin, flattened onto the row by `pdftotext -table`. The figure was correct and the row tied at $0, so every arithmetic gate passed it. **A label defect is invisible to a tie**, exactly like the dash-zero trap. Fixed narrowly in `scripts/lib/acfrGF.py`; a scan of **168 PDFs** across every entity using that shared library found the pattern in WA SAO filings only. Audit check (e) now asserts the label surface directly.
- **Fixed a latent Windows bug that silently deleted 15 tests:** `scripts/lib/waSao.mjs` carried a shebang; git's `core.autocrlf` rewrites to CRLF on checkout and Vite's shebang strip matches `#!.*\n`, where JS regex `.` does not match `\r` — so the shebang survived and the whole suite failed on a bare `SyntaxError` naming no file. `node --check` and `esbuild` both accept the file; only the Vite path broke. Guarded by a mutation-tested rule that no `scripts/lib/*.mjs` starts with `#!`.
- **Verification at close:** `npm test` 6 files / 93 tests · `npm run test:acfr` 125 · re-derivation 72/72 · audit 8/8 · tether definitive.

**Known deferred at close:** Essentials' `coverage.json` carries no Bainbridge/Kitsap record, so neither entity paints a tether icon — a **documented cross-repo gap, not a TT change**, same as v2.20's WI gap and permitted by PIMA-09. No shared-bucket banner asset exists for either entity (every plausible slug returns `NoSuchKey`), so both use the Wikipedia fallback, which resolves. Separately open: `cities/seattle.jpg` + `cities/king-county.jpg` **do** exist in the bucket but are absent from `CURATED_CITY_BANNERS`, so v2.21's own entities fall through to Wikipedia while licensed assets sit unused (fixing it needs credits transcribed from Essentials' `buildingImages.js` — never inferred from a filename). Also deferred: rest-of-WA fan-out (`WA-CITIES-01`), OCR recovery of the six dropped years, all-funds view, salaries.

**Archive:** none — no `milestones/v2.22-*` directory (not a GSD-phased milestone).

---

## v2.21 Seattle, WA + King County Onboarding (Shipped: 2026-08-14, tag `v2.21`)

**Tasks completed:** no GSD phases (plan: `docs/superpowers/plans/2026-08-13-seattle-king-county-onboarding.md`, `SEATTLE-REDERIVATION.md`)

**Delivered:** Seattle FY2009–FY2025 and King County FY2018–FY2025 live on General Fund ACFR GAAP actuals — **50 budget rows** across operating and revenue, **24 municipality-scoped enrichment rows**, and a `US → Washington → King County → Seattle` nav path. **No year was excluded** — the plan refused to assume the 18 never-extraction-tested years would pass, and all of them did.

**Key accomplishments:**

- **Two traps drove the design.** Both ACFRs print amounts **IN THOUSANDS** while every prior TT city prints whole dollars, and the internal tie is **unit-invariant** — it reads $0 whether or not the multiplier is applied, so the tie gate structurally cannot catch a missing one. And `pdftotext -table` alignment differs by issuer: **Seattle left-aligns its money columns, King County right-aligns them**, so neither edge of a number is a stable column key. King County FY2018–FY2020 additionally needs an ordinal read, where the positional one comes up short by exactly 12,109 on FY2018 revenue.
- **Verification:** all 50 FY×mode combinations re-derived to exactly $0, leaf-for-leaf and subtotal-for-subtotal, on a path importing none of `extractSeattle.py`, `extractKingCounty.py` or `lib/acfrGF.py` — its own `pdftotext` pass, page finder, section bounds and grouping rules, with units read off the page rather than configured. Every figure is three numbers agreeing: the database, the harness sum, and the statement's own printed total. Plus a six-check source-chain audit and an Essentials tether check; both entities are covered.
- **The harnesses were reviewed adversarially:** 18 injected mutations, 14 caught, and the 4 genuine gaps closed and re-verified by re-injection — a vacuous PASS over zero combinations, PDFs bound to fiscal year by filename alone, a source check that degraded to a note instead of failing closed, and a tether that reported a malformed catalog as a definitive coverage gap. Three overclaims were corrected in the same pass, including a header that advertised the column strategy as independent when it is shared with the loader.
- **Corrects a false premise carried since scoping.** King County FY2018 is cited to the Internet Archive because the issuer's own URL is gone, but this was **NOT a new provenance class**: New Hampshire already carried 16 archive-cited rows (FY2017–FY2024), so the application-wide count is **18, not 2** — and the audit check written on that claim would have failed as originally specified.

**Known deferred at close:** General Fund only — Seattle's City Light, Seattle Public Utilities and Transportation fund, and King County's Metro Transit and wastewater treatment all sit outside it. Surfaced in the enrichment copy rather than left for a reader to find.

**Archive:** none — no `milestones/v2.21-*` directory (not a GSD-phased milestone).

---

## v2.20 Madison, WI + Dane County Onboarding (Shipped: 2026-07-28)

**POINTER STUB, not a summary.** This milestone shipped with GSD phases 135–137 (MAD-01..09) but was never written up here at its close. It is recorded in `ROADMAP.md` and archived in full — read the archive rather than treating this entry as the record.

**In one line:** Madison, WI + Dane County onto TT from the WI DOR CMREB statewide workbook — 20 rows, all-governmental-funds basis, calendar-year FY, TT's first deliberately **unaudited** (self-reported MFR) source and labelled as such; 20/20 re-derived at Δ$0; Chris UAT signed 2026-07-28. Also shipped the app-wide source-chip fix `· fetched` → `· as of`, which was false on 1,801 rows across 67 entities.

**Archive:** [v2.20-ROADMAP.md](milestones/v2.20-ROADMAP.md)

---

## v2.19 Banner Info-Row + CTC Tether (Shipped: 2026-07-21)

**Phases completed:** 1 phase (134), 1 plan. Requirements BANNER-01, CTC-01 complete.

**Delivered:** Adopted Essentials' `SectionBanner` info-row on the TT hero banner — a left-anchored POPULATION stat with deep-link feature chips to its right (Essentials + a new **Civic Trivia Championship (CTC)** chip gated per location), replacing the old bottom-right icon cluster. Reciprocal of Essentials Ph187–189; extends v2.16 tethered icons. Frontend-only ($0, no data load). Real CTC brand trophy staged. Deployed (bundle index-CNkPhEAJ.js).

**Key accomplishments:**

- New `triviaCoverage.ts` seam (mirror of `essentialsCoverage.ts`): fetch-once/cache/never-throw CTC collections + tier-aligned matcher (city slug `<name>-<state>`, state by `localeName`, federal by tier), `useTriviaCoverage` hook; 12 unit tests.
- `resolveTriviaIcon` + `buildTriviaHref` (URLSearchParams-only, T-126-01 safe) wired into the fixed-order chip row after the Essentials chip; real CTC brand trophy (`trivia-symbol-{light,dark}.svg`), navy chip uses the bright `-dark` variant.
- Hero banner restructured into the Essentials info-row layout in `App.tsx`: POPULATION scrim (federal denominator for federal, else entity population; hidden for nonprofits/0) + feature chips top-left above the bottom-left title.
- Verified: `tsc` clean + 35/35 tests + production build; Chris live UAT 6/6, 0 issues (layout, CTC gating + deep-links, population omit, federal/state tiers, dark mode).

**Known deferred at close:** 1 — the `authenticated-deeplink-redirect-to-home-jurisdiction` frontend-routing todo (carried since v2.12; not v2.19 work). Follow-up: expose a public CTC collections catalog if the accounts-api proxy is auth-gated (so anonymous visitors also see the CTC chip).

**Archive:** [v2.19-ROADMAP.md](milestones/v2.19-ROADMAP.md)

---

## v2.18 Pima County Municipalities — TT Budget Parity (Shipped: 2026-07-17)

**Phases completed:** 3 phases, 8 plans, 10 tasks

**Key accomplishments:**

- Outcome: complete. All four municipalities located and confirmed loadable.
- Outcome: complete. All 44 in-scope (city × FY × mode) tie $0; Tucson regression ties $0.
- Outcome: complete.
- Outcome: complete. 44 budgets rows loaded, all independently re-derive to the 131-RECON totals at $0.
- Outcome: complete. 100% coverage (42/42 live keys), 0 uncovered.
- Loader-independent JS re-derivation (own `pdftotext -table` pass, no `extractAcfrGF.py` import) ties all 44 FY×mode roll-ups + every category + every leaf at exactly $0 against live production for Oro Valley/Marana/Sahuarita/South Tucson; full D-04 source-chain audit clean (a-e); Phase-132 loader invariants confirmed with a 0-net-change idempotent smoke-run.
- Live-fetched Essentials coverage.json and confirmed all 4 new Pima municipalities (Oro Valley, Marana, Sahuarita, South Tucson) already resolve to COVERED city records with correct Census GEOIDs — zero cross-repo gaps, no TT code change.
- Chris signed off 34/34 live-app UAT scenarios (all four Pima munis' icicles, per-capita, source chips, breadcrumbs, and Essentials tether icons) — closing v2.18 with PIMA-07/08/09 all verified.

---

## v2.17 Tucson, AZ City Onboarding (Shipped: 2026-07-11)

**Phases completed:** 3 phases (128-130), 8 plans. Requirements TUC-01..09 all complete.

**Delivered:** The City of Tucson, AZ onboarded at city parity — General Fund revenue-by-source + 2-level expenditure-by-function from its own ACFR (GAAP), FY2015-FY2024, per-capita, enriched, every figure durably sourced — under a new Pima County navigation node beneath Arizona, with the v2.16 Essentials tether confirmed live. Free ACFR PDFs only, $0 AI spend, executed inline (no subagents).

**Key accomplishments:**

- **Recon + extractor (Phase 128):** Enumerated + pinned durable per-FY tucsonaz.gov URLs for the FY2015-FY2024 clean-extract window; built `scripts/extractTucson.py` (`--mode operating|revenue`, stdlib-only, positional GF-column isolation via `pdftotext -table`, fail-loud `tie_delta` gate) — 20/20 dry-runs sum to the printed GF total at exactly $0.
- **Data model + load (Phase 129):** Idempotent seeder creates Tucson (AZ, pop 554,013) + Pima County nav node (pop 1,080,149) linked via `county_id`, both pinned to live Census Vintage-2024 estimates; `scripts/processTucson.js` loads 20 `budgets` rows via the source-safe `treasury_sync_budget_tree` RPC — all durably sourced, 0 `data_sources` residue, idempotent.
- **Enrichment (Phase 129):** `loadTucsonEnrichment.mjs` derives the worklist live from `budget_categories` — 15/15 keys covered (generic universal + Tucson-scoped), delete-then-insert NULLS-DISTINCT-safe, 0 `$`/locality bleed.
- **Verification (Phase 130, TUC-07):** A from-scratch, loader-independent re-derivation harness re-extracts every displayed figure directly from the 10 PDFs and ties the live DB — all 20 FY×mode roll-ups + every category subtotal + every leaf at exactly $0; source-chain audit clean (20/20 correct-per-FY reachable URLs, 0 residue, no stale labels, Census-pinned population).
- **Tether (Phase 130, TUC-09):** Live `coverage.json` probe pre-determined both Tucson (GEOID 0477000) + Pima County (04019) as COVERED; icon confirmed live on both banners — no cross-repo gap.
- **Live UAT (Phase 130, TUC-08):** Chris signed off 15/15 scenarios at treasurytracker.empowered.vote (icicle 2-level drill, Money In/Out, per-capita, source chips, breadcrumb + Cities-in-County, AZ regression, year switcher/era labels, FY21/22 merged-label quirk, FY2025-absence empty state).

**Known deferred items at close:** 5 pre-existing/benign open artifacts acknowledged (see STATE.md Deferred Items) — 3 stale v1.x-era quick-tasks, 1 frontend-routing todo, and the 130 UAT checklist (passed). None are v2.17 work.

---

## v2.16 Tethered Icons & Smart Banner (Shipped: 2026-07-08)

**Phases completed:** 3 phases, 4 plans, 9 tasks

**Key accomplishments:**

- Fetch-once/cache/never-throw Essentials coverage loader + tier-aligned, state-scoped, loose-matching resolver (`essentialsCoverage.ts`), proven by a 14-assertion fixture-backed vitest suite and wired into `App.tsx` as a real `data-essentials-coverage` DOM seam for Phase 126.
- Bottom-right hero-banner icon row deep-linking the current entity into Essentials via a fixed-order product registry (essentials live, compass/readrank reserved), built with @floating-ui/react tooltips and URL/URLSearchParams-only href construction.
- Proved the Essentials tether is context-sensitive end-to-end (icon iff a real per-location link exists) and passed Chris's live-app UAT across every entity tier — the v2.16 capstone, zero defects.

---

## v2.15 State ACFR Long Tail — Final Tail + NASBO Retirement (Shipped: 2026-07-06)

**Phases completed:** 8 phases (117–124), 34 plans
**Git range:** `067e338..655b77d` — 127 commits, 246 files, +34,346 / −10,739 lines (2026-07-03 → 2026-07-06)

**Delivered:** The State-ACFR arc is complete — **all 50 states now carry State-ACFR GAAP General-Fund data** (revenue-by-source + finer spending-by-function). The last 21 NASBO states (AK/AR/DE/HI/ID/IA/KS/ME/MS/MT/NE/NV/NH/NM/ND/OK/RI/SD/VT/WV/WY) were upgraded NASBO→ACFR across four parallel load batches (Phases 118–121), every loaded state-FY tying $0 to its printed GF total — including scanned/raster-image years (NM FY2022, OK FY2019, SD) hand-transcribed via independent OCR. Existing nodes deepened (**CA +6→FY2002** at the GASB-34 boundary, **FL +18→FY2003–2020**; NY/TX floors reconfirmed). **NASBO retired to fallback-only** (guarded via `isAcfrOccupied`) — no live node shows NASBO where ACFR exists; only two honest fallback rows remain (NV FY2024, KY FY2023 — genuine ACFR gaps). Free ACFR PDFs only, $0 AI spend, executed inline.

**Key accomplishments:**

- **Phases 118–121 (ACFR-33..53):** All 21 remaining NASBO states upgraded to full State-ACFR GAAP — cohort 29 → **50/50 ACFR states**. Every state-FY ties $0 to its printed GF column total; scanned/raster years OCR'd independently and tied exact; scope divergences (AR single-fund, etc.) relabelled honestly.
- **Phase 117 (RECON-11):** All 21 states located, bookend-tied at $0, roster locked with load-time flags — **zero STAY-NASBO exceptions**, so the NASBO-served list came out empty and every state landed on ACFR (verified 7/7, $0 DB writes).
- **Phase 122 (DEEP-05):** Existing ACFR nodes deepened — CA back to FY2002 (GASB-34 boundary), FL to FY2003–2020; NY/TX floors reconfirmed 0 recoverable; FL FY2000–02 documented repair-pending.
- **Phase 123 (NASBORT-01):** NASBO path demoted to guarded fallback-only; 50/50-ACFR end state documented; no data regression on any of the 50 ACFR nodes.
- **Phase 124 (VER-09, VER-10):** Verified end-to-end — **149/151 loader-independent blind re-derivations at exact $0** (2 explained rounding), a **14/14-invariant 50-node / 1,560-row cohort audit** (50/50-ACFR, NASBORT-01, LOAD-01 clean, 0 residue no manual re-clean), and **Chris live-app UAT 12/12 all-pass**.
- **Also shipped this cycle (outside the milestone):** a search-first landing page (removed the "Available communities" browse grid) and hero banners re-sourced from the shared Empowered Vote asset bucket with attribution.

**Known deferred items at close:** 1 (todo `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction`, frontend-routing — see STATE.md Deferred Items). The three Longview-TX / Collin-County quick tasks flagged by the close audit are verified-complete (audit filename-detection quirk, not real gaps).

---

## v2.14 State ACFR Long Tail — Tranche 3 + Deepening (Shipped: 2026-07-03)

**Phases completed:** 6 phases (111–116), 20 plans
**Git range:** `ad21f17..8159ab6` — 112 commits, 142 files, +20,813 lines (2026-07-02 → 2026-07-03)

**Delivered:** Three moves, all landed. **(1)** Retired the WR-05 loader debt — the `process*Acfr.js` `data_sources` write became an ephemeral lifecycle across all 35 state loaders, so a full run (including an idempotent re-run) leaves **0 residue with no manual re-clean** — closing the residue class that required hand-deletion at every prior close (106: 10 rows, 110: 20 rows). **(2)** Grew the State-ACFR GAAP cohort **19 → 29 states** — Batch 1 (IN/AZ/OR/MO/CO) + Batch 2 (SC/KY/UT/AL/LA) upgraded NASBO→full ACFR GF revenue-by-source + finer spending-by-function, most back to FY2002 (24 years), every year tying its printed GF column total. **(3)** Recovered the v2.13 history holes via a new pre-GASB-34 extractor — CT to a 38-year contiguous series (FY1988–2025), WI to 26 years, NJ contiguous FY2002–2025, MA 2/6 holes recovered + 4 documented unrecoverable — all with honest pre-GASB-34 basis labels. Cohort now **29 ACFR + 21 NASBO = 901 state rows, 0 anomalies**. Free ACFR PDFs only, $0 AI spend, executed inline.

**Key accomplishments:**

- **Phase 111 (loader debt / LOAD-01):** All 35 state loaders now clean up their own `data_sources` rows (ephemeral lifecycle) — the WR-05 residue class that required manual deletion at every milestone close is closed, proven by a live NJ FY2025 re-run bracketed by the cohort-audit probe with **zero manual cleanup**.
- **Phase 112 (recon / RECON-09/10):** Ranked the remaining 31 NASBO states by FY2024 GF size (0 transcription drift), located + bookend-tied the ACFR GF statement for all 10 candidates at exact $0 diffs, and locked the final tranche-3 roster (IN/AZ/OR/MO/CO ∥ SC/KY/UT/AL/LA) with one bounded rank-correction substitution (Oklahoma out → Alabama in); overlaps resolved on paper (UT state node probed clean, 19 existing ACFR nodes undisturbed), $0 DB writes.
- **Phase 113 (Batch 1 / ACFR-21..25):** **IN (FY2002–2025, 24yr), AZ (FY2002–2024, 23yr), OR (FY2022–2025), MO (FY2012–2025, 14yr), CO (FY2023–2025)** live on full State-ACFR GAAP, every year tying $0; CO exercised the tranche's primary live P2 clamp (TABOR years); AZ FY2024 Drive-link durability caveat documented.
- **Phase 114 (Batch 2 / ACFR-26..30):** **SC (24yr), KY (23yr, FY2023 honest hole), UT (FY2019–2025), AL (24yr), LA (24yr)** upgraded NASBO→ACFR GAAP, all tying $0; the three narrower/broader-than-NASBO scope divergences resolved honestly at load time as GF-alone decisions — UT (~0.83× income-tax earmark), AL (~0.24× constitutional dual-budget), LA (~1.90×, ~99% federal Intergovernmental Revenues).
- **Phase 115 (deepening / DEEP-02/03/04):** Built a reusable pre-GASB-34 extractor (`pre34Extract.mjs`) — deepened **CT to a 38-year contiguous series (FY1988–2025)** and **WI to 26 years (FY2000–2025)** (CT FY2006 recovered via free OCR), extended **NJ to contiguous FY2002–2025**, and recovered **MA FY2001 + FY2014** (deepening MA to 21 years) with the other 4 MA holes rigorously documented as unrecoverable.
- **Phase 116 (verification / VER-07/08):** **75/75 loader-independent blind re-derivation checks tie at exact $0** across all 14 states; new 12-invariant read-only cohort audit confirms the 29-ACFR/21-NASBO cohort (901 rows) fully sourced/windowed/deduplicated/basis-labelled (incl. a pre-GASB-34 label distinctness check) and proves **LOAD-01 end-to-end (0 manual re-clean, a series first)**; **Chris live-app UAT 11/11 all-pass (2026-07-03)**.

**Known deferred items at close: 5** (see STATE.md Deferred Items) — 3 pre-existing Longview-TX quick-task stubs (orphaned, acknowledged at every close since v2.0), the v2.12 authenticated-deep-link-redirect todo, and the (passed) Phase 116 UAT artifact. Tech debt carried (all advisory, none affect correctness): WR-04..07 loader error-path robustness (never manifested — 0 residue everywhere this milestone); AL "Charges"→"Changes" category-label drift (FY2018+, unverified against source, ties unaffected); UT trailing-space category name; NJ phantom-comment referencing a non-existent guard function. See v2.14-MILESTONE-AUDIT.md.

---

## v2.13 State ACFR Long Tail — Tranche 2 (Shipped: 2026-07-02)

**Phases completed:** 4 phases (107–110), 16 plans
**Git range:** `70f6e67..81c56c4` — 47 commits, 134 files, +10,853 lines (2026-06-30 → 2026-07-02)

**Delivered:** Doubled the State-ACFR cohort — brought the next **10 largest-General-Fund NASBO states (NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI)** onto full ACFR GAAP GF revenue-by-source + spending-by-function, each as deep as durable ACFR URLs allow, NASBO operating replaced in place idempotently. Cohort now **19 ACFR states (444 rows) + 31 NASBO = 506 state rows, 0 anomalies**. Free PDFs only, $0 AI spend.

**Key accomplishments:**

- **Phase 107 (recon):** all 10 candidate states locked IN — 0 substitutions/deferrals; per-state GF statement located, bookend tie-confirmed, durable per-year URLs + gap logs written; the NJ dollars-unit trap, MI Sep-30 FY-end, MA in-place-upgrade path (v1.8 DLS node, no duplicate), and GA F-97-01 supersede all caught before any write.
- **Phase 108 (Batch 1):** **NJ, MA (in-place), NC, GA (F-97-01 superseded cleanly at $59.9B), MD** upgraded NASBO→ACFR GAAP; MD FY2022 P2 clamp on −$275,992K investment loss with parent total intact; verified retroactively 4/4 success criteria + dedicated 7/7 UAT incl. live idempotency re-run ("Loaded 0 rows", DB-asserted 0 net change).
- **Phase 109 (Batch 2):** **TN 17yr, CT 23yr, WI 24yr, WA 6yr, MI 7yr = 77 state-FYs** loaded with 6 live P2 clamps; scope divergence (1.14× CT to 3.56× MI) accepted + relabelled honestly; shared parser evolved additively (108-era extraction paths untouched).
- **Phase 110 (verification):** **49/49 loader-independent blind re-derivation checks tie at exactly $0** (bookends + newest FY + clamp years, zero loader imports); 50-state cohort source-chain audit **10/10 invariants** clean; WR-05 residue re-cleaned (20 rows).
- **Chris live-app UAT 11/11 all-pass (2026-07-01)** — revenue-by-source, spending-by-function, basis labels, source chips, Money In auto-enabled across the upgraded states; plus the 108-closure UAT 7/7 (2026-07-02).

**Known deferred items at close: 5** (see STATE.md Deferred Items) — 3 pre-existing Longview-TX quick-task stubs, the v2.12 authenticated-deep-link-redirect todo, and the (passed) Phase 110 UAT artifact. Tech debt carried: WR-05 loader data_sources residue (recurs every loader run until upsert is atomic); recoverable history holes (MA FY2001/02/04/05/14/21, CT FY2006 OCR, NJ pre-2020, CT/WI pre-GASB-34); state-node hero banners default to Wikipedia flag images (cosmetic, fix paths diagnosed in 108-UAT.md).

---

## v2.12 State ACFR Long Tail (Shipped: 2026-07-01)

**Phases completed:** 4 phases (103–106), 13 plans

**Delivered:** Extended the proven State-ACFR GAAP upgrade in two directions — deepened the four v2.11 pilots' (CA/TX/NY/FL) ACFR history backward, and brought **Pennsylvania + Illinois** (the two largest remaining NASBO states) onto full ACFR GF revenue-by-source + finer spending-by-function — all independently re-derived, cohort-clean, basis-labelled, and signed off live by Chris. Free PDFs only, `$0`/no paid AI.

**Key accomplishments:**

- **Phase 103 (recon):** located durable deeper-history ACFR URLs for CA/NY/FL/TX and the **PA + IL** ACFR Governmental-Funds *Statement of Rev/Exp* (GF column, units, per-year URLs), each bookend tie-confirmed, with per-state gap logs — the input contract for the loads.
- **Phase 104 (deepen 4 pilots):** extended **CA** (FY2008–2025, +12 yrs via `/Files-ARD/CAFR/cafr{NN}web.pdf`, FY2008 bookend $97,774,378,000), **NY** (FY2003–2014, +12 yrs, ×millions scaling), and **FL** (+FY2021); every added FY ties exactly to its GF column total; P2 clamp fires on FL FY2021's −$398,287K investment loss with root total preserved.
- **Phase 105 (PA + IL — headline):** brought **Pennsylvania** (FY2016–2025) and **Illinois** (FY2021–2025) onto full State-ACFR GAAP revenue-by-source + spending-by-function; NASBO operating replaced in place idempotently (RECON-05); scope divergence accepted + relabelled honestly (PA ~2.0×, IL ~1.5× NASBO GF); P2 clamp on IL FY2022; "Money In" auto-enabled on both nodes.
- **Phase 106 (verification + UAT):** **24/24 loader-independent blind ACFR re-derivations at exact $0 delta**; 50-node cohort source-chain audit **7/7 invariants** over 276 rows (all basis-labelled, 41 NASBO states untouched, idempotent, D-06 holes recorded + honest); **Chris live-app UAT sign-off (8/8 anchors)**.
- **In-milestone UI fix (surfaced during UAT):** reordered the data-viz palette so adjacent categories contrast, and added `hoistSingleRoot` to drop the redundant single-root "…General Fund Budget · 100%" layer — deployed to production. Also corrected malformed UAT deep-links to the canonical `?entity=&year=` format.

**Known deferred items at close: 5** (see STATE.md Deferred Items) — 3 pre-existing Longview-TX quick-tasks, 1 authenticated-deep-link-redirect follow-up todo, and the (passed) Phase 106 UAT artifact.

---

## v2.11 State ACFR Revenue-by-Source Upgrades (Shipped: 2026-06-30)

**Phases completed:** 5 phases (98–102), 13 plans

**Delivered:** Upgraded the four highest-traffic state nodes (CA, TX, NY, FL) from NASBO operating-only estimates to real **State-ACFR GAAP** General-Fund data — revenue-by-source + finer spending-by-function — basis-labelled, durably sourced, independently verified, then signed off live by Chris.

**Key accomplishments:**

- **Phase 98 (recon):** de-risked the CA v1.7 overlap and located all 4 state ACFRs (durable per-year URLs, GF column, units, windows, tie-confirmed bookends) before any load.
- **Phase 99 (CA + TX):** loaded CA FY2020–25 + TX FY2015–24 GF revenue + spending from their ACFRs via `pdftotext -table`, replacing NASBO operating idempotently; proved the per-state upgrade path. TX GR-Fund ~3× scale accepted + relabelled honestly.
- **Phase 100 (NY + FL):** reused the loader pair for NY FY2015–24 (×millions scaling) + FL FY2022–24; extended the stale-`data_sources` cleanup; P2 negative-category clamp fired on NY/FL.
- **Phase 101 (frontend):** pure `resolveEffectiveDataset` helper + App.tsx hardening so the "Money In" revenue-by-source view auto-enables on the 4 nodes and `?dataset=revenue` deep-links validate against availability (fall back to operating on NASBO-only nodes), no regression.
- **Phase 102 (verification + UAT):** loader-independent re-derivation of GF printed totals for the 8 newest+bookend ACFR statements — **16/16 exact ties** ($0 delta); 50-node cohort source-chain audit **7/7 invariants** with genuine **0 residue** (145 stale `*-gf-*` data_sources deleted, 0-row guarded; 46 NASBO states untouched); **Chris signed off the live-app UAT.**

**Cost/safety:** free ACFR PDFs only, `$0`/no-AI extraction; ACFR replaces NASBO per state-FY idempotently; every displayed figure basis-labelled + sourced.

---

## v2.10 State General Fund Sourcing (Shipped: 2026-06-29)

**Phases completed:** 4 phases (94–97), 16 plans

**Delivered:** Replaced the all-50-states unsourced "best guess" estimate state-node General Fund data with real, sourced actuals on the Chris-locked **hybrid** model: **MN/OH/VA** on State **ACFR GAAP** (operating + revenue), the other **47 states** (46 cohort + Georgia) on **NASBO 2025 SER** General Fund operating actuals (FY2023+FY2024). Every displayed figure is durably sourced + basis-labelled (GAAP vs budgetary); 375 unsourced estimate rows deleted (revenue-by-source deferred to future per-state ACFR upgrades — nothing unsourced displayed). Reusable loader `scripts/loadStateGF.mjs` + locked cross-cutting policy (`94-01-POLICY.md`) proven on Georgia FY2023; MN extended FY2008–2025; OH/VA falsely-sourced rows replaced. Phase 97 verified the whole 50-node cohort real+sourced+residue-free (0 unsourced/null/out-of-window/dup/orphan/garbage), reconciled the "Representative 7" independently from source documents, caught + fixed **F-97-01** (GA FY2023 Medicaid: stale 2024-SER value → 2025 SER, children now sum to parent), and earned **Chris's live UAT sign-off (21/21, 2026-06-29)**. Negative-investment-income years (MN/OH/VA FY2022) handled honestly (clamped to 0 with explanatory labels, parent totals preserved). Executed inline ($0 — no research/planner/executor subagents).

**Archive:** [v2.10-ROADMAP.md](milestones/v2.10-ROADMAP.md) | [v2.10-REQUIREMENTS.md](milestones/v2.10-REQUIREMENTS.md)

**Deferred at close (documented, not silent):** cohort revenue-by-source (NASBO has none per-state → future per-state ACFR upgrades); per-state ACFR operating upgrades for high-traffic states; MN FY1997–2007 history + the MN FY2008 operating $8.79M categorization gap (0.055%); minor `?dataset=revenue` URL robustness on operating-only nodes; 3 stale Longview TX quick-task dirs (unrelated, orphaned).

---

## v2.9 Minnesota Local Government Expansion (Shipped: 2026-06-28)

**Phases completed:** 5 phases (89–93), 13 plans

**Delivered:** Every Minnesota city + county government brought onto Treasury Tracker at parity from the single uniform MN Office of the State Auditor "City/County Finances Report" raw XLSX (osa.state.mn.us, free, no auth) — two-level revenue-by-source + expenditure-by-function trees with real icicle drill-down (resolving the Ohio flat-source limitation), per-capita, every figure sourced. **858 cities (20,414 rows) + 87 counties (1,380 rows) + a Minnesota state node + 136 universal enrichment rows.** Cities linked to parent county via the built-in `ParentEntityName`; GAAP/Cash basis per-entity via `GAAPInd`; standardized bleed-safe enrichment inline at $0; reconciled against published ACFRs (Hennepin exact, Minneapolis explained), full-cohort source-chain audit clean, independent workbook re-derivation exact, Chris live UAT all-pass (2026-06-27). **Also caught + fixed:** the MN state node's unsourced "best guess" General Fund data was replaced with real State-of-MN ACFR GAAP actuals (FY2023–2025) — which surfaced a cohort-wide problem now chartered as v2.10.

**Archive:** [v2.9-ROADMAP.md](milestones/v2.9-ROADMAP.md) | [v2.9-REQUIREMENTS.md](milestones/v2.9-REQUIREMENTS.md)

**Deferred at close:** salaries (`Employee Data`), enterprise funds, pre-2015 history, townships (MNSAL/MNENT/MNHIST/MNTWN-01); MN state-node history FY2021/2022+ (→ v2.10).

## v2.8 Ohio Local Government Expansion (Shipped: 2026-06-26)

**Phases completed:** 5 phases (84–88)

**Delivered:** Ohio cities + county governments brought onto Treasury Tracker at parity from the uniform Ohio Auditor of State Summarized Annual Financial Reports XLSX (ohioauditor.gov, free, no auth) — general-government revenue-by-source + expenditure-by-function, per-capita, every figure sourced. 253 cities (4,880 rows) + 88 counties (1,736 rows), linked + enriched + ACFR-reconciled, Chris UAT sign-off 2026-06-26. Accepted limitation: flat AOS source → no icicle drill-down.

**Archive:** [v2.8-ROADMAP.md](milestones/v2.8-ROADMAP.md) | [v2.8-REQUIREMENTS.md](milestones/v2.8-REQUIREMENTS.md)

## v2.7 Virginia Local Government Expansion (Shipped: 2026-06-24)

**Phases completed:** 6 phases (79–83, incl. inserted out-of-scope EV Phase 81.5), 10 plans, 24 tasks

**Delivered:** Every reporting Virginia locality brought onto Treasury Tracker at parity from the single uniform APA Comparative Report XLSX (data.virginia.gov, free, no auth) — general-government revenue by source + expenditure by function→activity (2-level tree), per-capita, every figure sourced. 162 entities / 618 budget rows across FY2023 + FY2024-amended; independent cities render standalone, counties as their own nodes, towns linked to their parent county under a new Virginia state navigation node; standardized bleed-safe plain-language enrichment for the full VA vocabulary; reconciled against published ACFRs and signed off by Chris in the live app. $0 spend (one reusable loader; inline-authored enrichment).

**Key accomplishments:**

- **VA APA source + loader (Phase 79)** — built `scripts/loadVAComparativeReport.js` (exceljs): function→activity expenditure tree (Exhibit C + C1–C8) + revenue-by-source (Exhibit B/B2) + per-FY population (Exhibit H), every figure attributed to data.virginia.gov; proven on Alexandria FY2024 ($863,578,347 exp / $874,230,660 rev, exact); 7/7 offline tests; available XLSX FY range determined (FY2023 + FY2024) (VASRC-01/02).
- **City + county loads (Phase 80)** — section-aware + homonym-safe batch driver loaded 127 of 133 cities + counties (op + rev, FY2023 + FY2024-amended), every row sourced, idempotent; 6 multi-year late-filers documented as a residual source gap (VALOAD-01/02/04).
- **Towns + VA data model & linking (Phase 81)** — all 37 reporting towns batch-loaded (Exhibit A population fallback); a sourced 37-entry town→county map (Census 2020) + idempotent seeder establishing the Virginia state node and linking 33 towns to their parent county; four surgical frontend edits make VA selectable with county/city/town navigation (VALOAD-03, VALINK-01).
- **EV Micro-Donation Transparency (Phase 81.5 — inserted, out-of-milestone EV financials)** — honest recurring-supporter stat (9 supporters, median $10/mo, reconciled to FY2026 exports, zero PII) + a locked "free for everyone" headline + a soft recurring-donate invite on the EV nonprofit view; deployed (EVMICRO-01/02/03).
- **Enrichment parity (Phase 82)** — 73 standardized, bleed-safe, state-neutral universal `category_enrichment` rows authored inline at $0 via an explicit map + 100% coverage gate (delete-then-insert, NULLS-DISTINCT-safe); corrected a stale shared `miscellaneous`→"Information Technology" universal that was wrong for VA and MA (VAENR-01).
- **Verification + source-chain audit + UAT (Phase 83)** — Alexandria + Fairfax County reconciled to published FY2024 ACFRs within an explained ~±5% basis tolerance (Fairfax function taxonomy ties, Education $2,653.1M); full-cohort source-chain audit clean (618 rows: 0 NULL/fragile/residue after stamping 10 Virginia state-node rows with the DPB source) + enrichment re-confirmed clean; live-app UAT across a city + county + town signed off by Chris (VAVER-01/02).

**Known deferred items at close:** 6 acknowledged (see STATE.md Deferred Items — none are v2.7 blockers): 3 UAT entries (resolved / signed-off), 3 unrelated pre-v2.0 Longview-TX quick-task stubs. **v2.7 follow-ups (documented, not fixed):** 6 localities + 3 towns absent from all published XLSX years (multi-year-overdue audits) + Covington/Alleghany null population — picked up idempotently on a future re-run.

**Archive:** [v2.7-ROADMAP.md](milestones/v2.7-ROADMAP.md) | [v2.7-REQUIREMENTS.md](milestones/v2.7-REQUIREMENTS.md)

---

## v2.6 EV Financial Transparency Refresh (Shipped: 2026-06-22)

**Phases completed:** 4 phases (74–78; Phase 77 iceboxed), 8 plans

**Delivered:** Empowered Vote's own organizational financials brought fully up to date and made donor-facing — income from every platform (GiveButter, Patreon, Benevity) + bank interest + manual entries merged idempotently with no double-counting, the Beneficial State Bank established as authoritative balance/expense truth, a gross→net "cost of fundraising" story, an honest neutral expense breakdown, funds-on-hand + burn pace, and a fundraising-goal scaffold — every figure sourced and reconciled to the bank within an explained tolerance, signed off by Chris in the live app. The actual "where the money goes" graphic (EVVIZ-01) was deliberately iceboxed. $0 spend (CSV merge, no new AI runs).

**Key accomplishments:**

- **Donation source refresh (Phase 74)** — FY2026 income refreshed from platform exports (GiveButter $703 / Patreon $370 / Benevity $1,475 + $0.51 interest = $2,548.51, up from $1,256.51), merged idempotently and dedup'd (export baseline + webhook delta), aggregate-only with no donor PII; `scripts/loadEVDonations.js` + tests; fixed a Benevity cross-year double-count (EVDATA-01/02/03).
- **Bank truth + reconciliation (Phase 75)** — Beneficial State Bank made authoritative for balance ($1,706.77) and expenses ($1,745.65: AI & Research, Infra & Hosting, Design, Domains, Bank Fees); platform income reconciled against net bank payout deposits with a stored explained variance (−$132.39, never double-counted); manual/off-platform path; platform fees tracked as an income reduction ($125.32, the cost-of-fundraising story); new `treasury.org_financial_summary` table; 24/24 tests (EVDATA-04/05/06).
- **Donor-facing transparency view (Phase 76)** — rendered the reconciled figures on EV's page: gross→net fee sentence + per-source mini-list, honest neutral expense breakdown, a Funds-on-Hand header chip, a burn-pace line (runway intentionally dropped as misleading for an all-volunteer org), and a data-driven goal-progress scaffold; cross-repo `org-financial-summary` API wired into `dataLoader.ts`; Chris live UAT pass (EVVIEW-01/02/03/04).
- **"Where the Money Goes" graphic (Phase 77) — ICEBOXED** — deferred deliberately: EV's ~6 flat expense categories make the existing tree-chart vocabulary near-degenerate, and the Phase 76 view already renders the breakdown by category; revisit in a future milestone (EVVIZ-01 deferred).
- **Reconciliation audit + live-app UAT (Phase 78)** — audited FY2026 figures against production Supabase: bank balance authoritative, platform income reconciles within the explained −$132.39 tolerance, every displayed figure carries a source, and the revenue total ties to the penny ($2,548 donations + $1.17 bank interest = $2,549.17); Chris approved the live-app UAT (EVVER-01/02).

**Known deferred items at close:** 4 acknowledged (see STATE.md Deferred Items — none are v2.6 blockers): Phase 77 / EVVIZ-01 graphic (deliberate icebox); 3 unrelated Longview-TX / city-data quick-task stubs. The fundraising **goal amount** is intentionally left unset (tile hidden; infra + the "Midterms Support" label are committed and ready to switch on).

**Archive:** [v2.6-ROADMAP.md](milestones/v2.6-ROADMAP.md) | [v2.6-REQUIREMENTS.md](milestones/v2.6-REQUIREMENTS.md)

---

## v2.5 Utah Municipal Expansion (Shipped: 2026-06-20)

**Phases completed:** 7 phases (68–73, incl. inserted 71.1), 14 plans, 27 tasks

**Delivered:** 10 Utah cities + their 5 county governments brought onto Treasury Tracker at full California parity — operating + revenue budgets (all-funds FY2014–2025), employee compensation, category enrichment, and city→county linking — every figure durably sourced to the Utah State Auditor's Transparent Utah dataset, verified against published ACFRs and signed off by Chris in the live app. New tooling = one BigQuery loader. ~$0 spend (after a same-day cost incident was caught and fixed).

**Key accomplishments:**

- **Utah BigQuery source + loader (Phase 68)** — established free BQ-sandbox access to the Transparent Utah table `ut-sao-transparency-prod.transaction.transaction`, mapped all 15 entity_name strings, and built `scripts/loadUtahTransparency.js` (mirrors `bulkLoadStateController.js` — same tree shape, RPC, never-overwrite guard; 23 offline unit tests) (UTSRC-01/02).
- **City budgets (Phase 69)** — all 10 cities loaded operating + revenue FY2014–2025 (all-funds `fund1→org1→cat1` tree), Census-2024 per-capita; SLC + Provo reconciled (Provo penny-exact vs the independent baseline) (UCITY-01/02).
- **County budgets + linking (Phase 70)** — 5 county governments (Salt Lake, Utah, Davis, Weber, Washington) loaded op/rev + linked their cities via `county_id`; recovered a phantom-county-row incident with an `--entity-type` fix; 8 cities renamed to display names (dropped "City" except SLC/WVC) (UCO-01/02).
- **City salaries (Phase 71)** — names-free PY→salaries path; 10 cities loaded FY2014–2025 (120 rows), Provo reconciled at −$0.22 rounding delta, PII-exclusion guard test (USAL-01).
- **Cost-fix rollup ETL (Phase 71.1)** — replaced the per-`(entity,FY,type)` live-query pattern (which ran ~21 TiB / ~$132 on 2026-06-19) with one cost-gated `--rollup` GROUP BY scan loading all 15 entities × FY2014–2025 × EX/RV/PY into Supabase for ~$0.29, idempotently (UETL-01).
- **Enrichment parity (Phase 72)** — 3,536 standardized, bleed-safe universal `category_enrichment` rows authored inline at $0 (33 Utah fund concepts + county-gov set); fixed a NULLS-DISTINCT duplicate-insert incident with delete-then-insert (UENR-01).
- **Verification + audit + UAT (Phase 73)** — Provo + **Salt Lake County** (first UT county-gov ACFR cross-read) reconciled within explainable all-funds tolerance; full-cohort source-chain + bleed audit CLEAN (op 180 + rev 180 + salaries 179: 0 NULL/fragile/residue, 0 PII across 179 salary trees, enrichment 4,476 universal / 0 dups / 0 city-name leaks); 22-item live-app UAT across 4 entities, all PASS, Chris signed off (UVER-01/02).

**Known deferred items at close:** 5 acknowledged (see STATE.md Deferred Items — none are v2.5 blockers): Phase 73 UAT-checklist flag (false positive; UAT passed), Phase 71 verification `human_needed` flag (stale; covered by Phase 73 UAT), 3 unrelated Longview-TX quick tasks. **v2.5 follow-ups (Phase 73, documented not fixed):** 4 pre-existing non-P72 `$`-leak universal enrichment rows (bleed cleanup); Salt Lake County FY2025 salaries (fills on next FY2025-complete rollup refresh).

**Archive:** [v2.5-ROADMAP.md](milestones/v2.5-ROADMAP.md) | [v2.5-REQUIREMENTS.md](milestones/v2.5-REQUIREMENTS.md)

---

## v2.4 Southern California Expansion (Shipped: 2026-06-17)

**Phases completed:** 5 phases (63–67)

**Delivered:** The 6 remaining Southern California counties brought onto the tracker via the hardened v2.2/v2.3 pipeline with zero new data-loading tooling — completing California's major-population coverage. ~95 cities loaded + county-linked (operating + revenue FY2003–2024 from SCO ByTheNumbers, per-year population, never-overwrite guard); 8 county governments loaded with their own op/rev budgets (the 6 SoCal counties + Alameda + Sacramento, no longer directory-only); statewide GCC salaries swept for all 95 new cities (FY2009–2024); enrichment brought to parity inline at $0. Every figure carries a durable source row.

**Key accomplishments:**

- **SoCal county cities load + linking (Phase 63)** — Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial counties' cities loaded operating + revenue FY2003–2024, auto-created with per-year SCO populations, linked via `county_id` (US→California→county→city breadcrumb + Cities-in-County panel); cities already loaded from a richer custom source (e.g. San Diego city) preserved by the never-overwrite guard (SOCAL-01..06).
- **SoCal county-government budgets (Phase 64)** — `loadCountyBudget.js` loaded op/rev FY2003–2024 for the 6 SoCal counties plus the 2 previously directory-only counties (Alameda, Sacramento); all 8 county pages now render icicle/summary + per-capita (CGB-01).
- **SoCal salaries sweep (Phase 65)** — CA Government Compensation FY2009–2024 loaded for all 95 new SoCal cities via `loadCASalaries.js`, sample reconciled to the source at $0 delta (SAL-07).
- **SoCal enrichment parity (Phase 66)** — 185 universal bleed-safe `category_enrichment` rows authored inline at $0 (ENR-03); single-city salary department-name long tail re-deferred.
- **Verification + audit + UAT (Phase 67)** — Ventura County reconciled to its published ACFR on a documented all-funds basis; full-cohort source-chain durability audit (5,968 budget rows — 0 fragile URLs, 0 residue); 20-item live-app UAT across 4 entities, all PASS, Chris signed off (VER-05, VER-06).

**Known deferred items at close:** Broader per-entity independent ACFR cross-read for the SoCal sample (only Ventura fully reconciled; several ACFR PDFs were blocked/non-extractable) — VER-05 follow-up. Plus the carried v2.3 follow-ups FUP-01..03 (Glendale/Burbank ACFR, Employees-card year-gating UX, single-city salary department-name canonicalization long tail).

**Archive:** [v2.4-ROADMAP.md](milestones/v2.4-ROADMAP.md) | [v2.4-REQUIREMENTS.md](milestones/v2.4-REQUIREMENTS.md)

---

## v2.3 California Coverage Parity (Shipped: 2026-06-17)

**Phases completed:** 5 phases (58–62), 15 plans, 41 tasks

**Delivered:** Every already-loaded non-OC California city and county brought up to the Orange County standard — FY2003 budget-history depth, statewide salaries (2009–2024), and standardized enrichment — by re-running the hardened v2.2 SoCal pipeline with no new tooling. The 12 named custom-source cities (LA, SF, etc.) kept their richer custom budgets untouched via a never-overwrite guard. Every backfilled figure carries a durable ByTheNumbers source row; reconciled against published ACFRs and signed off by Chris in the live app.

**Key accomplishments:**

- **LA County parity backfill (Phase 58)** — operating + revenue back to FY2003 for the 88 LA County cities (86/88 reach FY2003; 2 SCO source gaps) + the LA County government entity (44 op/rev rows FY2003–2024), all SCO-sourced with per-year population; 3 custom cities untouched; basis note renders for Long Beach + West Hollywood only.
- **Remaining CA cities history + linking (Phase 59)** — layered SCO all-governmental-funds FY2003 history beneath 7 thin custom-source cities (custom rows preserved), created the 4 missing linking-only county nodes, linked the 5 county-bound cities, kept San Francisco as a clean single combined city-county node, and removed the budget-less Test artifact.
- **Statewide CA salaries sweep (Phase 60)** — CA Government Compensation salaries FY2009–2024 loaded for all 98 non-OC CA cities in 16 download-once passes (0 gaps, 0 failures, 2.5M source records), Los Angeles's curated payroll preserved by the guard; 3 sampled cities reconcile to the official GCC export at $0 delta.
- **Enrichment parity (Phase 61)** — 528 universal `category_enrichment` rows authored inline at $0 (op/rev 100% coverage, salary departments shared by ≥2 cities), bleed-safe; the 5,226 single-city salary department-name long tail deferred to v2.4.
- **Verification + audit + UAT (Phase 62)** — ACFR reconciliation for 5 sample entities (3 fully reconciled with explained basis residuals; Glendale + Burbank documented as CDN-access follow-ups); full-cohort source-chain audit PASS (SCO-NULL `source_url`=0, 0 fragile URLs, 0 residue across 25,568 rows); 24-item live-app UAT across 4 CA entities — all PASS, Chris signed off (signoff-all-pass).

**Milestone audit:** No separate `/gsd:audit-milestone` run — Phase 62 was a dedicated end-to-end verification phase that satisfied VER-03 + VER-04 (4/4 success criteria, see `62-VERIFICATION.md`), covering ACFR reconciliation, source-chain durability, and live-app UAT sign-off.

**v2.4 follow-ups (documented, not fixed — verification-only phase, D-08):** Glendale + Burbank ACFR reconciliation via manual browser download (CDN blocks CLI fetch); the "Employees" salaries-card year-gating UX (card hidden for years outside the salaries range — consider showing whenever salaries exist for any year + prompting a year switch); the 5,226 single-city salary department-name canonicalization long tail.

**Known deferred items at close:** 4 non-blocking items acknowledged (re-deferred) — Phase 62's `62-03-UAT-CHECKLIST.md` flagged only because the file exists (0 pending scenarios; UAT signed off all-pass) + the 3 orphaned pre-v2.0 quick-tasks carried since the v2.0/v2.1 closes (`001-create-treasury-tracker-entries`, `002-add-longview-tx-revenue`, `003-longview-operating-budget` — files missing, unrelated to CA parity). See STATE.md Deferred Items.

**Archive:** [v2.3-ROADMAP.md](milestones/v2.3-ROADMAP.md) | [v2.3-REQUIREMENTS.md](milestones/v2.3-REQUIREMENTS.md)

---

## v2.2 Orange County + Reusable SoCal Pipeline (Shipped: 2026-06-16)

**Phases completed:** 6 phases, 15 plans, 31 tasks

**Delivered:** All 34 Orange County cities loaded onto the tracker (operating + revenue, FY2003–2024) from the CA State Controller's uniform open data, plus the OC county-government's own budget — and the bulk loader hardened into a documented, one-command pipeline any remaining SoCal county can reuse. Net-new: statewide per-city salaries from CA Government Compensation. Every figure carries a durable source row; all verified against published ACFRs with Chris UAT sign-off.

**Key accomplishments:**

- **SoCal bulk pipeline hardened + generalized (Phase 52)** — `bulkLoadStateController.js` loads any CA county with durable `source_url`/`source_date`, persists feed population, and refuses to overwrite cities loaded from another source; `seedCountyLinks.js` seeds + links any county in one command; `docs/socal-county-onboarding.md` documents the full load→seed→link→enrich→verify sequence, proven to generalize via a zero-write Ventura County dry-run.
- **All 34 OC cities loaded (Phase 53)** — operating + revenue FY2003–2024 from ByTheNumbers; 32 net-new cities auto-created with per-year SCO populations (per-capita renders on first load); Anaheim & Santa Ana untouched.
- **OC entity, linking + enrichment (Phase 54)** — Orange County entity seeded, all 34 cities linked via `county_id` (US → California → Orange County → city breadcrumb + Cities-in-County panel), standardized category enrichment authored inline at $0, bleed-safe and consistent with the LA County baseline.
- **Statewide city-salaries integration (Phase 55, net-new)** — reusable `loadCASalaries.js` builds a names-free Department→Position Total Compensation tree from the CA State Controller GCC export; all 34 OC cities loaded 2009–2024 (544 rows, 0 gaps); Irvine 2024 reconciles to the published $190,426,283 at $0 delta.
- **Verification + UAT (Phase 56)** — `verify-phase56.mjs` 7/7 PASS (exit 0); OC totals independently reconciled against published ACFRs on a basis-matched all-funds basis (Laguna Woods to the dollar); a UAT-discovered breadcrumb defect root-caused and fixed in-phase (API + frontend), then Chris signed off all 5 navigation surfaces.
- **OC county-government budget (Phase 57)** — reusable `loadCountyBudget.js` (the runbook's Step 5 tool) loaded OC's operating + revenue FY2003–2024 (44 rows, ~$2.6B–$6.4B/yr) onto the county entity with per-year population and durable `/d/<id>` attribution; FY2024 op total $6.42B exact match; OC county page now renders icicle/summary + per-capita (no longer directory-only); `verify-phase57.mjs` exits 0.

**Milestone audit:** PASSED — 16/16 requirements satisfied (PIPE-01..04, OC-01..05, SAL-01..03, VER-01/02, OCB-01/02), 6/6 phases verified, 0 broken flows, 0 cross-phase gaps. SOCAL-01..06 (6 more SoCal counties) explicitly deferred to a future milestone; the hardened pipeline generalizes to support them. See `milestones/v2.2-MILESTONE-AUDIT.md`.

**Known deferred items at close:** 4 non-blocking items acknowledged (re-deferred) — Phase 57's `57-HUMAN-UAT.md` flagged only because the file exists (status `passed`, 0 pending scenarios; UAT signed off) + the 3 orphaned pre-v2.0 quick-tasks carried from the v2.0/v2.1 closes (missing files). See STATE.md Deferred Items.

**Archive:** [v2.2-ROADMAP.md](milestones/v2.2-ROADMAP.md) | [v2.2-REQUIREMENTS.md](milestones/v2.2-REQUIREMENTS.md) | [v2.2-MILESTONE-AUDIT.md](milestones/v2.2-MILESTONE-AUDIT.md)

---

## v2.1 Federal History (Shipped: 2026-06-14)

**Phases completed:** 3 phases, 13 plans

**Delivered:** Every available prior federal fiscal year (FY1976→FY2024) brought up to v2.0 detail — function lens, agency lens, and revenue-by-source per year — selectable through the federal YearSelector, with honest comparability context and every figure sourced, at **$0 API spend**.

**Key accomplishments:**

- **Historical federal backfill (Phase 49)** — function (OMB Hist 3.2), agency (Hist 4.1/5.1), and receipts (Hist 2.x) detail loaded for FY1976–FY2024 plus the FY1976 Transition Quarter, every row carrying source_name/url/date and each year recomputing its own visual-vs-official disclosure; loaders parameterized across years (free OMB tables only, no LLM).
- **Federal YearSelector wiring (Phase 50)** — FY1976–FY2025 + the Transition Quarter all selectable; function/agency/revenue trees, landing bands, and the deficit strip switch per period via a centralized `parsePeriod`/`buildPeriodTokens` model; per-year per-capita/per-taxpayer denominators (FRED population + IRS returns) with honest gaps disclosed.
- **Source-chain durability + comparability + UAT (Phase 51)** — repointed every metric source_url off version-specific xlsx / raw-API URLs to durable human pages (audit **FAIL 0**, 0 fragile URLs); authored sourced comparability content (TQ + function drift + 5 Cabinet reorganizations, each verified against its GovInfo public-law record); rendered the notes in-app with source chips; Chris UAT sign-off on prod.

**Milestone audit:** PASSED — 8/8 requirements satisfied (HIST-01..04, NAV-01/02, CTX-01/02), cross-phase integration + E2E flow verified, all phases Nyquist-compliant. See `milestones/v2.1-MILESTONE-AUDIT.md`.

**Known deferred items at close:** 3 orphaned pre-v2.0 quick-tasks (`001-create-treasury-tracker-entries`, `002-add-longview-tx-revenue`, `003-longview-operating-budget`) — files missing, already acknowledged at the v2.0 close; not v2.1 scope. See STATE.md Deferred Items.

---

## v2.0 Federal Treasury Tracker (Shipped: 2026-06-13)

**Phases completed:** 6 phases, 20 plans

**Delivered:** The US Federal Government live at treasurytracker.empowered.vote — FY2025 budget visualized with maximum clarity and context, every figure and text claim sourced to an official record, never editorialized.

**Key accomplishments:**

- **Federal entity + always-sourced schema (Phase 43)** — `entity_type='federal'` end-to-end on the Phase 32 state pattern; `source_name/url/date` columns on budget + enrichment rows; `program_details` table for Tier 2 origins. No regression on city/county/state.
- **All headline federal data, sourced (Phase 44)** — FY2025 actuals both lenses (function: 18→61→1,613 nodes summing exactly to OMB Hist 1.1; agency: 29 departments, identity 0.006% vs MTS T5), OMB 8.1 split (FY2015–25), 64-year history, FY2026 FYTD, debt $39.2T — every row carries source metadata.
- **Federal visualization (Phase 45)** — proportional Mandatory/Discretionary/Net Interest landing bands + permanent receipts-vs-outlays deficit strip, function-default/agency-toggle drill, a source chip on every figure, per-capita/per-taxpayer/%-of-total scales with disclosed formulas.
- **Sourced explainer pipeline v2 (Phase 46)** — 27 Tier-1 explainers authored from fetched authoritative text only, citations stored + displayed, at **$0 API cost**; DoD failed-audit opacity flagged with GAO's verbatim disclaimer.
- **Program origins pilot (Phase 47)** — 15 major programs show enabling bill / public law / sponsor / year / cosponsors structured from Congress.gov + GovInfo, every claim linked, **zero LLM** (deterministic fetch); foundational pre-1973 programs show an honest sponsor-boundary note.
- **Source-chain verification + UAT (Phase 48)** — automated audit of 225 claim rows / 61 unique URLs → **61/61 PASS, zero residue** (govinfo via API, congress.gov via real-browser content match); Chris UAT sign-off "Looks amazing!"; US tracker pinned first on the landing grid with an American-flag tile.

**Known deferred items at close:** 5 stale/orphaned artifacts acknowledged and deferred (3 unrelated "longview" quick-tasks with missing files; 2 empty uat/verification-gap entries matching the pre-existing Phase 07/14/22/25 `human_needed` tech debt). None are v2.0 blockers — all 6 phases have complete VERIFICATION files. See STATE.md Deferred Items.

---

## v1.9 MA County-City Linking (Shipped: 2026-06-11)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Seeded 5 active MA county entities (Barnstable, Bristol, Dukes, Norfolk, Plymouth) with Census 2024 population, linked all MA cities in those counties via county_id FK, loaded each county's operating budget from individual PDFs, and enriched all 68 county budget categories (municipality_id-scoped). County breadcrumbs and CitiesInCountyPanel activated with zero frontend changes. UAT 27/27 passed.

**Phases completed:** 40–42 (3 phases, 4 plans)

**Archive:** [v1.9-REQUIREMENTS.md](milestones/v1.9-REQUIREMENTS.md)

---

## v1.8 Massachusetts All-Cities Financial Transparency (Shipped: 2026-06-10)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Loaded real budget data for all 351 Massachusetts municipalities from the MA DLS reporting portal (special-revenue + revenue-by-source report types, FY2021–FY2025), making MA the first fully-covered state. Loaded MA populations (Census 2024), upgraded MA state government from hardcoded estimates to real DLS data, and applied universal enrichment for the 14 shared DLS category names. GF Expenditures report type deferred (re-add path in 37-01-SUMMARY.md).

**Phases completed:** 37–39 (3 phases, 8 plans)

---

## v1.7 California State Budget + Deep Icicles (Shipped: 2026-06-09)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Introduced `entity_type: 'state'` infrastructure, loaded the California state budget, built 3-level tree support in ev-accounts-api, shipped the CA state 3-level icicle pilot, and selectively retrofitted deep icicles to qualifying cities.

**Phases completed:** 32–36 (5 phases, 15 plans)

---

## v1.6 California City Expansion (Shipped: 2026-06-06)

**Delivered:** Added 9 new California cities — Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana — with operating + revenue budgets, enrichment, and per-capita display. Closed two v1.5 carry-forwards (Longview TX revenue enrichment, STATE_LABELS full names).

**Phases completed:** 26–31 (6 phases, 20 plans)

**Key accomplishments:**

- Sacramento loaded via existing loadSacramentoCSV.js pipeline — FY2013–FY2026 operating + revenue (14 FYs each), 536K population, 20 enrichment rows; Phase 26 fastest in milestone
- Longview TX revenue enrichment completed (2 corrupted category names fixed, 36 rows added); STATE_LABELS full names verified in live app — carry-forwards closed in under 1 day
- Oakland (GPF biennial, $807M–$834M/yr, FY2024–2025) and San Jose (General Fund, $1.69B–$1.82B, FY2021–2025) loaded via pdfplumber — 50 enrichment rows, all 6 criteria PASS
- Long Beach ($634M–$773M GF, FY2022–2026, Port excluded) and Bakersfield (GF ~$412-427M; scope corrected from all-funds during verification) loaded; Bakersfield scope fix discovered and applied inline during enrichment phase
- Fresno (GF ~$483M, enterprise funds excluded) and Riverside (biennial, GF ~$1.45B/yr, RPU excluded) loaded — 30 enrichment rows, revenue deferred for both (no extractable GF revenue section in PDFs)
- Anaheim (GF $491M–$530M, utility enterprise filtered) and Santa Ana (GF $404M–$424M) loaded — 51 enrichment rows; all 6 criteria PASS in live app

**Stats:** 6 phases, 20 plans; 3 days (2026-06-04 → 2026-06-06); ~143 commits

**Known deferred at close:**

- Oakland revenue (OpenGov embedded chart format — not extractable via pdfplumber)
- Fresno + Riverside revenue (no extractable GF revenue section in PDFs)
- San Jose FY2016–2020 (older PDF format)

**Archive:** [v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) | [v1.6-REQUIREMENTS.md](milestones/v1.6-REQUIREMENTS.md)

---

## v1.5 Oregon Expansion (Shipped: 2026-06-04)

**Phases completed:** 9 phases, 24 plans, 36 tasks

**Key accomplishments:**

- Portland municipality seeded (id 2abac6c2, pop 635,749), two Adopted Budget PDFs downloaded, pdfplumber confirmed, Appropriation Schedule table structure documented for Plan 02 extractor, and Oregon added to city picker
- pdfplumber Python extractor and Node.js loader pipeline built and dry-run validated against both Portland Adopted Budget Vol 1 PDFs; FY2025 yields 39 bureaus totaling $8.045B and FY2026 yields 34 bureaus totaling $8.483B in full-dollar amounts
- Portland, OR operating budget live-loaded for FY2025 (39 bureaus, $8.045B) and FY2026 (34 bureaus, $8.483B), categories AI-enriched (41 rows scoped to Portland), human-verify checkpoint approved, and 17-VERIFICATION.md filed — Phase 17 ROADMAP goal confirmed met
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- Revenue extraction pipeline for Gresham: extract_revenue() + --mode argparse in extractGresham.py; buildRevenueTree() + parametric dataset_type plumbing in processGresham.js; dry-run validates 4 FYs x 10 revenue categories ($411M-$521M)
- Gresham revenue FY2023–FY2026 live-loaded ($411M/$460M/$521M/$512M), 10 categories enriched, no operating collision, Money In tab human-verified in app
- pdfplumber extractor for Troutdale's General Fund (17 depts, $21.1M) and All Funds revenue (10 cats, $33.7M) with all 8 adopted-budget PDFs downloaded and municipality seeded at population 15749
- processTroutdale.js created and validated — all 8 fiscal years (FY2019-FY2026) parse cleanly in operating and revenue dry-runs; D-02 resolved with full FY include-list for Plan 03
- Troutdale, OR live-loaded FY2019–FY2026 operating ($21.1M) + revenue ($33.7M), population 15749 for per-capita display (~$1,342/person), and 26 enrichment rows — all verified by human in the app.
- extract_requirements() added to extractGresham.py with REQUIREMENTS_CATEGORIES whitelist; processGresham.js --requirements mode loads FY2023-FY2026 all_funds_requirements rows into treasury.budgets via treasury_sync_budget_tree RPC
- table-based extract_requirements() from Vol 1 All Funds page with multi-page continuation and reconciliation fallback, loading Portland all_funds_requirements for FY2022-FY2026 ($5.9B-$8.6B)
- Troutdale all_funds_requirements extracted from All Funds Combined PDF pages and loaded to DB for FY2019-FY2026 (8 years, 7 categories, FY2026 total $81.18M) via section-gate flip of extract_revenue()
- One-liner:
- LA FY2025 revenue corrected from $44.6B to $10.2B by nulling actual_amount_column in seedCaliforniaCities.js LA_REVENUE() and reloading both fiscal years via bulkLoadBudget.js
- LA Operating Budget seeder updated with enterprise-fund exclusion filter and fiscal_years expanded to FY2017-FY2026; all 10 years reloaded with clean approved totals and department-level category trees
- Guarded enrichment.description paragraph added to PlainLanguageSummary, surfacing 2-3 sentence context for the top operating category using zero new AI calls
- Fixed General Fund-only WHERE filter to load all-funds LA budget; FY2025 Money Out tile now shows $19.86B across all 10 fiscal years

---

---

## v1.4 Geographic Expansion (Shipped: 2026-05-22)

**Delivered:** First non-TX cities launched — Los Angeles, San Francisco, and San Diego operating + revenue budgets with per-capita display and enrichment, proving the generic Socrata + CSV pipelines scale to any US city.

**Phases completed:** 15–16 (8 plans total)

**Key accomplishments:**

- Los Angeles added as first non-TX city — operating budget FY2025 ($19.8B) and FY2026 ($21.4B) with 70 enriched categories and per-capita display
- San Francisco operating + revenue loaded (FY2025+FY2026, $15.9B each) via shared Socrata dataset with `where_extra` filter splitting spending/revenue types
- San Diego operating + revenue loaded (FY2025, $4.9B op/$5.5B rev) via new CSV pipeline handling fully double-quoted seshat.datasd.org format
- LA Revenue added ($10.2B FY2025+2026, Socrata `vvm4-a2zu`) — completing LA's financial picture
- `bulkLoadBudget.js` extended with `fiscal_year_type` and `where_extra` column_mapping keys — no breaking changes to existing TX city loads
- Enrichment for all 3 CA cities (SF: 53 rows, SD: 61 rows, LA: 70 rows); per-capita labeled "2024 Census estimate" for all

**Stats:** 2 phases, 8 plans; 1 day to ship (2026-05-22); 41 files changed, 6,003 insertions

**Archive:** [v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) | [v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md)

---

## v1.3 Revenue Completion & Per-Capita Context (Shipped: 2026-05-22)

**Delivered:** Closed all deferred v1.2 data work — Prosper + Celina revenue, Richardson operating budget, enrichment for 5 Collin County cities, and TX population data with per-capita spending display.

**Phases completed:** 11–14 (9 plans total)

**Key accomplishments:**

- Population schema + TX Census 2024 vintage estimates loaded for all 12 TX cities; per-capita ($/resident) visible in app labeled with source year
- Prosper TX revenue loaded via pdftotext targeting "STATEMENT OF REVENUES" (FY2023–2025, all governmental funds)
- Celina TX revenue loaded (FY2025, validated against $129.6M ACFR total)
- Richardson operating budget loaded (FY2025+FY2026) via 4-format XLSX dispatcher across document generations
- Category enrichment completed for Garland, Wylie, Sachse, Murphy, Princeton

**Stats:** 4 phases, 9 plans; 1 day to ship (2026-05-22)

---

## v1.2 Collin County Completion & Data Quality (Shipped: 2026-05-21)

**Delivered:** Fixed PDF department attribution, loaded revenue data for 4 TX cities, and added 5 new Collin County cities via pdftotext parsers.

**Phases completed:** 8–10 (9 plans total)

**Key accomplishments:**

- PDF pipeline fixed: max_tokens 2048→8192 + cross-page section heading context eliminates "Unknown" department dominance and exit code 2 truncation
- Revenue data loaded for Plano (7 FYs), McKinney (5 FYs), Frisco, and Allen — 412+ revenue rows now visible in app
- 5 new Collin County cities added: Garland ($192.5M), Wylie ($69.6M), Sachse ($31.2M), Murphy ($19.8M), Princeton ($36.9M)
- Confirmed ACFR PDF limitation for revenue extraction — documented pdftotext path for Prosper/Celina
- Princeton MA/TX municipality duplicate resolved; cost discipline maintained (skipped ~$20 API spend for 0.1% marginal improvement)

**Stats:** 3 phases, 9 plans; 18 days (2026-05-03 → 2026-05-21); 13/16 requirements shipped

**Tech debt carried forward:** Prosper/Celina revenue (pdftotext path needed), Richardson operating budget (cor.net HTTP block)

**Archive:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

---

## v1.1 Texas Municipal Financial Transparency (Shipped: 2026-05-02)

**Delivered:** Citizens can view operating budget and transaction data for Dallas, Plano, McKinney, Frisco, Allen, Prosper, and Celina.

**Phases completed:** 5–7 (9 plans total)

**Key accomplishments:**

- Generic Socrata SODA loader for Dallas operating + revenue budgets (FY2025, FY2026)
- Generic XLSX pipeline for Plano, McKinney, Frisco check registers + McKinney payroll
- Claude Haiku vision PDF pipeline for Allen, Prosper, Celina ACFR budget extraction

---

## v1.0 GiveButter Real-Time Donation Feedback (Shipped: 2026-04-22)

**Delivered:** Donate button on financials.empowered.vote with GiveButter webhook → Supabase → animated live counter on return.

**Phases completed:** 1–4 (9 plans total)

**Key accomplishments:**

- GiveButter webhook → Supabase Edge Function → Postgres RPC atomic donation write
- Animated counter + visibilitychange refetch on donor return
- loadEVFinances.js source-tagging + webhook row deduplication

---

## Pre-GSD History (shipped before planning system)

### SSO Auth Integration

Empowered Vote SSO integration with Alpha landing page. Full read access for Inform/unauthenticated users.

### EV Financials Brand & Logo System

BRAND_BAR_COLORS map, logo tile config, contrast text logic, nonprofit-specific icicle/summary behaviors, annual report download link.

### Enrichment & Municipality Fixes

Category enrichment system, NULL municipality_id fix, Cambridge enrichment.

---

*GSD planning system initialized: 2026-04-21*
*Last updated: 2026-06-06 after v1.6 milestone*
