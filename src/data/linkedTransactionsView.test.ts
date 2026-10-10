import { describe, it, expect } from 'vitest';
import { linkedTxView, summaryIsEmpty } from './linkedTransactionsView';
import type { LinkedTransactionSummary } from '../types/budget';

const FOUND: LinkedTransactionSummary = {
  totalAmount: 1_000,
  transactionCount: 2,
  vendorCount: 1,
  topVendors: [{ name: 'A Vendor', amount: 1_000, count: 2 }],
  transactions: [
    { description: 'one' } as never,
    { description: 'two' } as never,
  ],
};

const WELL_FORMED_BUT_EMPTY: LinkedTransactionSummary = {
  totalAmount: 0,
  transactionCount: 0,
  vendorCount: 0,
  topVendors: [],
  transactions: [],
};

const base = {
  activeDataset: 'operating',
  linkKey: 'public safety',
};

describe('linkedTxView', () => {
  // ⚠⚠ THE BUG. Only two entities app-wide carry any transactions, so a leaf
  // category that has none is the NORMAL case. The old view read every falsy
  // summary as "loading" and spun forever.
  it('shows NOTHING, not a spinner, once a load finished with no transactions', () => {
    expect(linkedTxView({ ...base, status: 'empty', summary: null })).toBe('none');
  });

  it('shows NOTHING before any request has been made', () => {
    // `idle` is not `loading`. Conflating them is what produced the hang.
    expect(linkedTxView({ ...base, status: 'idle', summary: null })).toBe('none');
  });

  it('shows NOTHING when a load finished with a well-formed but empty summary', () => {
    expect(linkedTxView({ ...base, status: 'loaded', summary: WELL_FORMED_BUT_EMPTY })).toBe('none');
  });

  it('shows a spinner ONLY while a request is genuinely in flight', () => {
    expect(linkedTxView({ ...base, status: 'loading', summary: null })).toBe('spinner');
  });

  it('shows the panel when transactions were actually found', () => {
    expect(linkedTxView({ ...base, status: 'loaded', summary: FOUND })).toBe('panel');
  });

  it('shows nothing outside the operating dataset, whatever the status', () => {
    expect(linkedTxView({ ...base, activeDataset: 'revenue', status: 'loading', summary: null })).toBe('none');
    expect(linkedTxView({ ...base, activeDataset: 'salaries', status: 'loaded', summary: FOUND })).toBe('none');
  });

  it('shows nothing when the category declares no link key', () => {
    expect(linkedTxView({ ...base, linkKey: undefined, status: 'loading', summary: null })).toBe('none');
    expect(linkedTxView({ ...base, linkKey: '', status: 'loading', summary: null })).toBe('none');
  });
});

describe('summaryIsEmpty', () => {
  it('treats null as empty', () => {
    expect(summaryIsEmpty(null)).toBe(true);
  });

  it('treats a summary with no rows and no count as empty', () => {
    expect(summaryIsEmpty(WELL_FORMED_BUT_EMPTY)).toBe(true);
  });

  it('does not treat a populated summary as empty', () => {
    expect(summaryIsEmpty(FOUND)).toBe(false);
  });
});
