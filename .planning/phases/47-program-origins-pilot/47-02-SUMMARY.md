# 47-02 Summary — Origins Data Pipeline

**Executed:** 2026-06-12 | **Status:** Complete — 15 program_details rows live, zero LLM

## What shipped

- `data/federal-programs.json` — curated identifier list (15 programs + 7 documented skips/folds). Identifiers and display labels ONLY; the loader enforces this with a key whitelist (T-47-03). Re-included in .gitignore.
- `scripts/loadProgramOrigins.js` — deterministic structured fetch → `treasury.program_details`. Every stored value is copied from a Congress.gov/GovInfo response or is a URL template around response identifiers. No generation step exists (ORIG-03 by construction). Sequential fetches, 300ms delay, DATA_GOV_API_KEY env-only and never logged; stored URLs are public pages without the key.

## Conditional probe outcomes (fetched-title gate)

| Candidate | Verdict | Evidence |
|---|---|---|
| Medicare (1965) | ✅ row | STATUTE-79-Pg286: "An Act to provide a hospital insurance program for the aged…" (P.L. 89-97) |
| Interstate highways (1956) | ✅ row | STATUTE-70-Pg374: title names highway construction/funding; publicLawCitation "Public Law 84-627" |
| Higher Education Act (1965) | ✅ folded | STATUTE-79-Pg1219 title-confirmed, but target node `department of education` is held by the Organization Act (UNIQUE one-program-per-node, same resolution as MMA) → fetched claim in that row's details jsonb |
| MMA / Part D (2003) | ✅ folded | 108/hr/1 fetched title "Medicare Prescription Drug, Improvement, and Modernization Act of 2003", P.L. 108-173 → claim in the medicare row's details jsonb |
| Head Start / EOA (1964) | ❌ skip | STATUTE-78-Pg508 title is "An Act to mobilize the human and financial resources of the Nation to combat poverty…", shortTitle null — names neither the program nor "economic opportunity" |
| Row 9b: Unemployment compensation | ✅ row | The fetched full 1935 title explicitly covers "the administration of their unemployment compensation laws" |
| Clean Air Act (1970, backup) | ✅ row | STATUTE-84-Pg1676: "An Act to amend the Clean Air Act…", Public Law 91-604 — used to reach 15 |

**Tally: 15 rows** (8 modern congress.gov + 7 foundational govinfo). National School Lunch Act backup skipped (target node already held by the Food Stamp Act).

## Verification (all green)

- 15 rows, US-scoped, zero NULL source_api, zero NULL enacted_year
- All 15 name_keys match live `budget_categories` tree nodes (depth-0 names + parent|child pipe keys)
- All 7 foundational rows: sponsor NULL + sponsor_note boundary claim present; zero govinfo rows with sponsor
- No claim-without-URL: every public_law and sponsor has its paired _url
- Idempotent: second live run upserted identical 15 rows, count unchanged
- URL sweep: 5 sampled govinfo records re-confirmed via api.govinfo.gov (200); congress.gov sampled URLs return 403 (bot wall — see deviations)

## Deviations from plan (documented choices)

1. **public_law_url uses govinfo, not the congress.gov law page.** Discovered: govinfo.gov app pages return HTTP 200 for ANY path (SPA), so page-status checks prove nothing — the loader verifies existence via the api.govinfo.gov package/granule endpoints instead. Also discovered: the PLAW collection starts at the 104th Congress (1995); P.L. 96-88 and P.L. 100-707 have no PLAW package, so those two carry pinned `law_record` Statutes-at-Large granules (citation cross-checked against the Congress.gov law number at run time). The must-have allows "GovInfo/congress.gov record".
2. **sponsor_url uses the Bioguide permalink** (`bioguide.congress.gov/search/bio/{bioguideId}`) instead of a www.congress.gov member page: member-page slugs are not derivable from the API, and congress.gov 403-blocks every non-browser client (curl, WebFetch) so a guessed slug could not be verified. Bioguide permalinks are identifier-only and canonical.
3. **enacted_year prefers the law record's date** (PLAW dateIssued / STATUTE granuleDate) over the latestAction heuristic — IIJA's latestAction is a post-enactment hearing, which broke the plan's heuristic.
4. **congress.gov URLs cannot be machine-verified from this environment** (403 bot wall, same as CBO/GAO). They are canonical templates around API-confirmed identifiers. → **Human/browser spot-check folds into Phase 48 source-chain verification.**

## For 47-03

- Read path: join program_details by municipality_id + name_key (pipe notation for child nodes: `parent|child`, lowercased)
- Foundational rows render the sponsor_note from details jsonb; details may also carry "Related act: …" claims (medicare, department of education)
- US entity id: 0098c405-65e1-426f-8e5f-0fcbe2a900c0
