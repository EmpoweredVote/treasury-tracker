# Phase 128 — Recon + Extractor: Research

**Phase goal:** Locate and validate the Tucson ACFR source end-to-end before any load — enumerate the published years, pin durable URLs, prove clean `pdftotext -table` extraction of the General Fund column, and build the extractor.
**Requirements:** TUC-01 (recon + window lock), TUC-02 (`extractTucson.py`)
**Researched:** 2026-07-10 (inline, no subagent — per project token/machine-strain policy)
**Primary inputs:** `.planning/TUCSON-SCOPING.md` (§0 FY2024 probe is BEST-CASE), `.planning/REQUIREMENTS.md` (TUC-01/02).

---

## 1. What we already know (from the §0 probe — do not re-litigate)

The FY2024 ACFR was downloaded (236 pp, 5.2 MB, free, no auth) and extracted with **`pdftotext -table`** — the exact tool the state-ACFR loaders use. The governmental-funds **Statement of Revenues, Expenditures and Changes in Fund Balances** (printed p.30) reads out **cleanly, column-aligned**:

- **Columns, left→right:** `General Fund` · `Mass Transit` · `Disaster Relief` · `Section 115 Pension Trust` · `Non-Major Governmental` · `Total Governmental Funds`. All correctly separated by `-table`.
- **GF is the FIRST data column.** `-layout` mode scrambles the multi-fund columns — **use `-table`**, never `-layout`.
- **Whole dollars, not thousands.** Printed `Total revenues = $773,493,270` (9 digits). Do **not** multiply by 1000. (This differs from the *state* ACFR loaders, which read raw thousands ×UNITS. Tucson's city statement is full-dollar precision.) The extractor should still discover this by tie, not assume it.
- **Revenue-by-source (10 GF rows) ties Total revenues $773,493,270 at exactly $0.**
- **Expenditure-by-function (nested) ties Total expenditures $648,657,363 at exactly $0.**
- Excess `$124,835,907` = rev − exp (independent cross-check).

**Verdict:** easy end of the range — closer to the state-ACFR `-table` pattern than the messy pdfplumber city cases (Bakersfield/Portland/etc.).

---

## 2. The two tree shapes (fixed by TUC-02 + probe)

### `--mode revenue` — GF revenue-by-source (flat, 10 leaves)
From the probe (FY2024 values shown for grounding only — the extractor reads them per FY):

| Source label (as printed) | FY2024 GF |
|---|---|
| Taxes | $405.0M |
| Other agencies *(intergovernmental)* | $243.3M |
| Charges for services | $59.4M |
| Licenses and permits | $35.7M |
| Use of money and property | $15.0M |
| Miscellaneous | $6.4M |
| Fines and forfeitures | $5.4M |
| Federal grants | $2.6M |
| Contributions | $0.66M |
| Developer fees / contributions | $0 (in GF) |

The set/labels may shift slightly across FYs — the extractor must be label-driven, not position-locked, and the **$0 tie is the correctness oracle**, not a hardcoded row count.

### `--mode operating` — GF expenditure-by-function (2-level)
```
Current
  ├─ Public safety and justice
  ├─ Community enrichment and development   ← WRAPPED label (see §3)
  ├─ Support services
  ├─ General government
  └─ Elected and official
Capital outlay            (leaf under root)
Capital projects          (leaf under root)
Debt service
  ├─ Principal
  ├─ Interest
  └─ Fiscal agent fees
```
Parents `Current` and `Debt service` are sub-totals in the PDF — captured as **parent nodes**, not leaves. Their printed sub-total must equal the sum of their children (secondary tie). `Capital outlay` and `Capital projects` are top-level leaves.

---

## 3. Parsing landmines (all must be handled — TUC-02 success criterion 4)

1. **Wrapped row label.** "Community enrichment and development" prints across two physical lines ("Community enrichment and" / "development"). The number sits on one of the two lines. Strategy: when a line has label text but **no numeric token in the GF column**, buffer it and prepend to the next line's label before matching. Normalize whitespace after joining.
2. **`$` glyphs and blank cells in non-GF columns.** `-table` emits `$` and empty cells for the other funds. Since GF is the **first** data column, key off column position / first numeric token after the label; do not let stray `$` tokens from later columns pollute the GF value.
3. **Parentheses = negative.** `(1,234)` → `-1234`. Reuse the Gresham `parse_money` shape.
4. **Sub-total / bookend rows.** `Total revenues`, `Total expenditures`, `Total Current`, `Total Debt service`, `Excess (deficiency)…`, and the fund-balance rollforward lines must be **captured for tying** but **excluded from the leaf trees**. Match them by explicit label allow/deny lists.
5. **Thousands vs whole dollars.** Confirmed whole dollars for FY2024; the extractor computes the tie and, if delta is a clean ×1000, reports it rather than silently scaling. No auto-scaling.

---

## 4. Analog files (read these before writing code)

| Purpose | Analog | What to copy |
|---|---|---|
| Python extractor CLI contract | `scripts/extractGresham.py` | argparse (`pdf_path` positional, `--mode operating\|revenue`), `parse_money()`, JSON-to-stdout, per-mode functions, stderr warnings. **But swap pdfplumber → `pdftotext -table` via subprocess.** |
| `pdftotext -table` invocation + GF-column tie discipline | `scripts/processAZAcfr.js` (and `maAcfrExtract.mjs` for token-order/positional variants) | how the state loaders spawn pdftotext with an **args array** (no shell string), isolate the GF column, and tie to the printed total every FY. |
| Multi-fund column separation reference | §0 of `TUCSON-SCOPING.md` | column order; GF = column 1. |

**Key divergence from state loaders:** the state ACFR "extractors" transcribe hand-verified numbers into JS literals. TUC-02 requires a **programmatic** Python parser that produces the trees and self-ties — this is the only genuinely new code in the phase.

---

## 5. Recon method (TUC-01)

1. **Enumerate years** from the archive index page:
   `https://www.tucsonaz.gov/Departments/Business-Services-Department/Accounting-and-Finance/Annual-Comprehensive-Financial-Reports`
   Known-good FY2024 direct PDF:
   `https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/cot-2024-annual-comprehensive-financial-report.pdf`
   The per-year filename pattern appears to be `cot-<YYYY>-annual-comprehensive-financial-report.pdf` — **verify each URL resolves (HTTP 200, `Content-Type: application/pdf`) before pinning; do not assume the pattern holds for older years.**
2. **Download** each resolvable year into `docs/Tucson/` (gitignored via `docs/*`; load on `main`, not a worktree — v2.15 loader note).
3. **Per-FY bookend tie:** run `pdftotext -table` on the governmental-funds statement page, sum the printed GF revenue rows → must equal printed `Total revenues` at $0; sum printed GF expenditure rows → must equal printed `Total expenditures` at $0.
4. **Lock the clean-extract window** = the deepest **contiguous** set of years that tie. Any year that fails (statement absent, pre-format-change layout, OCR-only scan) is documented as an **honest non-extractable hole**, not silently dropped.
5. **Record** everything in `128-RECON.md` (year · durable URL · page · tie status · notes) — this artifact is the TUC-01 deliverable and the input the extractor iterates over.

**History-depth note:** older Tucson ACFRs may predate the current statement layout or be image-only scans. The window is bounded by whatever cleanly ties — quality over depth (matches the milestone's "as deep as ACFRs cleanly tie" decision).

---

## 6. Validation Architecture

**No unit-test framework is introduced.** Validation for this phase is a **deterministic $0 bookend-tie**, which is a stronger oracle than a stubbed unit test for extraction work.

- **Recon tie (TUC-01):** per FY, `Σ(printed GF revenue rows) == printed Total revenues` and `Σ(printed GF expenditure rows) == printed Total expenditures`, delta == 0.
- **Extractor tie (TUC-02):** per windowed FY and per mode, `extractTucson.py` emits `{ tree, computed_total, printed_total, tie_delta }`; **`tie_delta` must be 0**. A non-zero delta is a hard failure (non-zero exit), never a warning to be waved through.
- **Secondary ties:** `Current` sub-total == Σ its 5 children; `Debt service` sub-total == Σ its 3 children.
- **Cross-check:** `revenue computed_total − operating computed_total == printed Excess (deficiency)`.

These are the automated commands recorded in `128-VALIDATION.md`. The only **manual** verification is human confirmation that the archive enumeration is complete (no published year was missed) — inherently a judgment call against the live archive page.

---

## 7. Non-goals for Phase 128 (fence)

- **No municipality seed, no live load, no enrichment** — those are Phase 129 (TUC-03..06).
- **No schema change / RPC touch** — the source-safe `treasury_sync_budget_tree` is used only at load time (Phase 129).
- **No Pima County node** — navigation-node decision lands in Phase 129/model work.
- Phase 128 ends with: a locked window, pinned URLs, and a self-tying extractor whose dry-run prints $0 for every windowed FY.
