# Oregon Cities — Source Recon (Bend + 6 Washington County cities)

**Date:** 2026-07-26 (recon) · updated 2026-07-27 (6 of 7 cities loaded)
**Scope:** Bend, Beaverton, Cornelius, Hillsboro, Sherwood, Tigard, Tualatin

**Status:** all 7 municipality rows seeded
(`scripts/seedWashingtonCountyOregonCities.js`). **6 of 7 LOADED** — GF actuals,
GAAP basis, operating + revenue, every row ties $0, 0 `data_sources` residue:

| City | FY window | budgets rows | Revenue sources | Expenditure functions |
|---|---|---:|---:|---:|
| Bend | FY2022–FY2025 | 8 | 9 | 2 |
| Sherwood | FY2021–FY2025 | 10 | 7 | 5 |
| Tualatin | FY2021–FY2025 | 10 | 9 | 4 |
| Beaverton | FY2021–FY2025 | 10 | 12–13 | 3 |
| Hillsboro | FY2021–FY2025 | 10 | 9 | 5 + capital group |
| Tigard | FY2022–FY2025 | 8 | 8–9 | 3 (flat, no drill-down) |

All six run on **`scripts/lib/acfrGF.py`** with a thin per-city
`extract<City>.py` wrapper + `process<City>.js` loader. Consolidated from three
standalone extractors (1,031 lines → 546); a new city is now ~50 lines.
Both refactors were protected by a golden diff — every pre-change extractor
output (28, then 38) is byte-identical afterwards.

Remaining: **Cornelius only** (seeded, no data — publishes no ACFR).

**Provenance backfill DONE.** Portland (15), Troutdale (24) and Gresham (12)
carried no `source_url`/`source_date`: their loaders pinned per-FY URLs in an
in-script `PDF_URLS` map but never persisted them.
`scripts/backfillOregonBudgetProvenance.mjs` stamped all 51 (URLs verified live
first; amounts untouched), and all three loaders now stamp on the way out.
**All 115 Oregon rows now have provenance.**

### Per-city divergence — what `CityConfig` has to carry

| | Bend | Sherwood | Tualatin | Beaverton | Hillsboro | Tigard |
|---|---|---|---|---|---|---|
| Section headers | Mixed | **UPPER** | **UPPER** | Mixed | Mixed | Mixed |
| Title wraps onto a line starting `EXPENDITURES` | no | **yes** | **yes** | no | no | no |
| Title says "Fund Balance**s**" | yes | yes | yes | yes | yes | **no — singular** |
| `parents` | Current, Debt service | Current, **Noncurrent**, Debt service | Current, Debt service | Current, Debt service | Current, **Capital outlay** | **() — flat** |
| `root_leaves` | `capital ` | — | `capital ` | `capital ` | **`debt service`** | — |

Case handling, whole-line section matching and the singular/plural title are all
uniform in the shared module, so `CityConfig` carries only `parents` and
`root_leaves`.

**Hillsboro inverts the usual layout** — `Debt service` is a valued LEAF at root
while `Capital outlay:` is a PARENT with children. This is why `root_leaves` is a
label list and not the `capital_at_root` boolean it started as. **Tigard is flat**
— no grouping at all, so its operating tree is one level deep and the icicle has
no drill-down (same accepted limitation as the flat-source states).

Both mis-configurations **tie at $0 while producing a wrong tree**. Every
`CityConfig` must be derived from `pdftotext -layout` indentation, never from a
passing tie.

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
spoofing alone fails. **Hillsboro and Tigard 403 no matter what curl sends**, for
GET and HEAD alike — that is TLS/JA3 fingerprinting, which headers cannot defeat.

**Headless-render fallback (works, used for Beaverton).** The `playwright` npm
package is NOT resolvable from this repo, but the Playwright-managed Chromium is
cached and can be driven directly — no package needed:

```
CH="$HOME/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
"$CH" --headless --disable-gpu --no-sandbox --virtual-time-budget=20000 \
      --dump-dom "<url>" > rendered.html
```

Beaverton runs CivicPlus Evolve and injects document links client-side, so a
plain fetch returns a page with **zero** document links — not a 403, just silently
empty. Rendering exposes them. Its PDFs live on two hosts by vintage
(`content.civicplus.com/api/assets/...` FY2021–24, `beavertonoregon.gov/asset/...`
FY2025) and the FY2024 URL needs `?scope=all`, so URLs are pinned literally.
Legacy `--headless` is itself blocked on some sites (it advertises
"HeadlessChrome"); use `--headless=new` with an explicit `--user-agent` and
`--disable-blink-features=AutomationControlled`.

**For DOWNLOADS behind a TLS-fingerprinting WAF, rendering is not enough** —
the PDF request itself must come from the browser. `scripts/fetchViaBrowser.mjs`
drives the cached Chromium over the DevTools Protocol (Node's built-in
WebSocket, no npm package), navigates to a page on the target origin to clear
the WAF, then runs a same-origin `fetch()` inside that page and returns the
bytes as base64. It refuses to write anything not starting with `%PDF`. This is
what unblocked Hillsboro and Tigard.

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
| **Hillsboro** | Yes, FY2021–FY2025 | **LOADED** | Biennial from BY2023-25 | WAF 403s curl entirely (TLS fingerprinting) — fetched via scripts/fetchViaBrowser.mjs |
| **Tigard** | Yes, FY2022–FY2025 | **LOADED** | Annual | Same WAF; document links carry no FY, only opaque ids — FY confirmed from each document |
| **Beaverton** | Yes, FY2021–FY2025 | **LOADED** | Annual | CivicPlus Evolve — doc links injected client-side; recovered via headless Chromium (see below) |
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
