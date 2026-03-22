import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { BudgetCategory } from '../types/budget';
import './BudgetSunburst.css';

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

  // Build hierarchical data structure for D3
  const hierarchyData = useMemo(() => {
    const buildHierarchy = (cats: BudgetCategory[]): HierarchyNode[] => {
      return cats.map(cat => ({
        name: cat.name,
        value: cat.subcategories && cat.subcategories.length > 0 ? undefined : cat.amount,
        color: cat.color,
        category: cat,
        children: cat.subcategories && cat.subcategories.length > 0
          ? buildHierarchy(cat.subcategories)
          : undefined,
      }));
    };

    return {
      name: 'Budget',
      children: buildHierarchy(categories),
    };
  }, [categories]);

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

  // Format percentage
  const formatPercentage = (value: number, total: number) => {
    return ((value / total) * 100).toFixed(1) + '%';
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth;
    // Use a larger base size for the sunburst
    const size = Math.min(containerWidth, 900);
    const radius = size / 2;

    // Display dimensions - show the full width but crop height aggressively
    // Since selection rotates to 90 degrees (right), we show a horizontal band
    const displayHeight = size * 0.45; // Show 45% of the height (crops top and bottom significantly)
    const cropTop = (size - displayHeight) / 2; // Center the crop vertically

    const svg = d3.select(svgRef.current)
      .attr('width', size)
      .attr('height', displayHeight)
      .attr('viewBox', `${-size / 2} ${-size / 2 + cropTop} ${size} ${displayHeight}`)
      .style('font-family', 'Manrope, sans-serif');

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
    const centerRadius = radius * 0.22;

    // Arc generator - innerRadius uses Math.max to prevent overlapping the center circle
    const arc = d3.arc<PartitionNode>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => Math.max(d.y0, centerRadius + 2))
      .outerRadius(d => d.y1 - 1);

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

    // Check if a node is a sibling (same parent as a path node, but not in path itself)
    const isSibling = (node: PartitionNode): boolean => {
      const nodePath = getNodePath(node);

      // Not a sibling if it's in the path
      if (isInCurrentPath(node)) return false;

      // Check if parent is in path
      const parentPath = nodePath.slice(0, -1);
      if (parentPath.length === 0) return false; // Top level has no siblings in this sense

      const parentInPath = parentPath.length <= currentPathNames.length &&
                          parentPath.every((name, i) => name === currentPathNames[i]);

      return parentInPath;
    };

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

    // Apply rotation with animation
    const previousRotation = currentRotationRef.current;
    currentRotationRef.current = targetRotation;

    rotatableGroup
      .attr('transform', `rotate(${previousRotation})`)
      .transition()
      .duration(500)
      .ease(d3.easeCubicInOut)
      .attr('transform', `rotate(${targetRotation})`);

    // Draw arcs on the rotatable group
    rotatableGroup.selectAll('path.arc')
      .data(visibleNodes)
      .join('path')
      .attr('class', 'arc')
      .attr('d', d => arc(d) || '')
      .attr('fill', d => d.data.color || '#ccc')
      .attr('fill-opacity', d => {
        // In path = full opacity, siblings = semi-transparent
        if (isInCurrentPath(d)) return 1;
        if (isSibling(d)) return 0.3;
        // Top level when nothing selected
        if (currentPathNames.length === 0) return 1;
        return 0.3;
      })
      .attr('stroke', d => {
        if (isInCurrentPath(d)) return '#FF5740';
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
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="tooltip-name">${d.data.name}</div>
            <div class="tooltip-amount">${formatCurrency(d.value || 0)}</div>
            <div class="tooltip-percentage">${formatPercentage(d.value || 0, totalBudget)} of total budget</div>
            ${hasChildren ? '<div class="tooltip-hint">Click to explore</div>' : ''}
          `);
      })
      .on('mousemove', function(event) {
        d3.select('#sunburst-tooltip')
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseleave', function(_event, d) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('fill-opacity', () => {
            if (isInCurrentPath(d)) return 1;
            if (isSibling(d)) return 0.3;
            if (currentPathNames.length === 0) return 1;
            return 0.3;
          })
          .attr('stroke-width', () => {
            if (isCurrentSelection(d)) return 4;
            if (isInCurrentPath(d)) return 3;
            return 1;
          });

        d3.select('#sunburst-tooltip').style('opacity', 0);
      });

    // Add center circle - always shows total budget
    svg.append('circle')
      .attr('r', centerRadius)
      .attr('fill', 'var(--muted-blue)')
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
      .attr('y', -8)
      .attr('fill', 'white')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text('Total Budget');

    centerGroup.append('text')
      .attr('y', 12)
      .attr('fill', 'white')
      .attr('font-size', '14px')
      .attr('font-weight', '700')
      .text(formatCurrency(totalBudget));

    // Draw callout line and update callout box position if there's a selection
    if (selectedNode && currentPathNames.length > 0) {
      const midAngle = (selectedNode.x0 + selectedNode.x1) / 2;
      const midRadius = (selectedNode.y0 + selectedNode.y1) / 2;

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
        .attr('stroke', '#FF5740')
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
        .attr('fill', '#FF5740')
        .attr('opacity', 0)
        .transition()
        .delay(300)
        .duration(200)
        .attr('opacity', 1);

      const calloutBox = containerRef.current?.querySelector('.sunburst-callout') as HTMLElement;
      if (calloutBox) {
        // Map SVG coordinates to container coordinates, accounting for viewBox crop
        // The center of the sunburst (0,0 in SVG) maps to (size/2, displayHeight/2) in container
        const centerX = size / 2;
        const centerY = displayHeight / 2;
        const boxX = centerX + lineEndX;
        const boxY = centerY + lineEndY;

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
          calloutBox.style.right = `${size - boxX + 10}px`;
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

  }, [hierarchyData, currentPathNames, navigationPath, totalBudget, onPathClick]);

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
            <div className="callout-amount">{formatCurrency(currentCategory.amount)}</div>
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
