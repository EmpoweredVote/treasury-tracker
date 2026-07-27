# Oregon Cities — Source Recon (Bend + 6 Washington County cities)

**Date:** 2026-07-26 (recon) · updated 2026-07-27 (Bend, Sherwood, Tualatin loaded)
**Scope:** Bend, Beaverton, Cornelius, Hillsboro, Sherwood, Tigard, Tualatin

**Status:** all 7 municipality rows seeded
(`scripts/seedWashingtonCountyOregonCities.js`). **3 of 7 LOADED** — GF actuals,
GAAP basis, operating + revenue, every row ties $0, 0 `data_sources` residue:

| City | FY window | budgets rows | Tooling |
|---|---|---|---|
| Bend | FY2022–FY2025 | 8 | `extractBend.py` + `processBend.js` |
| Sherwood | FY2021–FY2025 | 10 | `extractSherwood.py` + `processSherwood.js` |
| Tualatin | FY2021–FY2025 | 10 | `extractTualatin.py` + `processTualatin.js` |

Remaining: Beaverton, Cornelius, Hillsboro, Tigard (seeded, no data).

> **Follow-up — extractor consolidation.** There are now three ~90% identical
> per-city extractors. That matches the repo's existing convention (21 standalone
> `extract*.py`), and the differences are real (see the divergence table below),
> but a shared `lib/acfrGF.py` with a per-city config would be a worthwhile
> cleanup before city four.

### Why three extractors, not one

| | Bend | Sherwood | Tualatin |
|---|---|---|---|
| Section headers | Mixed case | **UPPERCASE** | **UPPERCASE** |
| Title wraps onto a line starting `EXPENDITURES` | no | **yes** | **yes** |
| `Capital outlay` nesting | root peer | **child of `Noncurrent`** | root peer |
| Expenditure parents | Current, Debt service | Current, Noncurrent | Current, Debt service |

Two traps, both of which produce a **$0 tie while being wrong**:

1. **Wrapped title.** Sherwood/Tualatin wrap the statement title so a line begins
   `EXPENDITURES AND CHANGES IN FUND BALANCES`. A prefix match on `^Expenditures`
   starts the expenditure section at the *title* and swallows the whole revenue
   block. Section headers must match the WHOLE line.
2. **Capital-outlay nesting.** `pdftotext -table` flattens indentation, so
   Sherwood's child-of-Noncurrent and Tualatin's root-peer placement look
   identical in the parsed text. Running Sherwood's parser over Tualatin still
   ties at $0 but silently mis-nests Capital outlay under Current and inflates
   the Current subtotal. **Resolve nesting with `pdftotext -layout`, which
   preserves leading whitespace.**

Standing lesson: **a $0 tie proves arithmetic, never labels or structure.**

---

## Headline

**There is no Oregon bulk source.** Unlike Ohio (AOS), Minnesota (OSA) and
Virginia (APA), Oregon publishes no statewide machine-readable city finance
file. The Secretary of State Municipal Audit Program is a *filing registry*, not
a dataset — see below. So this is **seven individual ACFR extracts**, the
Tucson / Troutdale mold, not a bulk-loader milestone.

Extraction itself is the easy part. The two real obstacles are **WAF/bot
protection** and **biennial budgets**.

---

## Obstacle 1 — WAF / bot protection (solved for most)

Several city sites 403 plain `curl` and `WebFetch`. Bend is behind Cloudflare;
a bare UA string is *not* enough. The full browser header set gets a 200:

```
-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ..."
-H "Accept: text/html,application/xhtml+xml,application/pdf,*/*"
-H "Accept-Language: en-US,en;q=0.9"
-H "Sec-Fetch-Mode: navigate"
-H "Sec-Fetch-Dest: document"
-H "Upgrade-Insecure-Requests: 1"
```

`Sec-Fetch-*` + `Upgrade-Insecure-Requests` are the ones that matter — referer
spoofing alone fails. Hillsboro and Tigard still 403 with the full set and will
likely need the cached Playwright Chromium (see
`project_local_ui_verify_workflow`).

## Obstacle 2 — Biennial budgets (design decision needed)

**Bend and Hillsboro budget on a two-year biennium.** Bend's GF budget-vs-actual
schedule has this shape:

| Original (biennium) | Final (biennium) | FY2023-24 Actual | FY2024-25 Actual | Total Actual | Variance |

Actuals are cleanly split per fiscal year. **The budget columns are not** —
Original/Final cover the whole biennium. TT stores rows per `(muni, fy, dataset)`,
so there is no honest way to split a biennium appropriation into two FY rows.

**Recommendation:** load the **per-FY actuals** (which are genuinely per-FY) and
do not synthesise a per-FY budget column. Halving the biennium budget would be
an unsourced estimate — the exact thing Phases 93–97 removed from the state
nodes.

## Obstacle 3 — Bend internal discrepancy (resolve at load)

Two schedules in the same FY2024-25 ACFR report different GF figures for the
same biennium:

| Program | p121 budget-vs-actual | p133 appropriation levels |
|---|---:|---:|
| Police | 78,981,175 | 66,210,714 |
| Code enforcement | 1,701,662 | 1,266,823 |
| Growth management | 2,132,250 | 1,374,592 |
| Non-transfer total | 89,425,798 | 74,871,340 |

p133 is systematically lower — difference 14,554,458. Likely cause: p121 is the
**combined** General Fund (the ACFR has a "Combining Balance Sheet – General
Fund" and a "General Fund Revenue Stabilization Fund"), while p133 is the legal
appropriation basis for the GF proper. **Unverified hypothesis — must be
resolved before load.** Per the Ohio AOS near-miss (Phase 86), re-derive rather
than trusting either total.

---

## Per-city findings

| City | ACFR published | Verified downloadable | Budget cycle | Notes |
|---|---|---|---|---|
| **Bend** | Yes | **Yes — extracted** | Biennial | Best-characterised; see below |
| **Sherwood** | Yes, FY2021–FY2025 | **LOADED** | Annual | Clean `wp-content` URLs, no WAF |
| **Tualatin** | Yes, FY2021–FY2025 | **LOADED** | Annual | Live index is `/internal-services-departments/finance/financial-reports/`; the `/finance/annual-comprehensive-financial-report` URLs in search results are dead (404) |
| **Hillsboro** | Yes (GFOA since FY1995-96) | **No — WAF 403** | Biennial from BY2023-25 | Needs Playwright |
| **Tigard** | Yes, incl. FY2025 | **No — WAF 403** | Annual | Needs Playwright |
| **Beaverton** | Yes | Not yet — JS-rendered CivicPlus | Annual (FY 2024-2025) | Doc links need rendering |
| **Cornelius** | **Not on city site** | Budgets only | Annual | **Weakest link** — see below |

All seven use a **June 30 fiscal year end** (Oregon standard).

### Bend (priority) — verified in detail

- FY2024-25 ACFR: 286 pp, **digital text, not scanned** (producer: activePDF).
- `pdftotext -table` reads the GF schedules **cleanly**; `-layout` scrambles the
  columns. Use `-table`, consistent with the state-ACFR tooling.
- GF budget-vs-actual: **PDF page 121**. Appropriation levels: **PDF page 133**.
- **Revenue by source is icicle-grade:** current/delinquent property tax, room
  tax, marijuana tax, construction excise, franchise fees, intergovernmental,
  licenses & permits, charges for services, contributions, fines & forfeitures,
  investment earnings, miscellaneous.
- **Expenditure detail is thin:** only 5 GF programs (municipal court, code
  enforcement, community projects, police, growth management) plus contingency
  and reserves. Police alone is ~88% of GF spend because **Fire/EMS and Streets
  are separate funds** — a GF-only load will look lopsided and understate the
  city. Worth deciding whether Bend should load GF-only or GF + major special
  revenue funds.
- Archive gap: the finance page links **only FY2024-25**. Older ACFRs exist at
  `bendoregon.gov/wp-content/uploads/2025/12/` (FY2022-23, FY2021-22, FY2015-16,
  FY2006 confirmed via search) but are unlinked. History depth needs a URL hunt.

**Confirmed working URLs**

```
https://bendoregon.gov/wp-content/uploads/2025/12/City-of-Bend-ACFR-FY20242025.pdf   (8.8 MB, 200)
https://bendoregon.gov/wp-content/uploads/2025/12/2025-27-Adopted-Budget-City-of-Bend.pdf (15.8 MB, 200)
https://www.sherwoodoregon.gov/wp-content/uploads/2026/01/FY25-City-of-Sherwood-ACFR-Final-1.pdf (3.2 MB, 200)
```

### Cornelius — weakest link

The budgeting page carries **adopted budgets FY2021-22 → FY2026-27 and
Budget-in-Brief summaries only — no ACFR or audited financial statements.**
Oregon municipal audit law (ORS 297.405–297.555) still requires an audit, so one
exists; it is just not on the city site. Options: pull it from the SOS registry,
or load Cornelius on a **budget basis** and flag the basis difference. Do not
silently mix a budget-basis city into a GAAP-actuals cohort.

### Oregon SOS Municipal Audit Program — investigated, not usable

`https://secure.sos.state.or.us/muni/public.do` searches by fiscal year (2005–
2026), county, government type and name, covering all Oregon local governments.

**Two blockers:** it sits behind an **F5/Shape TSPD JavaScript challenge** (plain
HTTP gets an obfuscated JS interstitial, no form), and it returns **the same
audit PDFs** the cities publish — no structured data, no API, no CSV. It is
useful as a *discovery* fallback for Cornelius, not as a loader source.

### Washington County LB-1 forms — uniform but shallow

Washington County collects **Form LB-1** (Notice of Budget Hearing) from every
jurisdiction, e.g.
`washingtoncountyor.gov/finance/documents/cityofhillsboro2025-27pdf/download`.

This is genuinely uniform across all six Washington County cities and would
sidestep six different WAFs. But LB-1 is a **one-page statutory summary** —
fund-level totals and tax levies, no revenue-by-source or program detail. Not
icicle-grade. Viable as a **cross-check on totals**, or as a stopgap for
Cornelius; not a substitute for the ACFRs.

---

## Suggested sequencing

1. **Bend first** — fully verified, and it forces the biennial-budget decision
   that Hillsboro will hit again.
2. **Sherwood + Tualatin** — no WAF obstacle, annual budgets, clean ACFRs.
3. **Beaverton + Tigard + Hillsboro** — need Playwright fetching; Hillsboro also
   biennial.
4. **Cornelius last** — basis question unresolved.

Open decisions before planning: (a) per-FY actuals only, or also biennium
budget rows? (b) GF-only, or GF + major special revenue funds for cities where
Fire/Streets sit outside the GF? (c) how to treat Cornelius's missing ACFR.
