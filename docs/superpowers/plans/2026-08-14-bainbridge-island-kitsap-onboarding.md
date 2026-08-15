# Bainbridge Island + Kitsap County Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load 84 sourced General Fund rows (Bainbridge Island FY2004–FY2025 less FY2006, Kitsap County FY2004–FY2024, `operating` + `revenue`) into Treasury Tracker from WA SAO bound financial statements, with every row tying at $0 and citing an audit-attested source.

**Architecture:** A new MCAG-generic SAO client (`scripts/lib/waSao.mjs`) fetches PDFs from `portal.sao.wa.gov` for both entities. Two thin `CityConfig` wrappers over the existing `scripts/lib/acfrGF.py` extract the GF column. A new shared loader core (`scripts/lib/waSaoLoad.mjs`) drives two thin per-entity loaders. Three independent harnesses verify the result. **v2.21's shipped files (`processSeattle.js`, `processKingCounty.js`, `extractSeattle.py`, `extractKingCounty.py`, `fetchSeattleKingCounty.mjs`) are NOT modified** — the new shared loader is a new file, so there is no regression risk to Seattle or King County.

**Tech Stack:** Node 20 ESM (`.mjs`/`.js`), Python 3 (`py -3` on Windows), `pdftotext` (poppler), Supabase JS client, vitest, Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-08-14-bainbridge-island-kitsap-onboarding-design.md`

## Global Constraints

- **Fund scope: General Fund only.** Both datasets, both entities. No other fund.
- **Datasets: `operating` and `revenue`.** Exactly these two `dataset_type` values.
- **Bainbridge FY window: 2004, 2005, 2007, 2008, 2009, 2010–2025.** FY2006 is excluded (image-only scan). FY2009 is conditional on Task 6.
- **Kitsap FY window: 2004–2024 inclusive.** No FY2025 (not yet audited).
- **Tie gate is $0.** Never widen a tolerance. A confirmed printed-total-vs-components disagreement is registered in `CityConfig.source_rounding` as an EXACT delta for that `(fiscal_year, mode)`, or it is a bug.
- **Write via `treasury_sync_budget_tree` only.** Never `treasury_sync_city_budget` — it overwrites existing `(muni, fy, dataset)` rows and keeps a stale `data_source` label.
- **`data_sources` rows are ephemeral** — created per dataset_type, deleted in a `finally` block. Never left behind.
- **Enrichment rows must carry a non-NULL `municipality_id`.** A NULL makes the row universal and bleeds text into unrelated cities.
- **Any count of sources / archives / provenance classes is scoped to a `municipality_id`.** App-wide counts of that shape are wrong by default.
- **`npm run lint` is a broken gate in this repo** and has never exited 0. It is NOT part of the definition of done. Use `npm test`, `npm run test:acfr`, and the three harnesses.
- **Python is invoked as `py -3` on Windows**, `python3` elsewhere, always via `spawnSync` with an ARGS ARRAY (never a shell string).
- Commit messages end with: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Branch: `feat/bainbridge-island-kitsap-onboarding` (already created; spec committed as `a9823a4`).

## File Structure

**Create:**
- `scripts/lib/waSao.mjs` — MCAG-generic SAO ReportSearch client: entity lookup, report search, `/Date(ms)/` decoding, content-guarded PDF download. Consumed by the fetcher and the audit harness.
- `scripts/fetchBainbridgeKitsap.mjs` — thin driver holding the two ARN manifests; writes into gitignored `docs/BainbridgeIsland/` and `docs/KitsapCounty/`.
- `scripts/extractBainbridge.py` — `CityConfig` wrapper.
- `scripts/extractKitsap.py` — `CityConfig` wrapper.
- `scripts/decodeSaoFont2009.py` — throwaway, self-validating FY2009 font decoder.
- `scripts/lib/waSaoLoad.mjs` — shared loader core.
- `scripts/processBainbridge.js` / `scripts/processKitsap.js` — thin per-entity loaders.
- `scripts/seedBainbridgeKitsap.mjs` — creates the two `treasury.municipalities` rows.
- `scripts/loadBainbridgeKitsapEnrichment.mjs` — category enrichment.
- `scripts/verify-bainbridge-rederive.mjs` / `-audit.mjs` / `-tether.mjs` — the three harnesses.
- `tests/waSao.test.mjs` — vitest tests for the SAO client.

**Modify:**
- `scripts/lib/acfrGF.selftest.py` — add cases for the two new statement shapes.
- `.gitignore` — add the two new `docs/` PDF directories if not already covered by `docs/*`.

---

### Task 1: WA SAO client

**Files:**
- Create: `scripts/lib/waSao.mjs`
- Test: `tests/waSao.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `decodeMsDate(value: string) => number | null` — returns the 4-digit year from a `/Date(<epoch-ms>)/` string.
  - `searchReportsUrl(mcag: string, pageNumber?: number) => string`
  - `entityLookupUrl(nameStartsWith: string) => string`
  - `reportFileUrl(arn: string | number) => string`
  - `SAO_HEADERS: Record<string,string>`
  - `classifyReport(pageCount: number, text: string) => { ok: boolean, reason: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/waSao.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  decodeMsDate, searchReportsUrl, entityLookupUrl, reportFileUrl, classifyReport,
} from '../scripts/lib/waSao.mjs';

describe('decodeMsDate', () => {
  it('decodes a /Date(ms)/ string to its year', () => {
    // 2024-01-01T00:00:00Z
    expect(decodeMsDate('/Date(1704067200000)/')).toBe(2024);
  });
  it('decodes a negative (pre-1970) epoch without throwing', () => {
    expect(decodeMsDate('/Date(-86400000)/')).toBe(1969);
  });
  it('returns null for a non-date string rather than guessing', () => {
    expect(decodeMsDate('2024-01-01')).toBeNull();
    expect(decodeMsDate(null)).toBeNull();
  });
});

describe('searchReportsUrl', () => {
  // The endpoint 500s unless ALL SEVEN booleans are present, and it reads
  // `pageNumber`, not `page`. Both facts are load-bearing, so they are asserted.
  const REQUIRED = ['HasFindings', 'StateGovernment', 'LocalGovernment',
    'PerformanceAudits', 'SpecialInvestigations',
    'UseOfDeadlyForceInvestigation', 'PoliceCertificationAudit'];

  it('includes all seven required boolean params', () => {
    const u = new URL(searchReportsUrl('0461'));
    for (const k of REQUIRED) expect(u.searchParams.has(k)).toBe(true);
  });
  it('uses pageNumber, not page', () => {
    const u = new URL(searchReportsUrl('0461'));
    expect(u.searchParams.get('pageNumber')).toBe('1');
    expect(u.searchParams.has('page')).toBe(false);
  });
  it('passes the MCAG via MCAGList', () => {
    expect(new URL(searchReportsUrl('0132')).searchParams.get('MCAGList')).toBe('0132');
  });
});

describe('entityLookupUrl / reportFileUrl', () => {
  it('builds the entity lookup with the name as a query param', () => {
    expect(new URL(entityLookupUrl('Kitsap County')).searchParams.get('NameStartsWith'))
      .toBe('Kitsap County');
  });
  it('builds the report file url with isFinding=false', () => {
    const u = new URL(reportFileUrl(1040282));
    expect(u.searchParams.get('arn')).toBe('1040282');
    expect(u.searchParams.get('isFinding')).toBe('false');
  });
});

describe('classifyReport', () => {
  // SAO's report-type NAMES are inverted for FY2014+: the type called
  // "Annual Comprehensive Financial Report" is a 4-5pp opinion letter while
  // "Financial and Federal" carries the statements. So selection is by
  // CONTENT. This is the guard that would have caught King County in v2.21.
  const STMT = 'Statement of Revenues, Expenditures, and Changes in Fund Balance\n'
             + 'Governmental Funds\nTotal Revenues 24,379,173';

  it('accepts a long report containing a governmental funds statement', () => {
    expect(classifyReport(76, STMT).ok).toBe(true);
  });
  it('rejects a short opinion letter even if it mentions the statement', () => {
    expect(classifyReport(4, STMT).ok).toBe(false);
    expect(classifyReport(4, STMT).reason).toMatch(/page count/i);
  });
  it('rejects a long report with no statement anchor (an image-only scan)', () => {
    const r = classifyReport(52, 'Independent Auditor\'s Report');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/statement/i);
  });
  it('does not accept a Reconciliation line as the statement anchor', () => {
    const r = classifyReport(80,
      'Reconciliation of the Statement of Revenues, Expenditures and Changes in Fund Balance');
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/waSao.test.mjs`
Expected: FAIL — cannot resolve `../scripts/lib/waSao.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/waSao.mjs`:

```javascript
#!/usr/bin/env node
/**
 * WA State Auditor ReportSearch client, generic over MCAG.
 *
 * Endpoint facts, each established by probing and each load-bearing:
 *  - SearchReports reads `pageNumber`, NOT `page`.
 *  - SearchReports 500s unless ALL SEVEN of the boolean filters are present,
 *    even though six of them are irrelevant to a financial-report query.
 *  - Audit periods arrive as `/Date(<epoch-ms>)/`. String-slicing that format
 *    silently truncates; it must be parsed.
 *  - Plain curl/fetch with a browser UA is enough. No WAF fight, no Chromium.
 *
 * The report-type NAMES are inverted for FY2014+: the type literally called
 * "Annual Comprehensive Financial Report" is a 4-5 page auditor's opinion
 * letter, while "Financial and Federal" / "Financial" carries the full bound
 * statements. Never select by type name -- use classifyReport().
 */
const BASE = 'https://portal.sao.wa.gov/ReportSearch/Home';

export const SAO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  'Upgrade-Insecure-Requests': '1',
};

export function decodeMsDate(value) {
  if (typeof value !== 'string') return null;
  const m = /\/Date\((-?\d+)/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1])).getUTCFullYear();
}

export function entityLookupUrl(nameStartsWith) {
  const u = new URL(`${BASE}/GetEntities`);
  u.searchParams.set('NameStartsWith', nameStartsWith);
  return u.href;
}

export function searchReportsUrl(mcag, pageNumber = 1) {
  const u = new URL(`${BASE}/SearchReports`);
  u.searchParams.set('MCAGList', mcag);
  u.searchParams.set('pageNumber', String(pageNumber));
  // All seven are required or the endpoint 500s. Do not prune this list.
  for (const [k, v] of Object.entries({
    HasFindings: 'false', StateGovernment: 'false', LocalGovernment: 'true',
    PerformanceAudits: 'false', SpecialInvestigations: 'false',
    UseOfDeadlyForceInvestigation: 'false', PoliceCertificationAudit: 'false',
  })) u.searchParams.set(k, v);
  return u.href;
}

export function reportFileUrl(arn) {
  const u = new URL(`${BASE}/ViewReportFile`);
  u.searchParams.set('arn', String(arn));
  u.searchParams.set('isFinding', 'false');
  u.searchParams.set('sp', 'false');
  return u.href;
}

const MIN_STATEMENT_PAGES = 40;

/**
 * Content guard. An opinion-letter-only report and an image-only scan are both
 * rejected here rather than downstream, so a bad year fails loudly at fetch
 * time instead of producing a plausible-looking empty extraction.
 *
 * The "Reconciliation of the Statement of Revenues, Expenditures..." line is
 * a decoy that appears in every report including the 4-page letters, so it is
 * excluded before the anchor test rather than after.
 */
export function classifyReport(pageCount, text) {
  if (!(pageCount >= MIN_STATEMENT_PAGES)) {
    return { ok: false, reason: `page count ${pageCount} < ${MIN_STATEMENT_PAGES} (opinion letter, not statements)` };
  }
  const anchored = String(text)
    .split('\n')
    .filter(l => !/reconciliation/i.test(l))
    .some(l => /statement of revenues,?\s+expenditures/i.test(l));
  if (!anchored) {
    return { ok: false, reason: 'no governmental funds statement anchor found (image-only scan?)' };
  }
  return { ok: true, reason: 'statements present' };
}

export async function fetchReportPdf(arn) {
  const res = await fetch(reportFileUrl(arn), { headers: SAO_HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ARN ${arn}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Magic-number check, not status code: a miss can answer 200 with HTML.
  if (buf.subarray(0, 4).toString() !== '%PDF') {
    throw new Error(`ARN ${arn}: not a PDF (${buf.length}B)`);
  }
  return buf;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/waSao.test.mjs`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/waSao.mjs tests/waSao.test.mjs
git commit -m "feat: MCAG-generic WA SAO ReportSearch client

Encodes the endpoint contract once: pageNumber not page, all seven
boolean filters required or it 500s, /Date(ms)/ decoding.

classifyReport() selects by CONTENT, not by AuditTypeName, because
SAO's type names are inverted for FY2014+ -- the type called 'Annual
Comprehensive Financial Report' is the 4-5pp opinion letter while
'Financial and Federal' carries the statements. This is the guard that
would have caught King County's opinion-letter trap in v2.21
mechanically rather than by hand.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Fetch all 42 source PDFs

**Files:**
- Create: `scripts/fetchBainbridgeKitsap.mjs`
- Modify: `.gitignore` (only if `docs/*` does not already cover the new dirs — verify with `git check-ignore -v docs/BainbridgeIsland/x.pdf`)

**Interfaces:**
- Consumes: `fetchReportPdf`, `classifyReport`, `reportFileUrl` from `scripts/lib/waSao.mjs`.
- Produces: `BAINBRIDGE_ARNS: Record<number, number>`, `KITSAP_ARNS: Record<number, number>`, both exported; PDFs at `docs/BainbridgeIsland/bainbridge-<FY>-acfr.pdf` and `docs/KitsapCounty/kitsap-<FY>-acfr.pdf`.

- [ ] **Step 1: Write the fetcher**

Create `scripts/fetchBainbridgeKitsap.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Downloads WA SAO bound financial statements for Bainbridge Island (MCAG 0461)
 * and Kitsap County (MCAG 0132) into gitignored docs/ directories.
 *
 * ARNs were resolved by probing SearchReports for each MCAG and are pinned here
 * so a load is reproducible and reviewable. Every downloaded file is passed
 * through classifyReport() -- an ARN that turns out to be an opinion letter or
 * a scan fails loudly rather than yielding an empty extraction later.
 *
 * Bainbridge FY2006 is deliberately absent: its only filing (ARN 73415) is an
 * image-only scan (36,698 chars over 52 pages, zero readable revenue labels).
 * Kitsap stops at FY2024 because FY2025 is not yet audited.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { fetchReportPdf, classifyReport } from './lib/waSao.mjs';

// MCAG 0461 -- City of Bainbridge Island. FY2006 (ARN 73415) excluded: scan.
export const BAINBRIDGE_ARNS = {
  2004: 69788,   2005: 72209,   2007: 1000370, 2008: 1002863, 2009: 1004976,
  2010: 1006518, 2011: 1008424, 2012: 1010907, 2013: 1012614, 2014: 1014609,
  2015: 1017006, 2016: 1019388, 2017: 1021673, 2018: 1024177, 2019: 1026890,
  2020: 1029122, 2021: 1030857, 2022: 1032975, 2023: 1035299, 2024: 1037954,
  2025: 1040282,
};

// MCAG 0132 -- Kitsap County. Only FY2005/2013/2024 were probed during scoping;
// every other ARN is unverified and must clear the content guard below.
export const KITSAP_ARNS = {
  2004: 69287,   2005: 71281,   2006: 73517,   2007: 75398,   2008: 1001808,
  2009: 1004318, 2010: 1006489, 2011: 1008368, 2012: 1010062, 2013: 1012226,
  2014: 1014660, 2015: 1017209, 2016: 1019584, 2017: 1021897, 2018: 1024403,
  2019: 1027313, 2020: 1029638, 2021: 1031693, 2022: 1033213, 2023: 1035480,
  2024: 1038058,
};

function pageCount(pdfPath) {
  const out = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const m = /^Pages:\s+(\d+)/m.exec(out);
  if (!m) throw new Error(`pdfinfo gave no page count for ${pdfPath}`);
  return Number(m[1]);
}

function pdfText(pdfPath) {
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

async function fetchOne(arn, dest) {
  if (!(existsSync(dest) && statSync(dest).size > 100_000)) {
    writeFileSync(dest, await fetchReportPdf(arn));
  }
  const verdict = classifyReport(pageCount(dest), pdfText(dest));
  if (!verdict.ok) throw new Error(`ARN ${arn} rejected: ${verdict.reason}`);
  return `${(statSync(dest).size / 1e6).toFixed(1)} MB — ${verdict.reason}`;
}

const SETS = [
  ['docs/BainbridgeIsland', BAINBRIDGE_ARNS, 'bainbridge'],
  ['docs/KitsapCounty',     KITSAP_ARNS,     'kitsap'],
];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failures = 0;
  for (const [dir, arns, prefix] of SETS) {
    mkdirSync(dir, { recursive: true });
    for (const fy of Object.keys(arns).map(Number).sort((a, b) => b - a)) {
      const dest = `${dir}/${prefix}-${fy}-acfr.pdf`;
      try { console.log(`${prefix} FY${fy}: ${await fetchOne(arns[fy], dest)}`); }
      catch (e) { failures++; console.error(`${prefix} FY${fy}: FAILED — ${e.message}`); }
    }
  }
  if (failures) { console.error(`\n${failures} file(s) failed the content guard.`); process.exit(1); }
}
```

- [ ] **Step 2: Run it**

Run: `node scripts/fetchBainbridgeKitsap.mjs`
Expected: 42 lines, each reporting a size and "statements present".

**If any Kitsap year fails the content guard**, that ARN is the wrong report for that year. Re-query `searchReportsUrl('0132')`, find the sibling ARN for the same audit period, correct the manifest, and re-run. Do not delete the year to make the run green — a missing year must reach the spec's exclusion list with a stated reason, not vanish.

- [ ] **Step 3: Record the result**

Note in the commit message which Kitsap ARNs (if any) had to be corrected from the pinned manifest. This is the plan's one genuinely unverified input.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetchBainbridgeKitsap.mjs
git commit -m "feat: fetch Bainbridge Island + Kitsap County SAO filings

42 pinned ARNs (21 per entity), each gated by classifyReport() on
download so an opinion letter or a scan fails at fetch time.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Seed the two municipality rows

**Files:**
- Create: `scripts/seedBainbridgeKitsap.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: two rows in `treasury.municipalities`; exports `BAINBRIDGE_NAME = 'Bainbridge Island'`, `KITSAP_NAME = 'Kitsap County'`.

**Schema note.** `treasury.municipalities` columns are `id` (uuid, defaulted), `name`, `state`, `entity_type`, `population`, `population_year`, `county_id`, plus `hero_image_url`, `geo_id`, `created_at`, `updated_at`. Seattle, King County and the Washington state node all carry `geo_id = NULL` and `hero_image_url = NULL`, so both new rows follow that precedent — do not invent FIPS codes.

- [ ] **Step 1: Get the populations from the authority**

Open the WA OFM April 1, 2025 official population estimates (city and county tables) at
`https://ofm.wa.gov/data-research/population-demographics/estimates/april-1-official/`
and read off the values for **Bainbridge Island city** and **Kitsap County**.

Record both numbers and the exact table you read them from in the commit message. Do not use a third-party estimate — figures circulating for Bainbridge span 24,046–24,963, which is far too wide a spread to guess at, and the population feeds the per-capita units guard in Task 8.

- [ ] **Step 2: Write the seeder**

Create `scripts/seedBainbridgeKitsap.mjs`. Fill `POPULATION` and `POPULATION_YEAR` from Step 1:

```javascript
#!/usr/bin/env node
/**
 * Creates the Kitsap County and Bainbridge Island rows in treasury.municipalities.
 *
 * Order matters: Kitsap must exist first so Bainbridge.county_id can point at it.
 * Idempotent -- re-running updates the existing rows rather than duplicating.
 *
 * geo_id and hero_image_url are left NULL, matching Seattle, King County and the
 * Washington state node.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent is fine */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

export const KITSAP_NAME = 'Kitsap County';
export const BAINBRIDGE_NAME = 'Bainbridge Island';

// TASK 3 STEP 1: replace both with the WA OFM April 1, 2025 figures.
const POPULATION = { [KITSAP_NAME]: null, [BAINBRIDGE_NAME]: null };
const POPULATION_YEAR = 2025;

async function upsertEntity({ name, entityType, countyId }) {
  const population = POPULATION[name];
  if (!Number.isInteger(population)) {
    throw new Error(`POPULATION[${name}] is not set — read it from WA OFM first (Task 3 Step 1).`);
  }
  const { data: existing } = await db.from('municipalities')
    .select('id').eq('name', name).eq('state', 'WA').maybeSingle();

  const row = { name, state: 'WA', entity_type: entityType, population,
                population_year: POPULATION_YEAR, county_id: countyId };

  const q = existing
    ? db.from('municipalities').update(row).eq('id', existing.id).select().single()
    : db.from('municipalities').insert(row).select().single();
  const { data, error } = await q;
  if (error) throw new Error(`${name}: ${error.message}`);
  console.log(`  ${existing ? 'Updated' : 'Created'} ${name} (${entityType}) ${data.id} pop ${population.toLocaleString()}`);
  return data.id;
}

const kitsapId = await upsertEntity({ name: KITSAP_NAME, entityType: 'county', countyId: null });
await upsertEntity({ name: BAINBRIDGE_NAME, entityType: 'city', countyId: kitsapId });

// Guard against the Utah phantom-row defect: a county load run without the
// county entity type silently creates a second, city-typed row of the same name.
const { data: all } = await db.from('municipalities')
  .select('name, entity_type').eq('state', 'WA').in('name', [KITSAP_NAME, BAINBRIDGE_NAME]);
if (all.length !== 2) {
  console.error(`Expected exactly 2 rows, found ${all.length}:`, all);
  process.exit(1);
}
console.log('\nSeed OK.');
```

- [ ] **Step 3: Run it**

Run: `node scripts/seedBainbridgeKitsap.mjs`
Expected: two "Created" lines, then `Seed OK.`

- [ ] **Step 4: Verify in the database**

```sql
select m.name, m.entity_type, m.population, m.population_year, c.name as county
from treasury.municipalities m
left join treasury.municipalities c on c.id = m.county_id
where m.state = 'WA' order by m.name;
```
Expected: 4 rows. `Bainbridge Island` shows `county = Kitsap County`; `Kitsap County` shows `county = null`.

- [ ] **Step 5: Commit**

```bash
git add scripts/seedBainbridgeKitsap.mjs
git commit -m "feat: seed Kitsap County + Bainbridge Island municipality rows

Populations from the WA OFM April 1, 2025 official estimates.
Bainbridge.county_id -> Kitsap. Asserts exactly two rows exist, which
is the guard against the Utah phantom-city-row defect.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Bainbridge extractor

**Files:**
- Create: `scripts/extractBainbridge.py`
- Modify: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Consumes: `CityConfig`, `run_cli`, `build_revenue`, `build_operating`, `anchors` from `scripts/lib/acfrGF.py`.
- Produces: `scripts/extractBainbridge.py` CLI —
  `py -3 scripts/extractBainbridge.py <pdf> --mode {operating,revenue}` → JSON with keys
  `fiscal_year, mode, statement_page, tree, computed_total, printed_total, tie_delta, source_rounding_accepted, zero_rows`.

**Observed FY2025 statement shape** (transcribed from `docs/BainbridgeIsland/bainbridge-2025-acfr.pdf`): whole dollars, single page, GF is the leftmost money column, four fund columns plus a total. Revenue side is flat (no `Taxes:` parent). Expenditure side has a `Current` group header, with `Debt Service - Principal`, `Debt Service - Interest` and `Capital Outlay` as flat root leaves. `Transportation` is a dash-zero in the GF column.

- [ ] **Step 1: Write the failing selftest cases**

Append to `scripts/lib/acfrGF.selftest.py`:

```python
# ── Bainbridge Island shape ──────────────────────────────────────────────────
# Transcribed from the FY2025 SAO-bound statement (whole dollars, GF leftmost).
# Bainbridge does NOT group its revenue side -- there is no `Taxes:` parent --
# which is why BI_CFG leaves revenue_parents empty while Seattle/King County
# set it. Setting it here would look for a group that does not exist.
BI_REV_LINES = [
    'REVENUES',
    'Property Taxes                    8,612,126    -            -        (64)        8,612,062',
    'Sales, Business, and Excise Taxes 12,532,083   786,774      -        5,109,974   18,428,831',
    'Licenses and Permits              669,376      37,063       -        -           706,439',
    'Total Revenues                    24,379,173   1,298,666    208,542  6,340,722   32,227,102',
]
BI_REV_ANCHOR = BI_REV_LINES[-1]

BI_EXP_LINES = [
    'EXPENDITURES',
    'Current',
    'General Government                7,996,984    577,779      -        -           8,574,762',
    'Transportation                    -            3,344,813    -        -           3,344,813',
    'Debt Service - Principal          30,508       -            -        668,665     699,173',
    'Capital Outlay                    133,497      -            4,809,336 -          4,942,833',
    'Total Expenditures                20,801,297   4,090,263    4,809,336 1,996,401  31,697,296',
]
BI_EXP_ANCHOR = BI_EXP_LINES[-1]


def _bi_cfg(**kw):
    base = dict(city='Bainbridge Island, WA',
                parents=('current',),
                root_leaves=('debt service', 'capital outlay'),
                column_strategy='ordinal', units=1, fy_end=('December', 31))
    base.update(kw)
    return CityConfig(**base)


class TestBainbridgeShape(unittest.TestCase):
    def test_revenue_side_is_flat_with_no_tax_parent(self):
        tree, total, _ = build_revenue(BI_REV_LINES, anchors(BI_REV_ANCHOR), _bi_cfg())
        self.assertEqual([c['n'] for c in tree['c']],
                         ['Property Taxes', 'Sales, Business, and Excise Taxes',
                          'Licenses and Permits'])
        self.assertEqual(total, 8612126 + 12532083 + 669376)

    def test_capital_outlay_and_debt_service_are_root_leaves_not_children_of_current(self):
        tree, _, _ = build_operating(BI_EXP_LINES, anchors(BI_EXP_ANCHOR), _bi_cfg())
        roots = [c['n'] for c in tree['c']]
        self.assertIn('Current', roots)
        self.assertIn('Capital Outlay', roots)
        self.assertIn('Debt Service - Principal', roots)

    def test_dash_zero_transportation_keeps_its_own_label(self):
        # The Bend trap: a dash-zero can graft its label onto the NEXT row while
        # tie_delta stays $0, so the tie can never detect it. Assert the label.
        tree, _, zero_rows = build_operating(BI_EXP_LINES, anchors(BI_EXP_ANCHOR), _bi_cfg())
        current = next(c for c in tree['c'] if c['n'] == 'Current')
        labels = [i['n'] for i in current.get('i', [])] + [c['n'] for c in current.get('c', [])]
        self.assertIn('Transportation', labels)
        self.assertNotIn('Transportation Debt Service - Principal', labels)

    def test_units_are_whole_dollars_not_thousands(self):
        # Bainbridge prints whole dollars, unlike Seattle/King County. The tie is
        # unit-invariant and cannot catch a wrong multiplier, so assert it here.
        _, total, _ = build_revenue(BI_REV_LINES, anchors(BI_REV_ANCHOR), _bi_cfg())
        self.assertEqual(total, 21813585)
        self.assertGreater(total, 1_000_000)
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `npm run test:acfr`
Expected: FAIL on the `TestBainbridgeShape` cases.

- [ ] **Step 3: Write the extractor config**

Create `scripts/extractBainbridge.py`:

```python
#!/usr/bin/env python3
"""
City of Bainbridge Island, WA — General Fund extractor (GAAP actuals).

Thin wrapper over scripts/lib/acfrGF.py.

Source is the WA State Auditor's bound financial statements, not a
self-published ACFR: SAO binds full statements for every filer except large
GAAP filers that publish their own (Seattle, King County). Every year
FY2004-FY2025 is available from one host under one URL pattern.

Bainbridge specifics
--------------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1 (the default). Opposite of Seattle and
  King County, which print "(IN THOUSANDS)". The tie gate is unit-invariant and
  reads $0 either way, so this is checked by the selftest and by the loader's
  per-capita guard, never by the tie.
* Statement is on ONE page with the General Fund as the leftmost money column.
* Revenue side is FLAT -- there is no `Taxes:` parent, so revenue_parents stays
  empty. Setting it would hunt for a group this issuer does not print.
* Expenditure tree: `Current` is the only parent; `Debt Service - Principal`,
  `Debt Service - Interest` and `Capital Outlay` are VALUED ROOT LEAVES.
* `Transportation` is a dash-zero in the GF column in FY2025 and neighbouring
  years -- handled by the library, asserted by the selftest.
* FY2006 has no usable filing (image-only scan) and is excluded upstream in
  scripts/fetchBainbridgeKitsap.mjs.

Usage:
  py -3 scripts/extractBainbridge.py "docs/BainbridgeIsland/bainbridge-2025-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Bainbridge Island, WA',
    parents=('current',),
    root_leaves=('debt service', 'capital outlay'),
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='ordinal',
    units=1,
    fy_end=('December', 31),
    source_rounding={},   # Task 7 registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
```

- [ ] **Step 4: Run the selftest to verify it passes**

Run: `npm run test:acfr`
Expected: PASS, all cases including `TestBainbridgeShape`.

- [ ] **Step 5: Run the extractor against three real years**

```bash
py -3 scripts/extractBainbridge.py "docs/BainbridgeIsland/bainbridge-2025-acfr.pdf" --mode revenue
py -3 scripts/extractBainbridge.py "docs/BainbridgeIsland/bainbridge-2025-acfr.pdf" --mode operating
py -3 scripts/extractBainbridge.py "docs/BainbridgeIsland/bainbridge-2013-acfr.pdf" --mode revenue
py -3 scripts/extractBainbridge.py "docs/BainbridgeIsland/bainbridge-2004-acfr.pdf" --mode revenue
```

Expected for FY2025 revenue: `fiscal_year: 2025`, `computed_total: 24379173`, `tie_delta: 0`.
Expected for FY2025 operating: `computed_total: 20801296`, `printed_total: 20801297`, **`tie_delta: -1`** — this is the known residue; it is adjudicated in Task 7, not here. Do not add a `source_rounding` entry yet.

If FY2004 or FY2013 fails to locate the statement, capture the error and the page text, and record it — the early era may need a `statement_anchor`. Fix it here before moving on.

- [ ] **Step 6: Commit**

```bash
git add scripts/extractBainbridge.py scripts/lib/acfrGF.selftest.py
git commit -m "feat: Bainbridge Island GF extractor config

Whole dollars (units=1), flat revenue side with no Taxes parent,
Current as the only expenditure parent with debt service and capital
outlay as root leaves.

Selftest asserts the dash-zero label survives and that units are whole
dollars -- neither is detectable by the tie, which is unit-invariant.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Kitsap County extractor

**Files:**
- Create: `scripts/extractKitsap.py`
- Modify: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Consumes: `CityConfig`, `run_cli`, `build_revenue`, `build_operating`, `anchors` from `scripts/lib/acfrGF.py`.
- Produces: `py -3 scripts/extractKitsap.py <pdf> --mode {operating,revenue}` → same JSON keys as Task 4.

**Observed FY2024 statement shape**: whole dollars; statement splits over two pages with the GF column and both `Total` rows wholly on page 1 (the King County shape, handled by `find_statement_page` returning the earliest qualifying page). County vocabulary with ampersands — `Retail Sales & Use Taxes`, `Fines & Forfeits`, `Intergovernmental Service`. Revenue side is FLAT (no `Taxes:` parent — unlike King County). `Current` and `Debt Service` are parents; `Capital Outlay` is a root leaf. `Transportation`, `Health & Human Services` and `Economic Environment` are dash-zeros in the GF column.

- [ ] **Step 1: Write the failing selftest cases**

Append to `scripts/lib/acfrGF.selftest.py`:

```python
# ── Kitsap County shape ──────────────────────────────────────────────────────
# Transcribed from the FY2024 SAO-bound statement. County vocabulary uses
# ampersands and differs from every TT city -- the Ohio-AOS county-vs-city
# lesson holding again for ACFRs.
KITSAP_REV_LINES = [
    'Revenues',
    'Property Taxes                 39,113,858   -            -            -',
    'Retail Sales & Use Taxes       44,690,283   -            -            -',
    'Other Taxes                    2,627,819    8,697,831    -            -',
    'Fines & Forfeits               1,559,156    -            -            -',
    'Total Revenues                 125,581,123  9,569,454    20,869,258   6,398,908',
]
KITSAP_REV_ANCHOR = KITSAP_REV_LINES[-1]

KITSAP_EXP_LINES = [
    'Expenditures',
    'Current',
    'General Government             31,292,474   -            3,984,263    -',
    'Transportation                 -            -            -            -',
    'Health & Human Services        -            -            3,952,076    1,095,960',
    'Debt Service',
    'Principal                      442,709      -            -            -',
    'Interest & Other Charges       35,340       550          -            -',
    'Capital Outlay                 330,568      -            12,932,919   -',
    'Total Expenditures             128,230,878  550          20,869,258   1,095,960',
]
KITSAP_EXP_ANCHOR = KITSAP_EXP_LINES[-1]


def _kitsap_cfg(**kw):
    base = dict(city='Kitsap County, WA',
                parents=('current', 'debt service'),
                root_leaves=('capital outlay',),
                column_strategy='ordinal', units=1, fy_end=('December', 31))
    base.update(kw)
    return CityConfig(**base)


class TestKitsapShape(unittest.TestCase):
    def test_ampersand_labels_survive_intact(self):
        tree, _, _ = build_revenue(KITSAP_REV_LINES, anchors(KITSAP_REV_ANCHOR), _kitsap_cfg())
        names = [c['n'] for c in tree['c']]
        self.assertIn('Retail Sales & Use Taxes', names)
        self.assertIn('Fines & Forfeits', names)

    def test_revenue_side_is_flat_despite_taxes_suffixed_labels(self):
        # Three labels end in "Taxes" but there is no `Taxes:` parent row, so
        # revenue_parents must stay EMPTY. King County prints the parent and
        # Kitsap does not -- these are different documents, not two readings.
        tree, total, _ = build_revenue(KITSAP_REV_LINES, anchors(KITSAP_REV_ANCHOR), _kitsap_cfg())
        self.assertEqual(len(tree['c']), 4)
        self.assertNotIn('Taxes', [c['n'] for c in tree['c']])
        self.assertEqual(total, 39113858 + 44690283 + 2627819 + 1559156)

    def test_debt_service_is_a_parent_and_capital_outlay_is_a_root_leaf(self):
        tree, _, _ = build_operating(KITSAP_EXP_LINES, anchors(KITSAP_EXP_ANCHOR), _kitsap_cfg())
        roots = [c['n'] for c in tree['c']]
        self.assertIn('Debt Service', roots)
        self.assertIn('Capital Outlay', roots)
        debt = next(c for c in tree['c'] if c['n'] == 'Debt Service')
        child_names = [i['n'] for i in debt.get('i', [])] + [c['n'] for c in debt.get('c', [])]
        self.assertIn('Principal', child_names)
        self.assertIn('Interest & Other Charges', child_names)

    def test_consecutive_dash_zeros_do_not_merge_labels(self):
        # Transportation, Health & Human Services and Economic Environment are
        # all dash-zero in the GF column. Consecutive dash-zeros are the worst
        # case for label grafting and tie_delta stays $0 throughout.
        tree, _, _ = build_operating(KITSAP_EXP_LINES, anchors(KITSAP_EXP_ANCHOR), _kitsap_cfg())
        current = next(c for c in tree['c'] if c['n'] == 'Current')
        labels = [i['n'] for i in current.get('i', [])] + [c['n'] for c in current.get('c', [])]
        self.assertIn('Transportation', labels)
        self.assertIn('Health & Human Services', labels)
        for l in labels:
            self.assertNotRegex(l, r'Transportation\s+Health')
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `npm run test:acfr`
Expected: FAIL on `TestKitsapShape`.

- [ ] **Step 3: Write the extractor config**

Create `scripts/extractKitsap.py`:

```python
#!/usr/bin/env python3
"""
Kitsap County, WA — General Fund extractor (GAAP actuals).

Thin wrapper over scripts/lib/acfrGF.py.

Source is the WA State Auditor's bound financial statements (MCAG 0132).
Kitsap is large enough to publish its own ACFR on kitsap.gov, yet SAO STILL
binds its full statements -- which is what disproved v2.21's over-general
"SAO does not publish local-government financial statements" finding. The
kitsap.gov copy is retained as an INDEPENDENT re-derivation oracle, not as
the load source.

Kitsap specifics
----------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1.
* Statement splits across two pages; the GF column and both Total rows are
  wholly on page 1, so find_statement_page's earliest-qualifying-page rule is
  correct here (same as King County).
* Revenue side is FLAT. Three labels END in "Taxes" ("Retail Sales & Use
  Taxes") but there is NO `Taxes:` parent row, so revenue_parents stays empty
  -- the opposite of King County, which does print the parent.
* Expenditure tree is the Bend/Tualatin/King County shape: `Current` and
  `Debt Service` are parents, `Capital Outlay` is a VALUED ROOT LEAF.
* County vocabulary uses AMPERSANDS: `Retail Sales & Use Taxes`,
  `Fines & Forfeits`, `Health & Human Services`, `Interest & Other Charges`.
* Dash-zeros in the GF column on Transportation, Health & Human Services and
  Economic Environment -- three CONSECUTIVE dash-zero rows in FY2024.
* Kitsap's extracted text collapses spaces in some headings
  ("KitsapCounty,Washington", "FortheYearEndedDecember31,2024"). This matters
  for fiscal-year parsing: acfrGF.parse_fy already widens the month/day gap to
  `\\s*` for exactly this failure mode (found on King County FY2024/FY2025).

Usage:
  py -3 scripts/extractKitsap.py "docs/KitsapCounty/kitsap-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Kitsap County, WA',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='ordinal',
    units=1,
    fy_end=('December', 31),
    source_rounding={},   # Task 7 registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
```

- [ ] **Step 4: Run the selftest to verify it passes**

Run: `npm run test:acfr`
Expected: PASS, all cases.

- [ ] **Step 5: Run the extractor against three real years**

```bash
py -3 scripts/extractKitsap.py "docs/KitsapCounty/kitsap-2024-acfr.pdf" --mode revenue
py -3 scripts/extractKitsap.py "docs/KitsapCounty/kitsap-2024-acfr.pdf" --mode operating
py -3 scripts/extractKitsap.py "docs/KitsapCounty/kitsap-2013-acfr.pdf" --mode operating
py -3 scripts/extractKitsap.py "docs/KitsapCounty/kitsap-2004-acfr.pdf" --mode operating
```

Expected for FY2024 operating: `computed_total: 128230878`, `tie_delta: 0`.
Expected for FY2024 revenue: `computed_total: 125581124`, `printed_total: 125581123`, **`tie_delta: 1`** — known residue, adjudicated in Task 7.

- [ ] **Step 6: Commit**

```bash
git add scripts/extractKitsap.py scripts/lib/acfrGF.selftest.py
git commit -m "feat: Kitsap County GF extractor config

Whole dollars, two-page statement with GF wholly on page 1, Current +
Debt Service as parents, Capital Outlay as a root leaf.

Revenue side is FLAT despite three labels ending in 'Taxes' -- Kitsap
prints no Taxes parent where King County does, so revenue_parents stays
empty. Selftest pins that distinction and asserts three consecutive
dash-zeros do not graft labels.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: FY2009 font recovery (bounded, may end in a documented drop)

**Files:**
- Create: `scripts/decodeSaoFont2009.py`

**Interfaces:**
- Consumes: nothing.
- Produces: either a decoded text file `docs/BainbridgeIsland/bainbridge-2009-statement.txt` that ties at $0, or a recorded decision to drop FY2009.

**Background.** `docs/BainbridgeIsland/bainbridge-2009-acfr.pdf` (ARN 1004976) has intact narrative text but its *statement pages* carry a font with no usable ToUnicode CMap. Digits render as punctuation — the FY2009 statement page emits fragments like `,$+%($&&'` and `.$#%*+#)',/`. The mapping is monoalphabetic, so it is decodable by frequency and structure.

**This task is time-boxed.** If the decode does not produce a $0 tie, FY2009 is dropped and the milestone ships 82 rows. Do not iterate indefinitely, and do not accept a "close" tie.

- [ ] **Step 1: Confirm the corruption is a substitution, not an image**

```bash
pdftotext -layout -f 17 -l 23 docs/BainbridgeIsland/bainbridge-2009-acfr.pdf -
pdffonts docs/BainbridgeIsland/bainbridge-2009-acfr.pdf
```

If the statement pages emit no characters at all, they are images and this task ends immediately — go to Step 5 and drop FY2009. If they emit garbage characters, continue.

- [ ] **Step 2: Build the candidate digit map**

Create `scripts/decodeSaoFont2009.py`:

```python
#!/usr/bin/env python3
"""
Throwaway decoder for the FY2009 Bainbridge Island SAO report (ARN 1004976).

Its statement pages use an embedded font with no usable ToUnicode CMap, so
pdftotext emits a monoalphabetic substitution of the real glyphs -- digits
come out as punctuation. Narrative pages in the same document are fine.

SELF-VALIDATING BY CONSTRUCTION: a candidate map is accepted only if the
decoded statement's own line items sum EXACTLY to its own decoded printed
total. A wrong map cannot produce a $0 tie except by coincidence across two
independent statements (revenue and expenditure), so the tie gate validates
the decoder rather than the decoder being trusted.

If no candidate ties, FY2009 is DROPPED. That is a valid outcome of this
script, not a failure to work around.

Usage:
  py -3 scripts/decodeSaoFont2009.py docs/BainbridgeIsland/bainbridge-2009-acfr.pdf
"""
import argparse
import re
import subprocess
import sys
from itertools import permutations

# Observed on the FY2009 statement pages. The document renders digits 0-9 as
# this run of punctuation/symbol glyphs; the ORDER is the hypothesis under
# test, and every ordering consistent with the observed alphabet is tried.
CIPHER_ALPHABET = "!\"#$%&'()*+,-./"


def page_text(pdf, first, last):
    return subprocess.run(
        ['pdftotext', '-layout', '-f', str(first), '-l', str(last), pdf, '-'],
        capture_output=True, text=True, check=True).stdout


def decode(text, mapping):
    return ''.join(mapping.get(ch, ch) for ch in text)


def statement_lines(text):
    """Rows that look like a label followed by grouped numerics."""
    out = []
    for line in text.split('\n'):
        if re.search(r'\d{1,3}(,\d{3})+', line):
            out.append(line)
    return out


def first_column_values(lines):
    vals = []
    for line in lines:
        m = re.search(r'(\d{1,3}(?:,\d{3})+)', line)
        if m:
            vals.append(int(m.group(1).replace(',', '')))
    return vals


def ties(values):
    """True if the last value equals the sum of the preceding ones."""
    return len(values) > 2 and sum(values[:-1]) == values[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--first', type=int, default=17)
    ap.add_argument('--last', type=int, default=23)
    args = ap.parse_args()

    raw = page_text(args.pdf, args.first, args.last)
    if not raw.strip():
        print('Statement pages emit no text at all -- these are images. '
              'FY2009 cannot be recovered by decoding. DROP IT.', file=sys.stderr)
        return 2

    symbols = [c for c in CIPHER_ALPHABET if c in raw]
    if len(symbols) < 10:
        print(f'Only {len(symbols)} candidate glyphs present ({"".join(symbols)}); '
              'not a 10-digit substitution. DROP FY2009.', file=sys.stderr)
        return 2

    for perm in permutations(symbols, 10):
        mapping = {ch: str(i) for i, ch in enumerate(perm)}
        decoded = decode(raw, mapping)
        vals = first_column_values(statement_lines(decoded))
        if ties(vals):
            print('CANDIDATE MAP TIES:', mapping)
            print(decoded)
            return 0

    print('No candidate substitution produced a self-consistent tie. '
          'DROP FY2009 and ship 82 rows.', file=sys.stderr)
    return 2


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 3: Run it**

Run: `py -3 scripts/decodeSaoFont2009.py docs/BainbridgeIsland/bainbridge-2009-acfr.pdf`

Exit 0 means a map tied — save the decoded statement to `docs/BainbridgeIsland/bainbridge-2009-statement.txt` and hand-check three line items against the rendered PDF page before trusting it. Exit 2 means FY2009 drops.

- [ ] **Step 4: If the decode succeeded, verify against the rendered page**

Open the PDF to the statement page in a viewer and read three GF values off the rendered page. They must match the decoded output exactly. **A tie alone is not sufficient here** — visual confirmation is required, because this is the one place in the pipeline where the characters themselves are being invented.

If the visual check fails, drop FY2009 regardless of the tie.

- [ ] **Step 5: Record the outcome**

Update `docs/superpowers/specs/2026-08-14-bainbridge-island-kitsap-onboarding-design.md`:
- If recovered: change the row count from "84 rows, or 82" to "84 rows" and note the decode is visually confirmed.
- If dropped: change to "82 rows", and add FY2009 to the "Known limitations" section with its reason.

Also remove FY2009 from `BAINBRIDGE_ARNS` in `scripts/fetchBainbridgeKitsap.mjs` if dropped.

- [ ] **Step 6: Commit**

```bash
git add scripts/decodeSaoFont2009.py docs/superpowers/specs/2026-08-14-bainbridge-island-kitsap-onboarding-design.md scripts/fetchBainbridgeKitsap.mjs
git commit -m "feat: bounded FY2009 font recovery for Bainbridge Island

Self-validating: a candidate substitution map is accepted only if the
decoded statement's line items sum exactly to its own decoded printed
total, then confirmed visually against the rendered page.

Outcome recorded in the spec. [State: recovered / dropped]

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Shared loader core

**Files:**
- Create: `scripts/lib/waSaoLoad.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks at import time; receives an entity descriptor at call time.
- Produces:
  ```
  loadEntity({
    entityName: string,        // 'Bainbridge Island' | 'Kitsap County'
    extractorScript: string,   // 'extractBainbridge.py' | 'extractKitsap.py'
    pdfDir: string,            // 'docs/BainbridgeIsland'
    pdfPrefix: string,         // 'bainbridge'
    fiscalYears: number[],
    population: number,
    perCapitaBand: [number, number],
    datasetIdPrefix: string,   // 'bainbridge-sao-gf'
    sourceUrlFor: (fy: number) => string,
    sanityMax: number,
    dryRun: boolean,
    targetFY: number | null,
  }) => Promise<{ loaded: number, failed: number }>
  ```

**Why a new file rather than reusing `processSeattle.js`.** `processSeattle.js` and `processKingCounty.js` are ~460 lines each and near-identical. Copying that shape twice more would leave four near-duplicates. Extracting the shared core into `scripts/lib/waSaoLoad.mjs` and leaving both v2.21 files untouched gets the reuse without any regression risk to Seattle or King County, which are shipped and verified.

**Read `scripts/processSeattle.js` in full before writing this.** It is the proven reference for `loadEnv`, `resolvePdfDir`, `discoverPdfsByFY`, `extractPDF`, `toBudgetTree`, the ephemeral `data_sources` lifecycle, the pre-load delete, the `treasury_sync_budget_tree` call and the source stamp. Port those, parameterised by the descriptor above.

**The per-capita band must be re-derived, not copied.** `processSeattle.js` uses `[500, 25000]`, which is correct for Seattle's ≈$3,065/resident. **That band would reject Kitsap**, whose GF runs ≈$465/resident ($128.2M over ≈275,600). Use `[100, 10000]` for both new entities: Bainbridge lands at ≈$832 and Kitsap at ≈$465, both comfortably inside, while a missing ×1000 lands at ≈$0.8/≈$0.5 and a spurious one at ≈$832,000/≈$465,000 — both still caught by three orders of magnitude.

- [ ] **Step 1: Read the reference implementation**

Run: `cat scripts/processSeattle.js`
Note the exact shapes of `toBudgetTree`, `createEphemeralDataSource`, `deleteEphemeralDataSource`, `loadFiscalYear` and `processMode`.

- [ ] **Step 2: Write `scripts/lib/waSaoLoad.mjs`**

Port the reference with these deltas, and no others:

1. Every Seattle-specific constant (`POPULATION`, `FYS`, `SANITY_MAX`, `SEATTLE_URLS`, the `seattle-acfr-gf-*` dataset ids, `docs/Seattle`, `extractSeattle.py`, the `^seattle-(\d{4})-acfr\.pdf$` filename regex) becomes a field on the descriptor.
2. The per-capita band comes from `perCapitaBand`, and its error message names the band it used.
3. The filename regex is built from `pdfPrefix`: `new RegExp('^' + pdfPrefix + '-(\\d{4})-acfr\\.pdf$', 'i')`.
4. `dataSourceLabel(fy, datasetType)` reads:
   `WA State Auditor — <entityName> Annual Financial Report FY<fy> (General Fund, <kind>)`
   where `kind` is `Revenue by Source` or `Expenditure by Function`.
5. `ensureMunicipality` looks the entity up by `name` + `state='WA'` rather than by a hard-coded id, and warns (does not fail) if the DB population differs from the descriptor's.
6. Keep the fiscal-year cross-check between the extractor's reported `fiscal_year` and the year in the PDF filename. Rows key on `(municipality_id, fiscal_year, dataset_type)`, so a wrong year silently overwrites a different year's row.
7. Keep the ephemeral `data_sources` create/delete in a `try`/`finally`, and keep internal hard-fails as `throw` rather than `process.exit()` so the `finally` always runs.

- [ ] **Step 3: Verify it imports cleanly**

Run: `node -e "import('./scripts/lib/waSaoLoad.mjs').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'loadEntity' ]`

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/waSaoLoad.mjs
git commit -m "feat: shared WA SAO loader core

Ports the proven processSeattle.js shape into a parameterised module so
Bainbridge and Kitsap do not become a third and fourth near-duplicate.
v2.21's loaders are deliberately left untouched -- no regression risk to
shipped, verified entities.

Per-capita band re-derived as [100, 10000]: Seattle's [500, 25000] would
REJECT Kitsap, whose GF runs ~\$465/resident.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Load both entities and adjudicate every residue

**Files:**
- Create: `scripts/processBainbridge.js`, `scripts/processKitsap.js`
- Modify: `scripts/extractBainbridge.py`, `scripts/extractKitsap.py` (only to register confirmed `source_rounding` entries)

**Interfaces:**
- Consumes: `loadEntity` from `scripts/lib/waSaoLoad.mjs`; `BAINBRIDGE_ARNS` / `KITSAP_ARNS` from `scripts/fetchBainbridgeKitsap.mjs`; `reportFileUrl` from `scripts/lib/waSao.mjs`.
- Produces: 84 (or 82) rows in `treasury.budgets`.

- [ ] **Step 1: Write the two thin loaders**

`scripts/processBainbridge.js`:

```javascript
#!/usr/bin/env node
/**
 * Loads Bainbridge Island, WA General Fund rows from WA SAO bound statements.
 * Thin driver over scripts/lib/waSaoLoad.mjs.
 *
 * Usage:
 *   node scripts/processBainbridge.js --dry-run
 *   node scripts/processBainbridge.js
 *   node scripts/processBainbridge.js --fy 2025
 */
import { loadEntity } from './lib/waSaoLoad.mjs';
import { BAINBRIDGE_ARNS } from './fetchBainbridgeKitsap.mjs';
import { reportFileUrl } from './lib/waSao.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');

const { loaded, failed } = await loadEntity({
  entityName: 'Bainbridge Island',
  extractorScript: 'extractBainbridge.py',
  pdfDir: 'docs/BainbridgeIsland',
  pdfPrefix: 'bainbridge',
  fiscalYears: Object.keys(BAINBRIDGE_ARNS).map(Number).sort((a, b) => a - b),
  // TASK 3: same WA OFM April 1, 2025 figure used in seedBainbridgeKitsap.mjs.
  population: null,
  // Seattle's [500, 25000] does not transfer -- see waSaoLoad.mjs.
  perCapitaBand: [100, 10_000],
  datasetIdPrefix: 'bainbridge-sao-gf',
  sourceUrlFor: fy => reportFileUrl(BAINBRIDGE_ARNS[fy]),
  sanityMax: 500_000_000,   // Bainbridge GF runs in the tens of millions.
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nBainbridge Island: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
```

`scripts/processKitsap.js` is the same with: `entityName: 'Kitsap County'`, `extractorScript: 'extractKitsap.py'`, `pdfDir: 'docs/KitsapCounty'`, `pdfPrefix: 'kitsap'`, `KITSAP_ARNS`, `datasetIdPrefix: 'kitsap-sao-gf'`, and `sanityMax: 2_000_000_000` (Kitsap GF runs in the low hundreds of millions).

Fill `population` in both from the Task 3 figures.

- [ ] **Step 2: Dry-run both**

```bash
node scripts/processBainbridge.js --dry-run
node scripts/processKitsap.js --dry-run
```

Expected: every FY prints an extraction with `tie_delta: 0`, except the two known residues (Bainbridge FY2025 operating `-1`, Kitsap FY2024 revenue `+1`) and any newly discovered ones.

- [ ] **Step 3: Adjudicate every non-zero residue individually**

For each `(entity, fy, mode)` with a non-zero `tie_delta`:

1. Open the source PDF to the reported `statement_page`.
2. Read the GF column's line items and its printed total off the **rendered page**, not the extracted text.
3. Decide:
   - **Sum of printed items ≠ printed total** → the document is internally inconsistent. Register it in that extractor's `source_rounding` as the EXACT delta for `(fy, mode)`.
   - **Sum of printed items = printed total** → the extractor mis-read a row. Fix the extractor. Do NOT register it.

`tie_delta` is `computed − printed`, so Bainbridge FY2025 operating registers as `-1` and Kitsap FY2024 revenue as `+1`. Both entities use `units=1`, so the delta is in whole dollars with no scaling.

Example, once confirmed, in `scripts/extractBainbridge.py`:

```python
    source_rounding={(2025, 'operating'): -1},
```

Add a comment above each entry naming the page you read and what you saw. An entry with no such comment is indistinguishable from a tolerance, which is the thing this mechanism exists to avoid.

- [ ] **Step 4: Re-run the dry-runs until every year is clean**

Every FY must show either `tie_delta: 0` or a `source_rounding_accepted` note. Any bare `TIE FAILURE` blocks the load.

- [ ] **Step 5: Load for real**

```bash
node scripts/processBainbridge.js
node scripts/processKitsap.js
```

- [ ] **Step 6: Verify the row count and that no ephemeral source leaked**

```sql
select m.name, b.dataset_type, count(*) as rows, min(b.fiscal_year), max(b.fiscal_year)
from treasury.budgets b join treasury.municipalities m on m.id = b.municipality_id
where m.state = 'WA' and m.name in ('Bainbridge Island','Kitsap County')
group by 1,2 order by 1,2;

select count(*) from treasury.data_sources
where dataset_id like 'bainbridge-sao-gf%' or dataset_id like 'kitsap-sao-gf%';
```

Expected: four groups of 21 (or Bainbridge 20 if FY2009 dropped); the `data_sources` count must be **0**.

- [ ] **Step 7: Commit**

```bash
git add scripts/processBainbridge.js scripts/processKitsap.js scripts/extractBainbridge.py scripts/extractKitsap.py
git commit -m "feat: load Bainbridge Island + Kitsap County GF rows

84 rows across FY2004-FY2025 / FY2004-FY2024. Every residue adjudicated
against the rendered statement page and registered as an exact
source_rounding delta or fixed as an extraction bug -- no widened
tolerance anywhere.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Blind re-derivation harness

**Files:**
- Create: `scripts/verify-bainbridge-rederive.mjs`

**Interfaces:**
- Consumes: the loaded rows; the source PDFs; the kitsap.gov independent copies.
- Produces: exit 0 when every loaded row re-derives to $0 from an independently written reader.

**The hard constraint: this file must NOT import `scripts/lib/acfrGF.py`, `extractBainbridge.py`, `extractKitsap.py`, or `scripts/lib/waSaoLoad.mjs`.** It reads the PDFs with its own logic. A harness that shares the extractor's code proves only that the extractor is self-consistent. Read `scripts/verify-seattle-rederive.mjs` for the established shape.

- [ ] **Step 1: Read the reference harness**

Run: `cat scripts/verify-seattle-rederive.mjs`

- [ ] **Step 2: Write the harness**

It must, for every loaded `(entity, fy, dataset_type)` row:

1. Run `pdftotext -layout -table` on the source PDF itself.
2. Locate the governmental funds statement with its own anchor logic (excluding `Reconciliation` lines).
3. Read the GF column with **both** a centre-in-band and an ordinal strategy, and require the two readings to agree. Report any disagreement as a failure — this is the trap v2.21 found, where Seattle left-aligns money columns and King County right-aligns them, so keying on either edge silently drops 1–2 digit values.
4. Compare the leaf sum **and** every subtotal against the loaded tree, not just the top-line total. A compensating pair of errors passes a total-only check.
5. Assert the row's `total` equals the sum of its own line items in the DB.

- [ ] **Step 3: Add the independent-document cross-check**

For Kitsap FY2018–FY2024, additionally download the **kitsap.gov** copy and re-derive from it:

```
https://www.kitsap.gov/auditor/Documents/financial/2024_Kitsap_County_Annual%20Comprehensive_Financial_Report.pdf
https://www.kitsap.gov/auditor/Documents/financial/2023_Kitsap_County_Annual_Comprehensive_Financial_Report.pdf
https://www.kitsap.gov/auditor/Documents/financial/2022_Kitsap_County_ACFR.pdf
https://www.kitsap.gov/auditor/Documents/financial/2021_Kitsap_County_ACFR_with_Bookmarks.pdf
https://www.kitsap.gov/auditor/Documents/financial/2020_Kitsap_County_ACFR_with_Bookmarks.pdf
https://www.kitsap.gov/auditor/Documents/financial/2019_Kitsap_County_CAFR_with_Bookmarks.pdf
https://www.kitsap.gov/auditor/Documents/financial/2018_Kitsap_County_CAFR_with_Bookmarks.pdf
```

These are physically different documents on a different host containing the same statements — a genuinely independent oracle, which v2.21 did not have. **A disagreement between the SAO copy and the kitsap.gov copy is a finding, not a rounding.** Report it and stop; do not pick whichever agrees with the loaded row.

Pre-2018 Kitsap years are sectioned on kitsap.gov and are out of scope for this cross-check — state that in the harness output rather than silently covering fewer years than it appears to.

- [ ] **Step 4: Run it**

Run: `node scripts/verify-bainbridge-rederive.mjs`
Expected: exit 0, every row re-derived at $0, and an explicit line stating how many years got the independent-document cross-check.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-bainbridge-rederive.mjs
git commit -m "test: blind re-derivation harness for Bainbridge + Kitsap

Imports none of the extractor code. Reads the GF column under both
centre-in-band and ordinal strategies and requires agreement, which is
the issuer-dependent column-alignment trap found in v2.21.

Kitsap FY2018-FY2024 additionally re-derive from the kitsap.gov copies
-- physically different documents on a different host. A disagreement
between the two is reported as a finding, not reconciled away.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Audit harness

**Files:**
- Create: `scripts/verify-bainbridge-audit.mjs`

**Interfaces:**
- Consumes: the loaded rows; `classifyReport` and `reportFileUrl` from `scripts/lib/waSao.mjs`; the ARN manifests.
- Produces: exit 0 when checks (a)–(g) all pass.

Read `scripts/verify-seattle-audit.mjs` for the established shape.

- [ ] **Step 1: Write the seven checks**

- **(a) Year coverage** — the set of loaded fiscal years equals the manifest exactly, per entity per dataset. A missing year fails; it does not warn.
- **(b) Tie integrity** — every row's stored `total` equals the sum of its line items. Any registered `source_rounding` entry is listed by name with its exact delta, so an exception is visible in the output rather than implied by its absence.
- **(c) Provenance** — every row has a non-null `source_url` that matches `reportFileUrl(ARN)` for that year, a `source_date`, and a `data_source` label. Record and re-verify each PDF's sha256.
- **(d) Units** — per-capita for every row is inside `[100, 10000]`. Print the actual value per entity so a drift is visible, not just a pass.
- **(e) Label integrity** — no leaf label contains another known label as a prefix (the dash-zero grafting signature), and no label is empty or purely numeric.
- **(f) Hierarchy** — `Bainbridge Island.county_id` → `Kitsap County`; exactly two WA rows exist with these names; neither has a duplicate of a different `entity_type`.
- **(g) Enrichment scoping** — every enrichment row written by this milestone has a non-NULL `municipality_id`.

- [ ] **Step 2: Scope every count to a municipality_id**

Any check that counts sources, archives or provenance classes must filter on `municipality_id`. v2.21's scoping asserted app-wide that archive citation was a new provenance class and was wrong — New Hampshire already had sixteen such rows. Write the SQL so an app-wide count is not expressible by accident.

- [ ] **Step 3: Run it**

Run: `node scripts/verify-bainbridge-audit.mjs`
Expected: exit 0, seven checks reported PASS with their evidence.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-bainbridge-audit.mjs
git commit -m "test: audit harness for Bainbridge + Kitsap

Seven checks: year coverage, tie integrity with named rounding
exceptions, provenance incl. sha256, per-capita units, label integrity,
hierarchy, enrichment scoping.

Every count is scoped to a municipality_id -- v2.21's app-wide archive
claim was false because New Hampshire already had 16 such rows.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Enrichment

**Files:**
- Create: `scripts/loadBainbridgeKitsapEnrichment.mjs`

**Interfaces:**
- Consumes: the two municipality ids.
- Produces: `category_enrichment` rows, each with a non-NULL `municipality_id`.

Read `scripts/loadSeattleEnrichment.mjs` for the established shape.

- [ ] **Step 1: Write the enrichment loader**

Mirror `loadSeattleEnrichment.mjs`, with these requirements:

1. **Every row carries a non-NULL `municipality_id`.** A NULL makes the row universal and bleeds text into unrelated cities — the defect that once leaked Indiana and California text app-wide. Because these rows are scoped, a normal upsert on `(name_key, municipality_id)` is correct; the delete-then-insert dance is only needed for NULL-municipality writes, where the index is NULLS DISTINCT.
2. **The GF-only limitation is stated explicitly, per entity.** For Bainbridge: General Fund spending of $20.8M in FY2025 sits within $31.7M across all governmental funds, and the water and sewer utilities are outside that again. For Kitsap: sanitary sewer, solid waste and surface water utilities are excluded. This must be in the text a reader sees, not left to be discovered.
3. **Name the source honestly** — these are the Washington State Auditor's bound financial statements, which is a stronger provenance claim than a self-published report and worth stating.

- [ ] **Step 2: Run it**

Run: `node scripts/loadBainbridgeKitsapEnrichment.mjs`

- [ ] **Step 3: Verify no NULL-scoped rows were created**

```sql
select municipality_id, count(*) from treasury.category_enrichment
where municipality_id in (
  select id from treasury.municipalities
  where state='WA' and name in ('Bainbridge Island','Kitsap County'))
group by 1;

select count(*) as null_scoped from treasury.category_enrichment where municipality_id is null;
```
The second query's result must not have increased from its pre-run value. Capture that value **before** Step 2.

- [ ] **Step 4: Commit**

```bash
git add scripts/loadBainbridgeKitsapEnrichment.mjs
git commit -m "feat: category enrichment for Bainbridge Island + Kitsap County

Every row scoped to a municipality_id. Text states the GF-only
limitation explicitly per entity rather than leaving a reader to find it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Tether harness and presentation

**Files:**
- Create: `scripts/verify-bainbridge-tether.mjs`

**Interfaces:**
- Consumes: the two municipality rows.
- Produces: exit 0 when both entities report COVERED.

- [ ] **Step 1: Write the tether harness**

Read `scripts/verify-seattle-tether.mjs` and mirror it for the two new entities. Both must report COVERED.

- [ ] **Step 2: Run it**

Run: `node scripts/verify-bainbridge-tether.mjs`
Expected: exit 0, both entities COVERED.

- [ ] **Step 3: Resolve the banner images**

`hero_image_url` is NULL for Seattle, King County and the Washington state node, so banners are **not** resolved through that column. Find the actual resolution path first:

```bash
grep -rn "hero_image_url\|buildingImages\|place-banner\|bannerFor" src/ scripts/ | head -30
```

Then mirror whatever Seattle uses, for Bainbridge Island and Kitsap County.

**Transcribe any image credit from Essentials' `buildingImages.js` — never infer it from a filename.** Rhode Island's comma-twin filename produced a wrong credit exactly this way.

If no banner asset exists for either entity, record that and leave them on the default rather than substituting an unrelated image.

- [ ] **Step 4: Run the full verification suite**

```bash
npm test
npm run test:acfr
node scripts/verify-bainbridge-rederive.mjs
node scripts/verify-bainbridge-audit.mjs
node scripts/verify-bainbridge-tether.mjs
```

All five must pass. `npm run lint` is excluded — it is a broken gate in this repo and has never exited 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-bainbridge-tether.mjs
git commit -m "test: tether harness for Bainbridge + Kitsap; resolve banners

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand off for UAT**

Present to Chris for UAT:
- `US → Washington → Kitsap County → Bainbridge Island` navigates correctly.
- Both entities show Money Out and Money In with a working icicle drill-down.
- The source chip cites the WA State Auditor with a resolvable link and an "as of" date.
- The year selector spans FY2004–FY2025 (Bainbridge) and FY2004–FY2024 (Kitsap).
- Enrichment text appears and states the General-Fund-only limitation.

Do not ship before Chris signs off.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: scope and entities → Task 3; source selection and the API contract → Tasks 1–2; the report-type inversion and content guard → Task 1 (`classifyReport`), enforced in Task 2; Bainbridge and Kitsap statement shapes → Tasks 4–5; FY2006 exclusion → Task 2 manifest; FY2009 recovery → Task 6; architecture (three scripts) → Tasks 1, 4–5, 7–8; the column-alignment, dash-zero, whitespace, units and residue guardrails → Tasks 4, 5, 7, 8, 9, 10; structural-break check → Task 8 Step 3 adjudication; population from OFM → Task 3; entity typing → Task 3 Step 2; the three harnesses → Tasks 9, 10, 12; municipality-scoped counts → Task 10 Step 2; the independent oracle → Task 9 Step 3; known limitations → Task 11 enrichment text and Task 6 Step 5.

**Two gaps found and closed while reviewing.** The spec's per-capita band was stated as a single app-wide idea; deriving it revealed Seattle's `[500, 25000]` **rejects Kitsap** at ≈$465/resident, so Task 7 specifies `[100, 10000]` and says why. And the spec did not say where the two thin loaders' shared code would live; Task 7 makes it a new module rather than a third and fourth copy of a 460-line file, with v2.21's loaders untouched.

**Placeholders.** Three values are deliberately unresolved and each is a named step with a named authority, not a TBD: both populations (Task 3 Step 1, WA OFM), and the FY2009 outcome (Task 6, which has a defined both-ways resolution). Kitsap's eighteen unprobed ARNs are labelled as assumed in both the spec and Task 2, with a stated recovery procedure.

**Type consistency.** `classifyReport(pageCount, text) => {ok, reason}` is used identically in Tasks 1 and 2. `reportFileUrl(arn)` is used in Tasks 1, 8 and 10. `loadEntity(descriptor)` is defined in Task 7 and called with matching field names in Task 8. `CityConfig`'s keyword arguments in Tasks 4 and 5 match the real signature read from `scripts/lib/acfrGF.py`. `tie_delta = computed − printed` is used consistently, giving `-1` for Bainbridge FY2025 operating and `+1` for Kitsap FY2024 revenue.
