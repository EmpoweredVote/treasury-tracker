"""
Per-year governmental totals for ONE Indiana government, settlement split out.

Usage:
    py -3 scripts/inGovernmentTotalsProbe.py <cnty_cd> [unit_code] [county|city]

Written to answer a specific question and kept because the question recurs: is a
year's figure small because the government is small, or because the FILING is
short? Marion County FY2024 is the worked example — its settlement fund ran
$1.05-1.85 BILLION a year from 2011 to 2023, then its FY2024 filing carries a
$71.5M fragment and its NET receipts fall from $1,558,918,179.86 to
$607,214,107.07, a 61% collapse that persists into FY2025 with ~$950M of
NON-settlement receipts missing too.

⚠⚠ The settlement pass-through gate PASSES Marion, and correctly — the identity
holds across the series. So the series gate is not the place to catch this, and
a per-year total is. Check a government's totals before trusting one of its years.

Input files come from `node scripts/fetchIndianaGateway.mjs` and live in
`_acfr-work/in`, which is gitignored — the probe is committed, the 443 MB of
extracts are not.
"""
import collections
import sys

GOV = 'Governmental Activities'
SETTLEMENT_CODE = '106000'
EXACT_NAMES = {'settlement', 'tax settlement'}

CC = (sys.argv[1] if len(sys.argv) > 1 else '49').zfill(2)
UC = (sys.argv[2] if len(sys.argv) > 2 else '0000').zfill(4)
KIND = sys.argv[3] if len(sys.argv) > 3 else 'county'
REC = f'_acfr-work/in/rec_{KIND}_ALL.txt'
DIS = f'_acfr-work/in/disfund_{KIND}_ALL.txt'


def is_settlement(code, name):
    return code.strip() == SETTLEMENT_CODE or name.strip().lower() in EXACT_NAMES


def totals(path):
    full = collections.defaultdict(float)
    settle = collections.defaultdict(float)
    funds = collections.defaultdict(set)
    with open(path, encoding='utf-8', errors='replace') as f:
        hdr = f.readline().rstrip('\n').split('|')
        ix = {h.strip().lower(): i for i, h in enumerate(hdr) if h.strip()}
        need = max(ix.values())
        G = lambda p, k: p[ix[k]].strip()
        for line in f:
            p = line.rstrip('\n').split('|')
            if len(p) <= need:
                continue
            if G(p, 'cnty_cd').zfill(2) != CC or G(p, 'unit_code').zfill(4) != UC:
                continue
            if G(p, 'ent_name') != GOV:
                continue
            y = G(p, 'year')
            try:
                amt = float(G(p, 'amount').replace(',', '').replace('$', '') or 0)
            except ValueError:
                continue
            full[y] += amt
            funds[y].add(G(p, 'fund_code'))
            if is_settlement(G(p, 'fund_code'), G(p, 'fund_name')):
                settle[y] += amt
    return full, settle, funds


rf, rs, rfunds = totals(REC)
df, ds, dfunds = totals(DIS)

print(f'cnty_cd={CC} unit_code={UC} ({KIND}) — governmental totals per year')
print(f'{"year":6} {"receipts FULL":>18} {"of which settle":>18} {"receipts NET":>18} '
      f'{"funds":>6}')
for y in sorted(set(rf) | set(df)):
    print(f'{y:6} {rf[y]:>18,.2f} {rs[y]:>18,.2f} {rf[y] - rs[y]:>18,.2f} '
          f'{len(rfunds[y]):>6}')
print()
print(f'{"year":6} {"disburse FULL":>18} {"of which settle":>18} {"disburse NET":>18} '
      f'{"funds":>6}')
for y in sorted(set(rf) | set(df)):
    print(f'{y:6} {df[y]:>18,.2f} {ds[y]:>18,.2f} {df[y] - ds[y]:>18,.2f} '
          f'{len(dfunds[y]):>6}')

