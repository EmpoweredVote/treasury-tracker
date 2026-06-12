# Phase 47 Context — Program Origins Pilot

**Created:** 2026-06-12 (inline planning). **Goal:** 15–20 major programs show a sourced "details" section — enabling bill, public law, sponsor, year, cosponsors — every claim from Congress.gov/GovInfo records.

## Schema ready (Phase 43)

`treasury.program_details`: municipality_id FK, name_key, program_name, enabling_bill(+_url), public_law(+_url), enacted_year, sponsor(+_url), cosponsors_count(+_url), details jsonb ({field,value,source_url} convention), source_api NOT NULL, fetched_at. UNIQUE(municipality_id,name_key). RLS off; service_role granted (44 fix covers it).

## API reality (probed live with DATA_GOV_API_KEY, 2026-06-12)

- **Congress.gov v3 bill detail** (`/v3/bill/{congress}/{type}/{number}`): title, sponsors (fullName incl. party/state), laws[] (public law number), cosponsors count — the full ORIG-02 field set. Reliable for ~93rd Congress (1973) onward.
- **GovInfo STATUTE search** (POST /search, `collection:(STATUTE)`): official act title, dateIssued, packageId for older laws — verified the 1935 Social Security Act surfaces ("An Act To provide for the general welfare by establishing a system of…", 1935-08-14, STATUTE-49). **No sponsor data exists in any official API for pre-1973 laws.**

## The two-tier handling (no-inference rule)

- **Modern programs (1973+):** full rows from Congress.gov bill detail; sponsor_url = the api-backed congress.gov bill page; cosponsors from the API.
- **Foundational programs (pre-1973):** GovInfo STATUTE record → public_law citation, enacted_year, official act title. sponsor/cosponsors fields stay **NULL** with a details-jsonb note: "Sponsor records predate the Congress.gov API's structured coverage" — an honest boundary, same pattern as the depth boundary. NEVER fill from memory.

## Mapping discipline (the subtle ORIG-03 risk)

The program→enabling-act association is itself a factual claim. Rules:
1. Prefer acts whose FETCHED official/short title names the program (Social Security Act, Higher Education Act, Food and Nutrition Act…) — the fetched title is the evidence.
2. Where the program hides inside an omnibus (probe showed the Post-9/11 GI Bill is officially "Supplemental Appropriations Act, 2008"), the displayed claim must say exactly that ("enacted as Title V of the Supplemental Appropriations Act, 2008" ONLY if the fetched record/title structure supports it — else display the official title verbatim and nothing more).
3. Can't support the mapping from fetched records → SKIP the program with rationale. A shorter honest list beats a padded one.

## Pipeline shape (Chris's $0 rule — and origins need NO LLM at all)

Structured fetch → structured store. `data/federal-programs.json` = curated program list with API identifiers (committed, reviewable — the human-judgment artifact); `scripts/loadProgramOrigins.js` = deterministic fetcher/loader (DATA_GOV_API_KEY from env, never logged; api.data.gov default limit 1,000 req/hr — ~20 programs is trivial).

## Display (Phase 48 spot-checks "origins sections" — so they must render)

- Backend: program_details joined into the categories/enrichment read path or a small `/federal/programs` endpoint (decide in 47-03 by reading getBudgetById — lightest touch wins).
- Frontend: `ProgramOrigins` section under the enrichment description when the drilled category's name_key has a program_details row. Every field renders with its link; foundational programs show the sponsor-boundary note.
- name_keys: match category roots (e.g. 'social security', 'medicare') and, where a program maps to an agency-lens or subfunction node, that node's name_key — pin exact keys in 47-01 from SQL, never typed.

## Candidate programs (selection finalized by 47-01 probes; ~18 targets)

Foundational: Social Security (1935), Unemployment Insurance (1935), Medicare + Medicaid (1965 amendments), Interstate Highways (1956), NASA/Space Act (1958), Food Stamps (1964), Higher Education/Pell lineage (1965), Head Start (1964), Medicare-adjacent: skip if mapping unclear.
Modern: SNAP current authority (Food and Nutrition Act 2008), Post-9/11 GI Bill (2008), ACA (2010), CHIP (1997), TANF/PRWORA (1996), IDEA (1975), Stafford Act/FEMA (1988), Homeland Security Act (2002), Department of Education Organization Act (1979), MMA/Part D (2003), IIJA (2021), CHIPS and Science (2022).
Selection criteria: ties to a visible category, citizen recognition, API-supportable mapping.

## Safety line (ground rule 6 / ORIG-03)

Official acts only: sponsorship/cosponsorship as recorded. No addresses, no personal info beyond the official record, no vote characterizations, no framing.
