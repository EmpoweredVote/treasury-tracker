import { useState } from 'react';
import { DollarSign, TrendingDown, Users, ChevronDown } from 'lucide-react';

export interface Dataset {
  id: 'revenue' | 'operating' | 'salaries';
  label: string;
  icon: typeof DollarSign;
  color: string;
  lightColor: string;
  description: string;
}

interface DatasetTabsProps {
  activeDataset: string;
  onDatasetChange: (datasetId: string) => void;
  revenueTotal?: number;
  operatingTotal?: number;
}

const DATASETS: Dataset[] = [
  {
    id: 'revenue',
    label: 'Money In',
    icon: DollarSign,
    color: '#585937', // olive-600
    lightColor: '#6e744e', // olive-500
    description: 'Where funds come from'
  },
  {
    id: 'operating',
    label: 'Money Out',
    icon: TrendingDown,
    color: '#00657c', // navy-600
    lightColor: '#417d8a', // navy-500
    description: 'How funds are spent'
  },
  {
    id: 'salaries',
    label: 'People',
    icon: Users,
    color: '#9d3c89', // purple-600
    lightColor: '#b957a8', // purple-500
    description: 'Workforce & compensation'
  }
  // Transactions tab removed - transactions are now shown within Money Out drill-down
];

const formatCurrency = (amount: number): string => {
  // Format large numbers more compactly
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

export default function DatasetTabs({ activeDataset, onDatasetChange, revenueTotal, operatingTotal }: DatasetTabsProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const activeDatasetObj = DATASETS.find(d => d.id === activeDataset) || DATASETS[1];
  const IconComponent = activeDatasetObj.icon;

  const handleDatasetSelect = (datasetId: string) => {
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
    <div className="dataset-tabs-container">
      {/* Mobile Dropdown (< 768px) */}
      <div className="dataset-tabs-mobile">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="dataset-dropdown-button"
          aria-label="Select dataset"
          aria-expanded={mobileMenuOpen}
        >
          <div className="dataset-dropdown-selected">
            <div 
              className="dataset-icon-mobile"
              style={{ backgroundColor: activeDatasetObj.color }}
            >
              <IconComponent size={18} style={{ color: 'white' }} />
            </div>
            <div className="dataset-info-mobile">
              <div className="dataset-label-mobile">
                {activeDatasetObj.label}
                {getDatasetTotal(activeDatasetObj.id) && (
                  <span className="dataset-total-mobile"> · {getDatasetTotal(activeDatasetObj.id)}</span>
                )}
              </div>
              <div className="dataset-description-mobile">
                {activeDatasetObj.description}
              </div>
            </div>
          </div>
          <ChevronDown
            size={20}
            className="dataset-chevron"
            style={{ 
              color: 'var(--text-gray)',
              transform: mobileMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}
          />
        </button>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="dataset-dropdown-menu">
            {DATASETS.map((dataset) => {
              const Icon = dataset.icon;
              const isActive = dataset.id === activeDataset;
              const total = getDatasetTotal(dataset.id);
              
              return (
                <button
                  key={dataset.id}
                  onClick={() => handleDatasetSelect(dataset.id)}
                  className={`dataset-dropdown-item ${isActive ? 'active' : ''}`}
                  style={isActive ? { borderLeftColor: dataset.color } : undefined}
                >
                  <div 
                    className="dataset-icon-mobile"
                    style={{ backgroundColor: isActive ? dataset.color : dataset.lightColor }}
                  >
                    <Icon size={20} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <div className={`dataset-label-mobile ${isActive ? 'active' : ''}`}>
                      {dataset.label}
                      {total && <span className="dataset-total-mobile"> · {total}</span>}
                    </div>
                    <div className="dataset-description-mobile">
                      {dataset.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Tabs (≥ 768px) */}
      <div className="dataset-tabs-desktop">
        {DATASETS.map((dataset) => {
          const Icon = dataset.icon;
          const isActive = dataset.id === activeDataset;
          const total = getDatasetTotal(dataset.id);
          
          return (
            <button
              key={dataset.id}
              onClick={() => handleDatasetSelect(dataset.id)}
              className={`dataset-tab ${isActive ? 'active' : ''}`}
              style={isActive ? { 
                backgroundColor: 'var(--white)',
                borderColor: dataset.color,
                boxShadow: `0 2px 8px ${dataset.color}20`
              } : undefined}
            >
              <div 
                className="dataset-tab-icon"
                style={{ backgroundColor: dataset.color }}
              >
                <Icon size={18} style={{ color: 'white' }} />
              </div>
              <div className="dataset-tab-content">
                <div className="dataset-tab-label-row">
                  <span className="dataset-tab-label">{dataset.label}</span>
                  {total && (
                    <span className="dataset-tab-amount">{total}</span>
                  )}
                </div>
                <span className="dataset-tab-description">{dataset.description}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DATASETS };
