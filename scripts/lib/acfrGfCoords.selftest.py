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
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from acfrGfComponents import (  # noqa: E402
    collect, establish_column, EXP_BANNER, EXP_TOTAL,
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

    def test_a_tolerance_past_the_child_gap_DESTROYS_the_nesting(self):
        # ⚠ THE UPPER BOUND IS NOT DECORATION, and this is why the declared value
        # is 4.0 rather than "something comfortably large". The measured
        # root->child gap in this era is 3.67-4.08pt, so at tol=6.0 the shallower
        # children (84.74) fall INSIDE `Debt Service`'s own band: the group takes
        # nothing, is dropped childless, and Principal payments and Interest are
        # promoted to root categories.
        #
        # ⭐ WHAT CHANGED WHEN THE READER LEARNED MORE THAN TWO LEVELS. This case
        # used to be SILENT — the two-level walk mis-nested every row and still
        # reported no error, with a leaf sum identical to the correct reading, so
        # the tie landed at exactly $0 and nothing downstream could catch it.
        # Depth is now measured against the OPEN GROUP rather than the section
        # root, so `Current`'s children no longer fit inside anything and the
        # reader says so. run_cli exits 5 on a row error.
        tree, zeros, errors = build_operating_tree(self.ROWS, indent_tol=6.0)
        self.assertEqual(
            errors,
            ['indented row with no open parent: Customer Satisfaction and Management',
             'indented row with no open parent: Administrative Services'])
        self.assertEqual([n['n'] for n in tree],
                         ['Principal payments', 'Interest and fiscal charges'])
        self.assertIn('Debt Service', zeros)

        # ⚠ And it is loud TWICE over: the two dropped rows take $55,226,860 with
        # them, so the tie fails as well. Neither signal existed before.
        correct, _, _ = build_operating_tree(self.ROWS, indent_tol=4.0)
        self.assertEqual(leaf_sum(correct) - leaf_sum(tree), 9345322 + 45881538)


class TestNestedGroups(unittest.TestCase):
    """Town of Summerville SC — THREE printed levels, and a valued leaf at the
    MIDDLE one.

    ⚠⚠ WHY A TWO-LEVEL READER IS NOT SAFE HERE, even though it tied at $0 on
    all twelve extractions. The town prints

        Current:                       <- root heading
          General Government:          <- sub-heading, no money
            Administrative   3,563,324 <- leaf
          Culture and recreation
                             3,457,494 <- VALUED LEAF at the sub-heading level

    and a reader that only knows root/child drops the three valueless
    sub-headings and promotes their twelve children to `Current`. The multiset
    of leaves is unchanged, so `leaf_sum` is identical and the tie stays at
    exactly $0 while the published shape is the issuer's — the Boulder
    `revenue_parents`-without-members error in a new dress.

    Geometry below is REAL, transcribed from summerville_2024.pdf page 18
    (alignment right, column edge 440.29). Root spread is 0.07pt and the
    root -> sub gap is 6.5pt, so the module default tolerance reads it.
    """

    ROWS = [
        row('Current:', 44.27, 0, cell='blank'),
        row('General Government:', 50.75, 0, cell='blank'),
        row('Administrative', 57.23, 3563324),
        row('Planning and annexation', 57.22, 1493624),
        row('Engineering', 57.21, 822676),
        row('Municipal court', 57.21, 604718),
        row('Maintenance', 57.21, 862014),
        row('Public buildings and grounds', 57.21, 2952726),
        row('Housing and development', 57.21, 0, cell='blank'),
        row('Public Safety:', 50.72, 0, cell='blank'),
        row('Police', 57.21, 12887485),
        row('Fire', 57.20, 11297130),
        row('Communications', 57.20, 1885950),
        row('Roads and drainage:', 50.71, 0, cell='blank'),
        row('Street', 57.19, 2983854),
        row('Stormwater', 57.18, 0, cell='blank'),
        row('Culture and recreation', 50.70, 3457494),
        row('Capital outlay', 44.20, 3410013),
        row('Debt service:', 44.20, 0, cell='blank'),
        row('Principal', 50.69, 687709),
        row('Interest', 50.69, 155127),
    ]
    PRINTED_TOTAL = 47063844

    def _tree(self):
        tree, zeros, errors = build_operating_tree(self.ROWS)
        self.assertEqual(errors, [])
        return tree, zeros

    def test_reads_all_three_printed_levels(self):
        tree, _ = self._tree()
        self.assertEqual([n['n'] for n in tree],
                         ['Current', 'Capital outlay', 'Debt service'])
        current = tree[0]
        self.assertEqual([c['n'] for c in current['c']],
                         ['General Government', 'Public Safety',
                          'Roads and drainage', 'Culture and recreation'])
        self.assertEqual([g['n'] for g in current['c'][0]['c']],
                         ['Administrative', 'Planning and annexation', 'Engineering',
                          'Municipal court', 'Maintenance',
                          'Public buildings and grounds'])

    def test_a_VALUED_LEAF_at_the_sub_heading_level_stays_a_leaf(self):
        # `Culture and recreation` is printed at the same indent as
        # `General Government:` and carries money. It is a peer of the
        # sub-groups, not a child of the last one open.
        tree, _ = self._tree()
        culture = tree[0]['c'][3]
        self.assertNotIn('c', culture)
        self.assertEqual(culture['a'], 3457494)

    def test_a_sub_group_amount_is_the_sum_of_ITS_OWN_children(self):
        tree, _ = self._tree()
        gg = tree[0]['c'][0]
        self.assertEqual(gg['a'], sum(c['a'] for c in gg['c']))
        self.assertEqual(gg['a'], 10299082)
        self.assertEqual(tree[0]['a'], sum(c['a'] for c in tree[0]['c']))

    def test_the_root_leaf_and_the_root_group_after_it_are_unaffected(self):
        # `Capital outlay` closes `Current`; `Debt service:` opens again at root.
        tree, _ = self._tree()
        self.assertNotIn('c', tree[1])
        self.assertEqual([c['n'] for c in tree[2]['c']], ['Principal', 'Interest'])

    def test_a_valueless_row_with_nothing_beneath_it_is_dropped_not_published(self):
        # `Housing and development` and `Stormwater` print no money and nothing
        # deeper follows them, so they are absences, not $0 categories.
        tree, zeros = self._tree()
        self.assertIn('Housing and development', zeros)
        self.assertIn('Stormwater', zeros)
        names = []

        def walk(nodes):
            for n in nodes:
                names.append(n['n'])
                walk(n.get('c') or [])
        walk(tree)
        self.assertNotIn('Housing and development', names)
        self.assertNotIn('Stormwater', names)

    def test_THE_TIE_CANNOT_SEE_ANY_OF_THIS(self):
        # ⚠⚠ The whole reason the shape needs its own test: the leaf multiset is
        # identical either way, so both the correct three-level reading and the
        # flattened two-level one land on the printed total exactly.
        tree, _ = self._tree()
        self.assertEqual(leaf_sum(tree), self.PRINTED_TOTAL)


class TestWeldedLabelIndent(unittest.TestCase):
    """City of Charlotte FY2022/FY2023 — a WRAPPED label next to a $0 line item.

    ⚠⚠ WHY THIS NEEDS `collect` IN THE TEST AND NOT JUST SYNTHETIC ROWS. The
    page prints (real geometry, charlotte_fy2023.pdf, expenditure section):

        ind=75.00  dash   grid=1  0       'Culture and recreation'
        ind=75.00  blank  grid=0  0       'Community planning and'
        ind=85.00  number grid=1  36,701  'development'

    `weld='indent'` correctly joins the last two into one line item — and used
    to emit it carrying the CONTINUATION's indent, 85.00, because that is the
    row that holds the money. A two-level reader could not see the difference:
    everything below the root band was a child either way.

    Once the reader nests to any depth the issuer prints, it can: 85.00 is
    deeper than the $0 `Culture and recreation` above it, so that row opened a
    group and swallowed the welded item, publishing
    `Culture and recreation > Community planning and development` — a category
    the city never printed, holding another category's money, at a tie of
    exactly $0. A wrapped row belongs where its LABEL STARTS.
    """

    BOUND_X = 268.0          # label/column boundary; GF cells run x0=270..x1=300
    EDGES = (300.0, 380.0, 460.0)

    @staticmethod
    def _w(text, x0, x1):
        return {'text': text, 'x0': x0, 'x1': x1}

    @classmethod
    def _cells(cls, *vals):
        """One printed cell per fund column, right-aligned on its edge."""
        return [cls._w(v, e - 30.0, e) for v, e in zip(vals, cls.EDGES) if v is not None]

    @classmethod
    def _page(cls):
        w = cls._w
        return [
            [w('REVENUES', 65.0, 130.0)],
            [w('Property', 75.0, 110.0), w('taxes', 112.0, 140.0), *cls._cells('803,314', '10', '20')],
            [w('Total', 65.0, 95.0), w('revenues', 97.0, 150.0), *cls._cells('803,314', '10', '20')],
            [w('EXPENDITURES', 65.0, 150.0)],
            [w('Current-', 65.0, 110.0)],
            [w('Public', 75.0, 105.0), w('safety', 107.0, 140.0), *cls._cells('488,211', '1', '2')],
            [w('Culture', 75.0, 105.0), w('and', 107.0, 125.0), w('recreation', 127.0, 180.0),
             *cls._cells('-', '3', '4')],
            [w('Community', 75.0, 125.0), w('planning', 127.0, 170.0), w('and', 172.0, 190.0)],
            [w('development', 85.0, 145.0), *cls._cells('36,701', '5', '6')],
            [w('Debt', 65.0, 90.0), w('service-', 92.0, 135.0)],
            [w('Principal', 75.0, 120.0), *cls._cells('13,621', '7', '8')],
            [w('Total', 65.0, 95.0), w('expenditures', 97.0, 165.0), *cls._cells('538,533', '16', '20')],
        ]

    def _collect(self):
        rows = self._page()
        alignment, edge = establish_column(rows)
        self.assertEqual(alignment, 'right')
        comps, errs, welds = collect(rows, EXP_BANNER, EXP_TOTAL, alignment, edge, 1,
                                     weld='indent')
        self.assertEqual(errs, [])
        self.assertEqual(welds, ['Community planning and development'])
        return comps

    def test_a_welded_row_reports_the_indent_of_its_FIRST_printed_line(self):
        comps = self._collect()
        welded = [r for r in comps if r['label'] == 'Community planning and development']
        self.assertEqual(len(welded), 1)
        self.assertEqual(welded[0]['indent'], 75.0)
        self.assertEqual(welded[0]['amount'], 36701)

    def test_it_stays_a_SIBLING_of_the_zero_row_above_it(self):
        tree, zeros, errors = build_operating_tree(self._collect())
        self.assertEqual(errors, [])
        self.assertEqual([n['n'] for n in tree], ['Current-', 'Debt service-'])
        self.assertEqual([c['n'] for c in tree[0]['c']],
                         ['Public safety', 'Community planning and development'])
        # `Culture and recreation` prints an explicit dash: an absence, not a
        # parent and not a $0 category.
        self.assertIn('Culture and recreation', zeros)


class TestCleanLabel(unittest.TestCase):
    def test_strips_a_trailing_colon_only(self):
        self.assertEqual(clean_label('Debt service:'), 'Debt service')
        # ⚠ NOT the hyphen: for other loaders a trailing hyphen is a genuine word
        # break (Portland ships 'Debt Ser-'), so Charlotte's `Current-` is fixed
        # by a declared label_fixes entry instead of by widening this.
        self.assertEqual(clean_label('Current-'), 'Current-')


if __name__ == '__main__':
    unittest.main(verbosity=2)
