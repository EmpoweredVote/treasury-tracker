# Phase 82: Enrichment Parity (Virginia) — Research

**Researched:** 2026-06-23 (inline; live DB recon + Phase 72 precedent review)
**Question answered:** "What do I need to know to PLAN the VA category enrichment well?"

## RESEARCH COMPLETE

## Summary

Phase 82 is a near-clone of **Phase 72 (Utah Enrichment Parity)** but **simpler**: Virginia's category vocabulary is fixed and standardized statewide by the APA Comparative Report, so it is a small, closed set (73 keys) rather than Utah's unbounded messy fund names. That changes the authoring model from a heuristic router-with-fallback to an **explicit hand-authored map + 100% coverage assertion**. Everything else — universal (`municipality_id IS NULL`) rows, bleed-safety, `$`-leak guard, delete-then-insert (NULLS DISTINCT), dry-run/`--apply`, $0 inline authoring — carries over verbatim from Phase 72.

## The complete VA vocabulary (verified live 2026-06-23, 73 distinct `name_key`s)

`name_key` = `budget_categories.link_key`. Depth-0 = plain; depth-1 = `parent|child` composite.

### Operating (expenditure) — functions (depth-0, 10)
`community development` · `education` · `general government administration` · `health and human services` · `judicial administration` · `non- departmental` *(literal space after hyphen)* · `parks, recreation, and cultural` · `public safety` · `public works` · `virginia general fund budget` *(STATE node header)*

### Operating — `function|activity` (depth-1, 28)
- community development|cooperative extension program · community development|environmental management · community development|planning and community development
- general government administration|board of elections · general government administration|general and financial administration · general government administration|legislative
- health and human services|behavioral health and developmental services · health and human services|health · health and human services|income support benefits social services
- judicial administration|commonwealth's attorney · judicial administration|courts
- parks, recreation, and cultural|cultural enrichment · parks, recreation, and cultural|parks and recreation · parks, recreation, and cultural|public libraries
- public safety|correction and detention · public safety|fire and rescue services · public safety|inspections · public safety|law enforcement and traffic control · public safety|other protection
- public works|maintenance of general buildings and grounds · public works|maintenance of highways, streets, bridges, and sidewalks · public works|sanitation and waste removal
- **STATE node (6):** virginia general fund budget|{education, general government, health and human services, natural resources and commerce, other programs, public safety and corrections}

### Revenue — sources (depth-0, 8)
`charges for services` · `fines and forfeitures` · `general property taxes` · `miscellaneous` · `other local taxes` · `permits, privilege fees, and regulatory licenses` · `revenue from use of money and property` · `virginia general fund revenue` *(STATE node header)*

### Revenue — `source|subsource` (depth-1, 27)
- general property taxes|{interest, machinery and tools, merchants' capital, penalties, personal property - general, personal property - mobile home, public service corporations, real property} (8)
- other local taxes|{admission taxes, bank stock taxes, business license taxes, coal, oil, and gas taxes, consumer utility taxes, franchise license taxes, hotel and motel room taxes, local sales and use taxes, motor vehicle license taxes, other local taxes, recordation and will taxes, restaurant food taxes, tobacco taxes} (13)
- revenue from use of money and property|{interest, rental and sale of property} (2)
- **STATE node (4):** virginia general fund revenue|{corporate income tax, individual income tax, other taxes and fees, sales and use tax}

**Locality keys = 61; Virginia state-node keys = 12 (both in scope per D-82-04).**

## Key findings that shape the plan

1. **Shared universal rows (cross-state blast radius).** 7 of the 73 keys already have universal rows used by CA/MA/UT/TX/OR too. Measured reliance: `public safety` (CA 479, MA 351, VA 161, …); `education` (MA 351, VA 129, CA 54, …); `miscellaneous` (MA 351, VA 161, CA 3, …); etc. Because enrichment is keyed on `name_key` with `municipality_id IS NULL`, authoring the VA vocabulary **overwrites these rows globally**. Decision D-82-03 ("Improve + fix") makes the authored text entity- AND state-neutral so this is a strict improvement, and REQUIRES a CA+MA no-regression spot-check.

2. **`miscellaneous` is currently MISLABELED.** The live universal `miscellaneous` row reads plain_name="Information Technology" — wrong for VA (a revenue catch-all) and for MA's 351 entities. Phase 82 fixes it. This is concrete evidence for the overwrite policy.

3. **NULLS DISTINCT → delete-then-insert (not upsert).** The `(name_key, municipality_id)` unique index is NULLS DISTINCT, so `upsert(onConflict:'name_key,municipality_id')` INSERTS duplicate universal rows instead of overwriting. Must delete-then-insert over the authored keys. Reference impl: `scripts/loadUtahEnrichment72.mjs` lines ~221–242.

4. **Data-only phase.** `src/data/dataLoader.ts` fetches the budget tree from the REST API which joins enrichment by `name_key` server-side; `src/App.tsx` reads `category.enrichment.{plainName,shortDescription,description}`. No app/API code changes. SC#3 ("renders in-app") is a live-app human check at treasurytracker.empowered.vote.

5. **Disambiguation:** two parent-specific "interest" leaves (tax-penalty interest vs investment interest) — distinct composite keys, distinct authored text (D-82-08).

## Validation Architecture

The validation mechanism for this phase is **offline unit tests + a write-free dry-run that asserts coverage**, plus a human live-app spot-check. There is no runtime service to stand up.

| Dimension | What proves it | Mechanism |
|-----------|----------------|-----------|
| Coverage (every live VA key enriched) | `data/vaEnrichment82.mjs` has a row for all 73 live keys | Dry-run derives the live worklist and ABORTS if any key is unmapped; test hardcodes the 73-key list and asserts each is present |
| Bleed-safety (SC#2) | No `$`-figure, no VA locality name in any authored text | `$`-leak guard + locality-name guard in loader (abort on violation); offline test asserts the same over the whole map |
| Correctness of disambiguation | Two "interest" composites differ | Offline test asserts the two descriptions are non-equal and parent-appropriate |
| `miscellaneous` fix | Not "Information Technology"; reads as revenue | Offline test asserts plain_name != "Information Technology" |
| Idempotency | Re-running `--apply` reproduces the same rows | delete-then-insert keyed on name_key; dry-run row count stable |
| Renders in-app (SC#3) | VA city + county + town show plain language; CA+MA no regression | Human live-app spot-check (Phase 72 pattern) |

## Risks / landmines

- **Overwriting working CA/MA universals** — mitigated by state-neutral wording + mandatory CA+MA regression spot-check (D-82-03).
- **Key-string exactness** — `non- departmental` (space), `merchants' capital` (apostrophe), `coal, oil, and gas taxes` (commas inside the leaf). The map keys must match the stored link_key byte-for-byte. Coverage assertion catches mismatches at dry-run.
- **Accidental NULL-municipality duplicates** — mitigated by delete-then-insert (D-82-06).
