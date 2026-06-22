# 74-01 Summary — Idempotent Multi-Source Donation Loader

**Status:** Complete
**Requirements:** EVDATA-01, EVDATA-02, EVDATA-03 (implementation)

## What was built

- **`scripts/loadEVDonations.js`** — the single writer of EV donation income. Reads per-platform exports from `data/ev-sources/`, aggregates GROSS by source for one fiscal year (calendar year), writes the EV `revenue` dataset. Pure functions (`money`, `isoYear`, `isoDate`, `parseGiveButter`, `parsePatreon`, `parseBenevity`, `giveButterDedup`, `buildDonationTree`, `carryForwardFromSheet`) are exported for testing; the DB layer is lazy so importing for tests needs no service key.
- **`scripts/loadEVDonations.test.mjs`** — 10 offline unit tests (parsing per platform incl. units/dates, gross-by-source aggregation, GiveButter date-based dedup, idempotency, zero-source drop, Donations/Give Butter presence). All pass (`node --test`).
- **`docs/ev-donation-sources.md`** — per-platform column mapping + the merge/dedup/idempotency contract (local-only; `docs/*` is gitignored by repo convention).
- **`scripts/loadEVFinances.js`** — revenue (income) write **removed** (D-08); it writes the operating (expense) dataset only now. Single income writer; no double-write path.
- **`.gitignore`** — `data/ev-sources/` added (raw exports contain donor PII).

## Key mappings (pinned against real exports)

| Source | File | Gross | Fee | FY date basis |
|--------|------|-------|-----|---------------|
| GiveButter | `givebutter*transactions*.csv` | `Amount` (Status=Succeeded, exclude refunds) | `Fee` | `Transaction Date (UTC)` |
| Patreon | `patreon*analytics-earnings.csv` (monthly, PII-free) | `Total gross revenue` | `|platform|+|payment|` fee | `Month` |
| Benevity | `benevity*DisbursementReport*.csv` | `Donation Amount` + `Match Amount` | Cause+Merchant+Check | **`Disbursement Date`** (cash basis — Chris) |

## Decisions realized

- **D-04 no-double-count:** export aggregate is the GiveButter baseline; `exportAsOf` = max GiveButter transaction date in the export; webhook rows ≤ exportAsOf superseded, > exportAsOf kept as live delta and re-applied on top (preserving `external_id`/`source` so the RPC idempotency guard holds).
- **D-05 aggregate-only:** one summary line item per source, no donor name/email stored.
- **D-08 single income writer:** loadEVFinances stops writing revenue.
- **D-09 fees captured:** per-source fee totals computed + reported (placement into the expense view deferred to Phase 75).

## Notes / follow-ups

- `classifyIncome` in loadEVFinances.js is now unused (left in place; harmless).
- Webhook RPC stores amounts in **dollars** (verified the 6 existing rows: $1/$100/$50/$10/$50/$10) — no cents bug.
- GiveButter export `Reference Number` ≠ the webhook's alphanumeric `external_id`, so dedup is date-based (by design), not id-based.
