#!/usr/bin/env python3
"""
Self-test for the COORDINATE reader's per-entity declarations.

⚠ WHY THIS FILE EXISTS. `acfrGfCoords.py` had no test of its own — it was
exercised only indirectly, by running a real PDF and seeing whether the tie came
out at $0. That is exactly the check these declarations are INVISIBLE to: a
wrong `label_fixes` entry, a `collapse_children` that swallows a real line item
and a mis-sized `indent_tol` all leave the tie at exactly $0 while changing what
gets published.

Everything here is a pure function over synthetic rows. No PDF, no database, no
network — so it runs in milliseconds and there is no excuse not to.

Run:  npm run test:acfr        (runs this and acfrGF.selftest.py)
"""

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from acfrGfCoords import (  # noqa: E402
    INDENT_TOL, CoordsConfig, apply_label_fixes, clean_label,
    collapse_declared_children, build_operating_tree, leaf_sum,
)


def row(label, indent, amount, cell='number'):
    return {'label': label, 'indent': indent, 'amount': amount, 'cell': cell}


class TestCoordsConfigValidation(unittest.TestCase):
    def test_units_must_be_an_int(self):
        with self.assertRaises(TypeError):
            CoordsConfig(city='X', units=1000.0)

    def test_weld_vocabulary_is_closed(self):
        CoordsConfig(city='X', weld=None)
        CoordsConfig(city='X', weld='disclosure')
        CoordsConfig(city='X', weld='indent')
        with self.assertRaises(ValueError):
            CoordsConfig(city='X', weld='wrap')

    def test_indent_tol_defaults_and_overrides(self):
        self.assertEqual(CoordsConfig(city='X').indent_tol, INDENT_TOL)
        self.assertEqual(CoordsConfig(city='X', indent_tol=4.0).indent_tol, 4.0)

    def test_indent_tol_refuses_a_nonsense_value(self):
        # A zero or negative tolerance would put every row outside the root band.
        for bad in (0, -1):
            with self.assertRaises(ValueError):
                CoordsConfig(city='X', indent_tol=bad)

    def test_label_fixes_refuse_a_no_op(self):
        # A rule that asserts nothing is worse than no rule: it reads as coverage.
        with self.assertRaises(ValueError):
            CoordsConfig(city='X', label_fixes={'Taxes': 'Taxes'})

    def test_label_fixes_refuse_an_empty_side(self):
        with self.assertRaises(ValueError):
            CoordsConfig(city='X', label_fixes={'Taxes': ''})


class TestLabelFixes(unittest.TestCase):
    """Mecklenburg FY2006 fuses its words; FY2025 wraps a label."""

    def test_renames_a_root_node_and_reports_it(self):
        tree = [{'n': 'Administrativecharges', 'a': 10}]
        applied = set()
        apply_label_fixes(tree, {'Administrativecharges': 'Administrative charges'}, applied)
        self.assertEqual(tree[0]['n'], 'Administrative charges')
        self.assertEqual(applied, {'Administrativecharges'})

    def test_renames_a_CHILD_node(self):
        # The FY2006 defect reached line items as well as categories.
        tree = [{'n': 'Current', 'a': 10, 'c': [{'n': 'BusinessPartners', 'a': 10}]}]
        apply_label_fixes(tree, {'BusinessPartners': 'Business Partners'}, set())
        self.assertEqual(tree[0]['c'][0]['n'], 'Business Partners')

    def test_leaves_an_undeclared_label_alone(self):
        tree = [{'n': 'Taxes', 'a': 10}]
        apply_label_fixes(tree, {'Other': 'Something'}, set())
        self.assertEqual(tree[0]['n'], 'Taxes')

    def test_never_changes_an_amount(self):
        tree = [{'n': 'DebtService', 'a': 12345, 'c': [{'n': 'Principalpayments', 'a': 12345}]}]
        before = leaf_sum(tree)
        apply_label_fixes(tree, {'DebtService': 'Debt Service',
                                 'Principalpayments': 'Principal payments'}, set())
        self.assertEqual(leaf_sum(tree), before)

    def test_an_unfired_fix_is_visible_to_the_caller(self):
        # run_cli reports `set(fixes) - applied` so a stale rule can be seen.
        applied = set()
        apply_label_fixes([{'n': 'Taxes', 'a': 1}], {'Gone': 'Went'}, applied)
        self.assertEqual(set({'Gone': 'Went'}) - applied, {'Gone'})


class TestCollapseChildren(unittest.TestCase):
    """Mecklenburg FY2025: a wrapped label read as a one-child parent."""

    def test_collapses_a_declared_single_child_parent(self):
        tree = [{'n': 'Customer satisfaction and management', 'a': 40249095,
                 'c': [{'n': 'management', 'a': 40249095}]}]
        collapsed = set()
        collapse_declared_children(tree, {'Customer satisfaction and management'}, collapsed)
        self.assertNotIn('c', tree[0])
        self.assertEqual(tree[0]['a'], 40249095)
        self.assertEqual(collapsed, {'Customer satisfaction and management'})

    def test_REFUSES_when_the_node_has_more_than_one_child(self):
        # A genuine group heading must never be flattened. If Mecklenburg ever
        # prints a second function under this name, this raises rather than
        # silently discarding it.
        tree = [{'n': 'Debt Service', 'a': 3,
                 'c': [{'n': 'Principal', 'a': 1}, {'n': 'Interest', 'a': 2}]}]
        with self.assertRaises(ValueError):
            collapse_declared_children(tree, {'Debt Service'}, set())

    def test_REFUSES_when_the_child_amount_disagrees(self):
        tree = [{'n': 'X', 'a': 10, 'c': [{'n': 'y', 'a': 9}]}]
        with self.assertRaises(ValueError):
            collapse_declared_children(tree, {'X'}, set())

    def test_leaves_undeclared_parents_alone(self):
        tree = [{'n': 'Current', 'a': 5, 'c': [{'n': 'Public safety', 'a': 5}]}]
        collapse_declared_children(tree, {'Something else'}, set())
        self.assertIn('c', tree[0])

    def test_does_not_move_money(self):
        tree = [{'n': 'X', 'a': 7, 'c': [{'n': 'y', 'a': 7}]}]
        before = leaf_sum(tree)
        collapse_declared_children(tree, {'X'}, set())
        self.assertEqual(leaf_sum(tree), before)


class TestIndentTolerance(unittest.TestCase):
    """Mecklenburg FY2005-FY2011 print `Current` ~2pt deeper than its siblings."""

    # Real geometry, FY2007: EXPENDITURES banner 75.24, `Current` 80.94,
    # its children 86.65, `Debt Service` 79.04, its children 84.74,
    # `Capital Outlay` 79.05.
    ROWS = [
        row('Current', 80.94, 0, cell='blank'),
        row('Customer Satisfaction and Management', 86.65, 9345322),
        row('Administrative Services', 86.64, 45881538),
        row('Debt Service', 79.04, 0, cell='blank'),
        row('Principal payments', 84.74, 135516690),
        row('Interest and fiscal charges', 84.74, 87035795),
        row('Capital Outlay', 79.05, 0, cell='dash'),
    ]

    def test_the_DEFAULT_tolerance_cannot_read_this_era(self):
        # min(indent) is 79.04, so with tol=1.5 the root band ends at 80.54 and
        # `Current` (80.94) reads as a child with no parent open. This is the
        # failure the per-entity value exists to fix; pinning it here keeps the
        # justification honest.
        _, _, errors = build_operating_tree(self.ROWS, indent_tol=INDENT_TOL)
        self.assertTrue(any('no open parent' in e for e in errors), errors)

    def test_the_DECLARED_tolerance_reads_it_correctly(self):
        tree, _, errors = build_operating_tree(self.ROWS, indent_tol=4.0)
        self.assertEqual(errors, [])
        names = [n['n'] for n in tree]
        self.assertEqual(names, ['Current', 'Debt Service'])
        self.assertEqual([c['n'] for c in tree[0]['c']],
                         ['Customer Satisfaction and Management', 'Administrative Services'])
        self.assertEqual([c['n'] for c in tree[1]['c']],
                         ['Principal payments', 'Interest and fiscal charges'])

    def test_a_tolerance_past_the_child_gap_DESTROYS_the_nesting_SILENTLY(self):
        # ⚠ THE UPPER BOUND IS NOT DECORATION, and this is why the declared value
        # is 4.0 rather than "something comfortably large". The measured
        # root->child gap in this era is 3.67-4.08pt, so at tol=6.0 the shallower
        # children (84.74) fall INSIDE the root band: `Debt Service` loses both
        # of its children, ends up childless and is DROPPED, while Principal
        # payments and Interest are promoted to root categories.
        #
        # It reports NO error and the leaf sum is UNCHANGED, so the tie still
        # lands at exactly $0. Nothing downstream could catch it.
        tree, zeros, errors = build_operating_tree(self.ROWS, indent_tol=6.0)
        self.assertEqual(errors, [], 'the damage is silent — that is the point')
        self.assertEqual([n['n'] for n in tree],
                         ['Current', 'Principal payments', 'Interest and fiscal charges'])
        self.assertIn('Debt Service', zeros)

        # And the arithmetic is identical to the correct reading, which is
        # exactly why a tie cannot be used to choose a tolerance.
        correct, _, _ = build_operating_tree(self.ROWS, indent_tol=4.0)
        self.assertEqual(leaf_sum(tree), leaf_sum(correct))


class TestCleanLabel(unittest.TestCase):
    def test_strips_a_trailing_colon_only(self):
        self.assertEqual(clean_label('Debt service:'), 'Debt service')
        # ⚠ NOT the hyphen: for other loaders a trailing hyphen is a genuine word
        # break (Portland ships 'Debt Ser-'), so Charlotte's `Current-` is fixed
        # by a declared label_fixes entry instead of by widening this.
        self.assertEqual(clean_label('Current-'), 'Current-')


if __name__ == '__main__':
    unittest.main(verbosity=2)
