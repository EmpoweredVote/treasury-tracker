# Phase 56: Orange County Verification + UAT - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning
**Source:** Inline discussion (4 gray areas — reconciliation tolerance, sample scope, UAT checklist, discrepancy handling)

<domain>
## Phase Boundary

Independently **verify the loaded Orange County data is accurate** and **confirm the OC navigation experience end-to-end** in the live app, then get Chris's UAT sign-off.

Delivers:
- **VER-01:** OC city budget totals spot-checked against published ACFRs / adopted budgets and pass, with the checks documented (sourced, auditable).
- **VER-02:** Breadcrumb chain + Cities-in-Orange-County panel verified live; Chris UAT sign-off.

**Not in scope:** loading new data, adding datasets/cities, or new features/visualizations. This is a verification + UAT phase. Genuine load errors found during verification may be corrected (see D-04), but discovering/loading new data is out of scope. Salaries accuracy was already reconciled to the GCC source in Phase 55 (SC-4) — it is confirmed, not re-derived, here.

</domain>

<decisions>
## Implementation Decisions

### Reconciliation target + tolerance
- **D-01:** Spot-check each sampled OC figure against the **same basis** in the city's published ACFR / adopted budget — i.e. compare an adopted General Fund budget figure to the published doc's adopted GF total, audited actuals to actuals, etc. **Pass within ~1–2%**, and record a short **definitional note** wherever the bases differ (adopted-vs-actuals, General Fund vs all-funds). Honest and achievable given the known definition drift between source documents.
- **Why:** the roadmap mandates checking against published ACFRs/adopted budgets (an independent accuracy check, not a round-trip against the load source). Matching basis-to-basis with a small tolerance + notes catches real errors without tripping on definitional differences.

### Spot-check sampling scope
- **D-02:** Use a **representative sample of ~6–8 OC cities**: the **largest by budget** + **both custom-sourced cities (Anaheim, Santa Ana)** + a **couple of small cities**. Check the **latest fiscal year + one historical year**. Cover **operating + revenue** datasets. (Salaries already reconciled to GCC in Phase 55 — not re-checked here.)
- **Why:** "spot-check" is a sample, not all 34; this mix balances confidence (size range + the riskier custom-sourced cities + a historical year) against ACFR-fetching effort.
- **Exact city list:** Claude's discretion during planning — pick the largest-by-budget OC cities from the DB, include Anaheim + Santa Ana, and 2 small cities.

### Navigation UAT checklist (live app)
- **D-03:** Sign-off covers the **full OC nav + data surfaces**, not just the two roadmap-named items:
  1. City → county **breadcrumb** chain works.
  2. County page → **CitiesInCountyPanel** lists **all 34** OC cities and links work.
  3. **Salaries tab** appears on covered cities (Phase 55 result) and renders the names-free Dept→Position tree.
  4. **Per-capita** display works for OC cities.
  5. Custom-sourced **Anaheim / Santa Ana** render correctly (operating + revenue unchanged).
- App URL: https://treasurytracker.empowered.vote

### Discrepancy handling
- **D-04:** When a sampled figure doesn't reconcile cleanly: **definitional mismatches are documented as sourced known-variances and PASS**; only a **genuine load error** (wrong total, wrong year, wrong mapping) opens a **fix within this phase**. Keeps verification honest without ballooning scope into a re-load.

### Claude's Discretion
- Verification methodology/automation: a `verify-phase56.mjs` DB-probe script is the established precedent (cf. `scripts/verify-phase32.mjs` / `verify-phase33.mjs` / `verify-phase34.mjs`) plus a documented `56-VERIFICATION.md` / UAT artifact recording the per-city checks, figures, deltas, and definitional notes.
- Exact 6–8 city sample selection (per D-02 rule) and which historical year to use.
- Where to source each city's published ACFR / adopted budget figure (official city finance pages), and the exact figure cited per check.
- The reconciliation probe SQL/queries against schema `treasury`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior OC phases this verifies (the data + linking under test)
- `.planning/phases/53-orange-county-operating-revenue-load/53-01-SUMMARY.md` — the 34 OC cities and how operating/revenue (FY2003–2024) were loaded via the CA State Controller ByTheNumbers source; Anaheim (FY2025/26) + Santa Ana (FY2023–26) custom-sourced.
- `.planning/phases/53-orange-county-operating-revenue-load/53-VERIFICATION.md` — verification methodology precedent for the OC operating/revenue load.
- `.planning/phases/54-orange-county-entity-linking-enrichment/54-CONTEXT.md` + `54-VERIFICATION.md` — OC entity, 34-city `county_id` linking, breadcrumb + CitiesInCountyPanel wiring (the navigation under UAT).
- `.planning/phases/55-statewide-city-salaries-integration/55-COVERAGE.md` — OC salaries coverage (all 34 cities, 2009–2024) + the SC-4 salaries reconciliation already passed (confirm salaries tab presence, don't re-derive accuracy).

### Navigation components under UAT (confirm — no changes expected)
- `src/components/Breadcrumb.tsx` — city→county→state breadcrumb chain.
- `src/components/CitiesInCountyPanel.tsx` — the Cities-in-Orange-County panel (must list all 34, links work).
- `src/components/CitiesInStatePanel.tsx` — sibling panel (context).

### Verification tooling precedent
- `scripts/verify-phase32.mjs`, `scripts/verify-phase33.mjs`, `scripts/verify-phase34.mjs` — established DB-probe verification-script pattern to mirror for a `verify-phase56.mjs`.

### Locked conventions
- `docs/socal-county-onboarding.md` — "Locked conventions": honest source attribution; never overwrite custom-sourced cities (Anaheim/Santa Ana). Binds even though this phase doesn't load data — any D-04 fix must respect it.

### Ground rules
- Auto-memory `project_federal_tracker_ground_rules` — official public record only; never display unsourced data; document, never fabricate. Applies to the definitional-variance notes (D-01) — every cited ACFR figure must be sourced.

### DB access
- Production Treasury DB (NOT mcp__supabase-local): repo `.env` `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, schema `treasury`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `verify-phase3X.mjs` scripts: DB-probe pattern (read `.env`, query schema `treasury`, assert/report) to mirror for OC reconciliation probes.
- `Breadcrumb.tsx` / `CitiesInCountyPanel.tsx`: already-built navigation under UAT — verification confirms behavior, no changes expected.

### Established Patterns
- **Per-phase `*-VERIFICATION.md`** documents the methodology + results (precedent: 53/54/55 VERIFICATION docs).
- **OC cities resolve via `county_id`** = the Orange County entity (Phase 54) — the sample/probe reads the city set from the DB, never hard-codes it.
- **Custom-sourced cities (Anaheim, Santa Ana)** are the higher-risk reconciliation targets — included deliberately in the sample (D-02).

### Integration Points
- Reconciliation probe → `treasury.budgets` / `treasury.budget_categories` (operating + revenue rows for OC `county_id` cities).
- Live-app UAT → https://treasurytracker.empowered.vote (breadcrumb, CitiesInCountyPanel, salaries tab, per-capita).

</code_context>

<specifics>
## Specific Ideas

- Verification is **independent** (against published ACFRs/adopted budgets), not a round-trip against the CA State Controller source the data was loaded from — that's what makes it a real accuracy check.
- The **custom-sourced Anaheim & Santa Ana** must be in the sample — they bypass the standard ByTheNumbers pipeline, so they carry the most reconciliation risk.
- Sign-off is **Chris's** (live-app UAT), consistent with prior phases' human verification gates.

</specifics>

<deferred>
## Deferred Ideas

- Exhaustive all-34-city ACFR reconciliation → not this phase (spot-check sample only, D-02); could be a future deeper-audit pass if desired.
- Any data corrections beyond genuine load errors (e.g. re-loading to a different basis, adding missing years) → out of scope; document as variance (D-04) and revisit in a future phase if warranted.

None of the above is in this phase's scope.

</deferred>

---

*Phase: 56-orange-county-verification-uat*
*Context gathered: 2026-06-15 (inline — reconciliation tolerance / sample scope / UAT checklist / discrepancy handling)*
