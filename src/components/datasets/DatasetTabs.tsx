import { DollarSign, TrendingDown } from 'lucide-react';

interface DatasetCardsProps {
  activeDataset: string;
  onDatasetChange: (datasetId: string) => void;
  revenueTotal?: number;
  operatingTotal?: number;
  availableDatasets?: string[];
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
};

const CARDS = [
  {
    id: 'operating' as const,
    label: 'Money Out',
    icon: TrendingDown,
    description: 'How funds are spent',
  },
  {
    id: 'revenue' as const,
    label: 'Money In',
    icon: DollarSign,
    description: 'Where funds come from',
  },
];

export default function DatasetTabs({
  activeDataset,
  onDatasetChange,
  revenueTotal,
  operatingTotal,
  availableDatasets,
}: DatasetCardsProps) {
  const available = availableDatasets ?? ['operating', 'revenue'];

  const getTotal = (id: string) => {
    if (id === 'operating' && operatingTotal != null) return operatingTotal;
    if (id === 'revenue' && revenueTotal != null) return revenueTotal;
    return null;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {CARDS.map(({ id, label, icon: Icon, description }) => {
        const isActive = id === activeDataset;
        const isDisabled = !available.includes(id);
        const total = getTotal(id);

        return (
          <button
            key={id}
            onClick={() => !isDisabled && onDatasetChange(id)}
            disabled={isDisabled}
            className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer font-manrope focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2
              ${isActive
                ? 'border-ev-muted-blue bg-white shadow-sm'
                : 'border-ev-gray-200 bg-ev-gray-50 hover:bg-white hover:border-ev-gray-300'
              }
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} className={isActive ? 'text-ev-muted-blue' : 'text-ev-gray-400'} />
              <span className={`text-sm font-semibold ${isActive ? 'text-ev-muted-blue' : 'text-ev-gray-500'}`}>
                {label}
              </span>
            </div>
            {total != null && (
              <div className={`text-2xl font-bold ${isActive ? 'text-ev-gray-900' : 'text-ev-gray-600'}`}>
                {formatCurrency(total)}
              </div>
            )}
            <div className="text-xs text-ev-gray-400 mt-1">{description}</div>
          </button>
        );
      })}
    </div>
  );
}

export { CARDS as DATASETS };
