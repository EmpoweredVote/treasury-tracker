/**
 * Smart Color Distribution Utilities
 * 
 * Ensures that adjacent categories get visually distinct colors
 * by maximizing color distance in the palette.
 */

/**
 * Calculate perceptual color distance using simplified deltaE
 * @param {string} color1 - Hex color string
 * @param {string} color2 - Hex color string
 * @returns {number} Distance between colors
 */
export function colorDistance(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  // Simplified perceptual distance (weighted RGB)
  const rMean = (rgb1.r + rgb2.r) / 2;
  const r = rgb1.r - rgb2.r;
  const g = rgb1.g - rgb2.g;
  const b = rgb1.b - rgb2.b;
  
  const weightR = 2 + rMean / 256;
  const weightG = 4.0;
  const weightB = 2 + (255 - rMean) / 256;
  
  return Math.sqrt(weightR * r * r + weightG * g * g + weightB * b * b);
}

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color string (#RRGGBB)
 * @returns {{r: number, g: number, b: number}}
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Distribute colors to categories ensuring maximum contrast between adjacent items
 * Uses an improved algorithm that maximizes distance between consecutive colors
 * @param {Array} palette - Array of hex color strings
 * @param {number} count - Number of colors needed
 * @returns {Array} Array of colors with optimal distribution
 */
export function distributeColors(palette, count) {
  if (count <= 0) return [];
  if (count === 1) return [palette[0]];
  
  // If we need fewer colors than palette size, pick maximally spaced colors
  if (count <= palette.length) {
    const colors = [];
    const step = palette.length / count;
    for (let i = 0; i < count; i++) {
      const index = Math.floor(i * step);
      colors.push(palette[index]);
    }
    return colors;
  }
  
  // Need more colors than palette - use greedy algorithm to maximize adjacent distances
  const colors = [palette[0]]; // Start with first color
  const remainingColors = [...palette];
  remainingColors.shift();
  
  // Add colors one by one, always picking the one most different from the last
  while (colors.length < count && remainingColors.length > 0) {
    const lastColor = colors[colors.length - 1];
    
    // Find color with maximum distance from last color
    let maxDistance = 0;
    let bestIndex = 0;
    
    for (let i = 0; i < remainingColors.length; i++) {
      const distance = colorDistance(lastColor, remainingColors[i]);
      if (distance > maxDistance) {
        maxDistance = distance;
        bestIndex = i;
      }
    }
    
    colors.push(remainingColors[bestIndex]);
    remainingColors.splice(bestIndex, 1);
  }
  
  // If we still need more colors, cycle through palette with the same strategy
  while (colors.length < count) {
    const lastColor = colors[colors.length - 1];
    
    // Find palette color with maximum distance from last used color
    let maxDistance = 0;
    let bestColor = palette[0];
    
    for (const paletteColor of palette) {
      const distance = colorDistance(lastColor, paletteColor);
      if (distance > maxDistance) {
        maxDistance = distance;
        bestColor = paletteColor;
      }
    }
    
    colors.push(bestColor);
  }
  
  return colors;
}

/**
 * Assign colors to categories with smart distribution
 * Ensures adjacent categories have maximum color distance
 * @param {Array} categories - Array of category objects
 * @param {Array} palette - Array of hex color strings
 * @returns {Array} Categories with assigned colors
 */
export function assignSmartColors(categories, palette) {
  if (!categories || categories.length === 0) return categories;
  if (!palette || palette.length === 0) return categories;
  
  // Distribute colors based on category count
  const distributedColors = distributeColors(palette, categories.length);
  
  // Assign colors to categories
  const result = categories.map((category, index) => ({
    ...category,
    color: distributedColors[index]
  }));
  
  return result;
}

/**
 * Create a color assigner that maintains state across calls
 * Uses improved algorithm to maximize color distance between adjacent items
 */
export class SmartColorAssigner {
  constructor(palette) {
    this.palette = palette || [];
    this.assignedColors = []; // Track order of colors assigned
    this.colorPool = [...this.palette]; // Available colors to choose from
  }
  
  /**
   * Get next color that's maximally different from the last used color
   * @returns {string} Hex color string
   */
  getNextColor() {
    if (this.palette.length === 0) return '#cccccc';
    
    // If pool is empty, refill it
    if (this.colorPool.length === 0) {
      this.colorPool = [...this.palette];
    }
    
    // If this is the first color, use the first palette color
    if (this.assignedColors.length === 0) {
      const color = this.colorPool.shift();
      this.assignedColors.push(color);
      return color;
    }
    
    // Find color in pool with maximum distance from last assigned color
    const lastColor = this.assignedColors[this.assignedColors.length - 1];
    let maxDistance = 0;
    let bestIndex = 0;
    
    for (let i = 0; i < this.colorPool.length; i++) {
      const distance = colorDistance(lastColor, this.colorPool[i]);
      if (distance > maxDistance) {
        maxDistance = distance;
        bestIndex = i;
      }
    }
    
    // Remove and return the best color
    const selectedColor = this.colorPool.splice(bestIndex, 1)[0];
    this.assignedColors.push(selectedColor);
    return selectedColor;
  }
  
  /**
   * Reset the assigner state
   */
  reset() {
    this.assignedColors = [];
    this.colorPool = [...this.palette];
  }
}
