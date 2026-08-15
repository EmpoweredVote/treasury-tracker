# WA-CITIES-01 — Recon Findings

Plan: `docs/superpowers/plans/2026-08-15-wa-cities-01.md`
Spec: `docs/superpowers/specs/2026-08-15-wa-cities-01-design.md`

---

## Cohort-wide findings

### 1. MCAGs — all twelve resolved live, and every county guess in the plan was wrong

Resolved against `GetEntities` on 2026-08-15. The plan drafted the four county
MCAGs from guesswork; **all four were wrong**, which is why the plan carried a
verification step before seeding.

| Entity | Pinned MCAG | Plan's guess | Verdict |
|---|---|---|---|
| Tacoma | `0610` | `0610` (probed) | ✅ |
| Spokane | `0724` | `0724` (probed) | ✅ |
| Vancouver | `0247` | `0247` (probed) | ✅ |
| Bellevue | `0374` | `0374` (probed) | ✅ |
| Kent | `0401` | `0401` (probed) | ✅ |
| Everett | `0664` | `0664` (probed) | ✅ |
| Pierce County | **`0152`** | `0620` | ❌ guess wrong |
| Spokane County | **`0166`** | `0730` | ❌ guess wrong |
| Clark County | **`0103`** | `0240` | ❌ guess wrong |
| Snohomish County | **`0162`** | `0660` | ❌ guess wrong |

### 2. Two decoy layers, both able to load the wrong government's money

**Entity level.** `GetEntities` matches on a name prefix:

- `Spokane` → City of Spokane (0724), **City of Spokane Valley (2781)** — a
  genuinely different municipality of ~103k — and City of Spokane
  Transportation Benefit District *(Inactive)* (3062).
- `Kent` → City of Kent (0401), City of Kent Economic Development Corporation
  *(Inactive)* (0662), City of Kent Special Events Center Public Facilities
  District (3003).
- Every county repeats the pattern: cemetery districts under Clark and Spokane,
  a diking district and a public hospital district under Snohomish, two
  development corporations under Pierce.

Guarded by `selectExactCity()` + `assertMcag()` in `scripts/lib/waRoster.mjs`.

**Report level — new, and specific to large cities.** One MCAG carries reports
for more than one reporting entity. Tacoma's 0610 returns **182 reports**, of
which only **116 are titled "City of Tacoma"**:

| Count | ReportTitle |
|---|---|
| 116 | City of Tacoma |
| 43 | Tacoma Employees' Retirement System |
| 23 | Tacoma Power / Tacoma Public Utilities energy-compliance reports (many title spellings) |

A pension-system statement would parse cleanly and tie at $0 while reporting
the wrong entity's money. **Filter on `ReportTitle` before selecting an ARN.**
Neither v2.22 entity exposed this: Bainbridge and Kitsap have no separately
reporting pension system.

### 3. The type-name inversion holds below FY2014 — measured, not assumed

The spec flagged this as unknown and asked recon to record it. Classified at
both ends of Tacoma's span:

| FY | ARN | Type name | Pages | Verdict |
|---|---|---|---|---|
| 2025 | 1040162 | Annual Comprehensive Financial Report | 5 | opinion letter |
| 2024 | 1037700 | Annual Comprehensive Financial Report | 6 | opinion letter |
| 2024 | 1038208 | Financial and Federal | 188 | **statements** |
| 2015 | 1017553 | Financial and Federal | 131 | **statements** |
| 2010 | 1006397 | Financial and Federal | 120 | **statements** |
| 2005 | 71446 | Financial and Federal | 88 | **statements** |
| 2003 | 68092 | Financial and Federal | 87 | **statements** |

The inversion is consistent across the whole FY2003–FY2024 span for this
issuer. **Selection remains by CONTENT regardless** — this is recorded as a
finding for the next WA milestone, not as something to start relying on.

### 4. Populations — WA OFM has advanced to the April 1, 2026 edition

Read from `ofm_april1_population_final.xlsx`, sheet `Population`, Filter=4 city
rows. The file now carries both a 2025 and a 2026 estimate column.

| City | Line | 2025 estimate (**used**) | 2026 estimate |
|---|---|---|---|
| Tacoma | 295 | **228,400** | 231,000 |
| Spokane | 359 | **234,700** | 235,900 |
| Vancouver | 48 | **205,100** | 207,000 |
| Bellevue | 146 | **158,000** | 158,300 |
| Kent | 160 | **140,100** | 140,400 |
| Everett | 330 | **114,700** | 114,900 |
| | | **1,081,000 total** | 1,087,500 |

**The cohort is deliberately kept on the 2025 column** so all eight WA entities
share one denominator year and per-capita figures stay comparable across
cities — Bainbridge (25,530) and Kitsap (288,900) were loaded on 2025. The 2026
values are recorded here for a future whole-cohort refresh: **refresh all eight
together or not at all.**

---

## Tacoma (MCAG 0610)

**Verdict: LOADABLE. The milestone's largest open risk is retired for this city.**

The spec named it as the biggest unknown — whether the SAO holds statements for
a city this size, or only an opinion letter, as it does for self-publishing
Seattle. Tacoma holds **statements for 22 consecutive years**.

### Content-guard window: FY2003–FY2024, all 22 years pass

Every year is the "Financial and Federal" report titled exactly *City of
Tacoma*, fetched and passed through `classifyReport()`:

| FY | ARN | Pages | Size |
|---|---|---|---|
| 2024 | 1038208 | 188 | 6.6 MB |
| 2023 | 1036023 | 184 | 13.1 MB |
| 2022 | 1033428 | 183 | 5.7 MB |
| 2021 | 1031332 | 171 | 11.2 MB |
| 2020 | 1029959 | 154 | 3.5 MB |
| 2019 | 1027087 | 146 | 3.8 MB |
| 2018 | 1024781 | 159 | 3.0 MB |
| 2017 | 1022333 | 153 | 2.6 MB |
| 2016 | 1019851 | 139 | 2.6 MB |
| 2015 | 1017553 | 131 | 7.0 MB |
| 2014 | 1015203 | 115 | 3.9 MB |
| 2013 | 1012677 | 122 | 2.6 MB |
| 2012 | 1010562 | 124 | 1.3 MB |
| 2011 | 1008324 | 118 | 9.9 MB |
| 2010 | 1006397 | 120 | 1.8 MB |
| 2009 | 1004324 | 107 | 2.1 MB |
| 2008 | 1002279 | 105 | 1.1 MB |
| 2007 | 75229 | 92 | 0.8 MB |
| 2006 | 73774 | 95 | 0.8 MB |
| 2005 | 71446 | 88 | 0.9 MB |
| 2004 | 69481 | 79 | 0.9 MB |
| 2003 | 68092 | 87 | 0.9 MB |

**No isolated failures and no consecutive failures** — the floor rule's
stopping conditions never fired within the available filings. The window is
bounded by what the SAO publishes, not by what the guard rejects.

### Excluded years

| FY | Reason |
|---|---|
| 2025 | **Source timing, not a defect.** The only City of Tacoma filings are a 5pp opinion letter (ARN 1040162) and five Contracted CPA reports. The financial audit is not yet released. Re-check after the SAO publishes it. |
| pre-2003 | No filings returned by SearchReports for MCAG 0610. |

### ⚠ This is a CONTENT-guard window, not an EXTRACTION window

`classifyReport()` proves a statement exists and is text-bearing. It does **not**
prove the General Fund column parses, nor that one extractor config reaches all
22 years. Per the floor rule, the window ends at the first year needing more
than a value change in the config — an era split ends it. **The extractor task
settles the real floor and may shorten this list.** Bainbridge is the cautionary
case: its filings looked available back to FY2004, and the usable window still
came out at 18 of 22 years across two configs.

### Notes for the extractor task

- Tacoma is a **large** city and its filings are 79–188pp, versus Bainbridge's
  ~50–90pp. The governmental-funds statement may span two pages, as Kitsap's
  does — page-2 continuation handling is likely to matter.
- Units are unknown until read off the page. Seattle and King County print
  **in thousands**; Bainbridge and Kitsap print **whole dollars**. Read it, do
  not assume — the tie is unit-invariant either way.
- `sanityMax` is provisionally 5,000,000,000 in the roster; revisit once the
  real magnitude is known.

---

## Spokane (MCAG 0724) — not yet reconned
## Vancouver (MCAG 0247) — not yet reconned
## Bellevue (MCAG 0374) — not yet reconned
## Kent (MCAG 0401) — not yet reconned
## Everett (MCAG 0664) — not yet reconned
