# Requirements — (no active milestone)

**Last milestone:** v2.20 Madison, WI + Dane County Onboarding — **SHIPPED 2026-07-28** (Phases 135–137, MAD-01..09 all signed).
Archived: `.planning/milestones/v2.20-REQUIREMENTS.md` · `v2.20-ROADMAP.md` · `v2.20-phases/`

Run `/gsd-new-milestone` to start the next one. Candidates below.

---

## Candidate milestones

### SRCSTD-01 — sourced-standard backfill *(scoped; sharpened by v2.20)*

Original brief: `.planning/SRCSTD-01-SCOPING.md` (city source gap = MA DLS + CA publicpay; enrichment text that is AI-labelled-but-uncited is a policy call).

**v2.20 found the bigger half of this.** TT records *no per-row audit grade*. `budgets.data_source` is free text, and Madison's "(unaudited MFR)" label works only because it was hand-written into the string. So TT cannot answer "show me only audited figures" — the information isn't in the schema. The natural shape is a grade per row — *Audited GAAP* (read from the ACFR) → *Compiled from audited statements* (VA APA) → *Self-reported unaudited* (WI CMREB/MFR) — surfaced as a filter. That keeps full coverage and still serves a reader who wants only audited numbers. See `reference_audited_bulk_sources_and_fdta` for why audited-only-with-full-coverage is not achievable as a data policy.

### VOTES-01 *(scoped earlier)*

### WI-CITIES-01 — Wisconsin statewide fan-out

The remaining 189 WI cities + 71 counties (~2,600 rows) from the same workbooks and the same loader — `loadWICMREB.js` already dry-ran `--all` at 190/190 cities and 72/72 counties with $0 ties, and CMREB's statewide-uniform categories mean the 34 enrichment keys verified for Madison already cover every WI municipality. The real cost is entity seeding and verification breadth.

**Gate before loading:** MAD-01 reconciled *Madison only* against an audited ACFR. Spot-check a few cities across size bands (Milwaukee, Green Bay, something small) before committing 260 unaudited entities on one city's reconciliation.

**Carry forward:** in a refunding year CMREB's expenditure total includes debt principal retired with borrowed money (Dane CY2023: $180M debt service against $431M of excluded Other Financing Sources). Not a bug — GAAP governmental funds does the same — but it makes year-over-year reading misleading and needs surfacing.

---

## Open follow-ups (not milestone-sized)

- **Essentials coverage gap — bigger than a catalog entry** (corrected 2026-07-28 after checking the Essentials DB). Madison, WI and Dane County, WI are absent from `coverage.json` because **Essentials has never onboarded them**: `essentials.governments` holds **0 rows** for GEOID `5548000` (Madison) or `55025` (Dane) — no government, no chambers, no offices, no officials. `coverage.js` is "the single source of truth for which areas Essentials has **ingested**", and each entry carries a `browseGovernmentList` of GEOIDs the browse route resolves against. Adding a line for Madison would point the tether at an **empty browse** — a dead deep-link on TT's banner, which is worse than the honest no-icon we ship today. The real work is an Essentials **city onboarding** (`LOCATION-ONBOARDING.md`, Steps 1–8: charter/election method, Common Council + Mayor, Dane County Board + Executive, districts, headshots, migrations) — a multi-phase project in that repo, comparable to its Boston or Long Beach onboardings. **Not a TT task, and not a one-line fix.**
- **Wisconsin office shells with no officials (Essentials)** — separately, `essentials` holds **37 WI local government/chamber rows** (Racine County, City of Racine, Burlington, and 16 villages/towns) with **0 politicians** across all of them. Office scaffolding was seeded and never filled. Correctly excluded from coverage today; worth either finishing or removing so it can't be mistaken for coverage later.
- **`fetchDate` / `fetchedAt` naming** — the prop and API field are still named for a retrieval time they never carried; this is what produced the "fetched" chip defect fixed in v2.20. ~10 call sites plus an EV-Accounts API change.
- **Ohio county `OI_Demographics` offsets** — still unverified; the `MAX_PLAUSIBLE_POPULATION` guard prevents bad writes but the root cause needs the county workbook (carried from Phase 136).
- **Enrichment-quality audit** — the broken universal `ambulance` text was found by eye, not by a check. Copy-paste of a *neighbouring* concept's text is invisible to duplicate detection since the strings differ.
- **`npm run lint`** is a broken gate in this repo — never exits 0; don't use it as a check.

---

## Deferred (Wisconsin)

- **WI-TOWNS-01**: WI villages (417) + towns (1,242). Coverage win, but ~1,650 entities many under $1M — weigh against the browse-dilution incident that capped CityGrid rendering (`project_posthog_session_replay_freeze`).
- **MAD-ACFR-01**: Deepen Madison to **FY2015** from its own audited ACFR archive. Would give audited GAAP + 5 extra years, at the cost of two bases inside Wisconsin unless it *replaces* the CMREB rows. Now carries a measured gap to justify the effort: 0.11% on revenue, 1.36% on expenditure.
- **WI-PRE2020-01**: CMREB history before CY2020 — bulletins exist as PDF but were not probed for an XLSX equivalent.
- **WI-SAL-01**: Wisconsin employee compensation — no free statewide comp dataset identified; same blocker as AZ.
