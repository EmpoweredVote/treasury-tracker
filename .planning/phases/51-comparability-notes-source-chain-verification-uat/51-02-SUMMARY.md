# Plan 51-02 Summary — Comparability content (sourced)

**Status:** Complete
**Commits:** `feat(51-02): sourced comparability content …` · `feat(51-02): comparability source verifier`
**Requirements:** CTX-02 (criterion: sourced comparability copy)

## What changed
- **`data/federal-comparability.json`** (new, committed via `.gitignore` exception — mirrors `federal-enrichment.json` as the git-reviewable audit trail):
  - `transition_quarter` + `function_classification` — text + a verbatim `quote`, sourced to the **OMB Historical Tables Introduction** (`BUDGET-2025-TAB-1`). TQ from the "Note on the Fiscal Year"; function-comparability from "Structure" ("…When a structural change is made, insofar as possible the data are adjusted for all years.").
  - `agency_reorganizations[]` — five Cabinet-level changes across FY1976–FY2024, each tied to its enabling public law and verified against the GovInfo record:
    - Department of Energy 1977 — Pub. L. 95-91 (`STATUTE-91-Pg565`)
    - Department of Education 1979 — Pub. L. 96-88 (`STATUTE-93-Pg668`)
    - Department of Health and Human Services 1979 — Pub. L. 96-88 §509 (HEW redesignation, **confirmed verbatim** from the law text)
    - Department of Veterans Affairs 1988 — Pub. L. 100-527 (`STATUTE-102-Pg2635`)
    - Department of Homeland Security 2002 — Pub. L. 107-296 (`PLAW-107publ296`)
- **`scripts/verifyComparabilitySources.mjs`** (new) — asserts every entry has source_name/url/date and that each source_url resolves (govinfo via `api.govinfo.gov`, reusing the `auditFederalSources.mjs` pattern; others via HTTP GET).

## Verification
- `node scripts/verifyComparabilitySources.mjs` → **7 entries · 5 unique URLs · 0 failures** (exit 0). Every source confirmed via the GovInfo API.
- Sourcing integrity (threat T-51-02, block-on-high): every claim traces to fetched official text — OMB intro PDF + the four enabling laws (DOE/ED/VA/DHS Act titles + law numbers matched to their GovInfo records; the HEW→HHS redesignation read verbatim from 93 STAT. 694 §509). No model-memory facts.

## Notes
- PLAW collection covers 1995+ only, so pre-1995 laws (Energy, Education, VA) are cited to their Statutes-at-Large granules (`STATUTE-…-Pg…`); DHS uses the `PLAW-107publ296` package. All verify via the same govinfo-API path the audit uses.
- 51-03 (UI) consumes this file next; 51-04 (UAT) re-runs this verifier in the pre-UAT bundle.
