# Phase 103 RECON — Deeper-History URLs + PA/IL ACFR Source Location (decision-ready handoff for Phases 104–105)

**Status:** COMPLETE. All recon done, bookend-tie-confirmed via `pdftotext -table`, $0 spend (no AI). Documentation only — no DB writes, no loader edits, no NASBO mutations. Covers Phase 103's three success criteria (deeper-history pilot URLs probed + recorded with gap log / PA+IL located + bookend-tied / loader-reuse + NASBO-replace plan written).

**Detail docs:** `103-DEEPEN-SOURCES.md` (pilot half) + `103-PA-IL-SOURCES.md` (PA/IL half). This file is the consolidated handoff.

---

## 1. Pilot Deepening (RECON-04, DEEP-01 input)

| Pilot | v2.11 window | Deepened window | New FYs for Phase 104 | Old-end tie | Added-FY URL pattern | Units |
|-------|-------------|-----------------|-----------------------|-------------|----------------------|-------|
| **NY** | FY2015–FY2024 | **FY2003–FY2024** | **+FY2003–FY2014 (12)** | FY2003 $29,250M ✅ | `…/comprehensive-annual-financial-report-{YYYY}.pdf` (`nyUrl(fy)` already returns this for fy≤2021) | millions (×1,000,000) |
| **CA** | FY2020–FY2025 | **FY2008–FY2025** | **+FY2008–FY2019 (12)** | FY2008 $97,774,378K ✅ | `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf` (NN=08…19) — **new dir** vs FY2020+ `/Files-ARD/ACFR/acfr{NN}web.pdf` | thousands |
| **FL** | FY2022–FY2024 | **FY2021–FY2024** | **+FY2021 (1)** | FY2021 $46,989,188K ✅ | same `…/cafr/fye-{YYYY}-state-of-florida-annual-comprehensive-financial-report.pdf` (works for FY2021) | thousands |
| **TX** | FY2015–FY2024 | FY2015–FY2024 | **0 — already done in v2.11** | FY2016 $96,239,551K ✅ (re-confirmed) | n/a — `processTX.js` already has FY2016 `docs/96-471.pdf` | thousands |

**SOURCES-map extension plan (Phase 104):**
- **NY** — extend `processNYAcfr.js` + `processNYRevenueAcfr.js`: add `2003…2014` to the year array (`nyUrl()` already emits the correct `comprehensive-annual-…` naming for fy≤2021; UNITS=1,000,000 already applies). Phase 104 transcribes each FY2003–FY2014 General-column block (rev + spend).
- **CA** — extend `processCA.js` + `processCARevenueAcfr.js` `SOURCES` object: add `2008…2019` keys with the **`/Files-ARD/CAFR/cafr{NN}web.pdf`** URL (a different directory from the existing `/Files-ARD/ACFR/` FY2020+ entries). Transcribe FY2008–FY2019 General-column blocks. (FY2002–FY2007 reachable under variant naming — optional further extension, not required.)
- **FL** — extend `processFLAcfr.js` + `processFLRevenueAcfr.js`: add `2021` to the `[2022,2023,2024]` array (same `fye-{YYYY}-…` pattern). Transcribe FY2021. **P2 clamp required:** FY2021 General Fund has a negative "Investment earnings (losses)" line (−$398,287K) (ACFR-08).
- **TX** — **no change.** Already contiguous FY2015–FY2024 in `processTX.js` / `processTXRevenueAcfr.js`.
- **Idempotency:** in all cases, add only the new older-FY keys + their transcribed blocks; leave existing v2.11 entries + rows untouched (never-overwrite — RECON-05 / the deepening must not disturb existing pilot rows).

## 2. PA + IL Source Location (RECON-04, ACFR-06/07 input)

| State | Statement / GF column | Units | FY-end | Durable window | Latest tie | Old-end tie |
|-------|----------------------|-------|--------|----------------|-----------|-------------|
| **PA** | Govtl Funds Stmt Rev/Exp/Changes, **General Fund** col (General Fund \| Motor License \| Nonmajor \| Total) | thousands | Jun 30 | **FY2016–FY2025** | FY2024 $91,293,027K ✅ | FY2023 $95,231,042K ✅ |
| **IL** | Govtl Funds Stmt Rev/Exp/Changes, **General Fund** col (General Fund \| Other Nonmajor \| Total) | thousands | Jun 30 | **FY2021–FY2025** (final audited) | FY2025 $78,342,927K ✅ | FY2023 $73,827,795K ✅ |

URL patterns + per-year quirks (hyphen→space for PA at FY2024; IL per-year "Bookmarked" variant naming + final-not-interim guard) are in `103-PA-IL-SOURCES.md`.

## 3. Loader-Reuse + NASBO-Replace Plan (RECON-05 — the plan Phase 105 implements)

**Loader mapping (new loaders on the v2.11 pattern):**
- **PA** → new `processPA.js` (spend) + `processPARevenueAcfr.js` (revenue), modeled on the `processTX.js` family (closest layout: a few major-fund columns + Total, single combined statement, thousands). SOURCES map = explicit per-year URLs (hyphen FY2016–2023, space FY2024–2025).
- **IL** → new `processIL.js` (spend) + `processILRevenueAcfr.js` (revenue), modeled on the same family (simplest layout: General Fund \| Other Nonmajor \| Total). SOURCES map = explicit per-year `ACFR Final {YYYY}` URLs (variant naming), **final-audited only**.

**NASBO-replace rule (per state, both PA + IL):** delete the state's NASBO state-FY operating rows, insert the ACFR operating + revenue rows — **one basis per state-FY (GAAP)**, **idempotent never-overwrite** (re-run = 0 writes), scoped to PA/IL only; **un-upgraded NASBO states stay on `scripts/loadStateGF.mjs` untouched**; existing CA/TX/NY/FL ACFR rows untouched.

**Recent-window greenlights (D-06):** **PA GREENLIT** + **IL GREENLIT** — both have final audited ACFRs through FY2024/FY2025, so replacing their NASBO FY2023/FY2024 rows is a strict upgrade (no strand).

**Scope-relabel gates (D-04, confirm at load):** **PA** ACFR GF ~2× NASBO (Intergovernmental/federal $42.3B inside GAAP GF); **IL** ~1.5× (Federal $22.1B inside). Recommendation for both = accept the ACFR General Fund as the node + relabel basis honestly (TX precedent). Chris confirms at Phase-105 load.

## 4. Open Risks / Unknowns for 104–105

1. **PA + IL scope relabel awaits load-time confirmation** (D-04). Both materially exceed NASBO GF (federal in the GAAP GF). The honest-relabel is the TX precedent, but the node totals will jump (PA ~$45B→~$91B, IL ~$50B→~$74B). Surface to Chris at Phase 105 / UAT (Phase 106).
2. **IL final-vs-interim trap.** The IL comptroller publishes an "Interim … unaudited" ACFR per FY alongside the final. Phase 105 must point the IL SOURCES map ONLY at `ACFR Final {YYYY}` files. Wrong file = unsourced/unaudited figures.
3. **FL FY2021 negative investment income** (−$398,287K) → P2 clamp must fire in Phase 104 (ACFR-08). Older NY/CA deepened years may also contain negative investment-income years (e.g. market-loss years) — Phase 104 applies the clamp as it transcribes.
4. **PA/IL deeper history (pre-window) not pinned.** PA FY2015 + earlier and IL FY2022 + ≤FY2020 use variant naming not enumerated here (out of the milestone's "as deep as cleanly extracts" for the new states — FY2021/FY2016 old-ends are the confirmed durable floors). Deferred.
5. **CA FY2002–FY2007** reachable under variant naming (`cafr06.pdf`, `2002_cafr02.pdf`…) — an optional further CA extension beyond the FY2008 clean-pattern floor; not required this milestone.
6. **NY two-page statement layout** — NY's main govtl-funds statement spans columns that `-layout` scrambles; Phase 104 must use `-table` (confirmed working on FY2003).

## 5. Success-criteria coverage

1. ✅ Pilot deeper-history URLs probed (FL/CA/NY pre-window + TX FY2016); clean additional FY depth + durable per-year URLs recorded; gap log written (§1, `103-DEEPEN-SOURCES.md`).
2. ✅ PA + IL ACFR GF statements located (GENERAL FUND column, units, durable per-year URLs, extractable depth), bookend tie-confirmed (§2, `103-PA-IL-SOURCES.md`).
3. ✅ Loader-reuse + NASBO-replace plan written per state — SOURCES-map extension for the pilots; new PA/IL loaders + replace rule + greenlights/gates (§3).
