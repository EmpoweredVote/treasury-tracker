# Phase 74: Donation Source Refresh (Idempotent Income Merge) - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Get Empowered Vote's donation **income** current across GiveButter, Patreon, and Benevity, deduplicated so re-imports and the live webhook never double-count. Income is stored **gross, by source, at the per-fiscal-year grain** (matching the existing `revenue` budget), for the **current fiscal year only**.

This phase owns the income (gross-by-source) side and the platform-fee figures that only the platform exports can provide. It does NOT own the bank load, the cash-balance/expense truth, or the platform↔bank reconciliation — those are **Phase 75** (this phase hands the platform totals forward to be reconciled there). Manual/off-platform income and bank-interest are also Phase 75 (EVDATA-06).
</domain>

<decisions>
## Implementation Decisions

### Income model (the milestone's central architecture decision)
- **D-01: Hybrid — bank-authoritative for cash, platform exports for gross + fees.** The bank (Phase 75) is the authoritative source for money actually received and balance. Platform exports exist to recover what the bank cannot see: **gross donations** and **platform fees** (the bank only ever sees net-of-fees deposits, often batched). This preserves the existing transparency story: *"donors gave $100 → platforms took ~$3 → $97 reached EV."* Chris explicitly weighed bank-only vs. hybrid and chose hybrid to keep the gross/fees breakdown.
- **D-02: Platform-net should reconcile against bank deposits in Phase 75.** Sum(platform gross − platform fees) per source ≈ the corresponding bank deposits. This phase produces the platform-side numbers that Phase 75 reconciles; a platform payout already in the bank must never be added on top of its donations.

### GiveButter master record
- **D-03: The GiveButter platform export is the authoritative master for the GiveButter total** — NOT the manual Google Sheet and NOT the webhook. Rationale: the export is complete and accurate; the webhook only captures donations since deployment (and only successful deliveries); the hand-entered sheet is error-prone and defeats the "pull the data" goal of v2.6.
- **D-04: The v1.0 live donation counter is preserved via an export-baseline + webhook-delta rule.** Authoritative GiveButter total = **export aggregate (baseline) + sum of webhook rows received *since* the last export**. Re-importing a fresh export resets the baseline and supersedes the delta. Live AND accurate, no double-count. Webhook rows (`source='givebutter_webhook'`) are NOT summed on top of the export aggregate. (Planner confirms exact mechanics against the `record_givebutter_donation` RPC + `budget_line_items.source`.)

### Storage grain
- **D-05: Aggregated by source + period (per fiscal year).** Store per-source totals, not per-transaction rows. Inherently privacy-safe (no donor PII — honors the public-record-only safety line) and matches the source breakdown the app already renders (`Donations → {Give Butter, Patreon, Benevity}`). No donor names/emails stored or displayed.

### Scope
- **D-06: Current fiscal year only.** Bring the current FY's donation income current; prior years left as-is this phase.

### Ingestion cadence / workflow
- **D-07: Manual re-export + re-run, per-platform files in one folder, one idempotent loader.** Drop `givebutter.csv`, `patreon.csv`, `benevity.csv` into a dedicated folder (e.g. `data/ev-sources/`); run one loader command. Re-running with the same files changes nothing (idempotent). No live-API integration this milestone.
- **D-08: Retire the single combined Google Sheet as the income master.** `data/ev-finances.csv` stops being the source for GiveButter/Patreon/Benevity income. It may still hold expenses + manual entries until Phase 75 decides its fate — do not break it, but it is no longer the income authority.

### Platform fees
- **D-09: Capture platform fees from each export in this phase** (per source, per period) because the fee is only knowable from the platform side (the bank sees net). Exact placement — feeding the existing `operating` "Platform Fees" expense category vs. staged for Phase 75's expense/reconciliation work — is a planning detail; the requirement here is that the fee figure is *extracted and preserved* alongside gross income.

### Claude's Discretion
- Exact dedup key mechanics and the loader's internal structure (refactor of `loadEVFinances.js` vs. a new `loadEVDonations.js`) — planner decides.
- How the export-baseline + webhook-delta is computed at read time (RPC change vs. loader-side reconciliation) — planner decides against the live schema.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing EV income pipeline (extend / refactor these)
- `scripts/loadEVFinances.js` — the current EV loader. Reads one combined CSV (`data/ev-finances.csv`), builds per-FY `revenue` (income by source) + `operating` (expense) datasets, clear-and-reload per (FY, dataset_type), **preserves webhook line items** via `.neq('source','givebutter_webhook')`. `classifyIncome()` maps Account → `Donations → {Patreon, Give Butter, Benevity, Direct}` + `Interest → Bank Interest`. This is the double-count surface (sheet Give Butter rows + webhook Give Butter rows).
- `supabase/functions/givebutter-webhook/index.ts` — live GiveButter path. Verifies signature, extracts GiveButter txn `id` → `externalId`, `amount` (cents), `transacted_at`; calls RPC `record_givebutter_donation` into the latest-FY `revenue` budget under `Donations → Give Butter`, `source='givebutter_webhook'`. Key for the D-04 webhook-delta model. **`externalId` = GiveButter transaction id** — the dedup key that should also appear in the GiveButter CSV export.
- `record_givebutter_donation` RPC (Postgres, `treasury` schema) — atomic webhook write keyed on `p_external_id`. Planner must read its definition (DB function) to design the export↔webhook dedup.

### Data model
- `treasury.budgets` → `treasury.budget_categories` (tree) → `treasury.budget_line_items` (`source` column: `'csv'` | `'givebutter_webhook'`). EV = `municipalities` row `name='Empowered Vote'`, `entity_type='nonprofit'`. Revenue hierarchy = `['Income Type','Source']`.

### Current data file
- `data/ev-finances.csv` — the existing combined manual ledger (income + expenses). Being retired as income master (D-08); inspect for the current per-source baseline.

### Needed from Chris (inputs to gather at plan/execute time)
- **Sample export CSVs** from GiveButter, Patreon, and Benevity — to pin exact column names (transaction id, gross, fee, net, date, source). Researcher/planner cannot finalize the parser/dedup without these.

No external ADRs/specs — decisions fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/loadEVFinances.js` — CSV parsing (`parseCSVLine`, `parseAmount`, `parseDate`), tree builder (`buildTree`), and Supabase write helpers (`getMunicipalityId`, `clearExistingBudget`, `createBudget`, `insertCategories`) are directly reusable/extendable for a multi-source per-platform loader.
- The COLORS palette already defines `Give Butter`, `Patreon`, `Benevity`, `Platform Fees`, etc. — reuse for visual consistency.
- `npm run load-ev-finances` script entry point exists.

### Established Patterns
- **Webhook-row preservation** is the existing idempotency seam: CSV reload deletes only `source != 'givebutter_webhook'`. The new loader must keep this contract (or replace it with the D-04 baseline+delta model) so the live counter survives a re-import.
- **Per-(FY, dataset_type) clear-and-reload** is the existing write pattern — naturally idempotent for CSV-sourced rows.
- Source attribution lives in `budget_line_items.source`; new platform-export rows need a clear source tag (e.g. `'csv'` today; planner may distinguish per-platform).

### Integration Points
- Frontend reads EV via the production **ev-accounts API** (`ev-accounts-api.onrender.com`), not the raw `treasury.budgets` table — verify displayed totals against the API, not just a direct DB probe (see `feedback_app_url`).
- The webhook + RPC are the live path; any change to how GiveButter totals are stored must keep the webhook write valid (or update it in lockstep).
</code_context>

<specifics>
## Specific Ideas

- Transparency framing Chris wants to preserve: **"donors gave $X gross → $Y platform fees → $Z reached EV."** This is why hybrid (not bank-only) won — the gross + fee figures come only from the platform exports.
- All-volunteer / $0-staff-comp story should remain obvious downstream (Phase 76 expense breakdown).
</specifics>

<deferred>
## Deferred Ideas

- **Bank load, cash-balance/expense truth, platform↔bank reconciliation** → Phase 75 (EVDATA-04/05/06). Phase 74 hands platform totals forward for the reconciliation there.
- **Manual / off-platform income (checks, grants, in-kind) + bank interest** → Phase 75 (EVDATA-06).
- **Prior fiscal years** (beyond current FY) → out of scope this phase (D-06); a future backfill if wanted.
- **Automated platform API ingestion** (vs. manual CSV export) → deferred to v2 (EVAUTO-01); v2.6 is idempotent CSV merge by decision.
- **Per-transaction / donor-level storage** → not done (D-05 chose aggregated); revisit only if a future feature needs it, with PII handling.

None of the above is a Phase 74 blocker — all are intentional boundaries.
</deferred>

---

*Phase: 74-donation-source-refresh-idempotent-income-merge*
*Context gathered: 2026-06-20*
