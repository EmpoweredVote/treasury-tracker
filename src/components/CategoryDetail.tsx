import React, { useMemo } from 'react';
import type { BudgetCategory } from '../types/budget';
import BudgetBar from './BudgetBar';

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

  // Create descriptive text based on the category
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
    <div className="category-detail-wrapper">
      {/* Summary Section - Only show for top-level departments (depth 1) */}
      {depth === 1 && hasSummaryInfo && (
        <div className="category-summary">
          <div className="summary-header">
            <h3>{category.name} Summary</h3>
          </div>
          <p className="summary-subtitle">How this department uses its share of the budget.</p>
          
          <div className="summary-points">
            {summaryPoints.map((point, idx) => (
              <div key={idx} className="summary-point">
                <div className="summary-bullet"></div>
                <p>{point}</p>
              </div>
            ))}
          </div>

          <a href="#" className="view-department-link">
            View department website →
          </a>
        </div>
      )}

      {/* Single Category Deep Dive (depth > 2, single item detail) */}
      {depth > 2 && !hasSubcategories && (
        <div className="single-category-detail">
          <h3>{category.name}</h3>
          <p className="detail-subtitle">
            {category.description || "Personnel costs for sworn officers, civilian staff, and administrative personnel across all units. Click to explore each category"}
          </p>

          <div className="detail-cards">
            <div className="detail-card">
              <h4>Budget Allocation</h4>
              <div className="detail-stat">{formatPercentage(category.percentage)}%</div>
              <div className="detail-label">of Salaries</div>
            </div>

            <div className="detail-card">
              <h4>Annual Amount</h4>
              <div className="detail-stat">{formatCurrency(category.amount)}</div>
              <div className="detail-label">for 2024</div>
            </div>

            <div className="detail-card">
              <h4>Parent Category</h4>
              <div className="detail-link">Salaries</div>
              <div className="detail-breadcrumb">Police Department</div>
            </div>
          </div>

          <div className="detail-description">
            <h4>Description</h4>
            <p>{category.description || "Front-line officers responding to calls and conducting patrols"}</p>
          </div>
        </div>
      )}

      {/* Budget Breakdown Section */}
      {hasSubcategories && (
        <div className="category-breakdown">
          <div className="breakdown-header">
            <h3>
              {depth === 1 ? 'Department Budget Breakdown' : `${category.name} Breakdown`}
            </h3>
            <button 
              className="collapse-button" 
              onClick={onCollapse}
              aria-label="Close breakdown"
            >
              ✕
            </button>
          </div>
          
          <p className="breakdown-subtitle">
            {depth === 1
              ? `This bar shows how the ${category.name} budget is distributed internally.`
              : 'Click any category to see detailed breakdown and subcategories.'}
          </p>

          <BudgetBar categories={category.subcategories!} />

          {/* Legend */}
          <div className="breakdown-legend">
            <div className="legend-label">Legend</div>
            <div className="legend-items">
              {category.subcategories!.map((subcat, index) => (
                <div key={index} className="legend-item">
                  <div 
                    className="legend-color-box" 
                    style={{ backgroundColor: subcat.color }}
                  />
                  <span className="legend-text">
                    {subcat.name} — {formatPercentage(subcat.percentage)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDetail;
