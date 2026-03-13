import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SmartColorAssigner } from './colorUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Budget Data Processor
 * 
 * This script reads CSV budget data, aggregates it into hierarchical categories,
 * and outputs a JSON file that the React app can consume.
 */

class BudgetProcessor {
  constructor(config) {
    this.config = config;
    this.colorAssigner = null;
  }

  /**
   * Parse CSV file manually (no dependencies needed)
   */
  parseCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }
    
    return data;
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  /**
   * Filter data by fiscal year
   */
  filterByYear(data, year) {
    return data.filter(row => row.fiscal_year == year);
  }

  /**
   * Get the next color using smart distribution
   */
  getNextColor() {
    if (!this.colorAssigner) {
      this.colorAssigner = new SmartColorAssigner(this.config.colorPalette);
    }
    return this.colorAssigner.getNextColor();
  }

  /**
   * Generate a linkKey for matching budget categories to transactions.
   * The linkKey uses fields common to both datasets: priority, service, fund, item_category (expense category)
   */
  generateLinkKey(row, depth) {
    // Fields that match between budget and transactions datasets
    const parts = [];

    // Only include fields up to and including the current depth
    // Map hierarchy depth to link fields:
    // depth 0 = primary_function (no link field)
    // depth 1 = priority
    // depth 2 = service
    // depth 3 = fund
    // depth 4 = item_category
    const hierarchyToLinkField = {
      'priority': 'priority',
      'service': 'service',
      'fund': 'fund',
      'item_category': 'item_category'
    };

    for (let i = 0; i <= depth && i < this.config.hierarchy.length; i++) {
      const hierarchyField = this.config.hierarchy[i];
      if (hierarchyToLinkField[hierarchyField]) {
        const value = row[hierarchyField] || '';
        parts.push(value.toLowerCase().trim());
      }
    }

    return parts.length > 0 ? parts.join('|') : null;
  }

  /**
   * Build hierarchical structure from flat data
   */
  buildHierarchy(data) {
    const hierarchy = this.config.hierarchy;

    // Build tree structure
    const tree = {};

    data.forEach(row => {
      let current = tree;

      // Navigate/create the hierarchy
      hierarchy.forEach((level, index) => {
        const key = row[level] || 'Uncategorized';

        if (!current[key]) {
          current[key] = {
            name: key,
            items: [],
            children: {},
            amount: 0,
            depth: index
          };
        }

        current[key].items.push(row);
        current = current[key].children;
      });
    });

    // Convert tree to array format and calculate totals
    return this.treeToArray(tree, 0);
  }

  /**
   * Convert tree object to array of BudgetCategory objects
   */
  treeToArray(tree, depth) {
    const result = [];
    const isLowestLevel = depth === this.config.hierarchy.length - 1;

    // DON'T reset color assigner for subcategories - we want continuous color distribution

    for (const [name, node] of Object.entries(tree)) {
      const amount = this.calculateTotal(node.items);

      const category = {
        name: name,
        amount: amount,
        percentage: 0, // Will be calculated later
        color: this.getNextColor(),
        items: node.items.length
      };

      // Generate linkKey for matching to transactions
      // Use the first item to generate the linkKey since all items in this node share the same hierarchy path
      if (node.items.length > 0) {
        const linkKey = this.generateLinkKey(node.items[0], depth);
        if (linkKey) {
          category.linkKey = linkKey;
        }
      }

      // Add description if available
      if (node.items.length > 0 && this.config.descriptionFields) {
        const descriptions = node.items
          .map(item => {
            return this.config.descriptionFields
              .map(field => item[field])
              .filter(Boolean)
              .join(' - ');
          })
          .filter(Boolean);

        if (descriptions.length > 0) {
          // Take first unique description or combine if there are few items
          const uniqueDescriptions = [...new Set(descriptions)];
          category.description = uniqueDescriptions.slice(0, 3).join('; ');
        }
      }

      // At the lowest level, include detailed line items
      if (isLowestLevel && node.items.length > 0) {
        category.lineItems = node.items.map(item => ({
          description: item.description || 'No description',
          approvedAmount: parseFloat(item.approved_amount) || 0,
          actualAmount: parseFloat(item.actual_amount) || 0
        }));
      }

      // Recursively process children
      if (Object.keys(node.children).length > 0) {
        category.subcategories = this.treeToArray(node.children, depth + 1);
      }

      result.push(category);
    }

    return result.sort((a, b) => b.amount - a.amount);
  }

  /**
   * Calculate total amount from items
   */
  calculateTotal(items) {
    const amountCol = this.config.amountColumn;
    return items.reduce((sum, item) => {
      const value = parseFloat(item[amountCol]) || 0;
      return sum + value;
    }, 0);
  }

  /**
   * Calculate percentages for all categories
   */
  calculatePercentages(categories, total = null) {
    if (total === null) {
      total = categories.reduce((sum, cat) => sum + cat.amount, 0);
    }
    
    categories.forEach(category => {
      category.percentage = total > 0 ? (category.amount / total) * 100 : 0;
      
      if (category.subcategories) {
        this.calculatePercentages(category.subcategories, category.amount);
      }
    });
  }

  /**
   * Process a single fiscal year
   */
  processYear(rawData, year) {
    // Reset color assigner for each year
    this.colorAssigner = new SmartColorAssigner(this.config.colorPalette);
    
    console.log(`\n📅 Processing FY${year}...`);
    
    // Filter data for this year
    const filteredData = this.filterByYear(rawData, year);
    console.log(`   Found ${filteredData.length} rows for FY${year}`);
    
    if (filteredData.length === 0) {
      console.warn(`   ⚠️  No data found for FY${year}, skipping...`);
      return null;
    }
    
    // Build hierarchy
    const categories = this.buildHierarchy(filteredData);
    
    // Calculate totals and percentages
    const totalBudget = categories.reduce((sum, cat) => sum + cat.amount, 0);
    this.calculatePercentages(categories);
    
    console.log(`   💰 Total Budget: ${totalBudget.toLocaleString()}`);
    console.log(`   📊 ${categories.length} top-level categories`);
    
    // Create output object
    return {
      metadata: {
        cityName: this.config.cityName,
        fiscalYear: year,
        population: this.config.population,
        totalBudget: totalBudget,
        generatedAt: new Date().toISOString(),
        hierarchy: this.config.hierarchy,
        dataSource: this.config.inputFile
      },
      categories: categories
    };
  }

  /**
   * Main processing function - processes all years
   */
  processAll() {
    console.log('🏛️  Processing budget data...\n');
    console.log(`📋 Config: ${this.config.cityName}`);
    console.log(`📊 Hierarchy: ${this.config.hierarchy.join(' → ')}`);
    console.log(`📅 Years: ${this.config.fiscalYears.join(', ')}\n`);
    
    // Read CSV file once
    const csvPath = path.join(__dirname, '..', this.config.inputFile);
    console.log(`📂 Reading: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Error: CSV file not found at ${csvPath}`);
      console.log(`\n💡 Please place your operating-budget.csv file in the data/ directory`);
      process.exit(1);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rawData = this.parseCSV(csvContent);
    console.log(`   Found ${rawData.length} total rows`);
    
    // Process each year
    const results = [];
    for (const year of this.config.fiscalYears) {
      const output = this.processYear(rawData, year);
      if (output) {
        // Write output file for this year
        const outputPath = path.join(
          __dirname, 
          '..', 
          this.config.outputFile.replace('{year}', year)
        );
        
        // Ensure directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`   ✅ Wrote ${path.basename(outputPath)}`);
        results.push({ year, success: true });
      } else {
        results.push({ year, success: false });
      }
    }
    
    // Print summary
    console.log(`\n✨ Processing Complete!`);
    console.log(`\n📊 Summary:`);
    results.forEach(r => {
      const status = r.success ? '✅' : '⚠️ ';
      console.log(`   ${status} FY${r.year}`);
    });
    console.log(`\nYour app can now load data for any of these years!`);
  }
}

// Main execution
try {
  // Try new config first, fall back to old config
  let configPath = path.join(__dirname, '..', 'treasuryConfig.json');
  if (!fs.existsSync(configPath)) {
    configPath = path.join(__dirname, '..', 'budgetConfig.json');
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // Adapt config structure if using new format
  if (config.datasets && config.datasets.operating) {
    config.inputFile = config.datasets.operating.inputFile;
    config.outputFile = config.datasets.operating.outputFile;
    config.amountColumn = config.datasets.operating.amountColumn;
    config.hierarchy = config.datasets.operating.hierarchy;
    config.colorPalette = config.datasets.operating.colorPalette;
  }
  
  const processor = new BudgetProcessor(config);
  processor.processAll();
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
