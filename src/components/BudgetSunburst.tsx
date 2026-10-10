import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { BudgetCategory } from '../types/budget';
import { getCategoryColor } from '../utils/chartColors';
import { useElementWidth } from '../hooks/useElementWidth';

/**
 * ⚠ Mirrors `BudgetIcicle`'s rule, because the two charts show the same rows:
 * prefer a curated plain name, and title-case a raw ALL-CAPS database label.
 * Without it a sunburst arc would read `GENERAL GOVERNMENT` beside a bar and a
 * card both reading `General Government`.
 */
function displayName(node: { name: string; category?: BudgetCategory }): string {
  const plain = node.category?.enrichment?.plainName;
  if (plain) return plain;
  const n = node.name ?? '';
  if (n === n.toUpperCase() && n.length > 2) {
    return n.toLowerCase().replace(/(?:^|[\s\-–])\S/g, (c) => c.toUpperCase());
  }
  return n;
}
import {
  buildSunburstHierarchy, arcEmphasis, ARC_OPACITY,
  fitArcLabel, arcLabelTransform, SUNBURST_LABEL_PX,
} from '../data/sunburstLevels';
import './BudgetSunburst.css';
import { formatMoneyCompact } from '../utils/formatMoney';

// Target angle for selected category (right side, 90 degrees from top)
// In D3's coordinate system, 0 is at top, going clockwise
// 90 degrees = directly to the right
const TARGET_ANGLE = (90 * Math.PI) / 180;

interface BudgetSunburstProps {
  categories: BudgetCategory[];
  navigationPath: BudgetCategory[];
  totalBudget: number;
  onPathClick: (path: BudgetCategory[]) => void;
}

interface HierarchyNode {
  name: string;
  value?: number;
  color?: string;
  categoryIndex?: number; // root-level category index for color cycling
  category?: BudgetCategory;
  children?: HierarchyNode[];
}

// Type for partition nodes (after partition layout is applied)
type PartitionNode = d3.HierarchyRectangularNode<HierarchyNode>;

const BudgetSunburst: React.FC<BudgetSunburstProps> = ({
  categories,
  navigationPath,
  totalBudget,
  onPathClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRotationRef = useRef<number>(0);

  // ⚠⚠ A LABEL'S LEGIBILITY IS IN PIXELS, BUT ITS GEOMETRY IS IN viewBox UNITS.
  // The SVG scales to fill `.sunburst-container` (capped at 500px), so a font
  // size fixed in viewBox units renders at whatever the scale factor makes it —
  // 14 units is 7px on a desktop and 5px on a phone, i.e. unreadable in both.
  // Measuring the container lets the font size be chosen so the RENDERED size
  // is constant, and the fit test then naturally admits fewer labels on a
  // narrow screen, where each one costs more room. Same rule as the icicle's
  // label floor.
  const [, containerWidth] = useElementWidth<HTMLDivElement>(containerRef);

  // ⚠ The builder lives in `data/sunburstLevels.ts`. It decides every arc's
  // colour, it was wrong for every drilled ring, and a component cannot carry a
  // test for that here.
  const hierarchyData = useMemo(() => ({
    name: 'Budget',
    children: buildSunburstHierarchy(categories) as HierarchyNode[],
  }), [categories]);

  // Get the path of category names for highlighting
  const currentPathNames = useMemo(() => {
    return navigationPath.map(cat => cat.name);
  }, [navigationPath]);

  // Calculate parent amount for percentage calculation
  const parentAmount = useMemo(() => {
    if (navigationPath.length <= 1) return totalBudget;
    return navigationPath[navigationPath.length - 2].amount;
  }, [navigationPath, totalBudget]);

  // Format currency

  // Format percentage
  const formatPercentage = (value: number, total: number) => {
    return ((value / total) * 100).toFixed(1) + '%';
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Use a fixed logical size for the viewBox — the SVG scales via CSS width:100%
    const size = 900;
    const radius = size / 2;

    // ⚠⚠ THE VIEWBOX IS SQUARE, AND THAT IS THE FIX. It used to be
    // `size * 0.7` tall, described as cropping "slightly": a circle of
    // diameter 900 inside a 630-tall window, so 135 units — 70 rendered pixels
    // at the container's 500px cap — were cut off the top AND the bottom.
    // Those straight horizontal edges read as a rendering fault, and what they
    // actually cut was DATA: a sunburst encodes a category in every direction,
    // so the arcs nearest twelve and six o'clock were clipped mid-wedge.
    //
    // ⚠ The alternative was to keep the short window and shrink the radius to
    // 315 to fit inside it. That clips nothing either, but it costs 30% of the
    // chart's diameter on a chart already capped at 500px by
    // `.sunburst-container`, and the arc labels below need every unit of ring
    // width there is. Squaring the viewBox makes the section ~141px taller at
    // full width and keeps the chart its own size.
    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('font-family', 'Manrope, sans-serif')
      .style('display', 'block')
      .style('margin', '0 auto');

    // Create a group for rotatable content (arcs only, not center)
    const rotatableGroup = svg.append('g')
      .attr('class', 'sunburst-rotatable');

    // Create hierarchy and apply partition layout
    const root = d3.hierarchy<HierarchyNode>(hierarchyData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create partition layout and apply it
    const partition = d3.partition<HierarchyNode>()
      .size([2 * Math.PI, radius]);

    const partitionedRoot = partition(root);

    // Center circle radius (defined early so arcs can respect it)
    const centerRadius = radius * 0.28;

    // Fixed ring boundaries so chart diameter is consistent regardless of hierarchy depth
    const ringStart = centerRadius + 4;
    const ringEnd = radius;
    const maxDepth = root.height; // number of levels below root
    const ringWidth = (ringEnd - ringStart) / maxDepth;

    const ringInner = (depth: number) => ringStart + (depth - 1) * ringWidth;
    const ringOuter = (depth: number) => ringStart + depth * ringWidth;

    // Arc generator - uses fixed ring boundaries per depth
    const arc = d3.arc<PartitionNode>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => ringInner(d.depth))
      .outerRadius(d => ringOuter(d.depth) - 1);

    // Build the path from root to a node (excluding root) - returns names
    const getNodePath = (node: PartitionNode): string[] => {
      const nodePath: string[] = [];
      let current: d3.HierarchyNode<HierarchyNode> | null = node;
      while (current && current.parent) {
        nodePath.unshift(current.data.name);
        current = current.parent;
      }
      return nodePath;
    };

    // Build the full category path from root to a node (excluding root) - returns BudgetCategory[]
    const getCategoryPath = (node: PartitionNode): BudgetCategory[] => {
      const categoryPath: BudgetCategory[] = [];
      let current: d3.HierarchyNode<HierarchyNode> | null = node;
      while (current && current.parent) {
        if (current.data.category) {
          categoryPath.unshift(current.data.category);
        }
        current = current.parent;
      }
      return categoryPath;
    };

    // Check if a node is in the current navigation path (including all ancestors)
    const isInCurrentPath = (node: PartitionNode): boolean => {
      if (currentPathNames.length === 0) return false;

      const nodePath = getNodePath(node);

      // Check if nodePath is a prefix of currentPathNames (or equal to it)
      if (nodePath.length > currentPathNames.length) return false;

      return nodePath.every((name, i) => name === currentPathNames[i]);
    };

    // Check if a node is the currently selected (deepest) item
    const isCurrentSelection = (node: PartitionNode): boolean => {
      if (currentPathNames.length === 0) return false;

      const nodePath = getNodePath(node);

      return nodePath.length === currentPathNames.length &&
             nodePath.every((name, i) => name === currentPathNames[i]);
    };

    // Determine if a node should be visible based on progressive reveal logic
    // A node is visible if:
    // 1. It's at depth 1 (top-level categories - always visible)
    // 2. Its parent is in the current navigation path (siblings of the path are visible)
    // 3. It's a child of the currently selected node (next level to explore)
    const shouldBeVisible = (node: PartitionNode): boolean => {
      const nodePath = getNodePath(node);
      const nodeDepth = nodePath.length;

      // Depth 1 (top-level) - always visible
      if (nodeDepth === 1) return true;

      // If no selection, only show depth 1
      if (currentPathNames.length === 0) return false;

      // Check if parent is in the navigation path
      const parentPath = nodePath.slice(0, -1);
      const parentInPath = parentPath.length <= currentPathNames.length &&
                          parentPath.every((name, i) => name === currentPathNames[i]);

      if (parentInPath) {
        // Parent is in path - this node is either:
        // - A sibling of a selected node (visible, semi-transparent)
        // - The selected node itself (visible, highlighted)
        // - A child of the current selection (visible, for exploration)

        // Check if this is at a depth that should be shown
        // Show nodes where parent depth <= currentPathNames.length
        if (parentPath.length <= currentPathNames.length) {
          return true;
        }
      }

      return false;
    };

    // ⚠ `isSibling` was REMOVED on 2026-10-10. It answered "is this node's
    // parent on the path", which is true both for a sibling of a path node and
    // for a child of the SELECTION — two groups that must be drawn
    // differently. `arcEmphasis` in data/sunburstLevels.ts separates them by
    // depth and is covered by tests.

    // Get descendants as PartitionNodes, filtered by visibility
    const allNodes = partitionedRoot.descendants().filter(d => d.depth > 0) as PartitionNode[];
    const visibleNodes = allNodes.filter(shouldBeVisible);

    // Find the currently selected node for the callout
    const selectedNode = visibleNodes.find(d => isCurrentSelection(d)) || null;

    // Calculate rotation based on currently selected category (at any depth)
    // We want the selected category to be positioned at bottom-right (~135 degrees)
    let targetRotation = 0;
    if (selectedNode) {
      // Get the midpoint angle of the currently selected category
      const midAngle = (selectedNode.x0 + selectedNode.x1) / 2;

      // Calculate rotation needed to move this to the target position (bottom-right)
      // TARGET_ANGLE is 135 degrees - bottom right diagonal
      // midAngle is the current position of the category
      // We need to rotate by (TARGET_ANGLE - midAngle)
      targetRotation = ((TARGET_ANGLE - midAngle) * 180) / Math.PI;
    }

    // Normalize rotation to take the shortest angular path (avoid multi-spin)
    const previousRotation = currentRotationRef.current;
    let delta = targetRotation - previousRotation;
    // Wrap delta into [-180, 180] so the transition always takes the short way
    delta = ((delta % 360) + 540) % 360 - 180;
    const adjustedTarget = previousRotation + delta;
    currentRotationRef.current = adjustedTarget;

    rotatableGroup
      .attr('transform', `rotate(${previousRotation})`)
      .transition()
      .duration(500)
      .ease(d3.easeCubicInOut)
      .attr('transform', `rotate(${adjustedTarget})`);

    // Draw arcs on the rotatable group
    rotatableGroup.selectAll('path.arc')
      .data(visibleNodes)
      .join('path')
      .attr('class', 'arc')
      .attr('d', d => arc(d) || '')
      .attr('fill', d => getCategoryColor(d.data.categoryIndex ?? 0))
      // ⚠⚠ THE CURRENT LEVEL IS NEVER THE FAINTEST THING ON THE CHART. This
      // used to ask `isSibling`, which returns true for ANY node whose parent
      // is on the path — lumping a true sibling of a path node (`Debt Service`)
      // together with a CHILD OF THE SELECTION (`Education` under `Current
      // Operations`). The second group is the level the reader just drilled
      // into and is reading about in the cards below, and it was drawn at 0.3
      // beneath a parent at 1.0. See data/sunburstLevels.ts.
      .attr('fill-opacity', d => ARC_OPACITY[arcEmphasis(getNodePath(d), currentPathNames)])
      .attr('stroke', d => {
        if (isInCurrentPath(d)) return '#FED12E';
        return 'rgba(255,255,255,0.5)';
      })
      .attr('stroke-width', d => {
        if (isCurrentSelection(d)) return 4;
        if (isInCurrentPath(d)) return 3;
        return 1;
      })
      .style('cursor', d => d.data.category ? 'pointer' : 'default')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.data.category) {
          const fullPath = getCategoryPath(d);
          onPathClick(fullPath);
        }
      })
      .on('mouseenter', function(event, d) {
        // Highlight on hover
        d3.select(this)
          .transition()
          .duration(100)
          .attr('fill-opacity', 1)
          .attr('stroke-width', 3);

        // Show tooltip
        const tooltip = d3.select('#sunburst-tooltip');
        const hasChildren = d.data.category?.subcategories && d.data.category.subcategories.length > 0;
        tooltip
          .style('opacity', 1)
          .style('left', `${event.clientX + 10}px`)
          .style('top', `${event.clientY - 10}px`)
          .html(`
            <div class="tooltip-name">${d.data.name}</div>
            <div class="tooltip-amount">${formatMoneyCompact(d.value || 0)}</div>
            <div class="tooltip-percentage">${formatPercentage(d.value || 0, totalBudget)} of total budget</div>
            ${hasChildren ? '<div class="tooltip-hint">Click to explore</div>' : ''}
          `);
      })
      .on('mousemove', function(event) {
        d3.select('#sunburst-tooltip')
          .style('left', `${event.clientX + 10}px`)
          .style('top', `${event.clientY - 10}px`);
      })
      .on('mouseleave', function(_event, d) {
        d3.select(this)
          .transition()
          .duration(100)
          // ⚠⚠ THE SAME CALL AS THE INITIAL FILL, DELIBERATELY. This restore
          // path carried its own copy of the rule, so fixing only the first
          // one would have put the dimmed-current-level defect back the moment
          // a reader moved the pointer off an arc — visible nowhere in a
          // screenshot, and only on hover-out.
          .attr('fill-opacity', ARC_OPACITY[arcEmphasis(getNodePath(d), currentPathNames)])
          .attr('stroke-width', () => {
            if (isCurrentSelection(d)) return 4;
            if (isInCurrentPath(d)) return 3;
            return 1;
          });

        d3.select('#sunburst-tooltip').style('opacity', 0);
      });

    // ── ARC LABELS ────────────────────────────────────────────────────────
    //
    // ⚠⚠ THE CHART USED TO CARRY NONE AT ALL. Every figure was tooltip-only,
    // so it could not be read without a pointer and could not be read at all
    // on a touch screen, while the bars beside it label any segment with room.
    //
    // ⚠ Labelled only where the arc is NOT dimmed — the path and the current
    // level. White text on a 0.3-opacity fill is near-white on white, so
    // labelling a dim arc would add an unreadable string rather than a fact.
    //
    // ⚠ `pointer-events: none` on the whole layer, or a label would swallow
    // the click and the hover of the arc it sits on.
    const scale = containerWidth && containerWidth > 0 ? containerWidth / size : null;
    if (scale) {
      const fontSize = SUNBURST_LABEL_PX / scale;
      rotatableGroup.append('g')
        .attr('class', 'sunburst-labels')
        .style('pointer-events', 'none')
        .selectAll('text')
        .data(visibleNodes.filter(d =>
          arcEmphasis(getNodePath(d), currentPathNames) !== 'dim'))
        .join('text')
        .text(d => fitArcLabel({
          label: displayName(d.data),
          innerRadius: ringInner(d.depth),
          outerRadius: ringOuter(d.depth) - 1,
          startAngle: d.x0,
          endAngle: d.x1,
          fontSize,
        }) ?? '')
        .attr('transform', d => arcLabelTransform(
          d.x0, d.x1, (ringInner(d.depth) + ringOuter(d.depth) - 1) / 2))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', fontSize)
        .attr('font-weight', 600)
        .attr('fill', '#ffffff')
        // A hairline of the fill colour behind the glyphs, drawn first, so a
        // label stays legible where it crosses the pad gap between two arcs.
        .attr('paint-order', 'stroke')
        .attr('stroke', 'rgba(0,0,0,0.25)')
        .attr('stroke-width', fontSize * 0.12);
    }

    // Add center circle - always shows total budget
    svg.append('circle')
      .attr('r', centerRadius)
      .attr('fill', 'var(--color-ev-muted-blue)')
      .attr('opacity', 0.9)
      .style('cursor', currentPathNames.length > 0 ? 'pointer' : 'default')
      .on('click', () => {
        // Click center to go back to root
        if (currentPathNames.length > 0) {
          onPathClick([]);
        }
      });

    // Center text - always shows total budget
    const centerGroup = svg.append('g')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('pointer-events', 'none');

    centerGroup.append('text')
      .attr('y', -14)
      .attr('fill', 'white')
      .attr('font-size', '28px')
      .attr('font-weight', '500')
      .text('Total Budget');

    centerGroup.append('text')
      .attr('y', 24)
      .attr('fill', 'white')
      .attr('font-size', '36px')
      .attr('font-weight', '700')
      .text(formatMoneyCompact(totalBudget));

    // Draw callout line and update callout box position if there's a selection
    if (selectedNode && currentPathNames.length > 0) {
      const midAngle = (selectedNode.x0 + selectedNode.x1) / 2;
      const midRadius = (ringInner(selectedNode.depth) + ringOuter(selectedNode.depth)) / 2;

      // Apply rotation to the angle for callout positioning
      const rotationRad = (targetRotation * Math.PI) / 180;
      const rotatedAngle = midAngle + rotationRad;

      // Calculate position with rotation applied
      const arcX = Math.sin(rotatedAngle) * midRadius;
      const arcY = -Math.cos(rotatedAngle) * midRadius;

      // After rotation, the selected category should be in the bottom-right
      // So the callout should always go to the right
      const isRightSide = true;

      const lineEndX = radius + 20;
      const lineEndY = arcY;

      // Create a group for the callout elements that will animate with rotation
      const calloutGroup = svg.append('g')
        .attr('class', 'callout-group');

      calloutGroup.append('line')
        .attr('class', 'callout-line')
        .attr('x1', arcX)
        .attr('y1', arcY)
        .attr('x2', lineEndX)
        .attr('y2', lineEndY)
        .attr('stroke', '#FED12E')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,2')
        .attr('opacity', 0)
        .transition()
        .delay(300)
        .duration(200)
        .attr('opacity', 1);

      calloutGroup.append('circle')
        .attr('cx', arcX)
        .attr('cy', arcY)
        .attr('r', 4)
        .attr('fill', '#FED12E')
        .attr('opacity', 0)
        .transition()
        .delay(300)
        .duration(200)
        .attr('opacity', 1);

      const calloutBox = containerRef.current?.querySelector('.sunburst-callout') as HTMLElement;
      if (calloutBox && svgRef.current) {
        // Scale from viewBox coordinates to actual rendered size
        const renderedWidth = svgRef.current.clientWidth;
        const scale = renderedWidth / size;
        const centerX = renderedWidth / 2;
        // ⚠ Was `displayHeight * scale`, the CROPPED height. The viewBox is
        // square now, so the rendered centre is half the rendered width — and
        // this is why the crop could not be changed without touching the
        // callout: it placed the box against the viewBox, not the circle.
        const centerY = (size * scale) / 2;
        const boxX = centerX + lineEndX * scale;
        const boxY = centerY + lineEndY * scale;

        // Delay showing the callout box until after rotation
        calloutBox.style.opacity = '0';
        calloutBox.style.display = 'block';
        calloutBox.style.top = `${boxY}px`;

        if (isRightSide) {
          calloutBox.style.left = `${boxX + 10}px`;
          calloutBox.style.right = 'auto';
          calloutBox.classList.remove('left-side');
          calloutBox.classList.add('right-side');
        } else {
          calloutBox.style.right = `${renderedWidth - boxX + 10}px`;
          calloutBox.style.left = 'auto';
          calloutBox.classList.remove('right-side');
          calloutBox.classList.add('left-side');
        }

        // Fade in the callout box after rotation completes
        setTimeout(() => {
          calloutBox.style.opacity = '1';
        }, 350);
      }
    } else {
      const calloutBox = containerRef.current?.querySelector('.sunburst-callout') as HTMLElement;
      if (calloutBox) {
        calloutBox.style.display = 'none';
      }
    }

  }, [hierarchyData, currentPathNames, navigationPath, totalBudget, onPathClick, containerWidth]);

  // Get current category info for the callout
  const currentCategory = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : null;
  const parentCategory = navigationPath.length > 1 ? navigationPath[navigationPath.length - 2] : null;

  return (
    <div className="sunburst-wrapper">
      <div className="sunburst-container" ref={containerRef}>
        <svg ref={svgRef} className="sunburst-svg" />
        <div id="sunburst-tooltip" className="sunburst-tooltip" />

        {/* Callout box - positioned dynamically */}
        {currentCategory && (
          <div className="sunburst-callout" style={{ display: 'none' }}>
            <div className="callout-name">{currentCategory.name}</div>
            <div className="callout-amount">{formatMoneyCompact(currentCategory.amount)}</div>
            <div className="callout-percentages">
              <div className="callout-percentage">
                <span className="percentage-value">{formatPercentage(currentCategory.amount, totalBudget)}</span>
                <span className="percentage-label">of total budget</span>
              </div>
              {parentCategory && (
                <div className="callout-percentage">
                  <span className="percentage-value">{formatPercentage(currentCategory.amount, parentAmount)}</span>
                  <span className="percentage-label">of {parentCategory.name}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetSunburst;
