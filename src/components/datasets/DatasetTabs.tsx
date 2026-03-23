import { useState } from 'react';
import { DollarSign, TrendingDown, Users, ChevronDown } from 'lucide-react';

export interface Dataset {
  id: 'revenue' | 'operating' | 'salaries';
  label: string;
  icon: typeof DollarSign;
  description: string;
}

interface DatasetTabsProps {
  activeDataset: string;
  onDatasetChange: (datasetId: string) => void;
  revenueTotal?: number;
  operatingTotal?: number;
  availableDatasets?: string[];  // datasets available for current entity
}

const DATASETS: Dataset[] = [
  {
    id: 'revenue',
    label: 'Money In',
    icon: DollarSign,
    description: 'Where funds come from'
  },
  {
    id: 'operating',
    label: 'Money Out',
    icon: TrendingDown,
    description: 'How funds are spent'
  },
  {
    id: 'salaries',
    label: 'People',
    icon: Users,
    description: 'Workforce & compensation'
  }
];

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function DatasetTabs({ activeDataset, onDatasetChange, revenueTotal, operatingTotal, availableDatasets }: DatasetTabsProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Default to all datasets if prop omitted (backward compat)
  const available = availableDatasets ?? DATASETS.map(d => d.id);

  const activeDatasetObj = DATASETS.find(d => d.id === activeDataset) || DATASETS[1];
  const IconComponent = activeDatasetObj.icon;

  const handleDatasetSelect = (datasetId: string) => {
    if (!available.includes(datasetId)) return;
    onDatasetChange(datasetId);
    setMobileMenuOpen(false);
  };

  const getDatasetTotal = (datasetId: string): string | null => {
    if (datasetId === 'revenue' && revenueTotal) {
      return formatCurrency(revenueTotal);
    }
    if (datasetId === 'operating' && operatingTotal) {
      return formatCurrency(operatingTotal);
    }
    return null;
  };

  return (
    <div className="w-full">
      {/* Mobile Dropdown (< 768px) */}
      <div className="block md:hidden rounded-xl border border-[#E2EBEF] bg-white overflow-hidden">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full px-4 py-3 flex items-center justify-between bg-transparent cursor-pointer transition-colors duration-200 hover:bg-[#F7F7F8] font-manrope focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2"
          aria-label="Select dataset"
          aria-expanded={mobileMenuOpen}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-ev-muted-blue flex items-center justify-center shrink-0">
              <IconComponent size={18} className="text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-[#1C1C1C] leading-tight">
                {activeDatasetObj.label}
                {getDatasetTotal(activeDatasetObj.id) && (
                  <span className="text-ev-muted-blue font-bold ml-1"> · {getDatasetTotal(activeDatasetObj.id)}</span>
                )}
              </div>
              <div className="text-xs text-[#6B7280] mt-0.5">
                {activeDatasetObj.description}
              </div>
            </div>
          </div>
          <ChevronDown
            size={20}
            className={`text-[#6B7280] shrink-0 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-180' : 'rotate-0'}`}
          />
        </button>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-[#E2EBEF] bg-[#F7F7F8]">
            {DATASETS.map((dataset) => {
              const Icon = dataset.icon;
              const isActive = dataset.id === activeDataset;
              const isDisabled = !available.includes(dataset.id);
              const total = getDatasetTotal(dataset.id);

              return (
                <button
                  key={dataset.id}
                  onClick={() => handleDatasetSelect(dataset.id)}
                  className={`w-full px-4 py-3 flex items-center gap-3.5 border-none border-l-4 text-left font-manrope cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'border-l-ev-muted-blue bg-white'
                      : 'border-l-transparent hover:bg-white'
                  } ${isDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                  aria-disabled={isDisabled || undefined}
                  title={isDisabled ? `No ${dataset.label} data available` : undefined}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-ev-muted-blue' : 'bg-[#6B7280]'}`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div>
                    <div className={`text-sm leading-tight ${isActive ? 'font-bold text-[#1C1C1C]' : 'font-medium text-[#1C1C1C]'}`}>
                      {dataset.label}
                      {total && <span className="text-ev-muted-blue font-bold ml-1"> · {total}</span>}
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {dataset.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Tabs (>= 768px) */}
      <div className="hidden md:flex gap-0 border-b border-[#E2EBEF]">
        {DATASETS.map((dataset) => {
          const Icon = dataset.icon;
          const isActive = dataset.id === activeDataset;
          const isDisabled = !available.includes(dataset.id);
          const total = getDatasetTotal(dataset.id);

          return (
            <button
              key={dataset.id}
              onClick={() => handleDatasetSelect(dataset.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 cursor-pointer font-manrope focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2 ${
                isActive
                  ? 'text-ev-muted-blue border-b-ev-muted-blue font-bold'
                  : 'text-[#6B7280] border-transparent hover:text-[#374151]'
              } ${isDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
              aria-disabled={isDisabled || undefined}
              title={isDisabled ? `No ${dataset.label} data available` : undefined}
            >
              <span className="flex items-center gap-2">
                <Icon size={16} />
                {dataset.label}
                {total && <span className="text-xs font-bold ml-1">{total}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DATASETS };
