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

- **Essentials coverage gap — CLOSED for Madison 2026-07-29, by the Essentials team.** At MAD-09 UAT the tether was absent because Essentials had not onboarded Madison. It has now: `City of Madison, Wisconsin, US` exists with **21 offices, 21 filled**, and `d5e21e07` wired it into `coverage.js`. The live catalog carries `{label: 'Madison', geoids: ['5548000'], state: 'WI'}` as of 2026-07-29T17:04Z, so **TT's Madison banner should now show the Essentials tether** with no TT change — worth confirming on screen. **Dane County is still uncovered** (Racine County is the only WI county in the catalog), so the county node keeps no icon.
- ~~**Wisconsin office shells with no officials (Essentials)**~~ — **RETRACTED 2026-07-29. This claim was wrong.** I counted officials through `politicians.office_id`, which is a deprecated column — it is NULL for **80,534** politician rows. Occupancy actually lives in `essentials.office_terms` / `current_office_holders`. Re-queried correctly, every WI government is staffed: Racine County 38/38 offices filled, City of Racine 16/16, Burlington 9/9, and so on (only Caledonia is 6/7). The Essentials commit describing the cluster as "fully seeded" was accurate; my reading of it was not.
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
