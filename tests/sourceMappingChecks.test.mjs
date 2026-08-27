import { describe, it, expect } from 'vitest';
import { mappingProblems, isUnsyncable } from '../scripts/lib/sourceMappingChecks.mjs';

const codes = (s) => mappingProblems(s).map((p) => p.code);

describe('mappingProblems — transactions', () => {
  it('accepts a real transactions feed', () => {
    const s = { dataset_type: 'transactions', column_mapping: {
      amount_column: 'amount', date_column: 'check_date', vendor_column: 'vendor_name' } };
    expect(codes(s)).toEqual([]);
    expect(isUnsyncable(s)).toBe(false);
  });

  // Bloomington Public Contracts: a contract register typed as transactions.
  it('rejects a transactions source with no amount column', () => {
    const s = { dataset_type: 'transactions', column_mapping: {
      note: 'Contract-level data, not individual payment transactions. No dollar amounts.',
      vendor_column: 'contractor_recipient',
      description_column: 'brief_description',
      contract_id_column: 'year_and_id' } };
    expect(codes(s)).toContain('transactions_without_amount');
    expect(isUnsyncable(s)).toBe(true);
  });

  it('warns, but does not block, on a missing date column alone', () => {
    const s = { dataset_type: 'transactions', column_mapping: { amount_column: 'amt' } };
    expect(codes(s)).toEqual(['transactions_without_date']);
    expect(isUnsyncable(s)).toBe(false);
  });

  // LA City Vendor List: a lookup table typed as transactions.
  it('rejects a reference dataset outright', () => {
    const s = { dataset_type: 'transactions', column_mapping: {
      is_reference_dataset: true,
      vendor_id_column: 'vendor_id', vendor_name_column: 'vendor_name',
      vendor_zip_column: 'zip', vendor_city_column: 'supplier_city' } };
    expect(codes(s)).toContain('reference_dataset_not_syncable');
    expect(isUnsyncable(s)).toBe(true);
  });

  it('accepts the string form of is_reference_dataset too', () => {
    expect(isUnsyncable({ dataset_type: 'salaries', column_mapping: { is_reference_dataset: 'true' } })).toBe(true);
  });
});

describe('mappingProblems — budgets accept either loader dialect', () => {
  it('accepts the edge-function dialect', () => {
    const s = { dataset_type: 'operating', column_mapping: {
      hierarchy_columns: ['appropriation', 'service'], amount_column: 'budcurr' } };
    expect(codes(s)).toEqual([]);
  });

  it('accepts the repo-loader dialect', () => {
    const s = { dataset_type: 'revenue', column_mapping: {
      category_column: 'department', approved_amount_column: 'budget' } };
    expect(codes(s)).toEqual([]);
  });

  it('rejects a budget source satisfying neither', () => {
    const s = { dataset_type: 'operating', column_mapping: { fiscal_year_column: 'bfy' } };
    expect(codes(s)).toContain('budget_mapping_incomplete');
    expect(isUnsyncable(s)).toBe(true);
  });

  it('THROWS when column_mapping is absent rather than guessing', () => {
    // The first version of this module treated absent as empty. Because
    // treasury_list_sources does not return column_mapping, that made it report
    // every single source as unsyncable — confidently, and about all of them.
    expect(() => mappingProblems({ dataset_type: 'operating' }))
      .toThrow(/requires column_mapping/);
    expect(() => mappingProblems({ dataset_type: 'transactions' }))
      .toThrow(/treasury_list_sources does not return it/);
  });

  it('distinguishes an explicitly empty mapping from an absent one', () => {
    expect(() => mappingProblems({ dataset_type: 'operating', column_mapping: {} })).not.toThrow();
    expect(codes({ dataset_type: 'operating', column_mapping: {} })).toContain('budget_mapping_incomplete');
    expect(mappingProblems(null)).toEqual([]);
  });
});
