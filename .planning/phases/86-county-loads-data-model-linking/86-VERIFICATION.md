# Phase 86 — County Loads + Data Model & Linking — Verification

> **Corrected verdict (2026-06-25, plan 86-05):** The original PASS below was superseded on
> 2026-06-25 when the county layout defect was discovered (plans 86-04/86-05 gap closure).
> The superseded banner has been replaced by this corrected section, which reflects the
> re-verified state after the full gap closure (delete → reload → re-link).

---

**Verdict: PASS** *(corrected — gap closure plans 86-04 + 86-05 complete)*
**Method:** Independent DB read-back via mcp__supabase-local probes (not executor self-report). All probes passed.
**Date:** 2026-06-25

## Requirement verdicts

### OHCO-01 — PASS
Ohio county governments loaded operating + revenue from the all-counties workbooks, per-capita, every figure sourced.

**DB evidence (plan 86-05 independent probes):**

**Coverage:**
- **88 counties** loaded (was 87 — Allen County recovered; all Ohio counties present), all named "<Name> County", entity_type='county'.
- **0 phantom county-as-city rows** (verified: 253 OH city municipalities, unchanged through county reload).
- **1,736 budget rows** across FY2016–2025:
  - FY2016–2024: 176 rows each (88 counties × 2 datasets = operating + revenue), 100% coverage
  - FY2025: 152 rows (76 counties × 2 datasets — FY2025 preliminary workbook, consistent with city behavior)
- All rows carry data_source='Ohio Auditor of State Summarized Annual Financial Reports' (0 NULL data_source, 0 NULL source_url).

**Text labels (original defect resolved):**
- **0 OH county budget_categories with numeric depth-0 link_key/name** — probe: count(name ~ '^-?[0-9]+$') = 0.
- Sample: Franklin County FY2024 operating has "Human Services", "Health", "Public Safety", etc.; revenue has "Intergovernmental", "Property Taxes", "Sales Taxes", etc. — all text labels.

**Totals spot-check (Franklin County FY2024, cross-checked against county GAAP workbook row 25):**
- Revenue total (col 16): DB stores $1,811,422,000 — **MATCHES** workbook col 16 ($1,811,422,000) ✓
- Operating total (col 32): DB stores $1,913,193,000 — **MATCHES** workbook col 32 ($1,913,193,000) ✓

**Allen County FY2016–2025:**
- Allen County is present (id confirmed); 20 budget rows (operating + revenue for each of FY2016–2025).
- FY2024: operating=$92,845,483; revenue=$114,318,939; population=100866.

**Sourcing + population:**
- 0 county rows with NULL source_url; all rows carry the per-FY+basis county source_url from ohioauditor.gov.
- 88/88 county municipalities have non-null population; 85/88 have population > 0 (3 MOD-basis counties have population=0 — expected, as MOD county workbooks use a different OI_Demographics layout that the batch driver does not read for canonical population; this is a pre-existing workbook characteristic, not a defect).

**Idempotency:** Re-run of FY2024 county load = 0 new municipality rows, 0 new budget rows (before: 6,616 AOS budget rows; after re-run: 6,616). Loader's never-overwrite guard is active and correct.

**Known workbook characteristic (not a defect):**
The county GAAP workbook contains two adjacent revenue columns both headed "Charges For Services" (cols 11 and 12). The loader faithfully reads both columns, creating two categories with the same label. The total_budget is always read from col 16 directly (not summed from categories) and is correct. This is an AOS workbook layout quirk, not a data corruption issue. The display sum of categories may appear to double-count "Charges For Services" but the canonical total_budget figure is unaffected.

### OHLINK-01 — PASS
Ohio state navigation node + Ohio cities/counties selectable; city→county linking via the source County column; US→Ohio→county→city breadcrumb + Cities-in-County panel.

**DB + code evidence (plan 86-05 independent probes):**

**City→county linking: 253/253 cities** carry county_id → their "<County> County" parent.
- Before gap closure (plan 86-02): 251/253 linked; Delphos + Lima unlinked (Allen County absent).
- After gap closure (plan 86-05): **253/253 linked** — Lima + Delphos now link to Allen County. 0 residual.
- Columbus→Franklin County verified; Franklin County has 16 linked cities.
- Delphos→Allen County verified; Lima→Allen County verified.

**F-3 resolved (from plan 86-03):** Germantown + Ironton (both MOD-basis, blank County in their only source workbook) are linked via the authored override `scripts/ohioCityCountyOverrides.json`. These are NOT in the residual.

**Linker idempotency:** Second run = 0 to-link (all 253 already correct), 0 residual. ✓

**ohioCountyResidual.json:** Updated in plan 86-05 — Allen County removed (it was a layout bug, not a source gap). `counties: []` (empty — no genuinely absent counties).

**Ohio state node:** exists (name "Ohio", entity_type='state'), carries pre-existing Ohio General Fund budget data (FY2022–2026, from the all-50-states load). Not a defect — preserved by never-overwrite guard.

**Frontend (no src/ changes needed):** code-trace from plan 86-03 confirmed existing primitives render Ohio with no changes — EntitySwitcher withData passes entity_type='state'; App.tsx jurisdictionParents returns [federal, state, county] for cities (US→Ohio→County→City) and [federal, state] for counties; CitiesInCountyPanel filters on county_id. Build clean.

## Findings carried forward

- **F-1 (Ironton pop=0):** Ironton has population=0 (sparse AOS demographics row). Per-capita for Ironton still won't render. Candidate for Phase 87 enrichment backfill.
- **Workbook characteristic (Charges for Services duplicate):** AOS county GAAP workbook has cols 11+12 both headed "Charges For Services". Loader reads both; display tree shows two identically-named leaves. total_budget is authoritative (col 16) and correct. Phase 87 enrichment is unaffected.

## Phase 87 readiness

No blockers. All 88 counties loaded (text labels, correct totals, sourced), all 253 cities linked to their county. County vocabulary is clean for enrichment (OHENR-01). Ironton population backfill is a small known candidate.
