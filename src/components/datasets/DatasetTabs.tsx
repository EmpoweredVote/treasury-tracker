import { useCallback, useEffect, useRef, useState } from 'react';
import { DollarSign, TrendingDown, Users } from 'lucide-react';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';

interface DatasetCardsProps {
  activeDataset: string;
  onDatasetChange: (datasetId: string) => void;
  revenueTotal?: number;
  operatingTotal?: number;
  salariesTotal?: number;
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

const BASE_CARDS = [
  {
    id: 'revenue' as const,
    label: 'Money In',
    icon: DollarSign,
    description: 'Where funds come from',
  },
  {
    id: 'operating' as const,
    label: 'Money Out',
    icon: TrendingDown,
    description: 'How funds are spent',
  },
];

const SALARIES_CARD = {
  id: 'salaries' as const,
  label: 'Employees',
  icon: Users,
  description: 'Employee compensation',
};

// Per-tile accent, shown on desktop hover and when the tile is selected.
// Border stays a touch brighter than the text; text values pass WCAG AA on
// both the white (light) and ev-gray-800 (dark) tile backgrounds.
const ACCENTS: Record<string, { border: string; text: string }> = {
  revenue: { border: 'border-[#16A34A] dark:border-[#4ADE80]', text: 'text-[#15803D] dark:text-[#4ADE80]' }, // green
  operating: { border: 'border-ev-muted-blue', text: 'text-ev-muted-blue' }, // teal
  salaries: { border: 'border-[#EA580C] dark:border-[#FB923C]', text: 'text-[#C2410C] dark:text-[#FB923C]' }, // orange
};

export default function DatasetTabs({
  activeDataset,
  onDatasetChange,
  revenueTotal,
  operatingTotal,
  salariesTotal,
  availableDatasets,
  isNonprofit = false,
}: DatasetCardsProps) {
  const available = availableDatasets ?? ['operating', 'revenue'];
  const hasSalaries = available.includes('salaries');
  const CARDS = hasSalaries ? [...BASE_CARDS, SALARIES_CARD] : BASE_CARDS;

  // Desktop-only hover preview: pointers with a true hover capability get the
  // accent/glow on mouseover; touch devices fall back to selection only.
  const [hoverCapable] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: hover)').matches
      : false,
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Revenue count-up animation + green-glow settle (revenue card only)
  const revenueAnimTarget = revenueTotal ?? 0;
  const [revenueGlowing, setRevenueGlowing] = useState(false);
  const glowTimerRef = useRef<number | null>(null);
  // Skip the glow on the initial null→value load; only glow on genuine increases.
  const isFirstRevenueAnimRef = useRef(true);

  // CRITICAL: onComplete MUST be wrapped in useCallback with stable deps
  const handleRevenueSettled = useCallback(() => {
    if (isFirstRevenueAnimRef.current) {
      isFirstRevenueAnimRef.current = false;
      return;
    }
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
    if (id === 'salaries' && salariesTotal != null) return salariesTotal;
    return null;
  };

  return (
    <div className={`grid grid-cols-1 gap-3 ${hasSalaries ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {CARDS.map(({ id, label, icon: Icon, description }) => {
        const isActive = id === activeDataset;
        const isDisabled = !available.includes(id);
        const total = getTotal(id);

        // A tile is "highlighted" when selected OR (on desktop) hovered — that
        // drives its accent border/text: green for Money In, teal for Money Out,
        // orange for Employees.
        const isHovered = hoverCapable && !isDisabled && hoveredId === id;
        const highlighted = isActive || isHovered;
        const accent = ACCENTS[id] ?? ACCENTS.operating;

        // Employees runs hot when selected or hovered. While hot, it glows orange
        // and the Money Out (operating) tile beside it fills its right portion
        // orange, proportional to the employee-compensation share of spending.
        const salariesHot = activeDataset === 'salaries' || (hoverCapable && hoveredId === 'salaries');
        const salariesGlow = id === 'salaries' && salariesHot;
        const showEmpFill =
          id === 'operating' &&
          salariesHot &&
          operatingTotal != null &&
          salariesTotal != null &&
          operatingTotal > 0;
        const empPct = showEmpFill ? Math.min(100, (salariesTotal! / operatingTotal!) * 100) : 0;

        return (
          <button
            key={id}
            onClick={() => !isDisabled && onDatasetChange(id)}
            onMouseEnter={() => { if (!isDisabled) setHoveredId(id); }}
            onMouseLeave={() => setHoveredId((prev) => (prev === id ? null : prev))}
            disabled={isDisabled}
            {...(isNonprofit && id === 'revenue' ? { 'data-donate-target': '' } : {})}
            style={salariesGlow ? { boxShadow: '0 0 0 2px #EA580C, 0 0 18px 3px rgba(234, 88, 12, 0.35)' } : undefined}
            className={`relative overflow-hidden text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer font-manrope focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2
              ${highlighted
                ? `${accent.border} bg-white dark:bg-ev-gray-800 ${isActive ? 'shadow-sm' : ''}`
                : 'border-ev-gray-200 dark:border-ev-gray-700 bg-ev-gray-50 dark:bg-ev-gray-900'
              }
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
          >
            {showEmpFill && (
              <div
                aria-hidden
                className="absolute inset-y-0 right-0 pointer-events-none"
                style={{
                  width: `${empPct}%`,
                  background: 'linear-gradient(to left, rgba(234, 88, 12, 0.30), rgba(234, 88, 12, 0.06))',
                }}
              />
            )}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={highlighted ? accent.text : 'text-ev-gray-400'} />
                <span className={`text-sm font-semibold ${highlighted ? accent.text : 'text-ev-gray-500 dark:text-ev-gray-400'}`}>
                  {label}
                </span>
              </div>
              {total != null && (
                <div
                  className={`text-2xl font-bold inline-block rounded-sm px-0.5 ${highlighted ? 'text-ev-gray-900 dark:text-ev-gray-100' : 'text-ev-gray-600 dark:text-ev-gray-300'}`}
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
              <div className="text-xs text-ev-gray-400 dark:text-ev-gray-500 mt-1">{description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { BASE_CARDS as DATASETS };
