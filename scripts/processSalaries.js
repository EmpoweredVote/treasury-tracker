import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SmartColorAssigner } from './colorUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Salaries Data Processor
 * 
 * Processes employee payroll data with privacy considerations.
 * Aggregates by department and position by default.
 */

class SalariesProcessor {
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
    return data.filter(row => row.year == year);
  }

  getNextColor() {
    if (!this.colorAssigner) {
      this.colorAssigner = new SmartColorAssigner(this.config.datasets.salaries.colorPalette);
    }
    return this.colorAssigner.getNextColor();
  }

  cleanDepartmentName(dept) {
    // Extract department name from "Dept - Full Name" format
    if (!dept) return 'Unknown';
    
    // Remove prefixes like "Pol - ", "Eng - ", etc.
    const parts = dept.split(' - ');
    if (parts.length > 1) {
      return parts[1].trim();
    }
    
    return dept.trim();
  }

  cleanPositionTitle(title) {
    if (!title) return 'Unknown Position';
    
    // Remove position codes like "14-006-006 - "
    const parts = title.split(' - ');
    if (parts.length > 1 && /^\d+-\d+-\d+$/.test(parts[0])) {
      return parts.slice(1).join(' - ').trim();
    }
    
    return title.trim();
  }

  buildHierarchy(data, includeNames = false) {
    const departmentMap = new Map();
    
    // Group by department
    data.forEach(row => {
      const deptName = this.cleanDepartmentName(row.department);
      const positionTitle = this.cleanPositionTitle(row.position_title);
      const positionType = row.position_type || 'Unknown';
      
      if (!departmentMap.has(deptName)) {
        departmentMap.set(deptName, {
          name: deptName,
          positions: new Map(),
          employees: [],
          totalCompensation: 0,
          employeeCount: 0
        });
      }
      
      const dept = departmentMap.get(deptName);
      
      // Track by position title
      const posKey = `${positionTitle}|${positionType}`;
      if (!dept.positions.has(posKey)) {
        dept.positions.set(posKey, {
          title: positionTitle,
          type: positionType,
          employees: [],
          totalPay: 0,
          totalBase: 0,
          totalBenefits: 0,
          totalOvertime: 0,
          totalOther: 0,
          count: 0
        });
      }
      
      const position = dept.positions.get(posKey);
      
      // Parse compensation
      const totalPay = parseFloat(row.pay_total_actual) || 0;
      const basePay = parseFloat(row.pay_base_actual) || 0;
      const benefits = parseFloat(row.pay_benefits_actual) || 0;
      const overtime = parseFloat(row.pay_overtime_actual) || 0;
      const other = parseFloat(row.pay_other_actual) || 0;
      
      // Add to position totals
      position.totalPay += totalPay;
      position.totalBase += basePay;
      position.totalBenefits += benefits;
      position.totalOvertime += overtime;
      position.totalOther += other;
      position.count++;
      
      // Add to department totals
      dept.totalCompensation += totalPay;
      dept.employeeCount++;
      
      // Store employee info if requested
      if (includeNames) {
        const employee = {
          name: `${row.name_first || ''} ${row.name_last || ''}`.trim() || 'Unknown',
          position: positionTitle,
          totalPay,
          basePay,
          benefits,
          overtime,
          other,
          startDate: row.service_start_date
        };
        position.employees.push(employee);
        dept.employees.push(employee);
      }
    });
    
    return this.departmentMapToCategories(departmentMap, includeNames);
  }

  departmentMapToCategories(departmentMap, includeNames) {
    const categories = [];
    
    for (const [deptName, dept] of departmentMap) {
      const category = {
        name: deptName,
        amount: dept.totalCompensation,
        percentage: 0, // Will be calculated later
        color: this.getNextColor(),
        items: dept.employeeCount,
        metadata: {
          employeeCount: dept.employeeCount,
          avgCompensation: dept.employeeCount > 0 ? dept.totalCompensation / dept.employeeCount : 0
        }
      };
      
      // Add position breakdowns as subcategories
      const subcategories = [];
      for (const [posKey, position] of dept.positions) {
        const avgPay = position.count > 0 ? position.totalPay / position.count : 0;
        
        const subcategory = {
          name: `${position.title} (${position.count})`,
          amount: position.totalPay,
          percentage: 0,
          color: this.getNextColor(),
          items: position.count,
          metadata: {
            count: position.count,
            avgTotal: avgPay,
            avgBase: position.count > 0 ? position.totalBase / position.count : 0,
            avgBenefits: position.count > 0 ? position.totalBenefits / position.count : 0,
            avgOvertime: position.count > 0 ? position.totalOvertime / position.count : 0,
            positionType: position.type
          }
        };
        
        // Add individual employees as line items if names included
        if (includeNames && position.employees.length > 0) {
          subcategory.lineItems = position.employees
            .sort((a, b) => b.totalPay - a.totalPay)
            .map(emp => ({
              description: emp.name,
              approvedAmount: emp.totalPay,
              actualAmount: emp.totalPay,
              metadata: {
                basePay: emp.basePay,
                benefits: emp.benefits,
                overtime: emp.overtime,
                other: emp.other,
                startDate: emp.startDate
              }
            }));
        }
        
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

  process(year, includeNames = false) {
    this.colorAssigner = new SmartColorAssigner(this.config.datasets.salaries.colorPalette);
    
    console.log(`\n📅 Processing Salaries FY${year}...`);
    console.log(`   Privacy Mode: ${includeNames ? 'Names Included' : 'Aggregated Only'}`);
    
    const csvPath = path.join(__dirname, '..', this.config.datasets.salaries.inputFile);
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Salaries CSV not found at: ${csvPath}`);
      return null;
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rawData = this.parseCSV(csvContent);
    const filteredData = this.filterByYear(rawData, year);
    
    console.log(`   Found ${filteredData.length} payroll records for FY${year}`);
    
    if (filteredData.length === 0) {
      console.warn(`   ⚠️  No salary data found for FY${year}, skipping...`);
      return null;
    }
    
    const categories = this.buildHierarchy(filteredData, includeNames);
    
    const totalCompensation = categories.reduce((sum, cat) => sum + cat.amount, 0);
    const totalEmployees = categories.reduce((sum, cat) => sum + cat.items, 0);
    const avgCompensation = totalEmployees > 0 ? totalCompensation / totalEmployees : 0;
    
    this.calculatePercentages(categories);
    
    console.log(`   💰 Total Compensation: ${totalCompensation.toLocaleString()}`);
    console.log(`   👥 Total Employees: ${totalEmployees}`);
    console.log(`   📊 Average Compensation: ${avgCompensation.toLocaleString()}`);
    console.log(`   🏢 ${categories.length} departments`);
    
    return {
      metadata: {
        cityName: this.config.cityName,
        fiscalYear: year,
        population: this.config.population,
        totalBudget: totalCompensation,
        totalCompensation: totalCompensation,
        totalEmployees: totalEmployees,
        avgCompensation: avgCompensation,
        generatedAt: new Date().toISOString(),
        hierarchy: this.config.datasets.salaries.hierarchy,
        dataSource: this.config.datasets.salaries.inputFile,
        includesEmployeeNames: includeNames,
        datasetType: 'salaries'
      },
      categories: categories
    };
  }

  processAll() {
    console.log('👥 Processing salary data...\n');
    console.log(`📋 City: ${this.config.cityName}`);
    console.log(`📊 Hierarchy: ${this.config.datasets.salaries.hierarchy.join(' → ')}`);
    console.log(`📅 Years: ${this.config.fiscalYears.join(', ')}\n`);
    
    const includeNames = this.config.datasets.salaries.includeEmployeeNames || false;
    
    const results = [];
    for (const year of this.config.fiscalYears) {
      const output = this.process(year, includeNames);
      if (output) {
        const outputPath = path.join(
          __dirname, 
          '..', 
          this.config.datasets.salaries.outputFile.replace('{year}', year)
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
    
    console.log(`\n✨ Salary Processing Complete!`);
    console.log(`\n📊 Summary:`);
    results.forEach(r => {
      const status = r.success ? '✅' : '⚠️ ';
      console.log(`   ${status} FY${r.year}`);
    });
    
    if (!includeNames) {
      console.log(`\n🔒 Privacy Mode: Employee names not included`);
      console.log(`   Set "includeEmployeeNames": true in config to include names`);
    }
  }
}

// Main execution
try {
  const configPath = path.join(__dirname, '..', 'treasuryConfig.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  const processor = new SalariesProcessor(config);
  processor.processAll();
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
