# Phase 75: Bank Truth + Reconciliation - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Beneficial State Bank the authoritative source for Empowered Vote's cash **balance** and **expenses**, and complete the reconciliation layer so that:

1. The latest bank **balance** + a **runway** estimate are surfaced (the expense load itself was already done in the Phase 74 session — `scripts/loadEVBank.js`).
2. Platform income (gross-by-source, from Phase 74) is **reconciled** against the net bank deposits so a platform donation and its corresponding bank payout are counted **exactly once**, producing an explainable variance figure.
3. **Off-platform / manual income** (checks, grants, bank interest) can be recorded and included in totals.
4. **Platform fees** (captured by `loadEVDonations.js` but currently dropped) are surfaced as a per-source gross→net story.

This phase owns the **data + reconciliation layer only** (loaders, the financial-summary record, the variance computation). The donor-facing rendering of balance/runway/fees lives in **Phase 76** (EVVIEW), and the actual-spend graphic in **Phase 77** (EVVIZ). This phase produces the numbers those phases display.

**Not in scope:** forward-looking allocation / "stretch goals" framing (deferred to v2 EVALLOC — see Deferred); in-kind / non-cash gifts (deferred); live-API ingestion (v2 EVAUTO); prior fiscal years (current FY only).
</domain>

<decisions>
## Implementation Decisions

### Balance & runway (EVDATA-04 balance half, EVVIEW-03 data)
- **D-01: Runway = balance ÷ trailing-3-month average burn.** Average the last 3 calendar months of bank debits and divide the latest balance by it. Chosen over YTD-average and annualized projection because EV's spend is small and *rising* (Jan $104.60 → Jun $399.29) — the trailing window tells the more urgent, honest story. With live FY2026 data: balance $1,706.77 (as of 2026-06-17), trailing-3mo burn ≈ $385/mo → runway ≈ **4.4 months**.
- **D-02: Store balance + runway in a new per-FY "EV financial summary" record** (fields: latest balance, as-of date, trailing burn rate, runway months, reconciliation variance — see D-05). One sourced/dated source of truth the Phase 76 view reads; avoids duplicating burn-rate logic across API + frontend.
- **D-03: No zero-burn guard needed.** Earlier concern about runway → infinity when trailing burn ≈ $0 does not occur — the bank shows spend every month. Real expenses always flow through the bank (lag only, not gaps — see D-09). Do not add a fake "no recent spend" state.

### Reconciliation (EVDATA-05, feeds EVVER-01)
- **D-04: Classify bank deposits by descriptor.** Every FY2026 bank deposit is cleanly identifiable from its `Description`:
  - GiveButter payout → `External Deposit Givebutter` ($810.00)
  - Benevity payout → `AMER ONLINE GIV1 - EDI PAYMNT` (American Online Giving Foundation, Benevity's disbursing entity) ($1,437.39)
  - Patreon payout → `External Deposit Patreon` ($307.74)
  - Bank interest → `Credit Interest` ($1.17)
- **D-05: Reconciliation = audit + stored variance figure, NOT a re-merge.** Match platform payout deposits to platform-net income (gross − fees) per source; compute and store the variance ("platforms report $X net ≈ bank received $Y, Δ = $Z"). **Platform exports remain the income authority; bank payout deposits are never re-added as income.** This structurally prevents the double-count (income from platforms, expenses from bank debits, platform deposits matched-and-excluded). The variance + its explanation (timing lag, fee estimation) feeds EVVER-01 in Phase 78.
- **D-06: Bank-only income is counted once, from the bank/manual side.** Income that no platform reports — bank interest, and future checks/grants — is real income the platforms can't see. Interest is bank-sourced income; unmatched deposits route to manual entry (D-08).
- **D-07: Unmatched non-platform, non-interest deposits are flagged for manual classification.** A deposit matching no platform descriptor and not interest is surfaced as "needs classification" for the operator to tag as a check/grant via the manual path (EVDATA-06). Nothing is silently dropped or auto-guessed. (FY2026 has none beyond interest, but the rule must exist.)

### Manual / off-platform entries (EVDATA-06)
- **D-08: Manual entries via a dedicated `data/ev-sources/manual.csv` + idempotent loader**, tagged `source='manual'`. Columns: date, source/label, amount, note. Matches the established drop-file-and-run workflow (Phase 74 D-07). Re-running with the same file changes nothing.
- **D-09: `data/ev-finances.csv` is fully retired.** With the bank owning expenses, platforms owning donation income, and `manual.csv` owning the rest, the old combined ledger has no remaining authority (completes Phase 74 D-08). Do not read it as a source.
- **D-10: In-kind / non-cash gifts deferred this phase.** EV is starting to receive in-kind gifts (e.g., Framer). Chris wants to show these eventually, but they are deferred to a follow-up. When implemented: record them flagged **non-cash**, excluded from balance, burn, and reconciliation, and shown as a separate "in-kind support" note (so they never corrupt the cash/bank-reconciled figures).

### Platform fees (EVDATA-04 fee story; Chris explicit ask 2026-06-20)
- **D-11: Fees live on the INCOME side as a per-source gross→net waterfall** — "donors gave $X → $Y platform fees → $Z reached EV." Store gross + fees + net per source (GiveButter, Patreon, Benevity each). Fees are modeled as a **reduction of income, NOT an operating expense.**
- **D-12: Fees are explicitly NOT an operating-expense line.** Platform fees never appear as bank debits (they're skimmed before the net deposit lands). Adding them to `operating` would make expenses exceed bank truth and violate "bank = expense authority." The gross→net framing tells the cost-of-fundraising story without corrupting the bank-authoritative expense total. The reconciliation variance (D-05) is exactly `gross − fees − bank_deposit` per source, so fees and reconciliation share one consistent math.

### Claude's Discretion (for the planner)
- Exact schema/location of the "EV financial summary" record (new table vs. a row on an existing metrics table vs. extension of the budgets row) — planner decides against the live schema, keeping it sourced + dated.
- Whether reconciliation + balance live in `loadEVBank.js` (extended), a new `reconcileEV.js`, or the income loader — planner decides; keep each loader idempotent.
- Exact trailing-burn edge handling (partial current month, FY boundary) — planner decides; default to summing the last 3 *complete* calendar months.
- The descriptor regexes for D-04 (anchor on the stable tokens: `Givebutter`, `Patreon`, `AMER ONLINE GIV`, `Credit Interest`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 74 decisions this phase builds on
- `.planning/phases/74-donation-source-refresh-idempotent-income-merge/74-CONTEXT.md` — the income model (D-01 hybrid bank-authoritative-for-cash + platforms-for-gross/fees; D-02 platform-net reconciles vs. bank deposits in *this* phase; D-09 fees captured but placement deferred to here).

### Existing EV pipeline (extend / reconcile these)
- `scripts/loadEVBank.js` — DONE expense side. Already parses `latestBalance(rows)` ($1,706.77 @ 2026-06-17), `extractDebits` (skips deposits), builds the 2-level expense tree, writes EV `operating` for one FY, idempotent (`source='bank'`). **This is where balance/runway likely extend, and it already skips the deposits reconciliation must now classify.**
- `scripts/loadEVDonations.js` — income loader (gross-by-source per platform export). **Captures platform fees per source (Phase 74 D-09) but currently drops them from display** — D-11 surfaces them as the gross→net waterfall. Planner must read how fees are extracted/stored here.
- `scripts/loadEVFinances.js` — legacy combined loader. Now writes expenses-only (superseded by `loadEVBank.js`); `data/ev-finances.csv` retired as a source (D-09). Reusable parsing/tree/DB helpers only.

### Data model
- `treasury.budgets` → `treasury.budget_categories` (tree) → `treasury.budget_line_items` (`source` column: `'csv' | 'givebutter_webhook' | 'bank' | 'manual'`). EV = `municipalities` row `name='Empowered Vote'`, `entity_type='nonprofit'`. Revenue hierarchy `['Income Type','Source']`; bank operating hierarchy `['Category','Vendor']`.
- Frontend reads EV via the production **ev-accounts API** (`ev-accounts-api.onrender.com`), NOT raw `treasury.budgets` — verify displayed totals against the API (see auto-memory `feedback_app_url`). The financial-summary record (D-02) must be reachable through that API for Phase 76.

### Live source data (already dropped in `data/ev-sources/`)
- `beneficial_state_bank_export_20260620.csv` — bank truth (56 FY2026 debits = $1,745.65; 16 deposits = $2,556.24; balance $1,706.77 @ 6/17).
- `givebutter_transactions-*.csv`, `patreon_creator-analytics-*.csv`, `benevity_DisbursementReport-*.csv` — platform exports (gross + fees).

No external ADRs/specs — decisions fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loadEVBank.js`: `readCsvRows`, `money`, `bankYear`, `bankISO`, `latestBalance`, `extractDebits`, `buildExpenseTree` — all exported and directly reusable. `latestBalance` already gives the balance figure; a deposits-by-descriptor classifier is the main net-new pure function for reconciliation.
- The COLORS palette + `linkKey` helper for visual consistency.
- `npm` script entry points exist for the EV loaders.

### Established Patterns
- **Idempotent per-(FY, dataset_type) clear-and-reload** is the write pattern (`deleteOperatingBudget` → `createBudget` → `insertCategories`). The financial-summary record + manual loader must be equally idempotent.
- **`source` column tagging** (`'bank'`, `'manual'`, `'givebutter_webhook'`) is how rows are attributed and how the webhook live-counter is preserved — keep it.
- Bank deposits are currently dropped by `extractDebits` (`if (amt >= 0) continue`) — reconciliation needs the deposit side, classified by descriptor (D-04), but must NOT write them as income (D-05).

### Integration Points
- Phase 76 view reads the financial-summary record (balance, runway, variance, per-source gross→net) via the ev-accounts API — design the record so the API can expose it.
- `loadEVDonations.js` fee capture (D-09) is the data source for the D-11 gross→net story — confirm the fee figures are persisted, not just computed-and-discarded.
</code_context>

<specifics>
## Specific Ideas

- **Fee framing Chris wants verbatim:** "donors gave $X → $Y platform fees → $Z reached EV" — per source. This is the cost-of-fundraising story and the reason hybrid (not bank-only) was chosen.
- **Runway story Chris wants:** make it obvious "we don't have a ton of money left" (~4 months at current pace) — honest urgency, not a comfortable-looking big number.
- **Reconciliation tolerance must be *explained*, not just a number:** the variance between platform-net and bank deposits is timing lag (a payout for late-period donations not yet deposited) + fee-estimation differences — EVVER-01 should state the cause.
</specifics>

<deferred>
## Deferred Ideas

- **"Stretch goals" / forward-looking allocation** — Chris's Kickstarter-style vision: show current balance + burn ("here's what we can build now"), and "what we unlock with more money." This is *forward* framing; v2.6's graphic (EVVIZ-01) is **actual spend so far** only. Deferred to **v2 EVALLOC-01/02** (forward allocation + planned-vs-actual). Captured richly because it is the donor-facing north star — revisit as the next milestone after v2.6 ships.
- **In-kind / non-cash gifts (Framer, software grants, donated time)** — EV is receiving these now; deferred this phase (D-10). Eventual design: flagged non-cash, excluded from balance/burn/reconciliation, shown as a separate "in-kind support" note. Near-term follow-up candidate (EVDATA-06 in-kind portion).
- **Live-API ingestion** (vs. manual CSV) → v2 EVAUTO-01.
- **Prior fiscal years** (beyond current FY) → out of scope this milestone.
- **Per-transaction / donor-level storage** → not done (aggregate-only, PII-safe per Phase 74 D-05).

None of the above is a Phase 75 blocker — all are intentional boundaries.
</deferred>

---

*Phase: 75-bank-truth-reconciliation*
*Context gathered: 2026-06-20*
