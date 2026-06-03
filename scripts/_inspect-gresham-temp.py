#!/usr/bin/env python3
"""
TEMPORARY inspection script for FY2023-24 Gresham PDF structure.
Answers RESEARCH Open Question 1: FY2023-24 All Funds page structure.
Delete after Plan 01 summary is written.

Usage: python scripts/_inspect-gresham-temp.py
"""

import re
import pdfplumber

PDF_PATH = "docs/Gresham/fy2023-24.pdf"

def main():
    with pdfplumber.open(PDF_PATH) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Resources and Requirements' in text and 'All Funds' in text:
                print(f"\n=== All Funds page found at page {page_num} ===\n")

                # Print full page text
                print("--- Full page text ---")
                print(text)
                print("\n--- End of page text ---\n")

                # Check extract_tables
                tables = page.extract_tables()
                print(f"extract_tables() result: {len(tables)} tables found")
                if tables:
                    print("Tables (should be empty):", tables)
                else:
                    print("Confirmed: extract_tables() returns empty []")

                # Print first 10 lines to see header structure
                lines = text.split('\n')
                print(f"\n--- First 10 lines (column headers) ---")
                for i, line in enumerate(lines[:10]):
                    print(f"  Line {i}: {repr(line)}")

                # Find the column-header line (should contain FY patterns like 2020/2021)
                print(f"\n--- FY header line detection ---")
                for i, line in enumerate(lines[:8]):
                    matches = re.findall(r'\d{4}/(?:\d{4}|\d{2})(?!\d)', line)
                    if matches:
                        print(f"  Line {i}: {repr(line)}")
                        print(f"  FY matches: {matches}")
                        last = matches[-1]
                        m4 = re.match(r'(\d{4})/(\d{4})', last)
                        m2 = re.match(r'(\d{4})/(\d{2})', last)
                        if m4:
                            fy = int(m4.group(2))
                        elif m2:
                            fy = int(m2.group(1)) // 100 * 100 + int(m2.group(2))
                        else:
                            fy = None
                        print(f"  Parsed fiscal_year: {fy}")
                        break

                # Find Requirements section and list department rows
                print(f"\n--- Requirements section lines ---")
                in_requirements = False
                dept_lines = []
                for line in lines:
                    s = line.strip()
                    if not s:
                        continue
                    if s == 'Requirements':
                        in_requirements = True
                        print(f"  [MARKER] Found 'Requirements' section")
                        continue
                    if not in_requirements:
                        continue
                    print(f"  RAW: {repr(s)}")
                    dept_lines.append(s)
                    # Stop after Operating Total
                    if 'Operating Total' in s:
                        print(f"  [STOP] Found Operating Total")
                        break

                # Check for OCR artifacts
                print(f"\n--- OCR artifact check ---")
                ocr_issues = []
                for line in dept_lines:
                    # Mid-word spaces in names (letters separated by space before numbers)
                    if re.search(r'[a-z] [A-Z]', line):
                        ocr_issues.append(f"  Possible name OCR: {repr(line)}")
                    # Number with internal spaces: digit space digit/comma
                    if re.search(r'\d \d', line) or re.search(r'\d ,', line):
                        ocr_issues.append(f"  Possible number OCR: {repr(line)}")
                if ocr_issues:
                    print("OCR artifacts found:")
                    for issue in ocr_issues:
                        print(issue)
                else:
                    print("No obvious OCR artifacts detected")

                break
        else:
            print("ERROR: No 'Resources and Requirements' + 'All Funds' page found!")

if __name__ == '__main__':
    main()
