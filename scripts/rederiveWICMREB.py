#!/usr/bin/env python3
"""
MAD-08 — blind re-derivation of the Madison, WI + Dane County budget rows.

Deliberately independent of scripts/loadWICMREB.js: different language, different
XLSX reader (openpyxl, not ExcelJS), column groupings re-derived here from the
workbook's own printed subtotals rather than copied from the loader's registry.
Reusing the loader's parsing would only prove self-consistency.

What it does
  1. reads CMREB<YYYY>.xlsx straight from the DOR bytes (sha-verified upstream)
  2. re-proves the nine printed-subtotal identities on the rows in question
  3. builds revenue + expenditure leaf sets and checks each sums to the printed
     subtotal it is supposed to (Subtotal-General Revenues / Sub-total Expenditure)
  4. pulls what production actually holds over PostgREST
  5. diffs totals, category counts, and every category amount

Exit code 0 only if every delta is exactly $0.
"""

import argparse
import json
import os
import sys
import urllib.request
from collections import OrderedDict
from pathlib import Path

import openpyxl

REPO_ROOT = Path(__file__).resolve().parent.parent
# Workbooks are large binaries and are not tracked; default to the gitignored
# working dir, override with --dir. Re-fetch with:
#   curl -O https://www.revenue.wi.gov/SLFReportscotvc/CMREB2024.xlsx
WORKBOOK_DIR = REPO_ROOT / '_wi-recon'

YEARS = [2020, 2021, 2022, 2023, 2024]

TARGETS = [
    # (label, sheet, MuniTypeCode, Municipality, CountyName, municipality_id)
    ("Madison, WI", "Cities", "C", "MADISON", "DANE", "1e1575e3-075f-4fd3-9503-642c28b109df"),
    ("Dane County, WI", "Counties", "Y", "DANE", "DANE", "94f5c941-b864-420c-bbe6-703917d54a17"),
]

# ── Column groups, by header name, resolved independently from the sheet ──────
# Names are the source's own, typos included. Membership below is asserted
# against the workbook's printed subtotals before it is used for anything.
TAXES = ["General Property Taxes", "Tax Increments", "InLieu of Taxes", "Other Taxes"]
INTERGOV = ["Federal Aids", "State Shared Revenues", "State Highway Aids",
            "All Other State Aids", "Other Local Govt Aids"]
DIRECT = ["Licenses and Permits", "Fines, Forfeits and Penalties",
          "Public Charges for Services", "Intergovernmental Charges for Services"]
MISC = ["Interest Income", "Other Revenues"]
SPECIAL = ["Special Assessments"]

FUNCTIONS = ["General Government", "Law Enforcement", "Fire", "Ambulance",
             "Other Public Safety", "Highway Maintainence and Administration",
             "Highway Construction", "Road- Related Facilities", "Other Transportation",
             "Solid Waste Collection and Disposal", "Other Sanitation",
             "Health and Human Services", "Culture and Education", "Parks and Recreation",
             "Conservation and Development", "All Other Expenditures"]
DEBT = ["Debt Service - Principal Interest", "Debt Service - Fiscal Changes"]

# Excluded on purpose (the loader's D-04b call, re-affirmed here independently):
# "Other Financing Sources" / "Other Financing Uses" are debt proceeds, interfund
# transfers, refunding proceeds and asset sales — money moved, not money raised or
# spent. Including them would double-count.
REVENUE_LEAVES = TAXES + SPECIAL + INTERGOV + DIRECT + MISC          # 16
EXPENDITURE_LEAVES = FUNCTIONS + DEBT                                # 18

PRINTED_REVENUE_SUBTOTAL = "Subtotal-General Revenues"
PRINTED_EXPENDITURE_SUBTOTAL = "Sub-total Expenditure"

# The nine printed identities: printed column == sum of its components.
IDENTITIES = [
    ("Total Taxes", TAXES),
    ("Total Inter Government Revenues", INTERGOV),
    ("Total Miscellaneous Revenues", MISC),
    (PRINTED_REVENUE_SUBTOTAL, TAXES + SPECIAL + INTERGOV + DIRECT + ["Total Miscellaneous Revenues"]),
    ("Total Revenue and Other Financing Sources", [PRINTED_REVENUE_SUBTOTAL, "Other Financing Sources"]),
    ("Sub-total Operation and Capital Expenditure", FUNCTIONS),
    ("Total Debt Service", DEBT),
    (PRINTED_EXPENDITURE_SUBTOTAL, ["Sub-total Operation and Capital Expenditure", "Total Debt Service"]),
    ("Total Expenditures and Other Financing Uses", [PRINTED_EXPENDITURE_SUBTOTAL, "Other Financing Uses"]),
]


def money(v):
    """Cells arrive as text in this workbook; make that explicit rather than assumed."""
    if v is None or v == "":
        return 0
    if isinstance(v, (int, float)):
        if float(v) != int(v):
            raise ValueError(f"non-integer cell {v!r}")
        return int(v)
    s = str(v).strip().replace(",", "").replace("$", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    return int(s)


def read_row(path, sheet, typecode, muni, county):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    idx = {h: i for i, h in enumerate(header)}
    for need in ["Municipality", "MuniTypeCode", "CountyName", "Population"] + \
                REVENUE_LEAVES + EXPENDITURE_LEAVES + [n for n, _ in IDENTITIES]:
        if need not in idx:
            raise SystemExit(f"FATAL {path}/{sheet}: header {need!r} missing")
    hits = []
    for r in rows:
        if not r or r[idx["Municipality"]] in (None, ""):
            continue          # trailing blank rows inflate max_row — filter, don't trust
        if (str(r[idx["Municipality"]]).strip().upper() == muni
                and str(r[idx["MuniTypeCode"]]).strip().upper() == typecode
                and str(r[idx["CountyName"]]).strip().upper() == county):
            hits.append(r)
    wb.close()
    if len(hits) != 1:
        raise SystemExit(f"FATAL {path}/{sheet}: {len(hits)} rows match {muni}/{typecode}/{county}")
    row = hits[0]
    return {h: row[i] for h, i in idx.items() if h}


def derive(cells, label, year, problems):
    val = {h: money(v) for h, v in cells.items()
           if h in set(REVENUE_LEAVES + EXPENDITURE_LEAVES +
                       [n for n, _ in IDENTITIES] + list(sum((c for _, c in IDENTITIES), [])))}

    for printed, parts in IDENTITIES:
        got = sum(val[p] for p in parts)
        if got != val[printed]:
            problems.append(f"{label} {year}: identity {printed} printed {val[printed]:,} vs components {got:,}")

    rev = OrderedDict((h, money(cells[h])) for h in REVENUE_LEAVES)
    exp = OrderedDict((h, money(cells[h])) for h in EXPENDITURE_LEAVES)

    if sum(rev.values()) != val[PRINTED_REVENUE_SUBTOTAL]:
        problems.append(f"{label} {year}: revenue leaves {sum(rev.values()):,} != printed "
                        f"{val[PRINTED_REVENUE_SUBTOTAL]:,}")
    if sum(exp.values()) != val[PRINTED_EXPENDITURE_SUBTOTAL]:
        problems.append(f"{label} {year}: expenditure leaves {sum(exp.values()):,} != printed "
                        f"{val[PRINTED_EXPENDITURE_SUBTOTAL]:,}")

    return {
        "population": money(cells["Population"]),
        "revenue": {"total": sum(rev.values()), "leaves": rev},
        "operating": {"total": sum(exp.values()), "leaves": exp},
    }


# ── production side ───────────────────────────────────────────────────────────
def env():
    out = {}
    with open(REPO_ROOT / ".env") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


def rest(path):
    e = env()
    req = urllib.request.Request(
        f"{e['SUPABASE_URL']}/rest/v1/{path}",
        headers={"apikey": e["SUPABASE_SERVICE_KEY"],
                 "Authorization": f"Bearer {e['SUPABASE_SERVICE_KEY']}",
                 "Accept-Profile": "treasury"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    global WORKBOOK_DIR
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", default=str(WORKBOOK_DIR),
                    help="directory holding CMREB<YYYY>.xlsx (default: _wi-recon/)")
    WORKBOOK_DIR = Path(ap.parse_args().dir)
    if not WORKBOOK_DIR.is_dir():
        raise SystemExit(f"FATAL: workbook dir {WORKBOOK_DIR} not found — "
                         f"download CMREB2020..2024.xlsx from revenue.wi.gov first")

    problems = []
    derived = {}
    for label, sheet, tc, muni, county, _mid in TARGETS:
        for year in YEARS:
            cells = read_row(str(WORKBOOK_DIR / f"CMREB{year}.xlsx"), sheet, tc, muni, county)
            derived[(label, year)] = derive(cells, label, year, problems)

    live = {}
    for label, _s, _t, _m, _c, mid in TARGETS:
        rows = rest(f"budgets?municipality_id=eq.{mid}&select=id,fiscal_year,dataset_type,total_budget,"
                    f"budget_categories(name,amount)")
        for r in rows:
            live[(label, r["fiscal_year"], r["dataset_type"])] = r

    checked = 0
    for (label, year), d in sorted(derived.items()):
        for dataset in ("revenue", "operating"):
            key = (label, year, dataset)
            if key not in live:
                problems.append(f"{label} {year} {dataset}: NO ROW in production")
                continue
            checked += 1
            row = live[key]
            exp_total = d[dataset]["total"]
            got_total = int(float(row["total_budget"]))
            if got_total != exp_total:
                problems.append(f"{label} {year} {dataset}: total delta "
                                f"{got_total - exp_total:+,} (db {got_total:,} vs source {exp_total:,})")

            src = {k: v for k, v in d[dataset]["leaves"].items() if v != 0}
            db = {c["name"]: int(float(c["amount"])) for c in row["budget_categories"]}
            for name in sorted(set(src) | set(db)):
                a, b = src.get(name), db.get(name)
                if a is None:
                    problems.append(f"{label} {year} {dataset}: db has extra category {name!r} = {b:,}")
                elif b is None:
                    problems.append(f"{label} {year} {dataset}: db MISSING category {name!r} = {a:,}")
                elif a != b:
                    problems.append(f"{label} {year} {dataset}: {name!r} delta {b - a:+,}")
            dropped = [k for k, v in d[dataset]["leaves"].items() if v == 0]
            print(f"{label:16} {year} {dataset:9} total {exp_total:>14,}  "
                  f"cats {len(src):2} (dropped {len(dropped)} zero)  Δ$0"
                  if not any(p.startswith(f"{label} {year} {dataset}") for p in problems)
                  else f"{label:16} {year} {dataset:9} MISMATCH")

    # population, taken as printed (see MAD-04: county figures may exceed their munis)
    for label, _s, _t, _m, _c, mid in TARGETS:
        pops = {derived[(label, y)]["population"] for y in YEARS}
        muni_row = rest(f"municipalities?id=eq.{mid}&select=name,population,population_year")[0]
        latest = derived[(label, 2024)]["population"]
        if int(muni_row["population"]) != latest:
            problems.append(f"{label}: population {muni_row['population']} != CY2024 workbook {latest}")
        print(f"{label:16} population db {muni_row['population']:,} vs workbook CY2024 {latest:,} "
              f"(series {sorted(pops)})")

    print(f"\nrows compared: {checked}/20")
    if problems:
        print(f"\n{len(problems)} PROBLEM(S):")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("ALL CHECKS PASS — every re-derived figure ties to production at exactly $0")


if __name__ == "__main__":
    main()
