# Phase 103: Recon — Deeper-History URLs + PA/IL ACFR Source Location (RECON-04, RECON-05) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0
**Areas discussed:** Deepening stop-rule, Recon thoroughness, PA/IL scope policy, PA/IL FY floor

---

## Deepening Stop-Rule (pilots)

### How far back to push when there's no predictable per-year URL

| Option | Description | Selected |
|--------|-------------|----------|
| Durable-URL bound, bounded effort | As deep as a durable URL exists, capped at a fixed per-state effort budget (~15–20 min); gap-log + stop if none surfaces. No hard FY floor. | ✓ |
| Practical FY floor (~FY2015) | Cap the dig at ~FY2015 for comparable ~10-year windows. | |
| Exhaustive — dig until truly exhausted | Keep going (archive pages, Wayback, browser-download) until each pilot bottoms out. | |

**User's choice:** Durable-URL bound, bounded effort.

### Non-durable-only deeper years

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude + log it | Durable, re-fetchable URL is a hard requirement; non-durable years go in the gap log, not loaded. | ✓ |
| Allow if tie-confirmed | Accept a non-durable URL as long as the GF total ties, with a fragility note. | |

**User's choice:** Exclude + log it.
**Notes:** Preserves the always-sourced standard — a source link that rots is not acceptable even if the figure ties.

---

## Recon Thoroughness

| Option | Description | Selected |
|--------|-------------|----------|
| Bookend (98's choice) | Tie-confirm oldest + latest FY now, record per-year URLs, let 104/105 extract in-between. | ✓ |
| Full pre-extract now | Extract + tie-confirm every deepened/new FY in 103. | |
| Hybrid — full PA/IL, bookend pilots | Bookend pilots, full pre-extract PA/IL. | |

**User's choice:** Bookend — the proven v2.11 mold.

---

## PA/IL Scope Policy (the TX trap)

### If the ACFR GF column is materially broader/narrower than NASBO GF

| Option | Description | Selected |
|--------|-------------|----------|
| Flag + recommend accept-relabel | Document scope + magnitude, recommend accepting the ACFR GF-equivalent column (relabel honestly) — the TX precedent. | ✓ |
| Flag + recommend narrower GF | Recommend a narrower true-GF subset if cleanly extractable. | |
| Flag only, defer to Chris | Document both options, no recommendation, explicit Chris gate. | |

**User's choice:** Flag + recommend accept-relabel (TX precedent); confirmed at load time.

### Bookend facts to pin for PA/IL (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Units (thousands/millions/dollars) | Confirm reporting units (the NY ×1,000 trap). | ✓ |
| Negative-category years | Note negative GF line items for the P2 clamp (OH FY2022 precedent). | ✓ |
| Exact column header + statement | Record exact GF column label; confirm Govtl Funds Stmt (not Stmt of Activities). | ✓ |
| Fiscal-year-end month | Confirm FY-end (PA/IL = Jun 30) for labeling + source date. | ✓ |

**User's choice:** All four pinned.

---

## PA/IL FY Floor

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm recent window before greenlight | Verify clean ACFR window includes FY2023+FY2024 (the NASBO years) before recommending replacement; else flag as a decision rather than strand latest data. | ✓ |
| Take whatever's clean (pilot rule) | No-floor like the pilots — load whatever extracts even if only older years. | |
| Keep NASBO recent + ACFR deeper | Mixed-basis node: keep recent NASBO, add older ACFR alongside. | |

**User's choice:** Confirm recent window before greenlight.
**Notes:** Deliberately differs from the pilots' no-floor rule — protects against a recency regression where PA/IL go backward when their latest NASBO years get replaced.

---

## Claude's Discretion

- Loader-template → PA/IL mapping (layout-match against the OH/VA/MN/v2.11 families).
- Exact `pdftotext` invocation per state/year (page ranges, `-f/-l`, light `-table` cleanup).
- Per-year URL pattern discovery on the archive pages (older FL/CA naming, TX FY2016 alternate file-id), within the D-01 effort budget.

## Deferred Ideas

- States beyond PA/IL (ACFRX-01/02) — future milestone.
- MN history FY1997–2007 (MNHIST-02) + MN FY2008 categorization gap (MNGAP-01).
- Federal always-sourced standard backfill to city/state (SRCSTD-01).
- Frontend / UI work — out of scope; "Money In" + `?dataset=revenue` are data-driven, auto-enable on load.
