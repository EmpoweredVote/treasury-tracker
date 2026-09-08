"""
PROOF that the audited TOTAL GOVERNMENTAL FUNDS column can be read and ties.

⚠⚠ THIS IS A PROBE, NOT THE PRODUCTION PATH. The production extractor is
`scripts/lib/acfrGF.py`, which encodes nine documented failure modes — four of
which produce a WRONG TREE THAT TIES AT $0. Do not grow this file into a second
extractor; teach the library to target a column instead. This exists to record
that the target is readable, and to be re-runnable when that change is made.

Marion County FY2025, from its own ACFR via the Federal Audit Clearinghouse
(report 2025-12-GSAFAC-0000409398, free and unauthenticated). Result:

    printed GENERAL FUND revenue        304,421,719
    printed TOTAL GOVERNMENTAL revenue  463,520,173
    component sum                       463,520,173
    TIE DELTA                                     0

⚠ The anchor row exposes only FOUR money columns for SIX funds, because the two
GASB 100 "(formerly a major fund)" columns are entirely dash-zero. Column count
is therefore a property of the YEAR, not of the county — the library's
dash-zero handling (failure mode #1) is exactly what this needs.

⚠⚠ AND THE TEN-YEAR SHORTCUT IS REFUSED. The same PDF carries a statistical
schedule with ten years of the same figure in one table — but the document's own
table of contents says `III. STATISTICAL SECTION (UNAUDITED)`. Sourcing from it
would grade `self_reported`, which is the very thing this route exists to escape.
One audited ACFR per year, on the publisher's own word.
"""
import re

PATH = ('C:/Users/Chris/AppData/Local/Temp/claude/C--treasury-tracker/'
        '584f5780-86ec-4c16-af58-29bfb27d87e1/scratchpad/mc2025_full_table.txt')
MONEY = re.compile(r'\(?\$?\s*-?[\d,]{4,}\)?')


def money_tokens(line):
    """(value, right_edge_column) for every money token on the line."""
    out = []
    for m in MONEY.finditer(line):
        raw = m.group(0)
        digits = raw.replace('$', '').replace(',', '').replace('(', '').replace(')', '').strip()
        if not re.fullmatch(r'-?\d+', digits):
            continue
        out.append((int(digits), m.end()))
    return out


lines = open(PATH, encoding='utf-8', errors='replace').read().split('\n')
anchor = next(i for i, l in enumerate(lines)
              if 'Total revenues' in l and '463,520,173' in l)

# ── anchor the columns from the fully-populated total row, as the library does
anchor_cols = [c for _, c in money_tokens(lines[anchor])]
print(f'anchor row has {len(anchor_cols)} money columns, right edges: {anchor_cols}')
printed_total = money_tokens(lines[anchor])[-1][0]
print(f'printed TOTAL GOVERNMENTAL revenue: {printed_total:,}')
print(f'printed GENERAL FUND revenue      : {money_tokens(lines[anchor])[0][0]:,}')
print()

# ── walk back to the `Revenues:` header and sum the LAST column per row
start = next(i for i in range(anchor, anchor - 30, -1)
             if lines[i].strip().lower().startswith('revenues'))
print(f'revenue block: lines {start + 1}..{anchor - 1}')
total = 0
rows = 0
for i in range(start + 1, anchor):
    line = lines[i]
    if not line.strip():
        continue
    label = line[:line.find('$') if '$' in line else 60].strip(' .$')
    toks = money_tokens(line)
    if not toks:
        # ⚠ Could be a wrapped label OR a row whose every cell is a dash.
        dashes = len(re.findall(r'(?<!\S)-(?!\S)', line))
        print(f'   {label[:44]:44} NO MONEY TOKENS, {dashes} dash cell(s)')
        continue
    # assign each token to the nearest anchor column; take the rightmost
    last_col_val = None
    for val, edge in toks:
        nearest = min(range(len(anchor_cols)), key=lambda k: abs(anchor_cols[k] - edge))
        if nearest == len(anchor_cols) - 1:
            last_col_val = val
    if last_col_val is None:
        print(f'   {label[:44]:44} no value in the TOTAL column '
              f'({len(toks)} token(s) in others)')
        continue
    total += last_col_val
    rows += 1
    print(f'   {label[:44]:44} {last_col_val:>15,}')

print()
print(f'component rows found      : {rows}')
print(f'component sum             : {total:,}')
print(f'printed total             : {printed_total:,}')
print(f'TIE DELTA                 : {total - printed_total:,}')
print('=> ' + ('TIES' if total == printed_total else 'DOES NOT TIE'))
