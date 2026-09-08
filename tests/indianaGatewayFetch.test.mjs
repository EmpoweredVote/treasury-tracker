import { describe, it, expect } from 'vitest';
import {
  formValue, optionValues, checkHeader, REQUIRED_COLUMNS, STANDARD_PULLS, GATEWAY_URL,
} from '../scripts/fetchIndianaGateway.mjs';

/**
 * ⚠ These three header lines are VERBATIM from Gateway's own FY2024 files
 * (recovered from the archive bundle and re-confirmed against a live download on
 * 2026-09-05). They are the contract this fetcher checks against, so they are
 * pasted rather than paraphrased — a paraphrased fixture would only prove the
 * checker agrees with itself.
 */
const HEADERS = {
  'Detailed Receipts':
    'year|cnty_cd|cnty_description|budget_unit_type|unit_code|sboa_id|afr_unit_type|unit_name|ent_id|'
    + 'ent_name|Fund_code|unit_fund_number|fund_name|receipt_class_code|Receipt_Class_Name|Receipt_Code|'
    + 'section|other_item_flag|receipt_name|Unit_account_number|Unit_account_name|amount|',
  'Disbursements by Fund':
    'year|cnty_cd|cnty_description|budget_unit_type|unit_code|sboa_id|afr_unit_type|unit_name|ent_id|'
    + 'ent_name|Fund_code|unit_fund_number|fund_name|disburse_class_code|class_name|disburse_code|'
    + 'section|disburse_name|amount|',
  'Cash and Investments':
    'year|cnty_description|cnty_cd|budget_unit_type|unit_code|unit_name|sboa_id|afr_unit_type|fund_code|'
    + 'unit_fund_number|fund_name|ent_id|ent_name|beg_cash_inv|r_bal|r_exceptions|d_bal|d_exceptions|cash_bal|',
};

describe('the three reports the loader reads', () => {
  it('accepts each report\'s real served header', () => {
    for (const [report, header] of Object.entries(HEADERS)) {
      const r = checkHeader(header, report);
      expect(r, `${report}: ${r.why}`).toMatchObject({ ok: true });
      expect(r.unchecked).toBeUndefined();
    }
  });

  it('covers exactly the reports STANDARD_PULLS asks for', () => {
    const pulled = new Set(STANDARD_PULLS.map((p) => p.report));
    expect([...pulled].sort()).toEqual(Object.keys(REQUIRED_COLUMNS).sort());
  });

  /**
   * ⚠⚠ Cash and Investments TRANSPOSES cnty_cd and cnty_description relative to
   * the other two, and moves unit_name. Any positional reader would read a county
   * NAME as a county CODE and still "work". This pins that the fixtures really do
   * disagree on order, so the by-name requirement is not vacuous.
   */
  it('proves the reports do NOT share a column order', () => {
    const pos = (report, col) => HEADERS[report].split('|').findIndex((h) => h.trim().toLowerCase() === col);
    expect(pos('Detailed Receipts', 'cnty_cd')).toBe(1);
    expect(pos('Cash and Investments', 'cnty_cd')).toBe(2);
    expect(pos('Detailed Receipts', 'unit_name')).not.toBe(pos('Cash and Investments', 'unit_name'));
  });

  /**
   * ⚠⚠ sboa_id is required on every report because (cnty_cd, unit_code) is NOT a
   * unique government — 77 keys in FY2024 carry two governments each, four of them
   * a city or town sharing with a fire district, airport, transit authority or
   * township. It is also the column Gateway's own 2020 layout doc omits, so a
   * fetcher that trusted the documentation would not know to demand it.
   */
  it('requires sboa_id on every report', () => {
    for (const [report, cols] of Object.entries(REQUIRED_COLUMNS)) {
      expect(cols, report).toContain('sboa_id');
    }
  });

  it('rejects a header that has dropped sboa_id', () => {
    for (const [report, header] of Object.entries(HEADERS)) {
      const without = header.split('|').filter((h) => h.trim().toLowerCase() !== 'sboa_id').join('|');
      const r = checkHeader(without, report);
      expect(r.ok, report).toBe(false);
      expect(r.why).toMatch(/sboa_id/);
    }
  });

  it('rejects a header missing the amount column', () => {
    const without = HEADERS['Detailed Receipts'].replace('|amount|', '|');
    expect(checkHeader(without, 'Detailed Receipts')).toMatchObject({ ok: false });
  });
});

describe('the HTML-instead-of-data failure, which is the one that actually happens', () => {
  it('refuses an HTML page even though it arrives as HTTP 200', () => {
    const r = checkHeader('<!DOCTYPE html>', 'Detailed Receipts');
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/not pipe-delimited/);
  });

  it('refuses an empty or absent first line', () => {
    for (const bad of ['', null, undefined]) {
      expect(checkHeader(bad, 'Detailed Receipts').ok).toBe(false);
    }
  });

  it('does not silently pass an unknown report as verified', () => {
    const r = checkHeader('a|b|c', 'Township Disbursements');
    expect(r.ok).toBe(true);
    // ⚠ A gate that cannot check must SAY so rather than look like coverage.
    expect(r.unchecked).toBe(true);
  });
});

describe('reading the form instead of assuming it', () => {
  const PAGE = '<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="AbC123+/=" />'
    + '<select name="ctl00$ContentPlaceHolder1$DropDownListYear" id="ctl00_ContentPlaceHolder1_DropDownListYear">'
    + '<option value="2026">2026</option><option value="2012">2012</option>'
    + '<option value="All">All</option></select>'
    + '<select id="ctl00_ContentPlaceHolder1_DropDownListUnitType">'
    + '<option value="City/Town">City/Town</option><option value="Special">Special</option></select>';

  it('extracts a ViewState token', () => {
    expect(formValue(PAGE, '__VIEWSTATE')).toBe('AbC123+/=');
    expect(formValue(PAGE, '__EVENTVALIDATION')).toBe('');
  });

  it('reads option values, including the ones a slash would break', () => {
    expect(optionValues(PAGE, 'DropDownListYear')).toEqual(['2026', '2012', 'All']);
    expect(optionValues(PAGE, 'DropDownListUnitType')).toEqual(['City/Town', 'Special']);
  });

  it('returns null rather than [] for a control that is not a select', () => {
    // ⚠ [] would read as "nothing is on offer" and refuse every value; null means
    // "could not be read", which the caller treats as no constraint.
    expect(optionValues(PAGE, 'RadComboBox2')).toBeNull();
  });
});

describe('the six standard pulls', () => {
  it('names the files loadIndianaGateway.mjs actually opens', () => {
    expect(STANDARD_PULLS.map((p) => p.file).sort()).toEqual([
      'cash_city_ALL.txt', 'cash_county_ALL.txt',
      'disfund_city_ALL.txt', 'disfund_county_ALL.txt',
      'rec_city_ALL.txt', 'rec_county_ALL.txt',
    ]);
  });

  /**
   * ⚠⚠ NOT "Disbursements by Fund and Department". That report is GENERAL FUND
   * ONLY (Gateway: departmental detail is provided "for counties (General Fund and
   * Motor Vehicle Highway Fund) and cities and towns (General Fund)"). Pairing it
   * with all-fund receipts is a 4-15x scope mismatch that ties against its own
   * subtotals the whole way — and it is exactly what the deleted legacy vintage
   * did (migration 20260905000100).
   */
  it('pulls Disbursements by Fund, never the by-department report', () => {
    const reports = STANDARD_PULLS.map((p) => p.report);
    expect(reports).toContain('Disbursements by Fund');
    expect(reports).not.toContain('Disbursements by Fund and Department');
  });

  it('covers both unit types for all three reports', () => {
    for (const report of Object.keys(REQUIRED_COLUMNS)) {
      const units = STANDARD_PULLS.filter((p) => p.report === report).map((p) => p.unitType).sort();
      expect(units, report).toEqual(['City/Town', 'County']);
    }
  });

  it('targets the anonymous public endpoint', () => {
    expect(GATEWAY_URL).toBe('https://gateway.ifionline.org/public/download.aspx');
  });
});
