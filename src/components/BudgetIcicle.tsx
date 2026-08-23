import React, { useMemo } from 'react';
import type { BudgetCategory } from '../types/budget';
import { buildIcicleLevels, type BarSegment, type BarLevel } from '../data/icicleLevels';
import { getCategoryColor } from '../utils/chartColors';
import { BRAND_BAR_COLORS, getContrastText } from '../utils/brandColors';
import './BudgetIcicle.css';

function displayName(cat: BudgetCategory): string {
  if (cat.enrichment?.plainName) return cat.enrichment.plainName;
  const n = cat.name;
  // Convert ALL-CAPS raw database names to Title Case
  if (n === n.toUpperCase() && n.length > 2) {
    return n.toLowerCase().replace(/(?:^|[\s\-–])\S/g, c => c.toUpperCase());
  }
  return n;
}

interface BudgetIcicleProps {
  categories: BudgetCategory[];
  navigationPath: BudgetCategory[];
  totalBudget: number;
  onPathClick: (path: BudgetCategory[]) => void;
  isNonprofit?: boolean;
}

/**
 * ⚠ The level builder lives in `data/icicleLevels.ts`, not here. It decides which
 * row a reader can interact with, it was wrong for every leaf click in the product,
 * and a component cannot be tested in this repo at all — see UAT 2026-08-22 (G2).
 */

const BudgetIcicle: React.FC<BudgetIcicleProps> = ({
  categories,
  navigationPath,
  totalBudget,
  onPathClick,
  isNonprofit = false,
}) => {
  const levels = useMemo(
    () => buildIcicleLevels(categories, navigationPath, totalBudget),
    [categories, navigationPath, totalBudget],
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    if (isNonprofit) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    if (amount >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    }
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number, total: number) => {
    const pct = (value / total) * 100;
    if (pct < 1) return pct.toFixed(1) + '%';
    return Math.round(pct) + '%';
  };

  // Handle segment click
  const handleSegmentClick = (segment: BarSegment, levelIndex: number) => {
    if (levelIndex < levels.length - 1) {
      // Clicking an ancestor level — navigate back to that point
      onPathClick(segment.path);
    } else {
      // Clicking current level — always navigate (leaf state shows "no breakdown" if needed)
      onPathClick(segment.path);
    }
  };

  // Determine if text can fit in segment
  const canFitText = (width: number, isAncestor: boolean) => {
    // Rough heuristic: need at least 8% width for abbreviated text
    // For ancestor (compressed) bars, need less since they're shorter text
    return width >= (isAncestor ? 6 : 8);
  };

  return (
    <div className="icicle-wrapper">
      <div className="icicle-container">
        {levels.map((level, levelIndex) => (
          <div
            key={levelIndex}
            className={`icicle-level ${level.isAncestor ? 'ancestor' : 'current'}`}
            role="list"
            aria-label={`${level.levelName} breakdown`}
          >
            {level.segments.map((segment) => {
              const isClickable = true;
              const showText = canFitText(segment.width, level.isAncestor);

              const bgColor = BRAND_BAR_COLORS[segment.category.name] ?? getCategoryColor(segment.categoryIndex);
              const textColor = getContrastText(bgColor);
              return (
                <div
                  key={segment.category.name}
                  className={`icicle-segment ${segment.isSelected ? 'selected' : ''} ${isClickable ? 'clickable' : ''}`}
                  style={{
                    width: `${segment.width}%`,
                    backgroundColor: bgColor,
                    opacity: level.isAncestor && !segment.isSelected ? 0.4 : 1,
                    color: textColor,
                    textShadow: textColor === '#000000' ? 'none' : undefined,
                  }}
                  onClick={() => isClickable && handleSegmentClick(segment, levelIndex)}
                  role="listitem"
                  tabIndex={isClickable ? 0 : -1}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
                      e.preventDefault();
                      handleSegmentClick(segment, levelIndex);
                    }
                  }}
                  aria-label={`${segment.category.name}: ${formatCurrency(segment.category.amount)}, ${formatPercentage(segment.category.amount, level.totalAmount)} of ${level.levelName}`}
                  title={`${segment.category.name}\n${formatCurrency(segment.category.amount)}\n${formatPercentage(segment.category.amount, level.totalAmount)}`}
                >
                  {showText && (
                    <div className="segment-content">
                      <span className="segment-name">{displayName(segment.category)}</span>
                      {!level.isAncestor && (
                        <span className="segment-amount">
                          {formatCurrency(segment.category.amount)}
                        </span>
                      )}
                    </div>
                  )}
                  {segment.isSelected && <div className="selection-indicator" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BudgetIcicle;
