#!/usr/bin/env python3
"""
IRS individual income-tax returns-filed extractor (Phase 50 per-capita fix).

Usage: python extractIRSReturns.py <histab21b.xlsx>
Emits JSON to stdout: { "returns_by_fy": { "2005": 132854063, ... } }

Source: IRS SOI Historical Table 21b "Actual Fiscal Year Number of Returns Filed
with IRS". The "Individual Income Tax, Total" row gives the per-fiscal-year count of
individual income-tax returns filed — the per-taxpayer denominator. Years are the
column headers (currently FY2005-FY2023). Counts only; never estimated.
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


def main():
    if len(sys.argv) != 2:
        fatal("Usage: extractIRSReturns.py <histab21b.xlsx>")
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    rows = list(wb.active.iter_rows(values_only=True))

    # Year header: the row whose cells are mostly 4-digit years in [1960, 2035].
    year_cols = {}
    for r in rows[:8]:
        cand = {}
        for idx, c in enumerate(r):
            try:
                y = int(c)
                if 1960 <= y <= 2035:
                    cand[idx] = y
            except (TypeError, ValueError):
                pass
        if len(cand) >= 5:
            year_cols = cand
            break
    if not year_cols:
        fatal("year header row not found in histab21b")

    # The total individual-returns row.
    target = None
    for r in rows:
        label = re.sub(r"\s+", " ", str(r[0] or "").strip()).lower()
        if label.startswith("individual income tax, total") or label == "individual income tax, total":
            target = r
            break
    if target is None:
        fatal("'Individual Income Tax, Total' row not found")

    out = {}
    for idx, y in year_cols.items():
        v = target[idx]
        if v in (None, ""):
            continue
        try:
            out[str(y)] = int(round(float(v)))
        except (TypeError, ValueError):
            fatal(f"non-numeric returns value for FY{y}: {v!r}")
    if not out:
        fatal("no individual-returns values extracted")

    json.dump({"returns_by_fy": out}, sys.stdout)
    sys.stderr.write(f"OK: {len(out)} years ({min(out)}-{max(out)})\n")


if __name__ == "__main__":
    main()
