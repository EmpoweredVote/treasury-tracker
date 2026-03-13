import { FileText } from 'lucide-react';
import type { LineItem } from '../types/budget';
import './LineItemsTable.css';

interface LineItemsTableProps {
  lineItems: LineItem[];
  categoryName: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const calculateVariance = (approved: number, actual: number): { amount: number; percentage: number } => {
  const amount = actual - approved;
  const percentage = approved !== 0 ? (amount / approved) * 100 : 0;
  return { amount, percentage };
};

export default function LineItemsTable({ lineItems, categoryName }: LineItemsTableProps) {
  // Calculate totals
  const totalApproved = lineItems.reduce((sum, item) => sum + item.approvedAmount, 0);
  const totalActual = lineItems.reduce((sum, item) => sum + item.actualAmount, 0);
  const totalVariance = calculateVariance(totalApproved, totalActual);
  
  // Sort by approved amount descending
  const sortedItems = [...lineItems].sort((a, b) => b.approvedAmount - a.approvedAmount);

  return (
    <div className="line-items-section">
      <div className="line-items-header">
        <div className="line-items-icon">
          <FileText size={20} />
        </div>
        <div>
          <h3>Line Item Details</h3>
          <p className="line-items-subtitle">
            Detailed breakdown of {lineItems.length} expenditure{lineItems.length !== 1 ? 's' : ''} in {categoryName}
          </p>
        </div>
      </div>

      <div className="line-items-table-container">
        <table className="line-items-table">
          <thead>
            <tr>
              <th className="description-column">Description</th>
              <th className="amount-column">Budgeted</th>
              <th className="amount-column">Actual</th>
              <th className="variance-column">Variance</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const variance = calculateVariance(item.approvedAmount, item.actualAmount);
              const varianceClass = variance.amount > 0 ? 'over-budget' : variance.amount < 0 ? 'under-budget' : 'on-budget';
              
              return (
                <tr key={index}>
                  <td className="description-cell">
                    {item.description || 'No description provided'}
                  </td>
                  <td className="amount-cell">
                    {formatCurrency(item.approvedAmount)}
                  </td>
                  <td className="amount-cell">
                    {formatCurrency(item.actualAmount)}
                  </td>
                  <td className={`variance-cell ${varianceClass}`}>
                    {variance.amount !== 0 && (
                      <>
                        <span className="variance-amount">
                          {variance.amount > 0 ? '+' : ''}{formatCurrency(variance.amount)}
                        </span>
                        <span className="variance-percentage">
                          ({variance.percentage > 0 ? '+' : ''}{variance.percentage.toFixed(1)}%)
                        </span>
                      </>
                    )}
                    {variance.amount === 0 && <span className="variance-amount">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td className="description-cell">
                <strong>Total</strong>
              </td>
              <td className="amount-cell">
                <strong>{formatCurrency(totalApproved)}</strong>
              </td>
              <td className="amount-cell">
                <strong>{formatCurrency(totalActual)}</strong>
              </td>
              <td className={`variance-cell ${totalVariance.amount > 0 ? 'over-budget' : totalVariance.amount < 0 ? 'under-budget' : 'on-budget'}`}>
                {totalVariance.amount !== 0 && (
                  <strong>
                    <span className="variance-amount">
                      {totalVariance.amount > 0 ? '+' : ''}{formatCurrency(totalVariance.amount)}
                    </span>
                    <span className="variance-percentage">
                      ({totalVariance.percentage > 0 ? '+' : ''}{totalVariance.percentage.toFixed(1)}%)
                    </span>
                  </strong>
                )}
                {totalVariance.amount === 0 && <strong>—</strong>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className="line-items-legend">
        <div className="legend-item">
          <span className="legend-dot under-budget"></span>
          <span className="legend-label">Under Budget</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot on-budget"></span>
          <span className="legend-label">On Budget</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot over-budget"></span>
          <span className="legend-label">Over Budget</span>
        </div>
      </div>
    </div>
  );
}
