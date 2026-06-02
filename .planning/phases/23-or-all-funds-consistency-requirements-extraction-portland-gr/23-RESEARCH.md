# Phase 23: OR All Funds Consistency — Requirements Extraction - Research

**Researched:** 2026-06-01
**Domain:** OR municipal budget — All Funds Requirements extraction (Portland + Gresham + Troutdale) + frontend display change
**Confidence:** HIGH (all PDFs verified live; page structures confirmed by direct pdfplumber extraction; frontend code read directly)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Phase 23 is full end-to-end — data pipeline (extract + load + verify) AND frontend changes to display the corrected total. Not data-only.
- **D-02:** The Budget tab headline total replaces the departmental operating figure (~$330M) with the all_funds_requirements total (~$512M). The existing icicle/department breakdown remains and is labeled as a partial breakdown.
- **D-03:** Show a gap-explanation label when all_funds_requirements and departmental operating totals differ. Label should convey that the departmental breakdown accounts for $X of the $Y All Funds total, with the remainder covering debt service, capital, and other non-departmental requirements. Exact wording is planner/implementer discretion.
- **D-04:** The UI change is data-driven and generic — any city/year that has `all_funds_requirements` rows in the DB gets the updated headline and label. No hardcoding of OR cities in the frontend. In practice, only OR cities will have this data after Phase 23.
- **D-05:** Phase 23 includes Troutdale. Researcher assesses whether Troutdale's adopted budget PDFs contain the "Resources and Requirements — All Funds" page. If present, fold in Troutdale extraction alongside Portland and Gresham. If the All Funds page is absent or significantly different from Gresham format, defer Troutdale and note as a follow-up.
- **D-06:** Match all available operating FYs for each city. Portland: FY2022–FY2026 (5 years). Gresham: FY2023–FY2026 (4 years). Troutdale: FY2019–FY2026 (8 years, assuming All Funds page exists across all FYs). The year selector must remain consistent — any FY the user selects should show matching All Funds totals on both Budget and Money In tabs.
- **D-07:** Researcher determines whether the "Resources and Requirements — All Funds" page appears in Portland's Vol 1 (operating) or Vol 2 (revenue) PDFs. This drives which file `extract_requirements()` targets. If in Vol 1, add to `extract_budget()` flow in `extractPortland.py`. If in Vol 2, add alongside `extract_revenue()` in the same file. ROADMAP suggests same volume as revenue (Vol 2), but researcher must confirm before planning.

### Claude's Discretion
None specified — all major choices are locked or researcher-assessed (D-05, D-07).

### Deferred Ideas (OUT OF SCOPE)
- All Funds Requirements enrichment (run `enrichCategories.js --mode requirements`) — not in scope for Phase 23
- TX and CA cities — All Funds scope mismatch may exist but is OR-only for this phase
- Portland revenue (Vol 2, fund-level) — still deferred from Phase 21
</user_constraints>

---

## Summary

Phase 23 resolves the Money In / Budget tab scope mismatch for all three OR cities by extracting the Requirements column from the "Resources and Requirements — All Funds" page in each city's budget PDFs. All PDFs are already on disk. The page structure is confirmed parseable for Gresham (same page as Phase 21 revenue, section-gate flip) and Portland (confirmed in Vol 1 — ROADMAP was incorrect that it was Vol 2). Troutdale confirmed viable: the All Funds Combined page includes a REQUIREMENTS section with ~6 expenditure categories; extraction is a near-copy of Troutdale's existing `extract_revenue()` with the section gate flipped from `RESOURCES` to `REQUIREMENTS`.

**D-07 answer (verified):** Portland's "Total City Budget — Resources and Requirements" page is in **Vol 1**, not Vol 2. It appears across all 5 fiscal years (FY2022–FY2026). `extract_requirements()` in `extractPortland.py` targets `vol1` PDFs, same as `extract_budget()`. This is a different page from the Appropriation Schedule pages that `extract_budget()` uses — it is a Financial Summaries table with category-level expenditure rows, not bureau-level rows.

**D-05 answer (verified):** Troutdale's All Funds Combined page has a REQUIREMENTS section across all 8 PDFs (FY2019–FY2026). Categories are expenditure types: PERSONNEL SERVICES, MATERIALS & SERVICES, CAPITAL OUTLAY, DEBT SERVICE, TRANSFERS TO OTHER FUNDS, CONTINGENCY, UNAPPROPRIATED. Include Troutdale in Phase 23.

**Primary recommendation:** Add `extract_requirements()` to all three Python extractors and `--mode requirements` to all three Node.js loaders. Update `src/types/budget.ts` union type, `src/App.tsx` dataset detection block, `src/components/datasets/DatasetTabs.tsx`, and `src/components/dashboard/PlainLanguageSummary.tsx`. No new packages, no schema changes, no new download scripts.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF Requirements extraction | Script (Python pdfplumber) | — | Same page already parsed for revenue; section-gate flip pattern proven |
| Requirements tree building | Script (Node.js processCity.js) | — | Add `buildRequirementsTree()` alongside `buildRevenueTree()` |
| DB write (`treasury_sync_budget_tree`) | Database (RPC) | — | Same RPC, `dataset_type='all_funds_requirements'` |
| `data_source` row (requirements) | Script (processCity.js) | — | `upsertDataSource` already parametric; extend label and URL map |
| `dataset_type` union extension | Frontend (budget.ts) | — | Line 117 union type must include `'all_funds_requirements'` |
| `all_funds_requirements` availability detection | Frontend (App.tsx) | — | Add `hasAllFundsRequirements` in the dataset detection block (lines 267–270) |
| Budget tab headline override | Frontend (PlainLanguageSummary.tsx) | — | Prefer `allFundsRequirementsData.metadata.totalBudget` when present |
| Gap-explanation label | Frontend (PlainLanguageSummary.tsx) | DatasetTabs.tsx | New JSX block in PlainLanguageSummary; DatasetTabs shows correct total on Money Out card |
| DatasetTabs Money Out total | Frontend (DatasetTabs.tsx) | — | `operatingTotal` prop must reflect `all_funds_requirements` total when available, not the departmental operating total |

---

## D-07 Finding: Portland All Funds Page Location

[VERIFIED: live pdfplumber extraction in this session]

The "Total City Budget — Resources and Requirements" table is in **Vol 1** across all five Portland fiscal years:

| FY | Vol 1 Filename | Data Page |
|----|----------------|-----------|
| FY2022 | `fy2021-22-vol1.pdf` | 123 |
| FY2023 | `fy2022-23-vol1.pdf` | 109 |
| FY2024 | `fy2023-24-vol1.pdf` | 100 |
| FY2025 | `fy2024-25-vol1.pdf` | 106 |
| FY2026 | `fy2025-26-vol1.pdf` | 116–117 (spans 2 pages) |

Detection signal: `'Total City Budget' in text and 'Resources and Requirements' in text and 'Personnel Services' in text`. The Table of Contents also contains these strings — the `Personnel Services` guard eliminates the TOC false positive.

FY2026 spans two pages (116 + 117). The table must be extracted from both pages for complete Requirements data.

---

## Portland Requirements Section Structure

[VERIFIED: live pdfplumber extraction in this session]

`page.extract_tables()` works on this page (unlike Gresham where it returns empty). The table has 6 columns: `[name, FY N-2 Actuals, FY N-1 Actuals, Revised, Proposed, Adopted]`.

Portland Requirements rows (FY2022 pattern — consistent across all years):

```
Requirements
  Bureau Expenditures (sub-header)
    Personnel Services
    External Materials and Services
    Internal Materials and Services
    Capital Outlay
    Total Bureau Expenditures (skip — sum row)
  Fund Expenditures (sub-header)
    Debt Service
    Contingency
    Fund Transfers - Expense
    Debt Service Reserves
    Total Fund Expenditures (skip — sum row)
  Ending Fund Balance (skip — balance sheet item)
  Total Requirements (skip — grand total)
  Less Intracity Transfers (skip — netting adjustment)
  Total NET Budget (skip — net figure)
```

FY2026 table uses compound cell keys like `'Requirements\nBureau Expenditures'` (newline in `row[0]`) due to a PDF rendering difference — the extractor must normalize these. FY2022–FY2025 use separate rows for the sub-headers.

**Adopted column is index [5]** (last of 6 columns, 0-indexed).

**Total to store:** Sum of `Personnel Services + External Materials and Services + Internal Materials and Services + Capital Outlay + Debt Service + Contingency + Fund Transfers - Expense + Debt Service Reserves + Ending Fund Balance`. This equals "Total Requirements" minus "Intracity Transfers" — i.e., the Total NET Budget figure. For D-03 gap-explanation: "Bureau Expenditures" subtotal = the operating-like portion visible in the departmental icicle.

**Portland FY2026 All Funds Requirements total:** `$8,641,210,277` (Total Requirements). After netting intracity transfers: `$6,463,290,782`.

**Decision for planner:** Which total to store — gross Total Requirements, or NET after intracity transfers? The revenue side (Money In) already stores the gross Total Resources. For consistency and citizen clarity, store gross Total Requirements. This matches how Gresham stores it (Total Requirements line, not a net). Label in the UI should reference "Total Requirements" not "Net."

---

## Gresham Requirements Section Structure

[VERIFIED: live pdfplumber extraction in this session]

Same page as Phase 21 revenue extraction. Section gate flip: `in_resources` → `in_requirements`. Existing `extract_budget()` already parses the Requirements section for **department-level rows** and skips non-operating rows (Capital Improvement, Debt Service, Transfers, Contingency, Other Requirements, Unappropriated) via `SKIP_ROWS`. Phase 23 needs the **opposite**: capture the non-operating rows and skip the department rows.

Gresham Requirements rows (FY2026):

| Row | FY2026 Adopted Amount |
|-----|-----------------------|
| Operating Total | $330,652,078 (skip — sum of departments) |
| Capital Improvement | $231,761,000 |
| Debt Service | $13,421,000 |
| Transfers | $102,204,000 |
| Contingency | $22,633,907 |
| Other Requirements | $8,652,000 |
| Unappropriated | $187,942,630 |
| Non-Operating Total | $566,614,537 (skip — sum of above) |
| **Total Requirements** | **$897,266,615** |

**Gresham all_funds_requirements total to store:** $897,266,615 (Total Requirements). For the gap-explanation label: Operating Total ($330,652,078) = the departmental icicle total.

**Key insight for extractor design:** The `extract_requirements()` function for Gresham should collect ALL rows in the Requirements section and let the loader (or the function itself) separate operating-department rows vs. non-operating-category rows. The simplest approach: store the whole-city total (Total Requirements value) as a single row with name `'Total Requirements'`, plus sub-rows for the main categories. Or alternatively, store only the non-operating categories (Capital Improvement, Debt Service, Transfers, Contingency, Other Requirements, Unappropriated) and compute the grand total. Either approach works; the planner should choose based on what makes the gap-explanation label easiest to construct.

**Recommended approach:** Store non-operating categories as named rows (same pattern as revenue categories). The loader sums them for `totalBudget`. The frontend adds `operatingData.metadata.totalBudget` to get the full Total Requirements figure for the gap label.

---

## Troutdale Requirements Section Structure

[VERIFIED: live pdfplumber extraction in this session]

Troutdale's All Funds Combined page (`CITY-WIDE FUND SUMMARY ALL FUNDS COMBINED`) already parsed by `extract_revenue()`. Section gate flip: `RESOURCES` → `REQUIREMENTS`.

Troutdale Requirements rows (FY2026):

| Row | FY2026 Adopted Amount |
|-----|-----------------------|
| PERSONNEL SERVICES | $10,471,317 |
| MATERIALS & SERVICES | $18,184,926 |
| CAPITAL OUTLAY | $13,170,729 |
| DEBT SERVICE | $774,000 |
| TRANSFERS TO OTHER FUNDS | $5,125,484 |
| CONTINGENCY | $19,958,707 |
| RESERVE FOR FUTURE EXPENDITURE | $0 (skip) |
| UNAPPROPRIATED | $13,496,075 |
| TOTAL REQUIREMENTS | $81,181,239 (skip — sum row) |

Structure is identical across FY2019–FY2026 (verified FY2019, FY2020, FY2026). FY2019 total: $44,892,732. FY2026 total: $81,181,239.

**OCR note:** The `$` token and the split-number issue from `extract_revenue()` apply equally to this section. Reuse the existing token-splitting logic verbatim.

**SANITY_MAX for Troutdale requirements mode:** $100,000,000 (comfortably above $81M FY2026, with room for growth).

**Gap explanation note:** Troutdale's operating budget (General Fund departments, ~$17M) is a subset of All Funds Requirements (~$81M). The gap-explanation label applies: the department icicle covers General Fund operating only; all-funds total includes capital, debt, and transfers across all funds.

---

## Frontend Change Architecture

### Files to Modify

**1. `src/types/budget.ts` line 117**

Current:
```typescript
dataset_type: 'operating' | 'revenue' | 'salaries';
```
Change to:
```typescript
dataset_type: 'operating' | 'revenue' | 'salaries' | 'all_funds_requirements';
```

**2. `src/App.tsx` — dataset detection block (lines 267–270)**

Current:
```typescript
const hasOperating = entityDatasets.some(d => d.dataset_type === 'operating');
const hasRevenue = entityDatasets.some(d => d.dataset_type === 'revenue');
const hasSalaries = entityDatasets.some(d => d.dataset_type === 'salaries');
```
Add:
```typescript
const hasAllFundsRequirements = entityDatasets.some(d => d.dataset_type === 'all_funds_requirements');
```

Then load `all_funds_requirements` data alongside `operating`/`revenue`/`salaries` in the `Promise.all` block (lines 272–283). Store in a new `allFundsRequirementsData` state variable.

Pass `allFundsRequirementsData` to `PlainLanguageSummary` as a new prop.

Also: when computing `operatingTotal` for the `DatasetTabs` `operatingTotal` prop (line 729), prefer the `all_funds_requirements` total when available. This makes the Money Out tab card show the correct all-funds figure.

**3. `src/App.tsx` — `DatasetType` union and `getDatasetDisplayText`**

`DatasetType` local type (line 32) does NOT need `'all_funds_requirements'` — this type controls which tab is _active_, and `all_funds_requirements` is not a selectable tab. The `all_funds_requirements` data is loaded in the background and consumed by `PlainLanguageSummary`/`DatasetTabs` props only.

`availableDatasetTypes` (lines 146–153) filters to dataset types shown in the tabs. Since `all_funds_requirements` is not a tab, it should be excluded from `availableDatasets` passed to `DatasetTabs`. The existing filter already gates on `dataset_type` — the planner must ensure `all_funds_requirements` is not included in the `availableDatasets` array passed to `DatasetTabs`.

**4. `src/components/dashboard/PlainLanguageSummary.tsx`**

Current headline total: `operatingData.metadata.totalBudget` (line 38).

New behavior:
- Accept optional `allFundsRequirementsData: BudgetData | null` prop.
- When `allFundsRequirementsData` is present, use `allFundsRequirementsData.metadata.totalBudget` as the headline total.
- Add a gap-explanation paragraph after the main budget sentence: "This $X total covers all city funds. The department breakdown below shows $Y in departmental operations; the remaining $Z covers debt service, capital projects, and other city-wide requirements."
- Where $X = `allFundsRequirementsData.metadata.totalBudget`, $Y = `operatingData.metadata.totalBudget`, $Z = X − Y.
- Render this block only when `allFundsRequirementsData` is present (backward-compatible — no change for TX/CA cities).

**5. `src/components/datasets/DatasetTabs.tsx`**

The Money Out tab currently shows `operatingTotal` which comes from `operatingBudgetData.metadata.totalBudget`. When `all_funds_requirements` data is present, App.tsx should pass the `all_funds_requirements` total as `operatingTotal` to DatasetTabs instead of the departmental operating total. This is a change in what `App.tsx` passes — DatasetTabs itself needs no change.

**6. `src/data/dataLoader.ts`**

The `loadBudgetData` function calls `budgets.find((b: any) => b.dataset_type === dataset)` (line 58). Since `dataset_type='all_funds_requirements'` will be a valid string, this already works without modification — the API call `loadBudgetData(year, city, state, 'all_funds_requirements')` will route correctly.

---

## Standard Stack

No new packages required. All dependencies are existing project tools.

| Tool | Version | Purpose |
|------|---------|---------|
| pdfplumber | existing | PDF text extraction |
| @supabase/supabase-js | existing | DB writes via RPC |
| Node.js `node:util` parseArgs | existing | CLI flag parsing |

---

## Package Legitimacy Audit

No new packages are installed in this phase. Audit not applicable.

---

## Architecture Patterns

### Recommended Structure for Extractor Changes

All three cities follow the same pattern — add `extract_requirements()` as a sibling of `extract_revenue()`:

```python
# extractGresham.py / extractTroutdale.py
def extract_requirements(pdf_path):
    """
    Extract non-operating requirements from the Requirements section of the All Funds page.
    Section gate: in_requirements = True when 'Requirements' header seen, False when 'Resources' seen.
    Skips: department rows (Operating Total and individual dept names), sum rows (Total Requirements).
    Returns: list of { category, adopted_amount, fiscal_year, page_num }
    """
    # Source: same page used by extract_revenue() — no additional page search needed
    ...
```

```python
# extractPortland.py — different page, table-based extraction
def extract_requirements(pdf_path):
    """
    Extract requirements categories from 'Total City Budget — Resources and Requirements' page in Vol 1.
    Page detection: 'Total City Budget' + 'Resources and Requirements' + 'Personnel Services' in text.
    Multi-page: FY2026 spans pages 116-117; must scan continuation pages.
    Uses page.extract_tables() (unlike Gresham which uses text-line parsing).
    Adopted column: index [5] (0-based).
    """
    ...
```

### Portland Multi-Page Handling

FY2026 data spans two pages. The extractor must accumulate rows across consecutive pages that continue the same table. Detection strategy: after finding the first data page, check the next page for `'Total Requirements'` in text to confirm continuation. FY2022–FY2025 appear to fit on a single page.

Implement as a flag: once the data page is found, continue to next page if it starts with `'Total City Budget'` and does not contain `'Resources'` section header (i.e., it's the requirements continuation, not a new table).

### Loader Mode Extension Pattern

Following existing `--revenue` pattern in `processGresham.js` and `processTroutdale.js`:

```javascript
// In processGresham.js / processTroutdale.js
const mode = opts.requirements ? 'requirements'
           : opts.revenue ? 'revenue'
           : 'operating';

const datasetType = mode === 'requirements' ? 'all_funds_requirements'
                  : mode === 'revenue' ? 'revenue'
                  : 'operating';
```

For `processPortland.js`, the existing `volSuffix` logic gates file discovery:
- `operating` → `vol1`
- `revenue` → `vol2`
- `requirements` → `vol1` (same as operating)

### SANITY_MAX for Requirements Mode

Requirements totals are larger than operating totals. Gate SANITY_MAX strictly to `mode === 'operating'`:

| City | Mode | Expected Max (FY2026) | Recommended SANITY_MAX |
|------|------|-----------------------|------------------------|
| Gresham | operating | ~$330M | existing $500M cap |
| Gresham | requirements | ~$897M | No cap (or ~$2B) |
| Portland | requirements | ~$8.6B | No cap (or ~$15B) |
| Troutdale | operating | ~$17M | existing $30M cap |
| Troutdale | requirements | ~$81M | No cap (or ~$200M) |

SANITY_MAX should only fire on `mode === 'operating'`. Requirements and revenue modes skip the cap (established pattern from Phase 21 Gresham revenue at ~$512M).

### Idempotency

Loader calls `supabase.from('budgets').delete().eq('data_source_id', ...).eq('fiscal_year', ...)` before inserting — same as existing pattern. `upsertDataSource` filters on `dataset_type='all_funds_requirements'` to prevent collision with operating or revenue rows.

---

## Anti-Patterns to Avoid

- **Using Vol 2 for Portland requirements:** ROADMAP incorrectly suggested Vol 2. The data is in Vol 1. Using Vol 2 will return 0 rows — the "Resources and Requirements" page does not appear in Vol 2.
- **Using `extract_tables()` for Gresham/Troutdale requirements:** `extract_tables()` returns empty on both cities' All Funds pages. Must use `page.extract_text()` + line parsing. Portland is the exception where `extract_tables()` works.
- **Including `all_funds_requirements` in `DatasetTabs` selectable cards:** This is not a new tab. It augments the existing "Money Out" tab display. Adding it as a card would confuse users and break the operating icicle drill-down flow.
- **Replacing operatingData with allFundsRequirementsData for the icicle chart:** The icicle/category drill-down should continue using `operating` data. Only the headline total in `PlainLanguageSummary` (and the `operatingTotal` prop to `DatasetTabs`) changes when `all_funds_requirements` is available.
- **Not guarding the gap-explanation label:** If `allFundsRequirementsData.metadata.totalBudget <= operatingData.metadata.totalBudget`, do not show the gap label (shouldn't happen with real data, but guard against it to avoid negative "remainder" display).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| PDF table extraction | Custom parser | pdfplumber `extract_tables()` (Portland) or `extract_text()` + line parsing (Gresham/Troutdale) — already proven |
| DB idempotency | Custom dedup logic | Existing delete-before-insert pattern in all three loaders |
| Data source upsert | Custom insert/update | `upsertDataSource()` already in all three loaders |
| RPC call | Direct SQL | `treasury_sync_budget_tree` RPC handles tree construction and pre-aggregation |

---

## Common Pitfalls

### Pitfall 1: Portland Vol 2 Assumption
**What goes wrong:** CONTEXT.md D-07 and ROADMAP both suggested the All Funds page might be in Vol 2. It is not.
**Why it happens:** Portland's Vol 2 is for fund-level revenue; the "Total City Budget" summary table is a Vol 1 Financial Summaries page.
**How to avoid:** All Portland `extract_requirements()` work targets `vol1` files (same as `extract_budget()`). The `processPortland.js` `requirements` mode must use `volSuffix = 'vol1'`.

### Pitfall 2: Portland Table Spanning Two Pages (FY2026)
**What goes wrong:** Extractor finds the header page (116) and stops; the Total Requirements / Ending Fund Balance rows are on page 117 and are missed.
**Why it happens:** FY2026 has a longer table than earlier years due to additional sub-header rows.
**How to avoid:** After extracting from the header page, check the next page for continuation rows. The continuation page has the same "Total City Budget" header but the table begins mid-requirements (no "Resources" section on it).

### Pitfall 3: Gresham Requirements Include Department Rows
**What goes wrong:** Extractor captures department names (Police, Fire, Budget & Finance, etc.) as "requirements categories" because they appear in the Requirements section.
**Why it happens:** Gresham's Requirements section starts with department-level operating rows before the non-operating rows.
**How to avoid:** The `extract_requirements()` function for Gresham must use `SKIP_ROWS` logic (or a new REQUIREMENTS_SKIP set) to skip the individual department rows. Alternatively, only capture rows whose names match the known non-operating categories (Capital Improvement, Debt Service, Transfers, Contingency, Other Requirements, Unappropriated).

### Pitfall 4: `all_funds_requirements` Appearing as a Selectable Tab
**What goes wrong:** If `availableDatasetTypes` passed to `DatasetTabs` includes `'all_funds_requirements'`, the component renders a broken fourth card (no label, no icon, no handler).
**Why it happens:** `App.tsx` `availableDatasetTypes` (lines 146–153) maps all `dataset_type` values from `available_datasets`.
**How to avoid:** Filter `availableDatasetTypes` to exclude `'all_funds_requirements'` before passing to `DatasetTabs`. The `DatasetType` local union in `App.tsx` already excludes it; the filter just needs to match.

### Pitfall 5: Fiscal Year Column Index
**What goes wrong:** Portland's "Adopted" column shifts between FY years if a PDF has an extra column or "Proposed"/"Approved" split.
**Why it happens:** Gresham PDFs have 6 columns; Portland may have 5 (Actuals×2, Revised, Proposed, Adopted) — all confirmed as index [5] in the extracted tables. But older FY volumes may differ.
**How to avoid:** Verify column count before extracting. In live extraction, all 5 Portland volumes used 6 columns with Adopted at index [5]. Add an assertion `len(row) >= 6` as a row filter.

### Pitfall 6: OCR Number Splits in Portland Table
**What goes wrong:** Large Portland amounts (billions) may have OCR artifacts; `parse_money()` handles this but the doubled-digit artifact pattern from older Vol 2 PDFs does not apply here (Vol 1 table is clean).
**Why it happens:** Portland's Vol 1 Financial Summaries tables use `extract_tables()` which returns clean cell values without the text-line OCR artifacts seen in Gresham.
**How to avoid:** Portland `extract_requirements()` uses `extract_tables()`, not text-line parsing. The existing `parse_money()` in `extractPortland.py` handles both clean numbers and the double-digit artifact — no changes needed.

---

## Code Examples

### Gresham `extract_requirements()` skeleton

```python
# Source: derived from existing extract_revenue() in extractGresham.py (verified in this session)
REQUIREMENTS_SKIP = {
    'Total Requirements', 'Operating Total', 'Non-Operating Total',
    # Individual department names from extractGresham.py SKIP_ROWS that appear in Requirements section:
    'Office of Governance & Management', 'City Attorney\'s Office', 'Budget & Finance',
    # ... (or use a whitelist approach: only collect known non-operating categories)
}
# Recommended: whitelist approach — only collect these known non-operating categories
REQUIREMENTS_CATEGORIES = {
    'Capital Improvement', 'Debt Service', 'Transfers', 'Contingency',
    'Other Requirements', 'Unappropriated',
}

def extract_requirements(pdf_path):
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Resources and Requirements' not in text or 'All Funds' not in text:
                continue
            if 'Taxes' not in text:  # skip TOC page (same guard as extract_revenue)
                continue
            fiscal_year = None
            lines = text.split('\n')
            for line in lines[:8]:
                fy = parse_fy_from_header(line)
                if fy:
                    fiscal_year = fy
                    break
            in_requirements = False
            for line in lines:
                s = line.strip()
                if not s:
                    continue
                s_norm = re.sub(r'\s+', '', s)
                if s_norm == 'Requirements' or s.startswith('Requirements'):
                    in_requirements = True
                    continue
                if s_norm == 'Resources' or s.startswith('Resources '):
                    in_requirements = False
                    continue
                if not in_requirements:
                    continue
                # Parse tokens: name + numbers (same as extract_revenue)
                tokens = s.split()
                name_tokens, num_tokens = [], []
                in_nums = False
                for t in tokens:
                    if not in_nums and (re.match(r'^[\d,]+$', t) or t == '-'):
                        in_nums = True
                    (num_tokens if in_nums else name_tokens).append(t)
                if not name_tokens or len(num_tokens) < 6:
                    continue
                category = re.sub(r'\s+', ' ', ' '.join(name_tokens)).strip()
                if category not in REQUIREMENTS_CATEGORIES:
                    continue  # whitelist approach skips depts and sum rows
                adopted_raw = num_tokens[-1]
                if (len(num_tokens) >= 2
                        and re.match(r'^\d{1,3}$', num_tokens[-2])
                        and re.match(r'^\d{1,3},', num_tokens[-1])):
                    adopted_raw = num_tokens[-2] + num_tokens[-1]
                adopted = parse_money(adopted_raw)
                if adopted <= 0:
                    continue
                results.append({
                    'category': category,
                    'adopted_amount': adopted,
                    'fiscal_year': fiscal_year,
                    'page_num': page_num,
                })
            if results:
                break
    return results
```

### Portland `extract_requirements()` skeleton

```python
# Source: derived from Vol 1 table extraction verified live in this session
PORTLAND_REQUIREMENTS_SKIP = {
    'Resources', 'Requirements',
    'External Revenues', 'Internal Revenues', 'Bureau Expenditures', 'Fund Expenditures',
    'Total External Revenues', 'Total Internal Revenues', 'Total Resources',
    'Less Intracity Transfers', 'Total NET Budget',
    'Total Bureau Expenditures', 'Total Fund Expenditures',
    'Total Requirements', 'Ending Fund Balance', 'Beginning Fund Balance',
}

def extract_requirements(pdf_path):
    results = []
    fiscal_year = None
    in_requirements = False
    found_data_page = False

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            is_data_page = (
                'Total City Budget' in text and
                'Resources and Requirements' in text and
                'Personnel Services' in text
            )
            is_continuation = (
                found_data_page and
                'Total City Budget' in text and
                'Resources and Requirements' in text and
                'Personnel Services' not in text  # continuation only has Requirements rows
            )
            if not (is_data_page or is_continuation):
                if found_data_page:
                    break  # past the table
                continue

            found_data_page = True
            if fiscal_year is None:
                fy = detect_fiscal_year(text)
                if fy:
                    fiscal_year = fy

            tables = page.extract_tables()
            if not tables:
                continue

            for row in tables[0]:
                if not row or not row[0]:
                    continue
                name = row[0].replace('\n', ' ').strip()
                # Normalize compound headers like 'Requirements\nBureau Expenditures'
                name = name.split('\n')[0].strip()
                if not name or name in PORTLAND_REQUIREMENTS_SKIP:
                    continue
                if len(row) < 6 or row[5] is None:
                    continue
                adopted = parse_money(row[5])
                if adopted <= 0:
                    continue
                results.append({
                    'category': name,
                    'adopted_amount': adopted,
                    'fiscal_year': fiscal_year,
                    'page_num': page_num,
                })

    return results
```

### PlainLanguageSummary gap-explanation label (concept)

```typescript
// Source: derived from reading PlainLanguageSummary.tsx in this session
// When allFundsRequirementsData is present, show gap explanation after main budget sentence.
{allFundsRequirementsData && operatingData && (
  <p className="text-[13px] text-ev-gray-400 dark:text-ev-gray-500 mt-1 italic">
    This {formatAmount(allFundsRequirementsData.metadata.totalBudget)} total covers all city funds.
    The department breakdown below accounts for{' '}
    <strong className="text-ev-gray-600 dark:text-ev-gray-300">
      {formatAmount(operatingData.metadata.totalBudget)}
    </strong>{' '}
    in departmental operations; the remaining{' '}
    <strong className="text-ev-gray-600 dark:text-ev-gray-300">
      {formatAmount(allFundsRequirementsData.metadata.totalBudget - operatingData.metadata.totalBudget)}
    </strong>{' '}
    covers debt service, capital projects, and other city-wide requirements.
  </p>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Portland PDF extraction via text-line parsing | `extract_tables()` for Financial Summaries page | Phase 17 | Portland Vol 1 Appropriation Schedule uses tables; same tool works for the All Funds summary table |
| Single dataset type for budget display | Multiple `dataset_type` values (operating, revenue, salaries) | Phases 5–14 | `all_funds_requirements` extends this pattern |
| Money Out tab shows departmental operating total | Money Out tab shows All Funds Requirements total (when available) | Phase 23 | Aligns Money In / Money Out scope for OR cities |

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification via `--dry-run` flags |
| Config file | None — no automated test framework in this project |
| Quick run command | `node scripts/processGresham.js --mode requirements --dry-run` |
| Full suite command | All three cities: `--dry-run` pass + total cross-check against PDF |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| — | Gresham requirements extraction returns ~6 categories, total ~$897M FY2026 | Smoke | `node scripts/processGresham.js --mode requirements --dry-run` |
| — | Portland requirements extraction returns ~8 categories, total ~$8.6B FY2026 | Smoke | `node scripts/processPortland.js --mode requirements --dry-run` |
| — | Troutdale requirements extraction returns ~7 categories, total ~$81M FY2026 | Smoke | `node scripts/processTroutdale.js --mode requirements --dry-run` |
| — | DB load inserts rows with dataset_type='all_funds_requirements' | Integration | Live load + query `treasury.data_sources` |
| — | Frontend Budget tab shows All Funds total (~$897M) for Gresham | Manual | Load app, select Gresham, verify Money Out card |
| — | Gap-explanation label appears for OR cities, absent for TX/CA | Manual | Compare Gresham vs. Dallas display |
| — | Year selector still works (all FYs show matching totals) | Manual | Switch years for Gresham, verify totals update |

### Wave 0 Gaps

None — no automated test framework exists in this project. All verification is via `--dry-run` dry-runs and manual app inspection.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python + pdfplumber | PDF extraction | ✓ | Existing (used in phases 17–22) | — |
| Node.js | Loaders | ✓ | Existing | — |
| Supabase service key | DB writes | ✓ | In `.env` | — |
| Portland Vol 1 PDFs | Portland extraction | ✓ | 5 files in `docs/Portland/` | — |
| Gresham PDFs | Gresham extraction | ✓ | 4 files in `docs/Gresham/` | — |
| Troutdale PDFs | Troutdale extraction | ✓ | 8 files in `docs/Troutdale/` | — |

No missing dependencies.

---

## Security Domain

> `security_enforcement` absent from config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth surfaces |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No new endpoints |
| V5 Input Validation | Yes | PDF path from controlled `docs/` readdir; `spawnSync` with args array (no shell injection) — existing pattern |
| V6 Cryptography | No | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shell injection via PDF path | Tampering | `spawnSync` with args array — existing T-20-03/T-21-01/T-22-01 pattern; Phase 23 extends same security comment to requirements mode |
| Oversized PDF extraction output | DoS | maxBuffer 8MB limit in `spawnSync` — existing pattern |
| Unreasonably large requirements total | Tampering | SANITY_MAX gated on `mode === 'operating'` only; requirements mode explicitly excluded (same as revenue mode) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Portland FY2022–FY2025 All Funds table fits on a single page (only FY2026 spans two pages) | Portland Requirements Section Structure | Extractor misses rows for earlier years; mitigation: dry-run total cross-check against PDF |
| A2 | Portland Requirements Adopted column is consistently index [5] across all 5 years | Portland Requirements Section Structure | Wrong amounts extracted; mitigation: `len(row) >= 6` guard + dry-run total verification |
| A3 | Troutdale All Funds Requirements structure is identical across FY2019–FY2026 | Troutdale Requirements Section Structure | Parser fails on old-format PDFs; mitigation: verified FY2019 and FY2026 live; intermediate years likely same |

---

## Open Questions

1. **Portland total to display — gross or net?**
   - What we know: Portland Total Requirements (~$8.6B) includes Fund Transfers - Expense (~$1.7B) which is an intracity transfer. Total NET Budget (~$6.5B) nets this out.
   - What's unclear: Should the Money Out card show gross $8.6B or net $6.5B? For citizen clarity, the net figure may be more meaningful (avoids double-counting internal transfers).
   - Recommendation: Match what Money In (revenue) side already shows. Phase 21 Portland revenue was deferred, so there is no existing revenue display to match against. Use Total NET Budget for Portland to be consistent with the "same page" approach Gresham uses (Gresham money in = Total Resources net of Beginning Balance; Gresham money out should = Total Requirements net of Ending Fund Balance / Beginning Balance).
   - **Planner decision needed:** Lock down whether to store Total Requirements or Total NET Budget for Portland. For Gresham and Troutdale, the Total Requirements line is the right number.

2. **Gresham: which rows to show in the icicle?**
   - What we know: When `activeDataset === 'operating'`, the icicle shows departmental rows from the `operating` dataset. Phase 23 does not change the `operating` dataset.
   - What's unclear: D-02 says "existing icicle/department breakdown remains." This is achieved by not changing what `operating` data loads — only the headline total changes to use `all_funds_requirements`. No icicle change needed.
   - Recommendation: Confirm the planner understands this — the icicle always uses `budgetData` (the active dataset), and when `activeDataset === 'operating'`, `budgetData` is still the departmental operating data. The `all_funds_requirements` data is loaded in the background for the headline only.

---

## Sources

### Primary (HIGH confidence)
- Live `pdfplumber` extraction of `docs/Portland/fy2025-26-vol1.pdf` page 116–117 — confirmed Portland Vol 1 location and table structure
- Live `pdfplumber` extraction of all 5 Portland vol1 PDFs — confirmed page present FY2022–FY2026
- Live `pdfplumber` extraction of `docs/Gresham/fy2025-26.pdf` — confirmed Requirements section row structure
- Live `pdfplumber` extraction of `docs/Troutdale/fy2025-26.pdf` and `fy2018-19.pdf` — confirmed All Funds Combined Requirements structure across FY2019 and FY2026
- Direct reading of `scripts/extractGresham.py`, `extractPortland.py`, `extractTroutdale.py` — confirmed section gating patterns
- Direct reading of `scripts/processGresham.js`, `processPortland.js`, `processTroutdale.js` — confirmed loader patterns
- Direct reading of `src/App.tsx`, `src/types/budget.ts`, `src/components/datasets/DatasetTabs.tsx`, `src/components/dashboard/PlainLanguageSummary.tsx` — confirmed frontend integration points

### Secondary (MEDIUM confidence)
- `.planning/phases/21-gresham-or-revenue-load/21-RESEARCH.md` — prior art for section-gate approach
- `.planning/phases/23-.../23-CONTEXT.md` — locked decisions and canonical references
- `.planning/STATE.md` — confirmed FY ranges and current DB coverage

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all tools proven in phases 17–22
- Architecture: HIGH — PDFs verified live; page structures confirmed; frontend code read directly
- Pitfalls: HIGH — Portland Vol 2 assumption debunked live; multi-page issue observed directly

**Research date:** 2026-06-01
**Valid until:** 2026-09-01 (PDFs on disk; no external dependency on live URLs)
