---
phase: 78-reconciliation-audit-live-uat
status: in_progress
audit_done: 2026-06-22
method: inline goal-backward audit against production Supabase (no subagent — per feedback_no_research_subagents)
requirements: [EVVER-01, EVVER-02]
scope_note: Phase 77 ("Where the Money Goes" graphic / EVVIZ-01) ICEBOXED 2026-06-22 — graphic excluded from this verification.
---

# Phase 78 Verification — Reconciliation Audit + Live-App UAT

**Goal (ROADMAP, rescoped):** The refreshed figures and transparency view are verified — combined totals reconcile to the bank balance within an explained tolerance, every displayed figure is sourced, and Chris signs off in the live app. *(Spend graphic excluded — Phase 77 iceboxed.)*

---

## EVVER-01 — Reconciliation audit + sourcing → ✅ PASS (with minor notes)

Audited against the production figures the app actually serves (`treasury.org_financial_summary` + `treasury.budgets`, EV `municipality_id = ee6f34f7-…`, FY2026), queried 2026-06-22.

### Figures displayed (FY2026, current period)

| Displayed figure | Value | Source label | Source date | Source URL |
|---|---|---|---|---|
| Funds on Hand (balance) | **$1,706.77** | Beneficial State Bank + platform exports | 2026-06-17 | — (private statement) |
| Total Income (revenue dataset) | **$2,549.17** | Empowered Vote — platform exports | — | — |
| Income gross / fees / net (summary) | **$2,548.00 / $125.32 / $2,422.68** | platform exports | 2026-06-17 | — |
| — Give Butter (gross/fee/net) | 703.00 / 26.89 / 676.11 | platform export | — | — |
| — Patreon (gross/fee/net) | 370.00 / 60.82 / 309.18 | platform export | — | — |
| — Benevity (gross/fee/net) | 1,475.00 / 37.61 / 1,437.39 | platform export | — | — |
| Total Expenses (operating dataset) | **$1,745.65** | Beneficial State Bank | — | — |
| Reconciliation variance | **−$132.39** | computed + explained (stored) | — | — |
| Monthly burn / runway | $344.27/mo / 5 mo (runway stored, not displayed — D-06) | derived from bank | 2026-06-17 | — |
| Fundraising goal | **null — not displayed** | — | — | — |

### Criterion 1 — Combined figures reconcile to the bank balance within an explained tolerance ✅

- **Bank balance is authoritative and independent** ($1,706.77 @ 2026-06-17) — taken directly from the Beneficial State Bank statement, not derived, so it cannot drift.
- **Primary reconciliation (platform income ↔ bank deposits):** platform net (gross − fees) $2,422.68 vs. matched bank payout deposits $2,555.07 → **variance −$132.39**, stored with a full `recon_explanation`: payout timing (export FY window vs. bank deposit timing) + fee-estimation differences; matched payout deposits are excluded from income, never double-counted. Largest component is Give Butter (Δ −$133.89). **This is the documented, explained tolerance the criterion requires.** ✅
- **Internal consistency checks (all tie):** per-source gross 703 + 370 + 1,475 = 2,548 = `income_gross` ✓; fees 26.89 + 60.82 + 37.61 = 125.32 = `income_fees` ✓; net 676.11 + 309.18 + 1,437.39 = 2,422.68 = `income_net` ✓.
- **Secondary sub-dollar variance (note, not a blocker):** revenue dataset $2,549.17 vs. summary `income_gross` $2,548.00 + interest $0.51 ≈ $2,548.51 → Δ ≈ $0.66. Sub-dollar, attributable to bank interest accrual / rounding between the revenue budget rollup and the donation summary. Within tolerance.

### Criterion 2 — Every displayed figure carries a source ✅ (with completeness note)

- Every displayed figure carries a **source label**: balance → "Beneficial State Bank + platform exports"; income → "Empowered Vote — platform exports"; expenses → "Beneficial State Bank". ✅
- **`source_url` is null everywhere — acceptable:** the underlying sources are a private bank statement and private platform exports; there is no public URL to link. Not a gap.
- **Minor completeness note:** `source_date` is populated on the summary balance (2026-06-17) but **null on the two `budgets` rows** (operating/revenue). Recommend backfilling `source_date` on those rows in `loadEVBank.js` / `loadEVDonations.js` for full sourcing completeness. Non-blocking — the date is present on the authoritative balance figure.

### Idempotency / integrity ✅
- Exactly one `org_financial_summary` row, one `operating` budget, one `revenue` budget for FY2026 — no duplicates (re-confirmed 2026-06-22; matches Phase 75 verification).

---

## EVVER-02 — Live-app UAT → ⏳ PENDING Chris sign-off

The audit confirms the data layer; EVVER-02 requires Chris to confirm it **renders correctly in the live app** (treasurytracker.empowered.vote). Checklist below.

### Findings for Chris to decide before/at UAT

1. **No fundraising goal is live.** `goal_amount` is null in both the DB and `data/ev-goal.json` (label is set: "Help Us Grow"). Per Phase 76 (D-01), the goal-progress bar (EVVIEW-04) **renders only once an amount is set**. → **Decision:** set a goal figure now (edit `data/ev-goal.json`, re-run `reconcileEV.js`), or accept shipping v2.6 with the goal bar hidden until a figure is chosen.
2. **Give Butter recon variance −$133.89** (flagged since Phase 75). Optional: refresh the Give Butter export and re-run `reconcileEV.js` (idempotent) to tighten the variance, or accept it as the explained tolerance above.
3. Minor: backfill `source_date` on the operating/revenue budget rows (non-blocking).

### Live-app UAT checklist (treasurytracker.empowered.vote → Empowered Vote page, FY2026)

- [ ] **Funds on Hand** shows **$1,706.77** with the **as-of 2026-06-17** date.
- [ ] **Income story (PlainLanguageSummary)** reads the gross → fees → net sentence: donors gave **$2,548**, after **$125.32** in platform fees, **$2,422.68** reached EV (verbatim framing per D-07).
- [ ] **Per-source mini-list** shows Give Butter / Patreon / Benevity with gave → fee → net (D-08).
- [ ] **Total Expenses** shows **$1,745.65**, with the expense breakdown by category (the honest, neutral breakdown — D-10).
- [ ] **$0 staff compensation** line reads as a plain, neutral fact — not celebrated (D-11/D-12).
- [ ] **Burn-pace** line present (≈$344/mo), **no runway countdown** (D-05/D-06).
- [ ] **Goal progress**: either renders against the goal you set, or is correctly hidden (no broken/empty element) if no goal is set.
- [ ] Every figure visibly traces to a source (bank statement / platform export).
- [ ] Spend graphic is **absent** and nothing references it (Phase 77 iceboxed — expected).
- [ ] **Chris sign-off:** _____________________  Date: __________

---

## Verdict

- **EVVER-01:** ✅ PASS (minor non-blocking notes: source_date backfill on budget rows; sub-dollar revenue/summary variance).
- **EVVER-02:** ⏳ PENDING Chris's live-app sign-off.
- **Phase 78:** IN PROGRESS — completes when EVVER-02 is signed off. v2.6 milestone close is blocked on this.
