/**
 * Budget Data Types
 */

export interface SearchResult {
  categoryId: string;
  budgetId: string;
  categoryName: string;
  plainName: string;
  shortDescription: string;
  amount: number;
  percentage: number;
  datasetType: string;
  fiscalYear: number;
  cityName: string;
  cityState: string;
  tags: string[];
  source: string;
  confidence: string;
}

export interface LineItem {
  description: string;
  approvedAmount: number;
  actualAmount: number;
  metadata?: {
    // For salaries
    basePay?: number;
    benefits?: number;
    overtime?: number;
    other?: number;
    startDate?: string;
    // For transactions
    vendor?: string;
    date?: string;
    paymentMethod?: string;
    invoiceNumber?: string;
    fund?: string;
    expenseCategory?: string;
  };
}

export interface LinkedTransaction {
  description: string;
  amount: number;
  vendor: string;
  date: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  fund: string;
  expenseCategory: string;
}

export interface LinkedTransactionSummary {
  totalAmount: number;
  transactionCount: number;
  vendorCount: number;
  topVendors: Array<{ name: string; amount: number; count: number }>;
  transactions: LinkedTransaction[];
  hasMore?: boolean; // True if there are more transactions available in the index file
}

export interface CategoryEnrichment {
  plainName: string;
  shortDescription: string;
  description: string;
  tags: string[];
  source: string;       // 'ai' | 'official' | 'hybrid'
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  confidence: string;   // 'high' | 'medium' | 'low'
}

/**
 * Program origins (Tier 2 details, federal pilot): enabling statute, public
 * law, sponsor — structured from Congress.gov/GovInfo records, every claim
 * with a paired URL. Sponsor fields are null for pre-1973 laws (no structured
 * sponsor data exists); details carries the sponsor_note boundary claim.
 */
export interface ProgramOrigins {
  programName: string;
  enablingBill?: string | null;
  enablingBillUrl?: string | null;
  publicLaw?: string | null;
  publicLawUrl?: string | null;
  enactedYear?: number | null;
  sponsor?: string | null;
  sponsorUrl?: string | null;
  cosponsorsCount?: number | null;
  cosponsorsUrl?: string | null;
  details?: Array<{ field: string; value: string; source_url: string }> | null;
  sourceApi: string;
}

export interface BudgetCategory {
  name: string;
  amount: number;
  actualAmount?: number;
  percentage: number;
  color: string;
  subcategories?: BudgetCategory[];
  description?: string;
  enrichment?: CategoryEnrichment | null;
  programOrigins?: ProgramOrigins | null;
  whyMatters?: string;
  historicalChange?: number;
  items?: number; // Number of line items aggregated into this category
  lineItems?: LineItem[]; // Detailed line items at the lowest level
  linkKey?: string; // Key for linking to transactions (priority|service|fund|expenseCategory)
  linkedTransactions?: LinkedTransactionSummary; // Linked transaction data from transactions dataset
  metadata?: {
    // For salaries
    employeeCount?: number;
    avgCompensation?: number;
    count?: number;
    avgTotal?: number;
    avgBase?: number;
    avgBenefits?: number;
    avgOvertime?: number;
    positionType?: string;
    // For transactions
    transactionCount?: number;
    vendorCount?: number;
    avgTransaction?: number;
  };
}

/** Municipality with available dataset metadata — matches ListMunicipalities API response */
export interface Municipality {
  id: string;
  name: string;
  state: string;
  entity_type:
    | 'city'
    | 'county'
    | 'township'
    | 'nonprofit'
    | 'state'
    | 'municipality'
    | 'special_district'
    | 'school_district'
    | 'conservancy'
    | 'library'
    | 'town'
    | 'federal';
  population: number;
  population_year?: number | null;
  hero_image_url?: string | null;
  county_id?: string | null;           // UUID reference to parent county municipality row
  available_datasets: Array<{
    fiscal_year: number;
    dataset_type: 'operating' | 'revenue' | 'salaries' | 'all_funds_requirements' | 'federal_agency';
    period_label?: string | null; // non-null only for sub-annual periods (FY1976 Transition Quarter)
  }>;
}

export interface BudgetData {
  budgetId?: string; // API budget UUID for follow-up queries (e.g., transactions)
  metadata: {
    cityName: string;
    fiscalYear: number;
    population: number;
    totalBudget: number;
    generatedAt: string;
    hierarchy: string[];
    dataSource: string;
    dataSourceInfo?: {
      displayName: string;
      url: string;
      datasetUrl?: string | null;  // exact dataset URL (federal source chips)
      fetchedAt?: string | null;   // last sync timestamp
    } | null;
    datasetType?: string;
    // For salaries
    totalCompensation?: number;
    totalEmployees?: number;
    avgCompensation?: number;
    includesEmployeeNames?: boolean;
    // For transactions
    totalSpending?: number;
    totalTransactions?: number;
    avgTransaction?: number;
    // For revenue
    totalRevenue?: number;
  };
  categories: BudgetCategory[];
  // For transactions analytics
  analytics?: {
    monthlySpending?: Array<{
      month: string;
      amount: number;
      transactionCount: number;
    }>;
    topVendors?: Array<{
      name: string;
      totalSpent: number;
      transactionCount: number;
    }>;
  };
}

// ── Federal context (Phase 45) — /api/treasury/federal/context ───────────────
// Always-sourced landing data for the United States entity. Every row carries
// its source columns, written by the Phase 44 loaders.

export interface FederalAnnualSummaryRow {
  fiscal_year: number;
  receipts: number;
  outlays: number;
  /** Raw OMB sign convention: negative = deficit. Never re-derive. */
  surplus_or_deficit: number;
  mandatory: number | null;
  discretionary_defense: number | null;
  discretionary_nondefense: number | null;
  net_interest: number | null;
  source_name: string;
  source_url: string;
  source_date: string;
}

export interface FederalContextMetric {
  value: number;
  as_of_date: string;
  label: string;
  source_name: string;
  source_url: string;
  source_date: string;
}

export interface FederalContext {
  annual_summary: FederalAnnualSummaryRow[];
  metrics: Record<string, FederalContextMetric>;
  source_display_names: Record<string, string>;
}

/**
 * Comparability / definition-drift content (Phase 51, CTX-02).
 * Authored inline from fetched official text and stored, git-reviewed, in
 * data/federal-comparability.json (the committed audit trail). Every entry
 * carries source_name / source_url / source_date; scripts/verifyComparabilitySources.mjs
 * asserts the URLs resolve.
 */
export interface ComparabilitySource {
  /** Optional heading for the note. */
  title?: string;
  text: string;
  /** Optional verbatim excerpt from the source. */
  quote?: string;
  source_name: string;
  source_url: string;
  source_date: string;
}

export interface AgencyReorganization {
  agency: string;
  year: number;
  note: string;
  quote?: string;
  enabling_law: string;
  source_name: string;
  source_url: string;
  source_date: string;
}

export interface ComparabilityContent {
  transition_quarter: ComparabilitySource;
  function_classification: ComparabilitySource;
  agency_reorganizations: AgencyReorganization[];
}
