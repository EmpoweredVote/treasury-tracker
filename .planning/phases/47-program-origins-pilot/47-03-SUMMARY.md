# 47-03 Summary — Origins Display + Phase Close

**Executed:** 2026-06-12 | **Status:** Complete — Phase 47 closed with 47-VERIFICATION.md (PASS)

## What shipped

- **Backend (ev-accounts `e0521838`):** chose option (a) — `program_details` LEFT JOINed
  into `getBudgetById`'s category query using the same composite name_key convention as
  enrichment (`parent|name`, lowercased), municipality-scoped with no universal fallback.
  Additive `programOrigins` field on `NestedCategory` (omitted entirely when no row, so
  non-federal responses are byte-identical). `routes/treasury.ts` needed no change — both
  `/budgets/:id` and `/budgets/:id/categories` flow through `getBudgetById`.
- **Frontend (treasury-tracker `876ef26`):** `ProgramOrigins.tsx` — "Where this program
  comes from" card beneath the drill-view description. Rows: Enabling bill (modern) /
  Official title (foundational), Public law, Enacted, Sponsor (or the boundary note +
  Congress.gov coverage link), Cosponsors, then details-jsonb extras ("Related act: …").
  Every value an external link to its official record; footer names the records' source
  (Congress.gov / GovInfo). Dark mode + mobile via existing tokens.

## Verification

Production end-to-end (Playwright on treasurytracker.empowered.vote): Social Security,
Health/ACA, Medicare (incl. folded MMA claim), Transportation/IIJA all render with
correct linked claims; National Defense and Plano show no card. Render + Netlify deploys
bundle-confirmed. Full evidence in 47-VERIFICATION.md.

## Notes for Chris

- **EV-Accounts push carried 2 pre-existing unpushed commits** (`f515adf3`, `3582b1a6` —
  phase-117 MA stances planning docs, wip). Repo flow is push-to-master and they're
  docs-only, but flagging per the 45-01 lesson. Your uncommitted .planning deletions in
  that repo were left untouched.
- congress.gov bot-blocks all non-browser clients, so its page URLs (bill/cosponsors/
  bioguide) couldn't be machine-verified — they're canonical templates around
  API-confirmed identifiers. Phase 48's source-chain spot-check should click a few.
- Screenshots in this folder: `47-03-social-security.png`, `47-03-health-aca.png`,
  `47-03-medicare-dark.png`.

## Deviations from plan

- `sponsor_url` → Bioguide permalinks; `public_law_url` → govinfo records (47-02
  decisions, carried through display).
- Local backend dev env needed `npm install` (node_modules was missing tsx + several
  type packages; pre-existing unrelated tsc errors remain pre-existing).
