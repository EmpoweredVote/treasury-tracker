import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SmartColorAssigner } from './colorUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Revenue Budget Data Processor
 * 
 * Processes revenue data to show where city money comes from
 */

class RevenueProcessor {
  constructor(config) {
    this.config = config;
    this.colorAssigner = null;
  }

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

  filterByYear(data, year) {
    return data.filter(row => row.fiscal_year == year);
  }

  getNextColor() {
    if (!this.colorAssigner) {
      this.colorAssigner = new SmartColorAssigner(this.config.datasets.revenue.colorPalette);
    }
    return this.colorAssigner.getNextColor();
  }

  buildHierarchy(data) {
    const hierarchy = this.config.datasets.revenue.hierarchy;
    const amountCol = this.config.datasets.revenue.amountColumn;
    
    const tree = {};
    
    data.forEach(row => {
      let current = tree;
      
      hierarchy.forEach((level, index) => {
        const key = row[level] || 'Uncategorized';
        
        if (!current[key]) {
          current[key] = {
            name: key,
            items: [],
            children: {},
            amount: 0
          };
        }
        
        current[key].items.push(row);
        current = current[key].children;
      });
    });
    
    return this.treeToArray(tree, 0);
  }

  treeToArray(tree, depth) {
    const result = [];
    const hierarchy = this.config.datasets.revenue.hierarchy;
    const isLowestLevel = depth === hierarchy.length - 1;
    
    for (const [name, node] of Object.entries(tree)) {
      const amount = this.calculateTotal(node.items);
      
      const category = {
        name: this.cleanCategoryName(name),
        amount: amount,
        percentage: 0,
        color: this.getNextColor(),
        items: node.items.length
      };
      
      // Add revenue-specific descriptions
      if (node.items.length > 0) {
        const descriptions = node.items
          .map(item => item.description)
          .filter(Boolean);
        
        if (descriptions.length > 0) {
          const uniqueDescriptions = [...new Set(descriptions)];
          category.description = uniqueDescriptions.slice(0, 3).join('; ');
        }
      }
      
      // Add educational context for revenue sources
      category.whyMatters = this.getRevenueExplanation(name);
      
      // At lowest level, include line items
      if (isLowestLevel && node.items.length > 0) {
        category.lineItems = node.items.map(item => ({
          description: item.description || item.item_category || 'No description',
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

  cleanCategoryName(name) {
    // Remove technical codes and clean up names
    return name
      .replace(/^[A-Z]-\d+\s*-\s*/, '')
      .replace(/_/g, ' ')
      .trim();
  }

  getRevenueExplanation(categoryName) {
    const explanations = {
      'Taxes': 'Taxes are the primary revenue source, including property, income, and sales taxes paid by residents and businesses.',
      'Property Tax': 'Property taxes are based on the assessed value of homes and businesses in Bloomington.',
      'Income Tax': 'Local income tax (LIT) revenue helps fund essential city services.',
      'Sales Tax': 'A portion of sales tax collected in the city returns to fund local services.',
      'Charges for Services': 'Fees paid by residents and businesses for specific city services like permits and utilities.',
      'Intergovernmental': 'Money received from state and federal government programs and grants.',
      'Grants': 'Funding from state and federal sources for specific programs and projects.',
      'Miscellaneous': 'Other revenue sources including interest, fines, and donations.',
      'Operating Revenues': 'Income from utility operations and other city-run services.',
      'Utilities': 'Revenue from city-operated utilities like water and wastewater services.'
    };
    
    // Find matching explanation
    for (const [key, explanation] of Object.entries(explanations)) {
      if (categoryName.includes(key)) {
        return explanation;
      }
    }
    
    return 'Revenue that supports city operations and services.';
  }

  calculateTotal(items) {
    const amountCol = this.config.datasets.revenue.amountColumn;
    return items.reduce((sum, item) => {
      const value = parseFloat(item[amountCol]) || 0;
      return sum + Math.abs(value); // Use absolute value for revenue (some might be negative in source data)
    }, 0);
  }

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

  processYear(rawData, year) {
    this.colorAssigner = new SmartColorAssigner(this.config.datasets.revenue.colorPalette);
    
    console.log(`\n📅 Processing Revenue FY${year}...`);
    
    const filteredData = this.filterByYear(rawData, year);
    console.log(`   Found ${filteredData.length} revenue rows for FY${year}`);
    
    if (filteredData.length === 0) {
      console.warn(`   ⚠️  No revenue data found for FY${year}, skipping...`);
      return null;
    }
    
    const categories = this.buildHierarchy(filteredData);
    const totalRevenue = categories.reduce((sum, cat) => sum + cat.amount, 0);
    this.calculatePercentages(categories);
    
    console.log(`   💰 Total Revenue: ${totalRevenue.toLocaleString()}`);
    console.log(`   📊 ${categories.length} top-level revenue sources`);
    
    return {
      metadata: {
        cityName: this.config.cityName,
        fiscalYear: year,
        population: this.config.population,
        totalBudget: totalRevenue,
        totalRevenue: totalRevenue,
        generatedAt: new Date().toISOString(),
        hierarchy: this.config.datasets.revenue.hierarchy,
        dataSource: this.config.datasets.revenue.inputFile,
        datasetType: 'revenue'
      },
      categories: categories
    };
  }

  processAll() {
    console.log('💰 Processing revenue data...\n');
    console.log(`📋 City: ${this.config.cityName}`);
    console.log(`📊 Hierarchy: ${this.config.datasets.revenue.hierarchy.join(' → ')}`);
    console.log(`📅 Years: ${this.config.fiscalYears.join(', ')}\n`);
    
    const csvPath = path.join(__dirname, '..', this.config.datasets.revenue.inputFile);
    console.log(`📂 Reading: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Error: Revenue CSV file not found at ${csvPath}`);
      process.exit(1);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rawData = this.parseCSV(csvContent);
    console.log(`   Found ${rawData.length} total rows`);
    
    const results = [];
    for (const year of this.config.fiscalYears) {
      const output = this.processYear(rawData, year);
      if (output) {
        const outputPath = path.join(
          __dirname, 
          '..', 
          this.config.datasets.revenue.outputFile.replace('{year}', year)
        );
        
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
    
    console.log(`\n✨ Revenue Processing Complete!`);
    console.log(`\n📊 Summary:`);
    results.forEach(r => {
      const status = r.success ? '✅' : '⚠️ ';
      console.log(`   ${status} FY${r.year}`);
    });
  }
}

// Main execution
try {
  const configPath = path.join(__dirname, '..', 'treasuryConfig.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  const processor = new RevenueProcessor(config);
  processor.processAll();
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
