import { useState, useCallback } from 'react';
import { Receipt, Building2, Calendar, CreditCard, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { LinkedTransactionSummary, LinkedTransaction } from '../types/budget';
import './LinkedTransactionsPanel.css';

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
      // Load all transactions if we haven't yet and there are more available
      if (hasMore && !hasLoadedAll) {
        await loadAllTransactions();
      }
    }
  };

  return (
    <div className="linked-transactions-panel">
      <div className="linked-transactions-header">
        <div className="linked-transactions-icon">
          <Receipt size={20} />
        </div>
        <div>
          <h3>Related Transactions</h3>
          <p className="linked-transactions-subtitle">
            {transactionCount.toLocaleString()} transaction{transactionCount !== 1 ? 's' : ''} linked to {categoryName}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="linked-transactions-stats">
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(totalAmount)}</div>
          <div className="stat-label">Total Spent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{transactionCount.toLocaleString()}</div>
          <div className="stat-label">Transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{vendorCount}</div>
          <div className="stat-label">Vendors</div>
        </div>
      </div>

      {/* Top Vendors */}
      {topVendors && topVendors.length > 0 && (
        <div className="linked-transactions-vendors">
          <h4>Top Vendors</h4>
          <div className="vendor-list">
            {topVendors.map((vendor, index) => (
              <div key={index} className="vendor-item">
                <div className="vendor-icon">
                  <Building2 size={16} />
                </div>
                <div className="vendor-info">
                  <span className="vendor-name">{vendor.name}</span>
                  <span className="vendor-stats">
                    {formatCurrency(vendor.amount)} ({vendor.count} transaction{vendor.count !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="linked-transactions-list">
        <div className="transactions-list-header">
          <h4>{isExpanded ? 'All Transactions' : 'Recent Transactions'}</h4>
          {isExpanded && (
            <span className="transactions-count">
              Showing {displayTransactions.length} of {transactionCount.toLocaleString()}
            </span>
          )}
        </div>

        <div className={`transaction-list ${isExpanded ? 'expanded' : ''}`}>
          {displayTransactions.map((tx, index) => (
            <div key={index} className="transaction-item">
              <div className="transaction-main">
                <div className="transaction-description">{tx.description}</div>
                <div className="transaction-amount">{formatCurrency(tx.amount)}</div>
              </div>
              <div className="transaction-meta">
                <span className="transaction-vendor">
                  <Building2 size={12} />
                  {tx.vendor}
                </span>
                {tx.date && (
                  <span className="transaction-date">
                    <Calendar size={12} />
                    {formatDate(tx.date)}
                  </span>
                )}
                {tx.paymentMethod && (
                  <span className="transaction-payment">
                    <CreditCard size={12} />
                    {tx.paymentMethod}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="loading-indicator">
            <Loader2 size={20} className="spinner" />
            Loading all transactions...
          </div>
        )}

        {/* Error message */}
        {loadError && (
          <div className="load-error">
            {loadError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="transactions-actions">
          {isExpanded && hasMoreToLoad && !isLoading && (
            <button className="load-more-button" onClick={handleLoadMore}>
              Load more ({Math.min(TRANSACTIONS_PER_PAGE, allTransactions.length - visibleCount)} more)
            </button>
          )}

          {canExpand && (
            <button
              className="toggle-expand-button"
              onClick={handleToggleExpand}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spinner" />
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
  );
}
