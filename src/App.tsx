import { useState, useMemo, useCallback, useEffect } from 'react'
import { SiteHeader } from '@chrisandrewsedu/ev-ui';
import { ArrowLeft } from 'lucide-react';
import { loadBudgetData, listMunicipalities } from './data/dataLoader';
import EntitySwitcher from './components/EntitySwitcher';
import './components/EntitySwitcher.css';
import DatasetTabs from './components/datasets/DatasetTabs';
import SearchBar from './components/SearchBar';
import YearSelector from './components/YearSelector';
import Breadcrumb from './components/Breadcrumb';
import BudgetVisualization from './components/BudgetVisualization';
import CategoryList from './components/CategoryList';
import LineItemsTable from './components/LineItemsTable';
import LinkedTransactionsPanel from './components/LinkedTransactionsPanel';
import type { BudgetCategory, BudgetData, Municipality } from './types/budget';
import './App.css'

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

type DatasetType = 'revenue' | 'operating' | 'salaries';

// Derive URL slug from municipality at runtime
function toSlug(m: Municipality): string {
  return `${m.name.toLowerCase().replace(/\s+/g, '-')}-${m.state.toLowerCase()}`;
}

// Sync all three params to URL without page reload (D-10, D-11)
function syncURL(entity: Municipality, year: string, dataset: string) {
  const params = new URLSearchParams({ entity: toSlug(entity), year, dataset });
  window.history.pushState({}, '', `?${params.toString()}`);
}

// Get display text for each dataset
function getDatasetDisplayText(type: DatasetType) {
  const texts: Record<DatasetType, { title: string; description: string; lineItemsDescription: string; transactionsDescription?: string }> = {
    revenue: {
      title: 'funds its budget',
      description: 'Each segment shows where funds come from. Tap any source to explore its breakdown.',
      lineItemsDescription: 'Detailed revenue sources showing approved and actual amounts received.'
    },
    operating: {
      title: 'spends its budget',
      description: 'Each segment shows the share of the total budget. Tap any category to explore its breakdown.',
      lineItemsDescription: 'Individual transactions showing vendors, amounts, dates, and payment details.',
      transactionsDescription: 'Individual transactions showing vendors, amounts, dates, and payment details.'
    },
    salaries: {
      title: 'compensates its workforce',
      description: 'Each segment shows department payroll. Tap any department to see position breakdowns.',
      lineItemsDescription: 'Detailed compensation showing base pay, benefits, overtime, and other pay.'
    }
  };

  return texts[type];
}

// Get dataset label for breadcrumbs
function getDatasetLabel(type: DatasetType): string {
  const labels: Record<DatasetType, string> = {
    revenue: 'Revenue',
    operating: 'Budget',
    salaries: 'Salaries'
  };
  return labels[type];
}

function App() {
  // Dataset selection
  const [activeDataset, setActiveDataset] = useState<DatasetType>('operating');

  // Entity state
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Municipality | null>(null);

  const [selectedYear, setSelectedYear] = useState('2025');
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [operatingBudgetData, setOperatingBudgetData] = useState<BudgetData | null>(null);
  const [revenueData, setRevenueData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [navigationPath, setNavigationPath] = useState<BudgetCategory[]>([]);

  // Derive available years and datasets from selected entity
  const availableYears = useMemo(() => {
    if (!selectedEntity) return [];
    const years = [...new Set(selectedEntity.available_datasets.map(d => d.fiscal_year))];
    return years.sort((a, b) => b - a).map(String);
  }, [selectedEntity]);

  const availableDatasetTypes = useMemo(() => {
    if (!selectedEntity) return ['operating', 'revenue', 'salaries'];
    return [...new Set(
      selectedEntity.available_datasets
        .filter(d => d.fiscal_year === parseInt(selectedYear))
        .map(d => d.dataset_type)
    )];
  }, [selectedEntity, selectedYear]);

  // Load municipalities on mount, resolve entity from URL (or default to Bloomington per D-12)
  useEffect(() => {
    listMunicipalities().then(list => {
      setMunicipalities(list);
      const params = new URLSearchParams(window.location.search);
      const entityParam = params.get('entity');
      const yearParam = params.get('year');
      const datasetParam = params.get('dataset');

      const matched = entityParam ? list.find(m => toSlug(m) === entityParam) : null;
      const entity = matched ?? list.find(m => m.name === 'Bloomington' && m.state === 'IN') ?? list[0];
      setSelectedEntity(entity);

      // Resolve year: from URL param if valid for entity, else most recent available
      const entityYears = [...new Set(entity.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
      if (yearParam && entityYears.includes(parseInt(yearParam))) {
        setSelectedYear(yearParam);
      } else if (entityYears.length > 0) {
        setSelectedYear(String(entityYears[0]));
      }

      // Resolve dataset from URL param if valid
      if (datasetParam && ['operating', 'revenue', 'salaries'].includes(datasetParam)) {
        setActiveDataset(datasetParam as DatasetType);
      }
    }).catch(error => {
      console.error('Failed to load municipalities:', error);
    });
  }, []);

  // Load operating budget and revenue totals for info cards (only if entity has that data)
  useEffect(() => {
    if (!selectedEntity) return;
    const yearNum = parseInt(selectedYear);
    const entityDatasets = selectedEntity.available_datasets.filter(d => d.fiscal_year === yearNum);
    const hasOperating = entityDatasets.some(d => d.dataset_type === 'operating');
    const hasRevenue = entityDatasets.some(d => d.dataset_type === 'revenue');

    const promises: Promise<BudgetData | null>[] = [
      hasOperating
        ? loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'operating')
        : Promise.resolve(null),
      hasRevenue
        ? loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'revenue')
        : Promise.resolve(null),
    ];

    Promise.all(promises)
      .then(([operating, revenue]) => {
        setOperatingBudgetData(operating);
        setRevenueData(revenue);
      })
      .catch(error => {
        console.error('Failed to load dataset totals:', error);
        setOperatingBudgetData(null);
        setRevenueData(null);
      });
  }, [selectedYear, selectedEntity]);

  // Load main budget data when dataset, year, or entity changes
  useEffect(() => {
    if (!selectedEntity) return;
    setLoading(true);
    setNavigationPath([]);
    setSearchQuery('');

    loadBudgetData(parseInt(selectedYear), selectedEntity.name, selectedEntity.state, activeDataset)
      .then(data => {
        setBudgetData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error(`Failed to load ${activeDataset} data:`, error);
        setBudgetData(null);
        setLoading(false);
      });
  }, [activeDataset, selectedYear, selectedEntity]);

  // Entity change handler — computes effective year BEFORE triggering data load (avoids Pitfall 1)
  const handleEntityChange = useCallback((entity: Municipality) => {
    const entityYears = [...new Set(entity.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
    const currentYearValid = entityYears.includes(parseInt(selectedYear));
    const effectiveYear = currentYearValid ? selectedYear : (entityYears.length > 0 ? String(entityYears[0]) : selectedYear);

    // Check if current dataset is available for new entity in effective year
    const entityDatasets = entity.available_datasets
      .filter(d => d.fiscal_year === parseInt(effectiveYear))
      .map(d => d.dataset_type);
    const effectiveDataset = entityDatasets.includes(activeDataset) ? activeDataset : 'operating';

    setSelectedEntity(entity);
    setSelectedYear(effectiveYear);
    setActiveDataset(effectiveDataset as DatasetType);
    syncURL(entity, effectiveYear, effectiveDataset);
  }, [selectedYear, activeDataset]);

  // Sync URL when year or dataset changes (guard avoids Pitfall 2 — no sync on mount)
  useEffect(() => {
    if (!selectedEntity) return;
    syncURL(selectedEntity, selectedYear, activeDataset);
  }, [selectedEntity, selectedYear, activeDataset]);

  const handleCategoryClick = useCallback((category: BudgetCategory) => {
    if (category.subcategories && category.subcategories.length > 0) {
      setNavigationPath([...navigationPath, category]);
    } else if (category.lineItems && category.lineItems.length > 0) {
      setNavigationPath([...navigationPath, category]);
    }
  }, [navigationPath]);

  const handlePathClick = useCallback((path: BudgetCategory[]) => {
    setNavigationPath(path);
  }, []);

  const handleBack = useCallback(() => {
    setNavigationPath(navigationPath.slice(0, -1));
  }, [navigationPath]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index === 1) {
      setNavigationPath([]);
    } else if (index > 1) {
      setNavigationPath(navigationPath.slice(0, index - 1));
    }
  }, [navigationPath]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      {
        label: selectedEntity?.name ?? 'City',
        onClick: navigationPath.length > 0 ? () => setNavigationPath([]) : undefined
      },
      {
        label: getDatasetLabel(activeDataset),
        onClick: navigationPath.length > 0 ? () => handleBreadcrumbClick(1) : undefined
      }
    ];

    navigationPath.forEach((category, index) => {
      items.push({
        label: category.name,
        onClick: index < navigationPath.length - 1
          ? () => handleBreadcrumbClick(index + 2)
          : undefined
      });
    });

    return items;
  }, [navigationPath, activeDataset, handleBreadcrumbClick, selectedEntity]);

  const formatPerResident = (total: number, population: number) => {
    const perResident = total / population;
    return `${perResident.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const displayText = getDatasetDisplayText(activeDataset);

  // Initial load guard — municipalities not yet resolved
  if (!selectedEntity) {
    return (
      <div className="app">
        <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />
        <div className="main-content" style={{ padding: '4rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  // Show error state when data load fails (after entity is resolved)
  if (!loading && !budgetData) {
    return (
      <div className="app">
        <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />
        <div className="main-content" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.2, color: '#1c1c1c', margin: 0 }}>
            Couldn't load {selectedEntity.name} data. Check your connection and try again.
          </h2>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              backgroundColor: '#00657c',
              color: '#ffffff',
              padding: '8px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 400,
              fontFamily: 'Manrope, sans-serif',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#005467'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#00657c'; }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Determine what to display (only when budgetData is loaded)
  const currentCategory = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : null;
  const showLineItems = currentCategory &&
                        currentCategory.lineItems &&
                        currentCategory.lineItems.length > 0 &&
                        (!currentCategory.subcategories || currentCategory.subcategories.length === 0);

  const currentCategories = navigationPath.length === 0
    ? (budgetData?.categories ?? [])
    : navigationPath[navigationPath.length - 1].subcategories || [];

  const filterCategories = (categories: BudgetCategory[], query: string): BudgetCategory[] => {
    if (!query.trim()) return categories;
    const lowerQuery = query.toLowerCase();
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(lowerQuery) ||
      (cat.description && cat.description.toLowerCase().includes(lowerQuery))
    );
  };

  const filteredCategories = filterCategories(currentCategories, searchQuery);
  const displayCategories = searchQuery ? filteredCategories : currentCategories;

  return (
    <div className="app">
      <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />
      <div className="header">
        <div className="header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <EntitySwitcher
              municipalities={municipalities}
              selectedEntity={selectedEntity}
              onEntityChange={handleEntityChange}
            />
            <div className="search-year-container">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <YearSelector
                selectedYear={selectedYear}
                years={availableYears}
                onYearChange={setSelectedYear}
              />
            </div>
          </div>
        </div>
      </div>

      {breadcrumbItems.length > 2 && <Breadcrumb items={breadcrumbItems} />}

      <div className="main-content-wrapper">
        {loading && (
          <div className="content-loading-overlay" role="status" aria-live="polite" aria-label="Loading budget data">
            <div className="spinner" />
          </div>
        )}
        <div className="main-content">
          {/* Hero Section — only show at top level */}
          {navigationPath.length === 0 && (
            <>
              <div className="hero-and-cards-row">
                <div className="hero-section" style={{
                  backgroundImage: selectedEntity.hero_image_url
                    ? `url('${selectedEntity.hero_image_url}')`
                    : "url('https://upload.wikimedia.org/wikipedia/commons/8/85/Monroe_County_Courthouse_in_Bloomington_from_west-southwest.jpg')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}>
                  <div className="hero-overlay" style={{
                    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 100%)'
                  }}></div>
                  <div className="hero-content">
                    <h1>{selectedEntity.name} Finances</h1>
                    <p>Explore how public funds are allocated and spent.</p>
                  </div>
                </div>

                <div className="info-cards">
                  <div className="info-card">
                    <div className="info-card-left">
                      <h3>Total {operatingBudgetData?.metadata.fiscalYear ?? selectedYear} Budget</h3>
                      <div className="amount">
                        {operatingBudgetData ? formatCurrency(operatingBudgetData.metadata.totalBudget) : '—'}
                      </div>
                    </div>
                    {selectedEntity.population > 0 && operatingBudgetData && (
                      <>
                        <div className="info-card-divider"></div>
                        <div className="info-card-right">
                          <h3>Context</h3>
                          <div className="description">
                            Population ~{selectedEntity.population.toLocaleString()} residents
                            <br />
                            ${formatPerResident(operatingBudgetData.metadata.totalBudget, selectedEntity.population)} per resident annually
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Dataset Tabs */}
              <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                <DatasetTabs
                  activeDataset={activeDataset}
                  onDatasetChange={(id) => setActiveDataset(id as DatasetType)}
                  revenueTotal={revenueData?.metadata.totalBudget}
                  operatingTotal={operatingBudgetData?.metadata.totalBudget}
                  availableDatasets={availableDatasetTypes}
                />
              </div>
            </>
          )}

          {/* Back button when navigated into categories */}
          {navigationPath.length > 0 && (
            <button
              onClick={handleBack}
              className="back-button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                backgroundColor: 'var(--white)',
                border: '1px solid var(--medium-gray)',
                borderRadius: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'Manrope, sans-serif',
                color: 'var(--muted-blue)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--muted-blue)';
                e.currentTarget.style.backgroundColor = 'var(--light-gray)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--medium-gray)';
                e.currentTarget.style.backgroundColor = 'var(--white)';
              }}
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
              Back to {navigationPath.length === 1 ? 'Overview' : navigationPath[navigationPath.length - 2].name}
            </button>
          )}

          {/* Search Results Message */}
          {searchQuery && (
            <div className="search-results-message">
              {displayCategories.length > 0 ? (
                <p>Found {displayCategories.length} {displayCategories.length === 1 ? 'result' : 'results'} for "{searchQuery}"</p>
              ) : (
                <p>No results found for "{searchQuery}"</p>
              )}
            </div>
          )}

          {/* Budget Visualization Section */}
          {budgetData && (
            <div className="budget-section">
              <div className="section-header">
                <h2>
                  {navigationPath.length === 0
                    ? `How ${budgetData.metadata.cityName} ${displayText.title}`
                    : navigationPath[navigationPath.length - 1].name}
                </h2>
                {navigationPath.length > 1 && (
                  <YearSelector
                    selectedYear={selectedYear}
                    years={availableYears}
                    onYearChange={setSelectedYear}
                  />
                )}
              </div>
              <p className="section-description">
                {navigationPath.length === 0
                  ? displayText.description
                  : showLineItems
                    ? displayText.lineItemsDescription
                    : 'The colored backgrounds show each subcategory\'s relative size. Tap to explore further or use the back button to return.'}
              </p>

              {showLineItems ? (
                <>
                  {activeDataset === 'operating' ? (
                    <>
                      <BudgetVisualization
                        categories={budgetData.categories}
                        navigationPath={navigationPath}
                        totalBudget={budgetData.metadata.totalBudget}
                        onPathClick={handlePathClick}
                      />
                      {currentCategory?.linkedTransactions && (
                        <LinkedTransactionsPanel
                          linkedTransactions={currentCategory.linkedTransactions}
                          categoryName={currentCategory.name}
                          linkKey={currentCategory.linkKey}
                          fiscalYear={parseInt(selectedYear)}
                        />
                      )}
                    </>
                  ) : (
                    <LineItemsTable
                      lineItems={currentCategory!.lineItems!}
                      categoryName={currentCategory!.name}
                    />
                  )}
                </>
              ) : displayCategories.length > 0 ? (
                <>
                  <BudgetVisualization
                    categories={budgetData.categories}
                    navigationPath={navigationPath}
                    totalBudget={budgetData.metadata.totalBudget}
                    onPathClick={handlePathClick}
                  />
                  <CategoryList
                    categories={displayCategories}
                    onCategoryClick={handleCategoryClick}
                  />
                  {activeDataset === 'operating' && currentCategory?.linkedTransactions && (
                    <LinkedTransactionsPanel
                      linkedTransactions={currentCategory.linkedTransactions}
                      categoryName={currentCategory.name}
                      linkKey={currentCategory.linkKey}
                      fiscalYear={parseInt(selectedYear)}
                    />
                  )}
                </>
              ) : (
                <div className="no-results">
                  <p>Try adjusting your search query</p>
                </div>
              )}
            </div>
          )}

          {/* Info tip */}
          {navigationPath.length === 0 && budgetData && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: 'var(--text-gray)'
            }}>
              <strong>Tip:</strong> Tap any category to drill down into its breakdown. Use breadcrumbs or the back button to navigate back. Switch datasets using the tabs above to explore revenue and salaries. Drill into Money Out to see individual transactions.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
