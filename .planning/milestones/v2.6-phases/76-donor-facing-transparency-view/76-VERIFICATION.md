---
phase: 76-donor-facing-transparency-view
status: passed
verified: 2026-06-21
method: inline goal-backward + live-app UAT (no subagent — per feedback_no_research_subagents)
requirements: [EVVIEW-01, EVVIEW-02, EVVIEW-03, EVVIEW-04]
---

# Phase 76 Verification — Donor-Facing Transparency View

**Goal (ROADMAP):** A visitor to EV's page can understand the organization's finances at a glance — income vs. expenses, an expense breakdown that surfaces the all-volunteer story, current balance + runway, and progress toward the fundraising goal.

**Two reframes locked during discuss/UAT (CONTEXT D-06, D-10/11/12):** EVVIEW-03 shows **balance + burn pace** (runway display intentionally dropped — it implies a shutdown that wouldn't happen for an all-volunteer org; `runway_months` still stored). EVVIEW-02 is an **honest, neutral expense breakdown** — the all-volunteer / $0-staff status is stated as a plain fact, not celebrated or branded.

## Success criteria

| # | Criterion (as reframed) | Result | Evidence |
|---|-------------------------|--------|----------|
| 1 | Income vs. expenses in plain language — where money came from (by source) and where it went (EVVIEW-01) | ✅ | Animated "raised $X" income headline (live, webhook-driven) + reconciled "After $125.32 in platform fees, $2,422.68 reached Empowered Vote" with per-source GiveButter/Patreon/Benevity gave→fee→net breakdown; expense top-categories narrative + icicle. Live at treasurytracker.empowered.vote. |
| 2 | Honest expense breakdown by category, neutral framing (EVVIEW-02 reframe) | ✅ | Top-category breakdown + icicle render the by-category spend; `$0` staff line is a plain year-specific fact ("So far in 2026, Empowered Vote has paid $0 in staff compensation") — celebratory "all work is done by unpaid volunteers" lead-in removed (D-11). |
| 3 | Current funds on hand + burn pace (EVVIEW-03 reframe — no runway) | ✅ | Header chip "$1,706.77 on hand · as of Jun 17" (static bank balance, tooltip notes it lags donations); burn-pace line "spends about $344.27 per month, mostly on <top category>". No runway countdown rendered. |
| 4 | Active fundraising goal + progress (EVVIEW-04) | ✅ (infra) | `goal_amount`/`goal_label` columns live on `org_financial_summary`; goal-progress bar (income_net ÷ goal, cap 100% + "Goal reached" state) renders when a goal is set. Chris has no FY2026 amount yet → bar hidden by design; `data/ev-goal.json` ready (label "Help Us Grow"), bar lights up automatically once an amount is set + loader re-run. |

## Requirements

- **EVVIEW-01** (income vs. expenses, by source, fee story) — ✅ live count-up headline + reconciled gross→fee→net per-source breakdown.
- **EVVIEW-02** (honest expense breakdown, neutral) — ✅ by-category breakdown + neutral $0-staff fact; no all-volunteer branding (reframe honored).
- **EVVIEW-03** (funds on hand + burn pace) — ✅ dated header chip + burn-pace line; runway display dropped (reframe honored; data retained in DB).
- **EVVIEW-04** (goal + progress) — ✅ infrastructure complete; progress bar gated on a set goal (none yet — intentional).

## Build / deploy / live checks

- `npx tsc --noEmit` → 0; `npm run build` → clean (pre-existing CSS @import + chunk-size warnings only).
- DB migration applied to prod (`kxsdzaojfaibhuzmclfq`): `goal_amount` + `goal_label` columns confirmed via `information_schema`.
- `reconcileEV.js` live FY2026 upsert verified via execute_sql: balance 1706.77 @ 2026-06-17, burn 344.27, income gross/fees/net 2548 / 125.32 / 2422.68, goal null. Idempotent re-run.
- API (cross-repo, ev-accounts-api): `GET /api/treasury/orgs/:id/financial-summary?fiscal_year=2026` → 200 on `accounts-api.empowered.vote` + onrender host, serving the correct EV row.
- Frontend deployed (Netlify, bundle `index-CxUODvrT.js`) — Phase 76 code confirmed live.
- **Chris live-app UAT (2026-06-21): signed off.** Iterated placement during UAT (panel top → bottom → Funds-on-Hand moved to a dated header chip) and restored the live donation count-up (the fee story had suppressed it); all confirmed in production.

## Notes / hand-offs

- **Live count-up restored:** the animated income headline (green-glow on return from GiveButter, v1.0 feature) was inadvertently suppressed when the fee story first replaced it; restored as the donation-feedback headline with the reconciled breakdown beneath. Funds on Hand deliberately kept OUT of this flow — it's a static bank balance that lags donations and must not read as live.
- **Goal pending:** when EV sets a real FY2026 goal, put the number in `data/ev-goal.json` (`goal_amount`) and re-run `node scripts/reconcileEV.js --fy 2026` — the progress bar appears automatically (no code change).
- **~$1 gross discrepancy:** animated headline shows live income (~$2,549, incl. ~$1.17 bank interest re-homed to revenue in 75-03) vs. per-source reconciled gross $2,548 — within rounding/interest; flagged to Chris, accepted.
- **Phase 77 (EVVIZ-01):** the "where the money goes" actual-spend graphic builds on this surface (data plumbing + narrative already here).
- Cross-repo coordination + deploy handshake recorded in `C:\EV-Accounts\ACCOUNTS-TEAM-REQUEST-org-financial-summary-2026-06-20.md`.

## Verdict: PASSED
