#!/usr/bin/env python3
"""
OMB Hist 2.1 receipts-by-source extractor (Phase 49).

Usage: python extractOMBReceipts.py <hist02z1.xlsx> <year-or-TQ>
Emits JSON to stdout:
  { "period": "2024" | "TQ",
    "units_note": "in millions of dollars",
    "buckets": [{ "name": "Individual Income Taxes", "amount": <dollars> }, ...],
    "total_receipts": <dollars> }
Amounts normalized to DOLLARS (file is in millions — read from line 2, never assumed).

DATA-DRIVEN by design: the top-level source buckets are discovered from the header
row, using the file's own labels (footnote markers like " (2)" stripped). For grouped
headers (Social Insurance, Total Receipts) the parent label sits directly above the
'Total' sub-column, so the parent column index IS the total — the (On-/Off-Budget)
sub-columns have blank parent headers and are naturally skipped.

The current FY2027 edition exposes 5 top-level buckets: Individual Income Taxes,
Corporation Income Taxes, Social Insurance and Retirement Receipts, Excise Taxes,
and Other (estate & gift + customs duties + miscellaneous, per the table's footnote).
Older editions that break Other into 3 columns will yield 7 buckets automatically —
no code change needed.
"""
import json
import re
import sys
import warnings

warnings.filterwarnings("ignore")
import openpyxl  # noqa: E402


def fatal(msg):
    sys.stderr.write(f"FATAL: {msg}\n")
    sys.exit(1)


def norm(cell):
    return re.sub(r"\s+", " ", str(cell or "")).strip()


def strip_footnote(label):
    # "Excise Taxes (2)" -> "Excise Taxes"; "Other (3)" -> "Other"
    return re.sub(r"\s*\(\d+\)\s*$", "", label).strip()


def main():
    if len(sys.argv) != 3:
        fatal("Usage: extractOMBReceipts.py <hist02z1.xlsx> <year-or-TQ>")
    path, period = sys.argv[1], sys.argv[2]

    ws = openpyxl.load_workbook(path).active
    rows = list(ws.iter_rows(values_only=True))

    # Units from line 2 (never assumed)
    mult = None
    for r in rows[:4]:
        t = norm(r[0]).lower()
        if "in millions of dollar" in t:
            mult = 1_000_000
        elif "in billions of dollar" in t:
            mult = 1_000_000_000
    if mult is None:
        fatal("no units line found in hist02z1")
    units_note = "in millions of dollars" if mult == 1_000_000 else "in billions of dollars"

    # Locate the header row: the one whose first cell is exactly 'Fiscal Year'.
    hdr_idx = None
    for i, r in enumerate(rows[:8]):
        if norm(r[0]).lower() == "fiscal year":
            hdr_idx = i
            break
    if hdr_idx is None:
        fatal("header row ('Fiscal Year') not found")
    header = rows[hdr_idx]

    # Discover bucket columns + total column from the header labels.
    buckets_cols = []   # (col_index, label)
    total_col = None
    for c in range(1, len(header)):
        label = strip_footnote(norm(header[c]))
        if not label:
            continue  # blank parent header = an (On-/Off-Budget) sub-column; skip
        if label.lower() == "total receipts":
            total_col = c
            continue
        buckets_cols.append((c, label))
    if total_col is None:
        fatal("'Total Receipts' column not found in header")
    if not buckets_cols:
        fatal("no source bucket columns discovered")

    # Find the period row (exact match on the first cell).
    def num(v, col_label):
        s = str(v).strip()
        if s in ("", "..........", "…", "n/a", "NA"):
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            fatal(f"non-numeric value {v!r} for {col_label} in period {period}")

    target = None
    for r in rows[hdr_idx + 1:]:
        if norm(r[0]) == period:
            target = r
            break
    if target is None:
        fatal(f"period {period!r} not found in hist02z1 (first column)")

    buckets = [{"name": label, "amount": num(target[c], label) * mult} for c, label in buckets_cols]
    total_receipts = num(target[total_col], "Total Receipts") * mult

    bucket_sum = sum(b["amount"] for b in buckets)
    if total_receipts > 0 and abs(bucket_sum - total_receipts) / total_receipts > 0.005:
        fatal(f"period {period}: bucket sum {bucket_sum:,.0f} != Total Receipts {total_receipts:,.0f} (>0.5%)")

    json.dump({
        "period": period,
        "units_note": units_note,
        "buckets": buckets,
        "total_receipts": total_receipts,
    }, sys.stdout)
    sys.stderr.write(f"OK: {len(buckets)} buckets, total receipts {total_receipts:,.0f} dollars\n")


if __name__ == "__main__":
    main()
