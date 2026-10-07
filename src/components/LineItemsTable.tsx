import { FileText } from 'lucide-react';
import { visibleMoneyColumns } from './moneyColumns';
import type { LineItem } from '../types/budget';

const VENDOR_DESCRIPTIONS: Record<string, string> = {
  'Read.AI': 'We record and transcribe each of our meetings to help with alignment and to normalize having a high degree of transparency.',
  'MindMeister': 'Mind map service that allows us to convey and explore complicated solutions with clarity and simplicity.',
  'Anthropic (Claude)': 'AI assistant used for research, code generation, and drafting — the engine behind much of our rapid development.',
  'OpenAI (ChatGPT)': 'AI assistant used for research, writing, and ideation across the team.',
  'Figma': 'Collaborative design tool where our UI/UX team builds and shares every screen and prototype.',
  'Supabase': 'Our open-source database and backend — stores all city financial data and powers the platform.',
  'TechSoup (AWS Credits)': 'Nonprofit technology program that provides discounted AWS cloud infrastructure credits.',
  'AWS': 'Cloud infrastructure hosting our application servers and data pipelines.',
  'GoDaddy': 'Domain registrar for empowered.vote and related domains.',
};

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
  if (amount > 0) return 'text-red-700 dark:text-red-400';
  if (amount < 0) return 'text-[#059669] dark:text-emerald-400';
  return 'text-ev-gray-500';
};

export default function LineItemsTable({ lineItems, categoryName }: LineItemsTableProps) {
  // Calculate totals
  // ⚠⚠ ISSUE #217 — WHICH COLUMNS THIS SOURCE ACTUALLY PUBLISHED.
  // An actuals-only source carries approvedAmount: 0 on every row. Rendered
  // under a "Budgeted" heading beside a red −100% variance, that told the
  // reader Redmond budgeted $0 and spent $140,249,393.
  const cols = visibleMoneyColumns(lineItems);

  const totalApproved = lineItems.reduce((sum, item) => sum + item.approvedAmount, 0);
  const totalActual = lineItems.reduce((sum, item) => sum + item.actualAmount, 0);
  const totalVariance = calculateVariance(totalApproved, totalActual);

  // ⚠ Sort by a column that HAS figures. Sorting by approvedAmount on an
  // actuals-only source compares zero with zero, so the largest line item
  // appeared in whatever order the API happened to return — Public safety,
  // 47% of Redmond's general fund, could land anywhere in the table.
  const sortedItems = [...lineItems].sort((a, b) => (cols.budgeted
    ? b.approvedAmount - a.approvedAmount
    : (b.actualAmount ?? 0) - (a.actualAmount ?? 0)));

  return (
    <div className="mt-6 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 px-6 py-4 bg-[#F7F7F8] dark:bg-ev-gray-900 border-b border-[#D3D7DE] dark:border-ev-gray-700">
        <div className="w-10 h-10 bg-ev-muted-blue text-white rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold font-manrope text-[#1C1C1C] dark:text-ev-gray-100 m-0">Line Item Details</h3>
          <p className="text-sm text-ev-gray-500 mt-0.5 leading-snug">
            Detailed breakdown of {lineItems.length} expenditure{lineItems.length !== 1 ? 's' : ''} in {categoryName}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[#F7F7F8] dark:bg-ev-gray-900">
            <tr className="border-b border-[#D3D7DE] dark:border-ev-gray-700">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ev-gray-500 w-[40%]">
                Description
              </th>
              {cols.budgeted && (
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-ev-gray-500 w-[20%]">
                  Budgeted
                </th>
              )}
              {cols.actual && (
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-ev-gray-500 w-[20%]">
                  Actual
                </th>
              )}
              {cols.variance && (
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-ev-gray-500 w-[20%]">
                  Variance
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const variance = calculateVariance(item.approvedAmount, item.actualAmount);
              return (
                <tr key={index} className="border-b border-[#E2EBEF] dark:border-ev-gray-700 hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700 transition-colors duration-150">
                  <td className="px-4 py-3 leading-snug">
                    <span className="text-sm font-medium text-[#1C1C1C] dark:text-ev-gray-200">
                      {item.description || 'No description provided'}
                    </span>
                    {item.metadata?.vendor && VENDOR_DESCRIPTIONS[item.metadata.vendor] && (
                      <p className="text-xs text-ev-gray-500 mt-0.5 leading-relaxed">
                        {VENDOR_DESCRIPTIONS[item.metadata.vendor]}
                      </p>
                    )}
                  </td>
                  {cols.budgeted && (
                    <td className="px-4 py-3 text-sm font-medium text-[#1C1C1C] dark:text-ev-gray-200 text-right tabular-nums">
                      {formatCurrency(item.approvedAmount)}
                    </td>
                  )}
                  {cols.actual && (
                    <td className="px-4 py-3 text-sm font-medium text-[#1C1C1C] dark:text-ev-gray-200 text-right tabular-nums">
                      {formatCurrency(item.actualAmount)}
                    </td>
                  )}
                  {cols.variance && (
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
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white dark:bg-ev-gray-800 border-t-2 border-[#D3D7DE] dark:border-ev-gray-600">
            <tr>
              <td className="px-4 py-3 text-sm font-bold text-[#1C1C1C] dark:text-ev-gray-100">
                Total
              </td>
              {cols.budgeted && (
                <td className="px-4 py-3 text-sm font-bold text-ev-muted-blue text-right tabular-nums">
                  {formatCurrency(totalApproved)}
                </td>
              )}
              {cols.actual && (
                <td className="px-4 py-3 text-sm font-bold text-ev-muted-blue text-right tabular-nums">
                  {formatCurrency(totalActual)}
                </td>
              )}
              {cols.variance && (
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
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ⚠ Why a column is missing. Removing one silently would trade a false
          claim for an unexplained gap; this says it is a fact about the SOURCE,
          not about the government. */}
      {cols.note && (
        <div className="px-6 py-3 bg-[#F7F7F8] dark:bg-ev-gray-900 border-t border-[#E2EBEF] dark:border-ev-gray-700">
          <p className="text-sm text-ev-gray-500 m-0 leading-snug">{cols.note}</p>
        </div>
      )}

      {/* Legend — only when there is a budget to be under or over. */}
      {cols.variance && (
      <div className="flex gap-6 px-6 py-3 bg-[#F7F7F8] dark:bg-ev-gray-900 border-t border-[#E2EBEF] dark:border-ev-gray-700 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#059669] dark:bg-emerald-400 flex-shrink-0"></span>
          <span className="text-ev-gray-500">Under Budget</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#6B7280] dark:bg-ev-gray-500 flex-shrink-0"></span>
          <span className="text-ev-gray-500">On Budget</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-700 dark:bg-red-400 flex-shrink-0"></span>
          <span className="text-ev-gray-500">Over Budget</span>
        </div>
      </div>
      )}
    </div>
  );
}
