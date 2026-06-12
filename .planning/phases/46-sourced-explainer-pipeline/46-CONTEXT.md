# Phase 46 Context — Sourced Explainer Pipeline v2

**Created:** 2026-06-12 (inline planning). **Goal:** Every budget function and top agency has a plain-language explainer generated ONLY from fetched authoritative text, citation stored and displayed.

## Why this is "v2"

`enrichCategories.js` (v1) prompts the model with line items + vendor evidence and lets it write from its own knowledge. v2's hard rule (v2.0 ground rule 3 + SRC-01): **the generation prompt contains ONLY fetched official text** — the model condenses and translates to plain language; it may not add facts. If the fetched text doesn't support a claim, the claim doesn't exist.

## What v1 already gives us (reuse, don't rebuild)

- `treasury.category_enrichment` schema fits perfectly: `source` ('official' | 'hybrid' | 'ai'), `source_url`, `source_label`, `confidence`, `evidence_summary`, upsert on (name_key, municipality_id). v2 rows: `source='hybrid'` (official text, AI-condensed), source_url = the fetched document, evidence_summary = which text was fetched.
- name_key convention (enrichCategories.js:382): depth-0 = `normalize(name)`; deeper = `normalize(parent)|normalize(name)`. Function/agency lens roots are depth-0 → name_key = normalized title ("social security", "department of defense--military programs").
- Frontend already renders enrichment (shortDescription/description) on drill — zero UI work for Tier 1 display.
- ENRICHMENT_MODEL env (default claude-haiku-4-5) + Anthropic SDK + progress/idempotency patterns.

## Verified text sources (probed live 2026-06-12)

| Target | Source | Status |
|---|---|---|
| Agency explainers (top 10 by outlays) | USAspending `/api/v2/agency/{toptier_code}/` → official `mission` text + `website` + `congressional_justification_url` (98/111 agencies have CJ URLs) | ✅ VERIFIED — DoD probe returned mission text |
| Function explainers (~20) | NOT yet verified. Candidates in priority order: (1) **OMB Circular A-11** functional-classification section (whitehouse.gov PDF — accessible with browser UA; pdftotext exists in the repo toolchain); (2) **Public Budget Database user guide** PDF (same supplemental-materials page as outlays.xlsx); (3) GovInfo API Analytical Perspectives (DATA_GOV_API_KEY in .env) | ⚠️ verify-first task in 46-01 |
| DoD audit record (SRC-03) | GAO is curl-blocked. Candidates: defense.gov audit-results press release / DoD OIG (dodig.mil) audit reports / GAO via WebFetch / Congress.gov hearing records (key available). Fallback: human-download checkpoint (Chris grabs the GAO PDF in a browser) | ⚠️ verify-first task in 46-03 |

## Editorial standard (Tier 1 explainer — set here, enforced by the pipeline prompt)

- `plain_name`: ≤5 words, citizen vocabulary ("Justice & law enforcement" for Administration of Justice).
- `short_description`: 1 sentence, what the money does, no jargon.
- `description`: 2-4 sentences: what it funds, who it serves, the biggest components — ALL grounded in the fetched text; numbers only if present in the fetched text or supplied from our own sourced DB figures (clearly delimited in the prompt as "sourced figures you may quote").
- NEVER: opinions, "critics say", policy framing, model-memory facts, superlatives not in the source.
- Confidence: 'high' only when the fetched text directly covers the category; 'medium' if condensed from adjacent material; never publish 'low' — skip and log instead.

## Storage + display decisions

- All rows municipality_id = US entity id (`0098c405-…`) — never universal (Phase 42 lesson).
- SRC-03 lands in three places: (1) a `dod_consecutive_failed_audits` context metric (numeric value = consecutive failed audit count from the official record, label + source_url); (2) the National Defense function + DoD agency enrichment descriptions carry one factual audit-status sentence with the same citation; (3) MethodologyPanel gains an "Can these numbers be audited?" section reading that metric (computed, chipped — same pattern as the other sections).

## Cost (SRC-04)

~30 generations (20 functions + 10 agencies) × (~3k tokens fetched-context in, ~400 out). Haiku 4.5 ≈ **$0.15**; Sonnet 4.6 ≈ $0.45. Hard re-estimate printed by the pipeline before the run; abort > $5 (gate), warn > $1. Recon estimate (<$0.50) holds.

## Top-10 agencies (by FY2025 outlays, from the loaded agency lens)

HHS, SSA, Treasury, DoD–Military Programs, VA, Other Defense Civil Programs, Agriculture, OPM, Education, DHS. (Note: MTS T5 department names ≠ USAspending toptier names exactly — the pipeline needs a small explicit mapping table, e.g. "Department of Defense--Military Programs" → toptier 097.)
