import React, { useMemo } from 'react';
import type { BudgetCategory } from '../types/budget';
import './BudgetIcicle.css';

interface BudgetIcicleProps {
  categories: BudgetCategory[];
  navigationPath: BudgetCategory[];
  totalBudget: number;
  onPathClick: (path: BudgetCategory[]) => void;
}

interface BarSegment {
  category: BudgetCategory;
  path: BudgetCategory[];
  width: number; // percentage
  isSelected: boolean;
  hasChildren: boolean;
}

interface BarLevel {
  segments: BarSegment[];
  isAncestor: boolean; // ancestor levels are compressed
  totalAmount: number;
  levelName: string; // for accessibility
}

const BudgetIcicle: React.FC<BudgetIcicleProps> = ({
  categories,
  navigationPath,
  totalBudget,
  onPathClick,
}) => {
  // Build the levels to display
  const levels = useMemo(() => {
    const result: BarLevel[] = [];

    // Always add root level (top-level categories)
    const rootSegments: BarSegment[] = categories.map(cat => ({
      category: cat,
      path: [cat],
      width: (cat.amount / totalBudget) * 100,
      isSelected: navigationPath.length > 0 && navigationPath[0].name === cat.name,
      hasChildren: (cat.subcategories && cat.subcategories.length > 0) || false,
    }));

    result.push({
      segments: rootSegments,
      isAncestor: navigationPath.length > 0,
      totalAmount: totalBudget,
      levelName: 'Total Budget',
    });

    // Add levels for each item in the navigation path
    navigationPath.forEach((pathCat, pathIndex) => {
      const subcats = pathCat.subcategories || [];
      if (subcats.length === 0) return; // No children to show

      const parentAmount = pathCat.amount;
      const isCurrentLevel = pathIndex === navigationPath.length - 1;

      const segments: BarSegment[] = subcats.map(cat => ({
        category: cat,
        path: [...navigationPath.slice(0, pathIndex + 1), cat],
        width: (cat.amount / parentAmount) * 100,
        isSelected: !isCurrentLevel && navigationPath[pathIndex + 1]?.name === cat.name,
        hasChildren: (cat.subcategories && cat.subcategories.length > 0) || false,
      }));

      result.push({
        segments,
        isAncestor: !isCurrentLevel,
        totalAmount: parentAmount,
        levelName: pathCat.name,
      });
    });

    return result;
  }, [categories, navigationPath, totalBudget]);

  // Format currency
  const formatCurrency = (amount: number) => {
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
      // Clicking an ancestor level - navigate back to that level + this selection
      // Find the path up to and including this segment
      onPathClick(segment.path);
    } else {
      // Clicking current level - drill down if has children
      if (segment.hasChildren) {
        onPathClick(segment.path);
      }
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
              const isClickable = level.isAncestor || segment.hasChildren;
              const showText = canFitText(segment.width, level.isAncestor);

              return (
                <div
                  key={segment.category.name}
                  className={`icicle-segment ${segment.isSelected ? 'selected' : ''} ${isClickable ? 'clickable' : ''}`}
                  style={{
                    width: `${segment.width}%`,
                    backgroundColor: segment.category.color,
                    opacity: level.isAncestor && !segment.isSelected ? 0.4 : 1,
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
                      <span className="segment-name">{segment.category.name}</span>
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
