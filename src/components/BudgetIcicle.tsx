import React, { useMemo } from 'react';
import type { BudgetCategory } from '../types/budget';
import { buildIcicleLevels, type BarSegment } from '../data/icicleLevels';
import { getCategoryColor } from '../utils/chartColors';
import { formatMoneyCompact, formatMoneyExact } from '../utils/formatMoney';
import { BRAND_BAR_COLORS, getContrastText } from '../utils/brandColors';
import { canFitLabel } from '../utils/segmentLabelFit';
import { useElementWidth } from '../hooks/useElementWidth';
import { useMediaQuery, SM_QUERY } from '../hooks/useMediaQuery';
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

  // ⚠⚠ ON A PHONE THIS CHART IS A PICTURE, NOT A CONTROL.
  //
  // Measured on production 2026-10-10, drilled into New York City's fifteen
  // functions: at 390px wide, TWELVE of the fifteen segments are under 24px —
  // the WCAG 2.5.8 minimum target size — and the narrowest is 2px. At 320px
  // only ONE segment carries a label. The right two-thirds reads as a barcode
  // of untappable colour slivers.
  //
  // The label rule is not at fault: those labels genuinely do not fit. The
  // horizontal form simply does not survive a 272–342px container with fifteen
  // children. What was wrong was ADVERTISING interaction the chart cannot
  // deliver — a tap target of 2px is a promise to nobody.
  //
  // So below `sm` the strip keeps its one real job, proportion at a glance,
  // and stops pretending to be tappable. The CARDS are the control there: they
  // carry every name, amount, percentage and drill-through, in the matching
  // colours. Chris's call, 2026-10-10.
  //
  // ⚠ Back-navigation does not depend on this chart. The breadcrumb above it
  // is always rendered and always interactive — which matters because two of
  // the three places this chart appears show NO card list (a leaf with line
  // items, and the no-breakdown state), and both are leaves with nothing
  // further to drill into anyway.
  //
  // ⚠ Defaults to interactive where `matchMedia` cannot be asked, so a static
  // render is unchanged.
  const interactive = useMediaQuery(SM_QUERY);

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
    // ⚠ `aria-hidden` below `sm`: a strip whose segments cannot be reached is
    // noise to a screen reader, and the cards and breadcrumb carry the same
    // information in a form that can actually be operated.
    <div className="icicle-wrapper" aria-hidden={interactive ? undefined : true}>
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
              const tappable = isClickable && interactive;
              return (
                <div
                  key={segment.category.name}
                  className={`icicle-segment ${segment.isSelected ? 'selected' : ''} ${tappable ? 'clickable' : ''}`}
                  style={{
                    width: `${segment.width}%`,
                    backgroundColor: bgColor,
                    opacity: level.isAncestor && !segment.isSelected ? 0.4 : 1,
                    color: textColor,
                    textShadow: textColor === '#000000' ? 'none' : undefined,
                  }}
                  onClick={tappable ? () => handleSegmentClick(segment, levelIndex) : undefined}
                  role="listitem"
                  tabIndex={tappable ? 0 : -1}
                  onKeyDown={tappable ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSegmentClick(segment, levelIndex);
                    }
                  } : undefined}
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
