import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { SiteHeader } from '@empoweredvote/ev-ui';
import PlainLanguageSummary from './components/dashboard/PlainLanguageSummary';
import BudgetSearch from './components/dashboard/BudgetSearch';
import { loadBudgetData, loadLinkedTransactions, listMunicipalities } from './data/dataLoader';
import EntitySwitcher from './components/EntitySwitcher';
import AlphaLanding from './components/AlphaLanding';
import type { LandingReason } from './components/AlphaLanding';
import { resolveToken, fetchUserSession } from './utils/auth';
import DatasetTabs from './components/datasets/DatasetTabs';

import YearSelector from './components/YearSelector';
import type { YearSelectorHandle } from './components/YearSelector';
import Breadcrumb from './components/Breadcrumb';
import BudgetVisualization from './components/BudgetVisualization';
import CategoryList from './components/CategoryList';
import LineItemsTable from './components/LineItemsTable';
import LinkedTransactionsPanel from './components/LinkedTransactionsPanel';
import { getHeroImage } from './utils/wikiImage';
import type { BudgetCategory, BudgetData, LinkedTransactionSummary, Municipality } from './types/budget';

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
  // Ref for auto-scrolling to chart section
  const chartSectionRef = useRef<HTMLDivElement>(null);
  // Ref for programmatically opening the YearSelector dropdown
  const yearSelectorRef = useRef<YearSelectorHandle>(null);

  // Dataset selection
  const [activeDataset, setActiveDataset] = useState<DatasetType>('operating');

  // App-level view state: resolving auth → landing or budget
  const [appView, setAppView] = useState<'resolving' | 'landing' | 'budget'>('resolving');
  const [landingReason, setLandingReason] = useState<LandingReason>({ type: 'unauthenticated' });

  // Entity state
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Municipality | null>(null);

  const [selectedYear, setSelectedYear] = useState('2025');

  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [operatingBudgetData, setOperatingBudgetData] = useState<BudgetData | null>(null);
  const [revenueData, setRevenueData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [navigationPath, setNavigationPath] = useState<BudgetCategory[]>([]);
  const [linkedTransactions, setLinkedTransactions] = useState<LinkedTransactionSummary | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);

  // Fetch hero image from Wikipedia when entity changes
  useEffect(() => {
    if (!selectedEntity) return;
    setHeroImageUrl(null); // clear while loading
    getHeroImage(selectedEntity).then(url => setHeroImageUrl(url));
  }, [selectedEntity]);

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

  // Helper: navigate directly to an entity (used by landing page and auth routing)
  const navigateToEntity = useCallback((entity: Municipality, list: Municipality[]) => {
    const entityYears = [...new Set(entity.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
    const year = entityYears.length > 0 ? String(entityYears[0]) : '2025';
    setMunicipalities(list);
    setSelectedEntity(entity);
    setSelectedYear(year);
    setAppView('budget');
    syncURL(entity, year, 'operating');
  }, []);

  // On mount: resolve auth + load municipalities in parallel, then route
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const entityParam = params.get('entity');
    const yearParam = params.get('year');
    const datasetParam = params.get('dataset');

    // If a URL entity param is present, bypass auth routing entirely (shared/bookmarked link)
    if (entityParam) {
      listMunicipalities().then(list => {
        setMunicipalities(list);
        const matched = list.find(m => toSlug(m) === entityParam);
        const entity = matched ?? list.find(m => m.name === 'Bloomington' && m.state === 'IN') ?? list[0];
        setSelectedEntity(entity);

        const entityYears = [...new Set(entity.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
        if (yearParam && entityYears.includes(parseInt(yearParam))) {
          setSelectedYear(yearParam);
        } else if (entityYears.length > 0) {
          setSelectedYear(String(entityYears[0]));
        }
        if (datasetParam && ['operating', 'revenue', 'salaries'].includes(datasetParam)) {
          setActiveDataset(datasetParam as DatasetType);
        }
        setAppView('budget');
      }).catch(() => setAppView('budget'));
      return;
    }

    // No URL param — run auth-based routing
    Promise.all([
      resolveToken(),
      listMunicipalities(),
    ]).then(async ([token, list]) => {
      setMunicipalities(list);

      // Unauthenticated — full access, manual city search
      if (!token) {
        setLandingReason({ type: 'guest' });
        setAppView('landing');
        return;
      }

      const session = await fetchUserSession(token);

      // Token invalid or expired — treat as guest
      if (!session) {
        setLandingReason({ type: 'guest' });
        setAppView('landing');
        return;
      }

      // Inform tier — full access, manual city search (same as guest)
      if (session.tier === 'inform') {
        setLandingReason({ type: 'guest' });
        setAppView('landing');
        return;
      }

      // Connected/Empowered but no address on file
      if (!session.jurisdiction?.city || !session.jurisdiction?.state) {
        setLandingReason({ type: 'no_location' });
        setAppView('landing');
        return;
      }

      // Try to match their city to a treasury city
      const cityNorm = session.jurisdiction.city.trim().toLowerCase();
      const stateNorm = session.jurisdiction.state.trim().toUpperCase();
      const match = list.find(
        m =>
          m.name.trim().toLowerCase() === cityNorm &&
          m.state.trim().toUpperCase() === stateNorm &&
          m.available_datasets.length > 0
      );

      if (match) {
        // Auto-navigate to their city
        navigateToEntity(match, list);
      } else {
        // City not in treasury yet
        setLandingReason({
          type: 'city_not_available',
          cityName: session.jurisdiction.city,
          state: session.jurisdiction.state,
        });
        setAppView('landing');
      }
    }).catch(() => {
      // On any error, fall through to guest landing rather than a broken state
      setLandingReason({ type: 'guest' });
      setAppView('landing');
    });
  }, [navigateToEntity]);

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

  // Lazy-load linked transactions when navigating into a category (operating only)
  useEffect(() => {
    setLinkedTransactions(null);

    if (activeDataset !== 'operating' || navigationPath.length === 0 || !budgetData) return;

    const currentCat = navigationPath[navigationPath.length - 1];
    if (!currentCat.linkKey) return;

    const budgetId = budgetData.budgetId;
    if (!budgetId) return;

    loadLinkedTransactions(budgetId, currentCat.linkKey)
      .then(summary => setLinkedTransactions(summary));
  }, [navigationPath, activeDataset, budgetData]);

  const handleCategoryClick = useCallback((category: BudgetCategory) => {
    if (category.subcategories && category.subcategories.length > 0) {
      setNavigationPath([...navigationPath, category]);
    } else if (category.lineItems && category.lineItems.length > 0) {
      setNavigationPath([...navigationPath, category]);
    }
  }, [navigationPath]);

  const handleSummaryCategoryClick = useCallback((categoryName: string, dataset: 'operating' | 'revenue') => {
    // Switch dataset if needed
    if (dataset !== activeDataset) {
      setActiveDataset(dataset as DatasetType);
    }

    // Find the category in the appropriate data
    const data = dataset === 'operating' ? operatingBudgetData : revenueData;
    if (!data) return;

    // Handle single-fund drill: if only 1 top-level category, look in its subcategories
    const topLevel = data.categories || [];
    const isGeneralFundOnly = topLevel.length === 1;
    const searchLevel = isGeneralFundOnly ? (topLevel[0]?.subcategories || []) : topLevel;

    const category = searchLevel.find(c => c.name === categoryName);
    if (!category) return;

    // Build navigation path (same as clicking the chart)
    if (isGeneralFundOnly) {
      setNavigationPath([topLevel[0], category]);
    } else {
      setNavigationPath([category]);
    }

    // Auto-scroll chart into view
    setTimeout(() => {
      chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [activeDataset, operatingBudgetData, revenueData]);

  const handlePathClick = useCallback((path: BudgetCategory[]) => {
    // Guard: don't navigate to a leaf node that has nothing to display
    if (path.length > 0) {
      const target = path[path.length - 1];
      const hasChildren = target.subcategories && target.subcategories.length > 0;
      const hasLineItems = target.lineItems && target.lineItems.length > 0;
      if (!hasChildren && !hasLineItems) return; // ignore click on empty leaf
    }
    setNavigationPath(path);
  }, []);

  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index === 1) {
      setNavigationPath([]);
    } else if (index > 1) {
      setNavigationPath(navigationPath.slice(0, index - 1));
    }
  }, [navigationPath]);

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
        label: category.enrichment?.plainName || category.name,
        onClick: index < navigationPath.length - 1
          ? () => handleBreadcrumbClick(index + 2)
          : undefined
      });
    });

    return items;
  }, [navigationPath, activeDataset, handleBreadcrumbClick, selectedEntity]);

  const displayText = getDatasetDisplayText(activeDataset);

  // Explore Bloomington from the landing page
  const handleExploreBloomington = useCallback(() => {
    const bloomington = municipalities.find(m => m.name === 'Bloomington' && m.state === 'IN') ?? municipalities[0];
    if (bloomington) navigateToEntity(bloomington, municipalities);
  }, [municipalities, navigateToEntity]);

  // Resolving auth — show spinner
  if (appView === 'resolving') {
    return (
      <div className="min-h-screen bg-[#F7F7F8] font-manrope">
        <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />
        <div className="flex items-center justify-center py-16">
          <div role="status" aria-live="polite" aria-label="Loading" className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-4 border-[#E2EBEF] border-t-ev-muted-blue animate-spin" />
            <span className="sr-only">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  // Landing page — guest, no location, or city not in treasury
  if (appView === 'landing') {
    return (
      <AlphaLanding
        reason={landingReason}
        municipalities={municipalities}
        onNavigateToCity={(city) => navigateToEntity(city, municipalities)}
      />
    );
  }

  // Budget view — initial load guard while entity resolves
  if (!selectedEntity) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] font-manrope">
        <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />
        <div className="flex items-center justify-center py-16">
          <div role="status" aria-live="polite" aria-label="Loading budget data" className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-4 border-[#E2EBEF] border-t-ev-muted-blue animate-spin" />
            <span className="sr-only">Loading budget data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state when data load fails (after entity is resolved)
  if (!loading && !budgetData) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] font-manrope">
        <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />
        <div className="max-w-[1400px] mx-auto px-6 py-16 flex justify-center">
          <div className="bg-white border border-[#E2EBEF] rounded-xl p-8 text-center max-w-md w-full">
            <h2 className="text-base font-bold text-[#1C1C1C] mb-2">
              Unable to load budget data
            </h2>
            <p className="text-sm text-[#6B7280] mb-6">
              Unable to load budget data. Check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#005366] text-white text-sm font-medium rounded-lg cursor-pointer transition-colors duration-200 hover:bg-ev-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2"
            >
              Retry
            </button>
          </div>
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

  const isPastYear = parseInt(selectedYear) < new Date().getFullYear();
  // Only use actual data if the categories actually have it (non-zero actualAmount)
  const hasActualData = isPastYear && currentCategories.some(c => (c.actualAmount ?? 0) > 0);
  const displayCategories = currentCategories.filter(c =>
    hasActualData ? (c.actualAmount ?? c.amount) !== 0 : c.amount !== 0
  );

  return (
    <div className="min-h-screen bg-[#F7F7F8] font-manrope">
      <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />

      {/* Hero banner */}
      <div
        className={`relative h-48 bg-cover bg-center ${!heroImageUrl ? 'bg-gradient-to-r from-[#005366] to-[#007A8C]' : ''}`}
        style={heroImageUrl ? { backgroundImage: `url('${heroImageUrl}')` } : undefined}
      >
        <div className={`absolute inset-0 ${heroImageUrl ? 'bg-gradient-to-r from-black/60 to-black/30' : ''}`} />
        <div className="relative h-full max-w-[1400px] mx-auto px-6 flex flex-col justify-end pb-6">
          <h1 className="text-white text-3xl font-bold drop-shadow-lg">
            {selectedEntity.name} Finances
          </h1>
          <p className="text-white/80 text-sm mt-1">
            Explore how public funds are allocated and spent.
          </p>
        </div>
      </div>

      {/* Header / Controls bar */}
      <div className="bg-white shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <EntitySwitcher
              municipalities={municipalities}
              selectedEntity={selectedEntity}
              onEntityChange={handleEntityChange}
            />
            <YearSelector
              ref={yearSelectorRef}
              selectedYear={selectedYear}
              years={availableYears}
              onYearChange={setSelectedYear}
            />
            <div className="flex-1 min-w-0">
              <BudgetSearch
                cityId={selectedEntity.id}
                cityName={selectedEntity.name}
                fiscalYear={parseInt(selectedYear)}
                onResultClick={(result) => {
                  const allCategories = [
                    ...(operatingBudgetData?.categories ?? []),
                    ...(revenueData?.categories ?? []),
                  ];
                  const match = allCategories.find(c => c.name === result.categoryName);
                  if (match) {
                    if (result.datasetType !== activeDataset && ['operating', 'revenue', 'salaries'].includes(result.datasetType)) {
                      setActiveDataset(result.datasetType as DatasetType);
                    }
                    handleCategoryClick(match);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {breadcrumbItems.length > 2 && <Breadcrumb items={breadcrumbItems} />}

      {/* Main content area */}
      <div className="relative">
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-[#F7F7F8]/80 z-10"
            role="status"
            aria-live="polite"
            aria-label="Loading budget data"
          >
            <div className="w-8 h-8 rounded-full border-4 border-[#E2EBEF] border-t-ev-muted-blue animate-spin" />
            <span className="sr-only">Loading budget data...</span>
          </div>
        )}
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          {/* Dashboard Section — only show at top level */}
          {navigationPath.length === 0 && (
            <>
              {/* Plain language summary — lead with the story */}
              <div className="mb-6">
                <PlainLanguageSummary
                  entity={selectedEntity}
                  operatingData={operatingBudgetData}
                  revenueData={revenueData}
                  fiscalYear={selectedYear}
                  isPastYear={isPastYear}
                  onCategoryClick={handleSummaryCategoryClick}
                  onYearClick={() => yearSelectorRef.current?.open()}
                />
              </div>

              {/* Dataset Tabs */}
              <div className="mb-8">
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

          {/* Budget Visualization Section */}
          {budgetData && (
            <div ref={chartSectionRef} className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#1C1C1C]">
                    {navigationPath.length === 0
                      ? `How ${budgetData.metadata.cityName} ${displayText.title}`
                      : navigationPath[navigationPath.length - 1].enrichment?.plainName || navigationPath[navigationPath.length - 1].name}
                  </h2>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {navigationPath.length === 0
                      ? displayText.description
                      : showLineItems
                        ? displayText.lineItemsDescription
                        : 'The colored backgrounds show each subcategory\'s relative size. Tap to explore further or use the breadcrumb above to navigate back.'}
                  </p>
                  {navigationPath.length > 0 && (() => {
                    const currentCat = navigationPath[navigationPath.length - 1];
                    const desc = currentCat.enrichment?.description;
                    return desc ? (
                      <p className="text-[15px] text-ev-gray-600 mt-3 leading-relaxed">
                        {desc}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>

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
                      {linkedTransactions ? (
                        <LinkedTransactionsPanel
                          linkedTransactions={linkedTransactions}
                          categoryName={currentCategory!.name}
                          linkKey={currentCategory!.linkKey}
                          fiscalYear={parseInt(selectedYear)}
                        />
                      ) : currentCategory?.lineItems && currentCategory.lineItems.length > 0 ? (
                        <LineItemsTable
                          lineItems={currentCategory.lineItems}
                          categoryName={currentCategory.name}
                        />
                      ) : null}
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
                  {/* Attribution for descriptions */}
                  {(() => {
                    const cats = displayCategories || [];
                    const officialCats = cats.filter(c => c.enrichment?.source === 'official');
                    const aiCats = cats.filter(c => c.enrichment?.source === 'ai' || c.enrichment?.source === 'hybrid');
                    const sourceUrl = officialCats[0]?.enrichment?.sourceUrl;
                    const sourceLabel = officialCats[0]?.enrichment?.sourceLabel || 'official budget documents';

                    if (officialCats.length === 0 && aiCats.length === 0) return null;

                    return (
                      <p className="text-xs text-ev-gray-400 mb-3">
                        {officialCats.length > 0 && (
                          <>
                            Top-level descriptions from{' '}
                            {sourceUrl ? (
                              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ev-muted-blue">
                                {sourceLabel}
                              </a>
                            ) : (
                              sourceLabel
                            )}
                            .{' '}
                          </>
                        )}
                        {aiCats.length > 0 && (
                          <>Subcategory descriptions are summarized from budget line items.</>
                        )}
                      </p>
                    );
                  })()}
                  <CategoryList
                    categories={displayCategories}
                    onCategoryClick={handleCategoryClick}
                    isPastYear={hasActualData}
                  />
                  {activeDataset === 'operating' && linkedTransactions && currentCategory && (
                    <LinkedTransactionsPanel
                      linkedTransactions={linkedTransactions}
                      categoryName={currentCategory.name}
                      linkKey={currentCategory.linkKey}
                      fiscalYear={parseInt(selectedYear)}
                    />
                  )}
                </>
              ) : (
                <div className="bg-white border border-[#E2EBEF] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#6B7280]">Try adjusting your search query</p>
                </div>
              )}
            </div>
          )}

          {/* Contextual help — subtle, not preachy */}
          {navigationPath.length === 0 && budgetData && (
            <div className="mt-6 p-4 bg-ev-gray-050 border border-ev-gray-200 rounded-lg text-sm text-ev-gray-500">
              <strong className="text-ev-gray-700">How to explore:</strong> Tap any category above to see its breakdown.
              Use the tabs to switch between spending, revenue, and employee compensation.
              Every level lets you dig deeper until you reach individual line items and transactions.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
