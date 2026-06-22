# Phase 74: Donation Source Refresh (Idempotent Income Merge) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 74-donation-source-refresh-idempotent-income-merge
**Areas discussed:** GiveButter master record, Storage grain, Refresh scope, Ingestion cadence, Income source model (bank vs. platforms)

---

## GiveButter master record

| Option | Description | Selected |
|--------|-------------|----------|
| Platform export = master | Fresh GiveButter export authoritative; webhook = live counter only, reconciled not added | ✓ |
| Keep Google Sheet as master | Manual sheet stays master; webhook display-only | |
| Webhook = master going forward | Webhook owns GiveButter from its start; sheet for pre-webhook history | |

**User's choice:** Asked Claude to recommend → Platform export = master, webhook as live-delta only.
**Notes:** Export is complete/accurate; webhook only captures post-deployment successful deliveries; manual sheet is error-prone. Live counter preserved via export-baseline + webhook-delta-since-last-export rule (D-04).

---

## Storage grain

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregated by source + period | Per-source totals per period; privacy-safe; matches current app breakdown | ✓ |
| Per-transaction, names stripped | Each donation a row, no donor PII | |
| Per-transaction with donor detail (private) | Full donor-level rows, never public | |

**User's choice:** Aggregated by source + period.
**Notes:** Stored at per-fiscal-year grain to match the existing `revenue` budget; no donor PII.

---

## Refresh scope

| Option | Description | Selected |
|--------|-------------|----------|
| All fiscal years | Re-pull + reconcile every year | |
| Current year only | Bring current FY current; prior years as-is | ✓ |
| Current + prior FY | This year + last year | |

**User's choice:** Current year only.

---

## Ingestion cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Manual re-export + re-run (per-platform folder) | Drop per-platform CSVs, one idempotent loader | ✓ (recommended) |
| One combined sheet, re-run | Keep single Google Sheet as merge point | |
| Not sure — recommend one | Claude proposes | ✓ (user delegated) |

**User's choice:** Delegated to Claude → manual re-export + re-run, per-platform files in one folder (`data/ev-sources/`), one idempotent loader. Combined Google Sheet retired as income master.

---

## Income source model (bank vs. platforms) — raised by Chris mid-discussion

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: bank + platform gross | Bank authoritative for cash/balance; platform exports add gross + platform-fee transparency | ✓ |
| Bank-only income | Bank single source, split by deposit descriptor; drops gross/fees story; would fold Phase 74 into bank load | |
| Bank + light source tagging | Bank authoritative for amounts; platform exports only confirm source | |

**User's choice:** Hybrid.
**Notes:** Chris correctly observed the bank receives all platform payouts and is the truer "money received" source. Claude clarified the one thing the bank can't see — gross + platform fees (deposits arrive net, often batched) — which is needed to preserve the existing "you gave $100 → $3 fees → $97 reached EV" transparency line. Chris chose hybrid to keep that story. This confirms the existing roadmap split (74 = platform gross/fees; 75 = bank authoritative + reconciliation); no roadmap reshape needed.

---

## Claude's Discretion

- Exact dedup-key mechanics and loader structure (refactor `loadEVFinances.js` vs. new loader).
- How the export-baseline + webhook-delta is computed at read time (RPC change vs. loader-side reconciliation).
- Exact placement of captured platform-fee figures (operating "Platform Fees" now vs. staged for Phase 75).

## Deferred Ideas

- Bank load + cash/balance/expense truth + platform↔bank reconciliation → Phase 75.
- Manual/off-platform income + bank interest → Phase 75 (EVDATA-06).
- Prior fiscal years beyond current FY → future backfill.
- Automated platform API ingestion → v2 (EVAUTO-01).
- Per-transaction / donor-level storage → not done; revisit only if a future feature needs it.
