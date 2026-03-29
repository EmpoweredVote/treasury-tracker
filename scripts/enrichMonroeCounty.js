#!/usr/bin/env node
/**
 * Monroe County, IN — Category Enrichment Generator
 *
 * Generates plain-language descriptions for ALL missing budget categories
 * for Monroe County (ID: 0361fe24-9c04-4677-9c65-2281cadb7647).
 *
 * NO external API calls — all descriptions generated from local knowledge.
 * Upserts into treasury.category_enrichment in batches of 50.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ─── Env Loading ─────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    }
  } catch {}
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'treasury' }
});

const MUN_ID = '0361fe24-9c04-4677-9c65-2281cadb7647';

// ─── Description Generation ──────────────────────────────────────────────────

/**
 * Generate a description for a category based on its name, parent, and dataset type.
 * Uses pattern matching and county government knowledge — no API calls.
 */
function generateDescription(name, parentName, datasetType) {
  const nl = name.toLowerCase().trim();
  const pl = (parentName || '').toLowerCase().trim();

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATING LINE ITEM TYPES (appear under many departments)
  // ═══════════════════════════════════════════════════════════════════════════

  if (nl === 'services and charges' || nl === 'other services and charges') {
    const dept = parentName || 'this department';
    return {
      plain_name: `${shortDept(parentName)} Contract Services`,
      short_description: `Contracted services, utilities, maintenance, and other non-personnel operating costs for ${dept}.`,
      description: `This covers contracted services, utilities, insurance, professional fees, repairs, maintenance, travel, and other operating expenses for ${dept}. These are recurring costs for outside services rather than supplies or employee compensation.`,
      tags: ['services', 'contracts', 'operating', 'maintenance'],
      confidence: 'high',
    };
  }

  if (nl === 'supplies') {
    const dept = parentName || 'this department';
    return {
      plain_name: `${shortDept(parentName)} Supplies`,
      short_description: `Materials and supplies purchased for ${dept} operations.`,
      description: `This covers office supplies, operational materials, fuel, uniforms, and other consumable goods needed by ${dept} to carry out daily operations. These are items that are used up rather than long-term assets.`,
      tags: ['supplies', 'materials', 'operating'],
      confidence: 'high',
    };
  }

  if (nl === 'capital outlays' || nl === 'capital outlay') {
    const dept = parentName || 'this department';
    return {
      plain_name: `${shortDept(parentName)} Capital Purchases`,
      short_description: `Equipment, vehicles, and infrastructure purchases for ${dept}.`,
      description: `This covers major equipment purchases, vehicle acquisitions, technology upgrades, building improvements, and other long-term capital investments for ${dept}. Capital outlays are typically items costing over a set threshold with a useful life of more than one year.`,
      tags: ['capital', 'equipment', 'infrastructure', 'investment'],
      confidence: 'high',
    };
  }

  if (nl === 'other disbursements' || nl === 'other' || nl === 'other expenditures') {
    const dept = parentName || 'this department';
    return {
      plain_name: `${shortDept(parentName)} Other Costs`,
      short_description: `Miscellaneous expenditures for ${dept} not classified elsewhere.`,
      description: `This covers miscellaneous expenditures for ${dept} that do not fit into standard categories like personnel, supplies, services, or capital. These may include transfers, debt payments, grants, or one-time costs.`,
      tags: ['miscellaneous', 'other', 'operating'],
      confidence: 'medium',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVENUE CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════

  if (datasetType === 'revenue') {
    return generateRevenueDescription(name, parentName, nl, pl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP-LEVEL FUND / DEPARTMENT CATEGORIES (operating)
  // ═══════════════════════════════════════════════════════════════════════════

  // Check for subcategory patterns first (parentName exists)
  if (parentName) {
    return generateSubcategoryDescription(name, parentName, nl, pl);
  }

  // Top-level operating categories
  return generateTopLevelDescription(name, nl);
}

function shortDept(parentName) {
  if (!parentName) return 'Dept.';
  // Shorten long parent names for plain_name field
  const p = parentName.replace(/\(.*?\)/g, '').trim();
  if (p.length > 25) return p.substring(0, 22) + '...';
  return p;
}

// ─── Revenue Description Generator ──────────────────────────────────────────

function generateRevenueDescription(name, parentName, nl, pl) {
  // General Property Taxes
  if (nl.includes('general property tax') || nl.includes('property taxes')) {
    return desc('Property Tax Revenue',
      `Property tax collections for ${parentName || 'Monroe County'}.`,
      `Revenue from property taxes levied on real estate and personal property within the jurisdiction. Property taxes are the primary local revenue source for county government, schools, and special districts in Indiana. Rates are set annually based on approved budgets.`,
      ['property tax', 'revenue', 'local tax']);
  }

  // State tuition support
  if (nl.includes('state tuition support') || nl.includes('basic grant')) {
    return desc('State School Funding',
      `State per-pupil funding distributed to Monroe County schools.`,
      `Indiana provides per-pupil funding to school corporations through the tuition support formula. This is typically the largest single revenue source for school districts, calculated based on enrollment counts and adjusted for complexity factors.`,
      ['state funding', 'education', 'tuition support', 'schools']);
  }

  // Local Income Tax variants
  if (nl.includes('local income tax') || nl.includes('lit ')) {
    return desc('Local Income Tax',
      `Local income tax revenue distributed to Monroe County.`,
      `Indiana counties impose a local income tax (LIT) collected by the state and distributed back to local units. Different LIT components fund general operations, public safety, economic development, and property tax relief.`,
      ['income tax', 'LIT', 'revenue', 'state distribution']);
  }

  // Vehicle/aircraft excise
  if (nl.includes('vehicle') && (nl.includes('excise') || nl.includes('tax'))) {
    return desc('Vehicle Excise Tax',
      `Vehicle registration tax revenue distributed to Monroe County.`,
      `Excise taxes collected on vehicle registrations by the state BMV and distributed to counties based on a formula. This revenue helps fund roads, highways, and general government operations.`,
      ['vehicle tax', 'excise', 'revenue', 'transportation']);
  }

  // Bond proceeds
  if (nl.includes('bond principal') || nl.includes('bond proceeds') || nl.includes('bond issue')) {
    return desc('Bond Proceeds',
      `Proceeds from bond issuances for capital projects.`,
      `Revenue received from issuing bonds (borrowing) to fund major capital projects such as building construction, infrastructure improvements, or equipment purchases. Bond proceeds must be repaid with interest over the bond term.`,
      ['bonds', 'debt', 'capital', 'financing']);
  }

  // Benefit/insurance contributions
  if (nl.includes('benefit plan') || nl.includes('insurance') && nl.includes('contribut')) {
    return desc('Benefit Contributions',
      `Employee and employer contributions to benefit plans.`,
      `Revenue from employee premium contributions, employer matching, and other payments into the county's health insurance, dental, vision, and other benefit programs. These funds are pooled to pay claims and administrative costs.`,
      ['benefits', 'insurance', 'employee', 'health']);
  }

  // Earnings on investments
  if (nl.includes('earnings on invest') || nl.includes('interest income') || nl.includes('investment earnings')) {
    return desc('Investment Earnings',
      `Interest and earnings on invested county fund balances.`,
      `Revenue earned from investing idle county funds in approved instruments such as Treasury bills, certificates of deposit, and money market accounts. Indiana law restricts public fund investments to safe, liquid instruments.`,
      ['investments', 'interest', 'earnings', 'revenue']);
  }

  // Federal grants
  if (nl.includes('federal grant') || nl.includes('federal aid')) {
    return desc('Federal Grants',
      `Federal grant funding received by Monroe County.`,
      `Revenue from various federal grant programs passed through state agencies or received directly. Federal grants often fund specific programs in public health, law enforcement, transportation, or social services with matching or reporting requirements.`,
      ['federal', 'grants', 'intergovernmental']);
  }

  // State grants
  if (nl.includes('state grant') || nl.includes('state aid')) {
    return desc('State Grants',
      `State grant funding received by Monroe County.`,
      `Revenue from Indiana state grant programs supporting specific county functions. State grants may fund public health, courts, highways, or other mandated services with specific eligibility and reporting requirements.`,
      ['state', 'grants', 'intergovernmental']);
  }

  // Charges for services
  if (nl.includes('charges for') || nl.includes('user fee') || nl.includes('fees collected')) {
    return desc('Service Fees',
      `Fees collected for government services provided to the public.`,
      `Revenue from fees charged for specific government services such as building permits, court filings, recording fees, park reservations, or inspection services. User fees help offset the cost of providing these services.`,
      ['fees', 'charges', 'services', 'revenue']);
  }

  // Fines and forfeitures
  if (nl.includes('fines') || nl.includes('forfeit')) {
    return desc('Fines & Forfeitures',
      `Revenue from court fines, penalties, and forfeitures.`,
      `Revenue collected from criminal and civil fines, traffic violations, code enforcement penalties, and asset forfeitures. These funds are typically distributed according to state statute among various government funds.`,
      ['fines', 'penalties', 'courts', 'revenue']);
  }

  // Licenses and permits
  if (nl.includes('license') || nl.includes('permit')) {
    return desc('Licenses & Permits',
      `Revenue from licenses and permits issued by the county.`,
      `Revenue collected from issuing various licenses and permits including building permits, health permits, business licenses, and other regulatory approvals required by county ordinance or state law.`,
      ['licenses', 'permits', 'regulatory', 'revenue']);
  }

  // Transfers in
  if (nl.includes('transfer') && (nl.includes('in') || nl.includes('from'))) {
    return desc('Fund Transfers In',
      `Transfers received from other county funds.`,
      `Revenue representing transfers from other county funds. These are internal movements of money between funds, not new revenue. Transfers are used to move resources where they are needed or to meet fund balance requirements.`,
      ['transfers', 'internal', 'fund balance']);
  }

  // Generic revenue fallback with parent context
  if (parentName) {
    return desc(`${shortDept(parentName)} Revenue`,
      `Revenue collected for the ${parentName} fund.`,
      `This represents revenue received by the ${parentName} fund of Monroe County government. Revenue sources may include taxes, fees, grants, or transfers depending on the fund's purpose and legal authorization.`,
      ['revenue', 'fund', 'collections'],
      'medium');
  }

  // Generic top-level revenue
  return desc('County Revenue',
    `Revenue collected by Monroe County government.`,
    `This represents a revenue source for Monroe County, Indiana. Specific details depend on the fund and revenue classification. County revenues include property taxes, income taxes, state distributions, fees, and intergovernmental transfers.`,
    ['revenue', 'county', 'collections'],
    'medium');
}

// ─── Subcategory Description Generator ───────────────────────────────────────

function generateSubcategoryDescription(name, parentName, nl, pl) {
  // Line item types under any department
  if (nl === 'services and charges' || nl === 'other services and charges') {
    return generateDescription(name, parentName, 'operating'); // handled above
  }
  if (nl === 'supplies') return generateDescription(name, parentName, 'operating');
  if (nl === 'capital outlays' || nl === 'capital outlay') return generateDescription(name, parentName, 'operating');

  // ── County Departments under County General ──

  if (pl === 'county general') {
    return generateCountyGeneralSubcategory(name, nl);
  }

  // ── Education subcategories ──
  if (pl === 'education' || pl === 'education fund' || pl === 'operations' || pl === 'operations fund') {
    return generateEducationSubcategory(name, parentName, nl, pl);
  }

  // ── Debt Service subcategories ──
  if (pl.includes('debt service')) {
    return desc(`${shortDept(name)} Debt Payments`,
      `Debt service payments for ${name}.`,
      `This covers principal and interest payments on bonds or other debt obligations for ${name}. Debt service funds are legally restricted to making scheduled payments to bondholders and cannot be used for other purposes.`,
      ['debt', 'bonds', 'payments', 'finance']);
  }

  // ── Highway subcategories ──
  if (pl.includes('highway') || pl.includes('motor vehicle') || pl.includes('local road')) {
    return desc(`${shortDept(parentName)} — ${name}`,
      `${name} expenditures within the ${parentName} fund.`,
      `Operating costs for ${name} within Monroe County's ${parentName} fund. Highway and road funds pay for construction, maintenance, snow removal, and administration of county roads and bridges.`,
      ['roads', 'highway', 'transportation', 'infrastructure']);
  }

  // ── Self-Insurance / Workers Comp subcategories ──
  if (pl.includes('self-insurance') || pl.includes('self insurance') || pl.includes('workers comp')) {
    return desc(`${shortDept(parentName)} — ${name}`,
      `${name} costs within the county's self-insurance program.`,
      `Expenditures for ${name} within Monroe County's self-insurance fund. The county self-insures certain employee benefits and liability risks, pooling premiums and paying claims from this fund rather than purchasing commercial insurance.`,
      ['insurance', 'self-insurance', 'benefits', 'risk management']);
  }

  // ── Special Fire subcategories ──
  if (pl.includes('fire') || pl.includes('special fire')) {
    return desc(`Fire District — ${name}`,
      `${name} expenditures for the Monroe County fire protection district.`,
      `Costs for ${name} within Monroe County's fire protection district fund. Special fire districts provide fire suppression, rescue, and emergency services to unincorporated areas of the county.`,
      ['fire', 'emergency', 'public safety']);
  }

  // ── Referendum Fund subcategories ──
  if (pl.includes('referendum')) {
    return desc(`School Referendum — ${name}`,
      `${name} costs funded by the voter-approved school referendum levy.`,
      `Expenditures for ${name} paid from the voter-approved referendum fund. Indiana school corporations can seek voter approval for additional property tax levies to supplement state funding. Monroe County voters have approved referendum levies to support MCCSC operations.`,
      ['referendum', 'schools', 'education', 'voter-approved']);
  }

  // ── Solid Waste subcategories ──
  if (pl.includes('solid waste')) {
    return desc(`Solid Waste — ${name}`,
      `${name} costs for Monroe County's solid waste management.`,
      `Expenditures for ${name} within the solid waste management fund. This fund supports recycling programs, landfill operations, hazardous waste disposal, and environmental compliance for Monroe County's waste management district.`,
      ['solid waste', 'recycling', 'environment', 'waste management']);
  }

  // ── Convention/Visitors subcategories ──
  if (pl.includes('convention') || pl.includes('visitor') || pl.includes('tourism')) {
    return desc(`Tourism — ${name}`,
      `${name} costs for Monroe County's convention and visitors operations.`,
      `Expenditures for ${name} within the convention and visitors fund. Funded primarily by innkeepers tax and food & beverage tax, this supports tourism promotion, convention center operations, and visitor services for Monroe County.`,
      ['tourism', 'convention', 'visitors', 'economic development']);
  }

  // ── Park subcategories ──
  if (pl.includes('park')) {
    return desc(`Parks — ${name}`,
      `${name} costs for Monroe County parks and recreation.`,
      `Expenditures for ${name} within Monroe County's parks and recreation fund. County parks maintain trails, nature preserves, and recreational facilities for public use.`,
      ['parks', 'recreation', 'outdoors']);
  }

  // ── LIT subcategories ──
  if (pl.includes('lit ') || pl.includes('local income tax') || pl.includes('loit')) {
    return desc(`Income Tax Fund — ${name}`,
      `${name} expenditures from the Local Income Tax fund.`,
      `Costs for ${name} paid from Monroe County's Local Income Tax (LIT) fund. Indiana's LIT is collected by the state and distributed to counties for designated purposes including public safety, economic development, and property tax relief.`,
      ['LIT', 'income tax', 'local tax']);
  }

  // ── Cumulative funds subcategories ──
  if (pl.includes('cumulative')) {
    return desc(`Cumulative Fund — ${name}`,
      `${name} expenditures from the cumulative capital fund.`,
      `Costs for ${name} paid from Monroe County's cumulative fund. Cumulative funds in Indiana are restricted-purpose property tax levies that accumulate over time for capital improvements, bridges, or fire equipment.`,
      ['cumulative', 'capital', 'restricted fund']);
  }

  // ── ARPA subcategories ──
  if (pl.includes('arpa') || pl.includes('american rescue') || pl.includes('rescue plan')) {
    return desc(`ARPA — ${name}`,
      `${name} expenditures from federal ARPA COVID relief funds.`,
      `Costs for ${name} paid from American Rescue Plan Act (ARPA) funds. Monroe County received federal ARPA allocations to address COVID-19 impacts, support public health, replace lost revenue, and invest in infrastructure.`,
      ['ARPA', 'COVID', 'federal', 'relief']);
  }

  // ── General/generic subcategory fallback ──
  return desc(`${shortDept(parentName)} — ${name}`,
    `${name} expenditures within ${parentName}.`,
    `This covers ${name} costs within the ${parentName} fund or department of Monroe County government. The specific purpose depends on the parent fund's authorization and the nature of these expenditures.`,
    ['operating', 'county government'],
    'medium');
}

// ─── County General Department Descriptions ──────────────────────────────────

function generateCountyGeneralSubcategory(name, nl) {
  // Sheriff / Jail
  if (nl === 'jail' || nl === 'county jail') {
    return desc('County Jail Operations',
      'Operating costs for the Monroe County Jail.',
      'The Monroe County Jail houses inmates awaiting trial, serving short sentences, or being held for other jurisdictions. Operations include inmate housing, food service, medical care, security staffing, and facility maintenance. The jail is operated by the Monroe County Sheriff.',
      ['jail', 'corrections', 'public safety', 'sheriff']);
  }
  if (nl === 'county sheriff' || nl === 'sheriff') {
    return desc('County Sheriff',
      'Operating budget for the Monroe County Sheriff\'s Office.',
      'The Monroe County Sheriff is an elected official responsible for law enforcement in unincorporated areas, county jail operations, court security, civil process service, and warrant execution. The Sheriff also provides mutual aid to Bloomington Police and other agencies.',
      ['sheriff', 'law enforcement', 'public safety']);
  }

  // Courts
  if (nl.includes('county courts') || nl.includes('unified courts') || nl.includes('court schedu')) {
    return desc('County Courts',
      'Operating costs for Monroe County\'s unified court system.',
      'Monroe County operates a unified court system including Circuit Court and multiple Superior Courts. Courts handle criminal cases, civil litigation, family law, juvenile matters, and small claims. Court operations include judges, clerks, bailiffs, and administrative staff.',
      ['courts', 'judiciary', 'justice']);
  }

  // Commissioners
  if (nl === 'county commissioners' || nl.includes('commissioners')) {
    return desc('County Commissioners',
      'Operating budget for the Monroe County Board of Commissioners.',
      'The three-member Board of Commissioners serves as the executive branch of Monroe County government. Commissioners oversee county departments, approve contracts, manage county property, and set policy. They are elected to four-year staggered terms.',
      ['commissioners', 'executive', 'administration', 'elected officials']);
  }

  // Council
  if (nl === 'county council') {
    return desc('County Council',
      'Operating budget for the Monroe County Council.',
      'The seven-member County Council is the fiscal body of Monroe County government. The Council approves the annual budget, sets tax rates, authorizes appropriations, and provides financial oversight. Members are elected — four from districts and three at-large.',
      ['council', 'legislature', 'fiscal body', 'elected officials']);
  }

  // Clerk
  if (nl.includes('clerk of circuit') || nl.includes('county clerk') || nl === 'clerk') {
    return desc('County Clerk',
      'Operating budget for the Monroe County Clerk\'s office.',
      'The County Clerk is an elected official who serves as clerk of the circuit court, manages court records, issues marriage licenses, and administers elections. The Clerk\'s office maintains vital records and processes court filings for the county.',
      ['clerk', 'courts', 'elections', 'records', 'elected officials']);
  }

  // Auditor
  if (nl === 'county auditor' || nl === 'auditor') {
    return desc('County Auditor',
      'Operating budget for the Monroe County Auditor\'s office.',
      'The County Auditor is an elected official who serves as the county\'s chief financial officer. The Auditor\'s office manages property tax billing, payroll, accounts payable, and financial reporting. The Auditor also distributes tax collections to all taxing units.',
      ['auditor', 'finance', 'property tax', 'elected officials']);
  }

  // Treasurer
  if (nl === 'county treasurer' || nl === 'treasurer') {
    return desc('County Treasurer',
      'Operating budget for the Monroe County Treasurer\'s office.',
      'The County Treasurer is an elected official responsible for collecting property taxes, investing county funds, and managing the county\'s cash flow. The Treasurer also conducts tax sales on delinquent properties.',
      ['treasurer', 'tax collection', 'finance', 'elected officials']);
  }

  // Recorder
  if (nl === 'county recorder' || nl === 'recorder' || nl.includes('recorder')) {
    return desc('County Recorder',
      'Operating budget for the Monroe County Recorder\'s office.',
      'The County Recorder is an elected official who records and maintains public records including deeds, mortgages, liens, and other legal documents related to real property. Recording fees fund office operations.',
      ['recorder', 'records', 'property', 'elected officials']);
  }

  // Assessor
  if (nl.includes('assessor')) {
    return desc('County Assessor',
      'Operating budget for the Monroe County Assessor\'s office.',
      'The County Assessor is an elected official responsible for determining the assessed value of all real and personal property in the county for property tax purposes. The office conducts reassessments, processes appeals, and maintains property records.',
      ['assessor', 'property tax', 'valuation', 'elected officials']);
  }

  // Coroner
  if (nl === 'county coroner' || nl === 'coroner') {
    return desc('County Coroner',
      'Operating budget for the Monroe County Coroner\'s office.',
      'The County Coroner is an elected official who investigates deaths that are sudden, violent, or of unknown cause. The Coroner determines cause and manner of death, authorizes autopsies, and identifies decedents.',
      ['coroner', 'death investigation', 'public safety', 'elected officials']);
  }

  // Surveyor
  if (nl === 'county surveyor' || nl === 'surveyor') {
    return desc('County Surveyor',
      'Operating budget for the Monroe County Surveyor\'s office.',
      'The County Surveyor is an elected official responsible for maintaining survey records, reviewing subdivision plats, overseeing regulated drains, and managing stormwater drainage. The Surveyor also serves on the Drainage Board.',
      ['surveyor', 'drainage', 'land records', 'elected officials']);
  }

  // Prosecutor
  if (nl === 'prosecuting attorney' || nl === 'prosecutor') {
    return desc('County Prosecutor',
      'Operating budget for the Monroe County Prosecuting Attorney\'s office.',
      'The Prosecuting Attorney is an elected official who prosecutes criminal cases, represents the state in juvenile proceedings, enforces child support, and advises county government. The office handles felonies, misdemeanors, and infractions.',
      ['prosecutor', 'criminal justice', 'law enforcement', 'elected officials']);
  }

  // Public Defender
  if (nl === 'public defender') {
    return desc('Public Defender',
      'Operating budget for court-appointed defense attorneys in Monroe County.',
      'The Public Defender office provides legal representation to individuals who cannot afford private attorneys in criminal and juvenile cases. Indiana counties are required to provide indigent defense services. Monroe County operates a dedicated public defender office.',
      ['public defender', 'courts', 'justice', 'legal services']);
  }

  // Probation
  if (nl === 'probation' || nl.includes('probation dept')) {
    return desc('Probation Department',
      'Operating budget for Monroe County\'s probation services.',
      'The Probation Department supervises individuals placed on probation by the courts, provides pre-sentence investigations, monitors compliance with court orders, and connects offenders with rehabilitation services. Probation serves both adult and juvenile courts.',
      ['probation', 'courts', 'justice', 'rehabilitation']);
  }

  // Health
  if (nl === 'health' || nl === 'health department' || nl.includes('health dept')) {
    return desc('Health Department',
      'Operating budget for the Monroe County Health Department.',
      'The Monroe County Health Department provides public health services including disease surveillance, immunizations, food safety inspections, environmental health, vital records, and health education. The department protects community health through prevention and response.',
      ['health', 'public health', 'prevention']);
  }

  // EMA / Emergency Management
  if (nl.includes('emergency management') || nl === 'ema' || nl.includes('civil defense')) {
    return desc('Emergency Management',
      'Operating budget for Monroe County Emergency Management Agency.',
      'The Monroe County Emergency Management Agency (EMA) coordinates disaster preparedness, response, and recovery. EMA maintains the county\'s emergency operations plan, conducts exercises, and coordinates with federal and state emergency agencies.',
      ['emergency', 'disaster', 'public safety', 'preparedness']);
  }

  // Veterans
  if (nl.includes('veteran')) {
    return desc('Veterans Services',
      'Operating budget for Monroe County Veterans Service Officer.',
      'The Veterans Service Officer helps veterans and their families access federal and state benefits including disability compensation, healthcare, education, and burial benefits. This is a state-mandated county service.',
      ['veterans', 'benefits', 'social services']);
  }

  // Plan Commission / Planning
  if (nl.includes('plan commission') || nl.includes('planning')) {
    return desc('Planning Department',
      'Operating budget for Monroe County Plan Commission and planning staff.',
      'The Plan Commission and planning department review zoning requests, subdivision proposals, and comprehensive land use plans for unincorporated Monroe County. Planning staff provide technical analysis and recommendations to the Commission and Board of Zoning Appeals.',
      ['planning', 'zoning', 'land use', 'development']);
  }

  // County Buildings
  if (nl === 'county buildings' || nl.includes('building department')) {
    return desc('County Buildings',
      'Maintenance and operation of Monroe County government buildings.',
      'This covers maintenance, utilities, custodial services, and repairs for county government buildings including the courthouse, justice building, and other county-owned facilities. Building operations ensure safe, functional workspaces for county employees and the public.',
      ['buildings', 'facilities', 'maintenance']);
  }

  // Cooperative Extension
  if (nl.includes('cooperative extension') || nl.includes('extension service')) {
    return desc('Cooperative Extension',
      'Operating budget for the Purdue Extension Monroe County office.',
      'The Cooperative Extension Service is a partnership between Monroe County and Purdue University providing research-based education in agriculture, 4-H youth development, nutrition, and community development. County funds support local office operations and staff.',
      ['extension', 'education', 'agriculture', '4-H']);
  }

  // Human Relations / Social Services
  if (nl.includes('human relation') || nl.includes('social s') || nl.includes('council on a')) {
    return desc('Human Relations',
      'Operating budget for Monroe County human relations and social services.',
      'This funds social services and human relations programs within Monroe County government, which may include community assistance, diversity and inclusion initiatives, and coordination with social service agencies serving county residents.',
      ['social services', 'human relations', 'community']);
  }

  // Data Processing / IT
  if (nl.includes('data processing') || nl.includes('computers') || nl.includes('information tech')) {
    return desc('Information Technology',
      'IT and computing services for Monroe County government.',
      'This covers computer systems, software licenses, network infrastructure, and IT support for Monroe County government offices. Data processing ensures county departments have the technology needed for modern government operations.',
      ['IT', 'technology', 'computers']);
  }

  // Election
  if (nl.includes('election') || nl.includes('registration')) {
    return desc('Elections & Voter Registration',
      'Operating costs for Monroe County elections and voter registration.',
      'This funds the administration of elections including polling places, voting equipment, ballot printing, poll workers, and voter registration services. The County Clerk oversees elections with support from the election board.',
      ['elections', 'voting', 'democracy']);
  }

  // Law Department
  if (nl === 'law department') {
    return desc('County Legal Counsel',
      'Legal services for Monroe County government.',
      'This funds legal counsel and representation for Monroe County government, including advising county officials, drafting ordinances, reviewing contracts, and defending the county in litigation.',
      ['legal', 'attorney', 'counsel']);
  }

  // Drainage Board
  if (nl.includes('drainage')) {
    return desc('Drainage Board',
      'Operating costs for the Monroe County Drainage Board.',
      'The Drainage Board oversees regulated drains and stormwater management in Monroe County. The board reviews drainage plans, maintains regulated drains, and resolves drainage disputes between property owners.',
      ['drainage', 'stormwater', 'infrastructure']);
  }

  // Animal Control
  if (nl === 'animal control') {
    return desc('Animal Control',
      'Operating budget for Monroe County Animal Control.',
      'Animal Control enforces county animal ordinances, responds to stray and dangerous animal complaints, investigates animal cruelty cases, and manages the county animal shelter. Officers also assist with wildlife-related emergencies.',
      ['animal control', 'public safety', 'animal welfare']);
  }

  // Weights & Measures
  if (nl.includes('weights') || nl.includes('measures')) {
    return desc('Weights & Measures',
      'Operating costs for Monroe County Weights & Measures inspection.',
      'The Weights & Measures Inspector verifies the accuracy of commercial scales, fuel pumps, and measuring devices used in commerce to protect consumers from inaccurate measurements. This is a state-mandated county function.',
      ['consumer protection', 'inspection', 'commerce']);
  }

  // EMS
  if (nl === 'ems' || nl.includes('emergency medical')) {
    return desc('Emergency Medical Services',
      'Operating budget for Monroe County Emergency Medical Services.',
      'EMS provides ambulance and emergency medical response services for Monroe County. Paramedics and EMTs respond to medical emergencies, provide pre-hospital care, and transport patients to hospitals.',
      ['EMS', 'ambulance', 'emergency', 'healthcare', 'public safety']);
  }

  // 911 / PSAP
  if (nl.includes('911') || nl.includes('psap')) {
    return desc('911 Dispatch Center',
      'Operating budget for Monroe County 911 emergency dispatch.',
      'The 911 Public Safety Answering Point (PSAP) receives and dispatches emergency calls for police, fire, and EMS throughout Monroe County. Dispatchers coordinate multi-agency emergency responses.',
      ['911', 'dispatch', 'emergency', 'public safety']);
  }

  // General fallback for County General subcategories
  return desc(`${name}`,
    `Operating budget for ${name} within Monroe County General Fund.`,
    `This covers operating costs for ${name}, a department or function funded by the Monroe County General Fund. The General Fund is the county's main operating fund, supporting core government services.`,
    ['county government', 'general fund'],
    'medium');
}

// ─── Education Subcategory Descriptions ──────────────────────────────────────

function generateEducationSubcategory(name, parentName, nl, pl) {
  // General education categories
  if (nl.includes('instruction') || nl.includes('teaching')) {
    return desc('Classroom Instruction',
      `Instructional costs for ${parentName}.`,
      `This covers classroom teaching costs including teacher compensation, instructional materials, and classroom supplies within ${parentName}. Instruction is typically the largest category of school spending.`,
      ['education', 'instruction', 'teaching', 'schools']);
  }

  if (nl.includes('student support') || nl.includes('pupil services')) {
    return desc('Student Support Services',
      `Student support services within ${parentName}.`,
      `This funds counselors, social workers, psychologists, and other support staff who help students with academic, social, emotional, and behavioral needs within ${parentName}.`,
      ['education', 'student services', 'counseling', 'schools']);
  }

  if (nl.includes('administration') || nl.includes('general admin')) {
    return desc('School Administration',
      `Administrative costs for ${parentName}.`,
      `This covers administrative expenses for ${parentName} including central office staff, principals, school board operations, and management functions that support the overall operation of the school corporation.`,
      ['education', 'administration', 'schools']);
  }

  if (nl.includes('transportation')) {
    return desc('School Transportation',
      `Student transportation costs within ${parentName}.`,
      `This funds school bus operations including bus drivers, vehicle maintenance, fuel, and routing for transporting students to and from schools. Indiana school corporations are required to provide transportation within specified distance limits.`,
      ['education', 'transportation', 'buses', 'schools']);
  }

  if (nl.includes('food service') || nl.includes('lunch') || nl.includes('cafeteria')) {
    return desc('School Food Service',
      `School meal program costs within ${parentName}.`,
      `This funds school breakfast and lunch programs, including food purchases, kitchen staff, equipment, and compliance with federal nutrition standards. Revenue comes from meal sales, federal reimbursements, and state matching funds.`,
      ['education', 'food service', 'nutrition', 'schools']);
  }

  // Fallback for education subcategories
  return desc(`School — ${name}`,
    `${name} costs within ${parentName}.`,
    `This covers ${name} expenditures within ${parentName} of the Monroe County Community School Corporation (MCCSC). MCCSC serves approximately 10,000 students across Bloomington and surrounding areas.`,
    ['education', 'schools', 'MCCSC'],
    'medium');
}

// ─── Top-Level Operating Description Generator ───────────────────────────────

function generateTopLevelDescription(name, nl) {

  // ── County General ──
  if (nl === 'county general') {
    return desc('County General Fund',
      'The main operating fund for Monroe County government.',
      'The County General Fund is the primary fund supporting day-to-day county operations including the sheriff, courts, elected officials, and administrative departments. It is funded mainly by property taxes and local income tax distributions.',
      ['general fund', 'county government', 'operating']);
  }

  // ── Education / School Funds ──
  if (nl === 'education' || nl === 'education fund') {
    return desc('School Education Fund',
      'The main funding source for MCCSC classroom instruction.',
      'The Education Fund supports classroom instruction, teacher compensation, and educational programs for the Monroe County Community School Corporation (MCCSC). This is funded primarily by state tuition support based on per-pupil enrollment.',
      ['education', 'schools', 'MCCSC', 'state funding']);
  }
  if (nl === 'operations' || nl === 'operations fund') {
    return desc('School Operations Fund',
      'Operational and support costs for MCCSC schools.',
      'The Operations Fund covers non-instructional costs for MCCSC including facilities maintenance, transportation, utilities, administration, and support staff. This fund helps keep schools running day-to-day beyond classroom instruction.',
      ['education', 'operations', 'schools', 'MCCSC']);
  }
  if (nl.includes('referendum') && nl.includes('exempt')) {
    return desc('School Referendum Fund',
      'Voter-approved additional tax levy for MCCSC operations.',
      'The Referendum Fund provides additional operating revenue for MCCSC approved by Monroe County voters. Indiana law allows school corporations to seek voter approval for supplemental property tax levies beyond the state-determined rates. Referendum funds support teacher retention, programs, and operational needs.',
      ['referendum', 'schools', 'voter-approved', 'property tax']);
  }
  if (nl === 'general fund' || nl === 'general') {
    return desc('General Operating Fund',
      'General operating fund for the entity.',
      'The General Fund supports core operations and services. This is the primary unrestricted fund used for day-to-day government or organizational operations in Monroe County.',
      ['general fund', 'operating']);
  }

  // ── Debt Service ──
  if (nl === 'debt service' || nl === 'debt service fund') {
    return desc('Debt Service Fund',
      'Principal and interest payments on bonds and other debt.',
      'The Debt Service Fund is used exclusively to make scheduled payments of principal and interest on outstanding bonds and other long-term obligations. Property taxes or other dedicated revenues are levied specifically to cover these payments.',
      ['debt', 'bonds', 'finance', 'payments']);
  }
  if (nl.includes('retiremt') || nl.includes('severance bond')) {
    return desc('Retirement/Severance Bonds',
      'Debt service payments for employee retirement and severance obligations.',
      'This fund covers bond payments for obligations related to employee retirement benefits or severance packages. School corporations and governments sometimes bond these costs to spread payments over time.',
      ['debt', 'retirement', 'bonds', 'employee benefits']);
  }
  if (nl.includes('school pension debt')) {
    return desc('School Pension Debt',
      'Payments on school pension-related debt obligations.',
      'This fund covers debt payments related to school corporation pension obligations. These may include pre-1996 teacher retirement costs that were bonded by the school corporation.',
      ['debt', 'pension', 'schools', 'retirement']);
  }

  // ── Self Insurance / Workers Comp ──
  if (nl.includes('self-insurance') || nl === 'self insurance') {
    return desc('Self-Insurance Fund',
      'Employee health insurance and liability self-insurance pool.',
      'Monroe County self-insures certain employee benefits and liability risks. Premiums from county departments and employees are pooled to pay health claims, dental claims, and other covered expenses rather than purchasing commercial insurance.',
      ['insurance', 'benefits', 'employee', 'health']);
  }
  if (nl.includes('workers comp')) {
    return desc('Workers Compensation',
      'Workers compensation insurance reserve for county employees.',
      'This fund covers workers compensation claims for county employees who are injured on the job. Indiana law requires employers to provide workers compensation coverage for medical expenses and lost wages.',
      ['workers comp', 'insurance', 'employee safety']);
  }

  // ── Highway / Road Funds ──
  if (nl === 'motor vehicle highway' || nl === 'motor vehicle hwy - restricted') {
    return desc('Motor Vehicle Highway Fund',
      'State gas tax revenue distributed for county road maintenance.',
      'Motor Vehicle Highway funds come from the state\'s share of gasoline taxes and vehicle registration fees distributed to counties. These funds are restricted to road construction, maintenance, and related transportation purposes.',
      ['highways', 'roads', 'transportation', 'state distribution']);
  }
  if (nl === 'highway' || nl === 'highway special' || nl === 'county highway') {
    return desc('County Highway Fund',
      'Operating budget for the Monroe County Highway Department.',
      'The County Highway Department maintains approximately 600 miles of county roads and bridges. Responsibilities include paving, snow removal, mowing, bridge repair, and drainage. Funded by property taxes, gas tax distributions, and wheel tax.',
      ['highway', 'roads', 'maintenance', 'infrastructure']);
  }
  if (nl.includes('local road') && nl.includes('street')) {
    return desc('Local Road & Street Fund',
      'State-distributed funds for local road maintenance.',
      'The Local Road and Street Fund receives state distributions from motor vehicle fees designated for maintaining local roads. These funds supplement the Motor Vehicle Highway Fund and are restricted to road and street purposes.',
      ['roads', 'streets', 'transportation', 'state distribution']);
  }
  if (nl.includes('cumulative bridge') || nl.includes('county major bridge')) {
    return desc('Bridge Fund',
      'Dedicated fund for county bridge repair and replacement.',
      'This cumulative fund is a restricted property tax levy dedicated to bridge construction, repair, and replacement in Monroe County. Indiana allows counties to levy a specific tax rate for bridge maintenance given the high cost of bridge projects.',
      ['bridges', 'infrastructure', 'roads', 'cumulative fund']);
  }
  if (nl.includes('wheel tax') || nl.includes('surtax')) {
    return desc('Wheel Tax/Surtax',
      'Local vehicle registration surtax revenue for roads.',
      'Monroe County imposes a local wheel tax and vehicle excise surtax collected at vehicle registration. Revenue is dedicated to road and street maintenance and construction, supplementing state gas tax distributions.',
      ['wheel tax', 'roads', 'transportation', 'local tax']);
  }

  // ── LIT Funds ──
  if (nl === 'lit certified shares' || nl === 'lit - certified shares') {
    return desc('LIT Certified Shares',
      'Local Income Tax revenue distributed to Monroe County by formula.',
      'Certified Shares are the portion of Indiana\'s Local Income Tax distributed to county government by a state-determined formula based on property tax levies. This is a major revenue source funding general county operations.',
      ['LIT', 'income tax', 'revenue', 'state distribution']);
  }
  if (nl.includes('lit') && nl.includes('economic') || nl.includes('edit') || nl.includes('cedit')) {
    return desc('LIT Economic Development',
      'Local Income Tax earmarked for economic development projects.',
      'Indiana counties can dedicate a portion of Local Income Tax revenue to economic development. Monroe County uses these funds for infrastructure improvements, business development initiatives, and projects that promote economic growth.',
      ['LIT', 'economic development', 'income tax']);
  }
  if (nl.includes('lit') && nl.includes('public safety') || nl === 'public safety lit' || nl === 'public safety local income tax') {
    return desc('LIT Public Safety',
      'Local Income Tax dedicated to public safety operations.',
      'A portion of Monroe County\'s Local Income Tax is earmarked for public safety purposes including law enforcement, fire protection, emergency services, and the 911 dispatch center.',
      ['LIT', 'public safety', 'income tax', 'law enforcement']);
  }
  if (nl.includes('lit') && nl.includes('special purpose')) {
    return desc('LIT Special Purpose',
      'Local Income Tax designated for specific county purposes.',
      'Indiana allows counties to adopt a special purpose LIT rate for designated uses. Monroe County allocates these funds to specific projects or services as determined by the County Council.',
      ['LIT', 'special purpose', 'income tax']);
  }
  if (nl.includes('lit') && nl.includes('correctional') || nl.includes('lit - correctional')) {
    return desc('LIT Corrections',
      'Local Income Tax funding for correctional facilities.',
      'This Local Income Tax component funds Monroe County\'s correctional and rehabilitation facilities. Indiana allows counties to levy a specific LIT rate for jail construction, renovation, and operation.',
      ['LIT', 'corrections', 'jail', 'income tax']);
  }
  if (nl.includes('lit') && nl.includes('prop tax') || nl.includes('lit-prop tax relief')) {
    return desc('LIT Property Tax Relief',
      'Local Income Tax used to reduce property tax bills.',
      'A portion of Monroe County\'s Local Income Tax is dedicated to property tax relief. This LIT credit appears on property tax bills as a direct reduction, offsetting the property tax burden on homeowners and businesses.',
      ['LIT', 'property tax relief', 'income tax', 'tax credits']);
  }
  if (nl.includes('lit supplemental') || nl.includes('loit special')) {
    return desc('LIT Supplemental Distribution',
      'Special or supplemental Local Income Tax distribution.',
      'This represents a supplemental or special distribution of Local Income Tax revenue to Monroe County beyond the regular certified shares formula. These distributions may fund property tax replacement or other designated purposes.',
      ['LIT', 'income tax', 'supplemental', 'state distribution']);
  }

  // ── Settlement ──
  if (nl === 'settlement') {
    return desc('Property Tax Settlement',
      'Property tax collections distributed to taxing units.',
      'The Settlement fund represents property tax revenue collected by the County Auditor and Treasurer and distributed to all taxing units (county, cities, towns, townships, schools, libraries, fire districts). Settlements occur in June and December each year.',
      ['property tax', 'settlement', 'distribution', 'revenue']);
  }

  // ── Food & Beverage Tax ──
  if (nl.includes('food') && nl.includes('beverage') && nl.includes('tax')) {
    return desc('Food & Beverage Tax',
      'Local food and beverage tax revenue.',
      'Monroe County imposes a local tax on food and beverages sold by restaurants and bars. Revenue funds convention center operations, tourism promotion, and related capital improvements approved by the County Council.',
      ['food & beverage tax', 'tourism', 'local tax']);
  }

  // ── Innkeepers Tax ──
  if (nl.includes('innkeeper')) {
    return desc('Innkeepers Tax',
      'Hotel/motel lodging tax collections.',
      'The Innkeepers Tax is a local tax on hotel and motel room rentals in Monroe County. Revenue supports tourism promotion, the convention and visitors bureau, and related facilities.',
      ['innkeepers tax', 'tourism', 'hotels', 'local tax']);
  }

  // ── Convention/Visitors ──
  if (nl.includes('convention') && (nl.includes('visitor') || nl.includes('tourism'))) {
    return desc('Convention & Tourism',
      'Convention center and tourism promotion operations.',
      'This fund supports the Monroe Convention Center operations, Visit Bloomington tourism bureau, and related tourism promotion activities. Funded primarily by innkeepers tax and food & beverage tax revenue.',
      ['convention', 'tourism', 'visitors', 'economic development']);
  }
  if (nl.includes('convention center') && nl.includes('debt')) {
    return desc('Convention Center Debt',
      'Debt payments for Monroe Convention Center bonds.',
      'This fund makes principal and interest payments on bonds issued to construct or renovate the Monroe Convention Center. The debt is typically supported by innkeepers tax or food & beverage tax revenue.',
      ['convention center', 'debt', 'bonds']);
  }
  if (nl.includes('convention center') && nl.includes('operating')) {
    return desc('Convention Center Operations',
      'Operating costs for the Monroe Convention Center.',
      'This fund covers day-to-day operating expenses for the Monroe Convention Center including staffing, utilities, maintenance, and event support. The center hosts conferences, meetings, and community events.',
      ['convention center', 'operations', 'events']);
  }
  if (nl.includes('conv') && nl.includes('cap') && nl.includes('imp')) {
    return desc('Convention Center Capital',
      'Capital improvements for convention and visitor facilities.',
      'This fund supports major repairs, renovations, and improvements to the Monroe Convention Center and related visitor facilities. Capital projects are distinct from routine maintenance and typically involve significant expenditures.',
      ['convention center', 'capital', 'improvements']);
  }

  // ── Solid Waste ──
  if (nl.includes('solid waste') && nl.includes('debt')) {
    return desc('Solid Waste Debt Service',
      'Debt payments for solid waste district bonds.',
      'This fund makes principal and interest payments on bonds issued by the Monroe County Solid Waste Management District for landfill construction, recycling facilities, or other waste management infrastructure.',
      ['solid waste', 'debt', 'bonds', 'environment']);
  }
  if (nl.includes('solid waste')) {
    return desc('Solid Waste Management',
      'Operations of the Monroe County Solid Waste Management District.',
      'The Solid Waste Management District oversees waste disposal, recycling programs, household hazardous waste collection, and landfill operations for Monroe County. The district promotes waste reduction and environmental compliance.',
      ['solid waste', 'recycling', 'environment', 'waste management']);
  }

  // ── Closure/Post-Closure ──
  if (nl.includes('closure') || nl.includes('post-closure')) {
    return desc('Landfill Closure Fund',
      'Funds reserved for landfill closure and post-closure monitoring.',
      'Indiana requires solid waste districts to set aside funds for eventual landfill closure and 30 years of post-closure environmental monitoring. These reserves cover capping, groundwater monitoring, and site maintenance after the landfill stops accepting waste.',
      ['landfill', 'closure', 'environment', 'compliance']);
  }

  // ── Special Fire ──
  if (nl.includes('special fire') && nl.includes('general')) {
    return desc('Fire District Operations',
      'Operating fund for the Monroe County fire protection district.',
      'The Special Fire General Fund supports fire suppression, rescue, and emergency response services in unincorporated areas of Monroe County. Multiple volunteer and career fire departments provide coverage through the fire protection district.',
      ['fire', 'emergency', 'public safety']);
  }
  if (nl.includes('special') && nl.includes('cum') && nl.includes('fire')) {
    return desc('Fire Equipment Fund',
      'Cumulative fund for fire district capital purchases.',
      'The Special Cumulative Fire fund is a restricted property tax levy that accumulates over time for major fire equipment purchases such as fire trucks, breathing apparatus, and station improvements.',
      ['fire', 'capital', 'equipment', 'cumulative fund']);
  }

  // ── Rainy Day ──
  if (nl === 'rainy day' || nl === 'rainy day fund') {
    return desc('Rainy Day Reserve',
      'Emergency reserve fund for Monroe County.',
      'The Rainy Day Fund is a financial reserve maintained for emergencies, revenue shortfalls, or unexpected expenses. Indiana law allows local governments to maintain rainy day funds up to a percentage of their annual budget as a fiscal safety net.',
      ['rainy day', 'reserves', 'emergency', 'finance']);
  }

  // ── Cumulative Capital Development ──
  if (nl.includes('cumulative capital')) {
    return desc('Cumulative Capital Fund',
      'Property tax levy dedicated to capital improvements.',
      'The Cumulative Capital Development Fund is a restricted property tax levy that accumulates over time for major capital purchases and improvements. Indiana law authorizes this fund for buildings, equipment, and infrastructure that have a long useful life.',
      ['capital', 'cumulative fund', 'property tax', 'infrastructure']);
  }

  // ── Capital Improvement ──
  if (nl === 'capital improvement') {
    return desc('Capital Improvement Fund',
      'Fund for major capital projects and infrastructure.',
      'The Capital Improvement Fund supports major construction, renovation, and infrastructure projects for Monroe County. These are significant one-time expenditures for buildings, facilities, roads, or equipment that extend beyond normal maintenance.',
      ['capital', 'infrastructure', 'construction']);
  }

  // ── Payroll ──
  if (nl.includes('payroll clearing') || nl.includes('payroll withholding')) {
    return desc('Payroll Processing',
      'Pass-through fund for payroll deductions and processing.',
      'This is an administrative clearing account used to process payroll. Amounts withheld from employee paychecks (taxes, insurance premiums, retirement contributions) pass through this fund before being remitted to the appropriate agencies.',
      ['payroll', 'clearing', 'administrative']);
  }
  if (nl.includes('flex spending')) {
    return desc('Flexible Spending Accounts',
      'Employee flexible spending account administration.',
      'This fund manages employee Flexible Spending Account (FSA) contributions for healthcare and dependent care expenses. Employee pre-tax deductions are held here and reimbursed as eligible expenses are incurred.',
      ['FSA', 'benefits', 'employee', 'healthcare']);
  }

  // ── Clerk's Trust ──
  if (nl.includes("clerk") && nl.includes("trust")) {
    return desc("Clerk's Trust Fund",
      'Court fees and deposits held in trust by the County Clerk.',
      "The Clerk's Trust Fund holds court-ordered deposits, bail bonds, child support payments, and other fiduciary funds managed by the County Clerk. These funds are held temporarily and disbursed according to court orders or statutory requirements.",
      ['clerk', 'trust', 'courts', 'fiduciary']);
  }

  // ── Jail / Commissary ──
  if (nl === 'jail') {
    return desc('County Jail',
      'Operating costs for the Monroe County Jail.',
      'The Monroe County Jail houses inmates awaiting trial, serving sentences, or held for other jurisdictions. Operations include housing, food service, medical care, and security. The jail is operated under the Monroe County Sheriff.',
      ['jail', 'corrections', 'public safety']);
  }
  if (nl === 'jail commissary') {
    return desc('Jail Commissary',
      'Inmate commissary sales and phone revenue for the county jail.',
      'The Jail Commissary fund tracks revenue and expenses from inmate purchases (snacks, hygiene items, phone calls) at the Monroe County Jail. Net proceeds may fund jail programs, equipment, or inmate services as permitted by Indiana law.',
      ['jail', 'commissary', 'corrections']);
  }

  // ── ARPA ──
  if (nl.includes('arpa') || nl.includes('american rescue plan')) {
    return desc('ARPA COVID Relief',
      'Federal American Rescue Plan Act funds for Monroe County.',
      'Monroe County received federal ARPA funding to address COVID-19 impacts. Eligible uses include public health response, economic recovery, revenue replacement, water/sewer infrastructure, and premium pay for essential workers. Funds must be obligated by December 2024 and spent by December 2026.',
      ['ARPA', 'COVID', 'federal', 'relief']);
  }

  // ── Election Fund ──
  if (nl === 'election fund') {
    return desc('Election Administration',
      'Fund for administering Monroe County elections.',
      'This fund covers election administration costs including voting equipment, ballot printing, poll worker compensation, early voting operations, and election night reporting. Elections are administered by the County Clerk and Election Board.',
      ['elections', 'voting', 'democracy']);
  }

  // ── EMS ──
  if (nl === 'ems') {
    return desc('Emergency Medical Services',
      'Ambulance and emergency medical services for Monroe County.',
      'This fund supports Emergency Medical Services (EMS) operations including paramedic staffing, ambulance fleet maintenance, medical supplies, and emergency response. Monroe County EMS responds to medical emergencies throughout the county.',
      ['EMS', 'ambulance', 'emergency', 'healthcare']);
  }

  // ── 911 / PSAP ──
  if (nl.includes('911') || nl.includes('psap')) {
    return desc('911 Emergency Dispatch',
      'Funding for Monroe County 911 emergency dispatch services.',
      'The 911 fund supports the Public Safety Answering Point (PSAP) that receives and dispatches emergency calls for law enforcement, fire, and EMS throughout Monroe County. Funded through state 911 fees collected on phone lines.',
      ['911', 'dispatch', 'emergency', 'public safety']);
  }

  // ── Aviation / Airport ──
  if (nl === 'aviation' || nl.includes('aviation') || nl.includes('airport')) {
    return desc('County Airport',
      'Operations of the Monroe County Airport.',
      'This fund supports the Monroe County Airport (BMG) operations including runway maintenance, facility upkeep, fuel services, and airport administration. The airport serves general aviation including private, corporate, and training flights near Bloomington.',
      ['airport', 'aviation', 'transportation']);
  }

  // ── Reassessment ──
  if (nl.includes('reassessment')) {
    return desc('Property Reassessment',
      'Fund for county-wide property value reassessment.',
      'Indiana requires periodic reassessment of all property values for tax purposes. This fund covers the cost of hiring appraisers, updating property records, and processing appeals during the reassessment cycle.',
      ['reassessment', 'property tax', 'valuation']);
  }

  // ── Drug/Court specialty funds ──
  if (nl.includes('drug court') || nl.includes('drug treatment court')) {
    return desc('Drug Treatment Court',
      'Specialty court program for substance abuse cases.',
      'The Drug Treatment Court provides structured supervision, treatment, and accountability for nonviolent offenders with substance abuse disorders as an alternative to incarceration. Participants receive counseling, drug testing, and court monitoring.',
      ['drug court', 'treatment', 'courts', 'rehabilitation']);
  }
  if (nl.includes('mental health court')) {
    return desc('Mental Health Court',
      'Specialty court program for defendants with mental illness.',
      'The Mental Health Court provides structured treatment and supervision for defendants with serious mental health disorders. The program connects participants with mental health services, housing, and support as an alternative to traditional prosecution.',
      ['mental health', 'courts', 'treatment', 'rehabilitation']);
  }
  if (nl.includes('veterans court') || nl.includes('veterans treatment')) {
    return desc('Veterans Treatment Court',
      'Specialty court program for veteran defendants.',
      'The Veterans Treatment Court serves military veterans involved in the criminal justice system by connecting them with VA services, mental health treatment, substance abuse counseling, and peer mentoring. The program addresses service-related issues that may contribute to criminal behavior.',
      ['veterans', 'courts', 'treatment', 'rehabilitation']);
  }
  if (nl.includes('reentry court')) {
    return desc('Reentry Court',
      'Court program supporting prisoner reintegration into the community.',
      'The Reentry Court provides structured supervision and support services for individuals transitioning from incarceration back to the community. The program connects participants with employment, housing, education, and treatment services to reduce recidivism.',
      ['reentry', 'courts', 'rehabilitation', 'corrections']);
  }
  if (nl.includes('pretrial') && nl.includes('grant')) {
    return desc('Pretrial Services Grant',
      'Grant funding for Monroe County pretrial supervision programs.',
      'This grant funds pretrial services that assess and supervise defendants awaiting trial as an alternative to cash bail. The program uses evidence-based risk assessments to help judges make informed release decisions while ensuring public safety.',
      ['pretrial', 'courts', 'grant', 'justice reform']);
  }
  if (nl.includes('pretrial pilot')) {
    return desc('Pretrial Pilot Program',
      'Pilot program for pretrial defendant assessment and supervision.',
      'This pilot program tests evidence-based pretrial practices to improve the fairness and effectiveness of the pretrial process in Monroe County courts. The program may include risk assessment tools, supervision protocols, and data collection.',
      ['pretrial', 'courts', 'pilot', 'justice reform']);
  }

  // ── Community Corrections ──
  if (nl.includes('community corr') || nl.includes('misdemeanant')) {
    return desc('Community Corrections',
      'Alternative sentencing and supervision programs.',
      'Monroe County Community Corrections provides alternatives to incarceration for eligible offenders including home detention, work release, community service, and day reporting. These programs reduce jail crowding while maintaining accountability.',
      ['community corrections', 'alternatives', 'rehabilitation', 'justice']);
  }

  // ── JDAI ──
  if (nl.includes('jdai')) {
    return desc('Juvenile Detention Reform',
      'Juvenile Detention Alternatives Initiative (JDAI) grant funding.',
      'JDAI is a national initiative to reduce unnecessary juvenile detention while maintaining public safety. Monroe County uses grant funding for data analysis, programming, and coordination to ensure youth are detained only when necessary.',
      ['juvenile', 'detention', 'reform', 'grant']);
  }

  // ── GAL/CASA ──
  if (nl.includes('gal') && nl.includes('casa')) {
    return desc('Child Advocate Program',
      'Court-appointed special advocates for children in abuse/neglect cases.',
      'The Guardian ad Litem/CASA program trains volunteers to serve as court-appointed advocates for children involved in abuse and neglect proceedings. Advocates investigate cases and make recommendations to the judge in the best interest of the child.',
      ['CASA', 'child welfare', 'courts', 'volunteers']);
  }

  // ── Probation user fees ──
  if (nl.includes('probation') && nl.includes('user fee')) {
    return desc('Probation User Fees',
      'Fees collected from individuals on probation supervision.',
      'Revenue from user fees charged to adults or juveniles under probation supervision. Indiana law allows probation departments to collect fees to help offset supervision costs. Fee amounts are set by the court and may be waived for indigent individuals.',
      ['probation', 'user fees', 'courts', 'revenue']);
  }

  // ── Seized Assets ──
  if (nl.includes('seized asset')) {
    return desc('Seized Assets Fund',
      'Assets seized through law enforcement forfeitures.',
      'This fund holds assets seized through criminal forfeitures and civil asset forfeiture proceedings. Indiana law restricts how forfeiture proceeds can be spent, typically limited to law enforcement equipment, training, and drug enforcement activities.',
      ['seized assets', 'forfeiture', 'law enforcement']);
  }

  // ── Donations ──
  if (nl.includes('donation')) {
    return desc('Donation Fund',
      'Charitable donations received by Monroe County.',
      'This fund holds donations and gifts received by Monroe County government or specific departments. Donations may be restricted by the donor for specific purposes or unrestricted for general use.',
      ['donations', 'gifts', 'charitable']);
  }

  // ── Opioid Settlement ──
  if (nl.includes('opioid')) {
    return desc('Opioid Settlement Funds',
      'Funds from national opioid litigation settlements.',
      'Monroe County receives funds from legal settlements with pharmaceutical manufacturers and distributors related to the opioid crisis. Indiana law requires these funds be used for opioid abatement including treatment, prevention, recovery services, and harm reduction programs.',
      ['opioid', 'settlement', 'public health', 'treatment']);
  }

  // ── Tax Sale / Surplus ──
  if (nl.includes('tax sale')) {
    return desc('Tax Sale Proceeds',
      'Revenue from county tax sale proceedings.',
      'This fund holds proceeds from the sale of tax-delinquent properties or the redemption of tax certificates. The County Treasurer conducts annual tax sales for properties with unpaid property taxes, and surplus amounts are held for property owners.',
      ['tax sale', 'property tax', 'delinquent', 'revenue']);
  }

  // ── Riverboat ──
  if (nl.includes('riverboat')) {
    return desc('Riverboat Revenue',
      'State distribution of riverboat/casino tax revenue.',
      'Indiana distributes a share of riverboat and casino tax revenue to counties. Monroe County receives these funds based on a statutory formula, and proceeds support local government operations.',
      ['riverboat', 'gaming', 'state distribution', 'revenue']);
  }

  // ── Financial Institution Tax ──
  if (nl.includes('financial institution tax')) {
    return desc('Financial Institution Tax',
      'State tax on financial institutions distributed to the county.',
      'Indiana imposes a franchise tax on financial institutions (banks, credit unions, savings associations) in lieu of property tax. Revenue is distributed to counties and other local taxing units where the institutions are located.',
      ['financial institution tax', 'banks', 'state tax', 'revenue']);
  }

  // ── Sales Disclosure ──
  if (nl.includes('sales disclosure')) {
    return desc('Sales Disclosure Fees',
      'Fees from mandatory property sales disclosure filings.',
      'Indiana requires a sales disclosure form when real property is transferred. The County Auditor collects a fee that is split between the county and the state. Revenue supports property assessment and transfer tax administration.',
      ['sales disclosure', 'property', 'fees', 'revenue']);
  }

  // ── Storm Water ──
  if (nl.includes('storm water') || nl.includes('stormwater')) {
    return desc('Stormwater Management',
      'Stormwater drainage and management services.',
      'This fund supports stormwater management including drainage infrastructure maintenance, flood control, erosion prevention, and compliance with federal Clean Water Act stormwater permits. Monroe County manages stormwater in unincorporated areas.',
      ['stormwater', 'drainage', 'environment', 'infrastructure']);
  }

  // ── Lake and River Enhancement ──
  if (nl.includes('lake and river') || nl.includes('lake & river')) {
    return desc('Lake & River Enhancement',
      'State grant program for lake and river improvement projects.',
      'The Lake and River Enhancement Program (LARE) provides state funding for projects that improve water quality in Indiana lakes and rivers. Monroe County uses these funds for watershed restoration, erosion control, and aquatic habitat improvement.',
      ['lakes', 'rivers', 'environment', 'water quality', 'grant']);
  }

  // ── Bicentennial ──
  if (nl.includes('bicentennial')) {
    return desc('Bicentennial Projects',
      'Funds for bicentennial commemoration or trail projects.',
      'This fund supports projects related to Indiana\'s bicentennial celebration or the Bicentennial Visionary Trail initiative. Projects may include trail construction, park improvements, or community commemoration activities.',
      ['bicentennial', 'trails', 'community']);
  }

  // ── Special Revenue ──
  if (nl === 'special revenue') {
    return desc('Special Revenue Fund',
      'Revenue restricted to specific designated purposes.',
      'Special Revenue Funds account for revenue that is legally restricted to expenditures for specific purposes. These funds ensure that designated revenue sources like grants, fees, or special taxes are spent only for their intended purpose.',
      ['special revenue', 'restricted', 'fund']);
  }

  // ── Operating ──
  if (nl === 'operating') {
    return desc('Operating Fund',
      'General operating expenses.',
      'This fund covers general operating expenses for the entity. Operating funds support day-to-day costs including staff, supplies, services, and routine maintenance.',
      ['operating', 'general']);
  }

  // ── BOND FUNDS (various years) ──
  if (nl.includes('go bond') || nl.includes('g.o. bond') || nl.includes('g o bond')) {
    return desc('General Obligation Bonds',
      `Bond proceeds or debt service for ${name}.`,
      `This fund tracks proceeds from General Obligation bonds issued by Monroe County or the school corporation, or makes debt service payments on outstanding GO bonds. GO bonds are backed by the full taxing power of the issuing entity and typically fund major capital projects.`,
      ['bonds', 'debt', 'capital', 'finance']);
  }
  if (nl.includes('redevelopment bond')) {
    return desc('Redevelopment Bonds',
      `Bond proceeds for Monroe County redevelopment projects.`,
      `This fund holds proceeds from bonds issued by the Monroe County Redevelopment Commission for economic development and infrastructure projects. These bonds are typically repaid from Tax Increment Financing (TIF) revenue within designated redevelopment areas.`,
      ['bonds', 'redevelopment', 'TIF', 'economic development']);
  }
  if (nl.includes('ban') && (nl.includes('capital') || nl.includes('airport') || nl.includes('debt'))) {
    return desc('Bond Anticipation Notes',
      `Short-term borrowing in anticipation of long-term bond issuance.`,
      `Bond Anticipation Notes (BANs) are short-term borrowing instruments used to fund capital projects before permanent bond financing is arranged. BANs are typically refinanced with long-term bonds within one to two years.`,
      ['BAN', 'bonds', 'short-term', 'capital']);
  }
  if (nl.includes('bridge improvement bond') || nl.includes('bridge') && nl.includes('bond')) {
    return desc('Bridge Improvement Bonds',
      'Bond proceeds for county bridge repairs and replacements.',
      'This fund holds proceeds from bonds issued specifically for bridge improvement projects in Monroe County. Bridge bonds fund major repair, rehabilitation, or replacement of structurally deficient or weight-restricted bridges.',
      ['bridges', 'bonds', 'infrastructure']);
  }
  if (nl.includes('6m branch bond') || nl.includes('2m g o bond')) {
    return desc('Library Bond Fund',
      `Bond proceeds for Monroe County Public Library construction.`,
      `This fund holds proceeds from bonds issued for Monroe County Public Library construction or renovation projects. Library bonds fund new branch construction, major renovations, or expansion of library facilities.`,
      ['library', 'bonds', 'construction']);
  }
  if (nl.includes('bridge inspection')) {
    return desc('Bridge Inspection',
      'Mandated bridge safety inspection program.',
      'Federal law requires regular inspection of all public bridges. This fund covers the cost of conducting bridge safety inspections in Monroe County, identifying structural deficiencies, and determining load ratings and repair needs.',
      ['bridges', 'inspection', 'safety', 'infrastructure']);
  }

  // ── TIF ──
  if (nl.includes('tif') || nl.includes('econ dev') && nl.includes('twp')) {
    return desc('TIF District',
      'Tax Increment Financing district for economic development.',
      'This Tax Increment Financing (TIF) district captures the growth in property tax revenue within a designated area to fund infrastructure improvements and economic development projects. The incremental tax revenue above the base year is used for approved redevelopment purposes.',
      ['TIF', 'economic development', 'redevelopment', 'property tax']);
  }

  // ── Road/Bridge Construction Projects ──
  if (nl.includes('bridge') && !nl.includes('bond') && !nl.includes('inspection') && !nl.includes('cumulative')) {
    return desc(`Bridge Project — ${name}`,
      `Capital project for ${name} bridge work.`,
      `This fund tracks costs for a specific bridge construction, repair, or replacement project in Monroe County. Bridge projects are typically funded through cumulative bridge funds, bonds, or state/federal aid.`,
      ['bridge', 'construction', 'infrastructure', 'capital project']);
  }
  if (nl.includes('pike') || nl.includes('road') && nl.includes('phase') || nl.includes('sample road') || nl.includes('hunters creek')) {
    return desc(`Road Project — ${name}`,
      `Capital project for ${name} road construction or improvement.`,
      `This fund tracks costs for a specific road construction or improvement project in Monroe County. Road projects may include new construction, widening, resurfacing, or intersection improvements.`,
      ['road', 'construction', 'infrastructure', 'capital project']);
  }
  if (nl.includes('pedestrian') || nl.includes('pathway') || nl.includes('trail')) {
    return desc(`Trail/Pathway Project`,
      `Construction or improvement of pedestrian/cycling infrastructure.`,
      `This fund supports construction of trails, pathways, sidewalks, or other pedestrian and cycling infrastructure in Monroe County. These projects improve non-motorized transportation options and recreational access.`,
      ['trails', 'pedestrian', 'cycling', 'infrastructure']);
  }

  // ── COVID / Emergency Funds ──
  if (nl.includes('covid') || nl.includes('cares') || nl.includes('coronavirus')) {
    return desc('COVID Response Fund',
      `Funding for COVID-19 pandemic response and recovery.`,
      `This fund tracks expenditures or revenue related to COVID-19 pandemic response. Funds may come from federal CARES Act, FEMA, or other emergency programs and cover public health measures, economic assistance, and operational adaptations.`,
      ['COVID', 'pandemic', 'emergency', 'federal']);
  }

  // ── ESSER (schools) ──
  if (nl.includes('esser')) {
    return desc('School COVID Relief (ESSER)',
      'Federal ESSER funds for school pandemic recovery.',
      'Elementary and Secondary School Emergency Relief (ESSER) funds are federal grants to support school COVID-19 response. Uses include learning loss recovery, ventilation upgrades, technology for remote learning, mental health support, and staffing.',
      ['ESSER', 'COVID', 'education', 'federal']);
  }

  // ── FOOD SERVICE FUND (schools) ──
  if (nl === 'food service fund') {
    return desc('School Food Service',
      'School breakfast and lunch program operations.',
      'The Food Service Fund supports school meal programs for MCCSC students including breakfast, lunch, and after-school snacks. Revenue comes from student meal payments, federal reimbursements (National School Lunch Program), and state matching funds.',
      ['food service', 'schools', 'nutrition', 'MCCSC']);
  }

  // ── TEXTBOOK RENTAL ──
  if (nl.includes('textbook') || nl.includes('text book')) {
    return desc('Textbook Rental',
      'School textbook purchase and rental program.',
      'Indiana school corporations operate textbook rental programs where parents pay annual fees to rent textbooks and curriculum materials. The fund purchases new textbooks and manages the rental inventory. Fee waivers are available for qualifying families.',
      ['textbooks', 'schools', 'education', 'MCCSC']);
  }

  // ── SCHOOL ASSISTANCE FUND ──
  if (nl === 'school assistance fund') {
    return desc('School Assistance Fund',
      'State-provided school assistance funding.',
      'The School Assistance Fund receives state appropriations to supplement school corporation operations. These funds may support specific state education initiatives or provide additional operational flexibility beyond the tuition support formula.',
      ['education', 'state funding', 'schools']);
  }

  // ── PREPAID SCHOOL LUNCH ──
  if (nl.includes('prepaid school lunch') || nl.includes('prepaid lunch')) {
    return desc('Prepaid Lunch Accounts',
      'Prepaid student lunch account balances.',
      'This fund holds prepaid balances from families who pay in advance for school meals. Funds are drawn down as students purchase meals, ensuring smooth cafeteria operations.',
      ['food service', 'prepaid', 'schools']);
  }

  // ── School Grants (Title I, II, III, IV, etc.) ──
  if (nl.includes('title i')) {
    return desc('Title I Federal Grant',
      'Federal funding for schools with high percentages of low-income students.',
      'Title I of the Every Student Succeeds Act provides federal funding to schools with significant populations of economically disadvantaged students. Funds support supplemental instruction, tutoring, professional development, and parent engagement to help close achievement gaps.',
      ['Title I', 'federal grant', 'education', 'low-income']);
  }
  if (nl.includes('title ii')) {
    return desc('Title II Federal Grant',
      'Federal funding for teacher quality and professional development.',
      'Title II Part A provides federal funding to improve teacher and principal quality through professional development, recruitment, and retention. School corporations use these funds for training, mentoring, and class size reduction.',
      ['Title II', 'federal grant', 'education', 'teacher quality']);
  }
  if (nl.includes('title iii')) {
    return desc('Title III Federal Grant',
      'Federal funding for English language learner programs.',
      'Title III provides federal funding for English Language Learner (ELL) instruction and immigrant student programs. Funds support language acquisition, bilingual education, and supplemental services for students with limited English proficiency.',
      ['Title III', 'federal grant', 'education', 'English learners']);
  }
  if (nl.includes('title iv')) {
    return desc('Title IV Federal Grant',
      'Federal funding for student support and academic enrichment.',
      'Title IV Part A provides federal funding for well-rounded education programs, safe and healthy school initiatives, and effective use of technology. Funds support STEM, arts, college preparation, and school safety programs.',
      ['Title IV', 'federal grant', 'education', 'enrichment']);
  }

  // ── IDEA / Special Education ──
  if (nl.includes('idea') || nl.includes('special educ') || nl.includes('sped') || nl.includes('sp ed')) {
    return desc('Special Education Grant',
      'Federal IDEA funding for special education services.',
      'The Individuals with Disabilities Education Act (IDEA) provides federal grants to support special education and related services for students with disabilities. Funds cover specialized instruction, evaluations, therapies, and compliance with individualized education programs (IEPs).',
      ['special education', 'IDEA', 'federal grant', 'disabilities']);
  }

  // ── Perkins / CTE ──
  if (nl.includes('perkins') || nl.includes('carl perkins') || nl.includes('career ladder') || nl.includes('cte')) {
    return desc('Career & Technical Education',
      'Federal/state funding for career and technical education programs.',
      'The Carl D. Perkins Act provides federal funding for career and technical education (CTE) programs in schools. Funds support vocational training, equipment, curriculum development, and industry certifications for high school students.',
      ['CTE', 'Perkins', 'education', 'vocational', 'federal grant']);
  }

  // ── 21st Century Community Learning Centers ──
  if (nl.includes('21st c') || nl.includes('21st century')) {
    return desc('21st Century Learning Centers',
      'Federal grant for after-school and summer enrichment programs.',
      'The 21st Century Community Learning Centers program provides federal grants for before-school, after-school, and summer programs. These centers offer academic enrichment, tutoring, recreation, and youth development activities for students in high-poverty schools.',
      ['21st Century', 'after-school', 'education', 'federal grant']);
  }

  // ── Adult Education ──
  if (nl.includes('adult ed') || nl.includes('abe ') || nl.includes('ae ')) {
    return desc('Adult Education Program',
      'Adult literacy, GED, and workforce education programs.',
      'Adult education programs provide basic literacy instruction, high school equivalency (HSE/GED) preparation, English language classes, and workforce training for adults. Programs are funded by federal Workforce Innovation and Opportunity Act (WIOA) grants and state matching funds.',
      ['adult education', 'literacy', 'GED', 'workforce']);
  }

  // ── McKinney-Vento ──
  if (nl.includes('mckinney') || nl.includes('homeless grant')) {
    return desc('Homeless Student Services',
      'Federal funding for services to homeless students.',
      'The McKinney-Vento Act provides federal grants to ensure homeless children and youth have equal access to education. Funds support enrollment assistance, transportation, school supplies, tutoring, and referrals to health and social services.',
      ['homeless', 'education', 'federal grant', 'student services']);
  }

  // ── On My Way Pre-K ──
  if (nl.includes('on my way pre-k')) {
    return desc('Pre-K Voucher Program',
      'Indiana\'s state-funded pre-kindergarten program.',
      'On My Way Pre-K is Indiana\'s state-funded preschool program providing vouchers for eligible four-year-old children from low-income families to attend quality early childhood programs. The program prepares children for kindergarten readiness.',
      ['pre-K', 'early childhood', 'education', 'state program']);
  }

  // ── Early Learning / Preschool ──
  if (nl.includes('early learning') || nl.includes('preschool') && !nl.includes('sped')) {
    return desc('Early Learning Programs',
      'Preschool and early childhood education programs.',
      'Early learning programs provide preschool education for young children in Monroe County. These programs focus on kindergarten readiness, social-emotional development, and early literacy through age-appropriate instruction and activities.',
      ['preschool', 'early learning', 'education']);
  }

  // ── High Ability / Gifted ──
  if (nl.includes('high ability') || nl.includes('gifted')) {
    return desc('High Ability Education',
      'Programs for gifted and high-ability students.',
      'Indiana requires school corporations to provide differentiated education for identified high-ability students. These state-funded programs offer advanced curriculum, enrichment activities, and specialized instruction to meet the needs of academically gifted learners.',
      ['gifted', 'high ability', 'education', 'state funding']);
  }

  // ── School Safety ──
  if (nl.includes('school safety')) {
    return desc('School Safety Grant',
      'State funding for school security measures.',
      'Indiana provides grants for school safety improvements including security equipment, school resource officers, threat assessment teams, and safety training. These funds help schools implement safety plans and respond to security threats.',
      ['school safety', 'security', 'education', 'grant']);
  }

  // ── Dual Language Immersion ──
  if (nl.includes('dual language') || nl.includes('dli')) {
    return desc('Dual Language Immersion',
      'Bilingual education program funding.',
      'The Dual Language Immersion program provides instruction in both English and a partner language (typically Spanish). Students develop biliteracy and cross-cultural competency while meeting all Indiana academic standards.',
      ['dual language', 'bilingual', 'education', 'immersion']);
  }

  // ── Digital Equity / Connectivity ──
  if (nl.includes('digital equity') || nl.includes('connectivity grant') || nl.includes('digital learning')) {
    return desc('Digital Learning Initiative',
      'Technology and digital access program for schools or community.',
      'This fund supports digital equity and connectivity initiatives including device distribution, internet access, digital literacy training, and technology integration in education. Programs aim to close the digital divide for students and community members.',
      ['technology', 'digital equity', 'education', 'connectivity']);
  }

  // ── STEM ──
  if (nl.includes('stem') || nl.includes('pltw') || nl.includes('project lead the way')) {
    return desc('STEM Education Program',
      'Science, technology, engineering, and math education funding.',
      'STEM programs provide hands-on instruction in science, technology, engineering, and mathematics. Programs like Project Lead the Way (PLTW) offer industry-aligned curriculum in computer science, biomedical science, and engineering for K-12 students.',
      ['STEM', 'science', 'technology', 'education']);
  }

  // ── Area Vocational School ──
  if (nl.includes('area vocational') || nl.includes('vocational school')) {
    return desc('Vocational Education Fund',
      'Funding for area vocational and career-technical center programs.',
      'This fund supports the area vocational school program providing career and technical education. Students from multiple school corporations attend these programs to receive hands-on training in trades and skilled professions.',
      ['vocational', 'CTE', 'education', 'workforce']);
  }

  // ── STOP Grant (Violence Against Women) ──
  if (nl.includes('stop grant')) {
    return desc('Violence Against Women Grant',
      'Federal STOP grant for domestic violence and sexual assault services.',
      'The STOP (Services-Training-Officers-Prosecutors) Violence Against Women Act grant funds law enforcement training, prosecution of domestic violence and sexual assault cases, and victim services in Monroe County.',
      ['domestic violence', 'grant', 'law enforcement', 'victim services']);
  }

  // ── VOCA ──
  if (nl.includes('voca')) {
    return desc('Crime Victim Assistance',
      'Federal funding for crime victim services.',
      'Victims of Crime Act (VOCA) grants fund direct services to crime victims including crisis intervention, counseling, legal assistance, and emergency shelter. Monroe County agencies use VOCA funds to support victim advocates and service programs.',
      ['crime victims', 'VOCA', 'grant', 'victim services']);
  }

  // ── JAG ──
  if (nl.includes('jag')) {
    return desc('Justice Assistance Grant',
      'Federal funding for law enforcement and justice programs.',
      'The Edward Byrne Memorial Justice Assistance Grant (JAG) provides federal funding for law enforcement, prosecution, courts, crime prevention, and corrections. Monroe County uses JAG funds for specialized law enforcement units and equipment.',
      ['JAG', 'law enforcement', 'federal grant', 'justice']);
  }

  // ── EMPG ──
  if (nl.includes('empg')) {
    return desc('Emergency Management Grant',
      'Federal Emergency Management Performance Grant.',
      'The Emergency Management Performance Grant (EMPG) provides federal funding to support state and local emergency management agencies. Monroe County uses EMPG funds for emergency management staffing, training, exercises, and planning.',
      ['EMPG', 'emergency management', 'federal grant', 'preparedness']);
  }

  // ── SAFER / AFG (Fire) ──
  if (nl.includes('safer') || nl.includes('afg')) {
    return desc('Fire Department Federal Grant',
      'FEMA fire department grant for staffing or equipment.',
      'The Staffing for Adequate Fire and Emergency Response (SAFER) and Assistance to Firefighters Grant (AFG) programs provide federal FEMA funding for fire department staffing, equipment, training, and wellness programs.',
      ['fire', 'FEMA', 'federal grant', 'staffing']);
  }

  // ── FEMA ──
  if (nl.includes('fema') && !nl.includes('safer') && !nl.includes('afg')) {
    return desc('FEMA Emergency Funds',
      'Federal Emergency Management Agency disaster relief or assistance.',
      'This fund receives FEMA reimbursements or grants for disaster response, emergency operations, or hazard mitigation activities in Monroe County.',
      ['FEMA', 'emergency', 'disaster', 'federal']);
  }

  // ── AIP (Airport Improvement) ──
  if (nl.includes('aip') || nl.includes('airport improv') || nl.includes('airport infra')) {
    return desc('Airport Improvement Grant',
      'FAA Airport Improvement Program grant for airport projects.',
      'The Airport Improvement Program (AIP) provides federal FAA grants for airport infrastructure including runway improvements, lighting, navigation aids, and safety upgrades at Monroe County Airport (BMG).',
      ['airport', 'FAA', 'federal grant', 'infrastructure']);
  }

  // ── Rural Transit ──
  if (nl.includes('rural transit') || nl.includes('community trans')) {
    return desc('Rural Transit Program',
      'Federal/state funding for rural public transportation.',
      'This program provides funding for public transportation services in rural areas of Monroe County. Transit services help residents access employment, healthcare, shopping, and social services in areas not served by regular bus routes.',
      ['transit', 'transportation', 'rural', 'federal grant']);
  }

  // ── Next Level Trails ──
  if (nl.includes('next level trail')) {
    return desc('Next Level Trails Grant',
      'Indiana state grant for regional trail construction.',
      'Next Level Trails is a state program providing grants for construction of regionally significant trail projects. Monroe County uses these funds to build multi-use trails that connect communities and recreational areas.',
      ['trails', 'state grant', 'recreation', 'infrastructure']);
  }

  // ── Health-related grants ──
  if (nl.includes('immunization') || nl.includes('imm ')) {
    return desc('Immunization Program',
      'Public health immunization and vaccination services.',
      'This fund supports the Monroe County Health Department\'s immunization programs including vaccine administration, outreach, education, and compliance with state immunization requirements for schools and childcare.',
      ['immunization', 'public health', 'vaccines', 'health']);
  }
  if (nl.includes('hiv') || nl.includes('std') || nl.includes('dis interv')) {
    return desc('Disease Prevention Program',
      'STD/HIV prevention, testing, and intervention services.',
      'This fund supports sexually transmitted disease and HIV prevention programs through the Monroe County Health Department. Services include testing, counseling, contact tracing, treatment referrals, and community education.',
      ['STD', 'HIV', 'prevention', 'public health']);
  }
  if (nl.includes('harm reduction') || nl.includes('syringe service')) {
    return desc('Harm Reduction Program',
      'Harm reduction and syringe services for public health.',
      'This program provides evidence-based harm reduction services including syringe exchange, naloxone distribution, HIV/hepatitis C testing, and connections to treatment. These services reduce disease transmission and drug overdose deaths.',
      ['harm reduction', 'public health', 'opioid', 'prevention']);
  }
  if (nl.includes('epidemiology') || nl.includes('lab')) {
    return desc('Epidemiology & Lab Services',
      'Disease surveillance and laboratory services.',
      'This fund supports epidemiological surveillance and laboratory capabilities for the Monroe County Health Department. Staff monitor disease outbreaks, analyze health data, and coordinate public health responses.',
      ['epidemiology', 'laboratory', 'public health', 'surveillance']);
  }
  if (nl.includes('public health emer') || nl.includes('emergency fund')) {
    return desc('Public Health Emergency Fund',
      'Emergency preparedness funding for public health response.',
      'Federal public health emergency preparedness grants fund the Monroe County Health Department\'s capacity to detect and respond to health emergencies including disease outbreaks, bioterrorism, and natural disasters.',
      ['emergency', 'public health', 'preparedness', 'federal grant']);
  }
  if (nl.includes('naccho')) {
    return desc('NACCHO Public Health Grant',
      'National Association of County and City Health Officials grant.',
      'NACCHO grants support local health department capacity building, quality improvement, and innovative public health practices in Monroe County.',
      ['NACCHO', 'public health', 'grant', 'capacity building']);
  }
  if (nl.includes('lead case') || nl.includes('lead ')) {
    return desc('Lead Prevention Program',
      'Lead poisoning prevention and case management.',
      'This program provides lead testing, case management, and environmental assessment for children at risk of lead poisoning. Monroe County\'s older housing stock creates elevated risk, and the program ensures affected children receive follow-up care.',
      ['lead', 'prevention', 'public health', 'children']);
  }
  if (nl.includes('baby') && nl.includes('tobacco')) {
    return desc('Tobacco Cessation Program',
      'Maternal tobacco cessation incentive program.',
      'The Baby & Me Tobacco Free program provides incentives and support for pregnant women to quit smoking. Participants receive counseling and vouchers for diapers when they remain tobacco-free through pregnancy and the postpartum period.',
      ['tobacco', 'maternal health', 'prevention', 'public health']);
  }
  if (nl.includes('vax admin') || nl.includes('vaccine')) {
    return desc('Vaccine Administration',
      'Reimbursement for vaccine administration services.',
      'This fund tracks reimbursements received for administering vaccines. Healthcare providers and public health departments can bill for the cost of administering vaccines separately from the vaccine itself.',
      ['vaccines', 'immunization', 'public health', 'reimbursement']);
  }
  if (nl.includes('futures clinic')) {
    return desc('Futures Clinic',
      'Reproductive health and family planning clinic.',
      'Futures Family Health Clinic provides reproductive healthcare, family planning services, STI testing, and preventive care. The clinic is operated by or in partnership with the Monroe County Health Department.',
      ['healthcare', 'family planning', 'public health', 'clinic']);
  }
  if (nl.includes('local health maintenance') || nl.includes('local health dept trust')) {
    return desc('Local Health Fund',
      'Local funds supporting Monroe County Health Department operations.',
      'This fund provides locally-generated revenue for Health Department operations including fees, donations, and other non-grant income. These funds supplement state and federal grants to maintain comprehensive public health services.',
      ['public health', 'local funding', 'health department']);
  }

  // ── Youth Shelter / Runaway ──
  if (nl.includes('youth shelter') || nl.includes('youth council') || nl.includes('runaway') || nl.includes('safe place')) {
    return desc('Youth Services',
      'Programs and shelter services for at-risk youth.',
      'This fund supports services for at-risk youth in Monroe County including emergency shelter, crisis intervention, runaway prevention, and youth development programs. Services provide safe environments and connect youth with supportive resources.',
      ['youth', 'shelter', 'social services', 'prevention']);
  }

  // ── IV-D (Child Support) ──
  if (nl.includes('iv-d') || nl.includes('4-d') || nl.includes('child support')) {
    return desc('Child Support Enforcement',
      'Federal/state incentive funding for child support collection.',
      'Title IV-D of the Social Security Act funds child support enforcement activities. Monroe County\'s Clerk and Prosecutor receive incentive payments based on successful child support collections, paternity establishment, and case management.',
      ['child support', 'IV-D', 'federal', 'family services']);
  }

  // ── Elder Abuse ──
  if (nl.includes('elder abuse') || nl.includes('adult protective')) {
    return desc('Adult Protective Services',
      'Services protecting vulnerable adults from abuse and neglect.',
      'This fund supports investigation and intervention for cases of adult abuse, neglect, and exploitation in Monroe County. Services protect elderly and disabled adults and connect them with protective resources.',
      ['elder abuse', 'adult protection', 'social services']);
  }

  // ── TANF ──
  if (nl.includes('tanf')) {
    return desc('Family Assistance (TANF)',
      'Federal temporary assistance for needy families.',
      'Temporary Assistance for Needy Families (TANF) provides time-limited federal assistance to low-income families. Programs focus on job preparation, work, and marriage promotion to help families become self-sufficient.',
      ['TANF', 'family assistance', 'federal', 'social services']);
  }

  // ── Courthouse Rental ──
  if (nl === 'courthouse rental') {
    return desc('Courthouse Rental Income',
      'Revenue from leasing space in county buildings.',
      'This fund tracks rental income from leasing office space or facilities in county-owned buildings. Government agencies, nonprofits, or other tenants may rent space in the courthouse or other county properties.',
      ['rental', 'revenue', 'facilities']);
  }

  // ── User Fee Funds (various) ──
  if (nl.includes('user fee') || nl.includes('user fees')) {
    return desc('User Fee Revenue',
      'Fees collected from users of specific government services.',
      'This fund collects fees charged for specific services. User fees help offset the cost of providing the service and are typically set by ordinance or statute. Examples include court fees, probation fees, and law enforcement training fees.',
      ['user fees', 'revenue', 'services']);
  }

  // ── Plat Book ──
  if (nl === 'plat book') {
    return desc('Plat Book Revenue',
      'Revenue from sale of county plat books.',
      'The County Auditor sells plat books showing property boundaries and ownership maps. Revenue from plat book sales supports the Auditor\'s office and GIS/mapping operations.',
      ['plat book', 'mapping', 'revenue', 'auditor']);
  }

  // ── Records Perpetuation ──
  if (nl.includes('records perpetuation') || nl.includes('record perpetuation')) {
    return desc('Records Preservation Fund',
      'Fees dedicated to preserving and digitizing county records.',
      'Indiana law allows county offices to collect a records perpetuation fee to fund the preservation, restoration, and digitization of permanent records. These funds ensure long-term access to historical property, court, and vital records.',
      ['records', 'preservation', 'digitization']);
  }

  // ── Corner Perpetuation (Surveyor) ──
  if (nl.includes('corner perpetuation')) {
    return desc('Survey Corner Preservation',
      'Fund to preserve and restore survey corner markers.',
      'The Surveyor\'s Corner Perpetuation Fund preserves original government survey corner monuments. These markers establish property boundaries throughout the county and must be maintained for accurate land surveys.',
      ['surveyor', 'corners', 'land records', 'preservation']);
  }

  // ── Petty Cash / Change ──
  if (nl === 'petty cash' || nl === 'change') {
    return desc('Petty Cash/Change Fund',
      'Working cash for daily government office operations.',
      'This is a small working fund providing cash for minor purchases and making change in county offices. Petty cash is replenished periodically and reconciled to ensure accountability.',
      ['petty cash', 'administrative', 'operating']);
  }

  // ── Bid Deposits ──
  if (nl.includes('bid deposit') || nl.includes('bond holding')) {
    return desc('Bid Deposits & Bonds',
      'Temporary holding of bid deposits and performance bonds.',
      'This fund holds bid deposits from contractors and vendors submitting bids on county projects, as well as performance and payment bonds. Deposits are returned to unsuccessful bidders and bonds are held until project completion.',
      ['bid deposits', 'bonds', 'procurement', 'fiduciary']);
  }

  // ── Clearing accounts ──
  if (nl.includes('clearing') || nl.includes('pass through')) {
    return desc('Clearing Account',
      'Pass-through fund for processing and distributing payments.',
      'This clearing account temporarily holds funds during processing before they are distributed to their final destination. Pass-through accounts ensure proper accounting for funds that move between agencies or accounts.',
      ['clearing', 'pass-through', 'administrative']);
  }

  // ── Fair Grounds ──
  if (nl.includes('fair ground') || nl.includes('fairground')) {
    return desc('County Fairgrounds',
      'Operations and maintenance of the Monroe County Fairgrounds.',
      'This fund supports the Monroe County Fairgrounds facility including the 4-H fair, agricultural exhibits, and community events. The fairgrounds host the annual county fair and serve as a venue for year-round community activities.',
      ['fairgrounds', 'agriculture', '4-H', 'community events']);
  }

  // ── Employee Morale ──
  if (nl === 'employee morale') {
    return desc('Employee Morale Fund',
      'Fund for county employee recognition and morale activities.',
      'This fund supports employee appreciation events, recognition programs, and morale-building activities for Monroe County government staff.',
      ['employee', 'morale', 'recognition', 'HR']);
  }

  // ── Cybersecurity ──
  if (nl.includes('cybersecurity')) {
    return desc('Cybersecurity Task Force',
      'Cybersecurity protection for county government systems.',
      'This fund supports cybersecurity measures to protect Monroe County government computer systems, networks, and data from cyber threats. Activities may include security assessments, training, monitoring, and incident response.',
      ['cybersecurity', 'IT', 'security', 'technology']);
  }

  // ── Co Drug Free Community ──
  if (nl.includes('drug free community')) {
    return desc('Drug Free Community',
      'Substance abuse prevention coalition.',
      'The Drug Free Communities program is a federal grant supporting community coalitions that prevent youth substance abuse. The coalition brings together schools, businesses, law enforcement, healthcare, and community organizations.',
      ['substance abuse', 'prevention', 'youth', 'community coalition']);
  }

  // ── System Navigator Grant ──
  if (nl.includes('system navigator')) {
    return desc('System Navigator Program',
      'Grant-funded navigation services for justice-involved individuals.',
      'System Navigators help justice-involved individuals access services including mental health treatment, substance abuse counseling, housing, employment, and benefits. The program reduces recidivism by connecting people with community resources.',
      ['navigation', 'justice', 'social services', 'grant']);
  }

  // ── Reducing Revocations ──
  if (nl.includes('reducing revocation')) {
    return desc('Reducing Revocations',
      'Grant program to reduce probation and parole revocations.',
      'This grant funds evidence-based practices to reduce probation and parole revocations in Monroe County. The program focuses on graduated sanctions, incentives, and swift responses to keep people in the community rather than returning them to incarceration.',
      ['probation', 'revocations', 'grant', 'justice reform']);
  }

  // ── Alternative Dispute Resolution ──
  if (nl.includes('alternative dispute') || nl.includes('mediation')) {
    return desc('Dispute Resolution Services',
      'Alternative dispute resolution and mediation programs.',
      'This fund supports mediation and alternative dispute resolution services that help resolve civil disputes, family conflicts, and community issues without formal court proceedings. ADR reduces court caseloads and provides faster, less costly resolution.',
      ['mediation', 'dispute resolution', 'courts']);
  }

  // ── Extradition ──
  if (nl.includes('extradition')) {
    return desc('Extradition & Transport',
      'Costs to transport prisoners to and from other jurisdictions.',
      'This fund covers the cost of extraditing fugitives from other states and transporting inmates between jurisdictions. The Sheriff\'s Department handles prisoner transport for Monroe County.',
      ['extradition', 'transport', 'sheriff', 'corrections']);
  }

  // ── Interstate Compact ──
  if (nl.includes('interstate compact')) {
    return desc('Interstate Compact',
      'Interstate supervision transfer of probationers and parolees.',
      'The Interstate Compact for Adult Offender Supervision allows transfer of probation and parole supervision between states. This fund covers Monroe County\'s share of compact administration for individuals who move across state lines.',
      ['interstate compact', 'probation', 'supervision']);
  }

  // ── Campaign Finance ──
  if (nl.includes('campaign finance')) {
    return desc('Campaign Finance Administration',
      'Administration of local campaign finance reporting.',
      'This fund supports the administration of campaign finance reporting requirements for local candidates and political committees in Monroe County.',
      ['campaign finance', 'elections', 'compliance']);
  }

  // ── Identification Security ──
  if (nl.includes('identification security')) {
    return desc('Identity Security',
      'Identity theft prevention and document security.',
      'This fund supports measures to protect personal identifying information in county records and prevent identity theft. Indiana law requires county offices to implement security protocols for documents containing sensitive information.',
      ['identity security', 'privacy', 'records']);
  }

  // ── Special Death Benefit ──
  if (nl.includes('special death benefit')) {
    return desc('Special Death Benefit',
      'Benefits paid upon death of public safety officers.',
      'Indiana provides special death benefits for public safety officers (police, fire, EMS) who die in the line of duty. This fund covers the county\'s obligation for these benefits.',
      ['death benefit', 'public safety', 'line of duty']);
  }

  // ── Surplus Tax Overpayments ──
  if (nl.includes('surplus tax')) {
    return desc('Tax Overpayment Refunds',
      'Refunds of property tax overpayments.',
      'This fund holds and disburses refunds for property tax overpayments. When property assessments are corrected or appeals are granted after taxes have been paid, the resulting overpayments are refunded from this fund.',
      ['tax refunds', 'overpayments', 'property tax']);
  }

  // ── Savings / Money Market ──
  if (nl.includes('savings') && (nl.includes('money market') || nl.includes('rainy day'))) {
    return desc('Savings Reserve',
      'County savings and investment reserve.',
      'This fund holds county savings in interest-bearing accounts. Indiana law allows local governments to invest idle funds in approved instruments to earn interest income while maintaining liquidity for government operations.',
      ['savings', 'investments', 'reserves', 'finance']);
  }

  // ── Sheriff Trust / Inmate Trust ──
  if (nl.includes('sheriff') && nl.includes('trust') || nl.includes('inmate trust')) {
    return desc("Sheriff's Inmate Trust",
      'Funds held in trust for inmates at the county jail.',
      "This trust account holds personal funds belonging to inmates at the Monroe County Jail. The Sheriff manages these accounts, allowing inmates to receive deposits and make approved purchases through the jail commissary.",
      ['jail', 'trust', 'inmates', 'sheriff']);
  }

  // ── CVET ──
  if (nl.includes('cvet') || nl.includes('comm. vehicle')) {
    return desc('Commercial Vehicle Tax',
      'Commercial Vehicle Excise Tax collections.',
      'The Commercial Vehicle Excise Tax (CVET) is an annual excise tax on commercial vehicles registered in Indiana. Collections are distributed to local road and highway funds to maintain roads impacted by commercial truck traffic.',
      ['commercial vehicles', 'excise tax', 'roads', 'revenue']);
  }

  // ── Forest Reserve ──
  if (nl.includes('forest reserve')) {
    return desc('Forest Reserve Revenue',
      'State distribution for classified forest and wildlands.',
      'Indiana provides payments in lieu of property tax for land classified under the Classified Forest and Wildlands program. Landowners receive reduced assessments for maintaining forest cover, and counties receive state reimbursement for the lost tax revenue.',
      ['forest', 'conservation', 'state distribution', 'revenue']);
  }

  // ── Mortgage Recording ──
  if (nl.includes('mortgage recording')) {
    return desc('Mortgage Recording Fees',
      'Fees collected when mortgages are recorded.',
      'Indiana imposes fees on mortgage recording that are shared between the county and the state. These fees are collected by the County Recorder when mortgage documents are filed and help fund affordable housing programs.',
      ['mortgage', 'recording', 'fees', 'revenue']);
  }

  // ── Alexander Memorial ──
  if (nl.includes('alexander memorial')) {
    return desc('Memorial Restoration',
      'Fund for the Alexander Memorial restoration project.',
      'This fund supports the restoration and preservation of the Alexander Memorial, a historic site in Monroe County. Restoration projects maintain cultural heritage sites for future generations.',
      ['historic', 'memorial', 'restoration', 'preservation']);
  }

  // ── Donation/Foundation gifts ──
  if (nl.includes('gift') || nl.includes('foundation')) {
    return desc('Gifts & Foundation Support',
      'Donations and foundation gifts supporting county programs.',
      'This fund holds donations, gifts, and foundation grants received by Monroe County entities. Contributions may support specific programs, facilities, or general operations as designated by donors.',
      ['donations', 'gifts', 'foundation', 'philanthropy']);
  }

  // ── School-specific grants and funds ──
  if (nl.includes('indiana ed') || nl.includes('indiana school incentive')) {
    return desc('Indiana Education Program',
      'State education program or incentive funding.',
      'This fund receives Indiana state education program funding or school improvement incentive awards. These programs support specific educational initiatives, school performance improvement, or innovative practices.',
      ['education', 'state program', 'schools', 'incentive']);
  }
  if (nl.includes('formative asmt') || nl.includes('assessment')) {
    return desc('Assessment Program',
      'Student assessment and evaluation program funding.',
      'This fund supports student assessment programs used to measure academic progress, identify learning needs, and inform instructional decisions. Funds may cover testing materials, technology, and professional development.',
      ['assessment', 'education', 'testing', 'schools']);
  }
  if (nl.includes('jump start')) {
    return desc('Jump Start Program',
      'Early college or accelerated education program.',
      'The Jump Start Program provides accelerated educational opportunities for students, potentially including early college credit, dual enrollment, or career readiness pathways.',
      ['education', 'accelerated', 'college prep', 'schools']);
  }
  if (nl.includes('ffa grant')) {
    return desc('FFA Agricultural Education',
      'Future Farmers of America grant for agricultural education.',
      'This grant supports FFA (Future Farmers of America) programs providing agricultural education, leadership development, and career preparation for students. Activities include supervised agricultural experiences and competitive events.',
      ['FFA', 'agriculture', 'education', 'youth']);
  }
  if (nl.includes('evening of stars')) {
    return desc('Evening of Stars Donations',
      'Donations for MCCSC celebration and recognition event.',
      'This fund holds donations supporting the "Evening of Stars" event, which recognizes and celebrates student and staff achievements in Monroe County schools.',
      ['donations', 'schools', 'recognition', 'events']);
  }
  if (nl.includes('quadrangle') || nl.includes('robot')) {
    return desc('Robotics Education',
      'Robotics and technology education program.',
      'This fund supports robotics programs where students design, build, and program robots. Robotics competitions and clubs teach STEM skills, teamwork, and problem-solving.',
      ['robotics', 'STEM', 'education', 'technology']);
  }
  if (nl.includes('arts education')) {
    return desc('Arts Education Grant',
      'Grant funding for arts education programs in schools.',
      'This grant supports visual arts, music, theater, or other arts education programming in Monroe County schools. Arts education develops creativity, critical thinking, and cultural awareness.',
      ['arts', 'education', 'grant', 'schools']);
  }
  if (nl.includes('humanities')) {
    return desc('Humanities Education Grant',
      'Indiana Humanities grant for educational programming.',
      'This grant from Indiana Humanities supports educational programming that explores culture, history, and the human experience. Programs may include speaker series, exhibits, or literacy activities.',
      ['humanities', 'education', 'grant', 'culture']);
  }
  if (nl.includes('garden grant')) {
    return desc('School Garden Program',
      'Grant for school garden and outdoor education.',
      'This grant supports school garden programs that teach students about nutrition, ecology, and food production through hands-on gardening experiences.',
      ['garden', 'education', 'nutrition', 'schools']);
  }
  if (nl.includes('work-indiana') || nl.includes('dwd') || nl.includes('etg')) {
    return desc('Workforce Training Program',
      'State workforce development and training grant.',
      'This fund supports workforce development programs helping individuals gain employment skills. Programs may include job training, career counseling, and employer-connected training through Indiana\'s Department of Workforce Development.',
      ['workforce', 'training', 'employment', 'state grant']);
  }
  if (nl.includes('share our strength') || nl.includes('food ser')) {
    return desc('Food Program Support',
      'Grant supporting school food service programs.',
      'This grant supports efforts to end childhood hunger by improving school food programs, increasing meal participation, and ensuring students have access to nutritious food.',
      ['food', 'hunger', 'nutrition', 'schools', 'grant']);
  }
  if (nl.includes('explore') && nl.includes('engage')) {
    return desc('Student Engagement Program',
      'Student exploration and engagement education program.',
      'This fund supports educational programs focused on student engagement, exploration, and experiential learning opportunities that supplement core classroom instruction.',
      ['engagement', 'education', 'enrichment', 'schools']);
  }
  if (nl.includes('local motion')) {
    return desc('Local Motion Grant',
      'Grant for adult education and community programs.',
      'This grant supports local education and community programming, potentially including adult literacy, community engagement, or cultural programming initiatives in Monroe County.',
      ['education', 'community', 'grant', 'adult']);
  }
  if (nl.includes('performance based') || nl.includes('accreditatio')) {
    return desc('School Accreditation',
      'Performance-based accreditation funding.',
      'This fund supports school corporation accreditation activities and performance improvement initiatives. Accreditation ensures schools meet state and national quality standards.',
      ['accreditation', 'education', 'quality', 'schools']);
  }
  if (nl.includes('stabilization grant')) {
    return desc('Education Stabilization',
      'Federal/state stabilization funding for schools.',
      'Education stabilization grants provide emergency funding to prevent cuts to educational programs during economic downturns or crises. These funds help maintain staffing levels and instructional services.',
      ['stabilization', 'education', 'emergency', 'federal']);
  }
  if (nl.includes('nieer')) {
    return desc('Pre-K Research Program',
      'National Institute for Early Education Research funding.',
      'NIEER funding supports research-based early childhood education programs at specific school sites. The program promotes high-quality pre-kindergarten education based on educational research.',
      ['pre-K', 'early education', 'research', 'grant']);
  }
  if (nl.includes('other local funds') || nl.includes('local donations')) {
    return desc('Local Contributions',
      'Locally-sourced donations and funds.',
      'This fund holds locally-generated revenue from donations, fundraising, and community contributions that support school or government programs beyond regular tax-based funding.',
      ['donations', 'local', 'community', 'revenue']);
  }
  if (nl.includes('alternative ed')) {
    return desc('Alternative Education',
      'Alternative education programs for at-risk students.',
      'Alternative education programs serve students who need different learning environments or approaches than traditional classrooms. Programs may include credit recovery, behavior intervention, and flexible scheduling.',
      ['alternative education', 'at-risk', 'schools']);
  }
  if (nl.includes('aire grant')) {
    return desc('Library AIRE Grant',
      'Arts and Innovation grant for library programs.',
      'This grant supports arts, innovation, reading, and engagement programs at Monroe County Public Library branches. Funded programs enhance library services and community access to cultural resources.',
      ['library', 'arts', 'grant', 'community']);
  }
  if (nl.includes('laura bush') || nl.includes('library grant')) {
    return desc('Library Foundation Grant',
      'Foundation grant supporting library programs.',
      'This grant supports library programs including literacy initiatives, collection development, and community programming. Foundation grants supplement regular library funding.',
      ['library', 'grant', 'literacy', 'community']);
  }
  if (nl.includes('tri kappa')) {
    return desc('Tri Kappa Education Grant',
      'Tri Kappa sorority grant for school programs.',
      'A grant from the Kappa Kappa Kappa sorority supporting educational programs at Monroe County schools. Tri Kappa chapters provide grants for classroom resources, student support, and educational enrichment.',
      ['grant', 'education', 'community', 'schools']);
  }
  if (nl.includes('upland pathway')) {
    return desc('Upland Pathways Grant',
      'Grant for career pathway education programs.',
      'The Upland Pathways Grant supports career pathway programs that help students explore and prepare for career fields through structured coursework, work-based learning, and industry certifications.',
      ['career pathways', 'education', 'workforce', 'grant']);
  }
  if (nl.includes('el ') && nl.includes('grant') || nl.includes('christine')) {
    return desc('School Foundation Grant',
      'Named foundation grant for school programs.',
      'This named grant supports specific educational programs or initiatives at Monroe County schools. Foundation grants provide supplemental funding for student enrichment beyond core instruction.',
      ['grant', 'education', 'foundation', 'schools']);
  }
  if (nl.includes('arsig') || nl.includes('refugee')) {
    return desc('Refugee Student Services',
      'Federal funding for refugee student support services.',
      'This grant provides support services for refugee and immigrant students adjusting to American schools. Services may include tutoring, cultural orientation, language support, and family engagement.',
      ['refugee', 'immigration', 'education', 'federal grant']);
  }
  if (nl.includes('community foundation grant')) {
    return desc('Community Foundation Grant',
      'Grant from the Community Foundation of Bloomington and Monroe County.',
      'This grant from the local community foundation supports specific programs or initiatives. The Community Foundation of Bloomington and Monroe County awards grants to nonprofits and government programs that benefit the community.',
      ['community foundation', 'grant', 'philanthropy']);
  }
  if (nl.includes('ccmg')) {
    return desc('County Capital Matching Grant',
      'State matching grant for county capital projects.',
      'The Community Crossings Matching Grant (CCMG) program provides Indiana state matching funds for local road and bridge projects. Monroe County uses these competitive grants to stretch local transportation dollars.',
      ['roads', 'matching grant', 'state', 'infrastructure']);
  }
  if (nl.includes('restricted donation') || (nl.includes('donation fund') && nl.includes('8875'))) {
    return desc('Restricted Donations',
      'Donations restricted to specific purposes by donors.',
      'This fund holds charitable donations with donor-imposed restrictions. The donations can only be spent for the purposes specified by the donors, such as specific programs, equipment, or facilities.',
      ['donations', 'restricted', 'philanthropy']);
  }
  if (nl.includes('plac')) {
    return desc('PLAC Fund',
      'Provisional licensed applicant costs.',
      'This fund covers costs associated with provisionally licensed applicants or placements. In an education context, this may fund substitute or provisional teachers or student placement services.',
      ['licensing', 'education', 'staffing'],
      'low');
  }
  if (nl.includes('lirf')) {
    return desc('Library Improvement Fund',
      'Library capital improvement reserve fund.',
      'The Library Improvement Reserve Fund (LIRF) accumulates funds for major library capital projects such as building renovation, expansion, or technology upgrades. This is a restricted fund that can only be used for library capital purposes.',
      ['library', 'capital', 'improvements', 'reserve']);
  }
  if (nl.includes('latcf')) {
    return desc('Library Capital Fund',
      'Library capital project fund.',
      'This fund supports capital projects for the Monroe County Public Library system. Library capital funds may come from specific tax levies, grants, or accumulated reserves for building and equipment needs.',
      ['library', 'capital', 'construction']);
  }
  if (nl.includes('mc bldg pres') || nl.includes('blgtn foundation')) {
    return desc('Historic Building Preservation',
      'Monroe County building preservation through the Bloomington Foundation.',
      'This fund supports the preservation of historically significant buildings in Monroe County through a partnership with the Bloomington community foundation. Projects maintain the architectural heritage of the county.',
      ['historic preservation', 'buildings', 'foundation']);
  }
  if (nl.includes('mc search') || nl.includes('search/recovery')) {
    return desc('Search & Recovery Unit',
      'Monroe County Search and Recovery team operations.',
      'This fund supports the Monroe County Search and Recovery Unit, which assists in locating missing persons and recovering evidence in water, wilderness, and disaster scenarios.',
      ['search', 'recovery', 'emergency', 'public safety']);
  }
  if (nl.includes('acc') && nl.includes('report')) {
    return desc('Accident Reports',
      'Revenue from accident report copies.',
      'This fund collects fees for copies of accident reports filed with local law enforcement. Report fees help offset the administrative costs of records management.',
      ['accident reports', 'fees', 'records', 'revenue']);
  }
  if (nl.includes('overweight vehicle')) {
    return desc('Overweight Vehicle Fines',
      'Fines for overweight commercial vehicles.',
      'Revenue from fines imposed on commercial vehicles exceeding legal weight limits on county roads. Overweight vehicles cause accelerated road damage, and fines help offset repair costs.',
      ['overweight', 'vehicles', 'fines', 'roads']);
  }
  if (nl.includes('false alarm')) {
    return desc('False Alarm Fees',
      'Fees charged for repeated false security alarms.',
      'Monroe County charges fees to property owners who generate excessive false fire or security alarms. These fees recover the cost of unnecessary emergency responses and encourage proper alarm maintenance.',
      ['false alarms', 'fees', 'emergency response']);
  }
  if (nl.includes('child restraint')) {
    return desc('Child Restraint Fines',
      'Fines from child car seat violations.',
      'Revenue from fines for violations of Indiana\'s child restraint laws requiring proper car seats and booster seats for children. Funds may support child passenger safety programs.',
      ['child safety', 'fines', 'traffic']);
  }
  if (nl.includes('infraction judgment')) {
    return desc('Infraction Judgments',
      'Revenue from traffic and civil infraction judgments.',
      'This fund collects payments from court judgments on infractions (minor violations) including traffic tickets, ordinance violations, and other non-criminal offenses adjudicated in Monroe County courts.',
      ['infractions', 'fines', 'courts', 'revenue']);
  }
  if (nl.includes('after settlement')) {
    return desc('After-Settlement Collections',
      'Property tax collections received after the settlement period.',
      'This fund holds property tax payments received after the semi-annual settlement dates. Late payments, delinquent taxes, and prior-year collections flow through this fund before distribution.',
      ['property tax', 'collections', 'delinquent', 'revenue']);
  }
  if (nl.includes('annual survey')) {
    return desc('Annual Survey Fund',
      'Fund for mandated annual surveying or assessment activities.',
      'This fund covers costs associated with annual surveys, which may include property assessments, public health surveys, or other mandated periodic data collection activities.',
      ['survey', 'assessment', 'annual'],
      'low');
  }
  if (nl.includes('dlgf') || nl.includes('hstd')) {
    return desc('DLGF Homestead Database',
      'State Department of Local Government Finance homestead verification.',
      'The DLGF provides funding to counties for maintaining the homestead standard deduction database. This ensures accurate verification of homestead property tax deductions claimed by homeowners.',
      ['homestead', 'property tax', 'DLGF', 'state']);
  }
  if (nl.includes('operation pullover')) {
    return desc('Traffic Safety Grant',
      'Federal grant for traffic enforcement operations.',
      'Operation Pullover is a federal highway safety grant that funds enhanced traffic enforcement including seatbelt, DUI, and speed enforcement campaigns. The program aims to reduce traffic fatalities and injuries.',
      ['traffic safety', 'enforcement', 'federal grant', 'highway']);
  }
  if (nl.includes('legal services provider')) {
    return desc('Legal Services Grant',
      'Grant funding for legal aid services.',
      'This grant supports legal services providers that offer free or low-cost legal assistance to low-income individuals in Monroe County. Services may include civil legal aid, family law, housing, and benefits cases.',
      ['legal aid', 'grant', 'social services']);
  }
  if (nl.includes('crisis') && nl.includes('workforce')) {
    return desc('Crisis Workforce Grant',
      'Grant supporting crisis response and social service workforce.',
      'This grant funds workforce development and support for crisis response services, potentially including mental health crisis teams, co-responder programs, and social service staffing.',
      ['crisis', 'workforce', 'mental health', 'grant']);
  }
  if (nl.includes('improving court security')) {
    return desc('Court Security Improvements',
      'Fund for courthouse security enhancements.',
      'This fund supports security improvements in Monroe County courthouses including screening equipment, security personnel, access controls, and safety infrastructure to protect judges, staff, and the public.',
      ['court security', 'safety', 'courthouse']);
  }
  if (nl.includes('homeland security')) {
    return desc('Homeland Security Fund',
      'Indiana Homeland Security grants and funding.',
      'The Indiana Department of Homeland Security provides funding for local emergency preparedness, response capabilities, and security measures. Funds support equipment, training, and exercises.',
      ['homeland security', 'emergency', 'preparedness', 'state']);
  }
  if (nl.includes('in jud') || nl.includes('supreme court grant')) {
    return desc('State Judicial Grant',
      'Indiana Supreme Court or judicial branch grant.',
      'This grant from the Indiana Supreme Court or judicial branch supports court improvement projects, specialty courts, or other initiatives to improve the administration of justice in Monroe County.',
      ['courts', 'judiciary', 'state grant', 'justice']);
  }
  if (nl.includes('family court')) {
    return desc('Family Court Project',
      'Specialized family court services and programs.',
      'The Family Court Project provides specialized services for families involved in the court system, including custody evaluations, parent education, mediation, and case coordination for family law matters.',
      ['family court', 'custody', 'family services', 'courts']);
  }
  if (nl.includes('build') && nl.includes('resil')) {
    return desc('Resilient Infrastructure Grant',
      'Grant for building resilient infrastructure.',
      'This grant funds infrastructure improvements designed to withstand and recover from natural disasters, climate events, or other disruptions. Projects may include flood mitigation, building hardening, or backup systems.',
      ['infrastructure', 'resilience', 'disaster', 'grant']);
  }
  if (nl.includes('vfa') || nl.includes('dnr')) {
    return desc('DNR Conservation Grant',
      'Indiana DNR or Volunteer Fire Assistance grant.',
      'This grant from the Indiana Department of Natural Resources supports conservation, forestry management, or volunteer fire assistance programs in Monroe County.',
      ['DNR', 'conservation', 'grant', 'natural resources']);
  }
  if (nl.includes('comm') && nl.includes('forestry')) {
    return desc('Community Forestry Grant',
      'USDA community and urban forestry grant.',
      'This USDA Forest Service grant supports community and urban forestry programs including tree planting, maintenance, education, and management plans. Urban forests provide shade, clean air, and improved property values.',
      ['forestry', 'trees', 'USDA', 'environment']);
  }
  if (nl.includes('hazardous material') || nl.includes('hmep')) {
    return desc('Hazardous Materials Program',
      'Hazardous materials emergency planning and response.',
      'This fund supports hazardous materials emergency planning, training, and response capabilities. The program ensures Monroe County can respond to chemical spills, releases, and other hazmat incidents.',
      ['hazardous materials', 'emergency', 'HAZMAT', 'safety']);
  }
  if (nl.includes('park nonreverting') && nl.includes('capital')) {
    return desc('Parks Capital Fund',
      'Non-reverting fund for county park capital projects.',
      'This non-reverting fund accumulates revenue for major park capital improvements including facility construction, playground equipment, trail development, and park infrastructure.',
      ['parks', 'capital', 'recreation', 'non-reverting']);
  }
  if (nl.includes('park nonreverting') && nl.includes('operating')) {
    return desc('Parks Operating Fund',
      'Non-reverting fund for county park operations.',
      'This non-reverting fund supports ongoing park operations including maintenance, programming, seasonal staff, and supplies that supplement the regular parks budget.',
      ['parks', 'operations', 'recreation', 'non-reverting']);
  }
  if (nl.includes('firearms training')) {
    return desc('Firearms Training Fund',
      'Law enforcement firearms training and range operations.',
      'This fund supports firearms training and qualification for Monroe County law enforcement officers. Regular training ensures officers maintain proficiency and meet state certification requirements.',
      ['firearms', 'training', 'law enforcement', 'safety']);
  }
  if (nl.includes('no department') || nl.includes('general & undistributed')) {
    return desc('Undistributed Expenses',
      'General expenses not allocated to a specific department.',
      'This category covers expenses that are not assigned to a specific department, such as insurance premiums, shared utilities, contingency funds, or other costs that benefit the organization as a whole.',
      ['general', 'undistributed', 'shared costs']);
  }
  if (nl.includes('home-rule') || nl.includes('home rule')) {
    return desc('Home Rule Department',
      'County department established under home rule authority.',
      'This fund supports a department or function established under Indiana\'s home rule authority, which allows local governments to exercise powers not explicitly denied by state law.',
      ['home rule', 'county government', 'local authority']);
  }
  if (nl.includes('acquire arff')) {
    return desc('Airport Fire Safety Equipment',
      'Aircraft Rescue and Firefighting (ARFF) equipment.',
      'This fund purchases Aircraft Rescue and Firefighting (ARFF) safety equipment for Monroe County Airport. ARFF equipment is specialized for responding to aircraft emergencies on the airfield.',
      ['airport', 'fire', 'ARFF', 'safety']);
  }
  if (nl.includes('airport') && nl.includes('monitoring')) {
    return desc('Airport Monitoring System',
      'Airport security and operations monitoring equipment.',
      'This fund supports monitoring systems at Monroe County Airport including surveillance cameras, weather stations, and operational monitoring equipment that enhance airport safety and security.',
      ['airport', 'monitoring', 'security', 'safety']);
  }
  if (nl.includes('airport') && nl.includes('rescue')) {
    return desc('Airport Rescue Grant',
      'Federal grant for airport rescue and recovery.',
      'This fund receives federal grant funds for airport rescue capabilities and emergency preparedness at Monroe County Airport.',
      ['airport', 'rescue', 'federal grant', 'safety']);
  }
  if (nl.includes('lost to care')) {
    return desc('Lost to Care Program',
      'Public health follow-up for patients lost to care.',
      'This program identifies and re-engages patients who have fallen out of medical care, particularly those with chronic conditions like HIV or hepatitis. Outreach workers help reconnect individuals with healthcare services.',
      ['public health', 'outreach', 'healthcare', 'follow-up']);
  }
  if (nl.includes('covered bridge')) {
    return desc('Covered Bridge Preservation',
      'Maintenance and preservation of historic covered bridges.',
      'This fund supports the maintenance, repair, and preservation of historic covered bridges in Monroe County. Indiana has one of the largest collections of covered bridges in the United States.',
      ['covered bridges', 'historic', 'preservation', 'infrastructure']);
  }
  if (nl.includes('construction') && nl.includes('reconstruction')) {
    return desc('Road Construction Fund',
      'County road construction and reconstruction projects.',
      'This fund supports new road construction and reconstruction of existing county roads. Projects may include complete road rebuilds, drainage improvements, and grade modifications.',
      ['roads', 'construction', 'infrastructure']);
  }
  if (nl.includes('maintenance') && nl.includes('repair')) {
    return desc('Road Maintenance & Repair',
      'Routine maintenance and repair of county roads.',
      'This fund covers routine road maintenance including patching, crack sealing, mowing, ditch cleaning, sign replacement, and minor repairs to keep county roads safe and functional.',
      ['roads', 'maintenance', 'repair', 'infrastructure']);
  }
  if (nl.includes('highway admin')) {
    return desc('Highway Administration',
      'Administrative costs for the county highway department.',
      'This covers the administrative operations of the Monroe County Highway Department including management, office staff, planning, engineering, and overhead costs for running the road maintenance program.',
      ['highway', 'administration', 'roads']);
  }
  if (nl.includes('sheriff sale')) {
    return desc('Sheriff Sale Administration',
      'Administration of court-ordered property sales.',
      'The Sheriff conducts court-ordered sales of property (foreclosures, tax sales, estate sales). This fund covers the administrative costs of advertising, conducting, and processing sheriff sales.',
      ['sheriff sale', 'foreclosure', 'courts', 'property']);
  }
  if (nl.includes('jury pay')) {
    return desc('Jury Pay Fund',
      'Compensation for jurors serving in Monroe County courts.',
      'This fund pays per diem and mileage reimbursement to citizens called for jury service in Monroe County. Indiana law sets minimum juror compensation rates.',
      ['jury', 'courts', 'compensation']);
  }
  if (nl.includes('juvenile per diem')) {
    return desc('Juvenile Detention Per Diem',
      'Daily costs for housing juvenile detainees.',
      'This fund covers per diem (daily rate) costs for housing juvenile offenders in detention facilities. Monroe County may place youth in regional juvenile detention centers and pays a daily rate for their care.',
      ['juvenile', 'detention', 'per diem', 'courts']);
  }
  if (nl.includes('state fines') && nl.includes('forfeit')) {
    return desc('State Fines & Forfeitures',
      'State-mandated distribution of court fines.',
      'This fund receives the state\'s share of fines and forfeitures imposed by Monroe County courts. Indiana law specifies how fine revenue is split between state, county, and other funds.',
      ['fines', 'state', 'courts', 'revenue']);
  }
  if (nl.includes('city') && nl.includes('town') && nl.includes('court cost')) {
    return desc('Municipal Court Costs',
      'Court cost distributions to cities and towns.',
      'This fund distributes the municipal share of court costs collected in Monroe County courts. State law specifies how court costs are allocated among county, municipal, and state entities.',
      ['court costs', 'municipal', 'distribution']);
  }
  if (nl.includes('animal control') && nl.includes('fine')) {
    return desc('Animal Control Fines',
      'Revenue from animal control violations.',
      'This fund collects fines and fees from animal control ordinance violations including unlicensed animals, leash law violations, and animal nuisance complaints.',
      ['animal control', 'fines', 'fees', 'revenue']);
  }
  if (nl.includes('education plate')) {
    return desc('Education License Plate Fees',
      'Revenue from specialty education license plates.',
      'Indiana offers specialty license plates with fees supporting education programs. A portion of these fees is distributed to school corporations based on where the vehicle is registered.',
      ['license plates', 'education', 'revenue', 'state']);
  }
  if (nl.includes('vehicle inspection')) {
    return desc('Vehicle Inspection Fees',
      'Revenue from vehicle safety inspections.',
      'This fund collects fees from vehicle safety inspections conducted by county law enforcement or authorized inspection stations.',
      ['vehicle', 'inspection', 'fees', 'safety']);
  }
  if (nl.includes('coroners training')) {
    return desc("Coroner's Training Fund",
      'Training and continuing education for the coroner.',
      "This fund supports professional development, certifications, and training required for the County Coroner and deputy coroners. Indiana requires ongoing education for coroners to maintain their credentials.",
      ['coroner', 'training', 'education']);
  }
  if (nl.includes('county elected official') && nl.includes('train')) {
    return desc('Elected Official Training',
      'Training fund for county elected officials.',
      'This fund provides training and continuing education for Monroe County elected officials. State law may require certain officials to complete annual training on topics like ethics, budgeting, and statutory duties.',
      ['training', 'elected officials', 'education']);
  }
  if (nl.includes('county offender transport')) {
    return desc('Offender Transportation',
      'Costs for transporting offenders between facilities.',
      'This fund covers the cost of transporting offenders between the county jail, courthouses, state prisons, treatment facilities, and other locations as required by court orders.',
      ['transportation', 'corrections', 'offenders']);
  }
  if (nl.includes('prosecutor check deception')) {
    return desc('Bad Check Prosecution',
      'Program for prosecuting check fraud and deception.',
      'The Prosecutor\'s Check Deception Program handles cases of bad checks and check fraud. Offenders may be required to make restitution and pay program fees as an alternative to criminal prosecution.',
      ['check fraud', 'prosecution', 'restitution']);
  }
  if (nl.includes('auditors ineligible')) {
    return desc("Auditor's Ineligible Deductions",
      'Fund tracking ineligible homestead deduction corrections.',
      "This fund tracks corrections to homestead deductions that were found to be ineligible. When property owners incorrectly claimed homestead deductions, the Auditor's office corrects the record and collects the underpaid taxes.",
      ['homestead', 'deductions', 'auditor', 'property tax']);
  }
  if (nl.includes('court interpreter')) {
    return desc('Court Interpreters',
      'Interpreter services for non-English-speaking court participants.',
      'Indiana courts must provide interpreter services for individuals with limited English proficiency. This fund covers the cost of qualified interpreters for court proceedings in Monroe County.',
      ['interpreters', 'courts', 'language access']);
  }
  if (nl.includes('food') && nl.includes('beverage') && nl.includes('collection')) {
    return desc('Food & Beverage Tax Collection',
      'Administrative costs of collecting the food and beverage tax.',
      'This fund covers the administrative costs of collecting the local food and beverage tax from restaurants, bars, and food service establishments in Monroe County.',
      ['food & beverage tax', 'collection', 'administration']);
  }

  // ── Very generic fallback ──
  return desc(name,
    `Budget category for ${name} in Monroe County.`,
    `This is a budget category for Monroe County, Indiana government. The specific purpose relates to "${name}" and may involve county operations, grants, special programs, or designated funds.`,
    ['county government', 'Monroe County'],
    'low');
}


// ─── Helper to build description object ──────────────────────────────────────

function desc(plainName, shortDesc, description, tags, confidence = 'high') {
  return {
    plain_name: plainName.substring(0, 80),
    short_description: shortDesc,
    description: description,
    tags: tags,
    confidence: confidence,
    confidence_reason: confidence === 'high' ? 'Generated from county government knowledge and category naming patterns' :
                       confidence === 'medium' ? 'Inferred from category name and common government fund patterns' :
                       'Limited information; description based on name interpretation only'
  };
}


// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nMonroe County Category Enrichment Generator');
  console.log('============================================\n');

  // Step 1: Get existing enrichments
  const { data: enrichments, error: ee } = await supabase
    .from('category_enrichment')
    .select('name_key')
    .eq('municipality_id', MUN_ID);
  if (ee) { console.error('Error fetching enrichments:', ee); process.exit(1); }
  const enrichedKeys = new Set((enrichments || []).map(e => e.name_key));
  console.log(`Existing enrichments: ${enrichedKeys.size}`);

  // Step 2: Get all budgets
  const { data: budgets } = await supabase
    .from('budgets')
    .select('id, dataset_type, fiscal_year')
    .eq('municipality_id', MUN_ID);

  if (!budgets?.length) {
    console.log('No budgets found for Monroe County. Exiting.');
    return;
  }
  console.log(`Found ${budgets.length} budgets across years\n`);

  // Step 3: Find all gaps
  const uniqueGaps = new Map();

  for (const budget of budgets) {
    if (budget.dataset_type !== 'operating' && budget.dataset_type !== 'revenue') continue;

    const { data: allCats } = await supabase
      .from('budget_categories')
      .select('id, name, parent_id, amount, depth')
      .eq('budget_id', budget.id);
    if (!allCats) continue;

    const catMap = Object.fromEntries(allCats.map(c => [c.id, c]));

    for (const c of allCats) {
      if (c.amount <= 0) continue;

      const nameLower = c.name.toLowerCase();
      // Skip salaries and transactions
      if (nameLower.includes('salary') || nameLower.includes('salaries') || nameLower.includes('wages') ||
          nameLower.includes('personal services') || nameLower === 'transactions') continue;

      const parentCat = c.parent_id && catMap[c.parent_id] ? catMap[c.parent_id] : null;
      const parentName = parentCat ? parentCat.name : null;
      const key = parentName
        ? parentName.toLowerCase().trim() + '|' + c.name.toLowerCase().trim()
        : c.name.toLowerCase().trim();

      if (!enrichedKeys.has(key) && !uniqueGaps.has(key)) {
        uniqueGaps.set(key, {
          key,
          name: c.name,
          parent_name: parentName,
          dataset_type: budget.dataset_type
        });
      }
    }
  }

  console.log(`Gaps found: ${uniqueGaps.size}\n`);

  if (uniqueGaps.size === 0) {
    console.log('No gaps to fill! All categories are enriched.');
    return;
  }

  // Step 4: Generate descriptions and upsert in batches
  const gaps = [...uniqueGaps.values()];
  const rows = [];
  let generated = 0;
  let lowConfidence = 0;

  for (const gap of gaps) {
    const result = generateDescription(gap.name, gap.parent_name, gap.dataset_type);

    rows.push({
      name_key: gap.key,
      municipality_id: MUN_ID,
      plain_name: result.plain_name,
      description: result.description,
      short_description: result.short_description,
      tags: result.tags || [],
      source: 'ai',
      confidence: result.confidence,
      evidence_summary: result.confidence_reason,
      generated_at: new Date().toISOString(),
    });

    generated++;
    if (result.confidence === 'low') lowConfidence++;
  }

  console.log(`Generated ${generated} descriptions (${lowConfidence} low confidence)\n`);

  // Upsert in batches of 50
  const BATCH_SIZE = 50;
  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    process.stdout.write(`  Upserting batch ${batchNum}/${totalBatches} (${batch.length} rows)... `);

    const { error } = await supabase
      .from('category_enrichment')
      .upsert(batch, { onConflict: 'name_key,municipality_id' });

    if (error) {
      console.log(`ERROR: ${error.message}`);
      errors++;
      // Log the first failing row for debugging
      console.log(`  First row in batch: ${JSON.stringify(batch[0].name_key)}`);
    } else {
      upserted += batch.length;
      console.log('ok');
    }
  }

  console.log(`\nUpserted: ${upserted} | Errors: ${errors}`);

  // Step 5: Verify 0 remaining gaps
  console.log('\nVerifying coverage...');

  const { data: newEnrichments } = await supabase
    .from('category_enrichment')
    .select('name_key')
    .eq('municipality_id', MUN_ID);
  const newEnrichedKeys = new Set((newEnrichments || []).map(e => e.name_key));

  let remainingGaps = 0;
  const missingExamples = [];

  for (const budget of budgets) {
    if (budget.dataset_type !== 'operating' && budget.dataset_type !== 'revenue') continue;
    const { data: allCats } = await supabase
      .from('budget_categories')
      .select('id, name, parent_id, amount')
      .eq('budget_id', budget.id);
    if (!allCats) continue;
    const catMap = Object.fromEntries(allCats.map(c => [c.id, c]));

    for (const c of allCats) {
      if (c.amount <= 0) continue;
      const nameLower = c.name.toLowerCase();
      if (nameLower.includes('salary') || nameLower.includes('salaries') || nameLower.includes('wages') ||
          nameLower.includes('personal services') || nameLower === 'transactions') continue;

      const parentCat = c.parent_id && catMap[c.parent_id] ? catMap[c.parent_id] : null;
      const parentName = parentCat ? parentCat.name : null;
      const key = parentName
        ? parentName.toLowerCase().trim() + '|' + c.name.toLowerCase().trim()
        : c.name.toLowerCase().trim();

      if (!newEnrichedKeys.has(key)) {
        remainingGaps++;
        if (missingExamples.length < 10) {
          missingExamples.push(key);
        }
      }
    }
  }

  console.log(`\n=== FINAL RESULTS ===`);
  console.log(`Total enrichments: ${newEnrichedKeys.size}`);
  console.log(`Remaining gaps: ${remainingGaps}`);
  if (missingExamples.length > 0) {
    console.log(`Missing examples: ${missingExamples.join(', ')}`);
  }

  if (remainingGaps === 0) {
    console.log('\nSUCCESS: All categories are enriched!');
  } else {
    console.log(`\nWARNING: ${remainingGaps} categories still missing enrichment.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
