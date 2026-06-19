# Phase 68: Utah BigQuery Source Setup + Loader - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 68-utah-bigquery-source-setup-loader
**Areas discussed:** BigQuery access path, Category-tree shape, Source-chip link target, Pilot city + FY scope

---

## BigQuery access path

| Option | Description | Selected |
|--------|-------------|----------|
| Your personal Google account | Install Cloud SDK, `gcloud auth login` with personal Gmail, free no-billing sandbox project | |
| Empowered Vote Workspace acct | Use the EV Google Workspace/org account — sandbox project org-owned | ✓ |
| Service-account key file | Downloaded JSON key, no interactive login; more upfront setup | |

**User's choice:** Empowered Vote Workspace account
**Notes:** Org-owned ownership preferred. Captured fallback: if the Workspace org restricts Cloud-project creation, fall back to a personal-account sandbox (planner to verify first — it gates everything). Established by environment scout: neither `gcloud`/`bq` nor `@google-cloud/bigquery` is installed — Phase 68 sets up access from scratch.

---

## Category-tree shape

| Option | Description | Selected |
|--------|-------------|----------|
| By function / purpose | "What it's for" — Public Safety, Public Works, Parks (function1-7) | ✓ (via "same as Federal/CA") |
| By department / org | "Who spends it" — Police, Fire, Library (org1-10) | |
| By fund then category | Accounting structure — General Fund → Salaries/Supplies/Capital | |
| You decide from the data | Pick cleanest/best-populated dimension after inspection | (partial — applies to which column) |

**User's choice:** "Can we use the same general approach we use for Federal or CA?" → resolved to **function/purpose-first**.
**Notes:** Federal defaults to a function lens; CA SCO uses category→subcategory→line (a functional top level). Same approach for Utah = function/purpose top level, 2–3 levels, no reflexive deep icicle. Researcher confirms whether `function` or `cat` column carries the clean functional classification; department/org is the fallback.

---

## Source-chip link target

| Option | Description | Selected |
|--------|-------------|----------|
| Per-entity Transparent Utah page | That city/county's official Transparent Utah revenue+expense page; mirrors CA's durable per-entity page | ✓ |
| Transparent Utah search/transaction view | Transaction Details / search interface — rawer | |
| State Auditor portal landing | Generic portal homepage — most durable but least specific | |

**User's choice:** Per-entity Transparent Utah page
**Notes:** Researcher confirms the exact `entity_id`-keyed URL pattern. Source label "Transparent Utah", CC BY 4.0 attribution. Durable human page, not a versioned/API/table endpoint.

---

## Pilot city + FY scope

| Option | Description | Selected |
|--------|-------------|----------|
| Salt Lake City | Flagship/largest; stronger stress test | |
| Provo | Clean award-winning ACFR; easy reconciliation | |
| You decide from the data | Pick cleanest/most-complete of the 10 | ✓ |
| — FY scope: All available (FY2014→present) | Full depth available for these entities | ✓ |
| — FY scope: Recent ~10 years only | Lighter; trades away history | |
| — FY scope: You decide from the data | Load clean years, document sparse ones | |

**User's choice:** Pilot city = Claude's discretion (cleanest data); FY scope = all available (FY2014→present)
**Notes:** CORRECTED 2026-06-19 via live BQ probe — the 15 target entities start at **FY2014** (not FY2009 as the recon assumed), running through FY2026. Load FY2014→present; document any sparse early/partial-latest years rather than loading noise.

---

## Claude's Discretion

- Pilot city selection (cleanest-data of the 10).
- Loader auth mechanism (Node `@google-cloud/bigquery` client vs `bq` CLI → JSON).
- Exact BigQuery SQL (column projection + entity/FY/type filters to stay in the free tier).
- Which functional column (`function` vs `cat`) becomes the tree top level, pending data inspection.

## Deferred Ideas

- Salaries/`PY` tree shape + names-free safety line — Phase 71.
- Socrata FY≤2019 cross-check via `bulkLoadBudget.js` — verification nicety, candidate for Phase 73.
- Generalizing the loader to all ~1,000 Utah entities (school/special districts) — future milestone.
