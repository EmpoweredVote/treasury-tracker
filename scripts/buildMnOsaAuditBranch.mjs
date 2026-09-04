/**
 * Generate `scripts/data/mnOsaAuditBranch.json` — the audit-grade BRANCH for the
 * Minnesota OSA City/County Finances Report, per (city, fiscal year).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Usage:
 *   node scripts/buildMnOsaAuditBranch.mjs            # writes the JSON
 *   node scripts/buildMnOsaAuditBranch.mjs --check    # verify the committed file
 *
 * ── WHY A BRANCH FILE AT ALL ───────────────────────────────────────────────
 *
 * MN OSA is a MIXED source: whether the published figures are backed by an audit
 * depends on the entity's STATUTORY CLASS, not on the source.
 *
 *   counties            Minn. Stat. § 6.481 subd. 2 — "A county must have an
 *                       annual financial audit."               -> audited
 *   cities over 2,500   § 471.697(c) — must "Submit to the state auditor audited
 *                       financial statements ... attested to by a certified
 *                       public accountant, public accountant, or the state
 *                       auditor"                               -> audited
 *   cities under 2,500  § 471.698 — a statement "in the style and form
 *                       prescribed by the state auditor". NO AUDIT CLAUSE.
 *                       56.1% of them used a CASH basis in 2023.
 *                                                              -> NOT audited
 *
 * Every other family in `auditGradeRegistry` carries its branch inside the
 * `data_source` string (Florida's `..., audit-reconciled`). All 21,794 Minnesota
 * rows predate that convention and share ONE bare string, so the branch has to
 * come from somewhere else.
 *
 * ── ⭐⭐ THE BRANCH IS THE PUBLISHER'S OWN, NOT A THRESHOLD WE COMPUTE ───────
 *
 * The raw `cired_<YY>_data.xlsx` carries a `ClassCode` column holding the § 410.01
 * class. It reconciles EXACTLY with the report's own prose: FY2023 has 619 rows
 * at ClassCode 5, and the 2023 City Finances Report says "347 of the 619 small
 * cities (56.1 percent)". Fifth class IS "under 2,500" — the report states it:
 * "All cities under 2,500 in population are designated as fifth-class cities."
 *
 * ⭐ It also settles a fact that would otherwise be an inference: DULUTH is
 * ClassCode 1 at a population of 86,788, i.e. still a city of the FIRST class
 * though under 100,000 — because § 410.01 does not reclassify until population
 * falls 25% below the figure that qualified it. First-class cities are audited by
 * the State Auditor itself (§ 6.49). Read off the data, not reasoned about.
 *
 * ⚠⚠ POPULATION IS RECORDED BUT NEVER USED AS THE RULE. OSA assigns class from
 * the DECENNIAL census ("This report uses the class designations based on the
 * 2020 census population figures"), so a city can sit under 2,500 in a given year
 * and still be fourth class. Deriving the branch from `Population` would disagree
 * with the publisher on exactly those entities. `ClassCode` is the rule;
 * `Population` is kept only as corroborating evidence.
 *
 * ⚠ Counties need no entry here: § 6.481 makes the audit unconditional, so the
 * resolver keys on entity type alone. This file is CITIES only, and that is why.
 */
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = '_mn-recon';
const OUT = 'scripts/data/mnOsaAuditBranch.json';

/** ⚠ Gitignored source. The GENERATED JSON is what gets committed. */
function cityFiles() {
  if (!existsSync(SRC_DIR)) {
    throw new Error(`${SRC_DIR}/ is absent — it holds the OSA raw XLSX and is gitignored. `
      + 'Re-fetch per scripts/mnOsaDatasets.json before regenerating.');
  }
  return readdirSync(SRC_DIR)
    .filter((f) => /^cired_\d\d_data\.xlsx$/.test(f))
    .sort()
    .map((f) => path.join(SRC_DIR, f));
}

async function readOne(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('Governmental Funds');
  if (!ws) throw new Error(`${file}: no 'Governmental Funds' sheet`);

  const header = ws.getRow(1).values.map((v) => (v == null ? '' : String(v).trim()));
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`${file}: column '${name}' not found`);
    return i;
  };
  const cName = col('Entity Name');
  const cClass = col('ClassCode');
  const cPop = col('Population');
  const cYear = col('FinancialYear');

  const out = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const v = row.values;
    const name = v[cName] == null ? '' : String(v[cName]).trim();
    if (!name) return;
    out.push({
      name,
      fy: Number(v[cYear]),
      classCode: Number(v[cClass]),
      population: v[cPop] == null ? null : Number(v[cPop]),
    });
  });
  return out;
}

const files = cityFiles();
const cities = {};
const perFy = {};
const unclassified = [];
let rows = 0;

for (const f of files) {
  const recs = await readOne(f);
  for (const r of recs) {
    // ⚠⚠ REFUSE a row whose class we cannot read. A missing or out-of-range
    // ClassCode must leave the entity-year UNRESOLVED so the grader falls back to
    // `unknown` — never silently to a grade. §3.5.
    if (!Number.isInteger(r.classCode) || r.classCode < 1 || r.classCode > 5) {
      // ⚠⚠ DECLARED, NOT DROPPED. The publisher itself leaves ClassCode blank on a
      // few rows. Such an entity-year resolves to the family's WEAKER branch, and
      // recording it here is what stops that silence from being invisible.
      // ⚠ It is deliberately NOT back-filled from Population: OSA assigns class
      // from the DECENNIAL census, so population is corroboration, never the rule.
      if (Number.isInteger(r.fy)) {
        unclassified.push({ name: r.name, fy: r.fy, population: r.population });
      }
      continue;
    }
    if (!Number.isInteger(r.fy)) continue;
    (cities[r.name] ??= {})[String(r.fy)] = r.classCode;
    (perFy[String(r.fy)] ??= { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })[r.classCode] += 1;
    rows += 1;
  }
}

const payload = {
  _comment:
    'Per-(city, fiscal year) STATUTORY CLASS for Minnesota cities, read verbatim from the '
    + "ClassCode column of the OSA raw data. Class 5 = under 2,500 in population = NO statutory "
    + 'audit requirement (Minn. Stat. § 471.698); classes 1-4 = over 2,500 = audited financial '
    + 'statements must be filed with the OSA (§ 471.697(c)). Counties are deliberately absent: '
    + '§ 6.481 subd. 2 makes their audit unconditional, so no per-entity lookup is needed. '
    + 'Population is NOT the rule — OSA assigns class from the decennial census — and is not '
    + 'stored here. Regenerate with scripts/buildMnOsaAuditBranch.mjs.',
  source: 'Minnesota Office of the State Auditor City/County Finances Report',
  statutes: {
    counties: 'Minn. Stat. § 6.481 subd. 2',
    citiesOver2500: 'Minn. Stat. § 471.697 subd. 1(c)',
    citiesUnder2500: 'Minn. Stat. § 471.698',
  },
  files: files.map((f) => path.basename(f)),
  entity_years: rows,
  per_fy_class_distribution: perFy,
  // ⚠ Entity-years the PUBLISHER left unclassified. Each resolves to the weaker
  // branch (self_reported_unaudited). Asserted in tests, so one appearing or
  // disappearing is a visible change rather than a silent one.
  unclassified_entity_years: unclassified.sort((a, b) => a.name.localeCompare(b.name) || a.fy - b.fy),
  cities,
};

const json = `${JSON.stringify(payload, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const have = readFileSync(OUT, 'utf8');
  if (have !== json) {
    console.error(`${OUT} is STALE — regenerate with: node scripts/buildMnOsaAuditBranch.mjs`);
    process.exit(1);
  }
  console.log(`${OUT} matches the source: ${rows.toLocaleString()} city-years.`);
} else {
  writeFileSync(OUT, json, 'utf8');
  console.log(`wrote ${OUT}: ${Object.keys(cities).length} cities, `
    + `${rows.toLocaleString()} city-years, from ${files.length} files`);
  console.log(`  unclassified by the publisher: ${unclassified.length}`
    + (unclassified.length ? ` — ${unclassified.map((u) => `${u.name} FY${u.fy} (pop ${u.population})`).join(', ')}` : ''));
  for (const [fy, d] of Object.entries(perFy).sort()) {
    console.log(`  FY${fy}  class1=${d[1]} class2=${d[2]} class3=${d[3]} class4=${d[4]} class5=${d[5]}`);
  }
}
