# Next Milestone Seed — State ACFR Revenue-by-Source Upgrades

**Status:** seed note for `/gsd-new-milestone` (written 2026-06-29, right after v2.10 shipped). Not a roadmap — a head start so the new-milestone questioning has context.

## The idea (one line)

Upgrade the NASBO **operating-only** state nodes to full **State ACFR** nodes — adding **revenue-by-source** and richer GAAP **spending-by-function** — starting with the highest-traffic states. This is the documented "ACFR-later" half of the v2.10 hybrid.

## Why this is the natural next step

- v2.10 locked a **hybrid**: NASBO for breadth *now*, per-state ACFR upgrades *later*. v2.10 delivered the breadth (all 50 nodes sourced) but **cohort revenue-by-source was explicitly deferred** — NASBO has no per-state revenue. This milestone delivers that deferred half.
- The 47 NASBO states are currently **operating-only** (a disabled "Money In" card) and **budgetary basis, 6 functions**. MN/OH/VA already show the target end-state: **ACFR GAAP, operating + revenue, finer functions**. This brings the high-traffic states up to that standard.
- It directly advances the core value (every figure real + sourced) by adding the "where the money comes from" side for the states people look at most.

## Source class (proven, free, $0)

- Each state's published **ACFR** → Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances*, **GENERAL FUND column, GAAP basis** (in thousands). NOT budgetary/forecast.
- `pdftotext -table` reads these cleanly (proven on MN/OH/VA + confirmed again in Phase 97). Fetch-at-runtime works; **note: `archives.obm.ohio.gov` needs `curl --insecure --tlsv1.2`** (TLS-handshake quirk, recorded in 97-01-RECON.md).
- **Reuse the existing loaders:** `scripts/processOHAcfr.js` / `processVAAcfr.js` / `processMN*.js` are the templates (revenue-by-source + spending-by-function + P2 negative-investment clamp + 0-NULL source stamp + never-overwrite). `scripts/loadStateGF.mjs` (NASBO) stays as the fallback for any state not yet upgraded.

## Open questions to settle in `/gsd-new-milestone`

1. **Which states / how many?** Prioritize by population/traffic (CA, TX, NY, FL, PA, IL, …). Pick a batch size for this milestone (e.g. top 8–12) and leave the long tail on NASBO. Mixed basis within the cohort is already accepted (per-node basis label makes it honest).
2. **Upgrade = replace or augment?** When an ACFR node lands, delete/replace that state's NASBO operating rows (keep one basis per state-FY) and add revenue. Confirm the FY window per state (ACFRs go back further than the NASBO 2023–2024 window).
3. **How far back per state?** MN went to FY2008. Decide a default depth (e.g. latest 5 FYs) vs. as-deep-as-cleanly-available.
4. **Fold in the v2.10 follow-ups?** Candidate add-ons: MN FY1997–2007 history; the MN FY2008 operating $8.79M categorization gap (0.055%); the minor `?dataset=revenue` URL robustness on operating-only nodes.

## Carry-forward guardrails (unchanged)

- Free sources only, **$0 / $5 AI gate**, every figure durably sourced + **basis-labelled** (GAAP), GAAP not budgetary, idempotent never-overwrite, P2 negative-category render rule, **executed inline (no research/planner/executor subagents)**.
- Closeout shape: recon (independent re-derivation from the ACFR, not loader self-report) → cohort source-chain audit → live UAT with Chris sign-off (the Phase 88/93/97 mold).

## Memory pointers

`[[project_state_node_unsourced_estimates]]` (the 50-node inventory + hybrid mechanism + what's done), `[[feedback_no_research_subagents]]`, `[[feedback_api_cost_threshold]]`, `[[reference_treasury_budgets_probe_columns]]`, `[[feedback_supabase_migration_mcp]]`, `[[feedback_app_url]]`.
