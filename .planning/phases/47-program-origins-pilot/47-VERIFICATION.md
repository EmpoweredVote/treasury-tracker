# Phase 47 Verification — Program Origins Pilot

**Date:** 2026-06-12 | **Verdict: PASS** (ORIG-01 ✅ / ORIG-02 ✅ / ORIG-03 ✅, regression clean)

## ORIG-01 — API access: PASS

`DATA_GOV_API_KEY` signed up and verified against both APIs before phase execution
(STATE.md human-action checkpoint, 2026-06-12). Re-exercised throughout 47-01/47-02:
every Congress.gov bill detail and GovInfo search/granule call in the pipeline ran
against the live keyed APIs.

## ORIG-02 — 15–20 programs with sourced origin details: PASS

- **15 rows** in `treasury.program_details`, US-scoped (8 modern via congress.gov,
  7 foundational via govinfo). SQL audit (47-02): zero NULL source_api, zero NULL
  enacted_year, zero claim-without-URL (public_law/sponsor each paired with its _url),
  all 7 foundational rows sponsor=NULL + sponsor_note boundary claim. All 15 name_keys
  match live `budget_categories` nodes (12 function lens + 3 agency lens).
- **URL sweep:** every govinfo record re-confirmed via api.govinfo.gov package/granule
  summaries (HTTP 200) — page-status checks are meaningless for govinfo (the SPA returns
  200 for any path), so existence is verified at the API. congress.gov URLs (bill,
  cosponsors, bioguide member pages) are canonical templates around API-confirmed
  identifiers; congress.gov 403-blocks all non-browser clients (curl + WebFetch tested),
  so browser spot-checks fold into Phase 48 source-chain verification.
- **Live display (production, treasurytracker.empowered.vote, Playwright):**
  - Social Security → card with "Public Law 74-271", official 1935 title, Enacted 1935, boundary note ✅
  - Health → Affordable Care Act, H.R. 3590 (111th), P.L. 111-148, Sponsor Rep. Rangel, 40 cosponsors ✅
  - Medicare → P.L. 89-97 + "Related act: Medicare prescription drug coverage (2003)" (MMA, P.L. 108-173) ✅
  - Transportation → IIJA, P.L. 117-58, Enacted 2021 ✅
  - Screenshots: `47-03-social-security.png`, `47-03-health-aca.png`, `47-03-medicare-dark.png` (dark mode)

## ORIG-03 — every claim sourced, zero inference: PASS

- **Loader audit (`scripts/loadProgramOrigins.js`):** no generation step exists — the
  pipeline is fetch → map → upsert. Field-by-field: enabling_bill/program titles/
  public_law/sponsor/cosponsors_count copied from API responses; every *_url is a
  deterministic template around response identifiers (bioguideId, congress/type/number,
  packageId/granuleId, detailsLink); enacted_year from PLAW dateIssued / STATUTE
  granuleDate. The curated JSON holds identifiers + display labels only, enforced by a
  key whitelist that throws on unexpected fields.
- **Mapping discipline held:** every kept program title-confirmed by fetch; Head Start
  skipped (fetched title names neither the program nor "economic opportunity"); HEA-1965
  and MMA-2003 folded as fetched details-jsonb claims when their nodes were taken.
- **Safety line:** sponsor display is name/party/district exactly as recorded by
  Congress.gov (`fullName`), linking to the official Bioguide record. No addresses, no
  personal info beyond the official record, no vote characterization, no editorial
  framing (card labels are field names; footer states the records' source).

## Regression: PASS

- Plano operating response carries no `programOrigins` key anywhere (production curl,
  byte-level grep) — the field is emitted only when a row matched, and program_details
  is municipality-scoped with no universal fallback.
- Production Plano drill (Playwright): no origins card. Federal categories without rows
  (National Defense) render exactly as before (card count 0).
- Backend change is additive-only on `getBudgetById`; `searchCategories` and all other
  read paths untouched.

## Deploys

- Backend: ev-accounts `e0521838` → Render, verified live (12 function-lens + 3
  agency-lens origins nodes in production responses).
- Frontend: treasury-tracker `876ef26` → Netlify, bundle marker confirmed, 4-program +
  1-negative production drill green.
