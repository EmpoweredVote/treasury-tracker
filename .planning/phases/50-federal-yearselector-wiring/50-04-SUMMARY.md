# Plan 50-04 Summary — Integration verification + regression

**Status:** Complete (contract verified; observed UAT approved by Chris on production)
**Requirements:** NAV-01, NAV-02

## Contract verification (50-04-01)
- **Data layer (SQL):** for FY1976 each lens returns exactly one null-label row (real FY1976 — operating $397.5B) and one TQ-label row (operating $102.1B); `period_label` populated.
- **Live HTTP (local backend, then prod):** `/budgets?fiscal_year=1976` returns `period_label` on every row (None for FY1976, the TQ string for the TQ); `/cities` `available_datasets` includes the 3 TQ rows. Confirmed on the deployed prod API after the Render deploy.

## Observed UAT (50-04-02) — APPROVED on production
Tested on https://treasurytracker.empowered.vote (United States). Chris approved:
- YearSelector lists FY1976–FY2025 + a distinct "Transition Quarter (Jul–Sep 1976)" entry after FY1976
- Switching years updates function / agency / revenue trees
- FY1976 (~$397B) and the Transition Quarter (~$102B) are distinct and correct
- Landing bands + deficit strip reflect the selected year; FYTD strip only on the FY2025 default
- City + state regression: year switching + default view unaffected

## Deploy
- Backend (EV-Accounts) → Render: rebased onto 6 new team commits (no force-push) + pushed `master` (`83b87196`); live API serves `period_label` (~60s deploy).
- Frontend (treasury-tracker) → Netlify: pushed `main` with the YearSelector wiring.

## UAT-surfaced fixes (pre-existing source-link quality — outside NAV scope, fixed opportunistically)
1. **Context-metric chips** (Debt to the Penny, FYTD receipts/outlays/interest) linked to raw `api.fiscaldata.treasury.gov` JSON → repointed to human fiscaldata.treasury.gov dataset pages. Fixed in prod DB (`federal_context_metrics.source_url`) + `loadFederalMTS.js` (`db5eb98`).
2. **Lens dataset chips** (function/agency/revenue) linked to raw `base_url` (OMB .xlsx / MTS JSON) via `datasetUrl` preference → federal entities now prefer the human registry `url` (`App.tsx`, `9ed35e0`); cities unchanged.

These were **pre-existing (Phase 44)**, not Phase 50 regressions. The **systematic** source-link audit across every figure/year remains **Phase 51** (Source-Chain Verification) scope.
