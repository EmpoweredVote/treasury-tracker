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
| **FY window** | **As far back as each city goes *easily*** — a per-city floor, not a fixed year | Maximises history where the source gives it up cheaply, without paying v2.22's old-year cost. That cost was real and concentrated: Bainbridge needed a second extractor for FY2004–2008 and four separate years proved unreadable — diagnosis work yielding zero rows. "Easily" is defined mechanically in the next row so it is not a judgement call mid-flight |
| **"Easily" means** | Walk back from FY2025. The window ends at the first year that needs **anything beyond a value change in that city's existing config** — an era-split/second config, a font or OCR recovery, or a different source. An **isolated** unreadable year inside the window is documented and skipped, and the walk continues; **two consecutive** unreadable years end it | Mechanical and testable, so recon does not have to litigate "was that easy?" per city. It also encodes v2.22's hardest-won negative result: the FY2009 font decode was bounded, self-validating, and still failed — that is the class of work this rule refuses |
| **Counties** | **Nav-only nodes** for Pierce, Spokane, Clark, Snohomish | Matches the v2.17/v2.18 Pima precedent (still nav-only today). Keeps the milestone on cities. County finances are a clean, cheap follow-up |
| **Unusable city** | **Substitute the next-largest** | Preserves the population-reach goal. Precedent: v2.14 substituted Oklahoma for Alabama by rank when a source did not hold up. Requires one extra recon pass |
| **"Next-largest" means** | The largest WA city that is **not already in TT** and **not already in this roster**, by WA OFM population | Named explicitly so substitution is mechanical, not a judgement call mid-flight. Spokane Valley (MCAG 2781) is a real candidate here and must not be confused with Spokane — see §3 |
| **Basis** | General Fund only | Consistent with Seattle, King County, Bainbridge and Kitsap |
| **Sequencing** | **Tacoma first as a shape-finder, then the five-city batch — no mid-milestone gate** | Chris's call, 2026-08-15: do not stop and re-scope partway. Tacoma still runs first because what it teaches makes the other five cheaper, but its findings are *reported and applied*, not used as a checkpoint. See §6 |
| **Re-scope** | **Once, together, at the end of the milestone** | Decisions about what this changes for the rest of Washington are made with the whole batch's evidence in hand rather than from one city |

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

⚠ **The report-type names are INVERTED for FY2014+.** The type literally called *Annual
Comprehensive Financial Report* is a 4–5 page auditor's opinion letter; *Financial and
Federal* / *Financial* carries the bound statements. **Select by CONTENT** —
`classifyReport()` requires page count ≥ 40 plus a located governmental-funds statement
anchor — **never by type name.**

⚠ **The open floor crosses the FY2014 boundary, and the inversion is only known to hold above
it.** The original fixed window sat entirely in the FY2014+ range; a per-city floor that walks
back does not. What the type names mean *below* FY2014 was never established — v2.22 read
FY2004–2013 filings for two entities but selected by content throughout, so the question never
had to be answered. Selecting by content remains correct either way and needs no change; the
point is that **nothing in this milestone may start trusting a type name because "it's the
older format"**. Recon should record what the names actually do below FY2014, as a finding for
the next WA milestone rather than as something to rely on here.

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

## 6. Phase A — Tacoma first (shape-finder, not a gate)

Tacoma alone, end to end: resolve MCAG 0610 against the roster · enumerate and pin per-FY
ARNs walking back from FY2025 until §2's floor rule stops · fetch through the content guard · build the extractor config ·
seed Tacoma + Pierce County (nav-only) · load its rows via `treasury_sync_budget_tree` ·
adjudicate every residue individually · run all three harnesses.

**The pilot must answer four questions before the batch starts:**

1. **Does the SAO hold statements for a city this size, or only an opinion letter?** The
   answer changes the source for up to three of the six.
2. **What does a third WA city's tree shape actually cost?** Both prior entities needed their
   own config; Bainbridge needed two. This converts a projected per-city cost into a measured
   one.
3. **How far back does one config actually reach?** Tacoma sets the first real datapoint for §2's floor rule, and tells us whether these cities behave like Bainbridge (shape change around FY2009–2012) or hold steady deeper.
4. **Registry or per-file?** (§5.)

**Not a gate.** Tacoma runs first because what it teaches makes the other five cheaper, not
because the milestone pauses for approval afterwards. Its answers are written down and
applied to the batch, and the milestone continues. The single re-scope happens at the end,
with all six cities' evidence in hand (§9).

⚠ **Because there is no mid-milestone checkpoint, every failure needs a mechanical response
decided here.** Otherwise "keep going" quietly becomes "take on unplanned work". Three cases,
three rules, no judgement calls in flight:

| What recon finds | Response |
|---|---|
| A city's SAO filings are **opinion letters only** (a self-publishing GAAP filer) | Treat as **unusable → substitute the next-largest.** Do NOT silently pivot that city to its own ACFR: that is a different fetcher and a different extractor shape — v2.21-scale work per city — and taking it on unasked is exactly the scope creep the no-gate decision must not license. **Exception:** if the city's own ACFR needs nothing beyond a value change in the existing config, it is "easy" by §2's rule and may be loaded from there. Record which path was taken and why |
| A city is **unreadable** (image scans, ciphered fonts) at every year | **Substitute the next-largest**, with a written verdict |
| A city needs an **era split** to go deeper | Not a failure at all — the window simply **ends there** for that city, per §2's floor rule |

The effect is that no single finding can stop the milestone or expand it. A city either loads
cheaply, loads shallowly, or is replaced.

---

## 7. Phase B — the five-city batch

Spokane, Vancouver, Bellevue, Kent, Everett, on the shape the pilot proved. Per city: pin
ARNs → fetch → config → seed (+ nav-only county where new) → load → adjudicate residues.
Bellevue and Kent link to the **existing** King County node rather than creating one.

**Expected scale: deliberately not a fixed number.** With a per-city floor (§2) the row count
is an output of recon, not an input to it. Two reference points rather than a target: a
FY2015-floor batch would be 6 × 11 × 2 = 132 rows, and Bainbridge reached 18 usable years, so
a deeper floor could push well past that. v2.22 scoped 84 rows and shipped 72, every drop a
source-document refusal. **This spec commits to documenting every refusal and every floor, not
to a row count** — and no city's window may be extended by doing work §2 calls not-easy just
to make a number look better.

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

## 9. Phase D — closing re-scope

The milestone's only decision checkpoint, and it sits at the END rather than partway (Chris's
call, 2026-08-15). Nothing here blocks the work; it exists so the batch's evidence is used
rather than filed.

Bring to it, per city: where the floor actually landed and what stopped it · which cities
substituted and why · the true per-city cost, measured · whether the config registry beat the
per-file convention (§5) · what the type names do below FY2014 (§4) · every source-document
refusal, written down.

Decide from that: whether the rest of Washington is worth a follow-on milestone and at what
batch size · whether county finances (deferred to nav-only here) are as cheap as they look ·
whether the floor rule wants tightening or loosening next time.

---

## 10. Traps carried forward

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

## 11. Out of scope

Deferred deliberately, each a candidate for its own milestone:

- **County finances** for Pierce, Spokane, Clark, Snohomish (nav-only here).
- **History below each city's floor** — any year needing an era split, a font recovery or OCR is deferred by §2's rule, not attempted.
- **The rest of Washington** — 280-odd cities and 39 counties remain.
- **All-funds view** and **salaries**.
- **BANNER-01** — no shared-bucket banner asset will exist for these cities, so all six use the
  Wikipedia fallback. Separately, `cities/seattle.jpg` and `cities/king-county.jpg` exist in
  the bucket but are absent from `CURATED_CITY_BANNERS`; fixing that needs credits transcribed
  from Essentials' `buildingImages.js` and is not this milestone's work.
- **Essentials coverage** for the six cities — belongs in the Essentials repo.

---

## 12. Resolved at recon, not here

Deliberately unresolved, each with a named authority and a defined resolution — not TBDs:

| Item | Authority | Resolution |
|---|---|---|
| Per-FY ARNs for each city | SAO `SearchReports` | Pinned in a manifest, as `fetchBainbridgeKitsap.mjs` does |
| Whether each city's SAO filing carries statements | `classifyReport()` | Fails loudly at fetch; triggers §4's city-ACFR-or-substitute decision |
| Populations | WA OFM April 1 estimates | Read from the authority and recorded with the table read; never a third-party estimate |
| Per-capita band per city | Derived from the loaded spread | Re-derived per city, never copied |
| `source_rounding` residues | Rendering each page and reading the General column off the image | Registered as exact deltas, never a tolerance |
| Where each city's floor lands | Recon, per city | §2's mechanical rule; reported per city, never a judgement call |
