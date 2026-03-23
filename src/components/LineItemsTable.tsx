import { FileText } from 'lucide-react';
import type { LineItem } from '../types/budget';

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

const getVarianceClasses = (amount: number): string => {
  if (amount > 0) return 'text-red-700';
  if (amount < 0) return 'text-[#059669]';
  return 'text-[#6B7280]';
};

export default function LineItemsTable({ lineItems, categoryName }: LineItemsTableProps) {
  // Calculate totals
  const totalApproved = lineItems.reduce((sum, item) => sum + item.approvedAmount, 0);
  const totalActual = lineItems.reduce((sum, item) => sum + item.actualAmount, 0);
  const totalVariance = calculateVariance(totalApproved, totalActual);

  // Sort by approved amount descending
  const sortedItems = [...lineItems].sort((a, b) => b.approvedAmount - a.approvedAmount);

  return (
    <div className="mt-6 bg-white border border-[#E2EBEF] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 px-6 py-4 bg-[#F7F7F8] border-b border-[#D3D7DE]">
        <div className="w-10 h-10 bg-ev-muted-blue text-white rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold font-manrope text-[#1C1C1C] m-0">Line Item Details</h3>
          <p className="text-sm text-[#6B7280] mt-0.5 leading-snug">
            Detailed breakdown of {lineItems.length} expenditure{lineItems.length !== 1 ? 's' : ''} in {categoryName}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[#F7F7F8]">
            <tr className="border-b border-[#D3D7DE]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#6B7280] w-[40%]">
                Description
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[#6B7280] w-[20%]">
                Budgeted
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[#6B7280] w-[20%]">
                Actual
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[#6B7280] w-[20%]">
                Variance
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const variance = calculateVariance(item.approvedAmount, item.actualAmount);
              return (
                <tr key={index} className="border-b border-[#E2EBEF] hover:bg-[#F7F7F8] transition-colors duration-150">
                  <td className="px-4 py-3 text-sm font-medium text-[#1C1C1C] leading-snug">
                    {item.description || 'No description provided'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[#1C1C1C] text-right tabular-nums">
                    {formatCurrency(item.approvedAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[#1C1C1C] text-right tabular-nums">
                    {formatCurrency(item.actualAmount)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${getVarianceClasses(variance.amount)}`}>
                    {variance.amount !== 0 ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-medium">
                          {variance.amount > 0 ? '+' : ''}{formatCurrency(variance.amount)}
                        </span>
                        <span className="text-xs">
                          ({variance.percentage > 0 ? '+' : ''}{variance.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-medium">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white border-t-2 border-[#D3D7DE]">
            <tr>
              <td className="px-4 py-3 text-sm font-bold text-[#1C1C1C]">
                Total
              </td>
              <td className="px-4 py-3 text-sm font-bold text-ev-muted-blue text-right tabular-nums">
                {formatCurrency(totalApproved)}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-ev-muted-blue text-right tabular-nums">
                {formatCurrency(totalActual)}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${getVarianceClasses(totalVariance.amount)}`}>
                {totalVariance.amount !== 0 ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-bold">
                      {totalVariance.amount > 0 ? '+' : ''}{formatCurrency(totalVariance.amount)}
                    </span>
                    <span className="text-xs">
                      ({totalVariance.percentage > 0 ? '+' : ''}{totalVariance.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-bold">—</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-6 px-6 py-3 bg-[#F7F7F8] border-t border-[#E2EBEF] text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#059669] flex-shrink-0"></span>
          <span className="text-[#6B7280]">Under Budget</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#6B7280] flex-shrink-0"></span>
          <span className="text-[#6B7280]">On Budget</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-700 flex-shrink-0"></span>
          <span className="text-[#6B7280]">Over Budget</span>
        </div>
      </div>
    </div>
  );
}
