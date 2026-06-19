# Phase 71: Utah City Salaries / Compensation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 71-utah-city-salaries-compensation
**Areas discussed:** Names-free enforcement, Salary tree shape, Fund scope, Reconciliation target

---

## Names-free disclosure posture (Safety)

A live BigQuery probe confirmed the `transaction` table carries PII columns (`vendor_name`, `title`,
`hourly_rate`, `gender`, `dba_name`, `account_number`, etc.). Chris asked a values question: "If the
state/county/city releases the name of the person, why don't we?" — i.e. the data is lawful public record.
Discussed the tradeoff: it's a mission/optics choice, not a legal one — Treasury Tracker reports where money
goes structurally, and re-hosting an EV-branded, indexed copy of named salaries makes individuals more
findable and reframes the tool as surveillance. Aggregation preserves accountability value without exposing
individuals; also matches the pre-existing USAL-01 "public-record-only" ground rule.

| Option | Description | Selected |
|--------|-------------|----------|
| Names-free + automated guard | Aggregate org1/cat1/SUM only; unit test fails if any PII column appears | ✓ |
| Names-free, no automated test | Aggregate-only, rely on code review | |
| Aggregate + manual spot-check | Aggregate-only, eyeball one city | |
| Include individual names/comp | Republish named records (new UI, rescope) | |

**User's choice:** Names-free + automated guard (D-71-01).
**Notes:** Named individual disclosure explicitly considered and declined for this phase; logged as a possible deliberate future phase.

---

## Salary tree shape (Tree)

| Option | Description | Selected |
|--------|-------------|----------|
| Department → Wages/Benefits (2-level) | top=org1 dept string, leaf=cat1 (Wages/Benefits) | ✓ |
| Dept → Division → comp (3-level) | split 'Fire - Administration' on ' - ' | |
| fund1 → org1 → cat1 (like budgets) | 3-level fund-topped shape | |

**User's choice:** Department → Wages/Benefits, 2-level (D-71-02). Keep the full org1 string; don't split.

---

## Fund scope (Fund scope)

| Option | Description | Selected |
|--------|-------------|----------|
| All-funds incl. enterprise | Consistent with city/county budget basis; full workforce comp | ✓ |
| Governmental funds only | Exclude enterprise-fund employees | |

**User's choice:** All-funds incl. enterprise (D-71-03).

---

## Reconciliation target (Reconcile)

| Option | Description | Selected |
|--------|-------------|----------|
| Provo | Penny-exact budget canary; FY2024 ~$92.9M comp known | |
| Salt Lake City | Largest/most complex | |
| You decide | Claude picks during planning | ✓ |

**User's choice:** Claude's discretion (D-71-04). Provo recommended.

## Claude's Discretion
- Reconciliation city + basis-matching method (Provo recommended).
- 2-level tree implementation mechanism (new helper vs buildTree mode).
- Exact form of the PII-exclusion guard test.
- Per-city sweep ordering + coverage/gap documentation.

## Deferred Ideas
- County-government salaries (not in USAL-01; possible follow-up).
- Named individual compensation disclosure (declined for this phase; future-phase candidate).
- Curated functional rollup of departments (enrichment/Phase 72 or later).
