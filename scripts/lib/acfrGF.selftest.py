#!/usr/bin/env python3
"""Self-test for scripts/lib/acfrGF.py.

Pure-function tests over synthetic lines transcribed from the real PDFs, so
they run with no PDF, no pdftotext and no network. Run: py -3 scripts/lib/acfrGF.selftest.py
"""
import pathlib, sys, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from lib.acfrGF import (CityConfig, column_value, classify, build_revenue,
                         build_operating, anchors, slots, dash_zero_label,
                         find_statement_page, parse_fy, _is_section_header,
                         _recover_label_past_leading_page_number)
# The SHIPPED Bainbridge configs themselves, not copies of them -- see
# TestShippedBainbridgeConfigsAreWholeDollars at the bottom of this file for
# why the real objects have to be under test rather than a local fixture.
# Both modules define CONFIG at import time and only call run_cli under
# `if __name__ == '__main__'`, so importing them here runs no extraction.
import extractBainbridge          # noqa: E402
import extractBainbridgeEarly     # noqa: E402

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

    # Fix round 1 (King County FY2024/FY2025): pdftotext rendered the
    # transmittal letter's own correct self-reference as "...year ended
    # December31, 2024." with no space before the day. The un-widened regex
    # required at least one space and so never matched it, which is what let
    # the whole-document scan reach a later, correctly-spaced but WRONG-year
    # GFOA-award mention instead. Confirmed live on the real 2024/2025 PDFs.
    def test_dropped_space_before_the_day_still_parses(self):
        page = 'for the fiscal year ended December31, 2024.'
        self.assertEqual(parse_fy([page], 'x.pdf', ('December', 31)), 2024)

    def test_dropped_space_also_tolerated_for_the_june_default(self):
        page = 'For the Fiscal Year Ended June30, 2025'
        self.assertEqual(parse_fy([page], 'x.pdf', ('June', 30)), 2025)

    # Fix round 1: the STATEMENT PAGE's own caption must win over anything
    # else in the document, because a whole-document scan can be correct
    # about a year that isn't the one being extracted. This reproduces the
    # King County FY2024 shape: page 0 (an earlier page, e.g. the GFOA-award
    # paragraph) truthfully states the PRIOR year, 2023; the statement page
    # truthfully states the CURRENT year, 2024. Before this fix, `parse_fy`
    # had no way to prefer the statement page and returned 2023.
    def test_statement_page_year_wins_over_an_earlier_pages_different_year(self):
        earlier_page_wrong_year = (
            'Reporting to King County for its annual comprehensive financial '
            'report for the fiscal year ended December 31, 2023.')
        statement_page_right_year = (
            'STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES\n'
            'FOR THE YEAR ENDED DECEMBER 31, 2024')
        self.assertEqual(
            parse_fy([earlier_page_wrong_year, statement_page_right_year],
                     'kingcounty-2024-acfr.pdf', ('December', 31),
                     statement_page=statement_page_right_year),
            2024)

    def test_statement_page_absent_falls_back_to_whole_document_scan(self):
        # Non-regression: when no statement_page is passed (or it states no
        # period of its own), the old whole-document-scan behavior is
        # unchanged -- this is what the 8 already-loaded June-30 cities and
        # Seattle relied on before this fix, and the golden baseline pins it.
        page = 'For the Fiscal Year Ended June 30, 2025'
        self.assertEqual(parse_fy([page], 'x.pdf', ('June', 30), statement_page=None), 2025)


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


# Fix round 4: round 3's connective check (layer 5) only fired when the
# remainder's first non-space TOKEN parsed as lowercase letters. When
# punctuation or a digit came first, the match returned None, the check was
# silently skipped, and control fell through to an unconditional ACCEPT --
# a guard layer that cannot reach a verdict must not silently grant one:
#   _is_section_header('EXPENDITURES   - BUDGET AND ACTUAL', 'expenditures', 'prefix')         -> was True, must be False
#   _is_section_header('EXPENDITURES  (BUDGETARY BASIS) AND CHANGES', 'expenditures', 'prefix') -> was True, must be False
#   _is_section_header('EXPENDITURES  "BUDGETARY BASIS" SCHEDULE', 'expenditures', 'prefix')    -> was True, must be False
# (Every one of these is also independently blocked by `find_statement_page`'s
# `_EXCLUDE` list, which already keeps a budgetary/budget-and-actual PAGE
# from ever being selected as the primary statement -- so this was a design
# flaw worth closing on its own merits, not a live data risk.)
#
# The fix must NOT fail closed on every non-word lead: a DIGIT lead is a
# real, legitimate column-caption shape ("REVENUES   2024   2023" in a
# comparative statement) and must stay accepted. Only a recognised SUBTITLE
# separator (dash, parenthesis, quotation mark) or anything else
# unclassifiable is rejected.
class TestSectionHeaderPrefixGuardRound4(unittest.TestCase):
    def test_dash_led_subtitle_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES   - BUDGET AND ACTUAL', 'expenditures', 'prefix'))

    def test_dash_led_subtitle_is_rejected_on_revenues_too(self):
        self.assertFalse(_is_section_header(
            'REVENUES  - BUDGET AND ACTUAL', 'revenues', 'prefix'))

    def test_en_dash_led_subtitle_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  – BUDGET AND ACTUAL', 'expenditures', 'prefix'))

    def test_parenthesis_led_subtitle_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  (BUDGETARY BASIS) AND CHANGES', 'expenditures', 'prefix'))

    def test_quotation_mark_led_subtitle_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  "BUDGETARY BASIS" SCHEDULE', 'expenditures', 'prefix'))

    def test_year_caption_with_two_comparative_years_is_accepted(self):
        # The non-regression that protects a real header shape: a
        # comparative statement legitimately captions columns with bare
        # years. Rejecting any non-word lead would silently empty the
        # revenue side on exactly this shape -- worse than the bug.
        self.assertTrue(_is_section_header(
            'REVENUES   2024   2023', 'revenues', 'prefix'))

    def test_digit_led_remainder_that_is_not_a_year_is_still_accepted(self):
        # A digit lead is accepted unconditionally -- there is no separate
        # "is this plausibly a year" check, so a digit-led remainder that
        # is clearly not a calendar year (e.g. a fund number) is accepted
        # the same way a real year caption is.
        self.assertTrue(_is_section_header(
            'REVENUES   101   Special Revenue', 'revenues', 'prefix'))

    def test_real_seattle_revenue_header_still_accepted_after_round_4(self):
        # Read from the PDF, not retyped.
        self.assertTrue(_is_section_header(SEA2024_REV_HEADER.strip(), 'revenues', 'prefix'))

    def test_bare_revenues_still_accepted_after_round_4(self):
        self.assertTrue(_is_section_header('REVENUES', 'revenues', 'prefix'))

    def test_bare_expenditures_still_accepted_after_round_4(self):
        self.assertTrue(_is_section_header('EXPENDITURES', 'expenditures', 'prefix'))

    def test_trailing_colon_variant_still_accepted_after_round_4(self):
        self.assertTrue(_is_section_header('REVENUES:', 'revenues', 'prefix'))

    def test_trailing_dollar_sign_variant_still_accepted_after_round_4(self):
        self.assertTrue(_is_section_header('EXPENDITURES $', 'expenditures', 'prefix'))


# Fix round 5: the WORD branch of layer 5 still failed open for a non-ASCII
# alphabetic lead. `lead.isalpha()` is True for any Unicode letter, but
# `_LEADING_WORD` matches ASCII [a-z]+ only, so an accented letter or a
# ligature made the match None and `not (None and ...)` evaluated to an
# unconditional accept that never ran the connective test -- the same
# fail-open shape round 4 eliminated, narrowed to non-ASCII letters. Assert
# on booleans rather than echoing the strings, since a Windows console in a
# non-UTF-8 codepage can raise UnicodeEncodeError trying to print the
# ligature on a test failure -- the inputs themselves stay non-ASCII on
# purpose, per the coordinator's instruction not to weaken them to make
# printing convenient.
class TestSectionHeaderPrefixGuardRound5(unittest.TestCase):
    def test_accented_letter_lead_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  ÉTAT AND CHANGES', 'expenditures', 'prefix'))

    def test_grave_accented_letter_lead_is_rejected(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  ÀND CHANGES', 'expenditures', 'prefix'))

    def test_ligature_lead_is_rejected(self):
        # U+FB01 LATIN SMALL LIGATURE FI
        self.assertFalse(_is_section_header(
            'EXPENDITURES  ﬁNANCIAL CHANGES', 'expenditures', 'prefix'))

    def test_ampersand_lead_still_rejects(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  & CHANGES', 'expenditures', 'prefix'))

    def test_asterisk_lead_still_rejects(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  * NOTE', 'expenditures', 'prefix'))

    def test_memorandum_only_parenthetical_still_rejects(self):
        self.assertFalse(_is_section_header(
            'EXPENDITURES  (MEMORANDUM ONLY)', 'expenditures', 'prefix'))

    def test_year_caption_with_two_comparative_years_still_accepts(self):
        self.assertTrue(_is_section_header(
            'REVENUES   2024   2023', 'revenues', 'prefix'))

    def test_digit_led_non_year_remainder_still_accepts(self):
        self.assertTrue(_is_section_header(
            'REVENUES   101   Special Revenue', 'revenues', 'prefix'))

    def test_general_fund_caption_still_accepts(self):
        self.assertTrue(_is_section_header(
            'REVENUES   General Fund', 'revenues', 'prefix'))

    def test_bare_expenditures_still_accepts(self):
        self.assertTrue(_is_section_header('EXPENDITURES', 'expenditures', 'prefix'))


# ── Bainbridge Island shape ──────────────────────────────────────────────────
# Transcribed from the FY2025 SAO-bound statement (whole dollars, GF leftmost).
# Bainbridge does NOT group its revenue side -- there is no `Taxes:` parent --
# which is why BI_CFG leaves revenue_parents empty while Seattle/King County
# set it. Setting it here would look for a group that does not exist.
BI_REV_LINES = [
    'REVENUES',
    'Property Taxes                    8,612,126    -            -        (64)        8,612,062',
    'Sales, Business, and Excise Taxes 12,532,083   786,774      -        5,109,974   18,428,831',
    'Licenses and Permits              669,376       37,063      -        -           706,439',
    'Total Revenues                    24,379,173   1,298,666    208,542  6,340,722   32,227,102',
]
BI_REV_ANCHOR = BI_REV_LINES[-1]

BI_EXP_LINES = [
    'EXPENDITURES',
    'Current',
    'General Government                7,996,984    577,779      -        -           8,574,762',
    'Transportation                    -            3,344,813    -        -           3,344,813',
    'Debt Service - Principal          30,508       -            -        668,665     699,173',
    'Capital Outlay                    133,497      -            4,809,336 -          4,942,833',
    'Total Expenditures                20,801,297   4,090,263    4,809,336 1,996,401  31,697,296',
]
BI_EXP_ANCHOR = BI_EXP_LINES[-1]


def _bi_cfg(**kw):
    base = dict(city='Bainbridge Island, WA',
                parents=('current',),
                root_leaves=('debt service', 'capital outlay'),
                column_strategy='ordinal', units=1, fy_end=('December', 31))
    base.update(kw)
    return CityConfig(**base)


class TestBainbridgeShape(unittest.TestCase):
    def test_revenue_side_is_flat_with_no_tax_parent(self):
        tree, total, _ = build_revenue(BI_REV_LINES, anchors(BI_REV_ANCHOR), _bi_cfg())
        self.assertEqual([c['n'] for c in tree['c']],
                         ['Property Taxes', 'Sales, Business, and Excise Taxes',
                          'Licenses and Permits'])
        self.assertEqual(total, 8612126 + 12532083 + 669376)

    def test_capital_outlay_and_debt_service_are_root_leaves_not_children_of_current(self):
        tree, _, _ = build_operating(BI_EXP_LINES, anchors(BI_EXP_ANCHOR), _bi_cfg())
        roots = [c['n'] for c in tree['c']]
        self.assertIn('Current', roots)
        self.assertIn('Capital Outlay', roots)
        self.assertIn('Debt Service - Principal', roots)

    def test_dash_zero_transportation_keeps_its_own_label(self):
        # The Bend trap: a dash-zero can graft its label onto the NEXT row while
        # tie_delta stays $0, so the tie can never detect it. Assert the label.
        #
        # NOTE: this assertion was NOT taken verbatim from the task brief.
        # The brief's original draft read the label off `current.get('i', [])`
        # -- a key `build_operating` never emits (no node in this library
        # carries an 'i' array; see acfrGF.py). A $0 GF row is recorded in
        # `zero_rows` and dropped from the tree entirely (documented in
        # build_operating's docstring and exercised by the existing
        # TestDoubleDashRowDoesNotGlue case above), so the brief's assertion
        # could never pass against the library's actual, correct, already-
        # documented behaviour. Rewritten to assert against `zero_rows`
        # instead, matching that existing pattern -- same intent (the label
        # survives on its own, not glued onto the next row) via the real API.
        _, _, zero_rows = build_operating(BI_EXP_LINES, anchors(BI_EXP_ANCHOR), _bi_cfg())
        self.assertIn('Transportation', zero_rows)
        self.assertNotIn('Transportation Debt Service - Principal', zero_rows)


# ── Bainbridge Island EARLY-ERA shape (FY2004-2008) ──────────────────────────
# Transcribed from the FY2004 governmental-funds statement (whole dollars, GF
# leftmost, "Total Operating Revenues" instead of FY2010+'s "Total Revenues").
# Unlike FY2010+ (TestBainbridgeShape above), there is no `Current` parent --
# the function rows sit flat at root -- and `Debt service:` is itself a
# PARENT (the Hillsboro-style inversion CityConfig's docstring documents),
# introducing `Principal` and `Interest` as its children rather than as flat
# root leaves. This is why scripts/extractBainbridgeEarly.py exists as a
# separate CityConfig instead of widening scripts/extractBainbridge.py's
# parents/root_leaves to cover both eras at once -- CityConfig is one tree
# shape per config; the two eras are genuinely different documents.
BI_EARLY_REV_LINES = [
    'REVENUES',
    'Property taxes                    5,376,784    -            -            409,709     5,786,494',
    'Other taxes                       4,970,906    284,089      2,097,434    55,420      7,407,850',
    'Fees and fines                    177,812      -            -            -           177,812',
    'Total Operating Revenues          10,524,502   284,089      2,097,434    465,129     13,371,154',
]
BI_EARLY_REV_ANCHOR = BI_EARLY_REV_LINES[-1]

BI_EARLY_EXP_LINES = [
    'EXPENDITURES',
    'General government                 2,951,684    243,450      -            376         3,195,510',
    'Judicial                            567,639      -            -            -           567,639',
    'Debt service:',
    'Principal                           118,898      -            -            1,039,855   1,158,753',
    'Interest                            55,275       -            -            972,068     1,027,343',
    'Capital outlay                      629,708      207,381      -            180,000     1,017,089',
    'Total Expenditures                  4,322,784    450,839      -            1,192,299   5,965,922',
]
BI_EARLY_EXP_ANCHOR = BI_EARLY_EXP_LINES[-1]


def _bi_early_cfg(**kw):
    base = dict(city='Bainbridge Island, WA',
                parents=('debt service',),
                root_leaves=('capital outlay',),
                column_strategy='ordinal', units=1, fy_end=('December', 31),
                revenue_total_labels=('total revenues', 'total operating revenues'))
    base.update(kw)
    return CityConfig(**base)


class TestBainbridgeEarlyShape(unittest.TestCase):
    def test_revenue_section_closes_at_total_operating_revenues_not_total_revenues(self):
        # The section-end regex must recognise "Total Operating Revenues" via
        # revenue_total_labels; if it only matched the default "Total
        # Revenues" (FY2010+), the revenue section would never close and
        # would run away into EXPENDITURES -- the exact failure observed live
        # on FY2004 before _end_revenues_pattern was added (fix round 1).
        tree, total, _ = build_revenue(BI_EARLY_REV_LINES, anchors(BI_EARLY_REV_ANCHOR), _bi_early_cfg())
        self.assertEqual([c['n'] for c in tree['c']],
                         ['Property taxes', 'Other taxes', 'Fees and fines'])
        self.assertEqual(total, 5376784 + 4970906 + 177812)

    def test_debt_service_is_a_parent_with_principal_and_interest_as_children(self):
        tree, _, _ = build_operating(BI_EARLY_EXP_LINES, anchors(BI_EARLY_EXP_ANCHOR), _bi_early_cfg())
        roots = [c['n'] for c in tree['c']]
        self.assertIn('Debt service', roots)
        self.assertNotIn('Principal', roots)   # must NOT be a root leaf here
        self.assertIn('Capital outlay', roots)
        debt_service = next(c for c in tree['c'] if c['n'] == 'Debt service')
        self.assertEqual([c['n'] for c in debt_service['c']], ['Principal', 'Interest'])
        self.assertEqual(debt_service['a'], 118898 + 55275)

    def test_general_government_and_judicial_stay_flat_at_root_no_current_parent(self):
        # FY2004-2008 print no `Current` header at all -- the function rows
        # are peers of `Debt service` and `Capital outlay`, not children of a
        # group that does not exist in this era's document.
        tree, _, _ = build_operating(BI_EARLY_EXP_LINES, anchors(BI_EARLY_EXP_ANCHOR), _bi_early_cfg())
        roots = [c['n'] for c in tree['c']]
        self.assertIn('General government', roots)
        self.assertIn('Judicial', roots)
        self.assertNotIn('Current', roots)


class TestShippedBainbridgeConfigsAreWholeDollars(unittest.TestCase):
    # Bainbridge's SAO-bound statements print WHOLE DOLLARS; Seattle and King
    # County print "(IN THOUSANDS)". Getting that wrong publishes figures that
    # are off by 1000x -- and NOTHING else in this repo can catch it:
    #
    #   * The tie gate is unit-invariant. computed and printed are BOTH scaled
    #     by cfg.units, so tie_delta reads $0 at units=1 and at units=1000
    #     alike. A wrong multiplier ships silently past a green tie.
    #   * TestUnits above pins the library MECHANICS (that cfg.units is applied
    #     exactly once, at the right layers) using its own local fixtures. It
    #     says nothing about which value the shipped city configs choose.
    #
    # So these assertions must run against the real, shipped CONFIG objects.
    # A version of this test that rebuilds an equivalent CityConfig locally
    # would pass forever no matter what the shipped files said -- which is
    # exactly the hole this class was written to close.
    def test_modern_era_config_units_is_one(self):
        self.assertEqual(extractBainbridge.CONFIG.units, 1)

    def test_early_era_config_units_is_one(self):
        self.assertEqual(extractBainbridgeEarly.CONFIG.units, 1)


# ── Trap 5 (fix round 3): footer page-number recovery + loud failure ────────
# Transcribed from the FY2004 governmental-funds statement's real
# Transportation row (see task-4-report.md fix round 2 for how this was
# diagnosed): a page-footer PAGE NUMBER ('16') landed at the very start of
# the rendered line, ahead of the real label, and was silently dropped --
# taking its true GF value (75) with it -- before this fix existed.
FOOTER_DIGIT_TRANSPORTATION_LINE = (
    '16                                 Transportation                     '
    '75           1,785,388    -            -        -           1,785,463'
)
_FOOTER_ANCHOR = anchors('Total Expenditures  75  1,785,388  -  -  -  1,785,463')


def _footer_digit_cfg():
    return CityConfig(city='X', parents=('debt service',),
                       root_leaves=('capital outlay',),
                       column_strategy='ordinal', units=1)


class TestLeadingPageNumberRecovery(unittest.TestCase):
    def test_footer_digit_row_recovers_its_label_and_true_value(self):
        kind, lbl, val = classify(FOOTER_DIGIT_TRANSPORTATION_LINE, _FOOTER_ANCHOR, _footer_digit_cfg())
        self.assertEqual(kind, 'data')
        self.assertEqual(lbl, 'Transportation')
        self.assertEqual(val, 75)

    def test_recovery_works_end_to_end_through_build_operating(self):
        # Same row, exercised through the full tree builder (in the style of
        # TestBainbridgeShape above), not just classify() directly.
        exp_lines = [
            'EXPENDITURES',
            'General government                 2,951,684    243,450      -            376         3,195,510',
            FOOTER_DIGIT_TRANSPORTATION_LINE,
            'Capital outlay                      629,708      207,381      -            180,000     1,017,089',
            'Total Expenditures                  3,656,467    450,831      75           180,376     6,073,310',
        ]
        tree, total, zero_rows = build_operating(exp_lines, _FOOTER_ANCHOR, _footer_digit_cfg())
        roots = {c['n']: c['a'] for c in tree['c']}
        self.assertIn('Transportation', roots)
        self.assertEqual(roots['Transportation'], 75)
        self.assertEqual(zero_rows, [])   # not dropped, so not in zero_rows either

    def test_legitimate_label_starting_with_digits_and_a_single_space_is_untouched(self):
        # "911 Dispatch" must NOT be mistaken for a page-number prefix: the
        # digit and the following word are separated by a single space, not
        # a genuine 2+-space column gap. Confirmed unmodified by the
        # recovery step itself (see acfrGF.py's Trap 5 comment for the
        # separate, pre-existing, disclosed residual this does NOT fix: a
        # digit-led label reaching classify() would still raise there, not
        # here -- verified absent from every currently-shipped entity's real
        # GF statement page).
        line = '911 Dispatch                       50,000       -        -        -           50,000'
        self.assertEqual(_recover_label_past_leading_page_number(line), line)

    def test_compound_label_with_no_gap_at_all_is_untouched(self):
        # "4Culture" (a real King County program name, confirmed present in
        # King County's FY2024 ACFR as a debt-schedule caption -- never on
        # the GF statement page itself) has no gap whatsoever between the
        # digit and the letter, so it can never match _LEADING_PAGE_NUMBER
        # either.
        line = '4Culture                           50,000       -        -        -           50,000'
        self.assertEqual(_recover_label_past_leading_page_number(line), line)


class TestValuesWithNoLabelRaisesLoudly(unittest.TestCase):
    def test_a_row_with_a_real_gf_value_and_no_recoverable_label_raises(self):
        # The actual defect this round exists to fix: silently dropping a
        # row that carries a real value is worse than failing loudly. This
        # line has no leading page-number pattern to recover (no digit run
        # at all before the numbers) -- it is simply unlabeled, which must
        # now be impossible to pass through silently.
        line = '                                    50,000       -        -        -           50,000'
        anchor = anchors('Total Expenditures  50,000  -  -  -  50,000')
        with self.assertRaises(ValueError):
            classify(line, anchor, _footer_digit_cfg())


class TestBlankLinesAndRulesStillSkipQuietly(unittest.TestCase):
    # CRITICAL boundary from fix round 3: a genuinely blank line, a
    # rule/underline row, or a spacer with NO values at all must continue to
    # be skipped quietly -- the loud failure above applies ONLY when a row
    # carries a real value and still has no usable label. These three cases
    # never reach that branch at all (they have no money tokens whatsoever),
    # so they must never raise.
    def test_an_empty_line_is_still_skipped_quietly(self):
        kind, lbl, val = classify('', [], _footer_digit_cfg())
        self.assertEqual(kind, 'skip')

    def test_a_pure_whitespace_line_is_still_skipped_quietly(self):
        kind, lbl, val = classify('              ', [], _footer_digit_cfg())
        self.assertEqual(kind, 'skip')

    def test_an_underline_rule_row_with_no_values_never_raises(self):
        kind, lbl, val = classify('___________________________________', [], _footer_digit_cfg())
        self.assertIn(kind, ('wrapped', 'skip'))

    def test_a_wrapped_label_continuation_with_no_numbers_never_raises(self):
        # A genuine multi-line label wrap (no money tokens at all on this
        # physical line) must still be classified 'wrapped', not raise.
        kind, lbl, val = classify('Culture and Recreation', [], _footer_digit_cfg())
        self.assertEqual(kind, 'wrapped')
        self.assertEqual(lbl, 'Culture and Recreation')


if __name__ == '__main__':
    unittest.main(verbosity=2)
