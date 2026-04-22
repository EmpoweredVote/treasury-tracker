import { useCallback, useEffect, useRef, useState } from 'react';
import { DollarSign, TrendingDown } from 'lucide-react';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';

interface DatasetCardsProps {
  activeDataset: string;
  onDatasetChange: (datasetId: string) => void;
  revenueTotal?: number;
  operatingTotal?: number;
  availableDatasets?: string[];
  isNonprofit?: boolean;
}

const formatCurrency = (amount: number, exact = false): string => {
  if (exact) return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  isNonprofit = false,
}: DatasetCardsProps) {
  const available = availableDatasets ?? ['operating', 'revenue'];

  // Revenue count-up animation + green-glow settle (revenue card only)
  const revenueAnimTarget = revenueTotal ?? 0;
  const [revenueGlowing, setRevenueGlowing] = useState(false);
  const glowTimerRef = useRef<number | null>(null);

  // CRITICAL: onComplete MUST be wrapped in useCallback with stable deps
  const handleRevenueSettled = useCallback(() => {
    setRevenueGlowing(true);
    if (glowTimerRef.current != null) window.clearTimeout(glowTimerRef.current);
    glowTimerRef.current = window.setTimeout(() => setRevenueGlowing(false), 2000);
  }, []);

  const animatedRevenue = useAnimatedCounter(revenueAnimTarget, 600, handleRevenueSettled);

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (glowTimerRef.current != null) window.clearTimeout(glowTimerRef.current);
    };
  }, []);

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
              <div
                className={`text-2xl font-bold inline-block rounded-sm px-0.5 ${isActive ? 'text-ev-gray-900' : 'text-ev-gray-600'}`}
                style={id === 'revenue' ? {
                  transition: 'box-shadow 700ms ease-out',
                  boxShadow: revenueGlowing
                    ? '0 0 0 2px #22c55e, 0 0 16px 4px rgba(34, 197, 94, 0.4)'
                    : 'none',
                } : undefined}
              >
                {id === 'revenue' ? formatCurrency(animatedRevenue, isNonprofit) : formatCurrency(total, isNonprofit)}
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
