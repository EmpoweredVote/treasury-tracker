import { Receipt } from 'lucide-react';
import type { LineItem } from '../types/budget';
import './TransactionLineItemsTable.css';

interface TransactionLineItemsTableProps {
  lineItems: LineItem[];
  categoryName: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export default function TransactionLineItemsTable({ lineItems, categoryName }: TransactionLineItemsTableProps) {
  // Calculate total
  const totalAmount = lineItems.reduce((sum, item) => sum + item.actualAmount, 0);
  
  // Sort by date descending (most recent first)
  const sortedItems = [...lineItems].sort((a, b) => {
    const dateA = a.metadata?.date ? new Date(a.metadata.date).getTime() : 0;
    const dateB = b.metadata?.date ? new Date(b.metadata.date).getTime() : 0;
    return dateB - dateA;
  });

  // Get unique vendors count
  const uniqueVendors = new Set(sortedItems.map(item => item.metadata?.vendor).filter(Boolean)).size;

  return (
    <div className="transaction-items-section">
      <div className="transaction-items-header">
        <div className="transaction-items-icon">
          <Receipt size={20} />
        </div>
        <div>
          <h3>Recent Transactions</h3>
          <p className="transaction-items-subtitle">
            {lineItems.length} transaction{lineItems.length !== 1 ? 's' : ''} from {uniqueVendors} vendor{uniqueVendors !== 1 ? 's' : ''} in {categoryName}
          </p>
        </div>
      </div>

      <div className="transaction-summary-cards">
        <div className="transaction-summary-card">
          <div className="summary-card-label">Total Spending</div>
          <div className="summary-card-value">{formatCurrency(totalAmount)}</div>
        </div>
        <div className="transaction-summary-card">
          <div className="summary-card-label">Transactions</div>
          <div className="summary-card-value">{lineItems.length.toLocaleString()}</div>
        </div>
        <div className="transaction-summary-card">
          <div className="summary-card-label">Unique Vendors</div>
          <div className="summary-card-value">{uniqueVendors}</div>
        </div>
        <div className="transaction-summary-card">
          <div className="summary-card-label">Avg Transaction</div>
          <div className="summary-card-value">{formatCurrency(totalAmount / lineItems.length)}</div>
        </div>
      </div>

      <div className="transaction-items-table-container">
        <table className="transaction-items-table">
          <thead>
            <tr>
              <th className="date-column">Date</th>
              <th className="description-column">Description</th>
              <th className="vendor-column">Vendor</th>
              <th className="amount-column">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              return (
                <tr key={index}>
                  <td className="date-cell">
                    {item.metadata?.date ? formatDate(item.metadata.date) : '—'}
                  </td>
                  <td className="description-cell">
                    <div className="transaction-description">
                      {item.description || 'No description provided'}
                    </div>
                    {item.metadata?.expenseCategory && (
                      <div className="transaction-category">
                        {item.metadata.expenseCategory}
                      </div>
                    )}
                  </td>
                  <td className="vendor-cell">
                    {item.metadata?.vendor || '—'}
                  </td>
                  <td className="amount-cell">
                    {formatCurrency(item.actualAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={3} className="description-cell">
                <strong>Total</strong>
              </td>
              <td className="amount-cell">
                <strong>{formatCurrency(totalAmount)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
