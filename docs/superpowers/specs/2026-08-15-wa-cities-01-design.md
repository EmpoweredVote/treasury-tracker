# WA-CITIES-01 — Six Largest Washington Cities Onboarding

**Status:** spec, awaiting review
**Date:** 2026-08-15
**Predecessors:** v2.21 Seattle + King County · v2.22 Bainbridge Island + Kitsap County
**Branch (proposed):** `feat/wa-cities-01`

---

## 1. Goal

Bring the six largest Washington cities not already in Treasury Tracker onto the platform at
city parity — General Fund expenditure-by-function (Money Out) and revenue-by-source
(Money In), per-capita, bleed-safe enriched, every figure durably sourced — reusing the WA
State Auditor pipeline built in v2.22.

**Why these six, and why now.** v2.22 left behind an MCAG-generic pipeline: `scripts/lib/
waSao.mjs` (source client + content guard) and `scripts/lib/waSaoLoad.mjs` (tie gate,
per-capita band, source-URL validation, ephemeral `data_sources` lifecycle) take an entity
descriptor and are not specialised to Bainbridge or Kitsap. The SAO covers **every** WA local
government from one host with one API, so the marginal cost of a new WA entity is a
descriptor plus an extractor config — no new source to recon, no new provenance story, and
audit-attested rows by default. These six reach roughly a million residents, the largest
citizen coverage available per unit of work anywhere in the repo right now.

**Success:** all six cities live, every row re-derived at exactly $0 by a loader-independent
harness, a clean source-chain audit, 100% enrichment coverage, and Chris's UAT.

---

## 2. Locked decisions

These were settled during brainstorming and are not open at plan time.

| Decision | Choice | Why |
|---|---|---|
| **Entities** | Tacoma, Spokane, Vancouver, Bellevue, Kent, Everett | Largest WA cities not already loaded; maximises residents reached per unit of work |
| **FY window** | **FY2015–FY2025** | Modern SAO filings are the most uniform, so one config per city is likely and unreadable-year diagnosis should be rare. v2.22's cost was concentrated in *old* years — Bainbridge needed a second extractor for FY2004–2008 and four separate years proved unreadable, which is diagnosis work yielding zero rows. Multiplying that by six would dominate the milestone |
| **Counties** | **Nav-only nodes** for Pierce, Spokane, Clark, Snohomish | Matches the v2.17/v2.18 Pima precedent (still nav-only today). Keeps the milestone on cities. County finances are a clean, cheap follow-up |
| **Unusable city** | **Substitute the next-largest** | Preserves the population-reach goal. Precedent: v2.14 substituted Oklahoma for Alabama by rank when a source did not hold up. Requires one extra recon pass |
| **"Next-largest" means** | The largest WA city that is **not already in TT** and **not already in this roster**, by WA OFM population | Named explicitly so substitution is mechanical, not a judgement call mid-flight. Spokane Valley (MCAG 2781) is a real candidate here and must not be confused with Spokane — see §3 |
| **Basis** | General Fund only | Consistent with Seattle, King County, Bainbridge and Kitsap |
| **Sequencing** | **Tacoma pilot gates the five-city batch** | See §6 |

**Assumed by precedent, not re-litigated:** WA OFM April-1 estimates for population ·
municipality-scoped enrichment (never NULL) · source-safe `treasury_sync_budget_tree` only ·
free PDFs, $0 spend · executed inline, no subagents · three-harness verification.

---

## 3. Entity roster

MCAGs were resolved against the live SAO registry on 2026-08-15 and are pinned here so
recon starts from fact rather than a lookup.

| City | MCAG | County | County node |
|---|---|---|---|
| Tacoma | **0610** | Pierce | new, nav-only |
| Spokane | **0724** | Spokane | new, nav-only |
| Vancouver | **0247** | Clark | new, nav-only |
| Bellevue | **0374** | King | **exists** (v2.21) |
| Kent | **0401** | King | **exists** (v2.21) |
| Everett | **0664** | Snohomish | new, nav-only |

### ⚠ MCAG selection is ambiguous by name — this is a real trap, observed

The `GetEntities` lookup matches on a name prefix and returns **decoys that would silently
onboard the wrong government**. Observed live during scoping:

- `Spokane` → returns **City of Spokane** (0724), **City of Spokane Valley** (2781) and
  *City of Spokane Transportation Benefit District (Inactive)* (3062). **Spokane Valley is a
  genuinely different municipality** with its own population and its own filings.
- `Kent` → returns **City of Kent** (0401), *City of Kent Economic Development Corporation
  (Inactive)* (0662) and *City of Kent Special Events Center Public Facilities District*
  (3003).

The seeder and recon must select the entity whose name is **exactly `City of <Name>`**, and
must **reject any entity marked `(Inactive)` or carrying a district/corporation suffix**. An
MCAG mismatch is not a tie failure — it produces a perfectly self-consistent load of the
wrong government's money, which every arithmetic gate would pass. Treat a roster mismatch as
a blocker, and assert the resolved MCAG against the table above rather than trusting the
lookup.

---

## 4. Source and API contract (inherited, with the v2.22 corrections)

One host for all six: **`portal.sao.wa.gov` ReportSearch**. The SAO binds the full audited
statements for every local government except large self-publishing GAAP filers, so each row
carries audit-attested provenance.

⚠ **The report-type names are INVERTED for FY2014+**, and the whole FY2015–FY2025 window sits
inside that range. The type literally called *Annual Comprehensive Financial Report* is a
4–5 page auditor's opinion letter; *Financial and Federal* / *Financial* carries the bound
statements. **Select by CONTENT** — `classifyReport()` requires page count ≥ 40 plus a located
governmental-funds statement anchor — **never by type name.**

⚠ **Some of these cities may be self-publishing GAAP filers.** Seattle publishes its own ACFR
and v2.21 sourced it from the city, not the SAO. Tacoma, Spokane and Vancouver are large
enough that the SAO may hold only an opinion letter for them. **This is the single largest
open risk in the milestone** and is exactly what the Tacoma pilot exists to answer (§6). If a
city's SAO filings are opinion letters only, its options are: source that city's own ACFR
(the v2.21 path, a different fetcher and a different extractor shape), or substitute the next
largest city per the locked decision. `classifyReport()` already fails loudly on an opinion
letter, so this surfaces at fetch time rather than as an empty extraction.

API facts, each established by probing and each load-bearing: `SearchReports` reads
`pageNumber`, not `page` · it 500s unless **all seven** boolean filters are present · audit
periods arrive as `/Date(<epoch-ms>)/` and must be parsed, not string-sliced · plain fetch
with a browser UA suffices, no WAF fight.

---

## 5. Architecture

### Reused unchanged

- `scripts/lib/waSao.mjs` — MCAG-generic client, `classifyReport` content guard,
  `reportFileUrl`. No change expected.
- `scripts/lib/waSaoLoad.mjs` — `loadEntity(descriptor)`: FY-vs-filename cross-check, $0 tie
  gate, mapped-total == computed-total, sanity ceiling, per-capita band, source-URL
  validation, ephemeral `data_sources` create/delete. Takes a descriptor; no change expected.
- `scripts/lib/acfrGF.py` — shared extraction machinery, including
  `_recover_label_past_leading_rule` added in v2.22.

### New per city

A descriptor (name, MCAG, pdf dir/prefix, FY list, population, per-capita band, sanity max)
and an extractor config (`parents`, `root_leaves`, `revenue_parents`, `column_strategy`,
`units`, `fy_end`, `statement_anchor`, and any `source_rounding` residues adjudication turns
up).

### The file-layout question is deliberately deferred to the pilot

The existing convention is one extractor script per entity (`extractBainbridge.py`,
`extractKitsap.py`, `extractSeattle.py`). Six cities is roughly where that starts to hurt: a
shared bug then needs six edits. The alternative is a single `extractWaCity.py` with a
per-city config registry.

**This is not decided here.** Tacoma's config will show how much genuinely varies between WA
cities. If configs differ only in field values, the registry wins; if they need per-city code,
the per-file convention wins and should stay. Deciding now would be guessing at the very
number the pilot measures.

---

## 6. Phase A — the Tacoma pilot (gate)

Tacoma alone, end to end: resolve MCAG 0610 against the roster · enumerate and pin per-FY
ARNs across FY2015–FY2025 · fetch through the content guard · build the extractor config ·
seed Tacoma + Pierce County (nav-only) · load 22 rows via `treasury_sync_budget_tree` ·
adjudicate every residue individually · run all three harnesses.

**The pilot must answer four questions before the batch starts:**

1. **Does the SAO hold statements for a city this size, or only an opinion letter?** The
   answer changes the source for up to three of the six.
2. **What does a third WA city's tree shape actually cost?** Both prior entities needed their
   own config; Bainbridge needed two. This converts a projected per-city cost into a measured
   one.
3. **Does FY2015–FY2025 hold as a single-config window**, or does a shape change inside it
   force an era split?
4. **Registry or per-file?** (§5.)

**Gate:** if the pilot shows the per-city cost is materially higher than assumed — an era
split inside the window, or the SAO not holding statements — **stop and re-scope with Chris**
rather than starting five more cities on a broken estimate. This is the milestone's one
deliberate checkpoint.

⚠ **Two different failure triggers, deliberately not the same rule.** Do not collapse them:

- **One city is unusable** → apply the locked decision: drop it with a written verdict and
  **substitute the next-largest**, mechanically, without stopping. This is a per-city outcome
  and is expected to be survivable.
- **The pilot invalidates the milestone's cost model** → **stop and ask.** This is a systemic
  outcome: it means the remaining five are not the work we scoped. Substituting a city cannot
  fix a wrong shape estimate, so the substitution rule must not be applied here.

In Phase B the same distinction holds: an individual city failing is a substitution; a second
city revealing that the pilot's shape does not generalise is a stop-and-ask.

---

## 7. Phase B — the five-city batch

Spokane, Vancouver, Bellevue, Kent, Everett, on the shape the pilot proved. Per city: pin
ARNs → fetch → config → seed (+ nav-only county where new) → load → adjudicate residues.
Bellevue and Kent link to the **existing** King County node rather than creating one.

**Expected scale:** 6 cities × 11 years × 2 datasets = **132 rows**, minus any year or city
the source refuses. That number is a projection, not a promise — v2.22 scoped 84 rows and
shipped 72, every drop a source-document refusal. The spec commits to *documenting every
refusal*, not to a row count.

---

## 8. Phase C — verification

The three v2.22 harnesses, generalised from two entities to N rather than copied:

- **Blind re-derivation** — every row re-derived at exactly $0 from an independent read of the
  source PDFs, importing nothing from the extractors. **Ambiguous statement-page identity
  stays FATAL**: v2.22 proved a $0 tie cannot detect wrong-page selection — with Kitsap's
  anchor disabled, 10 of 13 singular-titled years selected a different fund's schedule and
  **9 of them tied at $0**.
- **Source-chain audit** — the eight checks from v2.22: year coverage including exclusions,
  tie integrity with every rounding acceptance named, provenance with pinned sha256 digests,
  per-capita units, label integrity, page identity, hierarchy, enrichment scoping. Every count
  scoped to a `municipality_id`.
- **Tether pre-determination** — **all six cities are expected NOT COVERED.** Essentials'
  `coverage.json` (2026-08-15) carries exactly one WA city and one WA county, Seattle and King
  County. That is a documented cross-repo gap, not a TT defect, and the harness must not
  assert coverage.

Plus `npm test` and `npm run test:acfr`. `npm run lint` is excluded — it is a broken gate in
this repo and has never exited 0.

---

## 9. Traps carried forward

Each of these has already cost real time once.

- **A label defect is invisible to a tie.** Dash-zero rows and rendered margin rules both
  corrupt labels while `tie_delta` stays 0. Assert the label *surface* directly.
- **The tie is unit-invariant.** It reads $0 whether or not a ×1000 multiplier was applied.
  Per-capita is the guard that is not unit-invariant, and **the band must be re-derived per
  city** — Seattle's `[500, 25000]` would reject a correct Kitsap load.
- **Units are per-issuer.** Seattle and King County print IN THOUSANDS; Bainbridge and Kitsap
  print WHOLE DOLLARS. Read units off the page, never configure them by assumption.
- **Column alignment differs by issuer.** Seattle left-aligns money columns, King County
  right-aligns them, so neither edge of a number is a stable column key.
- **Never trust a filename for fiscal year.** Bind FY from the page's own period sentence.
- **Enrichment must be municipality-scoped.** A NULL `municipality_id` is treated as universal
  and bleeds onto every other city.
- **Shebangs break `npm test` on Windows.** No `scripts/lib/*.mjs` may start with `#!`; a test
  guards this.

---

## 10. Out of scope

Deferred deliberately, each a candidate for its own milestone:

- **County finances** for Pierce, Spokane, Clark, Snohomish (nav-only here).
- **Pre-FY2015 history** for any of the six.
- **The rest of Washington** — 280-odd cities and 39 counties remain.
- **All-funds view** and **salaries**.
- **BANNER-01** — no shared-bucket banner asset will exist for these cities, so all six use the
  Wikipedia fallback. Separately, `cities/seattle.jpg` and `cities/king-county.jpg` exist in
  the bucket but are absent from `CURATED_CITY_BANNERS`; fixing that needs credits transcribed
  from Essentials' `buildingImages.js` and is not this milestone's work.
- **Essentials coverage** for the six cities — belongs in the Essentials repo.

---

## 11. Resolved at recon, not here

Deliberately unresolved, each with a named authority and a defined resolution — not TBDs:

| Item | Authority | Resolution |
|---|---|---|
| Per-FY ARNs for each city | SAO `SearchReports` | Pinned in a manifest, as `fetchBainbridgeKitsap.mjs` does |
| Whether each city's SAO filing carries statements | `classifyReport()` | Fails loudly at fetch; triggers §4's city-ACFR-or-substitute decision |
| Populations | WA OFM April 1 estimates | Read from the authority and recorded with the table read; never a third-party estimate |
| Per-capita band per city | Derived from the loaded spread | Re-derived per city, never copied |
| `source_rounding` residues | Rendering each page and reading the General column off the image | Registered as exact deltas, never a tolerance |
| Whether FY2015–FY2025 needs an era split | Tacoma pilot | Gate in §6 |
