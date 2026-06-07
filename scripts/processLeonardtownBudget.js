#!/usr/bin/env node
/**
 * Leonardtown, MD Operating Budget Loader — General Fund + Enterprise Fund
 *
 * Loads approved expenditures for FY2023, FY2024, and FY2025 into treasury
 * database using the treasury_sync_budget_tree RPC.
 *
 * Tree structure (two top-level fund groups):
 *   General Fund  → 7 departments  → line items
 *   Enterprise Fund → utilities    → cost-category items
 *
 * Data sources:
 *   FY2023: leonardtown.somd.com/pdf/Budget-FY2023.pdf (text PDF, pdftotext)
 *   FY2024: leonardtown.somd.com/pdf/BudgetFY2024.pdf (Xerox scan; data
 *           extracted from rendered page images)
 *   FY2025: leonardtown.somd.com/pdf/BudgetFY2025.pdf (scanned PDF, approved
 *           April 8, 2024; data extracted from rendered page images)
 *
 * Combined approved totals (General Fund + Enterprise Fund):
 *   FY2023: $6,094,754   FY2024: $7,114,937   FY2025: $7,762,229
 *
 * Enterprise Fund is expenses-only. The town's enterprise revenues equal
 * expenses (self-funded utilities); the revenue side is NOT loaded here.
 *
 * Leonardtown, MD population (2020 Census): 4,563
 * County seat of St. Mary's County, MD.
 *
 * Usage:
 *   node scripts/processLeonardtownBudget.js              # load FY2023 + FY2024 + FY2025
 *   node scripts/processLeonardtownBudget.js --fy 2023    # single year
 *   node scripts/processLeonardtownBudget.js --fy 2024
 *   node scripts/processLeonardtownBudget.js --fy 2025
 *   node scripts/processLeonardtownBudget.js --dry-run    # parse + print, no DB
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const POPULATION   = 4_563;

// ── Budget data ────────────────────────────────────────────────────────────────
// All amounts are Approved budget figures from the Town of Leonardtown's
// official budget documents. Minor $1 rounding artifacts exist in the source
// PDFs; the validator allows ±$2 tolerance per fund.

const BUDGETS = {
  2023: {
    generalFund: {
      total: 2_667_305,
      departments: [
        {
          name: 'General Government', amount: 711_279,
          lineItems: [
            { name: 'Salaries',                       amount: 296_066 },
            { name: 'Payroll Taxes and Benefits',     amount:  75_951 },
            { name: 'Legal Counsel',                  amount:   7_500 },
            { name: 'Accounting Service',             amount:  25_000 },
            { name: 'Other Professional Services',    amount:  47_430 },
            { name: 'Property/Liability Insurance',   amount:  18_500 },
            { name: 'Utilities',                      amount:  25_000 },
            { name: 'Building Maint./Janitorial',     amount:  19_985 },
            { name: 'Equipment Maintenance',          amount:   3_000 },
            { name: 'Office Supplies',                amount:  10_000 },
            { name: 'Postage',                        amount:   5_750 },
            { name: 'Travel and Training',            amount:  18_805 },
            { name: 'Dues, Memberships and Subs.',    amount:   5_800 },
            { name: 'Advertising and Public Notices', amount:     750 },
            { name: 'Hospitality',                    amount:   5_700 },
            { name: 'Debt Service',                   amount: 125_104 },
            { name: 'Lease Payments',                 amount:     888 },
            { name: 'Other Operating',                amount:   1_500 },
            { name: 'Payments to Other Agencies',     amount:     750 },
            { name: 'Capital Outlay',                 amount:  17_800 },
          ],
        },
        {
          name: 'Community Development', amount: 303_669,
          lineItems: [
            { name: 'Salaries',                            amount:  91_091 },
            { name: 'Payroll Taxes and Benefits',          amount:  20_605 },
            { name: 'Professional Services',               amount:  42_770 },
            { name: "Veteran's Day Parade",                amount:   7_151 },
            { name: 'Tree Lighting',                       amount:   7_601 },
            { name: 'Concerts on the Square',              amount:   6_800 },
            { name: 'Boat Races',                          amount:   1_500 },
            { name: 'Arts and Entertainment District',     amount:  13_617 },
            { name: 'Public Relations/Promotions',         amount:   9_250 },
            { name: 'Facade Improvements Pass Thru Grant', amount:  50_000 },
            { name: 'Other Operating',                     amount:  22_034 },
            { name: 'Capital Outlay',                      amount:  31_250 },
          ],
        },
        {
          name: 'Planning and Zoning', amount: 182_576,
          lineItems: [
            { name: 'Salaries',                    amount: 123_376 },
            { name: 'Payroll Taxes and Benefits',  amount:  24_950 },
            { name: 'Legal Counsel',               amount:   4_500 },
            { name: 'Professional Services',       amount:  25_000 },
            { name: 'Supplies',                    amount:     750 },
            { name: 'Other Operating',             amount:   4_000 },
          ],
        },
        {
          name: 'Public Safety', amount: 93_678,
          lineItems: [
            { name: 'Salaries',                    amount:  14_063 },
            { name: 'Payroll Taxes and Benefits',  amount:   4_511 },
            { name: 'Law Enforcement',             amount:  72_604 },
            { name: 'Fire Department Grant',       amount:   1_000 },
            { name: 'Rescue Squad Grant',          amount:   1_000 },
            { name: 'Other Operating',             amount:     500 },
          ],
        },
        {
          name: 'Public Works', amount: 759_193,
          lineItems: [
            { name: 'Salaries',                         amount:  67_800 },
            { name: 'Payroll Taxes and Benefits',       amount:  19_270 },
            { name: 'Street Sweeping',                  amount:  43_452 },
            { name: 'Road Maintenance',                 amount: 351_098 },
            { name: 'Snow and Ice Removal',             amount:  50_000 },
            { name: 'Storm Drain/Sidewalk Maintenance', amount:  60_000 },
            { name: 'Street Lighting/Electricity',      amount:  51_706 },
            { name: 'Grounds Maintenance',              amount:  87_867 },
            { name: 'Street Signs and Maintenance',     amount:   5_000 },
            { name: 'Other Operating',                  amount:  20_000 },
            { name: 'Capital Outlay',                   amount:   3_000 },
          ],
        },
        {
          name: 'Recreation and Parks', amount: 211_402,
          lineItems: [
            { name: 'Salaries',                      amount:  42_768 },
            { name: 'Payroll Taxes and Benefits',    amount:  10_173 },
            { name: 'Contribution to Old Jail O&M',  amount:  10_000 },
            { name: 'Utilities',                     amount:   6_638 },
            { name: 'Facility Maintenance',          amount:  38_840 },
            { name: 'Grounds Maintenance',           amount:  74_559 },
            { name: 'Other Operating',               amount:   3_424 },
            { name: 'Capital Outlay',                amount:  25_000 },
          ],
        },
        {
          name: 'Transfers and Reserves', amount: 405_508,
          lineItems: [
            { name: 'Transfer to Capital Projects - PAYGO',        amount: 221_108 },
            { name: 'Transfer to Capital Projects - Fund Balance',  amount:  60_000 },
            { name: 'Committed to Waterfront Revitalization',       amount: 124_400 },
          ],
        },
      ],
    },

    enterpriseFund: {
      total: 3_427_449,
      utilities: [
        {
          name: 'Sewer System', amount: 1_811_190,
          lineItems: [
            // Wastewater Treatment Plant and Collection System are the two
            // major sub-operations; detailed line items are on each sub-system
            { name: 'Wastewater Treatment Plant - Personnel Services', amount: 381_199 },
            { name: 'Wastewater Treatment Plant - Operations & Maint.', amount: 600_053 },
            { name: 'Wastewater Treatment Plant - Debt Service',       amount: 471_490 },
            { name: 'Wastewater Treatment Plant - Contingency',        amount:  36_772 },
            { name: 'Wastewater Treatment Plant - Repair & Replace.',  amount:  98_125 },
            { name: 'Collection System - Personnel Services',          amount:  89_350 },
            { name: 'Collection System - Operations & Maintenance',    amount: 109_333 },
            { name: 'Collection System - Contingency',                 amount:   5_000 },
            { name: 'Collection System - Repair & Replacement',        amount:  19_868 },
          ],
        },
        {
          name: 'Water System', amount: 587_150,
          lineItems: [
            { name: 'Personnel Services',              amount: 197_943 },
            { name: 'Operations & Maintenance',        amount: 283_500 },
            { name: 'Contingency',                     amount:  57_563 },
            { name: 'Repair & Replacement Reserve',   amount:  48_144 },
          ],
        },
        {
          name: 'Waste Disposal', amount: 1_029_109,
          lineItems: [
            { name: 'Personnel Services',           amount:  43_117 },
            { name: 'Waste Disposal Contract',      amount: 977_992 },
            { name: 'Other Operating',              amount:   8_000 },
          ],
        },
      ],
    },
  },

  2024: {
    generalFund: {
      total: 3_092_864,
      departments: [
        {
          name: 'General Government', amount: 801_797,
          lineItems: [
            { name: 'Salaries',                       amount: 356_005 },
            { name: 'Payroll Taxes and Benefits',     amount:  97_235 },
            { name: 'Legal Counsel',                  amount:   7_500 },
            { name: 'Accounting Service',             amount:  35_600 },
            { name: 'Other Professional Services',    amount:  47_430 },
            { name: 'Property/Liability Insurance',   amount:  21_000 },
            { name: 'Utilities',                      amount:  25_000 },
            { name: 'Building Maint./Janitorial',     amount:  19_985 },
            { name: 'Equipment Maintenance',          amount:   3_500 },
            { name: 'Office Supplies',                amount:  10_000 },
            { name: 'Postage',                        amount:   5_750 },
            { name: 'Travel and Training',            amount:  25_000 },
            { name: 'Dues, Memberships and Subs.',    amount:   5_800 },
            { name: 'Advertising and Public Notices', amount:     750 },
            { name: 'Hospitality',                    amount:   6_000 },
            { name: 'Debt Service',                   amount: 125_104 },
            { name: 'Lease Payments',                 amount:     888 },
            { name: 'Other Operating',                amount:   1_500 },
            { name: 'Payments to Other Agencies',     amount:     750 },
            { name: 'Capital Outlay',                 amount:   7_000 },
          ],
        },
        {
          name: 'Community Development', amount: 412_097,
          lineItems: [
            { name: 'Salaries',                            amount: 127_804 },
            { name: 'Payroll Taxes and Benefits',          amount:  27_283 },
            { name: 'Professional Services',               amount:  70_160 },
            { name: 'Movie Festival',                      amount:   4_500 },
            { name: 'Shark Week/Duck',                     amount:  20_000 },
            { name: "Veteran's Day Parade",                amount:   7_000 },
            { name: 'Tree Lighting',                       amount:   7_600 },
            { name: 'Concerts on the Square',              amount:   9_000 },
            { name: 'Main Street',                         amount:   5_000 },
            { name: 'Boat Races',                          amount:   1_500 },
            { name: 'Arts and Entertainment District',     amount:  14_000 },
            { name: 'Public Relations/Promotions',         amount:  14_250 },
            { name: 'Facade Improvements Pass Thru Grant', amount:  50_000 },
            { name: 'Other Operating',                     amount:  23_500 },
            { name: 'Capital Outlay',                      amount:  30_500 },
          ],
        },
        {
          name: 'Planning and Zoning', amount: 220_450,
          lineItems: [
            { name: 'Salaries',                    amount: 120_972 },
            { name: 'Payroll Taxes and Benefits',  amount:  33_548 },
            { name: 'Legal Counsel',               amount:   4_500 },
            { name: 'Professional Services',       amount:  50_000 },
            { name: 'Supplies',                    amount:     750 },
            { name: 'Other Operating',             amount:   4_000 },
            { name: 'Capital Outlay',              amount:   6_680 },
          ],
        },
        {
          name: 'Public Safety', amount: 104_083,
          lineItems: [
            { name: 'Salaries',                    amount:  12_560 },
            { name: 'Payroll Taxes and Benefits',  amount:   4_433 },
            { name: 'Law Enforcement',             amount:  80_590 },
            { name: 'Fire Department Grant',       amount:   1_000 },
            { name: 'Rescue Squad Grant',          amount:   1_000 },
            { name: 'Other Operating',             amount:     500 },
            { name: 'Capital Outlay',              amount:   4_000 },
          ],
        },
        {
          name: 'Public Works', amount: 900_162,
          lineItems: [
            { name: 'Salaries',                         amount:  82_784 },
            { name: 'Payroll Taxes and Benefits',       amount:  26_462 },
            { name: 'Street Sweeping',                  amount:  46_752 },
            { name: 'Road Maintenance',                 amount: 409_675 },
            { name: 'Snow and Ice Removal',             amount:  50_000 },
            { name: 'Storm Drain/Sidewalk Maintenance', amount:  65_000 },
            { name: 'Street Lighting/Electricity',      amount:  48_822 },
            { name: 'Grounds Maintenance',              amount:  92_117 },
            { name: 'Street Signs and Maintenance',     amount:  20_000 },
            { name: 'Other Operating',                  amount:  22_550 },
            { name: 'Capital Outlay',                   amount:  36_000 },
          ],
        },
        {
          name: 'Recreation and Parks', amount: 217_890,
          lineItems: [
            { name: 'Salaries',                      amount:  28_582 },
            { name: 'Payroll Taxes and Benefits',    amount:   7_099 },
            { name: 'Contribution to Old Jail O&M',  amount:  10_000 },
            { name: 'Utilities',                     amount:   5_360 },
            { name: 'Facility Maintenance',          amount:  48_340 },
            { name: 'Grounds Maintenance',           amount:  80_109 },
            { name: 'Other Operating',               amount:   3_500 },
            { name: 'Capital Outlay',                amount:  34_900 },
          ],
        },
        {
          name: 'Transfers and Reserves', amount: 436_384,
          lineItems: [
            { name: 'Transfer to Capital Projects - Fund Balance',        amount: 124_921 },
            { name: 'Committed to Waterfront Revitalization/Fund Balance', amount: 311_463 },
          ],
        },
      ],
    },

    enterpriseFund: {
      total: 4_022_073,
      utilities: [
        {
          name: 'Sewer System', amount: 2_410_621,
          lineItems: [
            { name: 'Wastewater Treatment Plant - Personnel Services', amount: 397_324 },
            { name: 'Wastewater Treatment Plant - Operations & Maint.', amount: 685_237 },
            { name: 'Wastewater Treatment Plant - Debt Service',       amount: 1_047_140 },
            { name: 'Wastewater Treatment Plant - Capital Outlay',     amount:    75_900 },
            { name: 'Wastewater Treatment Plant - Contingency',        amount:     7_523 },
            { name: 'Collection System - Personnel Services',          amount:    82_849 },
            { name: 'Collection System - Operations & Maintenance',    amount:   114_648 },
          ],
        },
        {
          name: 'Water System', amount: 575_848,
          lineItems: [
            { name: 'Personnel Services',             amount: 167_508 },
            { name: 'Operations & Maintenance',       amount: 311_068 },
            { name: 'Capital Outlay',                 amount:  13_720 },
            { name: 'Contingency',                    amount:  35_693 },
            // R&R Reserve: $47,858 in document; items sum to $575,847 vs $575,848 in summary
            // adding $1 to R&R to reconcile the source rounding artifact
            { name: 'Repair & Replacement Reserve',  amount:  47_859 },
          ],
        },
        {
          name: 'Waste Disposal', amount: 1_035_605,
          lineItems: [
            { name: 'Personnel Services',       amount:  44_864 },
            { name: 'Waste Disposal Contract',  amount: 980_992 },
            { name: 'Other Operating',          amount:   9_749 },
          ],
        },
      ],
    },
  },

  2025: {
    generalFund: {
      total: 2_683_356,
      departments: [
        {
          name: 'General Government', amount: 806_312,
          lineItems: [
            { name: 'Salaries',                       amount: 336_243 },
            { name: 'Payroll Taxes and Benefits',     amount:  93_943 },
            { name: 'Legal Counsel',                  amount:   7_500 },
            { name: 'Accounting Service',             amount:  35_600 },
            { name: 'Other Professional Services',    amount:  49_750 },
            { name: 'Property/Liability Insurance',   amount:  25_638 },
            { name: 'Utilities',                      amount:  23_000 },
            { name: 'Building Maint./Janitorial',     amount:  23_000 },
            { name: 'Equipment Maintenance',          amount:   3_500 },
            { name: 'Office Supplies',                amount:  11_000 },
            { name: 'Postage',                        amount:   6_400 },
            { name: 'Travel and Training',            amount:  25_000 },
            { name: 'Dues, Memberships and Subs.',    amount:   6_000 },
            { name: 'Advertising and Public Notices', amount:     800 },
            { name: 'Hospitality',                    amount:   6_000 },
            { name: 'Other Operating',                amount:   1_500 },
            { name: 'Payments to Other Agencies',     amount:     750 },
            { name: 'Capital Outlay',                 amount:   5_800 },
            { name: 'Debt Service',                   amount: 144_000 },
            { name: 'Lease Payments',                 amount:     888 },
          ],
        },
        {
          name: 'Community Development', amount: 489_601,
          lineItems: [
            { name: 'Salaries',                            amount: 189_728 },
            { name: 'Payroll Taxes and Benefits',          amount:  42_014 },
            { name: 'Professional Services',               amount:  47_040 },
            { name: 'Other Operating',                     amount:  24_780 },
            { name: 'Public Relations/Promotions',         amount:  13_400 },
            { name: 'Arts and Entertainment District',     amount:  14_000 },
            { name: 'Main Street',                         amount:  15_000 },
            { name: 'Facade Improvements Pass Thru Grant', amount:  50_000 },
            { name: 'Tree Lighting',                       amount:   8_150 },
            { name: 'Concerts on the Square',              amount:   8_500 },
            { name: "Veteran's Day Parade",                amount:   6_800 },
            { name: 'Moll Dyer Weekend',                   amount:   2_500 },
            { name: 'Boat Races',                          amount:   1_500 },
            { name: 'Movie Festival',                      amount:   3_850 },
            { name: 'Capital Outlay',                      amount:  62_339 },
          ],
        },
        {
          name: 'Planning and Zoning', amount: 240_611,
          lineItems: [
            { name: 'Salaries',                    amount: 145_454 },
            { name: 'Payroll Taxes and Benefits',  amount:  40_907 },
            { name: 'Legal Counsel',               amount:   4_500 },
            { name: 'Professional Services',       amount:  45_000 },
            { name: 'Supplies',                    amount:     750 },
            { name: 'Other Operating',             amount:   4_000 },
          ],
        },
        {
          name: 'Public Safety', amount: 115_793,
          lineItems: [
            { name: 'Salaries',                    amount:  14_935 },
            { name: 'Payroll Taxes and Benefits',  amount:   5_358 },
            { name: 'Other Operating',             amount:     500 },
            { name: 'Law Enforcement',             amount:  90_000 },
            { name: 'Fire Department Grant',       amount:   1_000 },
            { name: 'Rescue Squad Grant',          amount:   1_000 },
            { name: 'Capital Outlay',              amount:   3_000 },
          ],
        },
        {
          name: 'Public Works', amount: 730_195,
          lineItems: [
            { name: 'Salaries',                         amount: 101_025 },
            { name: 'Payroll Taxes and Benefits',       amount:  33_530 },
            { name: 'Other Operating',                  amount:  22_550 },
            { name: 'Street Sweeping',                  amount:  48_852 },
            { name: 'Road Maintenance',                 amount: 235_238 },
            { name: 'Snow and Ice Removal',             amount:  60_000 },
            { name: 'Storm Drain/Sidewalk Maintenance', amount:  65_000 },
            { name: 'Street Lighting/Electricity',      amount:  49_000 },
            { name: 'Grounds Maintenance',              amount:  95_000 },
            { name: 'Street Signs and Maintenance',     amount:  20_000 },
          ],
        },
        {
          name: 'Recreation and Parks', amount: 227_464,
          lineItems: [
            { name: 'Salaries',                      amount:  31_963 },
            { name: 'Payroll Taxes and Benefits',    amount:   8_610 },
            { name: 'Utilities',                     amount:   7_500 },
            { name: 'Facility Maintenance',          amount:  70_691 },
            { name: 'Other Operating',               amount:   3_500 },
            { name: 'Contribution to Old Jail O&M',  amount:  10_000 },
            { name: 'Grounds Maintenance',           amount:  85_000 },
            { name: 'Capital Outlay',                amount:  10_200 },
          ],
        },
        {
          name: 'Transfers and Reserves', amount: 73_380,
          lineItems: [
            { name: 'Committed to Waterfront Revitalization', amount: 73_380 },
          ],
        },
      ],
    },

    enterpriseFund: {
      total: 5_078_873,
      utilities: [
        {
          name: 'Sewer System', amount: 2_625_408,
          lineItems: [
            { name: 'Wastewater Treatment Plant - Personnel Services',  amount:   474_330 },
            { name: 'Wastewater Treatment Plant - Operations & Maint.', amount:   751_862 },
            { name: 'Wastewater Treatment Plant - Debt Service',        amount: 1_137_925 },
            { name: 'Wastewater Treatment Plant - Capital Outlay',      amount:    18_600 },
            { name: 'Wastewater Treatment Plant - Contingency',         amount:     8_907 },
            { name: 'Collection System - Personnel Services',           amount:   100_282 },
            { name: 'Collection System - Operations & Maintenance',     amount:   129_032 },
            { name: 'Collection System - Contingency',                  amount:     4_470 },
          ],
        },
        {
          name: 'Water System', amount: 1_120_069,
          lineItems: [
            { name: 'Personnel Services',            amount: 195_558 },
            { name: 'Operations & Maintenance',      amount: 285_341 },
            { name: 'Debt Service',                  amount: 440_000 },
            { name: 'Capital Outlay',                amount:  53_720 },
            { name: 'Contingency',                   amount:  45_449 },
            // R&R Reserve: $100,000 in document; items sum to $1,120,068 vs $1,120,069 in summary
            // adding $1 to R&R to reconcile the source rounding artifact
            { name: 'Repair & Replacement Reserve',  amount: 100_001 },
          ],
        },
        {
          name: 'Waste Disposal', amount: 1_333_396,
          lineItems: [
            { name: 'Personnel Services',       amount:  48_832 },
            { name: 'Other Operating',          amount:  12_564 },
            { name: 'Waste Disposal Contract',  amount: 1_272_000 },
          ],
        },
      ],
    },
  },
};

// ── Validate hardcoded amounts ─────────────────────────────────────────────────
function validate(fy) {
  const { generalFund, enterpriseFund } = BUDGETS[fy];
  let ok = true;
  const TOLERANCE = 2;

  // General Fund
  let gfSum = 0;
  for (const dept of generalFund.departments) {
    const itemSum = dept.lineItems.reduce((s, li) => s + li.amount, 0);
    if (Math.abs(itemSum - dept.amount) > TOLERANCE) {
      console.error(`FY${fy} GF ${dept.name}: items $${itemSum.toLocaleString()} ≠ dept $${dept.amount.toLocaleString()}`);
      ok = false;
    }
    gfSum += dept.amount;
  }
  if (Math.abs(gfSum - generalFund.total) > TOLERANCE) {
    console.error(`FY${fy} GF dept sum $${gfSum.toLocaleString()} ≠ total $${generalFund.total.toLocaleString()}`);
    ok = false;
  }

  // Enterprise Fund
  let efSum = 0;
  for (const util of enterpriseFund.utilities) {
    const itemSum = util.lineItems.reduce((s, li) => s + li.amount, 0);
    if (Math.abs(itemSum - util.amount) > TOLERANCE) {
      console.error(`FY${fy} EF ${util.name}: items $${itemSum.toLocaleString()} ≠ util $${util.amount.toLocaleString()}`);
      ok = false;
    }
    efSum += util.amount;
  }
  if (Math.abs(efSum - enterpriseFund.total) > TOLERANCE) {
    console.error(`FY${fy} EF util sum $${efSum.toLocaleString()} ≠ total $${enterpriseFund.total.toLocaleString()}`);
    ok = false;
  }

  return ok;
}

// ── Build JSON tree ────────────────────────────────────────────────────────────
function buildTree(fy) {
  const { generalFund, enterpriseFund } = BUDGETS[fy];

  const gfNode = {
    n: 'General Fund',
    a: generalFund.total,
    c: generalFund.departments.map(dept => ({
      n: dept.name,
      a: dept.amount,
      i: dept.lineItems.map(li => ({
        d: li.name,
        a: li.amount,
        aa: null,
        f: 'General Fund',
        e: null,
      })),
    })),
  };
  gfNode.c.sort((a, b) => b.a - a.a);

  const efNode = {
    n: 'Enterprise Fund',
    a: enterpriseFund.total,
    c: enterpriseFund.utilities.map(util => ({
      n: util.name,
      a: util.amount,
      i: util.lineItems.map(li => ({
        d: li.name,
        a: li.amount,
        aa: null,
        f: 'Enterprise Fund',
        e: null,
      })),
    })),
  };
  efNode.c.sort((a, b) => b.a - a.a);

  const jsonTree = [gfNode, efNode];
  jsonTree.sort((a, b) => b.a - a.a);

  const total = generalFund.total + enterpriseFund.total;
  const rowCount = generalFund.departments.length + enterpriseFund.utilities.length;
  return { jsonTree, total, rowCount };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'fy':      { type: 'string'  },
    },
    strict: false,
  });

  const dryRun   = opts['dry-run'];
  const targetFY = opts['fy'] ? parseInt(opts['fy'], 10) : null;
  const years    = targetFY ? [targetFY] : [2023, 2024, 2025];

  if (!SUPABASE_KEY && !dryRun) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }

  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

  let muniId;
  if (!dryRun) {
    const { data: muni, error: muniErr } = await supabase.schema('treasury')
      .from('municipalities').select('id, name')
      .eq('name', 'Leonardtown').eq('state', 'MD').single();
    if (muniErr || !muni) {
      console.error('Leonardtown not found:', muniErr?.message);
      console.error('Run insertLeonardtownMunicipality.js first.');
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  for (const fy of years) {
    if (!BUDGETS[fy]) { console.error(`No budget data for FY${fy}`); continue; }

    console.log(`\n── FY${fy} ─────────────────────────────────────────────────`);

    if (!validate(fy)) { console.error(`FY${fy} validation failed — aborting`); process.exit(2); }
    console.log(`FY${fy} data validation: PASS`);

    const { jsonTree, total, rowCount } = buildTree(fy);

    // Summary
    console.log(`\n${'Fund / Department'.padEnd(38)} ${'Approved ($)'.padStart(14)}`);
    console.log('─'.repeat(53));
    for (const fund of jsonTree) {
      console.log(`${fund.n.padEnd(38)}${Math.round(fund.a).toLocaleString().padStart(14)}`);
      for (const child of (fund.c ?? [])) {
        console.log(`  ${child.n.padEnd(36)}${Math.round(child.a).toLocaleString().padStart(14)}`);
      }
    }
    console.log('─'.repeat(53));
    console.log(`${'TOTAL (GF + Enterprise)'.padEnd(38)}${Math.round(total).toLocaleString().padStart(14)}`);
    console.log(`Per-capita: $${Math.round(total / POPULATION).toLocaleString()}/person\n`);

    if (dryRun) { console.log(`(dry-run — skipping DB writes for FY${fy})`); continue; }

    // Data source lookup
    const { data: ds, error: dsErr } = await supabase.schema('treasury').from('data_sources')
      .select('id')
      .eq('municipality_id', muniId)
      .eq('api_type', 'pdf_download')
      .eq('dataset_id', `fy${fy}`)
      .eq('dataset_type', 'operating')
      .maybeSingle();

    if (dsErr) { console.error('data_sources error:', dsErr.message); process.exit(2); }
    if (!ds) {
      console.error(`No data_source for FY${fy} — run seedLeonardtownDataSources.js first`);
      process.exit(2);
    }
    console.log(`data_source: ${ds.id}`);

    // Clear prior rows
    await supabase.schema('treasury').from('budgets')
      .delete().eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').is('data_source_id', null);
    await supabase.schema('treasury').from('budgets')
      .delete().eq('data_source_id', ds.id).eq('fiscal_year', fy);

    // Load
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id,
      p_fiscal_year:    fy,
      p_dataset_type:   'operating',
      p_total:          total,
      p_tree:           jsonTree,
      p_row_count:      rowCount,
      p_triggered_by:   'bulk_load',
    });

    if (rpcErr)           { console.error('RPC error:', rpcErr.message); process.exit(2); }
    if (rpcResult?.error) { console.error('RPC error:', rpcResult.error); process.exit(2); }

    const inserted = rpcResult?.rows_inserted ?? rowCount;
    console.log(`Loaded ${inserted} rows for FY${fy} (total $${Math.round(total).toLocaleString()})`);

    await supabase.schema('treasury').from('data_sources')
      .update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
    console.log(`last_synced_at updated`);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
