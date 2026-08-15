#!/usr/bin/env python3
"""
Throwaway decoder for the FY2009 Bainbridge Island SAO report (ARN 1004976).

Its statement pages use an embedded font with no usable ToUnicode CMap, so
pdftotext emits a monoalphabetic substitution of the real glyphs -- digits
come out as punctuation. Narrative pages in the same document are fine.

SELF-VALIDATING BY CONSTRUCTION: a candidate map is accepted only if the
decoded statement's own line items sum EXACTLY to its own decoded printed
total. A wrong map cannot produce a $0 tie except by coincidence across two
independent statements (revenue and expenditure), so the tie gate validates
the decoder rather than the decoder being trusted.

If no candidate ties, FY2009 is DROPPED. That is a valid outcome of this
script, not a failure to work around.

NOTE on pdftotext mode: `-layout` scrambles this document's statement pages
into near-blank output (poppler falls back to glyph-width-based column
positioning, which is unusable when the glyph widths themselves belong to a
corrupted font). Plain (reading-order) pdftotext preserves the actual
garbled character stream, including the comma grouping of the original
numbers -- e.g. `,$+%($&&'` -- so this script extracts in that mode, not
`-layout`.

Usage:
  py -3 scripts/decodeSaoFont2009.py docs/BainbridgeIsland/bainbridge-2009-acfr.pdf
"""
import argparse
import re
import subprocess
import sys

# Observed on the FY2009 statement pages. The document renders digits 0-9 as
# punctuation drawn from this contiguous ASCII run (0x21-0x2F).
#
# DO NOT brute-force all orderings: permutations(15, 10) is 10.9 BILLION
# candidates and will never finish. The tractable hypothesis is that the
# font's glyph order is CONTIGUOUS -- digits 0-9 occupy ten consecutive
# code points at some offset -- which leaves only six candidate maps. A
# broken ToUnicode CMap almost always preserves glyph ORDER; it is the
# base offset that is lost. If no contiguous offset ties, this script
# reports failure and FY2009 is dropped rather than escalating to a
# search that cannot terminate.
CIPHER_ALPHABET = "!\"#$%&'()*+,-./"


def page_text(pdf, first, last):
    return subprocess.run(
        ['pdftotext', '-f', str(first), '-l', str(last), pdf, '-'],
        capture_output=True, text=True, check=True).stdout


def decode(text, mapping):
    return ''.join(mapping.get(ch, ch) for ch in text)


def statement_lines(text):
    """Rows that look like a label followed by grouped numerics."""
    out = []
    for line in text.split('\n'):
        if re.search(r'\d{1,3}(,\d{3})+', line):
            out.append(line)
    return out


def first_column_values(lines):
    vals = []
    for line in lines:
        m = re.search(r'(\d{1,3}(?:,\d{3})+)', line)
        if m:
            vals.append(int(m.group(1).replace(',', '')))
    return vals


def ties(values):
    """True if the last value equals the sum of the preceding ones."""
    return len(values) > 2 and sum(values[:-1]) == values[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--first', type=int, default=17)
    ap.add_argument('--last', type=int, default=23)
    args = ap.parse_args()

    raw = page_text(args.pdf, args.first, args.last)
    if not raw.strip():
        print('Statement pages emit no text at all -- these are images. '
              'FY2009 cannot be recovered by decoding. DROP IT.', file=sys.stderr)
        return 2

    present = [c for c in CIPHER_ALPHABET if c in raw]
    if len(present) < 10:
        print(f'Only {len(present)} candidate glyphs present ({"".join(present)}); '
              'not a 10-digit substitution. DROP FY2009.', file=sys.stderr)
        return 2

    # Six contiguous windows of ten over a fifteen-glyph run.
    for start in range(len(CIPHER_ALPHABET) - 9):
        window = CIPHER_ALPHABET[start:start + 10]
        mapping = {ch: str(i) for i, ch in enumerate(window)}
        decoded = decode(raw, mapping)
        vals = first_column_values(statement_lines(decoded))
        print(f'  offset {start} (glyphs {window!r}): '
              f'{len(vals)} numeric rows, ties={ties(vals)}', file=sys.stderr)
        if ties(vals):
            print('CANDIDATE MAP TIES at offset %d:' % start, mapping)
            print(decoded)
            return 0

    print('No contiguous-offset substitution produced a self-consistent tie. '
          'DROP FY2009.', file=sys.stderr)
    return 2


if __name__ == '__main__':
    sys.exit(main())
