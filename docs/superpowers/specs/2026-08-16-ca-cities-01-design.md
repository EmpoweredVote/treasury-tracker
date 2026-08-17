# CA-CITIES-01 — Top Five SCO-Only California Cities, ACFR-Sourced with Cross-Source Reconciliation

**Status:** spec, awaiting review
**Date:** 2026-08-16
**Predecessors:** v2.11 SoCal parity (CA/TX/NY/FL ACFR upgrades) · v2.23 WA-CITIES-01
**Branch (proposed):** `feat/ca-cities-01`

---

## 1. Goal

Bring the five largest California cities that currently have **no city-specific source** onto
audited-actual footing — General Fund expenditure-by-function and revenue-by-source from each
city's own ACFR — and, in the same pass, **measure for the first time how the State
Controller's numbers compare to the audited numbers for the same city-year.**

**The reconciliation is a first-class deliverable, not a load-time formality.** Where the two
sources disagree beyond what structure explains, that year is *not loaded*; it is written up
for investigation. A divergence is either a defect in our extraction or a real discrepancy
between what a city told the State and what its auditor signed. Both are worth surfacing, and
neither is worth papering over to finish a load.

**Why now.** California city coverage is complete by presence — all 482 incorporated cities are
in Treasury Tracker with operating, revenue and salary data — but 468 of them (19.6M residents)
rest entirely on the State Controller bulk series. These five are the largest of those.

**Success:** five cities live on ACFR actuals for every year that reconciles; every loaded row
re-derived at exactly $0 by a loader-independent harness; a recon document accounting for
*every* overlapping city-year as tie / explained / unexplained; no unexplained year loaded; and
Chris's UAT.

---

## 2. Locked decisions

Settled during brainstorming 2026-08-16. Not open at plan time.

| Decision | Choice | Why |
|---|---|---|
| **Entities** | Irvine, Stockton, Santa Clarita, Modesto, Chula Vista | The five largest CA cities with no city-specific source. ~1.21M residents |
| **Source class** | **City ACFR, audited GAAP actuals** | Matches Seattle/King County/Bainbridge/Kitsap/WA-CITIES-01/Tucson. Same basis as the SCO actuals already present, so the series stays coherent |
| **NOT adopted budgets** | Rejected | The existing CA deep cities (Anaheim, Fresno, Long Beach, Bakersfield, Riverside, Santa Ana) load *adopted budget* PDFs — plans. Those reach FY2026, so budgets are the only way to buy recency, but they append a plan to a series of actuals with **nothing in the schema marking the seam** (see §7, carried risk) |
| **FY window** | **Max available depth per city**, walking back from the newest ACFR | Chris's call. Same "as far as it goes" instinct as WA-CITIES-01, without that milestone's mechanical easy/hard rule — here the binding constraint is reconciliation, not extraction |
| **Overlap policy** | **ACFR supersedes SCO for a year that reconciles; SCO is retained for years ACFR does not reach** | One source per (muni, fy, dataset). Matches the established LA City pattern, where every FY carries exactly one source and they partition cleanly by year |
| **Divergence policy** | **Unexplained divergence blocks that year's load and goes to recon** | Chris's call, verbatim: "when they're off, that should be a flag to be better explored more than anything else." The flag is the deliverable |
| **Sequencing** | **Modesto first as the calibration city, then the other four** | The threshold must be measured before it can gate anything. See §4 |
| **County nodes** | **None needed** | All five counties already exist as nodes: Orange, San Joaquin, Los Angeles, Stanislaus, San Diego |
| **Depth trade-off** | **Deferred to calibration evidence, not pre-decided** | Chris, 2026-08-16. If ACFR proves materially coarser than SCO across the cohort, the call is made once, for the cohort, with §4.2's measurements in hand. See §4.4 |
| **Substitution** | **San Bernardino → Huntington Beach → Glendale**, by population | Chris, 2026-08-16, with the standing note that **the rest of the SCO-only cities are expected to follow eventually** — this cohort is the first slice of a longer CA build-out, not a one-off |
| **Per-capita** | **Set `population_year` during the load; gate per-capita display on it being present** | Chris, 2026-08-16. Where a properly-yeared population cannot be sourced for a year, per-capita is **off** for that year rather than inheriting a band — the WA-CITIES-01 rule |

**Assumed by precedent, not re-litigated:** General Fund basis only · municipality-scoped
enrichment, never NULL · source-safe tree sync only, never `treasury_sync_city_budget` ·
free documents, $0 API spend · executed inline, no research subagents · loader-independent
re-derivation harness.

---

## 3. Entity roster

All facts below read from production 2026-08-16.

| City | Population | County node | SCO window | FY2024 SCO depth (op / rev) |
|---|---|---|---|---|
| Irvine | 314,550 | Orange County (exists) | FY2003–2024 (22 yrs) | 17 cats / 33 items · 24 / 53 |
| Stockton | 261,253 | San Joaquin County (exists) | FY2003–2024 (22 yrs) | 26 / 44 · 32 / 72 |
| Santa Clarita | 230,659 | Los Angeles County (exists) | FY2003–2024 (22 yrs) | 18 / 39 · 26 / 50 |
| Modesto | 203,294 | Stanislaus County (exists) | FY2003–2024 (22 yrs) | **32 / 83 · 39 / 83** |
| Chula Vista | 199,680 | San Diego County (exists) | FY2003–2024 (22 yrs) | 23 / 39 · 31 / 55 |

**Modesto is the calibration city** because it has the richest existing SCO tree in the cohort.
A coarse city is a weak test of whether superseding costs depth; the richest one is the
strongest.

**Stockton is the highest-interest city** in the cohort for a reader: it filed for Chapter 9
bankruptcy in 2012 and exited in 2015, entirely inside the FY2003–2024 window already loaded.
Its reconciliation is also the most likely to be genuinely hard, for the same reason.

### ⚠ `population_year` is NULL on all five

Population is present but unyeared. Per-capita display must not silently attribute a current
population estimate to a FY2007 figure. Either set `population_year` during the load or leave
per-capita off for these cities — **a per-capita band must never be inherited** (WA-CITIES-01
lesson). `geo_id` is also NULL on four of five (Santa Clarita has `0669088`).

---

## 4. The reconciliation — the core of this milestone

### 4.1 Why it needs calibrating before it can gate

SCO and ACFR figures for the same city-year are **expected to differ for structural reasons**:
the State Controller's Cities Annual Report uses its own account taxonomy, and fund groupings
and transfer treatment need not match a GAAP fund statement. A gate asserting "these must
match" would flag nearly every year and be trained away within a day.

**No one in this project has ever measured the actual divergence.** LA City was checked during
scoping as a possible free calibration sample and does not provide one: its FY2003–2020 rows are
SCO, FY2021–2024 Socrata, FY2025 ACFR — the sources partition by year, with **zero overlapping
city-years anywhere in the table.** So the distribution is unknown and must be established
empirically rather than assumed.

### 4.2 Phase 0 — calibration on Modesto

Extract Modesto's full ACFR series and, for every year that also has SCO data, emit a delta at
two levels:

1. **GF total** — operating and revenue, absolute and percentage.
2. **Category level** — matched by name where possible, with unmatched categories on each side
   listed rather than dropped. This is what detects a taxonomy difference as opposed to a
   figure difference.

Also record **granularity**: categories and line items on each side, per year.

The output is a distribution, not a verdict. From it, register:

- the **tie threshold** — what counts as agreement;
- the **structural divergence catalogue** — named, repeatable reasons a delta is expected
  (transfers in/out treatment, internal service funds, SCO taxonomy folding);
- whether **ACFR is materially coarser than SCO** for this cohort, which is its own flag (§4.4).

### 4.3 Phases 1–2 — the other four behind the calibrated gate

Each city-year lands in exactly one bucket:

| Bucket | Condition | Action |
|---|---|---|
| **TIE** | Delta within the calibrated threshold | ACFR supersedes SCO. Loaded |
| **EXPLAINED** | Delta exceeds threshold but matches a registered structural reason from §4.2 | ACFR supersedes. Loaded, **reason recorded on the row's recon entry** |
| **UNEXPLAINED** | Anything else | **Not loaded. SCO row left untouched.** Written to the recon document for investigation |

An UNEXPLAINED year is **not a milestone failure** and must not be resolved by widening the
threshold. WA-CITIES-01 adjudicated all 33 of its printed-total residues individually against
rendered page images rather than loosening a tolerance, and that is the standard here.

Adding a new entry to the structural divergence catalogue mid-milestone is allowed, but it is a
**deliberate, recorded act** — a named reason with the evidence that established it — never an
implicit widening.

### 4.4 The depth flag

Superseding is only an unambiguous win when the ACFR is at least as granular. Modesto's SCO
tree is 32 categories / 83 line items for FY2024; if its ACFR GF statement is materially
coarser, superseding upgrades provenance while **downgrading** what a reader can actually see.

Where ACFR is materially coarser than the SCO row it would replace, that year is flagged and
**held out of the automatic supersede** pending an explicit call. This is a genuine
provenance-versus-detail trade-off and the spec deliberately does not pre-decide it — the
calibration phase produces the evidence to decide it once, for the cohort.

### 4.5 The recon document

`docs/superpowers/plans/CA-CITIES-01-RECON.md`, following the established `WA-CITIES-01-RECON.md`
and `117-RECON.md` convention. **Every overlapping city-year appears in it** — ties included.
A recon that lists only the problems cannot be audited for completeness, because a year that was
never checked is indistinguishable from a year that passed.

---

## 5. Source recon — the largest open unknown

**Not yet verified: that any of these five cities publishes a machine-readable ACFR.** This was
deliberately not probed during brainstorming, and the plan's first task must establish it per
city before any extractor work.

California has no equivalent of the WA State Auditor portal — no single host serving every
city's audited filings from one API. That was what made WA-CITIES-01 cheap per entity, and it
does **not** transfer. Expect five separate city websites, five document layouts, and archive
recovery for older years. Precedents that do transfer:

- **Oregon cities** (per-city ACFRs, no bulk source): `Sec-Fetch-*` header WAF workaround, the
  biennial-budget trap, and dash-zero rows that corrupt labels while `tie_delta` stays $0.
- **Tucson / Pima** (one-off city ACFR loads).
- `scripts/lib/acfrGF.py` is the shared GF extraction library, exercised across 168 PDFs.

**If a city's ACFR series proves unusable, substitute the next-largest SCO-only CA city** —
San Bernardino (194,120), then Huntington Beach (192,503), then Glendale (191,284). Same rule as
WA-CITIES-01's substitution clause, and for the same reason: the goal is residents reached.

---

## 6. Verification

Same three-harness standard as WA-CITIES-01, plus one addition specific to this milestone:

1. **Blind re-derivation** — every loaded row re-derived from source by a loader-independent
   harness, tying at exactly $0.
2. **Source-chain audit** — every row cites a reachable document; report selection by content,
   never by title.
3. **Enrichment coverage** — 100%, municipality-scoped, never NULL.
4. **NEW — reconciliation completeness.** Every (city, FY, dataset) that has both an SCO row and
   an ACFR extraction appears in the recon document in exactly one bucket. Asserted
   mechanically: no city-year may be silently absent, and no UNEXPLAINED year may be present in
   the loaded data.

Check 4 is the one that can fail quietly, so it is mutation-tested — deliberately mis-bucket a
year and confirm the check catches it — following the WA-CITIES-01 precedent of mutation-testing
new guards.

---

## 7. Carried risks and out of scope

**Carried risk — plan-vs-actual is not structural anywhere in TT.** `period_label` is NULL on
every row in `treasury.budgets`. Nothing distinguishes an audited actual from an adopted plan
except the free-text `data_source` string on the source chip. This already affects six shipped
CA cities whose FY2025–26 rows are adopted budgets sitting in the same series as their earlier
actuals. **This milestone does not fix it** — CA-CITIES-01 loads actuals only, so it neither
worsens nor repairs the condition. Flagged here because it was found during this brainstorm and
is a real defect in how TT represents its own data. Candidate follow-up: `SRCSTD-02`.

**Out of scope:**
- Recency. ACFR actuals top out at FY2024, the same year SCO already reaches. This milestone
  buys audit attestation and primary-source citation, **not** newer data. Anyone expecting
  FY2025–26 numbers from it will be disappointed, and that expectation should be corrected
  before the work starts rather than at UAT.
- The other 463 SCO-only CA cities.
- Alpine, Mariposa and Trinity counties — the three genuinely missing CA county nodes.
  (San Francisco is correct as-is: a consolidated city-county, present as a city.)
- Enterprise funds. General Fund only, consistent with every city onboarded since v2.21.

---

## 8. Review outcome — all three questions resolved 2026-08-16

Reviewed and approved by Chris. Nothing here is open at plan time; each answer is recorded in
the §2 decision table.

1. **Depth trade-off (§4.4)** — *deferred to calibration evidence*, as proposed. Do not
   pre-decide whether a coarser ACFR still supersedes; decide it once for the cohort from
   Modesto's measurements.
2. **Substitution list (§5)** — *confirmed* as San Bernardino → Huntington Beach → Glendale,
   with the standing note that the remaining SCO-only CA cities are expected to follow in later
   milestones. This cohort is the first slice, not the whole intent.
3. **Per-capita (§3)** — *set `population_year` during the load and gate per-capita on it.*
   Per-capita is suppressed for any year lacking a properly-yeared population rather than
   inheriting a neighbouring year's band.
