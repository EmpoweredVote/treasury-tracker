# SCOPE-01 → EV-Accounts handoff: surfacing `fund_scope`

**From:** Treasury Tracker (`C:\treasury-tracker`, branch `feat/scope-01`)
**To:** EV-Accounts (`C:\EV-Accounts`, `accounts-api.empowered.vote`)
**Date:** 2026-08-17
**Blocks:** SCOPE-01 Task 10 (the TT scope label + explainer) cannot start until the API returns
this field.

---

## TL;DR

`treasury.budgets` has a new column, **`fund_scope`**, already populated on all 79,927 rows. **You
have no migration to run and no data to load** — the database is shared and TT owns the column. What
is needed is for it to appear in your `SELECT` lists, your types, and `available_datasets`.

> ## ✅ IMPLEMENTED 2026-08-17 — EV-Accounts branch `feat/scope-01-fund-scope-api`, commit `ca1de8a4`
>
> These changes have been **made and committed** rather than left as instructions. What remains is
> review + a run against a live DB + merge. See §7 for exactly what was and was not verified.
>
> **Correction to this document: it is EIGHT sites, not six.** Writing it from the SELECT lists
> missed `TreasuryDataset` (line 112) and `CityRow.available_datasets` (line 222), plus the
> `available_datasets` mapper inside `mapCity` (line 333). All eight are listed in §2 and all eight
> are in the commit.

**Eight code edits, one new test.** All line numbers below were read from
`backend/src/lib/treasuryService.ts` on 2026-08-17 (file is 1,445 lines). ⚠ The SCOPE-01 plan cited
older numbers (420/458/489/509/767/789/842/970); they had drifted by ~10 lines, so trust the
anchors quoted here over any number.

---

## 1. What the column is

```sql
fund_scope text NOT NULL DEFAULT 'unknown'
  CHECK (fund_scope IN ('general_fund','total_governmental','all_funds','unknown'))
```

Which funds a row's `total_budget` actually covers. Classified **per data source**, against an
independent document, with the evidence recorded in
`docs/superpowers/plans/SCOPE-01-RECON.md`. A source with no reconciliation stays `unknown`, and
`unknown` is a correct answer rather than a gap.

Current live distribution:

| `fund_scope` | Rows | % | Entities |
|---|---|---|---|
| `total_governmental` | 28,410 | 35.5% | 1,286 |
| `unknown` | 26,523 | 33.2% | 1,066 |
| `all_funds` | 23,260 | 29.1% | 533 |
| `general_fund` | 1,734 | 2.2% | 54 |

**Why it exists:** the app has been showing General Fund figures for some cities and all-funds
figures for others, in the same charts, at the same per-capita scale, with nothing distinguishing
them. Seven CA cities show the seam inside their own history — Long Beach drops 75.0% between
FY2024 and FY2025 purely because the source changed scope. Nothing in the data said so until now.

**It is NOT in the unique index.** `idx_budget_municipality_year_type` is unchanged at
`(municipality_id, fiscal_year, dataset_type, period_label) NULLS NOT DISTINCT`. Nothing creates a
second-scope row for one city-year until SCOPE-02, so widening early would have opened a
double-count hazard for no benefit.

---

## 2. The eight edits

### 2.0 `interface TreasuryDataset` — line 112 (⚠ missed in this doc's original count)

The `available_datasets` entry type. Add `fund_scope: string;` — this is what §2.5 populates.

### 2.0b `CityRow.available_datasets` — line 222 (⚠ also missed)

The raw row shape behind it: widen the inline
`Array<{ fiscal_year; dataset_type; period_label }>` to carry `fund_scope: string`.

### 2.0c the `available_datasets` mapper in `mapCity()` — line 333 (⚠ also missed)

```ts
available_datasets: (row.available_datasets ?? []).map((d) => ({
  fiscal_year: Number(d.fiscal_year),
  dataset_type: d.dataset_type,
  period_label: d.period_label ?? null,
  fund_scope: d.fund_scope,        // ← ADD
})),
```

### 2.1 `interface BudgetRow` — line 225

```ts
interface BudgetRow {
  id: string;
  municipality_id: string;
  fiscal_year: string; // bigint returned as string
  dataset_type: string;
  period_label: string | null;
  total_budget: string; // numeric returned as string
  fund_scope: string;   // ← ADD. Always present: NOT NULL with a default.
  data_source: string | null;
  …
```

### 2.2 `interface TreasuryBudget` — line 132 (the public response type)

```ts
export interface TreasuryBudget {
  …
  total_budget: number;
  fund_scope: string;   // ← ADD. 'general_fund' | 'total_governmental' | 'all_funds' | 'unknown'
  data_source: string | null;
  …
```

A string union rather than `string` would be nicer, but note SCOPE-02 may add values — a widened
union is a breaking change for consumers that exhaustively switch, so `string` plus a documented
value list is the safer contract. Your call.

### 2.3 `mapBudget()` — line 340

```ts
function mapBudget(row: BudgetRow): TreasuryBudget {
  return {
    …
    total_budget: Number(row.total_budget),
    fund_scope: row.fund_scope,   // ← ADD (no coercion; it is already text)
    …
```

### 2.4 The three `BudgetRow` SELECT lists — around lines **489**, **509** and **767**

All three are byte-identical column lists, which is why it is easy to update two and miss one. Each
begins:

```sql
SELECT b.id, b.municipality_id, b.fiscal_year, b.dataset_type, b.period_label, b.total_budget,
       b.data_source, b.source_url, b.source_date,
```

Add `b.fund_scope` to each — suggested placement right after `b.total_budget,` so it mirrors the
type definitions:

```sql
SELECT b.id, b.municipality_id, b.fiscal_year, b.dataset_type, b.period_label, b.total_budget,
       b.fund_scope,
       b.data_source, b.source_url, b.source_date,
```

| Line | Function | Endpoint |
|---|---|---|
| ~489 | `getBudgetsForCity` (fiscal-year branch) | `GET /api/treasury/cities/:id/budgets?fiscal_year=` |
| ~509 | `getBudgetsForCity` (all-years branch) | `GET /api/treasury/cities/:id/budgets` |
| ~767 | `getBudgetWithCategories` | `GET /api/treasury/budgets/:id` |

**These are the paths that matter most.** Scope hangs off `budgets`; categories and line items
inherit it and need no column of their own.

### 2.5 ⭐ `available_datasets` — lines **424** and **462**. Please do not skip this one.

`getCities()` (line 418) and the single-city variant (~line 462) both build:

```sql
json_build_object('fiscal_year', b.fiscal_year, 'dataset_type', b.dataset_type,
                  'period_label', b.period_label)
```

Add `fund_scope`:

```sql
json_build_object('fiscal_year', b.fiscal_year, 'dataset_type', b.dataset_type,
                  'period_label', b.period_label, 'fund_scope', b.fund_scope)
```

…and add it to whatever type describes an `available_datasets` entry.

**Why this is the highest-value edit, learned the hard way.** `available_datasets` is what the TT
frontend uses to decide which years and datasets to *offer* — before it fetches any budget. It
currently carries no scope and no source information, which means **the frontend cannot filter or
label by scope at the point where it builds the picker.** We hit exactly this wall hiding 304
incomplete VA rows: with no source or scope in `available_datasets`, there was no way to stop the UI
offering a tab whose data we did not want shown, and we had to relabel `dataset_type` instead.
Task 10 has to hold `unknown`-scope rows out of cross-entity comparison surfaces; without
`fund_scope` here, that has to be done by fetching every budget first, which is far worse.

---

## 3. The new test

Mirror the Phase 50 `period_label` test in `tests/integration/treasury-cities.test.ts` (line 74) —
same shape, same `if (cities.length === 0) return;` guard so it is a no-op without a live DB:

```ts
// SCOPE-01: available_datasets entries expose fund_scope, so the frontend can
// label scope and hold `unknown` rows out of cross-entity comparison without
// fetching every budget first.
it('available_datasets entries expose a fund_scope key', async () => {
  const res = await request(app).get('/api/treasury/cities');
  expect(res.status).toBe(200);
  const cities = res.body as Array<Record<string, unknown>>;
  if (cities.length === 0) return;
  const legal = ['general_fund', 'total_governmental', 'all_funds', 'unknown'];
  for (const city of cities) {
    const datasets = (city['available_datasets'] as Array<Record<string, unknown>>) ?? [];
    for (const ds of datasets) {
      expect(ds, 'each dataset entry must carry fund_scope').toHaveProperty('fund_scope');
      expect(legal, `unexpected fund_scope ${String(ds['fund_scope'])}`).toContain(ds['fund_scope']);
    }
  }
});
```

A companion assertion on `GET /api/treasury/budgets/:id` returning `fund_scope` would be worth
adding too, if there is a fixture budget id to hand.

---

## 4. Explicitly NOT yours

- **No migration.** TT owns the column and has already applied it
  (`supabase/migrations/20260817000000_scope_01_add_fund_scope_to_budgets.sql`, plus
  `…000100` narrowing the CHECK set).
- **Do NOT add `fund_scope` to the INSERT at line ~1341.** The DB default `'unknown'` is deliberate:
  a writer that has not been taught about scope must produce an honest unknown rather than a guess.
  Sending a value from the API would bypass the registry, which is the one thing SCOPE-01 exists to
  prevent.
- **No category-level `fund_type`.** That is a different column with a different meaning and belongs
  to SCOPE-02. If you see it referenced anywhere, it is not this.
- **No `reporting_entity` yet.** SCOPE-02 adds it (`primary_government` /
  `incl_component_units` / `unknown`) because state-collected forms consolidate component units that
  city ACFRs present separately — MN OSA runs ~7% high on average, ~20% for TIF-heavy cities. Not
  your problem today; mentioned so the shape of what is coming is visible.

---

## 5. One more thing you will see in the data

A new `dataset_type` value exists: **`revenue_local_only`**, on 304 VA APA rows
(migration `…000200`). The VA APA revenue figures are Exhibit B "Total *Local* Revenue" and exclude
intergovernmental aid, so they understate revenue by up to ~40% for aid-dependent localities. The
relabel hides them from the TT UI, which allow-lists known dataset types.

**No API change is needed** — you pass `dataset_type` through as text. Flagged only so the value is
not a surprise, and so nobody "helpfully" maps it back to `revenue`.

---

## 6. Coordination

**There is no deployment ordering to coordinate.** The database is shared, so the column and its
values are already live for you. Confirmed by measurement rather than assumption: before this
handoff was written, `GET /api/treasury/cities` and `GET /api/treasury/budgets/:id` were both hit
against production and returned HTTP 200 with `fund_scope` **absent** from the payload — the
explicit column lists make the new column inert until you add it. Nothing is broken in the meantime;
the field simply is not there yet.

Ship whenever suits. TT Task 10 starts when it lands.

**Questions:** the evidence for every classification, including the sources that came out `unknown`
and why, is in `docs/superpowers/plans/SCOPE-01-RECON.md` on `feat/scope-01`.

---

## 7. What was verified, and what was not

Implemented on EV-Accounts branch `feat/scope-01-fund-scope-api`, commit `ca1de8a4`
(2 files, +49/−3).

**Verified:**

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| Backend suite (`cd backend && npm test`) | **1,011 passed / 9 skipped, 84 files** — no regressions |
| Modified `available_datasets` `json_build_object` run against the live DB | ✅ returns `fund_scope` per entry. Modesto comes back `all_funds` for operating/revenue and `unknown` for salaries **in one payload** — which is exactly why scope belongs at dataset level |
| Modified `BudgetRow` SELECT (with its LATERAL joins) run against the live DB | ✅ Modesto FY2024 operating → `fund_scope: 'all_funds'`, `total_budget: 588042068` |

**NOT verified — needs one run against a live DB before merge:**

* The new integration test is **collected but skipped** locally. The suite gates on `hasLiveDb` and
  no `DATABASE_URL` was available. It parses and registers (the file went from 3 tests to 4); it has
  not executed. Run it with a real `DATABASE_URL` before merging.

**Pre-existing, unrelated, not fixed:** the **root** `vitest.config.ts` cannot resolve
`vitest/config` because there is no root `node_modules`, so
`vitest run tests/integration/…` from the repo root fails. Confirmed by stashing: it fails
identically on unmodified `master`. The backend config picks those files up as
`../tests/integration/…` and works fine, which is how the suite above was run.

**Left alone deliberately:** the repo had ~20 untracked `backend/.tmp-*` files and directories
before this work. None were touched, added or removed.
