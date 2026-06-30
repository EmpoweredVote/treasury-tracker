import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { FileText, Heart, Wallet } from 'lucide-react'
import { SiteHeader } from '@empoweredvote/ev-ui';
import { AppHeader } from './components/AppHeader';
import PlainLanguageSummary from './components/dashboard/PlainLanguageSummary';
import OrgTransparencyPanel from './components/dashboard/OrgTransparencyPanel';
import MicroDonationCallout from './components/dashboard/MicroDonationCallout';
import FederalLanding from './components/federal/FederalLanding';
import LensToggle from './components/federal/LensToggle';
import SourceChip from './components/federal/SourceChip';
import MethodologyPanel from './components/federal/MethodologyPanel';
import ComparabilityNote from './components/federal/ComparabilityNote';
import { comparability } from './data/comparability';
import { cityBasisNotes } from './data/cityBasisNotes';
import ScaleToggle, { type FederalScale } from './components/federal/ScaleToggle';
import ProgramOrigins from './components/federal/ProgramOrigins';
import BudgetSearch from './components/dashboard/BudgetSearch';
import { loadBudgetData, loadFederalContext, loadOrgFinancialSummary, loadLinkedTransactions, listMunicipalities, clearCache } from './data/dataLoader';
import EntitySwitcher from './components/EntitySwitcher';
import AlphaLanding from './components/AlphaLanding';
import type { LandingReason } from './components/AlphaLanding';
import { resolveToken, fetchUserSession, getLoginUrl, signOut } from './utils/auth';
import { useTheme } from './hooks/useTheme';
import DatasetTabs from './components/datasets/DatasetTabs';
import DonateModal from './components/DonateModal';

import YearSelector from './components/YearSelector';
import type { YearSelectorHandle } from './components/YearSelector';
import { parsePeriod, buildPeriodTokens } from './utils/period'
import { resolveEffectiveDataset } from './utils/resolveDataset';
import Breadcrumb from './components/Breadcrumb';
import BudgetVisualization from './components/BudgetVisualization';
import CategoryList from './components/CategoryList';
import LineItemsTable from './components/LineItemsTable';
import LinkedTransactionsPanel from './components/LinkedTransactionsPanel';
import CitiesInCountyPanel from './components/CitiesInCountyPanel';
import CitiesInStatePanel from './components/CitiesInStatePanel';
import CountiesInStatePanel from './components/CountiesInStatePanel';
import StatesInFederalPanel from './components/StatesInFederalPanel';
import { getHeroImage, getHeroBgPosition } from './utils/wikiImage';
import type { BudgetCategory, BudgetData, FederalContext, LinkedTransactionSummary, Municipality, OrgFinancialSummary } from './types/budget';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

type DatasetType = 'revenue' | 'operating' | 'salaries';

// Derive URL slug from municipality at runtime
function toSlug(m: Municipality): string {
  return `${m.name.toLowerCase().replace(/\s+/g, '-')}-${m.state.toLowerCase()}`;
}

// Some entities (notably state General Fund budgets) wrap every category under a
// single synthetic root node ("<Entity> General Fund Budget"). At the top level
// that root is a redundant 100% "click to start" layer, and because the icicle
// colors a branch by its root index, it also collapses every child to one color.
// Hoist the root's children to the top level so the real categories render by
// default — each with its own color — and the duplicate layer disappears.
// metadata.totalBudget is preserved (the children sum to the root total), so the
// headline amount shown above the chart is unchanged. No-op for multi-root trees
// (cities, federal, nonprofit) and for a single leaf root with no children.
function hoistSingleRoot(data: BudgetData | null): BudgetData | null {
  if (!data) return data;
  const top = data.categories ?? [];
  if (top.length === 1 && (top[0].subcategories?.length ?? 0) > 0) {
    return { ...data, categories: top[0].subcategories! };
  }
  return data;
}

// Sync all three params to URL without page reload (D-10, D-11)
// lens param only appears for the federal agency lens (Phase 45)
function syncURL(entity: Municipality, year: string, dataset: string, lens?: string) {
  const params = new URLSearchParams({ entity: toSlug(entity), year, dataset });
  if (lens === 'agency') params.set('lens', 'agency');
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
      description: 'Each segment shows department payroll. Tap any department to see position breakdowns. Department names are shown as each entity reports them to the State Controller.',
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

const isFinancialsHost = window.location.hostname === 'financials.empowered.vote';


function App() {
  const { isDark } = useTheme();
  const darkHeaderStyle = isDark ? {
    backgroundColor: '#020618',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  } : undefined;

  // Ref for auto-scrolling to chart section
  const chartSectionRef = useRef<HTMLDivElement>(null);
  // Ref for programmatically opening the YearSelector dropdown
  const yearSelectorRef = useRef<YearSelectorHandle>(null);

  // Dataset selection
  const [activeDataset, setActiveDataset] = useState<DatasetType>('operating');

  // Federal lens (Phase 45): which Money Out tree the US entity shows.
  // 'function' = budget functions (default); 'agency' = departments (federal_agency dataset)
  const [federalLens, setFederalLens] = useState<'function' | 'agency'>('function');

  // Federal scale (VIZ-05): display-only transform — loaded data is never mutated.
  const [federalScale, setFederalScale] = useState<FederalScale>('dollars');
  const [federalContextData, setFederalContextData] = useState<FederalContext | null>(null);
  // EV (nonprofit) reconciled financial summary — Phase 76. Null for non-nonprofit
  // entities and on fetch failure (graceful hide, no fallback figures).
  const [orgSummary, setOrgSummary] = useState<OrgFinancialSummary | null>(null);

  // App-level view state: resolving auth → landing or budget
  const [appView, setAppView] = useState<'resolving' | 'landing' | 'budget'>('resolving');
  const [landingReason, setLandingReason] = useState<LandingReason>({ type: 'guest' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Entity state
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Municipality | null>(null);

  const [selectedYear, setSelectedYear] = useState('2025');

  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [operatingBudgetData, setOperatingBudgetData] = useState<BudgetData | null>(null);
  const [revenueData, setRevenueData] = useState<BudgetData | null>(null);
  const [salariesData, setSalariesData] = useState<BudgetData | null>(null);
  const [allFundsRequirementsData, setAllFundsRequirementsData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [budgetLoadError, setBudgetLoadError] = useState(false);
  const [navigationPath, setNavigationPath] = useState<BudgetCategory[]>([]);
  const [linkedTransactions, setLinkedTransactions] = useState<LinkedTransactionSummary | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);

  // Fetch hero image from Wikipedia when entity changes
  useEffect(() => {
    if (!selectedEntity) return;
    setHeroImageUrl(null); // clear while loading
    getHeroImage(selectedEntity).then(url => setHeroImageUrl(url));
  }, [selectedEntity]);

  // Update page title when entity changes
  useEffect(() => {
    if (!selectedEntity) {
      document.title = isFinancialsHost ? 'Empowered Vote Finances' : 'Treasury Tracker';
      return;
    }
    if (selectedEntity.entity_type === 'nonprofit') {
      document.title = `${selectedEntity.name} Finances`;
    } else {
      document.title = `${selectedEntity.name} ${selectedYear} Budget | Treasury Tracker`;
    }
  }, [selectedEntity, selectedYear]);

  // Derive available years and datasets from selected entity
  // Period tokens: annual years descending, with the FY1976 Transition Quarter
  // (a period_label row) inserted right after '1976'. Non-federal entities have
  // no period_label rows, so this is a plain descending year list for them.
  const availableYears = useMemo(() => {
    if (!selectedEntity) return [];
    return buildPeriodTokens(selectedEntity.available_datasets);
  }, [selectedEntity]);

  const availableDatasetTypes = useMemo(() => {
    if (!selectedEntity) return ['operating', 'revenue', 'salaries'];
    return [...new Set(
      selectedEntity.available_datasets
        .filter(d => d.fiscal_year === parsePeriod(selectedYear).fiscalYear)
        .map(d => d.dataset_type)
        .filter(t => t !== 'all_funds_requirements' && t !== 'federal_agency')
    )];
  }, [selectedEntity, selectedYear]);

  // Helper: navigate directly to an entity (used by landing page and auth routing)
  const navigateToEntity = useCallback((entity: Municipality, list: Municipality[]) => {
    const entityYears = [...new Set(entity.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
    const operatingYears = [...new Set(entity.available_datasets.filter(d => d.dataset_type === 'operating').map(d => d.fiscal_year))].sort((a, b) => b - a);
    const year = operatingYears.length > 0 ? String(operatingYears[0]) : (entityYears.length > 0 ? String(entityYears[0]) : '2025');
    setMunicipalities(list);
    setSelectedEntity(entity);
    setSelectedYear(year);
    setAppView('budget');
    syncURL(entity, year, 'operating');
  }, []);

  // On mount: resolve auth + load municipalities in parallel, then route
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const entityParam = params.get('entity') ?? (isFinancialsHost ? 'empowered-vote-ca' : null);
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
        const operatingYears = [...new Set(entity.available_datasets.filter(d => d.dataset_type === 'operating').map(d => d.fiscal_year))].sort((a, b) => b - a);
        // Compute the resolved year as a local variable so we can validate
        // ?dataset= against availability for that specific year (REVUX-02 fix).
        const resolvedYear = (yearParam && entityYears.includes(parseInt(yearParam)))
          ? yearParam
          : operatingYears.length > 0
            ? String(operatingYears[0])
            : entityYears.length > 0
              ? String(entityYears[0])
              : '2025';
        setSelectedYear(resolvedYear);
        // Validate ?dataset= against the entity's actual availability for the
        // resolved year — falls back to 'operating' for garbage params, missing
        // datasets, or operating-only nodes (e.g. NASBO states). Both guards:
        // (1) static allow-list [operating|revenue|salaries], (2) availability.
        const resolvedYearTypes = entity.available_datasets
          .filter(d => d.fiscal_year === parsePeriod(resolvedYear).fiscalYear)
          .map(d => d.dataset_type)
          .filter(t => t !== 'all_funds_requirements' && t !== 'federal_agency');
        setActiveDataset(resolveEffectiveDataset(resolvedYearTypes, datasetParam));
        if (params.get('lens') === 'agency' && entity.entity_type === 'federal') {
          setFederalLens('agency');
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

      setIsAuthenticated(true);

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
    const { fiscalYear: yearNum, periodLabel } = parsePeriod(selectedYear);
    const entityDatasets = selectedEntity.available_datasets.filter(d => d.fiscal_year === yearNum);
    const hasOperating = entityDatasets.some(d => d.dataset_type === 'operating');
    const hasRevenue = entityDatasets.some(d => d.dataset_type === 'revenue');
    const hasSalaries = entityDatasets.some(d => d.dataset_type === 'salaries');
    const hasAllFundsRequirements = entityDatasets.some(d => d.dataset_type === 'all_funds_requirements');

    const promises: Promise<BudgetData | null>[] = [
      hasOperating
        ? loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'operating', periodLabel)
        : Promise.resolve(null),
      hasRevenue
        ? loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'revenue', periodLabel)
        : Promise.resolve(null),
      hasSalaries
        ? loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'salaries', periodLabel)
        : Promise.resolve(null),
    ];

    Promise.all(promises)
      .then(([operating, revenue, salaries]) => {
        setOperatingBudgetData(hoistSingleRoot(operating));
        setRevenueData(hoistSingleRoot(revenue));
        setSalariesData(salaries);
      })
      .catch(error => {
        console.error('Failed to load dataset totals:', error);
        setOperatingBudgetData(null);
        setRevenueData(null);
        setSalariesData(null);
      });

    // Load all_funds_requirements separately so a failure never affects the main data loads
    if (hasAllFundsRequirements) {
      loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'all_funds_requirements', periodLabel)
        .then(data => setAllFundsRequirementsData(data))
        .catch(() => setAllFundsRequirementsData(null));
    } else {
      setAllFundsRequirementsData(null);
    }
  }, [selectedYear, selectedEntity]);

  // Load main budget data when dataset, year, entity, or federal lens changes.
  // The agency lens substitutes the federal_agency dataset for 'operating' —
  // tab state stays 'operating' (the lens is a view of Money Out, not a tab).
  useEffect(() => {
    if (!selectedEntity) return;
    // Budget-less entities (e.g. a grouper county like Orange County, whose cities
    // carry the data) have nothing to load — render the directory, not an error.
    // Attempting a load here would throw "No budget found" and trip the error screen.
    if ((selectedEntity.available_datasets?.length ?? 0) === 0) {
      setBudgetData(null);
      setBudgetLoadError(false);
      setLoading(false);
      setNavigationPath([]);
      return;
    }
    const requestDataset =
      selectedEntity.entity_type === 'federal' && activeDataset === 'operating' && federalLens === 'agency'
        ? 'federal_agency'
        : activeDataset;
    setLoading(true);
    setBudgetLoadError(false);
    setNavigationPath([]);

    const { fiscalYear, periodLabel } = parsePeriod(selectedYear);
    loadBudgetData(fiscalYear, selectedEntity.name, selectedEntity.state, requestDataset, periodLabel)
      .then(data => {
        setBudgetData(hoistSingleRoot(data));
        setLoading(false);
      })
      .catch(error => {
        console.error(`Failed to load ${requestDataset} data:`, error);
        setBudgetData(null);
        setLoading(false);
        setBudgetLoadError(true);
      });
  }, [activeDataset, selectedYear, selectedEntity, federalLens]);

  // Entity change handler — computes effective year BEFORE triggering data load (avoids Pitfall 1)
  const handleEntityChange = useCallback((entity: Municipality) => {
    const entityYears = [...new Set(entity.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
    const operatingYears = [...new Set(
      entity.available_datasets.filter(d => d.dataset_type === 'operating').map(d => d.fiscal_year)
    )].sort((a, b) => b - a);
    // Prefer a year with operating data; only keep current year if it has operating data
    const currentHasOperating = operatingYears.includes(parsePeriod(selectedYear).fiscalYear);
    const effectiveYear = currentHasOperating
      ? selectedYear
      : operatingYears.length > 0
        ? String(operatingYears[0])
        : (entityYears.length > 0 ? String(entityYears[0]) : selectedYear);

    // Check if current dataset is available for new entity in effective year.
    // Uses the shared helper so both the mount path and handleEntityChange
    // apply the same two-guard logic (static allow-list + availability).
    const entityDatasets = entity.available_datasets
      .filter(d => d.fiscal_year === parsePeriod(effectiveYear).fiscalYear)
      .map(d => d.dataset_type)
      .filter(t => t !== 'all_funds_requirements' && t !== 'federal_agency');
    const effectiveDataset = resolveEffectiveDataset(entityDatasets, activeDataset);

    setSelectedEntity(entity);
    setSelectedYear(effectiveYear);
    setActiveDataset(effectiveDataset as DatasetType);
    setFederalLens('function'); // lens/scale are per-visit; reset when leaving/entering entities
    setFederalScale('dollars');
    syncURL(entity, effectiveYear, effectiveDataset);
  }, [selectedYear, activeDataset]);

  // Federal context for scale denominators (cached fetch; FederalLanding shares it)
  useEffect(() => {
    if (selectedEntity?.entity_type !== 'federal') return;
    loadFederalContext().then(setFederalContextData).catch(() => { /* per-taxpayer mode simply hides */ });
  }, [selectedEntity]);

  // EV (nonprofit) reconciled financial summary — Phase 76. Fetch per entity+year;
  // null for any non-nonprofit entity (never leaks across entities) and on failure.
  useEffect(() => {
    if (selectedEntity?.entity_type !== 'nonprofit') { setOrgSummary(null); return; }
    loadOrgFinancialSummary(selectedEntity.id, parsePeriod(selectedYear).fiscalYear)
      .then(setOrgSummary)
      .catch(() => setOrgSummary(null));
  }, [selectedEntity, selectedYear]);

  // Per-YEAR per-capita denominators (Phase 50 fix): population + returns vary by the
  // selected fiscal year (federal_context_metrics population_fyN / tax_returns_filed_fyN).
  // The Transition Quarter and any year missing a denominator get null → that scale is
  // hidden/disabled (never divide a year by another year's count).
  const federalDenominators = useMemo(() => {
    if (selectedEntity?.entity_type !== 'federal') return null;
    const { fiscalYear, periodLabel } = parsePeriod(selectedYear);
    if (periodLabel) return { population: 0, populationYear: fiscalYear, taxReturns: null, taxReturnsLabel: null };
    const m = federalContextData?.metrics;
    return {
      population: m?.[`population_fy${fiscalYear}`]?.value ?? 0,
      populationYear: fiscalYear,
      taxReturns: m?.[`tax_returns_filed_fy${fiscalYear}`]?.value ?? null,
      taxReturnsLabel: m?.[`tax_returns_filed_fy${fiscalYear}`]?.label ?? null,
    };
  }, [selectedEntity, selectedYear, federalContextData]);

  // If the active per-capita scale has no denominator for the selected year (the TQ,
  // pre-2005 per-taxpayer, etc.), fall back to dollars so we never show a wrong figure.
  useEffect(() => {
    if (!federalDenominators) return;
    if (federalScale === 'perPerson' && !federalDenominators.population) setFederalScale('dollars');
    if (federalScale === 'perTaxpayer' && !federalDenominators.taxReturns) setFederalScale('dollars');
  }, [federalDenominators, federalScale]);

  // Sync URL when year, dataset, or federal lens changes (guard avoids Pitfall 2 — no sync on mount)
  useEffect(() => {
    if (!selectedEntity) return;
    syncURL(
      selectedEntity, selectedYear, activeDataset,
      selectedEntity.entity_type === 'federal' && federalLens === 'agency' ? 'agency' : undefined
    );
  }, [selectedEntity, selectedYear, activeDataset, federalLens]);

  // Silently refetch revenue once when the user returns to this tab.
  // Fires at most once per entity+year — the listener removes itself after the first visible-return.
  useEffect(() => {
    if (!selectedEntity || selectedEntity.entity_type !== 'nonprofit' || !isFinancialsHost) return;

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', handleVisibility);

      const { fiscalYear: yearNum, periodLabel } = parsePeriod(selectedYear);
      const hasRevenue = selectedEntity.available_datasets.some(
        d => d.fiscal_year === yearNum && d.dataset_type === 'revenue'
      );
      if (!hasRevenue) return;

      clearCache();
      loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'revenue', periodLabel)
        .then(data => setRevenueData(hoistSingleRoot(data)))
        .catch(err => console.error('Post-donation revenue refetch failed:', err));
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [selectedEntity, selectedYear]);

  // Lazy-load linked transactions when navigating into a category (operating only)
  useEffect(() => {
    setLinkedTransactions(null);

    if (activeDataset !== 'operating' || navigationPath.length === 0 || !budgetData) return;

    const currentCat = navigationPath[navigationPath.length - 1];
    if (!currentCat.linkKey) return;

    const budgetId = budgetData.budgetId;
    if (!budgetId) return;

    loadLinkedTransactions(budgetId, currentCat.linkKey)
      .then(summary => setLinkedTransactions(summary))
      .catch(err => {
        console.error('Failed to load linked transactions:', err);
        setLinkedTransactions(null);
      });
  }, [navigationPath, activeDataset, budgetData]);

  const handleCategoryClick = useCallback((category: BudgetCategory) => {
    const hasSubs = category.subcategories && category.subcategories.length > 0;
    const hasLines = category.lineItems && category.lineItems.length > 0;
    if (!hasSubs && !hasLines) return;
    setNavigationPath([...navigationPath, category]);
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
    setNavigationPath(path);
  }, []);

  // Jurisdiction chain for the breadcrumb: Federal → State → County above the
  // current entity. Gives every city a link up to its State and the federal
  // government (and its County when one is linked). The federal entity and all
  // 50 state entities are always present in the municipalities list, so a city
  // resolves its state by abbreviation and the nation directly.
  const jurisdictionParents = useMemo<Municipality[]>(() => {
    if (!selectedEntity) return [];
    const federal = municipalities.find(m => m.entity_type === 'federal') ?? null;
    const state = municipalities.find(
      m => m.entity_type === 'state' && m.state === selectedEntity.state
    ) ?? null;
    const county = selectedEntity.county_id
      ? municipalities.find(m => m.id === selectedEntity.county_id) ?? null
      : null;

    const keep = (arr: (Municipality | null)[]) =>
      arr.filter((m): m is Municipality => m != null);

    switch (selectedEntity.entity_type) {
      case 'federal':
        return []; // top of the chain
      case 'state':
        return keep([federal]);
      case 'county':
        return keep([federal, state]);
      case 'nonprofit':
        return []; // not a government jurisdiction
      default: // city, town, township, municipality, special_district, etc.
        return keep([federal, state, county]);
    }
  }, [selectedEntity, municipalities]);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [];

    // Jurisdiction chain — Federal → State → County links above the current entity
    for (const parent of jurisdictionParents) {
      items.push({
        label: parent.name,
        onClick: () => handleEntityChange(parent),
      });
    }

    items.push({
      label: selectedEntity?.name ?? 'City',
      onClick: navigationPath.length > 0 ? () => setNavigationPath([]) : undefined
    });

    items.push({
      label: getDatasetLabel(activeDataset),
      onClick: navigationPath.length > 0 ? () => setNavigationPath([]) : undefined
    });

    navigationPath.forEach((category, index) => {
      items.push({
        label: category.enrichment?.plainName || category.name,
        onClick: index < navigationPath.length - 1
          ? () => setNavigationPath(navigationPath.slice(0, index + 1))
          : undefined
      });
    });

    return items;
  }, [navigationPath, activeDataset, selectedEntity, jurisdictionParents, handleEntityChange]);

  const displayText = getDatasetDisplayText(activeDataset);

  // Only show search when the city has enriched categories (plain names + tags)
  const hasEnrichment = useMemo(() => {
    const cats = [
      ...(operatingBudgetData?.categories ?? []),
      ...(revenueData?.categories ?? []),
    ];
    return cats.some(c => c.enrichment != null);
  }, [operatingBudgetData, revenueData]);

  // County "grouper" pages (e.g. Orange County) have no budget of their own —
  // their cities carry the data. The page's value is the Cities-in-County
  // directory below, so suppress the budget chrome (year selector, plain-language
  // summary, dataset tabs) and let it read as a clean city directory rather than
  // an empty budget view. Counties that DO have their own budget (e.g. LA County)
  // are unaffected.
  const isCountyDirectoryOnly =
    selectedEntity?.entity_type === 'county' &&
    (selectedEntity.available_datasets?.length ?? 0) === 0;

  // Federal scale transform (VIZ-05): pure display math on a COPY of the tree —
  // amount ÷ sourced denominator (population or returns filed). Never mutates
  // loaded data; formulas disclosed in ScaleToggle tooltips + MethodologyPanel.
  // MUST live above the appView early returns — hooks below them violate the
  // Rules of Hooks when the view transitions (React #310, caught in 45 UAT).
  const displayData = useMemo(() => {
    if (!budgetData || selectedEntity?.entity_type !== 'federal' || federalScale === 'dollars') {
      return budgetData;
    }
    const divisor = federalScale === 'perPerson'
      ? (federalDenominators?.population || 0)
      : (federalDenominators?.taxReturns || 0);
    if (!divisor) return budgetData;
    const scaleCat = (cat: BudgetCategory): BudgetCategory => ({
      ...cat,
      amount: cat.amount / divisor,
      actualAmount: cat.actualAmount !== undefined ? cat.actualAmount / divisor : undefined,
      subcategories: cat.subcategories?.map(scaleCat),
      lineItems: cat.lineItems?.map(li => ({
        ...li,
        approvedAmount: li.approvedAmount / divisor,
        actualAmount: li.actualAmount / divisor,
      })),
    });
    return {
      ...budgetData,
      metadata: { ...budgetData.metadata, totalBudget: budgetData.metadata.totalBudget / divisor },
      categories: budgetData.categories.map(scaleCat),
    };
  }, [budgetData, federalScale, selectedEntity, federalContextData, federalDenominators]);

  const profileMenu = isAuthenticated
    ? { label: 'Account', items: [
        { label: 'Profile', onClick: () => { window.location.href = 'https://login.empowered.vote/profile'; } },
        { label: 'EV Financials', onClick: () => { window.location.href = 'https://financials.empowered.vote'; } },
        { label: 'Sign out', onClick: signOut },
      ]}
    : { label: 'Account', items: [{ label: 'Sign in', onClick: () => { window.location.href = getLoginUrl(); } }] };

  // Resolving auth — show spinner
  if (appView === 'resolving') {
    return (
      <div className="min-h-screen bg-[#F7F7F8] dark:bg-ev-gray-950 font-manrope">
        <SiteHeader logoSrc={`${import.meta.env.BASE_URL}${isDark ? 'EV-Dark-Logo.png' : 'EV-Light-Logo.png'}`} style={darkHeaderStyle} />
        <div className="flex items-center justify-center py-16">
          <div role="status" aria-live="polite" aria-label="Loading" className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-4 border-[#E2EBEF] dark:border-ev-gray-700 border-t-ev-muted-blue animate-spin" />
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
        profileMenu={profileMenu}
      />
    );
  }

  // Budget view — initial load guard while entity resolves
  if (!selectedEntity) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] dark:bg-ev-gray-950 font-manrope">
        <SiteHeader logoSrc={`${import.meta.env.BASE_URL}${isDark ? 'EV-Dark-Logo.png' : 'EV-Light-Logo.png'}`} style={darkHeaderStyle} />
        <div className="flex items-center justify-center py-16">
          <div role="status" aria-live="polite" aria-label="Loading budget data" className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-4 border-[#E2EBEF] dark:border-ev-gray-700 border-t-ev-muted-blue animate-spin" />
            <span className="sr-only">Loading budget data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state when data load fails (after entity is resolved)
  if (!loading && !budgetData && budgetLoadError) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] dark:bg-ev-gray-950 font-manrope">
        <SiteHeader logoSrc={`${import.meta.env.BASE_URL}${isDark ? 'EV-Dark-Logo.png' : 'EV-Light-Logo.png'}`} style={darkHeaderStyle} />
        <div className="max-w-[1400px] mx-auto px-6 py-16 flex justify-center">
          <div className="bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-8 text-center max-w-md w-full">
            <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-2">
              Unable to load budget data
            </h2>
            <p className="text-sm text-ev-gray-500 mb-6">
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
    ? (displayData?.categories ?? [])
    : navigationPath[navigationPath.length - 1].subcategories || [];

  const isPastYear = parsePeriod(selectedYear).fiscalYear < new Date().getFullYear();
  // Only use actual data if the categories actually have it (non-zero actualAmount)
  const hasActualData = isPastYear && currentCategories.some(c => (c.actualAmount ?? 0) > 0);
  const displayCategories = currentCategories.filter(c =>
    hasActualData ? (c.actualAmount ?? c.amount) !== 0 : c.amount !== 0
  );

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-ev-gray-950 font-manrope">
      <AppHeader
        profileMenu={profileMenu}
        style={darkHeaderStyle}
        onNavigate={(href) => { window.location.href = href === '/' ? 'https://alpha.empowered.vote' : href; }}
        showBackButton
        onBack={() => {
          window.history.pushState({}, '', window.location.pathname);
          setAppView('landing');
        }}
      />

      {/* Hero banner */}
      <div
        className={`relative h-48 bg-cover bg-center ${!heroImageUrl ? 'bg-gradient-to-r from-[#005366] to-[#007A8C]' : ''}`}
        style={heroImageUrl ? {
          backgroundImage: `url('${heroImageUrl}')`,
          ...(getHeroBgPosition(selectedEntity) ? { backgroundPosition: getHeroBgPosition(selectedEntity)! } : {}),
        } : undefined}
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

      {/* FY notice — shown when selected entity has no FY2026 data yet */}
      {selectedEntity && availableYears.length > 0 && !availableYears.includes('2026') && (
        <div className="bg-[#FFF8ED] dark:bg-ev-yellow-950/30 border-l-4 border-[#F5D98B] dark:border-ev-yellow-700/60">
          <div className="max-w-[1400px] mx-auto px-6 py-2">
            <p className="text-sm text-[#92400E] dark:text-ev-yellow-300" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Latest available: FY{availableYears[0]}. FY2026 data not yet published by {selectedEntity.name}.
            </p>
          </div>
        </div>
      )}

      {/* Header / Controls bar */}
      <div className="bg-white dark:bg-ev-gray-800 shadow-sm dark:shadow-none dark:border-b dark:border-ev-gray-700">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {!isFinancialsHost && (
              <EntitySwitcher
                municipalities={municipalities}
                selectedEntity={selectedEntity}
                onEntityChange={handleEntityChange}
              />
            )}
            {!isCountyDirectoryOnly && (
              <YearSelector
                ref={yearSelectorRef}
                selectedYear={selectedYear}
                years={availableYears}
                onYearChange={setSelectedYear}
              />
            )}
            {/* Funds on Hand — static, dated bank balance (Phase 76). A quiet meta
                chip, deliberately out of the donor-feedback flow: it does NOT move
                on donation (bank payouts lag), so it must not read as a live number. */}
            {selectedEntity?.entity_type === 'nonprofit' && orgSummary && (
              <div
                className="flex items-center gap-1.5 h-[42px] px-3 py-2 text-sm font-medium bg-white dark:bg-ev-gray-700 border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg text-ev-gray-600 dark:text-ev-gray-300 whitespace-nowrap"
                title="Current bank balance (Beneficial State Bank). Updated when reconciled — not live; bank payouts lag platform donations."
              >
                <Wallet size={14} className="shrink-0 text-ev-gray-500" />
                <span className="tabular-nums font-semibold text-ev-gray-800 dark:text-ev-gray-100">
                  ${orgSummary.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-ev-gray-400 dark:text-ev-gray-400">on hand</span>
                {(() => {
                  const dp = (orgSummary.balance_as_of || '').slice(0, 10);
                  const [y, m, d] = dp.split('-').map(Number);
                  const label = (y && m && d)
                    ? new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : dp;
                  return label ? <span className="text-ev-gray-400 text-[12px]">· as of {label}</span> : null;
                })()}
              </div>
            )}
            {selectedYear === '2025' && selectedEntity?.entity_type === 'nonprofit' && (
              <a
                href="/Empowered%20Vote%20Annual%20Report%202025.pdf"
                download="Empowered Vote Annual Report 2025.pdf"
                className="flex items-center gap-1.5 h-[42px] px-3 py-2 text-sm font-medium bg-white dark:bg-ev-gray-700 border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg text-ev-gray-600 dark:text-ev-gray-300 hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-600 hover:text-ev-muted-blue transition-colors duration-200 whitespace-nowrap"
                title="Download 2025 Annual Report"
              >
                <FileText size={14} className="shrink-0" />
                <span>Annual Report</span>
              </a>
            )}
            {hasEnrichment && (
              <div className="flex-1 min-w-0">
                <BudgetSearch
                  cityId={selectedEntity.id}
                  cityName={selectedEntity.name}
                  fiscalYear={parsePeriod(selectedYear).fiscalYear}
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
            )}
            {selectedEntity?.entity_type === 'nonprofit' &&
              selectedYear === String(new Date().getFullYear()) && (
              <button
                data-donate-btn=""
                onClick={() => setDonateOpen(true)}
                className="flex items-center gap-1.5 h-[42px] px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg transition-colors duration-200 whitespace-nowrap ml-auto"
              >
                <Heart size={14} className="shrink-0" fill="currentColor" />
                <span>Donate</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {(jurisdictionParents.length > 0 || breadcrumbItems.length > 2) && <Breadcrumb items={breadcrumbItems} />}

      {/* Main content area */}
      <div className="relative">
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-[#F7F7F8]/80 dark:bg-ev-gray-950/80 z-10"
            role="status"
            aria-live="polite"
            aria-label="Loading budget data"
          >
            <div className="w-8 h-8 rounded-full border-4 border-[#E2EBEF] dark:border-ev-gray-700 border-t-ev-muted-blue animate-spin" />
            <span className="sr-only">Loading budget data...</span>
          </div>
        )}
        {budgetLoadError && !loading && (
          <div className="max-w-[1400px] mx-auto px-6 py-16 text-center">
            <p className="text-lg font-semibold text-ev-gray-700 dark:text-ev-gray-300 mb-2">
              Couldn't load budget data for {selectedEntity?.name}.
            </p>
            <p className="text-sm text-ev-gray-500 dark:text-ev-gray-400 mb-6">
              This city may not have data available yet, or there was a temporary error.
            </p>
            <button
              onClick={() => { setBudgetLoadError(false); window.history.back(); }}
              className="text-sm text-ev-muted-blue hover:underline"
            >
              ← Go back
            </button>
          </div>
        )}
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          {/* Dashboard Section — only show at top level; hidden for budget-less
              county directory pages (their value is the Cities-in-County panel) */}
          {navigationPath.length === 0 && !isCountyDirectoryOnly && (
            <>
              {/* Federal landing: official first-split + deficit context replaces the
                  narrative summary (whose uncontextualized totals would mislead — 45-CONTEXT) */}
              {selectedEntity?.entity_type === 'federal' ? (
                <div className="mb-6">
                  <FederalLanding
                    fiscalYear={parsePeriod(selectedYear).fiscalYear}
                    periodLabel={parsePeriod(selectedYear).periodLabel}
                    isCurrent={selectedYear === availableYears[0]}
                  />
                </div>
              ) : (
                /* Plain language summary — lead with the story */
                <div className="mb-6 space-y-6">
                  {/* Micro-donation mission tile (Phase 81.5) — EV nonprofit only.
                      The new first tile, directly above the "How Empowered Vote uses its
                      funds" narrative (PlainLanguageSummary). */}
                  {selectedEntity?.entity_type === 'nonprofit' && <MicroDonationCallout />}
                  <PlainLanguageSummary
                    entity={selectedEntity}
                    operatingData={operatingBudgetData}
                    revenueData={revenueData}
                    salariesTotal={salariesData?.metadata.totalCompensation ?? salariesData?.metadata.totalBudget ?? null}
                    fiscalYear={selectedYear}
                    isPastYear={isPastYear}
                    onCategoryClick={handleSummaryCategoryClick}
                    onYearClick={() => yearSelectorRef.current?.open()}
                    allFundsRequirementsData={allFundsRequirementsData}
                    orgSummary={selectedEntity?.entity_type === 'nonprofit' ? orgSummary : null}
                  />
                  {/* Funds on Hand + goal progress — placed below the narrative (Chris, 2026-06-21) */}
                  {selectedEntity?.entity_type === 'nonprofit' && orgSummary && (
                    <OrgTransparencyPanel summary={orgSummary} orgName={selectedEntity.name} />
                  )}
                </div>
              )}

              {/* Basis-change disclosure note (D-08, Phase 58-03): shown only when
                  the city's displayed budget series mixes bases across years — the
                  curated cityBasisNotes map is authored only for Long Beach and West
                  Hollywood (the two D-04 layered cities). Absent entry ⇒ nothing
                  renders ⇒ no change for pure-SCO cities, Los Angeles, counties, or
                  federal pages. Additive pattern: safe by construction. */}
              {(() => {
                const basisNote = selectedEntity
                  ? cityBasisNotes[`${selectedEntity.name}|${selectedEntity.state}`]
                  : undefined;
                return basisNote ? (
                  <div className="mb-6">
                    <ComparabilityNote
                      title="Note: budget history spans two reporting bases"
                      intro={basisNote.intro}
                      entries={basisNote.entries}
                    />
                  </div>
                ) : null;
              })()}

              {/* Dataset Tabs */}
              <div className="mb-8">
                <DatasetTabs
                  activeDataset={activeDataset}
                  onDatasetChange={(id) => setActiveDataset(id as DatasetType)}
                  revenueTotal={revenueData?.metadata.totalBudget}
                  operatingTotal={allFundsRequirementsData?.metadata.totalBudget ?? operatingBudgetData?.metadata.totalBudget ?? undefined}
                  salariesTotal={salariesData?.metadata.totalBudget}
                  availableDatasets={availableDatasetTypes}
                  isNonprofit={selectedEntity?.entity_type === 'nonprofit'}
                />
              </div>
            </>
          )}

          {/* Budget Visualization Section */}
          {budgetData && (
            <div ref={chartSectionRef} className="space-y-6">
              {/* Federal controls: lens toggle (Money Out only, VIZ-03), scale modes
                  (VIZ-05), per-dataset source chip (VIZ-04) */}
              {selectedEntity?.entity_type === 'federal' && (
                <div className="flex items-center gap-3 flex-wrap">
                  {activeDataset === 'operating' && (
                    <LensToggle
                      lens={federalLens}
                      onChange={(l) => { setFederalLens(l); setNavigationPath([]); }}
                    />
                  )}
                  <ScaleToggle
                    scale={federalScale}
                    onChange={(s) => { setFederalScale(s); setNavigationPath([]); }}
                    population={federalDenominators?.population ?? 0}
                    populationYear={federalDenominators?.populationYear ?? null}
                    taxReturns={federalDenominators?.taxReturns ?? null}
                    taxReturnsLabel={federalDenominators?.taxReturnsLabel ?? null}
                  />
                  {budgetData.metadata.dataSourceInfo && (
                    <SourceChip
                      sourceName={budgetData.metadata.dataSourceInfo.displayName}
                      // Federal dataset base_urls are raw fetch endpoints (OMB .xlsx / MTS API JSON),
                      // so federal chips link to the human registry page instead. Cities keep their
                      // datasetUrl (usually a real portal page) — don't regress them.
                      sourceUrl={
                        (selectedEntity?.entity_type === 'federal'
                          ? (budgetData.metadata.dataSourceInfo.url || budgetData.metadata.dataSourceInfo.datasetUrl)
                          : (budgetData.metadata.dataSourceInfo.datasetUrl || budgetData.metadata.dataSourceInfo.url)) || ''
                      }
                      fetchDate={budgetData.metadata.dataSourceInfo.fetchedAt}
                    />
                  )}
                  {/* Visible formula disclosure (UAT note: tooltip-only wasn't enough —
                      and the per-person/per-taxpayer gap needs explaining in place) */}
                  {federalScale !== 'dollars' && (
                    <p className="w-full text-xs text-ev-gray-500 dark:text-ev-gray-400">
                      {federalScale === 'perPerson'
                        ? `Each figure = total ÷ ${(federalDenominators?.population ?? 0).toLocaleString()} (US resident population, July ${federalDenominators?.populationYear ?? '—'}; Census/BEA via FRED).`
                        : `Each figure = total ÷ ${(federalDenominators?.taxReturns ?? 0).toLocaleString()} individual income tax returns filed (IRS SOI). Fewer returns than people — one return often covers a couple or household, and not everyone files — so per-taxpayer figures run about twice per-person.`}
                    </p>
                  )}
                </div>
              )}
              {/* County source chip (D-03, Phase 57): OC county page only.
                  SEPARATE from the federal block above — that block carries federal-only
                  Lens/Scale toggles which must NOT appear on county pages.
                  Renders only when dataSourceInfo is non-null. The EV-Accounts API
                  populates data_source_info for county/municipal budgets from the
                  source_url + source_date + data_source columns when data_source_id is
                  null (treasuryService.ts, deployed 2026-06-16) — so this chip is live. */}
              {selectedEntity?.entity_type === 'county' && budgetData.metadata.dataSourceInfo && (
                <div className="flex items-center gap-3 flex-wrap">
                  <SourceChip
                    sourceName={budgetData.metadata.dataSourceInfo.displayName}
                    sourceUrl={
                      (budgetData.metadata.dataSourceInfo.datasetUrl || budgetData.metadata.dataSourceInfo.url) || ''
                    }
                    fetchDate={budgetData.metadata.dataSourceInfo.fetchedAt}
                  />
                </div>
              )}
              {/* Comparability / definition-drift note (CTX-02): on historical annual
                  years only — suppressed on the current/default year (clean headline)
                  and on the TQ (which gets its own note in FederalLanding). How OMB
                  keeps functions comparable over time + the Cabinet departments created
                  after the viewed year (which is why an old agency lens won't match today). */}
              {selectedEntity?.entity_type === 'federal'
                && parsePeriod(selectedYear).periodLabel === null
                && selectedYear !== availableYears[0]
                && (() => {
                  const viewedYear = parsePeriod(selectedYear).fiscalYear;
                  const laterReorgs = comparability.agency_reorganizations.filter((r) => r.year > viewedYear);
                  return (
                    <ComparabilityNote
                      title="Comparing this year to today"
                      entries={[comparability.function_classification]}
                      reorganizations={laterReorgs}
                      reorgHeading={`Cabinet departments created or reorganized after FY${viewedYear}`}
                    />
                  );
                })()}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100">
                    {navigationPath.length === 0
                      ? `How ${budgetData.metadata.cityName} ${displayText.title}`
                      : navigationPath[navigationPath.length - 1].enrichment?.plainName || navigationPath[navigationPath.length - 1].name}
                  </h2>
                  <p className="text-sm text-ev-gray-500 mt-1">
                    {navigationPath.length === 0
                      ? displayText.description
                      : showLineItems
                        ? displayText.lineItemsDescription
                        : null}
                  </p>
                  {navigationPath.length === 0 && (
                    <p className="text-xs text-ev-gray-400 mt-0.5">Tap any category to explore.</p>
                  )}
                  {navigationPath.length > 0 && (() => {
                    const currentCat = navigationPath[navigationPath.length - 1];
                    const shortDesc = currentCat.enrichment?.shortDescription;
                    const desc = currentCat.enrichment?.description;
                    if (!shortDesc && !desc) return null;
                    return (
                      <div className="mt-3 space-y-2">
                        {shortDesc && (
                          <p className="text-[15px] font-medium text-ev-gray-700 dark:text-ev-gray-200 leading-relaxed">
                            {shortDesc}
                          </p>
                        )}
                        {desc && desc !== shortDesc && (
                          <p className="text-[14px] text-ev-gray-600 leading-relaxed">
                            {desc}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Tier 2 program origins (federal pilot) — renders only when the
                  drilled category has a program_details row */}
              {navigationPath.length > 0 && navigationPath[navigationPath.length - 1].programOrigins && (
                <ProgramOrigins origins={navigationPath[navigationPath.length - 1].programOrigins!} />
              )}

              {showLineItems ? (
                <>
                  {activeDataset === 'operating' ? (
                    <>
                      <BudgetVisualization
                        categories={displayData!.categories}
                        navigationPath={navigationPath}
                        totalBudget={displayData!.metadata.totalBudget}
                        onPathClick={handlePathClick}
                        isNonprofit={selectedEntity?.entity_type === 'nonprofit'}
                      />
                      {linkedTransactions ? (
                        <LinkedTransactionsPanel
                          linkedTransactions={linkedTransactions}
                          categoryName={currentCategory!.name}
                          linkKey={currentCategory!.linkKey}
                          fiscalYear={parsePeriod(selectedYear).fiscalYear}
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
                    categories={displayData!.categories}
                    navigationPath={navigationPath}
                    totalBudget={displayData!.metadata.totalBudget}
                    onPathClick={handlePathClick}
                    isNonprofit={selectedEntity?.entity_type === 'nonprofit'}
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
                      <p className="text-xs text-ev-gray-400 dark:text-ev-gray-500 mb-3">
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
                      fiscalYear={parsePeriod(selectedYear).fiscalYear}
                    />
                  )}
                </>
              ) : navigationPath.length > 0 ? (
                // Leaf node: no subcategories and no line items — show chart context + transactions or message
                <>
                  <BudgetVisualization
                    categories={displayData!.categories}
                    navigationPath={navigationPath}
                    totalBudget={displayData!.metadata.totalBudget}
                    onPathClick={handlePathClick}
                    isNonprofit={selectedEntity?.entity_type === 'nonprofit'}
                  />
                  {linkedTransactions ? (
                    <LinkedTransactionsPanel
                      linkedTransactions={linkedTransactions}
                      categoryName={currentCategory!.name}
                      linkKey={currentCategory!.linkKey}
                      fiscalYear={parsePeriod(selectedYear).fiscalYear}
                    />
                  ) : activeDataset === 'operating' && currentCategory?.linkKey ? (
                    <div className="bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-8 flex flex-col items-center gap-3">
                      <div className="w-6 h-6 rounded-full border-[3px] border-[#E2EBEF] dark:border-ev-gray-600 border-t-ev-muted-blue animate-spin" />
                      <p className="text-sm text-ev-gray-500">Loading transactions…</p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6 text-center">
                      <p className="text-sm font-medium text-[#1C1C1C] dark:text-ev-gray-100 mb-1">No further breakdown available</p>
                      <p className="text-xs text-ev-gray-500">This category has no subcategories or line items in the current dataset.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-8 text-center">
                  <p className="text-sm text-ev-gray-500">No data available for the selected filters.</p>
                </div>
              )}
            </div>
          )}

          {/* Contextual help — subtle, not preachy */}
          {navigationPath.length === 0 && budgetData && (
            <div className="mt-6 p-4 bg-ev-gray-050 dark:bg-ev-gray-900 border border-ev-gray-200 dark:border-ev-gray-700 rounded-lg text-sm text-ev-gray-500 dark:text-ev-gray-400">
              <strong className="text-ev-gray-700 dark:text-ev-gray-300">How to explore:</strong> Tap any category above to see its breakdown.
              Use the tabs to switch between spending, revenue, and employee compensation.
              Every level lets you dig deeper until you reach individual line items and transactions.
            </div>
          )}

          {/* Federal methodology panel — VIZ-06 + Phase 44 owed disclosures */}
          {navigationPath.length === 0 && selectedEntity?.entity_type === 'federal' && (
            <div className="mt-6">
              <MethodologyPanel />
            </div>
          )}

          {/* All 50 states — jump-off tags at the bottom of the federal page */}
          {navigationPath.length === 0 && selectedEntity?.entity_type === 'federal' && (
            <StatesInFederalPanel
              municipalities={municipalities}
              onStateClick={handleEntityChange}
            />
          )}

          {/* Cities in County panel — rendered below budget on county pages */}
          {navigationPath.length === 0 && selectedEntity?.entity_type === 'county' && (
            <CitiesInCountyPanel
              county={selectedEntity}
              municipalities={municipalities}
              onCityClick={handleEntityChange}
            />
          )}

          {/* Counties in State panel — rendered below budget on state pages (before cities) */}
          {navigationPath.length === 0 && selectedEntity?.entity_type === 'state' && (
            <CountiesInStatePanel
              state={selectedEntity}
              municipalities={municipalities}
              onCountyClick={handleEntityChange}
            />
          )}

          {/* Cities in State panel — rendered below budget on state pages */}
          {navigationPath.length === 0 && selectedEntity?.entity_type === 'state' && (
            <CitiesInStatePanel
              state={selectedEntity}
              municipalities={municipalities}
              onCityClick={handleEntityChange}
            />
          )}
        </div>
      </div>

      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} />
    </div>
  )
}

export default App
