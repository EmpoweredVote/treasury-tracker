# Phase 129 — Deferred Items

## Plan 129-02: extractTucson.py wrapped-label cosmetic artifact (out of scope)

**Found during:** Task 129-02-03 (live load run), spot-checking loaded category
labels against 128-RECON.md.

**File:** `scripts/extractTucson.py` (Phase 128 output — NOT in this plan's
`files_modified` scope, which is `scripts/processTucson.js` only).

**Issue:** `build_revenue()`'s wrapped-label buffer (`pending`) captures the
full line text (including bare-dash blank-cell placeholders, which the
`_MONEY` regex does not match) when a row has zero money tokens across every
fund column. Two loaded revenue categories carry a merged label as a result:

- FY2021 revenue: `"Contributions from Outside Miscellaneous"` (should
  plausibly be two separate source rows: "Contributions from Outside
  Sources" + "Miscellaneous").
- FY2022 revenue: `"Developer fees - - Use of money and property"` (the GF
  `Developer fees` row is documented as blank/0 in 128-RECON.md finding #5;
  its label — including two placeholder dashes — got prepended to the next
  row's label instead of emitting as its own $0 category).

**Impact:** Cosmetic only. Every affected FY's total independently re-derives
to the 128-RECON.md printed total at exactly $0 (verified via a query against
`treasury.budget_categories`, not the extractor's own tie-check) — the dollar
figures are correct, only two category labels are merged rather than split.
Does not block any of 129-02's must-haves (D-04/D-05/D-07/D-08/D-10 all hold).

**Resolution:** Not fixed in this plan (extractTucson.py is Phase 128's
output, out of scope for 129-02 per the plan's `files_modified` list and the
SCOPE BOUNDARY rule). Left as an honest, documented cosmetic imperfection. A
future touch of `extractTucson.py` (or the next Tucson-adjacent phase) could
harden the wrapped-label buffer to only fire when the line is a genuine
label-only continuation, not a blank-across-all-columns row.
