---
status: complete
phase: nc-durham-avl-01 (v2.31 — no GSD phase dir; docs/superpowers milestone)
source: NC-DURHAM-AVL-01-CLOSEOUT.md
started: 2026-08-25T00:00:00Z
updated: 2026-08-25T00:00:00Z
result: PASSED — 9 of 9, no defects
---

# NC-DURHAM-AVL-01 / v2.31 — UAT

Run against the **live production API** (`ev-accounts-api.onrender.com`) through a local
`npm run dev` server, which proxies `/api` server-side — `npm run preview` is CORS-blocked
for this purpose. Chromium via Playwright, 1500×1000.

⚠ Run AFTER the tag. `v2.31` was merged and tagged before UAT, so this record is the first
time any of these 138 figures was seen by a human on screen.

## Pre-flight — read from the live API before writing any expectation

| check | result |
|---|---|
| City of Durham | ✅ `city`, pop 301,870, `county_id` → Durham County |
| Durham County | ✅ `county`, pop 343,628 |
| City of Asheville | ✅ `city`, pop 94,992, `county_id` → Buncombe County |
| Buncombe County | ✅ `county`, pop 279,210 |
| NC entities in total | 5 — the four locals plus the pre-existing state node |
| axes on the wire | ✅ every probed row `general_fund` / `actual`, `derivation: published` |
| provenance payload | ✅ `data_source_info` carries `displayName`, `url`, `fetchedAt` — and the URL is the **per-year** document, not a shared index |
| the em-dash | ✅ **clean U+2014 on the wire** — raw bytes are `e2 80 94`, no `â€"` |

⚠ **The `�` seen in terminal output was a CONSOLE artifact, not an API defect.** Proven, not
assumed: the raw response bytes are `e2 80 94`, and the very next `print()` of the mojibake
pattern crashed with `UnicodeEncodeError: 'charmap' codec` — i.e. the cp1252 console cannot
render the character the API returned correctly. Confirmed again on screen (test 8).

⚠ **`fiscal_year_start_month` and `source_date` are NOT in the budgets payload** and are not
tested here. Same unmeetable expectation AUSTIN-TRAVIS-01 had to withdraw twice. The July–June
fiscal year is observable only through `fetchedAt`, which reads `<FY>-06-30` for every probed
row — checked in the pre-flight above.

Every figure below was read from the live API **first**, so a mismatch on screen would be a UI
defect rather than a stale expectation.

## Tests

### 1. All four entities are reachable by slug, with the right identity
expected: `durham-nc`, `durham-county-nc`, `asheville-nc`, `buncombe-county-nc` each load the
named entity with its Census population — **not** the silent Bloomington, IN fallback a bad
slug produces
**✅ PASS** — Durham 301,870 · Durham County 343,628 · Asheville 94,992 · Buncombe 279,210.
Every page titled for the correct entity.

### 2. Durham County FY2025 — the deepest series
expected: Money In **$693.6M**, Money Out **$574.6M**, ~$1,672 per person, series FY2005–25
**✅ PASS** — `$693.6M` / `$574.6M`; narrative reads "spent $575 million … roughly **$1,672
per person**" and "funded this through $694 million … **$2,018 per resident**". Series label
`General Fund · actuals · FY2005–25`. All four match the loader's dry-run figures exactly.

### 3. City of Durham FY2024
expected: Money In **$272.2M**, Money Out **$258.7M**, ~$857 per person, series FY2009–**24**
**✅ PASS** — `$272.2M` / `$258.7M`, "$857 per person", series `FY2009–24`. ⚠ The window
correctly stops at FY2024 while the other three reach FY2025 — the city has published its
FY2025 *Citizens* report but not its FY2025 ACFR, and the UI reflects that rather than
inventing a year.

### 4. ⚠ Asheville FY2009 — the WAYBACK-RECOVERED path, end to end
expected: Money In **$85.5M**, Money Out **$84.4M**, ~$889 per person
**✅ PASS** — `$85.5M` / `$84.4M`, "$889 per person". This is one of the nine years the city
had **delinked from its own page**; the figure is on screen, and the source chip URL is the
live first-party Drive id `12ZXmbgvTs_…`, not a `web.archive.org` address. The recovery is
therefore visible in production provenance, exactly as intended.

### 5. ⚠ Buncombe FY2009 — the NAMING-GAP recovery, end to end
expected: Money In **$251.5M**, Money Out **$240.2M**, ~$860 per person, series FY2008–25
**✅ PASS** — `$251.5M` / `$240.2M`, "$860 per person", series `FY2008–25` — the **unbroken**
window. Chip URL is `media.buncombenc.gov/common/finance/cafr/cafr09/cafr.pdf`, the
fourth-convention path that name-probing could never have guessed.

### 6. ⚠ THE WELDED LABEL IS FIXED, ON A HUMAN-READABLE SURFACE
expected: Buncombe's operating categories show **`Intergovernmental` as its own category**,
never `Intergovernmental Education`
**✅ PASS** — FY2009 narrative: "The biggest share was **Current** (66% of the budget),
followed by **Intergovernmental** — grants and aid from federal, state, and other local
governments. (29%) and **Debt service** (5%)." Three distinct root categories. This is the
defect that passed the $0 tie gate, the total check and the leaf-multiset check in eleven
rows; it is now visibly correct to a reader.

### 7. Series windows are per-entity and correct
expected: Durham FY2009–24 · Durham County FY2005–25 · Asheville FY2009–25 · Buncombe FY2008–25
**✅ PASS** — all four labels read exactly that.

### 8. The em-dash renders correctly on screen
expected: `ACFR — General Fund …` with a real em dash, no `â€"`
**✅ PASS** — every attribution line reads e.g. "Data sourced from Buncombe County ACFR —
General Fund Expenditure by Function (FY2009 actual, GAAP basis)". Clean on the wire and on
screen. The v2.29 upstream fix holds for a new entity family.

### 9. Scope and basis are stated, not implied
expected: both series chips read `General Fund`, basis `Actuals`
**✅ PASS** — every page shows `Money out: General Fund ⓘ Actuals` and
`Money in: General Fund ⓘ Actuals`, plus `One published set of figures, shown here with what
it covers.` No `unknown` anywhere.

## Observations — recorded, not defects

1. ⚠ **A series label states a RANGE while two entities have interior gaps.** Asheville shows
   `FY2009–25` but has no FY2013, FY2019 or FY2020; the label does not say so. This is the
   same open item CO-SPRINGS-EPC-01 accepted for El Paso FY2006–08 — *a missing year is silent
   about why* — now present on two more entities. Chris previously ruled it acceptable against
   the alternatives (inventing a figure, or trusting a statement we cannot read). A per-year
   "published but not machine-readable / not published" note would close it.

2. **Durham City's banner reads "FY2026 data not yet published"** when its latest is FY2024,
   so FY2025 is unmentioned. Pre-existing copy pattern that compares against the current
   fiscal year rather than latest+1; not introduced by this milestone.

3. **Durham County FY2025 shows "Debt service (0%)"** — a real but tiny figure rounding to
   zero. Cosmetic.

## Verdict

**PASSED — 9 of 9, no defects.**

Both archive-discovery recoveries are confirmed working end to end in production, with
first-party URLs. The welded-label fix is confirmed on a surface a reader actually sees, which
matters because no arithmetic gate could see it. v2.31's figures have now been observed by a
human.
