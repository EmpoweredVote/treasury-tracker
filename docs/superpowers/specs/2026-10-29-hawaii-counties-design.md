# Hawaii's four counties — a deep seed — design

Chris's pick, 2026-10-29. He asked for a "deep seed of Honolulu and Hawaii" so
that "all the people of Hawaii can hop on and explore TT that links back to
audited financial reports". Everything below is **measured**, not assumed; the
measurements were taken on 2026-10-29 and cost $0.

Prior art, all merged: **#299/#309/#310** (the Alaska borough family — same
route, same library, same guards). Reference memories:
`reference_hawaii_local_finance`, `reference_alaska_local_finance`,
`reference_acfr_gf_extractor_howto`, `reference_federal_audit_clearinghouse`,
`reference_source_url_never_verified`.

---

## 1. Why this exists

TT holds **one** Hawaii thing: the `Hawaii / state` node, 42 rows, FY2005–2025.
Measured live:

```sql
select m.name, m.entity_type, count(b.id) from treasury.municipalities m
  left join treasury.budgets b on b.municipality_id = m.id
 where m.state = 'HI' group by 1,2;
-- Hawaii | state | 42        <- the only row
```

**There is no Honolulu page.** A million people — 69% of the state — live in a
government TT cannot show at all.

### 1.1 Hawaii is the one state that can actually be FINISHED

Hawaii's entire general-purpose local layer is **four county governments**.
There are no cities, no towns, no villages. Proved, not assumed: the census
place file for the state (`cache/sub-est2024_15.csv`) holds exactly **one**
SUMLEV 162 row and it is `Urban Honolulu CDP` — a *Designated* Place, i.e.
unincorporated. Full SUMLEV census for HI: `{040: 1, 050: 5, 157: 2, 162: 1}`.

Alaska could not be finished (~145 cities, FAC reaches ~43). Hawaii's local
layer is complete at four. **This is the only state where "TT holds all of it"
is a true and cheap claim**, and that is the point of doing it.

### 1.2 Four of the five county-equivalents are governments

| census 050 | FIPS | pop 2024 | government? |
|---|---|---:|---|
| Honolulu County | 15003 | 998,747 | ✅ City and County of Honolulu |
| Hawaii County | 15001 | 209,790 | ✅ County of Hawaii |
| Maui County | 15009 | 163,688 | ✅ County of Maui |
| Kauai County | 15007 | 73,840 | ✅ County of Kaua'i |
| **Kalawao County** | 15005 | **81** | ⛔ **NO GOVERNMENT** |

Populations measured from `cache/co-est2024-alldata.csv`, `POPESTIMATE2024`.

⚠⚠ **KALAWAO IS NOT LOADABLE AND MUST NOT BE CREATED.** The Kalaupapa
settlement is administered by the **State of Hawaii Department of Health**, not
by a county government. It files nothing at FAC. Same class as Alaska's 11
census areas: a census county-equivalent that is not a government. Creating it
would **mint a government that does not exist** — see
`reference_census_vintage_ladder`.

---

## 2. The source — the Federal Audit Clearinghouse, free and unauthenticated

```
https://app.fac.gov/dissemination/report/pdf/<report_id>
```

No key, no WAF, no ToS gate. Verified live on 2026-10-29: Honolulu FY2025
(`2025-06-GSAFAC-0000409937`) returned **HTTP 200, 9,703,499 bytes,
`application/pdf`, `%PDF-1.7`, 362 pages**, with a real text layer.

The bytes are the auditee's **own submission, filed under federal penalty**, so
this is a first-party document. This is the route that bypassed every WAF the
campaign has hit, and §7 shows Hawaii needs it.

### 2.1 The roster is exactly 38 filings

Measured from `cache/fac-general.csv` by **EIN**, then **re-checked live**:

| entity | EIN | filings | span |
|---|---|---:|---|
| City and County of Honolulu | `996001257` | 10 | FY2016–2025 |
| County of Maui | `996000618` | 10 | FY2016–2025 |
| County of Hawaii | `996000567` | **9** | FY2016–**2024** |
| County of Kaua'i | `996000658` | **9** | FY2016–**2024** |

⭐ **The open question from `reference_hawaii_local_finance` is now ANSWERED.**
That memory said Kauai's and Hawaii County's FY2025 were absent from the Sep-3
bulk CSV and to "re-check live — they may have filed since". They have not:

```
GET api.fac.gov/general?auditee_ein=in.(996000658,996000567)&audit_year=eq.2025
  -> []                      (control: Honolulu 2025 -> 1 row, so the query works)
GET ...&audit_year=eq.2026 for all four
  -> []                      (no FY2026 filings from anyone yet)
```

So the roster is **38, not 40**. Hawaii County and Kauai are two filings short
of their siblings, and the design must not silently present that as a gap in
TT's reading. §8.3 covers how the page says so.

**All 38 fiscal years end June 30** (`fy_end_date` on every row), so
`fiscalYearStartMonth: 7` for all four. ⚠ Unlike the Alaska family, which
carried two calendars — but it is asserted per filing anyway, never carried.

### 2.2 FAC's floor is FY2016, and that is this load's floor

The counties' own sites may go deeper. That is a later, more expensive pass and
is explicitly **out of scope** here.

---

## 3. What "deep" means here, measured against what TT already shows

Depth measured live from `treasury.budget_categories` / `budget_line_items`:

| | revenue | expenditure |
|---|---|---|
| `Hawaii / state` (today) | 19 categories, **0 line items** — flat | 15 categories, **0 line items** — flat |
| Alaska boroughs (#309/#310) | 8 categories | 1 category, 8 items |
| Tucson (TT's city-parity benchmark) | 9 categories | 4 categories → 10 items |
| **Honolulu, from its FY2025 statement** | **8 sources, one nested group** | **3 parents → 17 items** |

⭐ **A deep seed gives Honolulu a richer page than the state node above it.**
That is the deliverable: real drill-down, not another flat total.

### 3.1 The tree, read off the real document

`pdftotext -table` on pages 68–70 of Honolulu FY2025 produces a clean,
column-aligned table. The General Fund column (`Amounts in thousands`):

```
Revenues                                   Expenditures
  Taxes                      1,842,801       Current:
  Licenses and permits          55,678         General government          272,364
  Intergovernmental                  8         Public safety              573,753
  Charges for services          58,894         Highways and streets        17,226
  Fines and forfeits             2,409         Sanitation                       2
  Miscellaneous:                               Human services              28,912
    Recoveries                  12,661         Culture-recreation          97,947
    Interest                   103,115         Utilities or other ent.      1,017
    Other                       13,159         Miscellaneous:
  ------------------------------------           Retirement and health    353,239
  Total Revenues             2,088,725           Other                    145,829
                                               Capital Outlay:
                                                 General government         3,487
                                                 Public safety              5,771
                                                 Highways and streets          --
                                                 Human services                --
                                                 Culture-recreation         1,473
                                               Debt service:
                                                 Principal                 11,872
                                                 Interest                   6,923
                                                 Bond issuance costs           --
                                               --------------------------------
                                               Total Expenditures     1,519,815
```

**Both modes tie at $0, checked by hand before writing this:**

* revenue `1,842,801 + 55,678 + 8 + 58,894 + 2,409 + 12,661 + 103,115 + 13,159`
  = **2,088,725** = printed total ✓
* expenditure current `1,490,289` + capital `10,731` + debt service `18,795`
  = **1,519,815** = printed total ✓

This is the single biggest risk in the task and it is **retired for the hardest
document in the family** before any code is written.

### 3.2 ⭐ Chris's decision — each county mirrors its own report

**Every node in a county's tree is a line its own statement prints. No mapping
is invented and no label is normalised across the four.**

The alternative — mapping all four onto shared buckets so Honolulu and Maui
compare line-for-line — was offered and **declined**. It would make the labels
an editorial claim of ours rather than the issuer's, and inventing structure is
precisely the failure this repo keeps catching (`reference_acfr_gf_extractor_howto`
failure mode 11: *the root label can lie about scope*; the LA TRAN shape).

**The accepted cost:** the four counties do not print the same function names,
so a reader comparing Honolulu to Maui may find the categories don't line up.
Honolulu prints `Highways and streets` and `Utilities or other enterprises`;
another county may print `Public works`. That difference is **real and is the
issuer's**, and showing it is more honest than papering over it.

⚠ Builder consequence: there is **no shared category whitelist to validate
against**. The per-entity assertion is that the tree reproduces *that document*,
and `project_acfr_gf_classification`'s lesson applies — assert per-entity
consistency rather than leaning on a whitelist.

---

## 4. ⚠⚠⚠ Entity typing — the decision that mints duplicates if wrong

`entity_type` is identity-load-bearing (`treasury_ensure_municipality` keys on
it), so a later retype **mints a duplicate rather than moving the row**. See
`reference_entity_type_declarations`.

### 4.1 Honolulu is a `city`. Do NOT export Alaska's rule.

Alaska's rule — *no SUMLEV 162 row ⇒ `county`* — is an **Alaska** rule encoding
Alaska's own split between a unified home-rule municipality and a home-rule
borough. Applied blindly here it types Honolulu `county`, because the census
prints no 162 row for Honolulu County.

**TT's own precedent governs instead, and it is unambiguous.** Re-verified live
on 2026-10-29, not taken from memory:

```
CA  city  San Francisco        county_id null   geoid 0667000  census-pep-162-exact
PA  city  Philadelphia         county_id null   geoid 4260000  census-pep-162-exact
TN  city  Nashville-Davidson   county_id null
```

→ **City and County of Honolulu is `city`, `county_id` NULL.**
→ Hawaii, Maui and Kaua'i are `county`.

No new `entity_type` value is introduced, so none of
`reference_entity_type_declarations`'s six-declaration work applies.

### 4.2 ⚠ Read Note 1 before seeding each one — the Yakutat lesson

The Alaska pass nearly typed Yakutat `city` off its name ("City and Borough
of…") and was saved by reading the issuer's own reporting-entity note. **The
name is not the evidence.** Each of the four PDFs' Note 1 must be read and the
reporting entity confirmed before that entity is created. This is a gate, not a
courtesy.

### 4.3 Display names — builder's call, recorded here

TT's county convention is `<Name> County` (`Alameda County`, `Kodiak Island
Borough`). TT's consolidated-city convention is the bare city name
(`San Francisco`, `Philadelphia`).

→ **`Honolulu`, `Hawaii County`, `Maui County`, `Kauai County`.**

⚠ Kauai is spelled three ways across the sources (`COUNTY OF KAUA'I`,
`COUNTY OF KAUAI`, census `Kauai County`). **`Kauai County`** is stored, without
the ʻokina, so that name matching and geoid joins behave; the county's own
styling is `Kaua'i`. *This is my call, flagged for Chris to overrule.*

⚠⚠ `Hawaii County` and the existing `Hawaii` state node differ only by the word
"County". `check:forks` must be clean after the load, and the registry key must
include `entity_type`.

---

## 5. ⚠⚠⚠ Identity — key on EIN, and let the PDF be the arbiter

**299 Hawaii auditees file at FAC; exactly 4 are general-purpose local
governments.** A loose name match claims the other 295, which are **state**
bodies and **component units**:

* `STATE OF HAWAII DEPARTMENT OF TRANSPORTATION` — Highways, Airports,
  Administration and Harbors each file **separately**, 4 EINs
* `Department of Education, State of Hawaii` — the state runs **all** schools;
  Hawaii has no local school districts
* `THE JUDICIARY`, `DEPARTMENT OF THE ATTORNEY GENERAL`,
  `OFFICE OF HAWAIIAN AFFAIRS`
* ⚠ **`Department of Water, County of Kauai`** (EIN `472810526`) — a **component
  unit** of Kauai with its own EIN and its own filings. The exact lookalike the
  Alaska loader had to exclude.

**Rule: the roster is keyed on the four EINs above, and every downloaded PDF
must name its own auditee on its own cover page before it is parsed.** The index
is not trusted — Alaska proved FAC's own EIN can be wrong (Fairbanks FY2024
carries another entity's EIN).

---

## 6. Guards — the fetcher deletes what it cannot prove

Carried unchanged from `fetchAkBoroughs.mjs`, which exists to convert a defective
index into something safe to load:

| | guard | catches |
|---|---|---|
| a | `%PDF` magic bytes | an error page named `.pdf` |
| b | minimum byte size | truncated transfers, stubs |
| c | minimum page count (`pdfinfo`) | an opinion letter standing in for a report |
| d | text-layer density | ⚠ an **image-only scan**, which passes a–c intact and yields an EMPTY extraction |
| e | **auditee identity** in the document's own text | the wrong entity |
| f | **fiscal-year assertion** in the document's own text | the wrong year |

A fetch that fails any guard is **deleted, not kept**. (d) matters: Alaska lost
Denali entirely to an image-only scan and Honolulu's own FY2016–2018 era has not
been checked yet.

---

## 7. The source link — Chris's call: BOTH, side by side

### 7.1 ⚠⚠⚠ Never store the URL that served the bytes

**Corrected against live data, 2026-10-29.** An earlier draft of this document
said Alaska cites each borough's own publication page. **It does not.** Every
live Alaska row reads:

```sql
select source_url from treasury.budgets ... -- Kodiak FY2024
-- https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000346678
```

Because `app.fac.gov/dissemination/report/pdf/<report_id>` answers with a **302
to a presigned S3 object whose query string reads `X-Amz-Expires=30`**. Thirty
*seconds*. `fetchAkBoroughs.mjs` recorded `res.url` — the URL that actually
served the bytes, which is the right rule everywhere else in this repo and the
wrong one here — and **253 rows shipped a link that was dead before the load
finished**. Every figure was correct, every tie held, and
`repairAkBoroughSourceUrls.mjs` had to rewrite the column after the fact.

⚠⚠⚠ **`reference_source_url_never_verified`: NO GATE READS A `source_url`.**
Nothing in the frozen invariant, the tie gate, the per-capita guard or the scope
sweep looks at a URL, so the one thing broken was the one thing a reader clicks.

→ **This loader stores `documentUrlFor(key, fy)` — the stable permalink it
requested — and never `res.url`.** The ephemeral URL is kept in the manifest as
`servedUrl` for the record and offered to nobody.

### 7.2 Two of the four counties refuse an automated GET

Probed 2026-10-29:

```
200  https://www.honolulu.gov/budget/
200  https://www.mauicounty.gov/193/Finance        (needs Sec-Fetch-* headers)
403  https://www.hawaiicounty.gov/departments/finance   <- WAF, browser headers too
403  https://www.kauai.gov/Government/Departments-Agencies/Finance   <- same
```

A 403 to `curl` does **not** mean a human's browser can't open it. But it does
mean we cannot *prove* the link is good, and §7.1 is what happens when an
unprovable link ships.

### 7.3 ⭐ Chris's decision — show our work, with both links

His standard, in his words: *"I want people to be able to click and see where we
got our data from, so they can explore the same data themselves in the way the
audited report presents it. If we are providing links that don't work or links
that don't show that data or only a portion of it, that's a problem."*

⭐ **That standard ranks the two links, and it ranks them the opposite way round
from this document's first draft.**

| | opens | at the right year? | shows the data as audited? |
|---|---|---|---|
| **FAC permalink** | the **exact audited PDF that was parsed** | ✅ always | ✅ the auditor's own presentation |
| county finance page | an **index** of the department | ⚠ only if it still posts that year | ⚠ a portion, or a further click |

A county "Finance Department" page is one step removed from the evidence. If it
posts only the last few years — which is the common case — then citing it for a
FY2017 row **is** the "only a portion" failure Chris named.

→ **The FAC permalink is the PRIMARY citation on every row.** It is the one that
satisfies the standard unconditionally.
→ **The county's own page is a SECOND link** — "the county's own publication of
this report" — shipped *per entity-year, and only where it is proven to reach
that year's report.*

⚠⚠ **A second link that is broken or lands on the wrong year is worse than no
second link, by Chris's own standard.** So §7.4's fetch-back is not a report
card here; it is the **gate that decides whether the county link ships at all**.

### 7.3.1 ⚠ Measured: three of the four county pages are not dependable

Probed repeatedly, 2026-10-29:

| county | result |
|---|---|
| Honolulu | `200` on a quick probe, then **two full GETs timed out at 45 s and 90 s with 0 bytes**. Intermittent. |
| Maui | `200` with `Sec-Fetch-*` headers |
| Hawaii County | **`403`** — WAF, browser headers too |
| Kaua'i | **`403`** — same |

This is Chris's concern materialising before a single row is written, and it is
why FAC carries the guarantee and the county page is the bonus.

### 7.3.2 ⚠⚠⚠ Measured: NONE of the four county pages passes Chris's standard

Honolulu's page eventually answered after a **30.7 second** wait on retry. Its
content was then read, and so was Maui's:

| county | HTTP | mentions ACFR? | fiscal years named on the page |
|---|---|---|---|
| Honolulu | 200 after 30.7 s | yes, ×2 | **2021, 2023, 2026** only |
| Maui | 200, fast | **ZERO mentions** | 2012, 2018, 2025, 2026 |
| Hawaii County | 403 | unknown | unknown |
| Kaua'i | 403 | unknown | unknown |

**Neither reachable page is a per-year ACFR archive.**

* Honolulu's names the ACFR but exposes **three** years. Citing it for a FY2017
  row is *exactly* the "only a portion" failure.
* Maui's `/193/Finance` **never mentions an ACFR at all** — it is a department
  landing page. Citing it as the source of a FY2019 audited figure fails the
  standard outright.

⭐⭐ **So the county-page link, as conceived, is proven for ZERO of the four
counties, and the measurement is what proves it.** Shipping it anyway would put
38 rows behind links that either break, or open a page that does not contain the
figure cited. That is the thing Chris explicitly called a problem.

### 7.3.3 What a real second link would cost

A second link that meets the standard must be a **deep link to that specific
year's report on the county's own site** — not a department index. Discovering
those is **38 separate link hunts** across four unrelated publishing systems,
and the Alaska precedent is the warning: six boroughs needed **six different and
hostile archive systems**, including CivicPlus `Archive.aspx?ADID=<n>` ids that
are *not ordered by year* (63 = FY2007, 62 = FY2008, 56 = FY2012, 337 = FY2015).

**Estimate: 1.5–2.5 h, and it may come up empty for the two counties that
return 403.** This is why it is proposed as its own pass (§7.3.4) rather than
smuggled into the data load.

### 7.3.4 ⭐ DECIDED — this pass ships FAC permalinks only

Chris, after seeing §7.3.2: **land the data first, hunt the county deep links
afterwards.**

| | scope | citation shown | meets the standard? |
|---|---|---|---|
| **PR 1 — THIS PASS** | the 76 rows | **FAC permalink**: exact PDF, exact year, auditor's own presentation | ✅ **fully, today** |
| follow-up A | the 38 deep-link hunts (§7.3.3) | — | 1.5–2.5 h, may be empty for the 403 counties |
| follow-up B | the two-link `SourceChip` | adds the county's own deep link wherever A proved one | ✅ never a dead link |

⭐⭐ **This removes the migration and the `src/` change from this pass
entirely.** With zero proven second links there is nothing to store in a second
column, so `source_url` carries the FAC permalink and **PR 1 is data-only,
needing no deploy** — exactly like #309/#310.

⚠ Follow-up B is only worth deploying once A has found links to put in it. A
two-link chip with nothing in the second slot is UI for its own sake.

⚠ **This is the one piece of the task that is NOT data-only, and it was
measured after the decision:**

* `treasury.budgets` has a **single** `source_url` column. `data_sources` has
  `base_url` / `endpoint_path` and no second citation field. → a small
  migration adds a second column.
* `src/components/federal/SourceChip.tsx` takes **one** `sourceUrl` and renders
  **one** `<a>`. → a component change.
* A `src/` change means **a deploy is required** (unlike #309/#310), and per
  `CLAUDE.md` a change that alters a browser journey **updates its `e2e/` test
  in the same PR**.

→ **Builder's sequencing call, flagged for Chris to overrule (§13):** ship this
as **two PRs in one pass**.

| PR | contents | deploy? |
|---|---|---|
| 1 | the data. **Both URLs stored from the start**, so no backfill is ever needed. Reader sees the FAC permalink via today's single-link chip — the Alaska precedent, and never a dead link. | no |
| 2 | the second column surfaced: `SourceChip` renders both, API field, `e2e/` journey updated. | yes |

The data lands and is mergeable on its own; the UI change carries its own test
and deploy instead of holding 76 verified rows hostage to a component edit.

### 7.4 The gate either way

**After the load, fetch one `source_url` back per entity and record the status
in the PR.** A county page that cannot be fetched back is still stored as the
citation — Chris chose it knowingly — but it is *labelled* as unverified in the
PR, never silently presented as checked.

---

## 8. Scope

### 8.1 In

* 4 entities: Honolulu (`city`), Hawaii / Maui / Kauai (`county`)
* 38 filings → **76 `budgets` rows** (revenue + operating per filing),
  FY2016–FY2025, `fund_scope = general_fund`, `basis = actual`
* `audit_grade = audited_gaap`, **asserted per filing** from the opinion, never
  assumed. ⚠ The opinion gate is blind to an inverted GAAP phrase and to "In MY
  opinion" (a sole practitioner) — both found in Alaska. Check the phrasing.
* Full category + line-item depth per §3 — roughly **700–900** rows across
  `budget_categories` and `budget_line_items`
* `population` / `population_year` = 2024 census estimates per §1.2
* `geoid` = the county FIPS (`15003` / `15001` / `15009` / `15007`) with an
  honest `geoid_basis`. ⚠ Honolulu has **no SUMLEV 162 geography** — its only
  census geography *is* the county — so it cannot take SF's
  `census-pep-162-exact` basis. A new basis value records that honestly rather
  than claiming a place geoid that does not exist.
* `units = 1000` per entity, **read from each caption block**, never carried

### 8.2 Out

* **Kalawao County** (§1.2) — not a government
* Pre-FY2016 years (§2.2)
* Boundary geometry. Measured: `essentials.geofence_boundaries` holds **only
  `15 / Hawaii / G4000`** for the state — no HI county boundaries exist at all.
  The Civic Spaces map tether therefore cannot resolve for these four
  regardless of this load. Filed as a follow-up, not smuggled in; a boundary
  load also staleness-flags `geofence_child_county_stale`
  (`reference_geofence_child_county_refresh`).
* Component units (`Department of Water, County of Kauai`) and all 295 state
  bodies
* ⭐ **Any `src/` change, and any migration.** Settled by §7.3.4: this pass is
  **data only and needs no deploy**, like #309/#310 — but that must be
  confirmed, not assumed.
* **The county deep-link hunt and the two-link `SourceChip`** — both are
  follow-ups A and B (§7.3.4), not this pass. When B does ship it will need a
  deploy and an `e2e/` journey update, and
  `reference_render_build_minutes_block_deploys` will apply: **a green merge is
  not a deploy**, Render cancels builds when the workspace is out of build
  minutes.

### 8.3 Honest gaps the page must carry

Hawaii County and Kauai stop at FY2024 because **they have not filed FY2025**
(§2.1). That is the publisher's gap, not TT's. Per the Milledgeville rule
(`feedback_milledgeville_rule`) it gets **loaded as far as it goes and flagged**,
and the flag must reach the reader — not be left as a silent short series that
looks like a loader failure.

---

## 9. Traps, ranked by how quietly they would ship

1. ⚠⚠⚠ **`units`.** Every figure is in thousands. A units error is **invisible
   to the tie** — the whole page scales together. `1,842,801` is $1.84B. Read
   the caption block per entity, per year.
2. ⚠⚠⚠ **A wrong tree that ties at $0.** The tie gate proves the *read*, never
   the *shape*. Honolulu prints **`Miscellaneous:` twice** — once under Revenues
   (Recoveries/Interest/Other) and once under Current expenditures (Retirement
   and health benefits/Other) — and **`Other` is a child of both**. Capital
   Outlay then repeats five function names that already appear under Current.
   **Labels are not unique across parents here.** Parent by open group, never by
   label alone, and use `revenue_group_members` so a group closes in the right
   place (`reference_acfr_gf_extractor_howto` failure modes 1, 2, 17).
3. ⚠⚠ **Landing on the wrong statement.** Honolulu's FY2025 document contains
   **14 statements** whose titles begin alike, including combining statements
   and a budgetary schedule. The `statement_anchor` must require the words
   "Governmental Funds"; do not weaken `_EXCLUDE`.
4. ⚠⚠ **`treasury_sync_city_budget` keys on fund_scope + basis, not
   data_source** — omit either parameter and a re-run **duplicates**
   (`project_sync_city_budget_not_source_safe`).
5. ⚠ **Typing off a name** (§4.2).
6. ⚠ **An expiring `source_url`** (§7).

---

## 10. Verification — what must be true before this is called done

1. All 76 rows tie at **$0** on both modes, every leaf and every subtotal
2. A **from-scratch, loader-independent re-derivation** reproduces every
   roll-up — the Tucson/NY standard, not a re-run of the loader
3. Each entity's `units`, fiscal year, auditee identity and opinion asserted
   **from its own document**
4. `npm run verify:frozen` → **62587 / 60098de6 UNCHANGED**
   (`reference_frozen_figure_invariant`)
5. `npm run check:forks` clean — especially `Hawaii` vs `Hawaii County` (§4.3)
6. `npm run build` green. ⚠ `npx tsc --noEmit` **checks nothing** here and has
   been green against a red build three times
   (`project_local_ui_verify_workflow`)
7. One `source_url` fetched back per entity, status recorded in the PR (§7)
8. Register union == deficit exactly; 0 existing entities changed, 0 lost
9. The live API serves all four with correct typing:
   `/api/treasury/cities?state=HI&datasets=summary`

---

## 11. Build shape

Mirrors the proven Alaska family; nothing architectural is new.

| new file | modelled on |
|---|---|
| `scripts/lib/hiCountySources.mjs` | `scripts/lib/akBoroughSources.mjs` |
| `scripts/fetchHiCounties.mjs` | `scripts/fetchAkBoroughs.mjs` |
| `scripts/extractHiCounty.py` | `scripts/extractAkBorough.py` (+ Boulder for `units=1000`) |
| `scripts/seedHiCounties.mjs` | `scripts/seedAkBoroughs.mjs` |
| `scripts/processHiCounties.js` | `scripts/processAkBoroughs.js` over `scripts/lib/acfrGfLoad.mjs` |

Registry family: **`hi-local-acfr-gf`**, sibling of `ak-local-acfr-gf`. The HI
**state** node stays in `state-acfr-gf` and **nothing here touches it**.

PDFs land in gitignored `docs/HiCounties/<key>/` with a per-entity
`manifest.json` recording the serving URL and sha256.

⚠ Four counties means **four ACFR templates and four extractor configs**. One
config is measured (§3.1); three are not.

---

## 12. Cost

**$0 API spend** — free PDFs, no AI, no paid data. ~40 PDF downloads, ~10 MB
each at the top end.

| | estimate | in this pass? |
|---|---|---|
| PR 1 — the data, 4 counties, 38 filings, 76 rows | **3–4 h** | ✅ **yes** |
| follow-up A — 38 county deep-link hunts | 1.5–2.5 h | no |
| follow-up B — two-link source chip + migration + `e2e/` | 1–1.5 h | no |

**This pass: 3–4 hours, $0.** The comparable Alaska pass was 2–3 hours for 18
entities; Hawaii is 4 entities but Honolulu is a 362-page ACFR and each county
needs its own extractor config.

⚠ `feedback_session_cost_discipline` applies: if an extractor fights a template,
**stop and say so** rather than grinding — three loaded counties and one flagged
gap beats four counties and a blown afternoon.

---

## 13. Decisions and what's left

### 13.1 Chris decided

* **All four counties in one pass**, FY2016–2025, full depth (not Honolulu-first,
  not shallow)
* **Each county's tree mirrors its own report** — no invented mapping (§3.2)
* **"Show our work" is the standard** (§7.3) — a reader must be able to click
  through to the data *as the audited report presents it*. A link that breaks,
  or that shows only a portion, is a defect.
* **This pass ships FAC permalinks only** (§7.3.4). He asked for both links;
  the measurement in §7.3.2 showed the county-page link is proven for **zero**
  of the four, so the deep-link hunt and the two-link chip became follow-ups A
  and B rather than shipping something that fails his own standard.

### 13.2 My calls, flagged for him to overrule

* ~~Two PRs, data first~~ — **superseded.** Chris settled the sequencing himself
  in §7.3.4 once the measurement was in front of him.
* Display names `Honolulu` / `Hawaii County` / `Maui County` / `Kauai County`,
  Kauai stored without the ʻokina (§4.3)
* `audit_grade` loads at whatever the opinion honestly supports; a filing whose
  opinion is not unmodified GAAP is **loaded and flagged**, not held out
* A year whose statement fails a guard drops **that year only**, flagged — it
  does not block its entity

### 13.3 Still left to the builder

* The three unmeasured extractor configs (Hawaii, Maui, Kauai)
* The exact reader-facing page URL per county, given §7.2's WAF
* The `geoid_basis` value naming for Honolulu's consolidated case

### 13.4 Noticed, deliberately not in scope

The existing `Hawaii / state` node's 42 rows carry **`audit_grade = 'unknown'`**
(measured). After this load its four counties will read `audited_gaap`, so the
state will look *less* sourced than the counties beneath it. Worth a follow-up
— `project_state_node_unsourced_estimates` is the relevant arc — but it is a
different document and a different family, and folding it in here would widen a
measured 4–5.5 h task into an unmeasured one.
