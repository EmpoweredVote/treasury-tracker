# Phase 56: Orange County Verification + UAT — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 2 (1 new script + 1 new doc)
**Analogs found:** 2 / 2

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `scripts/verify-phase56.mjs` | utility / verification script | request-response (DB probe, read-only) | `scripts/verify-phase34.mjs` | exact — same role, same data flow, same tech stack |
| `.planning/phases/56-orange-county-verification-uat/56-VERIFICATION.md` | documentation artifact | n/a (static document) | `.planning/phases/55-statewide-city-salaries-integration/55-VERIFICATION.md` | exact — same phase verification document format |

---

## Pattern Assignments

### `scripts/verify-phase56.mjs` (verification script, request-response)

**Analog:** `scripts/verify-phase34.mjs`

**Decision from RESEARCH.md:** Phase 56's DB checks are pure PostgREST HEAD + GET requests (no `@supabase/supabase-js` client), following the verify-phase34 pattern for the DB section. verify-phase32 and verify-phase33 show an alternative using `createClient` — prefer verify-phase34's native `node:https` pattern for DB checks to avoid open-handle issues on Windows (per verify-phase34 comment at line 197: `agent: false, // disable keep-alive`).

**Shebang + file header pattern** (`verify-phase34.mjs` lines 1–22):
```javascript
#!/usr/bin/env node
/**
 * verify-phase56.mjs
 *
 * Behavioral verification script for Phase 56 — Orange County Verification + UAT.
 * Covers 7 automatable gaps across requirements VER-01, VER-02.
 *
 * Gap coverage:
 *   56-01-01  VER-01  All 34 OC cities have county_id = OC entity in treasury.municipalities
 *   56-01-02  VER-01  All 34 OC cities have operating rows for FY2003–2024
 *   56-01-03  VER-01  All 34 OC cities have revenue rows for FY2003–2024
 *   56-01-04  VER-01  ByTheNumbers rows have durable source_url (%/d/ju3w-4gxp%)
 *   56-01-05  VER-01  Anaheim/Santa Ana custom rows (source_url IS NULL) preserved
 *   56-01-06  VER-01  Sampled city/year totals match known-verified exact values
 *   56-01-07  VER-01  All 34 OC cities have salaries rows
 *
 * Gap 56-02-01 (ACFR spot-check: 7 cities pass within 1–2%) is human-only.
 * Gap 56-03-01 (live-app UAT: 5 nav surfaces) is human-only.
 *
 * Exit 0 = all assertions pass
 * Exit 1 = one or more assertions fail
 *
 * Usage: node scripts/verify-phase56.mjs
 */
```

**Import pattern** (`verify-phase34.mjs` lines 24–31):
```javascript
import { readFileSync, existsSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
```

**Env loading pattern** (`verify-phase34.mjs` lines 33–46 — identical across all verify-phase*.mjs scripts):
```javascript
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    } catch {}
  }
}
loadEnv();
```

**Result tracking pattern** (`verify-phase34.mjs` lines 48–60 — identical across all verify-phase*.mjs scripts):
```javascript
const results = [];

function pass(gapId, description) {
  console.log(`  [PASS] ${gapId}: ${description}`);
  results.push({ gapId, status: 'PASS', description });
}

function fail(gapId, description, detail) {
  console.log(`  [FAIL] ${gapId}: ${description}`);
  if (detail) console.log(`         Detail: ${detail}`);
  results.push({ gapId, status: 'FAIL', description, detail });
}
```

**Env credential read for DB section** (`verify-phase34.mjs` lines 171–177):
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing = [!SUPABASE_URL && 'SUPABASE_URL', !SUPABASE_KEY && 'SUPABASE_SERVICE_KEY'].filter(Boolean).join(', ');
  fail('34-01-05', `DB check skipped — missing env: ${missing}`);
} else {
  // DB checks here
}
```

**Native node:https HEAD request pattern for count queries** (`verify-phase34.mjs` lines 183–217):
```javascript
const parsedUrl = new URL(`${SUPABASE_URL}/rest/v1/budgets?fiscal_year=eq.9999&select=id`);
const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;

const count = await new Promise((resolve, reject) => {
  const req = requester({
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'HEAD',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept-Profile': 'treasury',
      'Prefer': 'count=exact',
    },
    agent: false, // disable keep-alive — connection closes immediately after response
  }, (res) => {
    res.resume(); // drain body
    const cr = res.headers['content-range'] || '';
    const n = parseInt(cr.split('/')[1] ?? '0', 10);
    resolve(isNaN(n) ? -1 : n);
  });
  req.on('error', reject);
  req.end();
});

if (count === -1) {
  fail('34-01-05', "Could not parse count from content-range header");
} else if (count > 0) {
  fail('34-01-05', `${count} FY=9999 sentinel row(s) found ...`);
} else {
  pass('34-01-05', "...");
}
```

**For GET requests that return a JSON body** (use same requester wrapper, method: 'GET', collect body chunks):
```javascript
const rows = await new Promise((resolve, reject) => {
  const req = requester({
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept-Profile': 'treasury',
      'Accept': 'application/json',
    },
    agent: false,
  }, (res) => {
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
  });
  req.on('error', reject);
  req.end();
});
```

**Summary + exit pattern** (`verify-phase34.mjs` lines 221–243):
```javascript
console.log('');
console.log('── Summary ─────────────────────────────────────────────────────────────────');

const passCount = results.filter(r => r.status === 'PASS').length;
const failCount = results.filter(r => r.status === 'FAIL').length;

for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}  ${r.gapId}`);
}
console.log('');
console.log(`  ${passCount} passed, ${failCount} failed (of ${results.length} gap checks)`);
console.log('');
console.log('  Note: Gaps 56-02-01 (ACFR spot-check) and 56-03-01 (live-app UAT) are human-only.');
console.log('        See 56-VERIFICATION.md for ACFR figures, UAT results, and Chris sign-off.');
console.log('');

if (failCount === 0) {
  console.log('PASS — All Phase 56 automated gap checks satisfied');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 56 gap checks failed');
  process.exit(1);
}
```

**Section heading console.log pattern** (`verify-phase34.mjs` lines 68–71):
```javascript
console.log('Phase 56 — Orange County Verification + UAT verification');
console.log('Gaps: 56-01-01 through 56-01-07 (automated); 56-02-01 + 56-03-01 are human-only');
console.log('');
console.log('── DB checks ───────────────────────────────────────────────────────────────');
```

**Key URLs and IDs to use in probe queries** (from `56-RESEARCH.md` §DB Probe Design):
```javascript
// Constants block
const OC_COUNTY_ID   = '65e7c643-5829-4821-9537-f8595bce61ab';
const ANAHEIM_ID     = '7fbdd013-69c9-41fb-a87d-c9ca7b3cdeb5';
const SANTA_ANA_ID   = '2dc65052-aa62-4a3c-a5c0-eea78dfe9ad3';
const IRVINE_ID      = '17f0abc4-751f-4609-adcd-d6274ed33269';
const HB_ID          = 'd0b51865-2581-4091-8d4c-18e2a2750657';
const NEWPORT_ID     = 'a091a210-e017-47df-ba65-5e2bf43c95c8';
const VILLA_PARK_ID  = 'ce99c02d-b889-4c38-832d-face172b5a8c';
const LAGUNA_WOODS_ID = '3a25551e-5a40-40a7-ac72-3e6938695f40';

// Known-good exact values for 56-01-06 assertion
const KNOWN_TOTALS = [
  { id: IRVINE_ID,    fy: 2024, type: 'operating', expected: 656013821  },
  { id: HB_ID,        fy: 2019, type: 'operating', expected: 323441057  },
  { id: ANAHEIM_ID,   fy: 2024, type: 'operating', expected: 1640316917 },
  { id: ANAHEIM_ID,   fy: 2025, type: 'operating', expected: 490937159  },
  { id: SANTA_ANA_ID, fy: 2024, type: 'operating', expected: 414022680  },
  { id: SANTA_ANA_ID, fy: 2024, type: 'revenue',   expected: 400947213  },
  { id: NEWPORT_ID,   fy: 2024, type: 'operating', expected: 444327078  },
  { id: VILLA_PARK_ID,    fy: 2024, type: 'operating', expected: 6111009   },
  { id: LAGUNA_WOODS_ID,  fy: 2024, type: 'operating', expected: 10051862  },
];
```

**PostgREST query patterns to apply** (from `56-RESEARCH.md` §Key DB Query Patterns):
```javascript
// 56-01-01: Count OC cities (HEAD + content-range)
// /rest/v1/municipalities?county_id=eq.<OC_ID>&entity_type=eq.city&select=id
// Expected content-range total: 34

// 56-01-02/03: Count budget rows for OC cities by dataset_type + year range
// /rest/v1/budgets?municipality_id=in.(<34 ids>)&fiscal_year=gte.2003&fiscal_year=lte.2024&dataset_type=eq.operating&select=id
// Expected: count >= 33 * 22 = 726 (La Habra may have source gaps per Phase 53)

// 56-01-04: Zero rows with non-durable source_url
// /rest/v1/budgets?municipality_id=in.(34 ids)&source_url=not.is.null&source_url=not.like.*%2Fd%2F*&dataset_type=eq.operating&select=id
// Expected: count = 0

// 56-01-05: Anaheim custom rows (source_url IS NULL)
// /rest/v1/budgets?municipality_id=eq.<ANAHEIM_ID>&source_url=is.null&select=fiscal_year,dataset_type,total_budget
// Expected: 4 rows (FY2025-26 op+rev)

// 56-01-07: Salaries coverage
// /rest/v1/budgets?municipality_id=in.(34 ids)&dataset_type=eq.salaries&select=municipality_id
// Count of distinct municipality_ids expected: 34
```

---

### `.planning/phases/56-orange-county-verification-uat/56-VERIFICATION.md` (documentation, static)

**Analog:** `.planning/phases/55-statewide-city-salaries-integration/55-VERIFICATION.md`

**YAML frontmatter pattern** (`55-VERIFICATION.md` lines 1–21):
```yaml
---
phase: 56-orange-county-verification-uat
verified: <ISO timestamp when completed>
status: passed
score: <N>/N must-haves verified
overrides_applied: 0
operator_live_app_approval:
  approved: <true/false>
  date: <date>
  note: "<Chris's UAT sign-off text>"
human_verification:
  - test: "ACFR spot-check: 7 sampled OC cities pass within 1–2% of ACFR all-governmental-funds total"
    expected: "All 7 cities delta ≤ 2%; definitional notes recorded; no genuine load errors found"
    why_human: "ACFR PDFs are binary; figures require human PDF reader; delta classification (definitional vs. load error) requires human judgment per D-04"
  - test: "Live-app UAT: 5 nav surfaces confirmed by Chris"
    expected: "Breadcrumb chain works; CitiesInCountyPanel shows 34 cities; Salaries tab present; per-capita shown; Anaheim/Santa Ana render correctly"
    why_human: "Browser navigation at https://treasurytracker.empowered.vote requires a human; cannot be scripted in this context"
---
```

**Document opening + Goal Achievement section** (`55-VERIFICATION.md` lines 23–35):
```markdown
# Phase 56: Orange County Verification + UAT — Verification Report

**Phase Goal:** Independently verify the loaded Orange County data is accurate (ACFR spot-check) and confirm the OC navigation experience end-to-end in the live app, with Chris UAT sign-off.
**Verified:** <date>
**Status:** passed / failed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| VER-01 | OC city budget totals spot-checked against published ACFRs / adopted budgets and pass | VERIFIED / PARTIAL / FAILED | DB probe exit 0; ACFR spot-check table below |
| VER-02 | Breadcrumb + CitiesInCountyPanel verified live; Chris UAT sign-off | VERIFIED / FAILED | Operator sign-off in frontmatter |
```

**ACFR Spot-Check table** (from `56-RESEARCH.md` §VERIFICATION.md Reconciliation Table Template):
```markdown
## ACFR Spot-Checks

**Definitional Note (applies to all rows):** The CA State Controller ByTheNumbers
expenditure dataset (`/d/ju3w-4gxp`) is the City Financial Transactions Report —
all government funds combined (governmental + proprietary). Comparison figure for each
city is the ACFR "Statement of Revenues, Expenditures, and Changes in Fund Balances —
All Governmental Funds" total, or the Government-Wide Statement of Activities (all
activities column) where available. General Fund summaries are NOT used as the comparison
basis. See 56-RESEARCH.md §Common Pitfalls for rationale.

| City | FY | Dataset | DB Total | ACFR / Budget Source | ACFR Figure | Delta | Delta % | Result | Definitional Note |
|------|----|---------|----------|--------------------|-------------|-------|---------|--------|-------------------|
| Anaheim | 2024 | operating | $1,640,316,917 | Anaheim ACFR FY2023-24 [page/table] | $xxx | $x | x% | PASS/FAIL | SCO all-gov-funds vs ACFR [table name] |
| Anaheim | 2025 | operating | $490,937,159 | Anaheim Adopted Budget FY2025-26 [doc] | $xxx | $x | x% | PASS/FAIL | Custom source: compare to original load doc |
| Santa Ana | 2024 | operating | $414,022,680 | Santa Ana Adopted Budget FY2023-24 | $xxx | $x | x% | PASS/FAIL | Custom source; adopted budget total |
| Santa Ana | 2019 | operating | $535,376,778 | Santa Ana ACFR FY2018-19 [page/table] | $xxx | $x | x% | PASS/FAIL | ByTheNumbers (actuals) vs ACFR actuals |
| Irvine | 2024 | operating | $656,013,821 | Irvine ACFR FY2023-24 [page/table] | $xxx | $x | x% | PASS/FAIL | SCO all-gov-funds vs ACFR all-gov-funds |
| Irvine | 2019 | operating | $370,794,817 | Irvine ACFR FY2018-19 [page/table] | $xxx | $x | x% | PASS/FAIL | SCO all-gov-funds vs ACFR all-gov-funds |
| Huntington Beach | 2024 | operating | $464,376,984 | HB ACFR FY2023-24 [page/table] | $xxx | $x | x% | PASS/FAIL | SCO all-gov-funds vs ACFR all-gov-funds |
| Huntington Beach | 2019 | operating | $323,441,057 | HB ACFR FY2018-19 — Phase 53 canary-verified | $323,441,057 | $0 | 0.00% | PASS | Exact match confirmed in Phase 53 SC-4 |
| Newport Beach | 2024 | operating | $444,327,078 | Newport Beach ACFR FY2023-24 [page/table] | $xxx | $x | x% | PASS/FAIL | SCO all-gov-funds vs ACFR all-gov-funds |
| Villa Park | 2024 | operating | $6,111,009 | Villa Park ACFR FY2023-24 (or FY2022-23) | $xxx | $x | x% | PASS/FAIL | SCO all-gov-funds vs ACFR all-gov-funds |
| Laguna Woods | 2024 | operating | $10,051,862 | Laguna Woods ACFR FY2023-24 | $xxx | $x | x% | PASS/FAIL | SCO all-gov-funds vs ACFR all-gov-funds |
```

**UAT Sign-Off section** (modeled on `55-VERIFICATION.md` operator_live_app_approval pattern):
```markdown
## UAT Sign-Off (D-03)

**Operator:** Chris Cantrell
**Date:** <date>
**App URL:** https://treasurytracker.empowered.vote

| # | Checklist Item | Result | Notes |
|---|----------------|--------|-------|
| 1 | City → county breadcrumb chain works (e.g., Irvine → Orange County → California) | PASS/FAIL | |
| 2 | County page → CitiesInCountyPanel lists all 34 OC cities; "Available now" count = 34 | PASS/FAIL | |
| 3 | Salaries tab appears on covered cities (e.g., Irvine, Anaheim) and renders Dept→Position tree | PASS/FAIL | |
| 4 | Per-capita display ($/resident) works for OC cities | PASS/FAIL | |
| 5 | Anaheim + Santa Ana render correctly (operating + revenue present, salaries tab present) | PASS/FAIL | |

**Sign-off:** <Chris's explicit approval or notes>
```

**Human Verification Required section** (`55-VERIFICATION.md` lines 117–142 pattern):
```markdown
### Human Verification Required

#### 1. ACFR Spot-Check — 7 Sampled OC Cities

**Test:** For each row in the ACFR Spot-Checks table above, open the city's published ACFR (or adopted budget) from the URL column, locate the "Statement of Revenues, Expenditures, and Changes in Fund Balances — All Governmental Funds" total, record the figure, compute delta.
**Expected:** All 7 cities delta ≤ 2%; definitional notes complete; no genuine load errors found.
**Why human:** ACFRs are binary PDFs; figures require human PDF reader; delta classification (definitional-variance vs. genuine load error) requires human judgment per D-04.

#### 2. Live-App UAT — 5 Navigation Surfaces

**Test:** Navigate https://treasurytracker.empowered.vote per D-03 checklist above.
**Expected:** All 5 checklist items PASS.
**Why human:** Browser navigation cannot be scripted in this context; requires Chris's explicit sign-off.
```

**Behavioral Spot-Checks section** (`55-VERIFICATION.md` lines 80–93 pattern):
```markdown
### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| verify-phase56.mjs exits 0 | `node scripts/verify-phase56.mjs` | All 7 automated gaps PASS | PASS |
| 34 OC cities in DB with county_id = OC entity | Gap 56-01-01 | count = 34 | PASS |
| All 34 have operating rows FY2003-2024 | Gap 56-01-02 | count ≥ 726 | PASS |
| All 34 have revenue rows FY2003-2024 | Gap 56-01-03 | count ≥ 726 | PASS |
| ByTheNumbers source_url durable | Gap 56-01-04 | count = 0 non-durable rows | PASS |
| Anaheim/Santa Ana custom rows intact | Gap 56-01-05 | Anaheim: 4 rows; Santa Ana: 8+ rows | PASS |
| Known-good totals exact match | Gap 56-01-06 | 9 exact matches | PASS |
| All 34 OC cities have salaries rows | Gap 56-01-07 | count = 34 distinct cities | PASS |
```

---

## Shared Patterns

### Env Loading
**Source:** `scripts/verify-phase34.mjs` lines 33–46
**Apply to:** `scripts/verify-phase56.mjs` — copy verbatim, no changes needed.
```javascript
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    } catch {}
  }
}
loadEnv();
```

### Pass/Fail Accumulator
**Source:** `scripts/verify-phase34.mjs` lines 48–60 (identical in all verify-phase scripts)
**Apply to:** `scripts/verify-phase56.mjs` — copy verbatim.

### native `node:https` PostgREST Request Helper
**Source:** `scripts/verify-phase34.mjs` lines 183–217
**Apply to:** `scripts/verify-phase56.mjs` — all DB checks.
**Key headers:** `Accept-Profile: treasury`, `Prefer: count=exact` (HEAD), `agent: false`.
**Count extraction:** `content-range` header, split `/`, take index [1], parseInt.

### YAML Frontmatter on VERIFICATION.md
**Source:** `55-VERIFICATION.md` lines 1–21
**Apply to:** `56-VERIFICATION.md` — same keys; populate `operator_live_app_approval` block once Chris provides sign-off.
**Required keys:** `phase`, `verified`, `status`, `score`, `overrides_applied`, `operator_live_app_approval`, `human_verification`.

### Goal Achievement Truth Table
**Source:** `55-VERIFICATION.md` lines 34–49 / `53-VERIFICATION.md` lines 29–33
**Apply to:** `56-VERIFICATION.md` — same `| # | Truth | Status | Evidence |` table pattern.

### Anti-Patterns / Gaps Summary sections
**Source:** `55-VERIFICATION.md` lines 104–153
**Apply to:** `56-VERIFICATION.md` — include Anti-Patterns only if genuine issues found during ACFR spot-check or probe. Include Gaps Summary noting the two human items.

---

## No Analog Found

No files in this phase are without a close analog. Both deliverables have exact-match precedents in the codebase.

---

## Metadata

**Analog search scope:**
- `scripts/verify-phase32.mjs`, `scripts/verify-phase33.mjs`, `scripts/verify-phase34.mjs` — DB-probe script pattern
- `.planning/phases/53-orange-county-operating-revenue-load/53-VERIFICATION.md`
- `.planning/phases/54-orange-county-entity-linking-enrichment/54-VERIFICATION.md`
- `.planning/phases/55-statewide-city-salaries-integration/55-VERIFICATION.md`

**Files scanned:** 6 analog files read
**Pattern extraction date:** 2026-06-15

**Key divergence from prior verify scripts:** Phase 56 has no static file checks (no new source files written). All automated assertions are DB-probe checks. The script will consist entirely of the env-load + result-tracking boilerplate followed by a single "DB checks" section. This is a narrower script than verify-phase32/33/34 which mixed static file checks with DB checks.

**Preferred DB client for phase 56:** Native `node:https` (verify-phase34 pattern), NOT `@supabase/supabase-js` createClient (verify-phase32/33 pattern). Reason: `agent: false` avoids Windows open-handle / process exit issues documented in verify-phase34 comment at line 197.
