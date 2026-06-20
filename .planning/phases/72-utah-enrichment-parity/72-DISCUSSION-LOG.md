# Phase 72: Utah Enrichment Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 72-utah-enrichment-parity
**Areas discussed:** Enrichment depth, Fund concept set, Salary depts, Scope & tail

---

## Enrichment depth — which tree levels get plain-language?

| Option | Description | Selected |
|--------|-------------|----------|
| Depth-0 only (match CA) | Enrich only top-level fund/department names — exactly the Phase 61/66 bar | |
| Depth-0 + deeper categories | Also author plain-language for the org/category lines nested inside each fund | ✓ |
| Depth-0 + generic deeper fallback | Enrich depth-0 fully; deeper levels get only a light generic fallback | |

**User's choice:** Depth-0 + deeper categories
**Notes:** Live scout then revealed Utah op/rev is effectively 2 levels (fund depth-0 → `fund|department` depth-1, no depth-2). So "deeper categories" resolves to the department-within-fund level.

### Follow-up — how to bound the deeper `fund|department` level at $0/bleed-safe

| Option | Description | Selected |
|--------|-------------|----------|
| Route dept portion to concepts | Route the department word to the shared dept concept library + fallback; ~100% universal coverage incl. 1,683 single-city composites | ✓ |
| Only ≥2-city composites | Enrich only the 65 ≥2-city composites; leave 1,683 single-city showing raw names | |
| Bespoke per composite | Author unique text for all 1,748 composites | |

**User's choice:** Route dept portion to concepts
**Notes:** Reuses the salary department library for the depth-1 routing — one library serves both.

---

## Fund concept set — voice/framing for fund descriptions

| Option | Description | Selected |
|--------|-------------|----------|
| Purpose + money source | What the fund pays for + where money comes from, light "separate pot" framing; matches existing CONCEPTS voice | ✓ |
| Minimal name-only | Restate the fund in plainer words, no accounting context | |
| Accounting-technical | Explain governmental fund-accounting structure (fund types, restricted/unrestricted) | |

**User's choice:** Purpose + money source
**Notes:** Net-new authoring — CA CONCEPTS are department-oriented and don't cover fund names.

---

## Salary depts — department concept library strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse CA + fresh county set | Reuse CA city CONCEPTS via Phase 61 router; author fresh ~8-12 county-gov concepts | ✓ |
| All-fresh Utah set | Author an entirely new Utah dept concept set from scratch | |
| Reuse CA, fallback county | Reuse CA; route county depts to generic general_dept fallback | |

**User's choice:** Reuse CA + fresh county set
**Notes:** County depts needing fresh concepts: assessor, recorder, sheriff, surveyor, clerk/auditor, commission, justice court, children's justice center, non-departmental.

---

## Scope & tail — universal vs city-scoped, and the single-city tail policy

| Option | Description | Selected |
|--------|-------------|----------|
| All-universal | Every row universal (NULL), bleed-safe by construction; mirrors Phase 61/66 | ✓ |
| Proactive hybrid | City-scope anything whose meaning could vary by city | |

**User's choice:** All-universal

| Option | Description | Selected |
|--------|-------------|----------|
| Route, defer general fallback | Route all salary depts; concept-matches get text; general_dept-only matches counted + deferred (raw names) | ✓ |
| Route + apply fallback to all | Also write general_dept fallback for the idiosyncratic tail so 100% get some text | |

**User's choice:** Route, defer general fallback
**Notes:** Deliberate asymmetry recorded as D-72-09 — general_dept fallback IS written at depth-1 op composites (reads fine under a fund), but DEFERRED at the salary top level.

---

## Claude's Discretion

- Exact concept IDs, router keyword rules, tags, `evidence_summary` wording.
- New sibling script vs extending an existing one (SoCal script is the template).
- New `data/utahEnrichment72.mjs` module vs inline (module recommended).
- Router precedence for depth-0 op keys that are actually departments (library, fleet management, RDA).

## Deferred Ideas

- Single-city salary-dept long tail (~609 idiosyncratic names): counted + deferred per SC#3.
- Verification (ACFR reconciliation, source-chain audit, live-app UAT): Phase 73 (UVER-01/UVER-02).
