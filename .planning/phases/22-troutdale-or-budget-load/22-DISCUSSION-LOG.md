# Phase 22: Troutdale OR Budget Load - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 22-troutdale-or-budget-load
**Areas discussed:** Revenue scope, FY depth, Phase 23 readiness

---

## Revenue Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Operating-only, defer revenue | Match the Gresham two-phase pattern — Phase 22 does operating, a future phase adds revenue. Keeps scope tight and predictable. | |
| Fold both into Phase 22 | Since Troutdale is small (~17K pop), operating + revenue may both be trivial. One phase instead of two. | ✓ |
| Researcher decides | Let researcher assess whether Troutdale's revenue format is simple enough to include, and recommend the scope. | |

**User's choice:** Fold both into Phase 22

**Follow-up — fallback if revenue is harder than expected:**

| Option | Description | Selected |
|--------|-------------|----------|
| Drop revenue, ship operating only | Keep Phase 22 moving — note revenue as a follow-up. | ✓ |
| Block until revenue is included | Revenue must ship with this phase no matter what. | |

**Notes:** Troutdale is small — user expects operating + revenue to both be straightforward. Revenue is not a hard requirement if it proves unexpectedly complex.

---

## FY Depth

**User's response (free text):** "Researcher determines, but I'd like to default to as much as we can"

**Follow-up — format change scenario:**

| Option | Description | Selected |
|--------|-------------|----------|
| Load only post-format-change years | Skip the old format; load the years where the extractor works cleanly. | ✓ |
| Attempt to handle both formats | Build the extractor to handle multiple format variants if feasible. | |

**Notes:** Max historical depth desired; researcher determines what's available. Do not build multi-format handling for old format variants — just load the years with consistent format.

---

## Phase 23 Readiness

| Option | Description | Selected |
|--------|-------------|----------|
| Standard operating + revenue only | Phase 23 will add All Funds support later. Keep Phase 22 simple and ship faster. | |
| Build extractor to support All Funds too | While the researcher is already parsing the same PDF page for revenue, also extract the Requirements column. Saves a round-trip to the PDF later. | |
| Researcher recommends | Let researcher assess whether the Troutdale PDF has the same All Funds page as Gresham/Portland and whether folding it in adds significant complexity. | ✓ |

**Notes:** Researcher has full discretion. If the All Funds page is present and the extraction is low-effort (flip section gating on an already-parsed page), fold it in. If not, defer to Phase 23.

---

## Claude's Discretion

None — all areas had clear user direction.

## Deferred Ideas

None — discussion stayed within phase scope.
