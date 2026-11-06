// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any -- the probes record whatever props App passes */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * App.tsx — the state its effects own, pinned from the OUTSIDE.
 *
 * ⚠ Written BEFORE the effects were refactored (2026-11-06), and run green
 * against the old code first. Each `describe` matches one place where App used
 * to set state inside an effect body: the clears on entity / year / dataset
 * change, the year clamp (UAT G5), the series seed (Plano), the URL restore of
 * `?scope=&basis=`, the budget-less entity, the per-capita fallback and the
 * linked-transactions loader. A refactor that changes what the reader sees in
 * any of these fails here.
 *
 * Every child component is replaced by a PROBE that records the props App
 * passed it, and every network module is mocked. So these tests read App's own
 * decisions (which year, which series, which pool, loading or not) and nothing
 * the children do with them. ⚠ jsdom does no layout: nothing here is visual.
 */

const h = vi.hoisted(() => {
  const props: Record<string, any> = {};
  type Impl = (...args: any[]) => any;
  const impl: Record<string, Impl> = {};
  return { props, impl };
});

async function probeModule(name: string, named?: string) {
  const { createElement: ce } = await import('react');
  const Probe = (p: any) => {
    h.props[name] = p;
    return ce('div', { 'data-probe': name }, p.children);
  };
  return named ? { [named]: Probe } : { default: Probe };
}

vi.mock('./components/AppHeader', () => probeModule('AppHeader', 'AppHeader'));
vi.mock('@empoweredvote/ev-ui', () => probeModule('SiteFooter', 'SiteFooter'));
vi.mock('./components/dashboard/PlainLanguageSummary', () => probeModule('PlainLanguageSummary'));
vi.mock('./components/dashboard/OrgTransparencyPanel', () => probeModule('OrgTransparencyPanel'));
vi.mock('./components/dashboard/MicroDonationCallout', () => probeModule('MicroDonationCallout'));
vi.mock('./components/dashboard/BudgetSearch', () => probeModule('BudgetSearch'));
vi.mock('./components/federal/FederalLanding', () => probeModule('FederalLanding'));
vi.mock('./components/federal/LensToggle', () => probeModule('LensToggle'));
vi.mock('./components/federal/SourceChip', () => probeModule('SourceChip'));
vi.mock('./components/federal/MethodologyPanel', () => probeModule('MethodologyPanel'));
vi.mock('./components/federal/ComparabilityNote', () => probeModule('ComparabilityNote'));
vi.mock('./components/federal/ScaleToggle', () => probeModule('ScaleToggle'));
vi.mock('./components/federal/ProgramOrigins', () => probeModule('ProgramOrigins'));
vi.mock('./components/FigureFlagBanner', () => probeModule('FigureFlagBanner'));
vi.mock('./components/EntitySwitcher', () => probeModule('EntitySwitcher'));
vi.mock('./components/AlphaLanding', () => probeModule('AlphaLanding'));
vi.mock('./components/datasets/DatasetTabs', () => probeModule('DatasetTabs'));
vi.mock('./components/YearSelector', () => probeModule('YearSelector'));
vi.mock('./components/FundSeriesToggle', () => probeModule('FundSeriesToggle'));
vi.mock('./components/SourceBar', () => probeModule('SourceBar'));
vi.mock('./components/Breadcrumb', () => probeModule('Breadcrumb'));
vi.mock('./components/BudgetVisualization', () => probeModule('BudgetVisualization'));
vi.mock('./components/CategoryList', () => probeModule('CategoryList'));
vi.mock('./components/LineItemsTable', () => probeModule('LineItemsTable'));
vi.mock('./components/LinkedTransactionsPanel', () => probeModule('LinkedTransactionsPanel'));
vi.mock('./components/CitiesInCountyPanel', () => probeModule('CitiesInCountyPanel'));
vi.mock('./components/CitiesInStatePanel', () => probeModule('CitiesInStatePanel'));
vi.mock('./components/CountiesInStatePanel', () => probeModule('CountiesInStatePanel'));
vi.mock('./components/StatesInFederalPanel', () => probeModule('StatesInFederalPanel'));
vi.mock('./components/FeatureIconRow', () => probeModule('FeatureIconRow', 'FeatureIconRow'));

vi.mock('@empoweredvote/analytics', () => ({
  identify: vi.fn(), pageview: vi.fn(), track: vi.fn(),
}));
vi.mock('./utils/auth', () => ({
  resolveToken: (...a: any[]) => h.impl.resolveToken(...a),
  fetchUserSession: async () => null,
  getLoginUrl: () => '/login',
  signOut: () => {},
}));
vi.mock('./utils/essentialsCoverage', () => ({ useEssentialsCoverage: () => null }));
vi.mock('./utils/triviaCoverage', () => ({ useTriviaCoverage: () => null }));
vi.mock('./utils/wikiImage', () => ({
  getHeroImage: (...a: any[]) => h.impl.getHeroImage(...a),
  getHeroBgPosition: () => null,
}));
vi.mock('./data/entityQueries', () => ({
  fetchEntities: (...a: any[]) => h.impl.fetchEntities(...a),
  fetchEntityById: (...a: any[]) => h.impl.fetchEntityById(...a),
  fetchEntityIndex: (...a: any[]) => h.impl.fetchEntityIndex(...a),
}));
vi.mock('./data/dataLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/dataLoader')>();
  return {
    SeriesAbsentError: actual.SeriesAbsentError,
    loadBudgetData: (...a: any[]) => h.impl.loadBudgetData(...a),
    loadFederalContext: (...a: any[]) => h.impl.loadFederalContext(...a),
    loadOrgFinancialSummary: (...a: any[]) => h.impl.loadOrgFinancialSummary(...a),
    loadLinkedTransactions: (...a: any[]) => h.impl.loadLinkedTransactions(...a),
    listMunicipalities: async () => ALL,
    listMunicipalitiesBySlug: async (slug: string) => ALL.filter((m) => toSlug(m) === slug),
    listEntityAliases: async () => [],
    hydrateMunicipality: async (m: any) => m,
    clearCache: () => {},
  };
});

import App from './App';
import { toSlug } from './utils/entityRouting';
import { SERIES_TOGGLE_COPY } from './data/fundScopeVocabulary';

// ── Fixtures ────────────────────────────────────────────────────────────────

const ds = (fiscal_year: number, dataset_type: string, fund_scope = 'all_funds', basis = 'actual') =>
  ({ fiscal_year, dataset_type, period_label: null, fund_scope, basis });

const ent = (o: Record<string, unknown>) =>
  ({ population: 1000, county_id: null, ...o }) as any;

/** Default series all_funds·actual FY2022–24; a second series unknown·adopted FY2025–26. */
const ALPHA = ent({
  id: 'city-a', name: 'Alpha City', state: 'IN', entity_type: 'city', county_id: 'cnty-1',
  available_datasets: [
    ...[2022, 2023, 2024].flatMap((y) => [ds(y, 'operating'), ds(y, 'revenue')]),
    ds(2025, 'operating', 'unknown', 'adopted'),
    ds(2026, 'operating', 'unknown', 'adopted'),
    ds(2024, 'all_funds_requirements'),
  ],
});
const BETA = ent({
  id: 'city-b', name: 'Beta Town', state: 'IN', entity_type: 'city', county_id: 'cnty-2',
  available_datasets: [2023, 2024].flatMap((y) => [ds(y, 'operating'), ds(y, 'revenue')]),
});
/** PLANO, TX shape: Money Out defaults to unknown·adopted, Money In to unknown·unknown. */
const PLANO = ent({
  id: 'plano', name: 'Plano', state: 'TX', entity_type: 'city',
  available_datasets: [
    ...[2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) => ds(y, 'operating', 'unknown', 'adopted')),
    ...[2019, 2020, 2022].map((y) => ds(y, 'revenue', 'unknown', 'unknown')),
  ],
});
const INDIANA = ent({
  id: 'st-in', name: 'Indiana', state: 'IN', entity_type: 'state',
  available_datasets: [ds(2024, 'operating')],
});
const USA = ent({
  id: 'fed', name: 'United States', state: 'US', entity_type: 'federal',
  available_datasets: [ds(2023, 'operating'), ds(2024, 'operating')],
});
/** A grouper county: no budget of its own. */
const GROUPER = ent({
  id: 'cnty-9', name: 'Grouper County', state: 'IN', entity_type: 'county', available_datasets: [],
});
const CHARITY = ent({
  id: 'np', name: 'Helping Org', state: 'CA', entity_type: 'nonprofit',
  available_datasets: [2024, 2025].flatMap((y) => [ds(y, 'operating', 'unknown', 'unknown'), ds(y, 'revenue', 'unknown', 'unknown')]),
});
const COUNTIES: Record<string, any> = {
  'cnty-1': ent({ id: 'cnty-1', name: 'Monroe County', state: 'IN', entity_type: 'county' }),
  'cnty-2': ent({ id: 'cnty-2', name: 'Brown County', state: 'IN', entity_type: 'county' }),
};
const ALL = [ALPHA, BETA, PLANO, INDIANA, USA, GROUPER, CHARITY];

const PATROL = { name: 'Patrol', amount: 60, linkKey: 'patrol' };
const POLICE = { name: 'Police', amount: 60, subcategories: [PATROL] };
const PARKS = { name: 'Parks', amount: 40, subcategories: [{ name: 'Trails', amount: 40 }] };

function budget(name: string, dataset: string, year: number) {
  const total = dataset === 'all_funds_requirements' ? 9_999 : year * 10 + (dataset === 'revenue' ? 1 : 0);
  return {
    budgetId: `b-${name}-${dataset}-${year}`,
    metadata: { cityName: name, fiscalYear: year, population: 0, totalBudget: total, generatedAt: '', hierarchy: [], dataSource: '' },
    categories: [POLICE, PARKS],
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function defaultImpls() {
  h.impl.resolveToken = async () => null;
  h.impl.getHeroImage = async (e: any) => ({ url: `https://img.test/${e.id}.jpg`, credit: null });
  h.impl.fetchEntities = async (q: any) => {
    if (q.entityTypes?.includes('federal')) return [USA, INDIANA];
    if (q.state === 'IN') return [INDIANA, ALPHA, BETA, GROUPER];
    if (q.countyId) return [ent({ id: 'c-in', name: 'County Town', state: 'IN', entity_type: 'city', county_id: q.countyId })];
    if (q.entityTypes?.includes('state')) return [INDIANA];
    return [];
  };
  h.impl.fetchEntityById = async (id: string) => COUNTIES[id] ?? null;
  h.impl.fetchEntityIndex = async () => [ALPHA, BETA];
  h.impl.loadBudgetData = async (year: number, name: string, _s: string, dataset: string) => budget(name, dataset, year);
  h.impl.loadFederalContext = async () => ({
    annual_summary: [], source_display_names: {},
    metrics: {
      population_fy2024: { value: 330_000_000, label: 'pop' },
      tax_returns_filed_fy2024: { value: 150_000_000, label: 'returns' },
    },
  });
  h.impl.loadOrgFinancialSummary = async (_id: string, year: number) => ({ marker: `org-${year}` });
  h.impl.loadLinkedTransactions = async () => ({ totalAmount: 1, transactionCount: 1, vendorCount: 1, topVendors: [], transactions: [] });
}

// ── Harness ─────────────────────────────────────────────────────────────────

let host: HTMLDivElement;
let root: Root;

async function settle() {
  for (let i = 0; i < 8; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

async function mountAt(search: string) {
  window.history.replaceState({}, '', `/${search}`);
  act(() => { root.render(createElement(App)); });
  await settle();
}

async function run(fn: () => unknown) {
  await act(async () => { await fn(); });
  await settle();
}

const probe = (name: string) => host.querySelector(`[data-probe="${name}"]`);
const crumbs = () => (h.props.Breadcrumb?.items ?? []).map((i: any) => i.label);
const isBreadcrumbShown = () => probe('Breadcrumb') !== null;
const chartLoading = () => host.querySelector('[aria-label="Loading budget data"]') !== null;
const url = () => new URLSearchParams(window.location.search);

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  for (const k of Object.keys(h.props)) delete h.props[k];
  defaultImpls();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('arriving by link', () => {
  it('lands on the newest year of the default series, not the newest row', async () => {
    await mountAt('?entity=alpha-city-in');
    expect(h.props.YearSelector.selectedYear).toBe('2024');
    expect(h.props.FundSeriesToggle.selectedId).toBe('all_funds|actual');
    expect(url().get('scope')).toBeNull();
  });

  it('restores ?scope=&basis= and keeps them in the URL (UAT 2026-08-21)', async () => {
    await mountAt('?entity=alpha-city-in&year=2025&scope=unknown&basis=adopted');
    expect(h.props.FundSeriesToggle.selectedId).toBe('unknown|adopted');
    expect(h.props.YearSelector.selectedYear).toBe('2025');
    expect(url().get('scope')).toBe('unknown');
    expect(url().get('basis')).toBe('adopted');
    expect(url().get('year')).toBe('2025');
  });

  it('a restored series on an uncovered year is clamped, with the note', async () => {
    await mountAt('?entity=alpha-city-in&year=2023&scope=unknown&basis=adopted');
    expect(h.props.YearSelector.selectedYear).toBe('2025');
    expect(probe('SourceBar')?.querySelector('p')?.textContent).toBe(
      SERIES_TOGGLE_COPY.yearClamped('2023', '2025', 'Scope not established · adopted budget'));
  });
});

describe('series seed (Plano)', () => {
  it('is taken from the dataset the reader arrives on, and held across tabs', async () => {
    await mountAt('?entity=plano-tx&year=2022&dataset=revenue');
    expect(h.props.DatasetTabs.activeDataset).toBe('revenue');
    expect(h.props.FundSeriesToggle.selectedId).toBe('unknown|unknown');
    await run(() => h.props.DatasetTabs.onDatasetChange('operating'));
    expect(h.props.DatasetTabs.activeDataset).toBe('operating');
    expect(h.props.FundSeriesToggle.selectedId).toBe('unknown|unknown');
  });

  it('arriving on Money Out seeds its own default, and Money In does not move it', async () => {
    await mountAt('?entity=plano-tx&year=2022');
    expect(h.props.FundSeriesToggle.selectedId).toBe('unknown|adopted');
    await run(() => h.props.DatasetTabs.onDatasetChange('revenue'));
    expect(h.props.FundSeriesToggle.selectedId).toBe('unknown|adopted');
  });

  it('a chosen series is dropped when the entity changes', async () => {
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.FundSeriesToggle.onSelect({ fundScope: 'unknown', basis: 'adopted' }));
    expect(h.props.FundSeriesToggle.selectedId).toBe('unknown|adopted');
    await run(() => h.props.EntitySwitcher.onEntityChange(BETA));
    expect(h.props.FundSeriesToggle.selectedId).toBe('all_funds|actual');
    expect(url().get('scope')).toBeNull();
  });
});

describe('year clamp on series change (UAT G5)', () => {
  it('moves to the nearest covered year and KEEPS the note after the move', async () => {
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.FundSeriesToggle.onSelect({ fundScope: 'unknown', basis: 'adopted' }));
    expect(h.props.YearSelector.selectedYear).toBe('2025');
    expect(url().get('year')).toBe('2025');
    expect(url().get('basis')).toBe('adopted');
    expect(probe('SourceBar')?.querySelector('p')?.textContent).toBe(
      SERIES_TOGGLE_COPY.yearClamped('2024', '2025', 'Scope not established · adopted budget'));
  });

  it('clears the note once the reader picks another year themselves', async () => {
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.FundSeriesToggle.onSelect({ fundScope: 'unknown', basis: 'adopted' }));
    await run(() => h.props.YearSelector.onYearChange('2026'));
    expect(h.props.YearSelector.selectedYear).toBe('2026');
    expect(probe('SourceBar')?.querySelector('p')).toBeNull();
  });

  it('switching back clamps back, with a fresh note', async () => {
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.FundSeriesToggle.onSelect({ fundScope: 'unknown', basis: 'adopted' }));
    await run(() => h.props.FundSeriesToggle.onSelect({ fundScope: 'all_funds', basis: 'actual' }));
    expect(h.props.YearSelector.selectedYear).toBe('2024');
    expect(probe('SourceBar')?.querySelector('p')?.textContent).toBe(
      SERIES_TOGGLE_COPY.yearClamped('2025', '2024', 'All Funds · actuals'));
  });
});

describe('entity switch', () => {
  it('shows the jurisdiction chain, including the county fetched by id', async () => {
    await mountAt('?entity=alpha-city-in');
    expect(crumbs()).toEqual(['United States', 'Indiana', 'Monroe County', 'Alpha City', 'Budget']);
  });

  it("never shows the previous entity's county while the new one loads", async () => {
    await mountAt('?entity=alpha-city-in');
    const county = deferred<any>();
    h.impl.fetchEntityById = () => county.promise;
    await run(() => h.props.EntitySwitcher.onEntityChange(BETA));
    expect(crumbs()).toEqual(['United States', 'Indiana', 'Beta Town', 'Budget']);
    await run(() => county.resolve(COUNTIES['cnty-2']));
    expect(crumbs()).toEqual(['United States', 'Indiana', 'Brown County', 'Beta Town', 'Budget']);
  });

  it('a nonprofit clears the parent pool, so the next city waits for its own', async () => {
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.EntitySwitcher.onEntityChange(CHARITY));
    expect(isBreadcrumbShown()).toBe(false);
    const parents = deferred<any[]>();
    h.impl.fetchEntities = () => parents.promise;
    await run(() => h.props.EntitySwitcher.onEntityChange(BETA));
    expect(crumbs()).toEqual(['Brown County', 'Beta Town', 'Budget']);
    await run(() => parents.resolve([USA, INDIANA]));
    expect(crumbs()).toEqual(['United States', 'Indiana', 'Brown County', 'Beta Town', 'Budget']);
  });

  it("clears the hero banner while the new entity's image loads", async () => {
    await mountAt('?entity=alpha-city-in');
    const bg = () => host.querySelector<HTMLElement>('.h-48')?.style.backgroundImage ?? '';
    expect(bg()).toContain('city-a.jpg');
    const img = deferred<any>();
    h.impl.getHeroImage = () => img.promise;
    await run(() => h.props.EntitySwitcher.onEntityChange(BETA));
    expect(bg()).toBe('');
    await run(() => img.resolve({ url: 'https://img.test/city-b.jpg', credit: null }));
    expect(bg()).toContain('city-b.jpg');
  });

  it('panels: a state fills them; a city clears the pool; a county waits for its own', async () => {
    await mountAt('?entity=indiana-in');
    expect(h.props.CountiesInStatePanel.municipalities.length).toBeGreaterThan(0);
    await run(() => h.props.EntitySwitcher.onEntityChange(ALPHA));
    const pool = deferred<any[]>();
    h.impl.fetchEntities = (q: any) => (q.countyId ? pool.promise : Promise.resolve([USA, INDIANA]));
    await run(() => h.props.EntitySwitcher.onEntityChange(GROUPER));
    expect(h.props.CitiesInCountyPanel.municipalities).toEqual([]);
    await run(() => pool.resolve([BETA]));
    expect(h.props.CitiesInCountyPanel.municipalities).toEqual([BETA]);
  });

  it('keeps the year when the new entity has it, else lands on its default', async () => {
    await mountAt('?entity=alpha-city-in&year=2023');
    await run(() => h.props.EntitySwitcher.onEntityChange(BETA));
    expect(h.props.YearSelector.selectedYear).toBe('2023');
    await run(() => h.props.EntitySwitcher.onEntityChange(PLANO));
    expect(h.props.YearSelector.selectedYear).toBe('2023');
    await run(() => h.props.EntitySwitcher.onEntityChange(USA));
    expect(h.props.YearSelector.selectedYear).toBe('2023');
    await run(() => h.props.EntitySwitcher.onEntityChange(INDIANA));
    expect(h.props.YearSelector.selectedYear).toBe('2024');
  });
});

describe('budget loader', () => {
  it('shows the loading overlay until the chart data arrives', async () => {
    const chart = deferred<any>();
    h.impl.loadBudgetData = (year: number, name: string, _s: string, dataset: string) =>
      dataset === 'operating' && year === 2023 ? chart.promise : Promise.resolve(budget(name, dataset, year));
    await mountAt('?entity=alpha-city-in');
    expect(chartLoading()).toBe(false);
    await run(() => h.props.YearSelector.onYearChange('2023'));
    expect(chartLoading()).toBe(true);
    await run(() => chart.resolve(budget('Alpha City', 'operating', 2023)));
    expect(chartLoading()).toBe(false);
    expect(h.props.BudgetVisualization.totalBudget).toBe(20230);
  });

  it('a real failure trips the error screen', async () => {
    h.impl.loadBudgetData = async (year: number, name: string, _s: string, dataset: string) => {
      if (dataset === 'operating') throw new Error('boom');
      return budget(name, dataset, year);
    };
    await mountAt('?entity=alpha-city-in');
    expect(host.textContent).toContain('Unable to load budget data');
  });

  it('a drilled path resets when the year changes', async () => {
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.BudgetVisualization.onPathClick([PARKS]));
    expect(h.props.BudgetVisualization.navigationPath).toEqual([PARKS]);
    await run(() => h.props.YearSelector.onYearChange('2023'));
    expect(h.props.BudgetVisualization.navigationPath).toEqual([]);
  });

  it('a budget-less entity renders its directory: no load, no spinner, no error, path reset', async () => {
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.BudgetVisualization.onPathClick([PARKS]));
    const calls: unknown[][] = [];
    const inner = h.impl.loadBudgetData;
    h.impl.loadBudgetData = (...a: any[]) => { calls.push(a); return inner(...a); };
    await run(() => h.props.EntitySwitcher.onEntityChange(GROUPER));
    expect(calls.filter((c) => c[1] === 'Grouper County')).toEqual([]);
    expect(chartLoading()).toBe(false);
    expect(host.textContent).not.toContain('Unable to load budget data');
    expect(host.textContent).not.toContain("Couldn't load budget data");
    expect(probe('BudgetVisualization')).toBeNull();
    expect(probe('CitiesInCountyPanel')).not.toBeNull();
    expect(crumbs().slice(-2)).toEqual(['Grouper County', 'Budget']);
  });
});

describe('all-funds requirements tile', () => {
  it('feeds the Money Out total in a year that has it, and is cleared in one that does not', async () => {
    await mountAt('?entity=alpha-city-in');
    expect(h.props.DatasetTabs.operatingTotal).toBe(9_999);
    await run(() => h.props.YearSelector.onYearChange('2023'));
    expect(h.props.DatasetTabs.operatingTotal).toBe(20230);
  });
});

describe('nonprofit summary', () => {
  it('loads per entity and year, and is cleared for a non-nonprofit', async () => {
    await mountAt('?entity=helping-org-ca&year=2024');
    expect(h.props.PlainLanguageSummary.orgSummary).toEqual({ marker: 'org-2024' });
    expect(h.props.OrgTransparencyPanel.summary).toEqual({ marker: 'org-2024' });
    await run(() => h.props.YearSelector.onYearChange('2025'));
    expect(h.props.PlainLanguageSummary.orgSummary).toEqual({ marker: 'org-2025' });
    await run(() => h.props.EntitySwitcher.onEntityChange(ALPHA));
    expect(h.props.PlainLanguageSummary.orgSummary).toBeNull();
    expect(probe('OrgTransparencyPanel')).toBeNull();
  });
});

describe('federal per-capita scale', () => {
  it('falls back to dollars in a year with no denominator, and stays there', async () => {
    await mountAt('?entity=united-states-us&year=2024');
    await run(() => h.props.ScaleToggle.onChange('perPerson'));
    expect(h.props.ScaleToggle.scale).toBe('perPerson');
    expect(h.props.BudgetVisualization.totalBudget).toBeCloseTo(20240 / 330_000_000);
    await run(() => h.props.YearSelector.onYearChange('2023'));
    expect(h.props.ScaleToggle.scale).toBe('dollars');
    await run(() => h.props.YearSelector.onYearChange('2024'));
    expect(h.props.ScaleToggle.scale).toBe('dollars');
  });

  it('per-taxpayer falls back the same way', async () => {
    await mountAt('?entity=united-states-us&year=2024');
    await run(() => h.props.ScaleToggle.onChange('perTaxpayer'));
    expect(h.props.ScaleToggle.scale).toBe('perTaxpayer');
    await run(() => h.props.YearSelector.onYearChange('2023'));
    expect(h.props.ScaleToggle.scale).toBe('dollars');
  });
});

describe('linked transactions', () => {
  it('spinner while loading, panel when found, cleared on leaving the category', async () => {
    const tx = deferred<any>();
    h.impl.loadLinkedTransactions = () => tx.promise;
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.BudgetVisualization.onPathClick([POLICE, PATROL]));
    expect(host.textContent).toContain('Loading transactions…');
    await run(() => tx.resolve({ totalAmount: 5, transactionCount: 1, vendorCount: 1, topVendors: [], transactions: [] }));
    expect(h.props.LinkedTransactionsPanel.linkedTransactions.totalAmount).toBe(5);
    await run(() => h.props.BudgetVisualization.onPathClick([POLICE]));
    expect(probe('LinkedTransactionsPanel')).toBeNull();
    expect(host.textContent).not.toContain('Loading transactions…');
  });

  it('a category with none says so instead of spinning', async () => {
    h.impl.loadLinkedTransactions = async () => null;
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.BudgetVisualization.onPathClick([POLICE, PATROL]));
    expect(host.textContent).toContain('No further breakdown available');
  });

  it("a late response for a category already left is dropped", async () => {
    const first = deferred<any>();
    const second = deferred<any>();
    const queue = [first, second];
    h.impl.loadLinkedTransactions = () => queue.shift()!.promise;
    await mountAt('?entity=alpha-city-in');
    await run(() => h.props.BudgetVisualization.onPathClick([POLICE, PATROL]));
    await run(() => h.props.BudgetVisualization.onPathClick([POLICE]));
    await run(() => h.props.BudgetVisualization.onPathClick([POLICE, PATROL]));
    await run(() => first.resolve({ totalAmount: 5, transactionCount: 1, vendorCount: 1, topVendors: [], transactions: [] }));
    expect(host.textContent).toContain('Loading transactions…');
    expect(probe('LinkedTransactionsPanel')).toBeNull();
    await run(() => second.resolve({ totalAmount: 7, transactionCount: 1, vendorCount: 1, topVendors: [], transactions: [] }));
    expect(h.props.LinkedTransactionsPanel.linkedTransactions.totalAmount).toBe(7);
  });
});

describe('entity index', () => {
  it('the landing view starts the index fetch and reports loading until it settles', async () => {
    const index = deferred<any[]>();
    h.impl.fetchEntityIndex = () => index.promise;
    await mountAt('');
    expect(h.props.AlphaLanding.indexLoading).toBe(true);
    expect(h.props.AlphaLanding.municipalities).toEqual([]);
    await run(() => index.resolve([ALPHA, BETA]));
    expect(h.props.AlphaLanding.indexLoading).toBe(false);
    expect(h.props.AlphaLanding.municipalities).toEqual([ALPHA, BETA]);
  });

  it('a failed index fetch settles to empty, not loading', async () => {
    h.impl.fetchEntityIndex = () => Promise.reject(new Error('down'));
    await mountAt('');
    expect(h.props.AlphaLanding.indexLoading).toBe(false);
    expect(h.props.AlphaLanding.municipalities).toEqual([]);
  });
});
