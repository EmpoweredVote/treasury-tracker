#!/usr/bin/env python3
"""Self-test for scripts/lib/acfrGF.py.

Pure-function tests over synthetic lines transcribed from the real PDFs, so
they run with no PDF, no pdftotext and no network. Run: py -3 scripts/lib/acfrGF.selftest.py
"""
import pathlib, sys, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from lib.acfrGF import (CityConfig, column_value, classify, build_revenue,
                         build_operating, anchors, slots, dash_zero_label,
                         find_statement_page, parse_fy, _is_section_header)

# Transcribed from King County FY2020-era GF statement (values thousands-scale
# in the real document; kept as bare ints here since these tests exercise
# revenue_parents/revenue_group_members, not units).
KC_REV_LINES = [
    'REVENUES',
    'Taxes:',
    'Property taxes                                   417,446    3,871    -',
    'Retail sales and use taxes                       196,647    -        4,569',
    'Licenses and permits                             6,915      -        -',
    'Total revenues                                   621,008    3,871    4,569',
]
KC_ANCHOR = 'Total revenues                                   621,008    3,871    4,569'

class TestRevenueParents(unittest.TestCase):
    def _cfg(self, parents=()):
        # revenue_group_members is what CLOSES the group: 'Retail sales and use
        # taxes' ends in 'taxes' so it stays inside, 'Licenses and permits' does
        # not so it closes the group and lands at root. Passing parents without
        # group members would close the group after its FIRST child.
        return CityConfig(city='X', parents=('current',), column_strategy='ordinal',
                          revenue_parents=parents,
                          revenue_group_members=('taxes',) if parents else ())

    def test_without_config_the_parent_label_is_glued_onto_its_child(self):
        tree, _, _ = build_revenue(KC_REV_LINES, anchors(KC_ANCHOR), self._cfg())
        self.assertEqual(tree['c'][0]['n'], 'Taxes Property taxes')

    def test_with_config_taxes_becomes_a_parent_node(self):
        tree, total, _ = build_revenue(KC_REV_LINES, anchors(KC_ANCHOR), self._cfg(('taxes',)))
        names = [c['n'] for c in tree['c']]
        self.assertEqual(names, ['Taxes', 'Licenses and permits'])
        taxes = tree['c'][0]
        self.assertEqual([c['n'] for c in taxes['c']], ['Property taxes', 'Retail sales and use taxes'])
        self.assertEqual(taxes['a'], 417446 + 196647)
        self.assertEqual(total, 417446 + 196647 + 6915)

    def test_parent_total_still_equals_the_flat_sum(self):
        flat, ftotal, _ = build_revenue(KC_REV_LINES, anchors(KC_ANCHOR), self._cfg())
        nested, ntotal, _ = build_revenue(KC_REV_LINES, anchors(KC_ANCHOR), self._cfg(('taxes',)))
        self.assertEqual(ftotal, ntotal)


# Fix round 1 / Critical 1: a group whose every genuine member is $0 (dash
# rows) never touches `parent['c']`, since $0 rows are recorded in zero_rows
# and dropped before reaching the child-append step. A close guard gated on
# `parent['c']` truthiness would therefore never fire, and the first
# unrelated row after the group ('Licenses and permits') would be silently
# swallowed into 'Taxes' instead of closing it and landing at root.
ALL_ZERO_TAXES_LINES = [
    'REVENUES',
    'Taxes:',
    'Property taxes                                   --       --       --',
    'Retail sales and use taxes                        --       --       --',
    'Licenses and permits                              6,915    -        -',
    'Total revenues                                    6,915    -        -',
]
ALL_ZERO_TAXES_ANCHOR = 'Total revenues                                    6,915    -        -'

class TestRevenueParentsAllZeroMembers(unittest.TestCase):
    def _cfg(self):
        return CityConfig(city='X', parents=('current',), column_strategy='ordinal',
                          revenue_parents=('taxes',), revenue_group_members=('taxes',))

    def test_licenses_and_permits_lands_at_root_when_taxes_group_is_all_zero(self):
        tree, total, zero_rows = build_revenue(
            ALL_ZERO_TAXES_LINES, anchors(ALL_ZERO_TAXES_ANCHOR), self._cfg())
        names = [c['n'] for c in tree['c']]
        self.assertEqual(names, ['Licenses and permits'])
        self.assertEqual(total, 6915)

    def test_taxes_is_dropped_as_childless_when_every_member_is_zero(self):
        tree, _, _ = build_revenue(
            ALL_ZERO_TAXES_LINES, anchors(ALL_ZERO_TAXES_ANCHOR), self._cfg())
        self.assertNotIn('Taxes', [c['n'] for c in tree['c']])

    def test_all_zero_dashed_members_are_recorded_in_zero_rows(self):
        _, _, zero_rows = build_revenue(
            ALL_ZERO_TAXES_LINES, anchors(ALL_ZERO_TAXES_ANCHOR), self._cfg())
        self.assertIn('Property taxes', zero_rows)
        self.assertIn('Retail sales and use taxes', zero_rows)


# Fix round 1 / Critical 2: `_DASH_ROW`'s dashes group only ever matched ONE
# dash character per repetition, so it recognised King County's single '-'
# placeholder but not Seattle's '--'. When it fails to match, `classify`
# falls through to the wrapped-label branch and the row's label gets glued
# onto the NEXT real row instead of being recorded as a genuine $0 row.
class TestDashZeroLabelMultiDash(unittest.TestCase):
    def test_single_dash_placeholders_are_recognised(self):
        self.assertEqual(
            dash_zero_label('Property taxes    -     -     -'), 'Property taxes')

    def test_double_dash_placeholders_are_recognised(self):
        self.assertEqual(
            dash_zero_label('Property taxes    --    --    --'), 'Property taxes')

    def test_en_dash_and_em_dash_runs_are_recognised(self):
        self.assertEqual(
            dash_zero_label('Property taxes    ––   ——'), 'Property taxes')


# Fix round 1 / Critical 2, reproduced through the full expenditure-tree path
# (not just dash_zero_label directly): a Seattle-style '--' all-dash row
# inside an open expenditure group must be classified as data-zero and must
# NOT glue its label onto the following real row.
EXP_LINES_WITH_DOUBLE_DASH_ROW = [
    'EXPENDITURES',
    'Capital Outlay:',
    'Judicial                                          53,392',
    'Public Safety                                     898',
    'Physical Environment                              --      --      --',
    'Transportation                                    6,880',
    'Total expenditures                                61,170',
]

class TestDoubleDashRowDoesNotGlue(unittest.TestCase):
    def test_double_dash_row_is_data_zero_and_does_not_glue_onto_next_label(self):
        cfg = CityConfig(city='X', parents=('current', 'capital outlay'),
                          column_strategy='ordinal')
        anchor = 'Total expenditures                                61,170'
        tree, _, zero_rows = build_operating(
            EXP_LINES_WITH_DOUBLE_DASH_ROW, anchors(anchor), cfg)
        capital_outlay = next(c for c in tree['c'] if c['n'] == 'Capital Outlay')
        names = [c['n'] for c in capital_outlay['c']]
        self.assertEqual(names, ['Judicial', 'Public Safety', 'Transportation'])
        transportation = next(c for c in capital_outlay['c'] if c['n'] == 'Transportation')
        self.assertEqual(transportation['a'], 6880)
        self.assertIn('Physical Environment', zero_rows)

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

# Transcribed from King County FY2018 ACFR p43. `4,034` and `8,075` are the two
# General Fund values that render nearer column 1's anchor than column 0's --
# the positional reader drops them and the FY is short by exactly 12,109.
KC_TOTAL_REV = 'TOTAL REVENUES                                   863,031                                 297,708            1,135,158        2,295,897'
KC_BUSINESS  = 'Business and other taxes                                                       4,034                 17     18,190           22,241'
KC_RETAIL    = 'Retail sales and use taxes                       144,422                                             --     99,735           244,157'
KC_PHYSICAL  = 'Physical environment                                                           --                    --     21,278           21,278'

class TestOrdinalColumns(unittest.TestCase):
    def test_positional_reader_drops_the_ragged_value(self):
        cfg = CityConfig(city='X', parents=('current',))
        self.assertNotEqual(column_value(KC_BUSINESS, anchors(KC_TOTAL_REV), cfg), 4034)

    def test_ordinal_reader_recovers_the_ragged_value(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value(KC_BUSINESS, anchors(KC_TOTAL_REV), cfg), 4034)

    def test_ordinal_counts_a_dash_as_an_occupied_column(self):
        # GF is present (144,422); the dash marks the BLANK second column. If
        # dashes were skipped, 99,735 would slide left and GF would be wrong.
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value(KC_RETAIL, anchors(KC_TOTAL_REV), cfg), 144422)

    def test_ordinal_reads_a_leading_dash_as_zero(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value(KC_PHYSICAL, anchors(KC_TOTAL_REV), cfg), 0)

    def test_ordinal_composes_with_units(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal', units=1000)
        self.assertEqual(column_value(KC_BUSINESS, anchors(KC_TOTAL_REV), cfg), 4_034_000)

    def test_hyphenated_label_is_not_read_as_a_column(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value('Non-departmental                    12,500    3,000', anchors(KC_TOTAL_REV), cfg), 12500)


# Fix round 1: `_SLOT` was treating a PROSE hyphen (single space on each side,
# as in "Debt Service - Principal" -- the very example norm_label's own
# docstring cites as a label that must survive intact) as a column slot. That
# read a fake leading $0 column and truncated the label at the hyphen. The fix
# requires COLUMN spacing (2+ spaces, or line start/end) on both sides of a
# dash-run before it counts as a slot; a single-spaced hyphen is prose and is
# left entirely alone, same as an unspaced one.
class TestProseHyphenNotAColumn(unittest.TestCase):
    def test_prose_hyphen_with_dash_service_label_is_not_a_column(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        line = 'Debt Service - Principal          12,500     3,000'
        self.assertEqual(column_value(line, anchors(KC_TOTAL_REV), cfg), 12500)
        kind, lbl, val = classify(line, anchors(KC_TOTAL_REV), cfg)
        self.assertEqual(lbl, 'Debt Service - Principal')
        self.assertEqual(val, 12500)

    def test_prose_hyphen_with_transfers_label_is_not_a_column(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        line = 'Transfers In - General Fund   4,200   100'
        self.assertEqual(column_value(line, anchors(KC_TOTAL_REV), cfg), 4200)
        kind, lbl, val = classify(line, anchors(KC_TOTAL_REV), cfg)
        self.assertEqual(lbl, 'Transfers In - General Fund')
        self.assertEqual(val, 4200)

    def test_dash_placeholder_still_counts_as_slot_after_prose_hyphen_fix(self):
        # Non-regression: the King County fixtures that proved dash-as-slot
        # counting in the first place must still tie the same way.
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value(KC_RETAIL, anchors(KC_TOTAL_REV), cfg), 144422)
        self.assertEqual(column_value(KC_PHYSICAL, anchors(KC_TOTAL_REV), cfg), 0)

    def test_four_or_more_dash_run_counts_as_exactly_one_slot(self):
        line = 'Some label          ----                 12,500'
        self.assertEqual(slots(line), [0, 12500])

    def test_low_income_housing_hyphen_is_not_read_as_a_column(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(
            column_value('Low-Income Housing                    61,498    3,000', anchors(KC_TOTAL_REV), cfg),
            61498)


# Seattle FY2009 p68 -- "Page 1 of 2" is printed BETWEEN "AND CHANGES" and
# "IN FUND BALANCES", so the title regex cannot span the wrap.
SEA2009_PAGE = '\n'.join([
    'The City                 of  Seattle', '',
    'B-4                                STATEMENT OF REVENUES, EXPENDITURES, AND                 CHANGES', '',
    'Page 1 of 2                                           IN FUND BALANCES', '',
    '                                                      GOVERNMENTAL FUNDS', '',
    '                                          For the Year Ended December 31, 2009', '',
    '                                                            General         Transportation', '',
    'REVENUES', 'Taxes                          756,909    63,321',
    'Total Revenues                 942,408    167,604',
    'EXPENDITURES', 'General Government             100,000    5,000',
    'Total Expenditures             737,604    277,816',
])
# Seattle FY2024 p56 -- the REVENUES line also carries the fund column headers.
SEA2024_REV_HEADER = '     REVENUES                                                 General Fund             Transportation  Governmental      2024'

class TestPageAndHeaders(unittest.TestCase):
    def test_title_regex_alone_cannot_find_the_2009_page(self):
        self.assertEqual(find_statement_page([SEA2009_PAGE], None)[0], None)

    def test_schedule_id_anchor_finds_the_2009_page(self):
        self.assertEqual(find_statement_page([SEA2009_PAGE], r'^\s*B-4\b')[0], 0)

    def test_exact_header_mode_rejects_a_header_carrying_column_titles(self):
        self.assertFalse(_is_section_header(SEA2024_REV_HEADER.strip(), 'revenues', 'exact'))

    def test_prefix_header_mode_accepts_it(self):
        self.assertTrue(_is_section_header(SEA2024_REV_HEADER.strip(), 'revenues', 'prefix'))

    def test_prefix_mode_still_rejects_the_wrapped_statement_title(self):
        # Trap 2: a prefix match on the wrapped title would open the expenditure
        # section at the TITLE and swallow the entire revenue block.
        self.assertFalse(_is_section_header(
            'EXPENDITURES, AND CHANGES IN FUND BALANCES', 'expenditures', 'prefix'))

    def test_december_fiscal_year_end_is_read_from_the_document(self):
        self.assertEqual(parse_fy([SEA2009_PAGE], 'no-year-in-this-path.pdf', ('December', 31)), 2009)

    def test_june_remains_the_default(self):
        page = 'For the Fiscal Year Ended June 30, 2025'
        self.assertEqual(parse_fy([page], 'x.pdf', ('June', 30)), 2025)


# Fix round 1: the original prefix-mode guard only rejected a title wrap that
# happened to land the "changes in fund" phrase on the SAME line as the
# section word. A wrap at a different point leaves the section word bare or
# followed only by more title punctuation, which the phrase-only guard could
# not see. This never fired on any Seattle document inspected -- their title
# lines all begin "B-4 STATEMENT OF REVENUES..." so the section word is never
# bare -- and a real misfire would inflate the total and fail the tie loudly
# rather than ship silently. Hardened anyway ahead of Task 7's sweep of 17
# Seattle documents, of which only 5 have been inspected so far.
#
# Tests 1/2/3 are wraps that must be REJECTED; tests 4/5 are the real Seattle
# captions that must still be ACCEPTED. The boundary between them is the
# entire content of this round.
class TestSectionHeaderPrefixGuard(unittest.TestCase):
    def test_comma_led_remainder_is_a_title_continuation_not_a_caption(self):
        self.assertFalse(_is_section_header('EXPENDITURES,', 'expenditures', 'prefix'))

    def test_multi_word_comma_led_remainder_is_also_a_title_continuation(self):
        self.assertFalse(_is_section_header(
            'REVENUES, EXPENDITURES, AND', 'revenues', 'prefix'))

    def test_singular_fund_balance_wrap_fragment_is_rejected(self):
        # Tigard's statement titles "CHANGES IN FUND BALANCE" in the SINGULAR
        # (already documented above `_TITLE`); a wrap that puts the section
        # word next to the singular form, without ever spelling out
        # "changes in fund" on this same line, must still be caught.
        self.assertFalse(_is_section_header(
            'EXPENDITURES AND FUND BALANCE', 'expenditures', 'prefix'))

    def test_real_seattle_revenue_header_with_column_captions_is_still_accepted(self):
        # The non-regression that matters: if this is rejected, Seattle
        # FY2024/25 revenue goes back to an empty tree.
        header = 'REVENUES                                                 General Fund             Transportation  Governmental      2024'
        self.assertTrue(_is_section_header(header.strip(), 'revenues', 'prefix'))

    def test_bare_section_word_still_opens_the_section(self):
        # Seattle FY2024 prints its expenditure header as bare "EXPENDITURES"
        # with no trailing caption at all.
        self.assertTrue(_is_section_header('EXPENDITURES', 'expenditures', 'prefix'))


# Fix round 2: round 1's guard was still an ENUMERATED set of substring
# checks tuned to the two wraps quoted at the time, and a wrap one word
# earlier or later evaded all three of them simultaneously -- the remainder
# contains a real word (not punctuation-only), is not comma-led, and
# 'changesinfund'/'fundbalance' is not yet contiguous because the wrap
# severs the phrase before "IN FUND" joins up:
#   _is_section_header('EXPENDITURES AND CHANGES', 'expenditures', 'prefix')     -> was True, must be False
#   _is_section_header('EXPENDITURES AND CHANGES IN', 'expenditures', 'prefix')  -> was True, must be False
#   _is_section_header('EXPENDITURES AND CHANGE', 'expenditures', 'prefix')      -> was True, must be False
# Chasing this with more substrings does not converge. Fix round 2 replaces
# the enumeration with a STRUCTURAL rule: a genuine table caption is
# separated from the section word by a COLUMN GAP (2+ spaces), the same
# signal `_SLOT` relies on elsewhere in this module; a wrapped title is
# single-spaced prose no matter where it is cut. See `_is_section_header`'s
# docstring for the full reasoning.
#
# SEA2024_REV_HEADER (used below) is a byte-for-byte transcription of the
# real REVENUES header line on Seattle FY2024 ACFR p56 -- read directly from
# `pdftotext -table` output against the actual PDF (confirmed against the
# live document as part of this fix round), not retyped from memory, so this
# test cannot silently drift from what the real document contains.
class TestSectionHeaderPrefixGuardRound2(unittest.TestCase):
    def test_wrap_one_word_earlier_is_rejected(self):
        self.assertFalse(_is_section_header('EXPENDITURES AND CHANGES', 'expenditures', 'prefix'))

    def test_wrap_two_words_earlier_is_rejected(self):
        self.assertFalse(_is_section_header('EXPENDITURES AND CHANGES IN', 'expenditures', 'prefix'))

    def test_wrap_at_a_different_word_entirely_is_rejected(self):
        self.assertFalse(_is_section_header('EXPENDITURES AND CHANGE', 'expenditures', 'prefix'))

    def test_wrap_one_word_later_is_still_rejected(self):
        # Not a new bypass (round 1's 'changesinfund' substring already
        # caught this one) -- kept here as the boundary neighbour of the
        # three genuine bypasses above, so the whole family is visible in
        # one place.
        self.assertFalse(_is_section_header(
            'EXPENDITURES AND CHANGES IN FUND', 'expenditures', 'prefix'))

    def test_other_financing_sources_caption_fragment_is_rejected(self):
        self.assertFalse(_is_section_header(
            'REVENUES AND OTHER FINANCING SOURCES', 'revenues', 'prefix'))

    def test_other_financing_uses_caption_fragment_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES AND OTHER FINANCING USES', 'expenditures', 'prefix'))

    def test_real_seattle_revenue_header_read_from_the_pdf_is_accepted(self):
        self.assertTrue(_is_section_header(SEA2024_REV_HEADER.strip(), 'revenues', 'prefix'))

    def test_bare_revenues_accepts(self):
        self.assertTrue(_is_section_header('REVENUES', 'revenues', 'prefix'))

    def test_bare_expenditures_accepts(self):
        self.assertTrue(_is_section_header('EXPENDITURES', 'expenditures', 'prefix'))

    def test_trailing_colon_variant_accepts(self):
        self.assertTrue(_is_section_header('REVENUES:', 'revenues', 'prefix'))

    def test_trailing_dollar_sign_variant_accepts(self):
        self.assertTrue(_is_section_header('EXPENDITURES $', 'expenditures', 'prefix'))

    def test_trailing_colon_and_dollar_sign_variant_accepts(self):
        self.assertTrue(_is_section_header('EXPENDITURES:  $', 'expenditures', 'prefix'))

    def test_single_space_prose_remainder_rejects_generically(self):
        # Not one of the two named title wraps and not on any enumerated
        # list -- a made-up caption-shaped sentence that happens to be
        # single-spaced prose. Proves the rule is structural (spacing), not
        # a list of known title forms.
        self.assertFalse(_is_section_header(
            'REVENUES OF THE GENERAL FUND', 'revenues', 'prefix'))


# Fix round 3: round 2's column-gap premise -- that `pdftotext -table` only
# ever puts a 2+-space gap where there is a real table column -- is FALSE.
# `SEA2009_PAGE` above, transcribed from the real Seattle FY2009 output,
# already contains a 2+-space gap INSIDE THE TITLE:
#   'B-4                                STATEMENT OF REVENUES, EXPENDITURES, AND                 CHANGES'
# ("AND" and "CHANGES" are separated by seventeen spaces.) So a double space
# defeated round 2's guard on exactly the kind of wrap it was built to catch:
#   _is_section_header('EXPENDITURES  AND CHANGES', 'expenditures', 'prefix')          -> was True, must be False
#   _is_section_header('REVENUES  AND OTHER FINANCING SOURCES', 'revenues', 'prefix')  -> was True, must be False
#   _is_section_header('EXPENDITURES  OF THE GENERAL FUND', 'expenditures', 'prefix')  -> was True, must be False
# Round 3 adds a second, independent discriminator: after the column-gap
# check passes, also reject when the remainder's first word is a CONNECTIVE
# ("and", "of", "in", ...) rather than a caption noun. This is layered
# defence, not a proof -- see the comment above `_is_section_header` for
# what happens if some future document ever evades every layer (the tie
# gate fails loudly rather than shipping a silently wrong total).
class TestSectionHeaderPrefixGuardRound3(unittest.TestCase):
    def test_double_space_before_and_changes_is_rejected(self):
        self.assertFalse(_is_section_header('EXPENDITURES  AND CHANGES', 'expenditures', 'prefix'))

    def test_triple_space_before_and_change_is_rejected(self):
        self.assertFalse(_is_section_header('EXPENDITURES   AND CHANGE', 'expenditures', 'prefix'))

    def test_double_space_before_and_other_financing_sources_is_rejected(self):
        self.assertFalse(_is_section_header(
            'REVENUES  AND OTHER FINANCING SOURCES', 'revenues', 'prefix'))

    def test_double_space_before_of_the_general_fund_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  OF THE GENERAL FUND', 'expenditures', 'prefix'))

    def test_double_space_before_changes_in_fund_balances_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  CHANGES IN FUND BALANCES', 'expenditures', 'prefix'))

    def test_double_space_before_in_fund_balances_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  IN FUND BALANCES', 'expenditures', 'prefix'))

    def test_generic_double_space_connective_not_on_any_named_list_is_rejected(self):
        # Not one of the coordinator's named phrases -- a made-up
        # double-spaced connective sentence, proving the rule is about
        # connectives generically rather than a list of known captions.
        self.assertFalse(_is_section_header(
            'REVENUES  FOR THE YEAR ENDED', 'revenues', 'prefix'))

    def test_real_seattle_revenue_header_still_accepted_after_round_3(self):
        # Read from the PDF, not retyped (SEA2024_REV_HEADER above is a
        # byte-for-byte transcription of the real pdftotext -table output).
        self.assertTrue(_is_section_header(SEA2024_REV_HEADER.strip(), 'revenues', 'prefix'))

    def test_bare_revenues_still_accepted_after_round_3(self):
        self.assertTrue(_is_section_header('REVENUES', 'revenues', 'prefix'))

    def test_bare_expenditures_still_accepted_after_round_3(self):
        self.assertTrue(_is_section_header('EXPENDITURES', 'expenditures', 'prefix'))

    def test_trailing_colon_variant_still_accepted_after_round_3(self):
        self.assertTrue(_is_section_header('REVENUES:', 'revenues', 'prefix'))

    def test_trailing_dollar_sign_variant_still_accepted_after_round_3(self):
        self.assertTrue(_is_section_header('EXPENDITURES $', 'expenditures', 'prefix'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
