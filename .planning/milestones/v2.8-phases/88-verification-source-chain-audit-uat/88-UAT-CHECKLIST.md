# Phase 88-03 — Live-App UAT Checklist (Ohio)

**App:** https://treasurytracker.empowered.vote · **Driver:** Chris · **Recorder:** agent (blocking checkpoint)
**Spread:** Columbus (city → Franklin County) · Franklin County (county node + Cities-in-County panel). Both confirmed FY2024 op+rev + linkage + non-zero population in the pre-flight probe (2026-06-26).
**Closes:** OHVER-02 + Phase 88 + the v2.8 Ohio milestone.

Spot-check figures (FY2024, from the DB):
- Columbus — operating $2,477,440,000 · revenue $2,166,549,000 · population 913,985
- Franklin County — operating $1,913,193,000 · revenue $1,811,422,000 · population 1,253,522 · 16 linked cities

## A — Columbus (city)
1. Ohio is selectable from the top-level picker (State Governments) and opens as a hub.
2. Navigate US → Ohio → Franklin County → Columbus. **Breadcrumb** shows that full chain.
3. Money Out (operating) icicle renders; top functions show **plain-language Phase-87 enrichment** (Police, Capital Outlay, General Government, Leisure Time Activities, …) with descriptions.
4. Money In (revenue) renders; sources show enrichment (Income Taxes, Property Taxes, Intergovernmental, …).
5. Per-capita renders (population 913,985). Source chip shows **ohioauditor.gov**.

## B — Franklin County (county)
6. Navigate US → Ohio → Franklin County. Renders as a **county node**.
7. **Cities-in-County panel** lists its linked cities (incl. Columbus; 16 total).
8. Money Out + Money In icicles render with plain-language enrichment (Public Safety, Human Services, Health, Sales Taxes, …); drill-down works.
9. Per-capita renders (population 1,253,522). Source chip shows **ohioauditor.gov**.

## C — Cohort sanity (optional)
10. A second Ohio city loads (e.g. a smaller city) with op+rev + enrichment + per-capita.

---

## Sign-off (2026-06-26)

Chris drove the live app. The category bars render with data + plain-language labels; the one issue raised is the icicle **drill-down** (clicking a category doesn't expand). Root cause confirmed: **Ohio's AOS source is flat (single-level, no sub-categories)** — there is no deeper data to drill into, unlike VA/CA/Utah's nested function→activity trees. The data is correct and complete; this is an inherent property of the free flat source (a known milestone tradeoff). Chris **accepted the flat-data limitation and signed off**.

| Item | Result | Note |
|------|--------|------|
| 3/8 — category bars render with $ + enrichment labels | PASS | top-level Money Out/In segments render with Phase-87 plain-language names |
| drill-down / expand on click | **N/A — accepted limitation** | flat AOS source has no sub-categories; nothing to expand into |

**Known limitation recorded (future-UI follow-up, NOT a v2.8 blocker):** entities loaded from a flat wide-table source (Ohio AOS) have no icicle drill-down, and clicking a no-children category currently dims the bar to an empty state. A small UX fix (clicking a flat category surfaces its enrichment description instead of dimming) was offered and **deferred** by Chris.

**Chris sign-off:** ACCEPTED (flat-data limitation documented) — **Date:** 2026-06-26
