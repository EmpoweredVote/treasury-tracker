import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { BudgetCategory } from '../types/budget';
import { getCategoryColor } from '../utils/chartColors';
import './BudgetTree.css';

interface BudgetTreeProps {
  categories: BudgetCategory[];
  navigationPath: BudgetCategory[];
  totalBudget: number;
  onPathClick: (path: BudgetCategory[]) => void;
}

interface TreeNode {
  name: string;
  value: number;
  categoryIndex: number; // root-level category index for color cycling; -1 for root Budget node
  category?: BudgetCategory;
  path: BudgetCategory[]; // Full path to this node
  isAncestor: boolean; // Is this node in the ancestor path?
  isCurrentLevel: boolean; // Is this the current level being displayed?
  hasChildren: boolean;
}

const BudgetTree: React.FC<BudgetTreeProps> = ({
  categories,
  navigationPath,
  totalBudget,
  onPathClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the visible tree structure based on navigation path
  // Only shows: ancestors in the path + current level children
  const visibleNodes = useMemo(() => {
    const nodes: TreeNode[] = [];

    // Build a lookup from root category name to its index
    const rootIndexMap = new Map<string, number>();
    categories.forEach((cat, i) => rootIndexMap.set(cat.name, i));

    // Add root node (Budget) — uses ev-muted-blue (index -1 signals special treatment)
    nodes.push({
      name: 'Budget',
      value: totalBudget,
      categoryIndex: -1,
      path: [],
      isAncestor: true,
      isCurrentLevel: navigationPath.length === 0,
      hasChildren: categories.length > 0,
    });

    // Add ancestor nodes from the navigation path
    navigationPath.forEach((cat, index) => {
      const rootCatIndex = rootIndexMap.get(navigationPath[0].name) ?? 0;
      nodes.push({
        name: cat.name,
        value: cat.amount,
        categoryIndex: rootCatIndex,
        category: cat,
        path: navigationPath.slice(0, index + 1),
        isAncestor: true,
        isCurrentLevel: false,
        hasChildren: (cat.subcategories && cat.subcategories.length > 0) || false,
      });
    });

    // Add current level children
    const currentCategories = navigationPath.length === 0
      ? categories
      : navigationPath[navigationPath.length - 1].subcategories || [];

    currentCategories.forEach((cat, i) => {
      // For root-level children, use their own index.
      // For deeper children, inherit root index.
      const catIndex = navigationPath.length === 0
        ? i
        : (rootIndexMap.get(navigationPath[0].name) ?? 0);
      nodes.push({
        name: cat.name,
        value: cat.amount,
        categoryIndex: catIndex,
        category: cat,
        path: [...navigationPath, cat],
        isAncestor: false,
        isCurrentLevel: true,
        hasChildren: (cat.subcategories && cat.subcategories.length > 0) || false,
      });
    });

    return nodes;
  }, [categories, navigationPath, totalBudget]);

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
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

  // Resolve fill color for a tree node
  // The root "Budget" node (categoryIndex -1) uses ev-muted-blue
  const getNodeFill = (node: TreeNode): string => {
    if (node.categoryIndex === -1) return 'var(--color-ev-muted-blue)';
    return getCategoryColor(node.categoryIndex);
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth;

    // Node dimensions - small boxes
    const nodeWidth = 60;
    const nodeHeight = 36;
    const horizontalGap = 12;
    const verticalGap = 40;

    // Separate ancestor nodes and current level nodes
    const ancestorNodes = visibleNodes.filter(n => n.isAncestor);
    const currentLevelNodes = visibleNodes.filter(n => n.isCurrentLevel && !n.isAncestor);

    // Calculate positions
    // Ancestors are stacked vertically in a single column (centered)
    // Current level children are spread horizontally at the bottom

    const numAncestors = ancestorNodes.length;
    const numChildren = currentLevelNodes.length;

    // Calculate total width needed for children
    const childrenTotalWidth = numChildren * nodeWidth + (numChildren - 1) * horizontalGap;
    const startX = (containerWidth - childrenTotalWidth) / 2;

    // Calculate SVG height
    const ancestorHeight = numAncestors * (nodeHeight + verticalGap);
    const svgHeight = ancestorHeight + nodeHeight + 40;

    const svg = d3.select(svgRef.current)
      .attr('width', containerWidth)
      .attr('height', svgHeight)
      .style('font-family', 'Manrope, sans-serif');

    const g = svg.append('g');

    // Position ancestor nodes (centered, stacked vertically)
    const centerX = containerWidth / 2;
    ancestorNodes.forEach((node, i) => {
      (node as TreeNode & { x: number; y: number }).x = centerX;
      (node as TreeNode & { x: number; y: number }).y = 20 + i * (nodeHeight + verticalGap) + nodeHeight / 2;
    });

    // Position current level nodes (spread horizontally)
    const childrenY = ancestorHeight + 20 + nodeHeight / 2;
    currentLevelNodes.forEach((node, i) => {
      (node as TreeNode & { x: number; y: number }).x = startX + i * (nodeWidth + horizontalGap) + nodeWidth / 2;
      (node as TreeNode & { x: number; y: number }).y = childrenY;
    });

    // Draw connecting lines
    // From each ancestor to next ancestor
    for (let i = 0; i < ancestorNodes.length - 1; i++) {
      const source = ancestorNodes[i] as TreeNode & { x: number; y: number };
      const target = ancestorNodes[i + 1] as TreeNode & { x: number; y: number };

      g.append('line')
        .attr('class', 'tree-link ancestor-link')
        .attr('x1', source.x)
        .attr('y1', source.y + nodeHeight / 2)
        .attr('x2', target.x)
        .attr('y2', target.y - nodeHeight / 2)
        .attr('stroke', '#FF5740')
        .attr('stroke-width', 2);
    }

    // From last ancestor to children (fan out)
    if (ancestorNodes.length > 0 && currentLevelNodes.length > 0) {
      const lastAncestor = ancestorNodes[ancestorNodes.length - 1] as TreeNode & { x: number; y: number };

      currentLevelNodes.forEach(child => {
        const childPos = child as TreeNode & { x: number; y: number };

        // Draw curved line
        const sourceY = lastAncestor.y + nodeHeight / 2;
        const targetY = childPos.y - nodeHeight / 2;
        const midY = (sourceY + targetY) / 2;

        g.append('path')
          .attr('class', 'tree-link child-link')
          .attr('d', `M ${lastAncestor.x} ${sourceY}
                      C ${lastAncestor.x} ${midY}, ${childPos.x} ${midY}, ${childPos.x} ${targetY}`)
          .attr('fill', 'none')
          .attr('stroke', '#ccc')
          .attr('stroke-width', 1.5);
      });
    }

    // Draw all nodes
    const allPositionedNodes = [...ancestorNodes, ...currentLevelNodes] as (TreeNode & { x: number; y: number })[];

    const nodeGroups = g.selectAll('.tree-node')
      .data(allPositionedNodes)
      .join('g')
      .attr('class', 'tree-node')
      .attr('transform', d => `translate(${d.x - nodeWidth / 2}, ${d.y - nodeHeight / 2})`)
      .style('cursor', d => {
        // Ancestors can be clicked to go back, children can be clicked to drill down
        if (d.isAncestor && d.path.length > 0) return 'pointer';
        if (d.isCurrentLevel && d.hasChildren) return 'pointer';
        return 'default';
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.isAncestor) {
          // Click on ancestor goes back to that level
          onPathClick(d.path);
        } else if (d.isCurrentLevel && d.hasChildren && d.category) {
          // Click on child drills down
          onPathClick(d.path);
        }
      });

    // Node rectangles
    nodeGroups.append('rect')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', d => getNodeFill(d))
      .attr('stroke', d => d.isAncestor ? '#FF5740' : 'transparent')
      .attr('stroke-width', d => d.isAncestor ? 2 : 0);

    // Hover effects and tooltips
    nodeGroups
      .on('mouseenter', function(event, d) {
        // Highlight the node
        d3.select(this).select('rect')
          .transition()
          .duration(100)
          .attr('stroke', '#FF5740')
          .attr('stroke-width', 2);

        // Show tooltip
        const tooltip = d3.select('#tree-tooltip');
        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="tooltip-name">${d.name}</div>
            <div class="tooltip-amount">${formatCurrency(d.value)}</div>
            <div class="tooltip-percentage">${formatPercentage(d.value, totalBudget)} of total</div>
            ${d.hasChildren && d.isCurrentLevel ? '<div class="tooltip-hint">Click to explore</div>' : ''}
            ${d.isAncestor && d.path.length > 0 ? '<div class="tooltip-hint">Click to go back</div>' : ''}
          `);
      })
      .on('mousemove', function(event) {
        d3.select('#tree-tooltip')
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseleave', function(_event, d) {
        d3.select(this).select('rect')
          .transition()
          .duration(100)
          .attr('stroke', d.isAncestor ? '#FF5740' : 'transparent')
          .attr('stroke-width', d.isAncestor ? 2 : 0);

        d3.select('#tree-tooltip').style('opacity', 0);
      });

  }, [visibleNodes, totalBudget, onPathClick, getNodeFill]);

  return (
    <div className="tree-wrapper">
      <div className="tree-container" ref={containerRef}>
        <svg ref={svgRef} className="tree-svg" />
        <div id="tree-tooltip" className="tree-tooltip" />
      </div>
    </div>
  );
};

export default BudgetTree;
