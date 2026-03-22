import { useState, useMemo, useCallback, useEffect } from 'react'
import { Link, Navigate } from 'react-router';
import { SiteHeader } from '@chrisandrewsedu/ev-ui';
import { getCityConfig } from '../config/cityRegistry';
import { ArrowLeft } from 'lucide-react';
import DatasetTabs from '../components/datasets/DatasetTabs';
import NavigationTabs from '../components/NavigationTabs';
import SearchBar from '../components/SearchBar';
import YearSelector from '../components/YearSelector';
import Breadcrumb from '../components/Breadcrumb';
import BudgetVisualization from '../components/BudgetVisualization';
import CategoryList from '../components/CategoryList';
import LineItemsTable from '../components/LineItemsTable';
import LinkedTransactionsPanel from '../components/LinkedTransactionsPanel';
import type { BudgetCategory, BudgetData } from '../types/budget';
import '../App.css'

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

type DatasetType = 'revenue' | 'operating' | 'salaries';

// Helper function to load any dataset
async function loadDataset(type: DatasetType, year: number, citySlug: string): Promise<BudgetData> {
  const fileMap: Record<DatasetType, string> = {
    revenue: 'revenue',
    operating: 'budget',
    salaries: 'salaries'
  };

  const fileName = fileMap[type];

  // For operating budget, try to load the linked version first (includes transaction data)
  if (type === 'operating') {
    try {
      const linkedPath = `/data/${citySlug}/${fileName}-${year}-linked.json`;
      const linkedResponse = await fetch(linkedPath);
      const linkedContentType = linkedResponse.headers.get('content-type') || '';
      if (linkedResponse.ok && linkedContentType.includes('json')) {
        return linkedResponse.json();
      }
    } catch {
      // linked variant not available, fall through to regular file
    }
  }

  const path = `/data/${citySlug}/${fileName}-${year}.json`;
  const response = await fetch(path);
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok || !contentType.includes('json')) {
    throw new Error(`Failed to load ${type} data for ${year} (city: ${citySlug}) -- HTTP ${response.status}`);
  }

  return response.json();
}

// Get display text for each dataset
function getDatasetDisplayText(type: DatasetType) {
  const texts: Record<DatasetType, { title: string; description: string; lineItemsDescription: string; transactionsDescription?: string }> = {
    revenue: {
      title: 'funds its budget',
      description: 'Each segment shows where city revenue comes from. Tap any source to explore its breakdown.',
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

export default function CityPage({ slug }: { slug: string }) {
  const cityConfig = getCityConfig(slug);

  // Dataset selection — use first available dataset from config (or 'operating' as fallback)
  const [activeDataset, setActiveDataset] = useState<DatasetType>(
    (cityConfig?.availableDatasets[0] ?? 'operating') as DatasetType
  );

  // Existing state
  const [activeTab, setActiveTab] = useState('city');
  const [selectedYear, setSelectedYear] = useState(cityConfig?.defaultYear ?? '2025');
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [operatingBudgetData, setOperatingBudgetData] = useState<BudgetData | null>(null);
  const [revenueData, setRevenueData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [navigationPath, setNavigationPath] = useState<BudgetCategory[]>([]);

  // Load operating budget and revenue data for static info card and totals
  useEffect(() => {
    Promise.all([
      loadDataset('operating', parseInt(selectedYear), slug),
      loadDataset('revenue', parseInt(selectedYear), slug)
    ])
      .then(([operating, revenue]) => {
        setOperatingBudgetData(operating);
        setRevenueData(revenue);
      })
      .catch(error => {
        console.error('Failed to load dataset totals:', error);
        setLoadError(true);
      });
  }, [selectedYear, slug]);

  // Load data when dataset or year changes
  useEffect(() => {
    setLoading(true);
    setNavigationPath([]); // Reset navigation
    setSearchQuery(''); // Reset search

    loadDataset(activeDataset, parseInt(selectedYear), slug)
      .then(data => {
        setBudgetData(data);
        setLoading(false);
        setLoadError(false);
      })
      .catch(error => {
        console.error(`Failed to load ${activeDataset} data:`, error);
        setLoading(false);
        setLoadError(true);
      });
  }, [activeDataset, selectedYear, slug]);

  const tabs = [
    { id: 'city', label: 'City' },
    { id: 'state', label: 'State' },
    { id: 'federal', label: 'Federal' }
  ];

  const years = cityConfig?.availableYears ?? [];

  const handleCategoryClick = useCallback((category: BudgetCategory) => {
    // Navigate into category if it has subcategories OR if it has line items (lowest level)
    if (category.subcategories && category.subcategories.length > 0) {
      setNavigationPath([...navigationPath, category]);
    } else if (category.lineItems && category.lineItems.length > 0) {
      // Navigate to show the line items for this category
      setNavigationPath([...navigationPath, category]);
    }
  }, [navigationPath]);

  // Handler for sunburst clicks - sets the full navigation path directly
  const handlePathClick = useCallback((path: BudgetCategory[]) => {
    setNavigationPath(path);
  }, []);

  const handleBack = useCallback(() => {
    setNavigationPath(navigationPath.slice(0, -1));
  }, [navigationPath]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    // index 0 = City, index 1 = Dataset, index 2+ = categories
    // Clicking dataset should go back to overview
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
        label: 'City',
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
          : undefined // Current selection, not clickable
      });
    });

    return items;
  }, [navigationPath, activeDataset, handleBreadcrumbClick]);

  const formatPerResident = (total: number, population: number) => {
    const perResident = total / population;
    return `${perResident.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  // Get display text based on active dataset
  const displayText = getDatasetDisplayText(activeDataset);

  // Redirect unknown slugs — placed after all hooks to comply with rules of hooks
  if (!cityConfig) {
    return <Navigate to="/" replace />;
  }

  // Show error state (must be checked before loading guard -- loadError bypasses spinner)
  if (loadError) {
    return (
      <div className="app">
        <div className="main-content" style={{ padding: '4rem', textAlign: 'center' }}>
          <h2>Unable to load budget data</h2>
          <p>The data file could not be loaded. Check the browser console for the specific file path and HTTP status.</p>
          <Link to="/" style={{ display: 'inline-block', marginTop: '16px', color: 'var(--muted-blue)' }}>
            Back to Cities
          </Link>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading || !operatingBudgetData) {
    return (
      <div className="app">
        <div className="main-content" style={{ padding: '4rem', textAlign: 'center' }}>
          <h2>Loading data...</h2>
        </div>
      </div>
    );
  }

  // Show error state
  if (!budgetData) {
    return (
      <div className="app">
        <div className="main-content" style={{ padding: '4rem', textAlign: 'center' }}>
          <h2>Unable to load budget data</h2>
          <p>The data file could not be loaded. Check the browser console for the specific file path and HTTP status.</p>
          <Link to="/" style={{ display: 'inline-block', marginTop: '16px', color: 'var(--muted-blue)' }}>
            Back to Cities
          </Link>
        </div>
      </div>
    );
  }

  // Determine what to display
  const currentCategory = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : null;
  const showLineItems = currentCategory &&
                        currentCategory.lineItems &&
                        currentCategory.lineItems.length > 0 &&
                        (!currentCategory.subcategories || currentCategory.subcategories.length === 0);

  const currentCategories = navigationPath.length === 0
    ? budgetData.categories // Top level
    : navigationPath[navigationPath.length - 1].subcategories || [];

  // Filter categories based on search query
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
      <Link to="/" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: 700,
        lineHeight: '1.3',
        color: 'var(--black, #1c1c1c)',
        textDecoration: 'none',
        minHeight: '44px',
      }}>
        <ArrowLeft size={16} />
        Back to Cities
      </Link>
      <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />
      <div className="header">
        <div className="header-content">
          {/* City/State/Federal tabs and controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <NavigationTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <div className="search-year-container">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <YearSelector
                selectedYear={selectedYear}
                years={years}
                onYearChange={setSelectedYear}
              />
            </div>
          </div>
        </div>
      </div>

      {breadcrumbItems.length > 2 && <Breadcrumb items={breadcrumbItems} />}

      <div className="main-content">
        {/* Hero Section - Static, only show at top level */}
        {navigationPath.length === 0 && (
          <>
            <div className="hero-and-cards-row">
              <div className="hero-section" style={{
                backgroundImage: `url('${cityConfig.heroImageUrl}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}>
                <div className="hero-overlay" style={{
                  background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 100%)'
                }}></div>
                <div className="hero-content">
                  <h1>{cityConfig.heroTitle}</h1>
                  <p>Explore how public funds are allocated and spent.</p>
                </div>
              </div>

              <div className="info-cards">
                <div className="info-card">
                  <div className="info-card-left">
                    <h3>Total {operatingBudgetData.metadata.fiscalYear} Budget</h3>
                    <div className="amount">{formatCurrency(operatingBudgetData.metadata.totalBudget)}</div>
                  </div>
                  <div className="info-card-divider"></div>
                  <div className="info-card-right">
                    <h3>City Context</h3>
                    <div className="description">
                      Population ~{cityConfig.population.toLocaleString()} residents
                      <br />
                      ${formatPerResident(operatingBudgetData.metadata.totalBudget, cityConfig.population)} per resident annually
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dataset Tabs - NEW LOCATION */}
            <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
              <DatasetTabs
                activeDataset={activeDataset}
                onDatasetChange={(id) => setActiveDataset(id as DatasetType)}
                revenueTotal={revenueData?.metadata.totalBudget}
                operatingTotal={operatingBudgetData?.metadata.totalBudget}
                availableDatasets={cityConfig.availableDatasets}
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
                years={years}
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
            // At the lowest level
            <>
              {/* For Money Out, show visualization + transactions instead of line items */}
              {activeDataset === 'operating' ? (
                <>
                  {/* Budget visualization at lowest level too */}
                  <BudgetVisualization
                    categories={budgetData.categories}
                    navigationPath={navigationPath}
                    totalBudget={budgetData.metadata.totalBudget}
                    onPathClick={handlePathClick}
                  />

                  {/* Show linked transactions directly */}
                  {cityConfig.hasTransactions && currentCategory?.linkedTransactions && (
                    <LinkedTransactionsPanel
                      linkedTransactions={currentCategory.linkedTransactions}
                      categoryName={currentCategory.name}
                      linkKey={currentCategory.linkKey}
                      fiscalYear={parseInt(selectedYear)}
                      citySlug={slug}
                    />
                  )}
                </>
              ) : (
                // For other datasets (revenue, salaries), show line items table
                <LineItemsTable
                  lineItems={currentCategory!.lineItems!}
                  categoryName={currentCategory!.name}
                />
              )}
            </>
          ) : displayCategories.length > 0 ? (
            <>
              {/* Budget visualization - shows full hierarchy with current selection highlighted */}
              <BudgetVisualization
                categories={budgetData.categories}
                navigationPath={navigationPath}
                totalBudget={budgetData.metadata.totalBudget}
                onPathClick={handlePathClick}
              />

              {/* Interactive category list */}
              <CategoryList
                categories={displayCategories}
                onCategoryClick={handleCategoryClick}
              />

              {/* Show linked transactions summary for intermediate budget categories */}
              {cityConfig.hasTransactions && activeDataset === 'operating' && currentCategory?.linkedTransactions && (
                <LinkedTransactionsPanel
                  linkedTransactions={currentCategory.linkedTransactions}
                  categoryName={currentCategory.name}
                  linkKey={currentCategory.linkKey}
                  fiscalYear={parseInt(selectedYear)}
                  citySlug={slug}
                />
              )}
            </>
          ) : (
            <div className="no-results">
              <p>Try adjusting your search query</p>
            </div>
          )}
        </div>

        {/* Info tip */}
        {navigationPath.length === 0 && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: 'var(--text-gray)'
          }}>
            <strong>💡 Tip:</strong> Tap any category to drill down into its breakdown. Use breadcrumbs or the back button to navigate back. Switch datasets using the tabs above to explore revenue and salaries. Drill into Money Out to see individual transactions.
          </div>
        )}
      </div>
    </div>
  )
}
