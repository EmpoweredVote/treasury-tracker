/**
 * Budget Data Types
 */

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

export interface BudgetCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  subcategories?: BudgetCategory[];
  description?: string;
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

export interface BudgetData {
  metadata: {
    cityName: string;
    fiscalYear: number;
    population: number;
    totalBudget: number;
    generatedAt: string;
    hierarchy: string[];
    dataSource: string;
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
