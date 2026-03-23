import { Receipt } from 'lucide-react';
import type { LineItem } from '../types/budget';

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
    <div className="mt-6 bg-white border border-[#E2EBEF] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 px-6 py-4 bg-[#F7F7F8] border-b border-[#D3D7DE]">
        <div className="w-10 h-10 bg-ev-muted-blue text-white rounded-lg flex items-center justify-center flex-shrink-0">
          <Receipt size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold font-manrope text-[#1C1C1C] m-0">Recent Transactions</h3>
          <p className="text-sm text-[#6B7280] mt-0.5 leading-snug">
            {lineItems.length} transaction{lineItems.length !== 1 ? 's' : ''} from {uniqueVendors} vendor{uniqueVendors !== 1 ? 's' : ''} in {categoryName}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 pb-4">
        <div className="bg-[#F7F7F8] rounded-lg p-4 border border-[#E2EBEF]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Total Spending</div>
          <div className="text-2xl font-bold font-manrope text-ev-muted-blue tabular-nums">{formatCurrency(totalAmount)}</div>
        </div>
        <div className="bg-[#F7F7F8] rounded-lg p-4 border border-[#E2EBEF]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Transactions</div>
          <div className="text-2xl font-bold font-manrope text-ev-muted-blue tabular-nums">{lineItems.length.toLocaleString()}</div>
        </div>
        <div className="bg-[#F7F7F8] rounded-lg p-4 border border-[#E2EBEF]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Unique Vendors</div>
          <div className="text-2xl font-bold font-manrope text-ev-muted-blue tabular-nums">{uniqueVendors}</div>
        </div>
        <div className="bg-[#F7F7F8] rounded-lg p-4 border border-[#E2EBEF]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Avg Transaction</div>
          <div className="text-2xl font-bold font-manrope text-ev-muted-blue tabular-nums">{formatCurrency(totalAmount / lineItems.length)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-[#F7F7F8]">
            <tr className="border-b border-[#D3D7DE]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#6B7280] w-[130px]">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#6B7280] w-[200px]">
                Vendor
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[#6B7280] w-[140px]">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => (
              <tr key={index} className="border-b border-[#E2EBEF] hover:bg-[#F7F7F8] transition-colors duration-150">
                <td className="px-4 py-3 text-sm font-medium text-[#6B7280] whitespace-nowrap align-top">
                  {item.metadata?.date ? formatDate(item.metadata.date) : '—'}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="text-sm font-medium text-[#1C1C1C] leading-snug mb-0.5">
                    {item.description || 'No description provided'}
                  </div>
                  {item.metadata?.expenseCategory && (
                    <div className="text-xs text-[#6B7280] italic">
                      {item.metadata.expenseCategory}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-[#6B7280] align-top">
                  {item.metadata?.vendor || '—'}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-ev-muted-blue text-right whitespace-nowrap tabular-nums align-top">
                  {formatCurrency(item.actualAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[#F7F7F8] border-t-2 border-[#D3D7DE]">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-sm font-bold text-[#1C1C1C]">
                Total
              </td>
              <td className="px-4 py-3 text-sm font-bold text-ev-muted-blue text-right tabular-nums">
                {formatCurrency(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
