# Phase 98: Recon — CA Overlap + 4-State ACFR Source Location - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon
**Areas discussed:** FY-depth policy, CA node resolution, Recon thoroughness, Clean-extract bar

---

## FY-Depth Policy

### How far back per state?

| Option | Description | Selected |
|--------|-------------|----------|
| As-deep-as-clean | Pull every FY the ACFR cleanly extracts (MN-style, reached FY2008). Richest history; depth varies per state. | ✓ |
| Match NASBO window | Just FY2023+FY2024 — the exact rows being replaced. Cleanest 1:1 swap, no new history. | |
| Latest 5 FYs | Fixed cap (e.g. FY2020–FY2024) — trend without deep archives, uniform across the 4. | |

**User's choice:** As-deep-as-clean
**Notes:** Matches the roadmap's "as deep as each ACFR cleanly extracts."

### Is the NASBO window a hard floor?

| Option | Description | Selected |
|--------|-------------|----------|
| NASBO window is a floor | Each state must extract at least FY2023+FY2024 to qualify; deeper is bonus. | |
| No floor — take what's clean | Whatever the ACFR cleanly gives, even older-only or a single year. Document any gap. | ✓ |

**User's choice:** No floor — take what's clean
**Notes:** Recon documents any divergence between a state's clean ACFR window and the NASBO rows being replaced.

### Same window across all 4, or per-state?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-state independent | Each state goes as deep as its own ACFR allows; windows differ per node. | ✓ |
| Common window | Find the deepest window all 4 share; caps everyone at the shallowest state. | |

**User's choice:** Per-state independent
**Notes:** Per-node basis label + source chip make divergent windows self-explaining.

---

## CA Node Resolution

### Default disposition for the recon to recommend toward

| Option | Description | Selected |
|--------|-------------|----------|
| Recon-recommends, I decide | Recon documents each CA node + proposes a target with rationale; final call left to Chris once facts surface. | ✓ |
| One canonical CA node | Commit now: exactly one CA state node; upgrade in place, retire v1.7 if duplicate. | |
| Keep both, layer ACFR | Treat v1.7 as a distinct view; add ACFR to canonical node without touching v1.7. | |

**User's choice:** Recon-recommends, I decide

### Form of the CA recommendation

| Option | Description | Selected |
|--------|-------------|----------|
| One recommended target + steps | Recon names a single recommended target + concrete reconcile/retire steps; Chris's call is a fast approve. | ✓ |
| Options menu, no lean | Each viable target with pros/cons but no recommendation. | |

**User's choice:** One recommended target + steps

### How far on MA v1.8

| Option | Description | Selected |
|--------|-------------|----------|
| Note + check for same overlap | Explicitly check whether MA has the same dual-node pattern; note the finding. | ✓ |
| One-line note only | Just record 'MA v1.8 state budget exists' and move on. | |

**User's choice:** Note + check for same overlap
**Notes:** Cheap insurance against a future surprise, though MA isn't in this milestone's 4.

---

## Recon Thoroughness

### How much extraction to perform now

| Option | Description | Selected |
|--------|-------------|----------|
| Latest FY each (floor) | Confirm latest FY only + record URL/depth estimate. Fastest; some 99–100 surprise risk. | |
| Latest + oldest target FY | Confirm both ends of the per-state window. Modest extra effort, less surprise. | |
| Full window pre-extract | Extract & sample-verify every target FY now. Max de-risk; front-loads load work into recon. | ✓ |

**User's choice:** Full window pre-extract
**Notes:** Extraction only (pdftotext) — no DB writes in this phase; stays $0. Makes 99–100 near-mechanical.

---

## Clean-Extract Bar

### Rule when a FY's GF column doesn't extract cleanly

| Option | Description | Selected |
|--------|-------------|----------|
| Drop FY, document gap | Exclude unclean FY, record in gap log. | |
| Try light cleanup first | Attempt column-coord tweaks / page range / -layout vs -table before dropping; document drops. | ✓ |
| You decide per case | Flag each unclean FY to Chris with raw output. | |

**User's choice:** Try light cleanup first

### Within a FY — every line clean, or total + most lines?

| Option | Description | Selected |
|--------|-------------|----------|
| Total must tie, lines mostly clean | Keep FY if GF total ties and lines categorizable; stray minor unreadable line flagged not fatal. | ✓ |
| Every line clean or drop | Any unreadable line item disqualifies the FY. | |

**User's choice:** Total must tie, lines mostly clean
**Notes:** Matches how OH/VA/MN were handled — pragmatic, not penny-strict-per-line.

---

## Claude's Discretion

- Loader-template→state mapping (which `process*Acfr.js` fits each state's GF layout) — a recon finding derived from actual ACFR layouts.
- Exact `pdftotext` invocation per state (page ranges, `-table` vs `-layout`, `-f/-l`) — determined empirically during recon.

## Deferred Ideas

- MN history FY1997–FY2007 (`MNHIST-02`) + MN FY2008 $8.79M categorization gap (`MNGAP-01`) — Future Requirements, out of v2.11.
- NASBO long-tail ACFR upgrades (`ACFRX-01`/`ACFRX-02`) — follow-up milestone after the 4-state pilot.
- Actual CA upgrade-target decision + reconcile/retire execution — recon recommends here; decided/executed in Phase 99.
