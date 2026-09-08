"""
Measure the settlement pass-through identity at the SERIES level, for CITIES AND
TOWNS AS WELL AS COUNTIES, keyed by (cnty_cd, unit_code) and NOT by name.

Why this exists alongside settlementDrift.py:
  * settlementDrift.py measured counties only. Cities and towns can match the
    settlement rule too (the rule is code 106000 OR an exact name), and a fix
    that only ever looked at counties would ship a gate nobody measured on the
    568 governments it also guards.
  * settlementDrift.py summed the series by `unit_name`. Two governments sharing
    a name would silently merge into one series. The loader keys on
    (cnty_cd, unit_code), so this measures the same key the loader asserts on.

Emits the EXACT residue for any government over tolerance, so the fix can
declare a measured dollar figure instead of widening the tolerance.

Input files come from `node scripts/fetchIndianaGateway.mjs` and live in
`_acfr-work/in`, which is gitignored — the probe is committed, the 443 MB of
extracts are not.
"""
import collections

SETTLEMENT_CODE = '106000'
EXACT_NAMES = {'settlement', 'tax settlement'}
GOV = 'Governmental Activities'
TOLERANCE = 0.02


def is_settlement(code, name):
    return code.strip() == SETTLEMENT_CODE or name.strip().lower() in EXACT_NAMES


def scan(path):
    """(year, cc, uc, name) -> summed settlement amount."""
    out = collections.defaultdict(float)
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
            if not is_settlement(G(p, 'fund_code'), G(p, 'fund_name')):
                continue
            key = (G(p, 'year'), G(p, 'cnty_cd').zfill(2), G(p, 'unit_code').zfill(4),
                   G(p, 'unit_name'))
            try:
                out[key] += float(G(p, 'amount').replace(',', '').replace('$', '') or 0)
            except ValueError:
                pass
    return out


def drift(r, d):
    scale = max(abs(r), abs(d))
    return None if scale == 0 else abs(r - d) / scale


for label, recfile, disfile in [
    ('COUNTY', 'rec_county_ALL.txt', 'disfund_county_ALL.txt'),
    ('CITY-TOWN', 'rec_city_ALL.txt', 'disfund_city_ALL.txt'),
]:
    rec = scan(f'_acfr-work/in/{recfile}')
    dis = scan(f'_acfr-work/in/{disfile}')

    print('=' * 78)
    print(f'{label}')
    print('=' * 78)

    # ── per entity-year (what the gate asserts on TODAY) ──────────────────────
    peryear = []
    for k in set(rec) | set(dis):
        dr = drift(rec.get(k, 0.0), dis.get(k, 0.0))
        if dr is not None:
            peryear.append((dr, k))
    over_year = [x for x in peryear if x[0] > TOLERANCE]
    print(f'entity-years reporting a settlement fund: {len(peryear)}')
    print(f'  over {TOLERANCE:.0%} per-year: {len(over_year)}')

    # ── per SERIES, keyed on (cc, uc) — what the fix asserts on ───────────────
    per = collections.defaultdict(lambda: [0.0, 0.0])
    names = {}
    years = collections.defaultdict(set)
    for src, slot in ((rec, 0), (dis, 1)):
        for (year, cc, uc, name), v in src.items():
            per[(cc, uc)][slot] += v
            names[(cc, uc)] = name
            years[(cc, uc)].add(year)

    srows = []
    for key, (r, d) in per.items():
        dr = drift(r, d)
        if dr is not None:
            srows.append((dr, key, r, d))
    srows.sort(reverse=True)

    # A name collision would have merged two series under settlementDrift.py.
    dupe = [n for n, c in collections.Counter(names.values()).items() if c > 1]
    print(f'governments reporting settlement: {len(srows)}')
    print(f'  names shared by >1 government:   {len(dupe)}  {dupe[:5]}')

    sb = collections.Counter()
    for dr, *_ in srows:
        sb['<=0.1%' if dr <= 0.001 else '0.1-1%' if dr <= 0.01 else
           '1-2%' if dr <= 0.02 else '2-5%' if dr <= 0.05 else
           '5-20%' if dr <= 0.20 else '>20%'] += 1
    for b in ['<=0.1%', '0.1-1%', '1-2%', '2-5%', '5-20%', '>20%']:
        print(f'  series drift {b:8} {sb[b]:>4}')

    sover = [x for x in srows if x[0] > TOLERANCE]
    print()
    print(f'OVER {TOLERANCE:.0%} AT SERIES LEVEL: {len(sover)}')
    for dr, key, r, d in sover:
        cc, uc = key
        print(f'  {dr*100:6.2f}%  {names[key]:34} cc={cc} uc={uc}  '
              f'{min(years[key])}-{max(years[key])}')
        print(f'           in  ${r:>18,.2f}')
        print(f'           out ${d:>18,.2f}')
        print(f'           EXACT RESIDUE (out - in) ${d - r:>+18,.2f}')
    print()
