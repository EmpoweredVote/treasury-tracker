import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SmartColorAssigner } from './colorUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transactions Data Processor
 * 
 * Processes individual payment/purchase transactions.
 * Creates aggregated summaries and detailed transaction lists.
 */

class TransactionsProcessor {
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
    return data.filter(row => row.Fiscal_Year == year);
  }

  getNextColor() {
    if (!this.colorAssigner) {
      this.colorAssigner = new SmartColorAssigner(this.config.datasets.transactions.colorPalette);
    }
    return this.colorAssigner.getNextColor();
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    try {
      return new Date(dateStr);
    } catch (e) {
      return null;
    }
  }

  getMonthKey(dateStr) {
    const date = this.parseDate(dateStr);
    if (!date || isNaN(date.getTime())) return 'Unknown';

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Generate linkKeys for a transaction row.
   * Returns an array of keys at different hierarchy levels for matching to budget categories.
   * Keys match the format: priority|service|fund|expenseCategory (all lowercase)
   */
  generateLinkKeys(row) {
    const priority = (row.Priority || '').toLowerCase().trim();
    const service = (row.Service || '').toLowerCase().trim();
    const fund = (row.Fund || '').toLowerCase().trim();
    const expenseCategory = (row['Expense Category'] || '').toLowerCase().trim();

    const keys = [];

    // Level 1: priority only
    if (priority) {
      keys.push({ level: 1, key: priority });
    }

    // Level 2: priority|service
    if (priority && service) {
      keys.push({ level: 2, key: `${priority}|${service}` });
    }

    // Level 3: priority|service|fund
    if (priority && service && fund) {
      keys.push({ level: 3, key: `${priority}|${service}|${fund}` });
    }

    // Level 4: priority|service|fund|expenseCategory (most specific)
    if (priority && service && fund && expenseCategory) {
      keys.push({ level: 4, key: `${priority}|${service}|${fund}|${expenseCategory}` });
    }

    return keys;
  }

  /**
   * Build a transaction index grouped by linkKey for efficient lookups
   */
  buildTransactionIndex(data) {
    const index = new Map();

    data.forEach(row => {
      const amount = parseFloat(row.Amount) || 0;
      const transaction = {
        description: row.Description || 'No description',
        amount: amount,
        vendor: row.Vendor || 'Unknown',
        date: row['Payment Date'] || '',
        paymentMethod: row.Payment_Method || '',
        invoiceNumber: row.InvoiceNumber || '',
        fund: row.Fund || '',
        expenseCategory: row['Expense Category'] || ''
      };

      // Add this transaction to all applicable linkKeys
      const linkKeys = this.generateLinkKeys(row);
      for (const { key } of linkKeys) {
        if (!index.has(key)) {
          index.set(key, {
            transactions: [],
            totalAmount: 0,
            vendors: new Set()
          });
        }
        const entry = index.get(key);
        entry.transactions.push(transaction);
        entry.totalAmount += amount;
        if (row.Vendor) entry.vendors.add(row.Vendor);
      }
    });

    // Convert to serializable format
    const result = {};
    for (const [key, value] of index) {
      // Calculate top vendors for this linkKey
      const vendorTotals = new Map();
      value.transactions.forEach(tx => {
        if (tx.vendor && tx.vendor !== 'Unknown') {
          if (!vendorTotals.has(tx.vendor)) {
            vendorTotals.set(tx.vendor, { name: tx.vendor, amount: 0, count: 0 });
          }
          const v = vendorTotals.get(tx.vendor);
          v.amount += tx.amount;
          v.count++;
        }
      });

      const topVendors = Array.from(vendorTotals.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      result[key] = {
        totalAmount: value.totalAmount,
        transactionCount: value.transactions.length,
        vendorCount: value.vendors.size,
        topVendors: topVendors,
        // Include ALL transactions, sorted by date (most recent first)
        transactions: value.transactions
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      };
    }

    return result;
  }

  buildMonthlyAggregation(data) {
    const monthMap = new Map();
    
    data.forEach(row => {
      const monthKey = this.getMonthKey(row['Payment Date']);
      const amount = parseFloat(row.Amount) || 0;
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          totalAmount: 0,
          transactionCount: 0,
          transactions: []
        });
      }
      
      const month = monthMap.get(monthKey);
      month.totalAmount += amount;
      month.transactionCount++;
      month.transactions.push(row);
    });
    
    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  buildDepartmentAggregation(data) {
    const deptMap = new Map();
    
    data.forEach(row => {
      const priority = row.Priority || 'Unknown';
      const amount = parseFloat(row.Amount) || 0;
      
      if (!deptMap.has(priority)) {
        deptMap.set(priority, {
          name: priority,
          totalAmount: 0,
          transactionCount: 0,
          vendors: new Set(),
          transactions: []
        });
      }
      
      const dept = deptMap.get(priority);
      dept.totalAmount += amount;
      dept.transactionCount++;
      if (row.Vendor) dept.vendors.add(row.Vendor);
      dept.transactions.push(row);
    });
    
    return Array.from(deptMap.values());
  }

  buildVendorAggregation(data) {
    const vendorMap = new Map();
    
    data.forEach(row => {
      const vendor = row.Vendor || 'Unknown Vendor';
      const amount = parseFloat(row.Amount) || 0;
      
      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, {
          name: vendor,
          totalAmount: 0,
          transactionCount: 0
        });
      }
      
      const vendorData = vendorMap.get(vendor);
      vendorData.totalAmount += amount;
      vendorData.transactionCount++;
    });
    
    return Array.from(vendorMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 100); // Top 100 vendors
  }

  buildHierarchy(data) {
    const departments = this.buildDepartmentAggregation(data);
    const categories = [];
    
    for (const dept of departments) {
      const category = {
        name: dept.name,
        amount: dept.totalAmount,
        percentage: 0,
        color: this.getNextColor(),
        items: dept.transactionCount,
        metadata: {
          transactionCount: dept.transactionCount,
          vendorCount: dept.vendors.size,
          avgTransaction: dept.transactionCount > 0 ? dept.totalAmount / dept.transactionCount : 0
        }
      };
      
      // Group by service within department
      const serviceMap = new Map();
      dept.transactions.forEach(tx => {
        const service = tx.Service || 'General';
        if (!serviceMap.has(service)) {
          serviceMap.set(service, {
            name: service,
            transactions: [],
            totalAmount: 0
          });
        }
        const svc = serviceMap.get(service);
        svc.transactions.push(tx);
        svc.totalAmount += parseFloat(tx.Amount) || 0;
      });
      
      // Create subcategories for services
      const subcategories = [];
      for (const [serviceName, service] of serviceMap) {
        const subcategory = {
          name: serviceName,
          amount: service.totalAmount,
          percentage: 0,
          color: this.getNextColor(),
          items: service.transactions.length,
          
          // Include sample transactions as line items (limit to 100 most recent)
          lineItems: service.transactions
            .sort((a, b) => {
              const dateA = this.parseDate(a['Payment Date']);
              const dateB = this.parseDate(b['Payment Date']);
              return dateB - dateA;
            })
            .slice(0, 100)
            .map(tx => ({
              description: `${tx.Description || 'No description'} - ${tx.Vendor || 'Unknown vendor'}`,
              approvedAmount: parseFloat(tx.Amount) || 0,
              actualAmount: parseFloat(tx.Amount) || 0,
              metadata: {
                vendor: tx.Vendor,
                date: tx['Payment Date'],
                paymentMethod: tx.Payment_Method,
                invoiceNumber: tx.InvoiceNumber,
                fund: tx.Fund,
                expenseCategory: tx['Expense Category']
              }
            }))
        };
        
        subcategories.push(subcategory);
      }
      
      category.subcategories = subcategories.sort((a, b) => b.amount - a.amount);
      categories.push(category);
    }
    
    return categories.sort((a, b) => b.amount - a.amount);
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
    this.colorAssigner = new SmartColorAssigner(this.config.datasets.transactions.colorPalette);

    console.log(`\n📅 Processing Transactions FY${year}...`);

    const filteredData = this.filterByYear(rawData, year);
    console.log(`   Found ${filteredData.length} transaction records for FY${year}`);

    if (filteredData.length === 0) {
      console.warn(`   ⚠️  No transaction data found for FY${year}, skipping...`);
      return null;
    }

    // Build hierarchical categories
    const categories = this.buildHierarchy(filteredData);

    // Build aggregations for analysis
    const monthlyData = this.buildMonthlyAggregation(filteredData);
    const topVendors = this.buildVendorAggregation(filteredData);

    // Build transaction index for linking to budget categories
    const transactionIndex = this.buildTransactionIndex(filteredData);
    console.log(`   🔗 Built transaction index with ${Object.keys(transactionIndex).length} linkKeys`);

    const totalAmount = categories.reduce((sum, cat) => sum + cat.amount, 0);
    const totalTransactions = categories.reduce((sum, cat) => sum + cat.items, 0);

    this.calculatePercentages(categories);

    console.log(`   💰 Total Spending: ${totalAmount.toLocaleString()}`);
    console.log(`   📋 Total Transactions: ${totalTransactions}`);
    console.log(`   📊 ${categories.length} departments`);
    console.log(`   🏢 ${topVendors.length} unique vendors`);

    return {
      data: {
        metadata: {
          cityName: this.config.cityName,
          fiscalYear: year,
          population: this.config.population,
          totalBudget: totalAmount,
          totalSpending: totalAmount,
          totalTransactions: totalTransactions,
          avgTransaction: totalTransactions > 0 ? totalAmount / totalTransactions : 0,
          generatedAt: new Date().toISOString(),
          hierarchy: this.config.datasets.transactions.hierarchy,
          dataSource: this.config.datasets.transactions.inputFile,
          datasetType: 'transactions'
        },
        categories: categories,
        analytics: {
          monthlySpending: monthlyData.map(m => ({
            month: m.month,
            amount: m.totalAmount,
            transactionCount: m.transactionCount
          })),
          topVendors: topVendors.slice(0, 20).map(v => ({
            name: v.name,
            totalSpent: v.totalAmount,
            transactionCount: v.transactionCount
          }))
        }
      },
      transactionIndex: transactionIndex
    };
  }

  processAll() {
    console.log('📋 Processing transaction data...\n');
    console.log(`📋 City: ${this.config.cityName}`);
    console.log(`📊 Hierarchy: ${this.config.datasets.transactions.hierarchy.join(' → ')}`);
    console.log(`📅 Years: ${this.config.fiscalYears.join(', ')}\n`);

    const csvPath = path.join(__dirname, '..', this.config.datasets.transactions.inputFile);
    console.log(`📂 Reading: ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Error: Transactions CSV file not found at ${csvPath}`);
      process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rawData = this.parseCSV(csvContent);
    console.log(`   Found ${rawData.length} total transaction records`);

    const results = [];
    for (const year of this.config.fiscalYears) {
      const output = this.processYear(rawData, year);
      if (output) {
        // Write the main transactions file
        const outputPath = path.join(
          __dirname,
          '..',
          this.config.datasets.transactions.outputFile.replace('{year}', year)
        );

        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(output.data, null, 2));
        console.log(`   ✅ Wrote ${path.basename(outputPath)}`);

        // Write the transaction index file for linking
        const indexPath = outputPath.replace('.json', '-index.json');
        fs.writeFileSync(indexPath, JSON.stringify(output.transactionIndex, null, 2));
        console.log(`   ✅ Wrote ${path.basename(indexPath)}`);

        // Log file size warning if large
        const stats = fs.statSync(outputPath);
        const sizeMB = stats.size / (1024 * 1024);
        if (sizeMB > 1) {
          console.log(`   ⚠️  Large file: ${sizeMB.toFixed(2)} MB`);
        }

        const indexStats = fs.statSync(indexPath);
        const indexSizeMB = indexStats.size / (1024 * 1024);
        console.log(`   📦 Index file: ${indexSizeMB.toFixed(2)} MB`);

        results.push({ year, success: true });
      } else {
        results.push({ year, success: false });
      }
    }

    console.log(`\n✨ Transaction Processing Complete!`);
    console.log(`\n📊 Summary:`);
    results.forEach(r => {
      const status = r.success ? '✅' : '⚠️ ';
      console.log(`   ${status} FY${r.year}`);
    });
    console.log(`\n💡 Tip: Transaction index files can be used to link budget categories to transactions.`);
  }
}

// Main execution
try {
  const configPath = path.join(__dirname, '..', 'treasuryConfig.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  const processor = new TransactionsProcessor(config);
  processor.processAll();
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
