# Phase 75: Bank Truth + Reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 75-bank-truth-reconciliation
**Areas discussed:** Balance & runway, Reconciliation rule, Manual / off-platform, Platform fees display

---

## Balance & runway

| Option | Description | Selected |
|--------|-------------|----------|
| Trailing avg burn | Avg monthly spend over last N months × into balance; smooths spikes | ✓ |
| YTD avg burn | Total FY spend ÷ months elapsed | |
| Annualized projection | Project full-year burn from spend-so-far | |

**User's choice:** Trailing avg burn (3-month).
**Storage:** New per-FY metrics record (chosen over derive-at-read-time).

Follow-up (burn window + zero-burn guard) — user pivoted to vision/data:
- User: *"this would be a lot easier to understand if you showed our balance and burn rate. Some things, like the Noun Project, are $40/year, others are monthly. The goal is to show that we don't have a ton of money left, but show how we plan to spend it and what we will spend if we get more. A great Kickstarter campaign's stretch goals are a great touchstone — what we have bandwidth to make now and what we'll get with more money."*
- User on the zero-burn guard: *"it says no recent spend right now, inaccurately. There has been recent spend, but we aren't tracking those expenses, yet."*
- Claude showed real figures: balance $1,706.77 @ 6/17; FY2026 spend $1,745.65 across 6 rising months (Jan $104.60 → Jun $399.29); trailing-3mo ≈ $385/mo → ~4.4 months runway.

**Stretch-goals scope decision:** Capture as deferred (v2 EVALLOC) — keep v2.6 focused on the truth layer. (Options offered: capture-as-deferred ✓ / pull-light-version-in / re-scope-milestone.)
**Untracked-expenses clarification:** Timing/pending only — everything flows through the bank eventually, it's just posting lag; no new expense source. (Options: non-bank-card / timing-only ✓ / in-kind.) → zero-burn guard dropped.

---

## Reconciliation rule

Claude showed all 16 FY2026 bank deposits are descriptor-identifiable: GiveButter `External Deposit Givebutter` $810.00; Benevity `AMER ONLINE GIV1 - EDI PAYMNT` $1,437.39; Patreon `External Deposit Patreon` $307.74; interest `Credit Interest` $1.17.

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + variance figure | Match payouts to platform-net by descriptor; store variance; platforms stay income authority; deposits never re-added | ✓ |
| Bank deposits become income | Flip authority to bank deposits | |

**User's choice:** Audit + variance figure (feeds EVVER-01).

Unmatched-deposit handling:

| Option | Description | Selected |
|--------|-------------|----------|
| Flag for manual entry | Surface unmatched non-platform deposits as "needs classification"; nothing guessed | ✓ |
| Auto-bucket as 'Other income' | Auto-count as generic income | |
| Ignore for now | Only platform payouts + interest | |

**User's choice:** Flag for manual entry.

---

## Manual / off-platform

| Option | Description | Selected |
|--------|-------------|----------|
| Manual CSV + loader | data/ev-sources/manual.csv read by idempotent loader, source='manual' | ✓ |
| Direct DB rows | Insert straight into budget_line_items | |

**User's choice:** Manual CSV + loader.

In-kind handling:

| Option | Description | Selected |
|--------|-------------|----------|
| Defer in-kind | Cash entries only this phase | ✓ (with note) |
| Track, shown separately | Record now, non-cash flagged, excluded from balance/recon | |
| Include in income totals | Count in-kind in headline income | |

**User's choice:** *"We are getting some gifts - like Framer. I'm happy showing that, but we can defer in-kind for now."* → Defer, but captured Framer as the near-term follow-up with the show-separately design.
**Consequence:** `ev-finances.csv` fully retired (bank owns expenses, platforms own donations, manual.csv owns the rest).

---

## Platform fees display

| Option | Description | Selected |
|--------|-------------|----------|
| Income-side gross→net | gross + fees + net per source; waterfall on income side; not an expense | ✓ |
| Operating expense category | 'Platform Fees' line in operating | |
| Both / dedicated field | Track separately, surface in both places | |

**User's choice:** Income-side gross→net ("donors gave $X → $Y fees → $Z reached EV").

Granularity:

| Option | Description | Selected |
|--------|-------------|----------|
| Per source | GiveButter/Patreon/Benevity each show gross→fee→net | ✓ |
| Single total | One combined ~$125 figure | |

**User's choice:** Per source.

---

## Claude's Discretion

- Exact schema/location of the EV financial-summary record (new table vs. metrics row vs. budgets extension).
- Whether reconciliation/balance lives in `loadEVBank.js` (extended), a new `reconcileEV.js`, or the income loader.
- Trailing-burn edge handling (partial month, FY boundary) — default: last 3 *complete* calendar months.
- Descriptor regexes (anchor on `Givebutter`, `Patreon`, `AMER ONLINE GIV`, `Credit Interest`).

## Deferred Ideas

- **Stretch goals / forward-looking allocation** (Kickstarter-style "what we unlock with more") → v2 EVALLOC-01/02. The donor-facing north star; revisit after v2.6.
- **In-kind / non-cash gifts** (Framer, software grants, donated time) → near-term follow-up; show separately, exclude from cash/balance/reconciliation.
- **Live-API ingestion** → v2 EVAUTO-01.
- **Prior fiscal years** → out of scope this milestone.
- **Per-transaction / donor-level storage** → not done (aggregate-only, PII-safe).
