# Phase 87 — Enrichment Parity — Context

**Phase goal:** Every Ohio budget category shows a standardized, bleed-safe plain-language description.
**Requirement:** OHENR-01
**Depends on:** Phase 85 (cities) + Phase 86 incl. the county gap-closure (86-04/86-05). **UI:** no.

Direct analog: **VA Phase 82** (`scripts/loadVAEnrichment82.mjs` + `data/vaEnrichment82.mjs` + `loadVAEnrichment82.test.mjs`). Ohio mirrors it exactly — an explicit hand-authored, state-neutral universal-enrichment map keyed by exact `name_key`, a 100% coverage gate (no fallback), $/locality leak guards, and DELETE-THEN-INSERT writes (the `(name_key, municipality_id)` index is NULLS DISTINCT — upsert would insert duplicate universal rows; see [[reference_category_enrichment_nulls_distinct]]).

## The live Ohio vocabulary (the worklist the map must cover 100%)

Derived from the loaded budgets AFTER the county gap-closure (cities + counties, GAAP+CASH+MOD, depth-0; Ohio trees are FLAT so there are no depth-1 composite keys). **52 distinct keys** = 35 operating + 17 revenue (excluding the `total` root). This is LARGER than the ROADMAP's ~30 estimate because counties add their own vocabulary and the CASH/MOD bases use different terminology than GAAP.

**Revenue (17):** charges for services · contributions and donations · fines and forfeitures · income taxes · interest · intergovernmental · intergovernmental revenues · licenses and permits · other receipts · other revenues · payment in lieu of taxes · property taxes · receipts in lieu of taxes · rentals · revenue in lieu of taxes · sales taxes · special assessments

**Operating/expenditure (35):** basic utility service · bond issuance costs · capital outlay · community and economic development · conservation and recreation · debt service bond issuance costs · debt service interest and fiscal charges · debt service other · debt service principal retirement · fire · general government · general government judicial · general government legislative and executive · health · human services · interest and fiscal charges · intergovernmental · intergovernmental expenditures · judicial · legislative and executive · leisure time activities · other · other disbursements · other expenditures · police · principal retirement · public health · public safety · public services · public works · security of persons and property · security of persons and property fire · security of persons and property other · security of persons and property police · transportation

**Synonym clusters** (GAAP vs CASH/MOD vs city vs county terminology for the same concept — author each key, near-identical text is fine where truly synonymous, but EVERY key needs its own row for the coverage gate):
- in-lieu taxes: `payment in lieu of taxes` / `receipts in lieu of taxes` / `revenue in lieu of taxes`
- intergovernmental: `intergovernmental` / `intergovernmental revenues` / `intergovernmental expenditures`
- catch-all: `other` / `other receipts` / `other revenues` / `other disbursements` / `other expenditures`
- debt service: `principal retirement` / `debt service principal retirement`; `interest and fiscal charges` / `debt service interest and fiscal charges`; `bond issuance costs` / `debt service bond issuance costs`; `debt service other`
- public safety (GAAP city vs CASH/MOD vs county): `police` / `fire` / `security of persons and property` (+ `…police` / `…fire` / `…other`) / `public safety`
- governance: `general government` / `legislative and executive` / `general government legislative and executive` / `judicial` / `general government judicial`
- health: `health` / `public health`

> The map is built against the LIVE worklist, so if the loader's live-key derivation surfaces a key not listed above (e.g. a future FY adds one), the coverage gate ABORTS — add it to the map, never fall back.

## Implementation Decisions

- **D-01: Explicit hand-authored map, $0, NO paid-API path.** `data/ohioEnrichment87.mjs` exports `OHIO_ENRICHMENT` (keyed by exact name_key → `{plain_name, short_description, description, tags, confidence}`) + `EXPECTED_KEYS` (the canonical key list). Mirrors `data/vaEnrichment82.mjs`. Respects [[feedback_api_cost_threshold]] (inline authoring, no AI spend).

- **D-02: All text is CONCEPT-level, ENTITY- and STATE-neutral, bleed-safe.** No locality names, no $ figures, no Ohio-specific facts. Read correctly for an Ohio city, county, AND (for shared keys like "police", "property taxes") any other state. Prefer "the local government" over "the city". Every row is UNIVERSAL (`municipality_id` NULL) so bleed-safety holds by construction — but the past incident ([[project_enrichment_scoping_fix]]) was state-specific text in universal rows, so the state-neutrality is the actual safeguard, enforced by the locality-name guard.

- **D-03: 100% coverage gate, no fallback.** The loader derives the live worklist from the DB (OH city+county, operating+revenue, depth 0) and ABORTS if any live key is missing from the map. Mirrors VA — NOT the Utah Phase 72 heuristic router.

- **D-04: DELETE-THEN-INSERT over the authored keys** (NULLS DISTINCT — upsert duplicates universal rows). Two pre-write guards: a `$<digit>` leak guard and an OH-locality-name guard (against the live OH `municipalities.name` list, with a skip-set for common-English-word names — e.g. Ohio, Marion, Union, Clinton, Green, Mentor, Oberlin, Independence, etc. — so generic civic text doesn't false-positive). This intentionally OVERWRITES any shared universal keys with improved state-neutral text.

- **D-05: name_key = `budget_categories.link_key` = lowercased depth-0 label** (Ohio trees are flat — no `parent|child` composites). The app/API two-tier join reads the city-scoped row first, then the NULL universal row.

## Out of scope
- The Ironton population=0 gap (F-1) — a demographics backfill, not category enrichment; deferred (note for Phase 88 or a small follow-up).
- The county "Charges For Services" duplicate-column quirk — display-side, `total_budget` is authoritative; one enrichment key ("charges for services") covers it.
- Source-chain audit + UAT — Phase 88 (OHVER).

## Anchors
- `scripts/loadVAEnrichment82.mjs` + `data/vaEnrichment82.mjs` + `scripts/loadVAEnrichment82.test.mjs` — the exact template.
- `scripts/enrichCategories.js` — the name_key/link_key contract the app reads.
- Memory: [[reference_category_enrichment_nulls_distinct]], [[project_enrichment_scoping_fix]], [[feedback_supabase_migration_mcp]].
