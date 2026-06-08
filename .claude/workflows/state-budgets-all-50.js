export const meta = {
  name: 'state-budgets-all-50',
  description: 'Research and load General Fund operating + revenue budgets for all 50 US states',
  whenToUse: 'Run to populate Treasury Tracker with state-level budget data for all 50 states',
  phases: [
    { title: 'Per-State', detail: 'One agent per state: check scripts → research → write → seed → load' },
  ],
}

// ── State roster ──────────────────────────────────────────────────────────────
// California excluded — scripts and data already exist.
// States with existing scripts skip research/write and go straight to seed+load.
const STATES = [
  { name: 'Texas',          abbr: 'TX', pop: 29145505, fy_end: 'August 31',    fy_note: 'Biennial budget (Sept 1–Aug 31). 87th Leg = FY2022+2023; 88th Leg = FY2024+2025; 89th Leg = FY2026. Split biennium GF evenly.' },
  { name: 'New York',       abbr: 'NY', pop: 20201249, fy_end: 'March 31',     fy_note: 'SFY April 1–March 31. SFY 2021-22 ends March 31 2022 = our FY2022.' },
  { name: 'Florida',        abbr: 'FL', pop: 21538187, fy_end: 'June 30' },
  { name: 'Pennsylvania',   abbr: 'PA', pop: 13002700, fy_end: 'June 30' },
  { name: 'Illinois',       abbr: 'IL', pop: 12812508, fy_end: 'June 30' },
  { name: 'Ohio',           abbr: 'OH', pop: 11799448, fy_end: 'June 30' },
  { name: 'Georgia',        abbr: 'GA', pop: 10711908, fy_end: 'June 30' },
  { name: 'North Carolina', abbr: 'NC', pop: 10439388, fy_end: 'June 30' },
  { name: 'Michigan',       abbr: 'MI', pop: 10077331, fy_end: 'September 30' },
  { name: 'New Jersey',     abbr: 'NJ', pop: 9288994,  fy_end: 'June 30' },
  { name: 'Virginia',       abbr: 'VA', pop: 8631393,  fy_end: 'June 30' },
  { name: 'Washington',     abbr: 'WA', pop: 7705281,  fy_end: 'June 30' },
  { name: 'Arizona',        abbr: 'AZ', pop: 7151502,  fy_end: 'June 30' },
  { name: 'Massachusetts',  abbr: 'MA', pop: 7029917,  fy_end: 'June 30' },
  { name: 'Tennessee',      abbr: 'TN', pop: 6910840,  fy_end: 'June 30' },
  { name: 'Indiana',        abbr: 'IN', pop: 6785528,  fy_end: 'June 30' },
  { name: 'Missouri',       abbr: 'MO', pop: 6154913,  fy_end: 'June 30' },
  { name: 'Maryland',       abbr: 'MD', pop: 6177224,  fy_end: 'June 30' },
  { name: 'Wisconsin',      abbr: 'WI', pop: 5893718,  fy_end: 'June 30' },
  { name: 'Colorado',       abbr: 'CO', pop: 5773714,  fy_end: 'June 30' },
  { name: 'Minnesota',      abbr: 'MN', pop: 5706494,  fy_end: 'June 30' },
  { name: 'South Carolina', abbr: 'SC', pop: 5118425,  fy_end: 'June 30' },
  { name: 'Alabama',        abbr: 'AL', pop: 5024279,  fy_end: 'September 30' },
  { name: 'Louisiana',      abbr: 'LA', pop: 4657757,  fy_end: 'June 30' },
  { name: 'Kentucky',       abbr: 'KY', pop: 4505836,  fy_end: 'June 30' },
  { name: 'Oregon',         abbr: 'OR', pop: 4237256,  fy_end: 'June 30',     fy_note: 'Biennial budget. Split biennium GF evenly across 2 years.' },
  { name: 'Oklahoma',       abbr: 'OK', pop: 3959353,  fy_end: 'June 30' },
  { name: 'Connecticut',    abbr: 'CT', pop: 3605944,  fy_end: 'June 30' },
  { name: 'Utah',           abbr: 'UT', pop: 3271616,  fy_end: 'June 30' },
  { name: 'Iowa',           abbr: 'IA', pop: 3190369,  fy_end: 'June 30' },
  { name: 'Nevada',         abbr: 'NV', pop: 3104614,  fy_end: 'June 30' },
  { name: 'Arkansas',       abbr: 'AR', pop: 3011524,  fy_end: 'June 30' },
  { name: 'Mississippi',    abbr: 'MS', pop: 2961279,  fy_end: 'June 30' },
  { name: 'Kansas',         abbr: 'KS', pop: 2937880,  fy_end: 'June 30' },
  { name: 'New Mexico',     abbr: 'NM', pop: 2117522,  fy_end: 'June 30' },
  { name: 'Nebraska',       abbr: 'NE', pop: 1961504,  fy_end: 'June 30' },
  { name: 'Idaho',          abbr: 'ID', pop: 1839106,  fy_end: 'June 30' },
  { name: 'West Virginia',  abbr: 'WV', pop: 1793716,  fy_end: 'June 30' },
  { name: 'Hawaii',         abbr: 'HI', pop: 1455271,  fy_end: 'June 30' },
  { name: 'New Hampshire',  abbr: 'NH', pop: 1377529,  fy_end: 'June 30',     fy_note: 'No sales tax, no wage income tax. Revenue: business profits tax, meals & rooms tax, tobacco, lottery.' },
  { name: 'Maine',          abbr: 'ME', pop: 1362359,  fy_end: 'June 30' },
  { name: 'Rhode Island',   abbr: 'RI', pop: 1097379,  fy_end: 'June 30' },
  { name: 'Montana',        abbr: 'MT', pop: 1084225,  fy_end: 'June 30',     fy_note: 'No sales tax. Revenue: income tax, property taxes, resource taxes.' },
  { name: 'Delaware',       abbr: 'DE', pop: 989948,   fy_end: 'June 30',     fy_note: 'No sales tax. Revenue: personal income tax, corporate franchise tax, gross receipts tax.' },
  { name: 'South Dakota',   abbr: 'SD', pop: 886667,   fy_end: 'June 30',     fy_note: 'No income tax. Revenue: sales tax, use tax, contractor excise tax.' },
  { name: 'North Dakota',   abbr: 'ND', pop: 779094,   fy_end: 'June 30' },
  { name: 'Alaska',         abbr: 'AK', pop: 733391,   fy_end: 'June 30',     fy_note: 'No income or sales tax. Revenue: oil/gas severance taxes, Permanent Fund earnings.' },
  { name: 'Vermont',        abbr: 'VT', pop: 643077,   fy_end: 'June 30' },
  { name: 'Wyoming',        abbr: 'WY', pop: 576851,   fy_end: 'June 30',     fy_note: 'No income tax. Revenue: mineral severance taxes, sales tax, property tax distributions.' },
]

// ── Per-state agent prompt (NO schema — avoids StructuredOutput failure) ──────
function statePrompt(state) {
  const { name, abbr, pop, fy_end, fy_note } = state
  const lc       = abbr.toLowerCase()
  const seedPath = `C:/treasury-tracker/scripts/seed${abbr}State.js`
  const revPath  = `C:/treasury-tracker/scripts/process${abbr}Revenue.js`
  const opPath   = `C:/treasury-tracker/scripts/process${abbr}.js`

  return `You are processing ${name} (${abbr}) for Treasury Tracker.
Working directory for all node commands: C:/treasury-tracker

════════════════════════════════════════
STEP 1 — CHECK EXISTING SCRIPTS
════════════════════════════════════════
Check whether these 3 files already exist:
  ${seedPath}
  ${revPath}
  ${opPath}

If ALL 3 exist → skip to STEP 4 (run seed). Research and writing are already done.
If any are missing → complete STEPS 2–3 first.

════════════════════════════════════════
STEP 2 — RESEARCH  (only if scripts missing)
════════════════════════════════════════
Find official General Fund data for ${name} for FY2022–FY2026.

FY end: ${fy_end}. Label by end year (FY ending 2022 = FY2022).
${fy_note ? `Special: ${fy_note}` : ''}

Target: General Fund only (NOT all-funds). ≈40–70% of total state spending.
May be called "General Revenue Fund" (TX, AR), "State General Fund", or "General Fund".

Do AT MOST 5 web searches. Stop when you have data for 3+ years.
  Search 1: "${name} general fund budget office .gov"
  Search 2: "${name} general fund revenue expenditure FY2022 FY2023 FY2024 FY2025 FY2026"
  Search 3: Fetch the most useful official .gov page found

REVENUE categories (adapt to state tax structure):
  Income taxes (personal + corporate) — skip if no income tax
  Sales & use tax — skip if no sales tax
  Motor vehicle / fuel taxes
  Other taxes (insurance, tobacco, alcohol, lottery)
  Non-tax revenue (fees, interest, federal transfers)

EXPENDITURE categories:
  Education (K-12 + higher ed)
  Health & human services (Medicaid, social services)
  Public safety (corrections, judiciary, police)
  General government / administration
  Other major categories as found

Amounts in DOLLARS. If source uses thousands → ×1000. If millions → ×1,000,000.
Mark unavailable years as such — do NOT guess or interpolate.
Subcategory line items must sum to category total (round smallest item to fix gaps ≤2%).

════════════════════════════════════════
STEP 3 — WRITE SCRIPTS  (only if scripts missing)
════════════════════════════════════════
Read C:/treasury-tracker/scripts/seedCAState.js        (seed template)
Read C:/treasury-tracker/scripts/processCARevenue.js   (process template)

Write ${seedPath}
  Clone seedCAState.js. Set:
    name='${name}', state='${abbr}', population=${pop}, population_year=2024, entity_type='state'
  TWO data_source entries:
    { name:'${name} General Fund Operating Budget', api_type:'pdf_download' (or xlsx/csv if applicable),
      dataset_type:'operating', dataset_id:'${lc}-gf-operating', base_url:'[URL]',
      fiscal_years:[years with data] }
    { name:'${name} General Fund Revenue', api_type:'pdf_download' (or xlsx/csv),
      dataset_type:'revenue', dataset_id:'${lc}-gf-revenue', base_url:'[URL]',
      fiscal_years:[years with data] }

Write ${revPath}
  Clone processCARevenue.js exactly. Replace:
    STATE_NAME='${name}', STATE_ABBR='${abbr}', POPULATION=${pop}
    REVENUE = { /* your research data, only confirmed/estimated years */ }
    data_source: name='${name} General Fund Revenue', dataset_id='${lc}-gf-revenue'
    Root tree node: '${name} General Fund Revenue'
  Sort categories descending by amount.
  Validation must pass or script exits with code 2.

Write ${opPath}
  Same structure as ${revPath} but for expenditures:
    dataset_type='operating', dataset_id='${lc}-gf-operating'
    Source name='${name} General Fund Operating Budget'
    Root tree node='${name} General Fund Budget'
    EXPENDITURES = { /* your research data */ }

════════════════════════════════════════
STEP 4 — RUN SEED
════════════════════════════════════════
  node C:/treasury-tracker/scripts/seed${abbr}State.js

If it fails: record error and skip to FINAL OUTPUT with status=seed_failed.

════════════════════════════════════════
STEP 5 — LOAD REVENUE
════════════════════════════════════════
  node C:/treasury-tracker/scripts/process${abbr}Revenue.js --dry-run

If dry-run exits 0:
  node C:/treasury-tracker/scripts/process${abbr}Revenue.js

Note which FY years were loaded (look for "Loaded FY20XX" or "FY20XX" in output).

════════════════════════════════════════
STEP 6 — LOAD OPERATING BUDGET
════════════════════════════════════════
  node C:/treasury-tracker/scripts/process${abbr}.js --dry-run

If dry-run exits 0:
  node C:/treasury-tracker/scripts/process${abbr}.js

Note which FY years were loaded.

════════════════════════════════════════
FINAL OUTPUT  ← this is the only thing that matters at the end
════════════════════════════════════════
Your very last line of output MUST be exactly this format (no extra text after it):

RESULT: status=done rev=[2022,2023,2024] exp=[2022,2023,2024]

Where:
  status = done | partial | seed_failed | no_data
  rev    = comma-separated FY integers actually loaded for revenue (empty [] if none)
  exp    = comma-separated FY integers actually loaded for expenditures (empty [] if none)

Status rules:
  done        = both revenue and operating loaded ≥2 years each
  partial     = one of the two loaded, or <2 years total
  seed_failed = seed script exited non-zero
  no_data     = could not find usable data after research`
}

// ── Parse RESULT: line from agent text output ─────────────────────────────────
function parseResult(abbr, text) {
  if (!text) return { abbr, status: 'no_response', rev: [], exp: [] }
  const match = text.match(/RESULT:\s*status=(\S+)\s+rev=\[([^\]]*)\]\s+exp=\[([^\]]*)\]/)
  if (!match) return { abbr, status: 'parse_failed', rev: [], exp: [], raw: text.slice(-300) }
  const parseYears = s => s.split(',').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n))
  return {
    abbr,
    status: match[1],
    rev:    parseYears(match[2]),
    exp:    parseYears(match[3]),
  }
}

// ── Main: one agent per state, sequential, no schema ─────────────────────────
const results = []

for (const state of STATES) {
  log(`\n▶ ${state.abbr} (${results.length + 1}/${STATES.length})`)

  const text = await agent(statePrompt(state), {
    label: state.abbr,
    phase: 'Per-State',
    // NO schema — agents without schema always complete successfully
  })

  const r = parseResult(state.abbr, text)
  results.push(r)

  const icon = r.status === 'done' ? '✓' : r.status === 'partial' ? '~' : '✗'
  log(`  ${icon} ${state.abbr}: ${r.status}  rev=[${r.rev.join(',')}]  exp=[${r.exp.join(',')}]`)

  const done    = results.filter(x => x.status === 'done').length
  const partial = results.filter(x => x.status === 'partial').length
  const issues  = results.filter(x => !['done','partial'].includes(x.status)).length
  log(`  Totals: ${done} done | ${partial} partial | ${issues} issues`)
}

// ── Final report ──────────────────────────────────────────────────────────────
const done    = results.filter(r => r.status === 'done')
const partial = results.filter(r => r.status === 'partial')
const issues  = results.filter(r => !['done','partial'].includes(r.status))

log(`\n${'═'.repeat(60)}`)
log(`DONE: ${done.length} | PARTIAL: ${partial.length} | ISSUES: ${issues.length}`)
if (issues.length) {
  log('Issues:')
  for (const r of issues) log(`  ${r.abbr}: ${r.status} ${r.raw ? '— ' + r.raw : ''}`)
}

return {
  summary: { total: STATES.length, done: done.length, partial: partial.length, issues: issues.length },
  done:    done.map(r    => ({ abbr: r.abbr, rev: r.rev, exp: r.exp })),
  partial: partial.map(r => ({ abbr: r.abbr, rev: r.rev, exp: r.exp })),
  issues:  issues.map(r  => ({ abbr: r.abbr, status: r.status })),
}
