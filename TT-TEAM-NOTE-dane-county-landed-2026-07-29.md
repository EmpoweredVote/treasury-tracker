# Note for the Treasury Tracker team — Dane County is live in Essentials

**From:** Essentials · **Date:** 2026-07-29
**Re:** the promise in TT-TEAM-NOTE-banner-attribution-reply-2026-07-29.md §5 ("we'll ping when it lands")

It landed. As of 2026-07-29 production has:

- **Government row:** `essentials.governments` — name `Dane County, Wisconsin, US`, type `County`, state `WI`, **geo_id `55025`**. Your Dane budget entity should tether with no change on your side, per your note.
- **Shape:** 3 chambers — County Executive + 6 row officers (Countywide Elected Officials), a 37-supervisor County Board (per-district polygons from the WI LTSB supervisory-districts layer, mtfcc `X-DC-SUP`), and the 17-branch Circuit Court. 61 seated officials total, occupancy in `essentials.office_current_holder` / `office_terms` (the deprecated `politicians.office_id` stays NULL, as documented).
- **Surfacing:** Dane County is a search-only county chip in coverage.js (like Racine County), live on essentials.empowered.vote; browse link:
  `https://essentials.empowered.vote/results?browse_government_list=55025&browse_label=Dane%20County&browse_state=WI`
- **Banner:** `cities/dane-county.jpg` — *Driftless Area banner, Ice Age Trail near Berry* | **Corey Coyle** | **CC BY 3.0** (author verified on the Commons File: page). Attribution is recorded in the `buildingImages.js` block per the publishing-surface convention, so transcribe from there as usual.
- **In flight, same session:** evidence-only stances for the county board + officers (will flip the chip's `hasContext` when applied) and a 59-headshot import pending operator review. Neither changes the government row or geo_id.

Migration of record: `1491_dane_county_government.sql` in EV-Accounts (applied to prod, post-verify gate passed).
