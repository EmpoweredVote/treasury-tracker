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
    python scripts/tools/xlsToXlsx.py <src.xls|srcdir> <outdir> [--check] [--resume]

--limit=N stops after N workbooks are actually processed, so a long batch can be
run as the bounded batches .planning/GA-STATEWIDE-SWEEP.md asks for instead of
one run that an out-of-memory kill can erase. Combine with --resume.

--resume skips any workbook the ledger already recorded a verdict for AND whose
.xlsx is still on disk. A long batch that is interrupted — the Georgia
municipality run was killed by the OS at file 4,048 of 4,810 — then costs only
what it had not already done.

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

⚠⚠ SOME PUBLISHED WORKBOOKS CANNOT BE READ AT ALL. DCA serves at least one
genuinely ENCRYPTED .xls (Jenkins County FY2020) that passes the d0cf11e0
magic-byte gate — it is a real OLE2 file — and then fails in xlrd with
"Workbook is encrypted". An unreadable workbook is REFUSED and named, never
converted and never silently skipped; the exit code stays non-zero so a batch
containing one cannot read as clean. It costs one filing, not the run.
"""
import sys, os, glob, re, json, warnings
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
                # ⚠⚠ ERROR CELLS MUST NEVER BECOME NUMBERS. xlrd reports an
                # Excel error cell as XL_CELL_ERROR (type 5) whose "value" is the
                # error CODE — an int. #REF! is code 23, #DIV/0! is 7, #VALUE! is
                # 15, #N/A is 42. Copied naively, a broken formula silently
                # becomes a small, plausible dollar amount: this corpus holds
                # 1,851 error cells across 37 of 58 workbooks, and every #REF!
                # would have landed in the data as the number 23.
                # Written as the error TEXT so no downstream reader can mistake
                # it for money, and so it is visible rather than merely absent.
                if s.cell_type(r, c) == xlrd.XL_CELL_ERROR:
                    cell = ws.cell(row=r + 1, column=c + 1,
                                   value=xlrd.error_text_from_code.get(v, f"#ERR{v}"))
                    cell.data_type = "s"
                    n += 1
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
                if s.cell_type(r, c) == xlrd.XL_CELL_ERROR:
                    # Deliberately transformed: code -> text. Assert the mapping.
                    want = xlrd.error_text_from_code.get(a, f"#ERR{a}")
                    if v != want:
                        bad.append(f"{os.path.basename(src)} [{s.name}] r{r+1}c{c+1}: "
                                   f"error cell {a!r} -> {v!r}, expected {want!r}")
                    continue
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


LEDGER = ".convert-ledger.json"


def _load_ledger(outdir):
    try:
        with open(os.path.join(outdir, LEDGER), encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def _save_ledger(outdir, led):
    tmp = os.path.join(outdir, LEDGER + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(led, fh)
    os.replace(tmp, os.path.join(outdir, LEDGER))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    do_check = "--check" in sys.argv
    resume = "--resume" in sys.argv
    limit = None
    for a in sys.argv[1:]:
        if a.startswith("--limit="):
            limit = int(a.split("=", 1)[1])
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
    unreadable = []
    done = 0
    skipped = 0
    # ── RESUME, BECAUSE A LONG BATCH DOES NOT ALWAYS GET TO FINISH ───────────
    #
    # The Georgia municipality batch (4,810 workbooks) was killed by the OS at
    # file 4,048 when the machine ran out of memory. Everything was redone from
    # scratch, because a verdict that is only ever printed at the END is lost
    # with the process.
    #
    # The ledger records each file's verdict AS IT IS REACHED, and is flushed
    # every 25 files, so a kill costs at most 25 workbooks of work rather than
    # all of them. ⚠ --resume trusts a recorded `ok` ONLY when the .xlsx it
    # refers to is still on disk; it never assumes a file it cannot see.
    ledger = _load_ledger(outdir) if resume else {}
    # A WORKBOOK THIS CANNOT READ IS A REFUSAL, NOT A CRASH. The Georgia
    # statewide sweep hit `XLRDError: Workbook is encrypted` on file 743 of
    # 1,443 (Jenkins County FY2020) and the whole batch died, discarding the
    # --check results of the 742 that had already passed. One unreadable file
    # must cost one filing, not the run — but it must also be impossible to
    # MISS, so every refusal is named below and the exit code is still non-zero.
    for f in srcs:
        base = os.path.basename(f)
        dst = os.path.join(outdir, os.path.splitext(base)[0] + ".xlsx")
        prior = ledger.get(base)
        if limit is not None and done >= limit:
            break
        if resume and prior and os.path.exists(dst):
            if prior["status"] == "ok":
                total_cells += prior.get("cells", 0)
                skipped += 1
                continue
            if prior["status"] == "refused":
                unreadable.append(f"{base}: {prior['reason']} (recorded earlier)")
                skipped += 1
                continue
        try:
            cells = convert(f, dst)
            total_cells += cells
            if do_check:
                bad = check(f, dst)
                problems += bad
                if bad:
                    ledger[base] = {"status": "mismatch", "reason": bad[0]}
                    _save_ledger(outdir, ledger)
                    done += 1
                    continue
            ledger[base] = {"status": "ok", "cells": cells}
        except Exception as e:  # noqa: BLE001 - the reason is reported, not swallowed
            reason = f"{type(e).__name__}: {e}"
            unreadable.append(f"{base}: {reason}")
            if os.path.exists(dst):
                os.remove(dst)  # never leave a half-written workbook to be loaded
            ledger[base] = {"status": "refused", "reason": reason}
            _save_ledger(outdir, ledger)
            continue
        done += 1
        if done % 25 == 0:
            _save_ledger(outdir, ledger)
    _save_ledger(outdir, ledger)
    remaining = len(srcs) - len(ledger)
    if remaining > 0:
        print(f"[BATCH] {remaining} workbook(s) still have no verdict - "
              f"run again with --resume to continue")
    print(f"converted {done} of {len(srcs)} workbook(s)"
          + (f", {skipped} resumed from the ledger" if skipped else "")
          + f", {total_cells:,} cells -> {outdir}")
    if unreadable:
        # ASCII only: this console is cp1252.
        print(f"\n[REFUSED] {len(unreadable)} WORKBOOK(S) COULD NOT BE READ AT ALL:")
        for u in unreadable:
            print("   " + u)
    if do_check:
        if problems:
            # ASCII only: the Windows console this runs on is cp1252 and a check
            # that crashes on its own failure message reports nothing at all.
            print(f"\n[FAIL] {len(problems)} MATERIAL MISMATCH(ES):")
            for p in problems[:40]:
                print("   " + p)
            sys.exit(1)
        print("[OK] --check: every cell round-trips inside the documented tolerances")
    if unreadable:
        sys.exit(1)


if __name__ == "__main__":
    main()
