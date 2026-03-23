import { useState, useCallback } from 'react';
import { Receipt, Building2, Calendar, CreditCard, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { LinkedTransactionSummary, LinkedTransaction } from '../types/budget';

interface LinkedTransactionsPanelProps {
  linkedTransactions: LinkedTransactionSummary;
  categoryName: string;
  linkKey?: string;
  fiscalYear?: number;
}

const TRANSACTIONS_PER_PAGE = 20;

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export default function LinkedTransactionsPanel({
  linkedTransactions,
  categoryName,
  linkKey,
  fiscalYear = 2025
}: LinkedTransactionsPanelProps) {
  const { totalAmount, transactionCount, vendorCount, topVendors, transactions: initialTransactions, hasMore } = linkedTransactions;

  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(TRANSACTIONS_PER_PAGE);
  const [allTransactions, setAllTransactions] = useState<LinkedTransaction[]>(initialTransactions);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoadedAll, setHasLoadedAll] = useState(!hasMore);

  // Load all transactions from the index file
  const loadAllTransactions = useCallback(async () => {
    if (!linkKey || hasLoadedAll) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(`./data/transactions-${fiscalYear}-index.json`);
      if (!response.ok) {
        throw new Error('Failed to load transaction index');
      }

      const index = await response.json();
      if (index[linkKey]) {
        setAllTransactions(index[linkKey].transactions);
        setHasLoadedAll(true);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      setLoadError('Failed to load additional transactions');
    } finally {
      setIsLoading(false);
    }
  }, [linkKey, fiscalYear, hasLoadedAll]);

  // When collapsed, show 5 transactions; when expanded, show paginated list
  const displayTransactions = isExpanded
    ? allTransactions.slice(0, visibleCount)
    : allTransactions.slice(0, 5);

  const hasMoreToLoad = visibleCount < allTransactions.length;
  const canExpand = transactionCount > 5;

  const handleLoadMore = () => {
    setVisibleCount(prev => Math.min(prev + TRANSACTIONS_PER_PAGE, allTransactions.length));
  };

  const handleToggleExpand = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      setVisibleCount(TRANSACTIONS_PER_PAGE);
    } else {
      setIsExpanded(true);
      if (hasMore && !hasLoadedAll) {
        await loadAllTransactions();
      }
    }
  };

  return (
    <div className="bg-white border border-[#E2EBEF] rounded-xl overflow-hidden mt-6">
      {/* Header */}
      <div className="flex items-start gap-4 px-6 py-4 bg-[#F7F7F8] border-b border-[#D3D7DE]">
        <div className="w-10 h-10 bg-ev-muted-blue text-white rounded-lg flex items-center justify-center flex-shrink-0">
          <Receipt size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold font-manrope text-[#1C1C1C] m-0">Related Transactions</h3>
          <p className="text-sm text-[#6B7280] mt-0.5 leading-snug">
            {transactionCount.toLocaleString()} transaction{transactionCount !== 1 ? 's' : ''} linked to {categoryName}
          </p>
        </div>
      </div>

      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#F7F7F8] rounded-lg p-4 text-center">
            <div className="text-lg font-bold font-manrope text-[#1C1C1C] tabular-nums">{formatCurrency(totalAmount)}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mt-1">Total Spent</div>
          </div>
          <div className="bg-[#F7F7F8] rounded-lg p-4 text-center">
            <div className="text-lg font-bold font-manrope text-[#1C1C1C] tabular-nums">{transactionCount.toLocaleString()}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mt-1">Transactions</div>
          </div>
          <div className="bg-[#F7F7F8] rounded-lg p-4 text-center">
            <div className="text-lg font-bold font-manrope text-[#1C1C1C] tabular-nums">{vendorCount}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mt-1">Vendors</div>
          </div>
        </div>

        {/* Top Vendors */}
        {topVendors && topVendors.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">Top Vendors</h4>
            <div className="flex flex-col gap-2">
              {topVendors.map((vendor, index) => (
                <div key={index} className="flex items-center gap-3 px-3 py-2 bg-[#F7F7F8] rounded-lg">
                  <div className="w-7 h-7 bg-white rounded flex items-center justify-center text-[#6B7280] flex-shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#1C1C1C] truncate">{vendor.name}</span>
                    <span className="text-xs text-[#6B7280] tabular-nums">
                      {formatCurrency(vendor.amount)} ({vendor.count} transaction{vendor.count !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="border-t border-[#E2EBEF] pt-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
              {isExpanded ? 'All Transactions' : 'Recent Transactions'}
            </h4>
            {isExpanded && (
              <span className="text-xs text-[#6B7280] tabular-nums">
                Showing {displayTransactions.length} of {transactionCount.toLocaleString()}
              </span>
            )}
          </div>

          <div className={`flex flex-col gap-3 ${isExpanded ? 'max-h-[600px] overflow-y-auto pr-1' : ''}`}>
            {displayTransactions.map((tx, index) => (
              <div key={index} className="px-4 py-3 bg-[#F7F7F8] rounded-lg border-l-2 border-ev-muted-blue">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div className="text-sm text-[#1C1C1C] flex-1 min-w-0 leading-snug">{tx.description}</div>
                  <div className="text-sm font-bold text-[#1C1C1C] whitespace-nowrap tabular-nums">{formatCurrency(tx.amount)}</div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-[#6B7280]">
                  <span className="flex items-center gap-1">
                    <Building2 size={12} className="opacity-70" />
                    {tx.vendor}
                  </span>
                  {tx.date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="opacity-70" />
                      {formatDate(tx.date)}
                    </span>
                  )}
                  {tx.paymentMethod && (
                    <span className="flex items-center gap-1">
                      <CreditCard size={12} className="opacity-70" />
                      {tx.paymentMethod}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-[#6B7280]">
              <Loader2 size={20} className="animate-spin" />
              Loading all transactions...
            </div>
          )}

          {/* Error message */}
          {loadError && (
            <div className="mt-2 px-3 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
              {loadError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 mt-4">
            {isExpanded && hasMoreToLoad && !isLoading && (
              <button
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white border border-[#E2EBEF] rounded-lg text-sm font-medium text-[#1C1C1C] hover:bg-[#F7F7F8] transition-colors duration-200 cursor-pointer font-manrope"
                onClick={handleLoadMore}
              >
                Load more ({Math.min(TRANSACTIONS_PER_PAGE, allTransactions.length - visibleCount)} more)
              </button>
            )}

            {canExpand && (
              <button
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white border border-[#E2EBEF] rounded-lg text-sm font-medium text-ev-muted-blue hover:bg-[#F7F7F8] hover:border-ev-muted-blue transition-colors duration-200 cursor-pointer font-manrope disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={handleToggleExpand}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Loading...
                  </>
                ) : isExpanded ? (
                  <>
                    <ChevronUp size={16} />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    View all {transactionCount.toLocaleString()} transactions
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
