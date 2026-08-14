#!/usr/bin/env python3
"""Self-test for scripts/lib/acfrGF.py.

Pure-function tests over synthetic lines transcribed from the real PDFs, so
they run with no PDF, no pdftotext and no network. Run: py -3 scripts/lib/acfrGF.selftest.py
"""
import pathlib, sys, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from lib.acfrGF import CityConfig, column_value, classify, build_revenue, anchors

# Transcribed from City of Seattle FY2024 ACFR p56 (amounts in thousands).
SEA_TOTAL_REV = '     Total Revenues                                                         2,272,762     392,312         946,644        3,611,718'
SEA_PROPERTY  = '     Property Taxes                                        $                379,415    $  110,500      $  395,000     $  884,915'

# Synthetic second leaf, same column template as SEA_PROPERTY (verified against
# the same anchors() output) so it exercises a two-line tree without depending
# on a second real transcription.
SEA_SALES = '     Sales Tax                                             $                100,000    $   50,000      $   25,000     $    175,000'

class TestUnits(unittest.TestCase):
    def test_units_default_is_unscaled(self):
        cfg = CityConfig(city='X', parents=('current',))
        a = anchors(SEA_TOTAL_REV)
        self.assertEqual(column_value(SEA_PROPERTY, a, cfg), 379415)

    def test_units_thousands_scales_to_dollars(self):
        cfg = CityConfig(city='X', parents=('current',), units=1000)
        a = anchors(SEA_TOTAL_REV)
        self.assertEqual(column_value(SEA_PROPERTY, a, cfg), 379_415_000)

    def test_units_never_turns_absent_into_zero(self):
        cfg = CityConfig(city='X', parents=('current',), units=1000)
        a = anchors(SEA_TOTAL_REV)
        self.assertIsNone(column_value('     Some Label With No Numbers', a, cfg))

    # The three tests above all call column_value directly, so they cannot see
    # a DOUBLED multiplier: if classify() or a tree builder ever applied
    # cfg.units a second time on top of column_value's already-scaled result,
    # those three would still pass unchanged, the golden diff would still pass
    # (existing cities are units=1, and 1*1 == 1 either way), and extract()'s
    # own tie gate would still read $0 because both the computed sum and the
    # printed total would be doubled identically. A symmetric doubling is
    # invisible to both the tie gate and the golden diff by construction — the
    # two tests below are the only things in this repo that pin single
    # application at the layers callers actually consume.
    def test_units_applied_exactly_once_through_classify(self):
        cfg = CityConfig(city='X', parents=('current',), units=1000)
        a = anchors(SEA_TOTAL_REV)
        kind, lbl, val = classify(SEA_PROPERTY, a, cfg)
        self.assertEqual(kind, 'data')
        self.assertEqual(val, 379_415_000)

    def test_units_applied_exactly_once_through_build_revenue(self):
        cfg = CityConfig(city='X', parents=('current',), units=1000)
        a = anchors(SEA_TOTAL_REV)
        lines = ['Revenues', SEA_PROPERTY, SEA_SALES, SEA_TOTAL_REV]
        tree, total, zero_rows = build_revenue(lines, a, cfg)
        self.assertEqual(total, 479_415_000)
        leaf = next(c for c in tree['c'] if c['n'] == 'Property Taxes')
        self.assertEqual(leaf['a'], 379_415_000)

if __name__ == '__main__':
    unittest.main(verbosity=2)
