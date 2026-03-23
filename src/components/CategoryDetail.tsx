import React, { useMemo } from 'react';
import type { BudgetCategory } from '../types/budget';
import BudgetBar from './BudgetBar';
import { DATA_VIZ_HUES } from '../utils/chartColors';

interface CategoryDetailProps {
  category: BudgetCategory;
  onCollapse: () => void;
  depth: number;
}

const CategoryDetail: React.FC<CategoryDetailProps> = ({
  category,
  onCollapse,
  depth,
}) => {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return (Math.round(percentage * 10) / 10).toFixed(1);
  };

  const hasSummaryInfo = category.description || category.whyMatters;
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;

  const summaryPoints = useMemo(() => {
    const points = [];
    if (category.description) {
      points.push(category.description);
    }
    if (category.whyMatters) {
      points.push(category.whyMatters);
    }
    if (category.name === "Police Department") {
      points.push("Essential for maintaining public safety and responding to over 50,000 calls for service annually.");
    }
    return points;
  }, [category]);

  return (
    <div className="space-y-4">
      {/* Summary Section — only for top-level departments (depth 1) */}
      {depth === 1 && hasSummaryInfo && (
        <div className="bg-white border border-[#E2EBEF] rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-[#F7F7F8] border-b border-[#D3D7DE]">
            <h3 className="text-base font-bold font-manrope text-[#1C1C1C]">{category.name} Summary</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-[#6B7280] mb-4">How this department uses its share of the budget.</p>
            <div className="space-y-3">
              {summaryPoints.map((point, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-ev-muted-blue flex-shrink-0 mt-1.5" />
                  <p className="text-sm text-[#1C1C1C] leading-snug">{point}</p>
                </div>
              ))}
            </div>
            <a
              href="#"
              className="inline-block mt-4 text-sm text-ev-muted-blue hover:underline"
              onClick={e => e.preventDefault()}
            >
              View department website →
            </a>
          </div>
        </div>
      )}

      {/* Single Category Deep Dive (depth > 2, no subcategories) */}
      {depth > 2 && !hasSubcategories && (
        <div className="bg-white border border-[#E2EBEF] rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-[#F7F7F8] border-b border-[#D3D7DE]">
            <h3 className="text-base font-bold font-manrope text-[#1C1C1C]">{category.name}</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-[#6B7280] mb-6">
              {category.description || "Personnel costs for sworn officers, civilian staff, and administrative personnel across all units. Click to explore each category"}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#F7F7F8] rounded-xl p-4 border border-[#E2EBEF] text-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Budget Allocation</h4>
                <div className="text-[30px] font-bold font-manrope text-ev-muted-blue tabular-nums leading-tight">
                  {formatPercentage(category.percentage)}%
                </div>
                <div className="text-xs text-[#6B7280] mt-1">of Salaries</div>
              </div>

              <div className="bg-[#F7F7F8] rounded-xl p-4 border border-[#E2EBEF] text-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Annual Amount</h4>
                <div className="text-[30px] font-bold font-manrope text-ev-muted-blue tabular-nums leading-tight">
                  {formatCurrency(category.amount)}
                </div>
                <div className="text-xs text-[#6B7280] mt-1">for 2024</div>
              </div>

              <div className="bg-[#F7F7F8] rounded-xl p-4 border border-[#E2EBEF] text-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Parent Category</h4>
                <div className="text-base font-bold font-manrope text-ev-muted-blue">Salaries</div>
                <div className="text-xs text-[#6B7280] mt-1">Police Department</div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Description</h4>
              <p className="text-sm text-[#1C1C1C] leading-snug">
                {category.description || "Front-line officers responding to calls and conducting patrols"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Budget Breakdown Section */}
      {hasSubcategories && (
        <div className="bg-white border border-[#E2EBEF] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-[#F7F7F8] border-b border-[#D3D7DE]">
            <h3 className="text-base font-bold font-manrope text-[#1C1C1C]">
              {depth === 1 ? 'Department Budget Breakdown' : `${category.name} Breakdown`}
            </h3>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#1C1C1C] hover:bg-[#EBEDEF] transition-colors duration-150 cursor-pointer"
              onClick={onCollapse}
              aria-label="Close breakdown"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <p className="text-sm text-[#6B7280] mb-4">
              {depth === 1
                ? `This bar shows how the ${category.name} budget is distributed internally.`
                : 'Click any category to see detailed breakdown and subcategories.'}
            </p>

            <BudgetBar categories={category.subcategories!} />

            {/* Legend */}
            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Legend</div>
              <div className="flex flex-wrap gap-3">
                {category.subcategories!.map((subcat, index) => {
                  const hue = DATA_VIZ_HUES[index % DATA_VIZ_HUES.length];
                  return (
                    <div key={index} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded flex-shrink-0"
                        style={{ backgroundColor: `var(--color-data-${hue}-500)` }}
                      />
                      <span className="text-xs text-[#6B7280]">
                        {subcat.name} — {formatPercentage(subcat.percentage)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDetail;
