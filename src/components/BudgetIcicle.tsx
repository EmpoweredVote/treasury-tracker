import React, { useMemo } from 'react';
import type { BudgetCategory } from '../types/budget';
import { buildIcicleLevels, type BarSegment } from '../data/icicleLevels';
import { getCategoryColor } from '../utils/chartColors';
import { formatMoneyCompact, formatMoneyExact } from '../utils/formatMoney';
import { BRAND_BAR_COLORS, getContrastText } from '../utils/brandColors';
import { canFitLabel } from '../utils/segmentLabelFit';
import { useElementWidth } from '../hooks/useElementWidth';
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

  // ⚠⚠ A SEGMENT'S LABEL FITS OR DOES NOT FIT IN PIXELS, NEVER IN PERCENT.
  // Every segment is sized as a share of this element, so its share has to be
  // multiplied back out by a MEASURED width before it can be compared with the
  // room a 12px label needs. `width` is null until that measurement lands, and
  // `canFitLabel` falls back to the old percentage rule while it is — see
  // src/utils/segmentLabelFit.ts.
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();

  // ⚠ A nonprofit's whole ledger is smaller than one municipal line item, so
  // abbreviating it would round away the figure rather than tidy it.
  const formatCurrency = (amount: number) =>
    isNonprofit ? formatMoneyExact(amount) : formatMoneyCompact(amount);

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


  return (
    <div className="icicle-wrapper">
      <div className="icicle-container" ref={containerRef}>
        {levels.map((level, levelIndex) => (
          <div
            key={levelIndex}
            className={`icicle-level ${level.isAncestor ? 'ancestor' : 'current'}`}
            role="list"
            aria-label={`${level.levelName} breakdown`}
          >
            {level.segments.map((segment, segmentIndex) => {
              const isClickable = true;
              // ⚠⚠ THE SEGMENT'S OWN STRINGS, not a worst-case floor. These are
              // the exact two values rendered below, so what is measured and
              // what is drawn cannot drift apart. ⚠ An ancestor row prints no
              // amount — passing one would reserve width for a figure that is
              // never shown.
              const labelText = {
                name: displayName(segment.category),
                amount: level.isAncestor ? null : formatCurrency(segment.category.amount),
              };
              const showText = canFitLabel(
                segment.width, containerWidth, level.isAncestor, labelText);

              // ⚠⚠ COLOURED BY POSITION IN ITS OWN LEVEL — the same rule, and the
              // same `DATA_VIZ_HUES` cycle, that `CategoryList` uses for the cards
              // directly below. The current level and the card grid are always the
              // SAME list, so this makes "the Nth bar is the Nth card" an invariant
              // a reader can rely on rather than a coincidence.
              //
              // ⚠ What this REPLACED, and why: a drilled level used to inherit its
              // ROOT's colour index and vary only lightness (G3, 2026-08-23), so a
              // branch read as one colour. New York City's `Current Operations`
              // holds twelve functions, which rendered as twelve teals while the
              // twelve cards beneath them were teal/coral/yellow/dusk/sage — one
              // list, two palettes. Chris's call, 2026-10-10: match the cards.
              // `shadeWithinBranch` is retired with this; the ten-hue cycle solves
              // the 36-child case too, by giving neighbours different HUES.
              //
              // ⚠ Index alignment survives `displayCategories` dropping zero-amount
              // rows only because the sort puts zeros last — see sortCategories.ts.
              const bgColor = BRAND_BAR_COLORS[segment.category.name] ?? getCategoryColor(segmentIndex);
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
