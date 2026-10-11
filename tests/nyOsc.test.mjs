import { describe, it, expect } from 'vitest';
import { ERA_OLD, ERA_NEW, eraForHeader, sectionOf } from '../scripts/lib/nyOsc.mjs';

const OLD_HEADER = ['CALENDAR_YEAR', 'MUNICIPAL_CODE', 'ENTITY_NAME', 'CLASS_DESCRIPTION',
  'COUNTY', 'FISCAL_YEAR_END', 'ACCOUNT_CODE', 'ACCOUNT_CODE_NARRATIVE',
  'FINANCIAL_STATEMENT', 'FINANCIAL_STATEMENT_SEGMENT', 'LEVEL_1_CATEGORY',
  'LEVEL_2_CATEGORY', 'OBJECT_OF_EXPENDITURE', 'AMOUNT', 'SNAPSHOT_DATE'];

const NEW_HEADER = ['CALENDAR_YEAR', 'MUNICIPAL_CODE', 'ENTITY_NAME', 'CLASS_DESCRIPTION',
  'COUNTY', 'PERIOD_START', 'PERIOD_END', 'ACCOUNT_CODE', 'ACCOUNT_CODE_NARRATIVE',
  'ACCOUNT_CODE_SECTION', 'LEVEL_1_CATEGORY', 'LEVEL_2_CATEGORY',
  'OBJECT_OF_EXPENDITURE', 'AMOUNT', 'SNAPSHOT_DATE'];

describe('era detection', () => {
  it('reads the era off the header, not the filename', () => {
    expect(eraForHeader(OLD_HEADER)).toBe(ERA_OLD);
    expect(eraForHeader(NEW_HEADER)).toBe(ERA_NEW);
  });

  it('refuses a header it does not recognise', () => {
    expect(() => eraForHeader(['CALENDAR_YEAR', 'AMOUNT']))
      .toThrow(/unrecognised NY OSC header/i);
  });
});

describe('sectionOf', () => {
  it('maps the new era straight through', () => {
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'REVENUE' })).toBe('REVENUE');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'EXPENDITURE' })).toBe('EXPENDITURE');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'GL' })).toBe('OTHER');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'FBNP' })).toBe('OTHER');
  });

  it('maps the old era off FINANCIAL_STATEMENT', () => {
    expect(sectionOf({ FINANCIAL_STATEMENT: 'STATEMENT OF REVENUES AND OTHER SOURCES' }))
      .toBe('REVENUE');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'STATEMENT OF EXPENDITURES AND OTHER USES' }))
      .toBe('EXPENDITURE');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'BALANCE SHEET' })).toBe('OTHER');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'CHANGE IN EQUITY' })).toBe('OTHER');
  });
});

import { normLabel } from '../scripts/lib/nyOsc.mjs';

describe('normLabel', () => {
  it('collapses the 2012/2013 casing change to one label', () => {
    // The whole reason this function exists: loaded raw, one city grows TWO
    // parallel icicle branches across the era boundary -- at an exact $0 tie,
    // because casing moves no money.
    expect(normLabel('GENERAL GOVERNMENT')).toBe(normLabel('General Government'));
    expect(normLabel('REAL PROPERTY TAXES AND ASSESSMENTS'))
      .toBe(normLabel('Real Property Taxes and Assessments'));
  });

  it('produces Title Case, matching the modern era as published', () => {
    expect(normLabel('GENERAL GOVERNMENT')).toBe('General Government');
    expect(normLabel('CULTURE AND RECREATION')).toBe('Culture and Recreation');
  });

  it('keeps small words lowercase except in first position', () => {
    expect(normLabel('USE AND SALE OF PROPERTY')).toBe('Use and Sale of Property');
    expect(normLabel('CHARGES TO OTHER GOVERNMENTS')).toBe('Charges to Other Governments');
  });

  it('trims and collapses interior whitespace', () => {
    expect(normLabel('  PUBLIC   SAFETY  ')).toBe('Public Safety');
  });

  it('is idempotent', () => {
    expect(normLabel(normLabel('STATE AID'))).toBe('State Aid');
  });

  it('passes an empty label through as empty', () => {
    expect(normLabel('')).toBe('');
    expect(normLabel(null)).toBe('');
  });
});
