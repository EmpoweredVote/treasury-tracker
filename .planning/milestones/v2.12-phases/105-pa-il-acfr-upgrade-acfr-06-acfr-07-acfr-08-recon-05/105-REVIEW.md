---
phase: 105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05
reviewed: 2026-06-30T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/processPAAcfr.js
  - scripts/processPARevenueAcfr.js
  - scripts/processILAcfr.js
  - scripts/processILRevenueAcfr.js
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 105: Code Review Report

**Reviewed:** 2026-06-30
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four Node.js ACFR data loaders (PA expenditure/revenue, IL expenditure/revenue) built on the v2.11 FL/TX pattern. All write General Fund GAAP data to `treasury.budgets` via the `treasury_sync_budget_tree` RPC, then stamp `source_url`/`source_date`/`data_source` on the resulting row.

Verification performed during review:
- **All 30 FY data maps tie at exactly 0 diff** between category sum and printed total (re-summed programmatically — confirmed, including the IL FY2022 signed-sum case with the −197,857 thousands clamp category). The transcription is internally consistent.
- **RPC semantics traced** against `supabase/migrations/20260613120000_add_budget_period_label.sql`. The RPC is replace-in-place (deletes categories/line-items for an existing `(muni, fy, dataset_type, period_label)` row and re-inserts, updating `total_budget`). This is the intended NASBO-replacement behavior, not an unintended overwrite.
- **No secrets leaked.** The hardcoded `SUPABASE_URL` is a public project endpoint (consistent with the existing `processCARevenueAcfr.js` convention); the service key is read from env only.

No BLOCKER/critical defects found. The findings below concern a real render-total inconsistency introduced by the P2 clamp, a divergence between the two expenditure loaders' clamp handling, a tolerance window that can silently absorb transcription errors, and several robustness/consistency issues.

## Warnings

### WR-01: P2 clamp makes the root total disagree with the sum of rendered children (IL FY2022)

**File:** `scripts/processILRevenueAcfr.js:148-157` (also the wired-but-unfired clamp path in `processPAAcfr.js:218-227` and `processPARevenueAcfr.js:196-205`)
**Issue:** When a category is negative, `clampForRender` renders it at 0 while the root node `a` is set to `total * UNITS`, where `total` is the *net* printed figure that already subtracts the negative. For IL FY2022 the visible children sum to `73,204,339 + 197,857 = 73,402,196` thousands, but the root carries `73,204,339` thousands. The icicle root therefore does not equal the sum of its visible children (off by the clamped magnitude, ~$197.9M). Depending on how the icicle renderer allocates child widths against the parent, this produces either an overflow or a visual mis-scale. The LOADLOG documents this as "root total carries the net" — i.e. it is a *known* consequence of ACFR-08, but it is still a correctness/consistency concern for any consumer that assumes `parent.a == Σ child.a`.
**Fix:** Decide and document the invariant explicitly. Either (a) keep the root at the gross-of-clamp sum of rendered children and surface the net separately, or (b) confirm in code/comment that the renderer tolerates `Σ children > parent` and add a regression assertion that the only allowed discrepancy equals the summed clamped magnitude:
```js
const clampedMag = categories.filter(c => c.total < 0).reduce((s,c)=>s - c.total, 0);
const childSum = children.reduce((s,c)=>s + c.a, 0);
// invariant: childSum === (total + clampedMag) * UNITS
```

### WR-02: Inconsistent negative-category handling between the two expenditure loaders

**File:** `scripts/processILAcfr.js:142-147` vs `scripts/processPAAcfr.js:218-227`
**Issue:** PA expenditure filters with `c.total !== 0` and applies the documented P2 clamp + "(net loss — shown at 0)" label. IL expenditure filters with `c.total > 0`, has **no** `clampForRender` import, and would **silently drop** any negative expenditure category entirely — no clamped node, no net-loss label, no console note. The four scripts are presented as one family built on a shared pattern, but two of them implement the ACFR-08 clamp and two diverge. Today no IL expenditure category is negative so nothing fires, but a future FY transcription with a negative function (e.g. a debt-service refund or restatement) would vanish from the icicle without any signal, while still passing `validate()`.
**Fix:** Make `processILAcfr.js` use the same `clampForRender` + `!== 0` filter + net-loss label path as the other three loaders, so a future negative is rendered at 0 with a visible label rather than dropped:
```js
function clampForRender(amount) { return Math.max(amount, 0); }
// ...
const children = categories.filter(c => c.total !== 0).map(cat => {
  const rendered = clampForRender(cat.total) * UNITS;
  const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
  return { n: label, a: rendered, i: [] };
});
```

### WR-03: ±10,000-thousand validation tolerance can silently absorb a ~$10M transcription error

**File:** `scripts/processPAAcfr.js:212-217`, `scripts/processPARevenueAcfr.js:190-195`, `scripts/processILAcfr.js:136-141`, `scripts/processILRevenueAcfr.js:142-147`
**Issue:** `validate()` accepts any category sum within `±10,000` thousands (±$10,000,000) of the printed total. Every transcription was verified at *exactly* 0 diff (confirmed in this review), so the loaders never need a non-zero tolerance. A `±$10M` slack means a single mistyped category (e.g. a transposed digit producing a few-million-dollar error) would pass validation and load silently — defeating the purpose of the control check on a publicly-displayed financial figure.
**Fix:** Since all data ties at 0, tighten the tolerance to 0 (or a token `±1` thousand for rounding) so any transcription drift is caught:
```js
if (Math.abs(catSum - total) > 0) { console.error(...); ok = false; }
```
If a future FY genuinely cannot tie exactly (rounding in the source), raise the tolerance for that FY explicitly rather than leaving a blanket $10M window.

### WR-04: `--fy` accepts arbitrary/garbage input without validation

**File:** `scripts/processPAAcfr.js:230-232` (and the identical block in all four files)
**Issue:** `parseArgs` is called with `strict: false` and `--fy` is `parseInt(opts.fy, 10)`. `parseInt('garbage')` → `NaN`; `--fy 99` → `99`. The loop guard `if (!EXPENDITURES[fy] || !SOURCES[fy])` catches unknown years with a warning and continues, so a bad `--fy` results in "No data/source for FY{fy}" then "Done." with no non-zero exit. An operator who typos `--fy 2024x` or `--fy 204` gets a clean "Done." and may believe a load occurred when nothing happened. With `strict: false`, unknown flags are also silently ignored (e.g. `--dryrun` instead of `--dry-run` would run a **live load**).
**Fix:** Validate the parsed FY and exit non-zero on an unrecognized year; consider `strict: true` or at least warn on unknown options:
```js
const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
if (opts.fy && (Number.isNaN(targetFY) || !EXPENDITURES[targetFY])) {
  console.error(`Invalid --fy ${opts.fy}: not a loaded fiscal year`); process.exit(2);
}
```
Note the `--dry-run` typo risk is the more dangerous half: a mistyped dry-run flag silently performs a live write.

### WR-05: `data_sources` lookup/insert can create duplicate sources under a race or partial failure

**File:** `scripts/processPAAcfr.js:245-247` (identical in all four)
**Issue:** The data_source upsert is a non-atomic check-then-act: `select ... .maybeSingle()` then branch to `update` or `insert`. `dataset_id` (`pa-acfr-gf-operating`, etc.) is the natural key, but there is no `.upsert(..., { onConflict: 'dataset_id' })` and the review cannot confirm a unique constraint exists on `data_sources.dataset_id`. If two loaders run concurrently, or a prior run inserted then failed before completing, a second `insert` path could create a duplicate `data_sources` row with the same `dataset_id`, after which `maybeSingle()` would throw on the multiple-row result. This is the same class of bug recorded in project memory for NULL-municipality enrichment upserts.
**Fix:** Use a single idempotent upsert keyed on `dataset_id` (and confirm/add a unique constraint on that column):
```js
const { data: ds, error } = await supabase.schema('treasury').from('data_sources')
  .upsert(srcPayload, { onConflict: 'dataset_id' }).select().single();
```

## Info

### IN-01: `.env` parser is brittle for quoted values and inline comments

**File:** `scripts/processPAAcfr.js:52-56` (identical in all four)
**Issue:** `loadEnv` splits on the first `=` and trims, but does not strip surrounding quotes or trailing `# comment` text. A `.env` entry like `SUPABASE_SERVICE_KEY="abc..."` would load the literal value including quotes, and an inline comment would be appended to the value. This would produce an auth failure that surfaces only as an opaque RPC error at runtime.
**Fix:** Strip matching surrounding quotes after trimming, or use a vetted dotenv loader. Low priority since current `.env` files apparently work.

### IN-02: `rowCount` reported to the RPC is the count of *rendered* (non-zero/clamped) children, not the transcribed category count

**File:** `scripts/processPAAcfr.js:220-226` (and analogous in the others)
**Issue:** `buildTree` filters out zero-value categories (PA expenditure FY2016-FY2018 have `Debt service — Principal retirement = 0`) before computing `rowCount`. The "Loaded N rows" log and `p_row_count` therefore under-count vs the source category list. Harmless for storage (the RPC recomputes `rows_inserted` itself), but the printed row count can mislead an operator comparing against the ACFR line count.
**Fix:** Either log both ("8 of 10 source categories rendered; 2 zero-value omitted") or pass the full category count as `p_row_count` for provenance.

### IN-03: Duplicated boilerplate across all four loaders invites drift

**File:** all four files (`loadEnv`, `validate`, `buildTree`, the entire `main()` data_source/RPC/source-stamp block)
**Issue:** The four scripts share ~120 lines of near-identical logic. WR-02 (the IL-vs-PA clamp divergence) is a direct symptom: the shared pattern was copied but not kept in lockstep. Future fixes must be applied four times.
**Fix:** Extract the common loader skeleton (env load, muni resolve, data_source upsert, per-FY RPC + source stamp, clamp/buildTree helpers) into a shared module parameterized by `{ STATE_NAME, STATE_ABBR, SOURCES, DATA, datasetType, rootLabel }`.

### IN-04: `last_synced_at` update result is unchecked

**File:** `scripts/processPAAcfr.js:274` (identical in all four)
**Issue:** The final `update({ last_synced_at: ... })` discards its error. The RPC already sets `last_synced_at = now()` on success (per the migration), so this trailing update is partly redundant and a silent failure has no consequence — but it is dead-ish code whose failure is invisible.
**Fix:** Remove the redundant update (the RPC already stamps `last_synced_at`), or check and log its error for consistency with the other DB calls in the loop.

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
