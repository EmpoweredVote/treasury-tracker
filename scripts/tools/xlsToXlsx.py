"""
Convert legacy BIFF8 .xls workbooks to .xlsx, cell for cell.

WHY THIS EXISTS: Georgia DCA publishes the Report of Local Government Finances
as OLE2/BIFF8 .xls (magic d0cf11e0). ExcelJS — the reader every other TT loader
uses — reads .xlsx only and cannot open these at all. Rather than add a new npm
XLS dependency, this converts at the FETCH stage, the same way TT already shells
out to pdftotext and tesseract for PDFs. The loader downstream is plain Node.

Requires: xlrd (BIFF8 reader), openpyxl (xlsx writer).
    python -m pip install xlrd openpyxl

Usage:
    python scripts/tools/xlsToXlsx.py <src.xls|srcdir> <outdir> [--check]

--check re-reads each written .xlsx and diffs every cell against the .xls it came
from, failing on any mismatch outside the documented tolerances below.

⚠ TWO TOLERATED DIFFERENCE CLASSES, both verified benign on the GA corpus:
  1. Newline normalisation in multi-line PROSE cells. openpyxl rewrites each
     CRLF as two LFs, so these are compared with all whitespace collapsed.
     Money cells are floats and never take this path.
  2. Float repr at ~1e-8 on values that are already non-integer cents, e.g.
     2185407.0999999996 -> 2185407.1. Observed ONLY in Part VII capital-asset
     rows and the LOAD1 mirror of them; never in a revenue or expenditure figure.
Anything else is a hard failure: a silent cell change here would be invisible
downstream, which is the whole reason --check exists. A third class was found
and FIXED rather than tolerated — see the formula guard in convert().
"""
import sys, os, glob, re, warnings
warnings.filterwarnings("ignore")
import xlrd, openpyxl

FLOAT_TOL = 1e-6


def _norm_ws(s):
    """Collapse all runs of whitespace. Used ONLY to compare prose cells."""
    return re.sub(r"\s+", " ", s).strip()


def convert(src, dst):
    b = xlrd.open_workbook(src)
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    n = 0
    for s in b.sheets():
        ws = wb.create_sheet(s.name[:31])
        for r in range(s.nrows):
            for c in range(s.ncols):
                v = s.cell_value(r, c)
                if v == "" or v is None:
                    continue
                cell = ws.cell(row=r + 1, column=c + 1, value=v)
                # ⚠ SILENT CORRUPTION GUARD. openpyxl infers a FORMULA from any
                # string starting with "=", so a text cell holding "='Page 1'!F22"
                # is written as a formula and reads back as None under
                # data_only=True — the value vanishes with no error anywhere.
                # Three such cells exist in the FY2014 'Exportable Data' sheets.
                # Forcing the type back to string keeps them as the text they are.
                if isinstance(v, str) and v.startswith("="):
                    cell.data_type = "s"
                n += 1
    wb.save(dst)
    return n


def check(src, dst):
    """Return a list of material mismatches (tolerated classes excluded)."""
    b = xlrd.open_workbook(src)
    wb = openpyxl.load_workbook(dst, data_only=True)
    bad = []
    for s in b.sheets():
        ws = wb[s.name[:31]]
        for r in range(s.nrows):
            for c in range(s.ncols):
                a = s.cell_value(r, c)
                if a == "" or a is None:
                    continue
                v = ws.cell(row=r + 1, column=c + 1).value
                if a == v:
                    continue
                if isinstance(a, str) and isinstance(v, str) and _norm_ws(a) == _norm_ws(v):
                    continue  # class 1: newline normalisation (\r\n becomes \n\n)
                # ⚠ int, not just float: openpyxl reads a whole-number cell back as
                # an int, so 14624999.999999998 -> 14625000 is a 2e-9 difference
                # that an isinstance(v, float) guard rejects as material.
                if (isinstance(a, (int, float)) and not isinstance(a, bool)
                        and isinstance(v, (int, float)) and not isinstance(v, bool)
                        and abs(a - v) <= FLOAT_TOL):
                    continue  # class 2: float repr
                bad.append(f"{os.path.basename(src)} [{s.name}] r{r+1}c{c+1}: {a!r} -> {v!r}")
    return bad


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    do_check = "--check" in sys.argv
    if len(args) != 2:
        print(__doc__)
        sys.exit(2)
    src, outdir = args
    srcs = sorted(glob.glob(os.path.join(src, "*.xls"))) if os.path.isdir(src) else [src]
    if not srcs:
        print(f"no .xls found under {src}")
        sys.exit(1)
    os.makedirs(outdir, exist_ok=True)
    total_cells = 0
    problems = []
    for f in srcs:
        dst = os.path.join(outdir, os.path.splitext(os.path.basename(f))[0] + ".xlsx")
        total_cells += convert(f, dst)
        if do_check:
            problems += check(f, dst)
    print(f"converted {len(srcs)} workbook(s), {total_cells:,} cells -> {outdir}")
    if do_check:
        if problems:
            # ASCII only: the Windows console this runs on is cp1252 and a check
            # that crashes on its own failure message reports nothing at all.
            print(f"\n[FAIL] {len(problems)} MATERIAL MISMATCH(ES):")
            for p in problems[:40]:
                print("   " + p)
            sys.exit(1)
        print("[OK] --check: every cell round-trips inside the documented tolerances")


if __name__ == "__main__":
    main()
