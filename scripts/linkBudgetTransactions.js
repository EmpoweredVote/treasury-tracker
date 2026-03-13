import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Number of transactions to include in the preview (for fast initial load)
const PREVIEW_TRANSACTION_COUNT = 20;

/**
 * Budget-Transaction Linker
 *
 * This script reads the processed budget data and transaction index,
 * then merges linked transaction summaries into the budget categories.
 * This enables the drill-down flow: Budget Category → Transactions
 *
 * To keep file sizes manageable, only a preview of transactions is embedded.
 * The full transaction list can be loaded on demand from the index file.
 */

class BudgetTransactionLinker {
  constructor(config) {
    this.config = config;
  }

  /**
   * Recursively add linked transactions to budget categories
   */
  linkTransactionsToCategory(category, transactionIndex, stats) {
    // Check if this category has a linkKey that matches transactions
    if (category.linkKey && transactionIndex[category.linkKey]) {
      const linked = transactionIndex[category.linkKey];
      category.linkedTransactions = {
        totalAmount: linked.totalAmount,
        transactionCount: linked.transactionCount,
        vendorCount: linked.vendorCount,
        topVendors: linked.topVendors,
        // Only include a preview of transactions for fast initial load
        // Full list can be loaded on demand from the transaction index
        transactions: linked.transactions.slice(0, PREVIEW_TRANSACTION_COUNT),
        hasMore: linked.transactions.length > PREVIEW_TRANSACTION_COUNT
      };
      stats.linkedCategories++;
      stats.linkedTransactions += linked.transactionCount;
    }

    // Recursively process subcategories
    if (category.subcategories) {
      for (const subcategory of category.subcategories) {
        this.linkTransactionsToCategory(subcategory, transactionIndex, stats);
      }
    }
  }

  /**
   * Process a single year's data
   */
  processYear(year) {
    console.log(`\n📅 Linking FY${year}...`);

    // Read budget data
    const budgetPath = path.join(
      __dirname,
      '..',
      this.config.datasets.operating.outputFile.replace('{year}', year)
    );

    if (!fs.existsSync(budgetPath)) {
      console.warn(`   ⚠️  Budget file not found: ${budgetPath}`);
      return false;
    }

    const budgetData = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'));
    console.log(`   📊 Loaded budget with ${budgetData.categories.length} top-level categories`);

    // Read transaction index
    const indexPath = path.join(
      __dirname,
      '..',
      this.config.datasets.transactions.outputFile.replace('{year}', year).replace('.json', '-index.json')
    );

    if (!fs.existsSync(indexPath)) {
      console.warn(`   ⚠️  Transaction index not found: ${indexPath}`);
      console.log(`   💡 Run processTransactions.js first to generate the index`);
      return false;
    }

    const transactionIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    console.log(`   🔗 Loaded transaction index with ${Object.keys(transactionIndex).length} linkKeys`);

    // Link transactions to budget categories
    const stats = { linkedCategories: 0, linkedTransactions: 0 };
    for (const category of budgetData.categories) {
      this.linkTransactionsToCategory(category, transactionIndex, stats);
    }

    console.log(`   ✅ Linked ${stats.linkedCategories} categories to ${stats.linkedTransactions} transactions`);

    // Write the linked budget file
    const linkedPath = budgetPath.replace('.json', '-linked.json');
    fs.writeFileSync(linkedPath, JSON.stringify(budgetData, null, 2));
    console.log(`   📝 Wrote ${path.basename(linkedPath)}`);

    const linkedStats = fs.statSync(linkedPath);
    const sizeMB = linkedStats.size / (1024 * 1024);
    console.log(`   📦 File size: ${sizeMB.toFixed(2)} MB`);

    return true;
  }

  /**
   * Process all configured years
   */
  processAll() {
    console.log('🔗 Linking Budget Categories to Transactions...\n');
    console.log(`📋 City: ${this.config.cityName}`);
    console.log(`📅 Years: ${this.config.fiscalYears.join(', ')}`);

    const results = [];
    for (const year of this.config.fiscalYears) {
      const success = this.processYear(year);
      results.push({ year, success });
    }

    console.log(`\n✨ Linking Complete!`);
    console.log(`\n📊 Summary:`);
    results.forEach(r => {
      const status = r.success ? '✅' : '⚠️ ';
      console.log(`   ${status} FY${r.year}`);
    });

    console.log(`\n💡 The linked budget files now contain transaction data.`);
    console.log(`   Update your app to load budget-{year}-linked.json for the full drill-down experience.`);
  }
}

// Main execution
try {
  const configPath = path.join(__dirname, '..', 'treasuryConfig.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const linker = new BudgetTransactionLinker(config);
  linker.processAll();

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
