"""
Document-quality gate for ACFR PDFs — the four checks, run together.

WHY THIS EXISTS: a wrong document and a damaged document both reach the extractor
looking like a good one, and the tie gate CANNOT tell you about either — it proves
the READ, never the SOURCE. Session 8 established the measures the hard way and
they were applied by hand; this makes them a command.

⚠⚠ RUN ALL FOUR AND FAIL ON ANY ONE. They catch OPPOSITE failures, and each one
alone has been sailed past by a real document in this campaign:

  chars/page       catches an IMAGE-ONLY scan (a near-empty text layer).
                   ⚠ PASSED by City of Biloxi FY2023, which extracts 1,912
                   chars/page — ABOVE its corpus median — of pure garbage.

  vocabulary share catches a DENSE but garbled OCR layer
                   (`CITY Of' 80.,0XI`, `Sta1cmc111orNet Posi1f(lfl`).
                   ⚠ PASSED by Harrison County MS FY2015, which scores 45.7%
                   because its ONLY text is a one-page disclaimer — 1 page of 126.

  welded tokens    the same failure from the other side: digits fused into words.

  numeric pages    ⭐⭐ CAUGHT EVERY BAD DOCUMENT IN THE CAMPAIGN ON ITS OWN.
                   A garbled scan, an image-only scan and a non-ACFR package all
                   score 0. This is the PRIMARY gate; the other three explain WHY.

Usage:
    python scripts/tools/acfrDocQuality.py _acfr-work/sc-cities/acfr/charleston
    python scripts/tools/acfrDocQuality.py <dir-or-pdf> [more...] --json out.json

Requires: pdftotext (poppler) on PATH.
"""
import argparse
import json
import os
import re
import subprocess
import sys

# Windows consoles default to cp1252, which cannot encode the marks used in this
# repo's output. Force UTF-8 rather than degrade the text.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Thresholds, from the session-8 measurements over a 58-document corpus.
MIN_CHARS_PER_PAGE = 400
MIN_VOCAB_SHARE = 0.30
MAX_WELDED_PER_PAGE = 12.0
MIN_NUMERIC_STATEMENT_PAGES = 1

# A small ACFR/English vocabulary. Deliberately SMALL and generic: it measures
# whether the text layer is words at all, not whether it is a particular issuer's
# words. Over the session-8 corpus good documents scored 39.5-47.2% and the one
# garbled document scored 24.4%.
VOCAB = {
    # structure / accounting
    "the", "of", "and", "to", "in", "for", "as", "on", "at", "by", "with", "from",
    "that", "this", "these", "those", "is", "are", "was", "were", "be", "been",
    "not", "or", "an", "it", "its", "which", "such", "other", "total", "totals",
    "net", "fund", "funds", "general", "revenue", "revenues", "expenditure",
    "expenditures", "expense", "expenses", "balance", "balances", "sheet",
    "statement", "statements", "financial", "position", "activities", "assets",
    "liabilities", "equity", "governmental", "government", "proprietary",
    "fiduciary", "capital", "outlay", "debt", "service", "principal", "interest",
    "taxes", "tax", "property", "sales", "charges", "services", "licenses",
    "permits", "fines", "forfeitures", "intergovernmental", "miscellaneous",
    "investment", "earnings", "transfers", "in", "out", "sources", "uses",
    "financing", "beginning", "ending", "year", "years", "fiscal", "annual",
    "comprehensive", "report", "city", "town", "county", "state", "united",
    "states", "america", "independent", "auditor", "auditors", "opinion",
    "management", "discussion", "analysis", "notes", "accounting", "policies",
    "basis", "accrual", "modified", "cash", "budget", "budgetary", "actual",
    "public", "safety", "police", "fire", "administration", "development",
    "community", "culture", "recreation", "parks", "streets", "highways",
    "sanitation", "water", "sewer", "housing", "education", "health", "welfare",
    "employee", "employees", "pension", "benefits", "payroll", "salaries",
    "wages", "insurance", "contracts", "supplies", "materials", "utilities",
    "depreciation", "amortization", "bonds", "notes", "payable", "receivable",
    "cash", "equivalents", "restricted", "unrestricted", "assigned", "committed",
    "nonspendable", "unassigned", "reserve", "reserves", "december", "june",
    "september", "january", "ended", "ending", "per", "and", "all", "any",
    "during", "under", "over", "were", "has", "have", "had", "will", "may",
    "december", "amounts", "thousands", "presented", "presentation", "fairly",
    "material", "respects", "conformity", "principles", "generally", "accepted",
    "audit", "audited", "auditing", "standards", "control", "internal",
    "compliance", "federal", "awards", "schedule", "combining", "individual",
    "major", "nonmajor", "special", "projects", "enterprise", "internal",
}

# A "welded" token: letters and digits fused inside one word, the signature of a
# damaged OCR layer (`Sta1cmc111`, `Exl1ibil`, `Posi1f`). Pure alphanumerics that
# are plainly legitimate (a year, a note reference like `A1`, an ordinal) are
# excluded by requiring letters on BOTH sides of a digit run.
WELDED_RE = re.compile(r"^[A-Za-z]{2,}[0-9]+[A-Za-z]{2,}")
TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'\-]+")
MONEY_RE = re.compile(r"[\d,]{4,}")

STATEMENT_HINTS = (
    "revenues", "revenue", "expenditures", "fund balance", "fund balances",
    "net position", "changes in fund",
)


def pdf_pages(path):
    r = subprocess.run(["pdfinfo", path], capture_output=True, text=True)
    m = re.search(r"^Pages:\s+(\d+)$", r.stdout or "", re.M)
    return int(m.group(1)) if m else None


def pdf_text(path):
    r = subprocess.run(["pdftotext", "-q", path, "-"], capture_output=True, text=True)
    return r.stdout or ""


def numeric_statement_pages(text):
    """Pages carrying BOTH a statement heading AND several money-shaped numbers.

    ⚠ Both conditions are required. A table of contents names the statements and
    carries no money; a statistical table carries money and no heading.
    """
    count = 0
    for page in text.split("\f"):
        low = page.lower()
        if not any(h in low for h in STATEMENT_HINTS):
            continue
        if len(MONEY_RE.findall(page)) >= 8:
            count += 1
    return count


def measure(path):
    pages = pdf_pages(path) or 0
    text = pdf_text(path)
    chars = len(text)
    tokens = TOKEN_RE.findall(text)
    lower = [t.lower() for t in tokens]
    vocab_hits = sum(1 for t in lower if t in VOCAB)

    welded = 0
    for raw in re.findall(r"\S+", text):
        if WELDED_RE.match(raw):
            welded += 1

    cpp = chars / pages if pages else 0.0
    share = vocab_hits / len(tokens) if tokens else 0.0
    wpp = welded / pages if pages else 0.0
    numeric = numeric_statement_pages(text)

    failures = []
    if cpp < MIN_CHARS_PER_PAGE:
        failures.append(f"chars/page {cpp:.0f} < {MIN_CHARS_PER_PAGE} (image-only scan?)")
    if share < MIN_VOCAB_SHARE:
        failures.append(f"vocabulary {share*100:.1f}% < {MIN_VOCAB_SHARE*100:.0f}% (garbled OCR?)")
    if wpp > MAX_WELDED_PER_PAGE:
        failures.append(f"welded tokens/page {wpp:.1f} > {MAX_WELDED_PER_PAGE} (garbled OCR?)")
    if numeric < MIN_NUMERIC_STATEMENT_PAGES:
        failures.append(f"numeric statement pages {numeric} < {MIN_NUMERIC_STATEMENT_PAGES} "
                        "(wrong document, or no readable statement)")

    return {
        "file": os.path.basename(path),
        "pages": pages,
        "chars_per_page": round(cpp, 1),
        "vocab_share": round(share, 4),
        "welded_per_page": round(wpp, 2),
        "numeric_statement_pages": numeric,
        "ok": not failures,
        "failures": failures,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--json")
    args = ap.parse_args()

    files = []
    for p in args.paths:
        if os.path.isdir(p):
            files += [os.path.join(p, f) for f in sorted(os.listdir(p)) if f.lower().endswith(".pdf")]
        elif p.lower().endswith(".pdf"):
            files.append(p)
    if not files:
        sys.exit("REFUSING: no PDFs found. A gate that measures nothing must fail.")

    results = [measure(f) for f in files]
    print(f"{'file':<34} {'pages':>5} {'ch/pg':>8} {'vocab':>7} {'weld':>6} {'stmts':>6}  verdict")
    bad = 0
    for r in results:
        verdict = "ok" if r["ok"] else "FAIL"
        if not r["ok"]:
            bad += 1
        print(f"{r['file']:<34} {r['pages']:>5} {r['chars_per_page']:>8.0f} "
              f"{r['vocab_share']*100:>6.1f}% {r['welded_per_page']:>6.1f} "
              f"{r['numeric_statement_pages']:>6}  {verdict}")
        for f in r["failures"]:
            print(f"      ⚠ {f}")

    print(f"\n{len(results) - bad}/{len(results)} documents pass all four checks.")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(results, fh, indent=1, sort_keys=True)
        print(f"wrote {args.json}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
