#!/usr/bin/env python3
"""
TEMPORARY inspection script — used to discover Portland budget PDF table structure
for Plan 02 extractor development. Safe to delete after Plan 01 is complete.

Usage:
    python scripts/_inspect-portland-temp.py docs/Portland/fy2025-26-vol1.pdf
"""
import sys
import json
import pdfplumber

def inspect_pdf(pdf_path, max_pages=None):
    print(f"Inspecting: {pdf_path}", file=sys.stderr)
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        print(f"Total pages: {total}", file=sys.stderr)
        for page_num, page in enumerate(pdf.pages, 1):
            if max_pages and page_num > max_pages:
                break
            text = page.extract_text() or ""
            # Look for pages with bureau/service area budget tables
            if any(kw in text for kw in [
                "Service Area", "Bureau", "Adopted", "FY 2025-26", "FY 2024-25",
                "Total Resources", "Total Requirements", "General Fund",
                "Operating Budget", "City Budget"
            ]):
                tables = page.extract_tables()
                page_info = {
                    "page_num": page_num,
                    "text_preview": text[:500] if text else "",
                    "num_tables": len(tables),
                    "tables": [],
                }
                for t_idx, table in enumerate(tables):
                    if table:
                        page_info["tables"].append({
                            "table_index": t_idx,
                            "num_rows": len(table),
                            "first_5_rows": table[:5],
                        })
                results.append(page_info)
    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python _inspect-portland-temp.py <pdf_path> [max_pages]", file=sys.stderr)
        sys.exit(1)
    pdf_path = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else None
    data = inspect_pdf(pdf_path, max_pages)
    print(json.dumps(data, indent=2, default=str))
