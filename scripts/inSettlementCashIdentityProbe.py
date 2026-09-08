"""
Is `receipts - disbursements == cash_bal - beg_cash_inv` a DISCRIMINATING test of
the settlement pass-through, or an accounting tautology?

It looked like a stronger replacement for the 2% pass-through tolerance: Parke
County's whole $5.2M residue is sitting right there in Gateway's own Cash and
Investments report as a closing balance. But a gate that every fund satisfies
cannot tell a settlement fund from real revenue, and the whole job of
`assertSettlementIsPassThrough` is to catch a MISIDENTIFIED fund.

So: measure the identity over ALL county funds, settlement and not.
If non-settlement funds satisfy it just as well, it is the Austin rule again —
a tie that is necessary but not sufficient — and it must NOT become the gate.

Input files come from `node scripts/fetchIndianaGateway.mjs` and live in
`_acfr-work/in`, which is gitignored — the probe is committed, the 443 MB of
extracts are not.
"""
import collections

SETTLEMENT_CODE = '106000'
EXACT_NAMES = {'settlement', 'tax settlement'}
GOV = 'Governmental Activities'
EPS = 1.0


def is_settlement(code, name):
    return code.strip() == SETTLEMENT_CODE or name.strip().lower() in EXACT_NAMES


def scan(path, cols, keep):
    out = collections.defaultdict(lambda: collections.defaultdict(float))
    with open(path, encoding='utf-8', errors='replace') as f:
        hdr = f.readline().rstrip('\n').split('|')
        ix = {h.strip().lower(): i for i, h in enumerate(hdr) if h.strip()}
        need = max(ix.values())
        G = lambda p, k: p[ix[k]].strip()
        for line in f:
            p = line.rstrip('\n').split('|')
            if len(p) <= need:
                continue
            if G(p, 'ent_name') != GOV:
                continue
            # Key the way the loader keys a fund: code + unit fund number.
            key = (G(p, 'year'), G(p, 'cnty_cd').zfill(2), G(p, 'unit_code').zfill(4),
                   G(p, 'fund_code'), G(p, 'unit_fund_number'))
            if keep and not keep(G(p, 'fund_code'), G(p, 'fund_name')):
                continue
            for c in cols:
                try:
                    out[key][c] += float(G(p, c).replace(',', '').replace('$', '') or 0)
                except ValueError:
                    pass
            out[key]['_settlement'] = 1.0 if is_settlement(
                G(p, 'fund_code'), G(p, 'fund_name')) else out[key].get('_settlement', 0.0)
    return out


rec = scan('_acfr-work/in/rec_county_ALL.txt', ['amount'], None)
dis = scan('_acfr-work/in/disfund_county_ALL.txt', ['amount'], None)
cash = scan('_acfr-work/in/cash_county_ALL.txt',
            ['beg_cash_inv', 'r_bal', 'd_bal', 'cash_bal'], None)

stats = collections.Counter()
worst = collections.defaultdict(list)

for key in set(rec) | set(dis):
    r = rec.get(key, {}).get('amount', 0.0)
    d = dis.get(key, {}).get('amount', 0.0)
    c = cash.get(key)
    settle = (rec.get(key, {}).get('_settlement', 0.0)
              or dis.get(key, {}).get('_settlement', 0.0))
    bucket = 'settlement' if settle else 'ordinary'
    if c is None:
        stats[f'{bucket}: NO cash row'] += 1
        continue
    lhs = r - d
    rhs = c['cash_bal'] - c['beg_cash_inv']
    if abs(lhs - rhs) <= EPS:
        stats[f'{bucket}: identity HOLDS'] += 1
    else:
        stats[f'{bucket}: identity FAILS'] += 1
        worst[bucket].append((abs(lhs - rhs), key, lhs, rhs))

print('Does  receipts - disbursements == cash_bal - beg_cash_inv  ?')
print('measured per (year, county, fund) over every governmental county fund')
print()
for k in sorted(stats):
    print(f'  {k:34} {stats[k]:>7,}')
print()
for bucket in ('ordinary', 'settlement'):
    hold = stats[f'{bucket}: identity HOLDS']
    fail = stats[f'{bucket}: identity FAILS']
    tot = hold + fail
    if tot:
        print(f'  {bucket:10} identity holds on {hold:,}/{tot:,} = {hold / tot:.2%}')
print()
for bucket in ('ordinary', 'settlement'):
    if worst[bucket]:
        print(f'worst {bucket} failures:')
        for diff, key, lhs, rhs in sorted(worst[bucket], reverse=True)[:5]:
            print(f'  ${diff:>16,.2f}  {key}  r-d {lhs:>+16,.2f}  dcash {rhs:>+16,.2f}')
