# Phase 37: MA Loader Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 37-ma-loader-hardening
**Areas discussed:** Explore confirmation (LOAD-01), Checkpoint design (LOAD-02), Fiscal years idempotency (LOAD-03)

---

## Explore Confirmation (LOAD-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Human eyeball is sufficient | Run --explore, read output, proceed. No verdict file needed — rdreport hardcoded in REPORTS[]. | ✓ |
| Write a verdict file | --explore writes JSON verdict file that --scrape checks at startup | |

**User's choice:** Human eyeball sufficient

| Option | Description | Selected |
|--------|-------------|----------|
| Plan 37-01 runs --explore, reports what it finds, we decide mid-phase | Discovery step — if rdreport is wrong, plan finds the correct one | ✓ |
| Treat as already confirmed — plan just verifies | Assumes current rdreport is correct | |

**User's choice:** Plan 37-01 is a discovery step, not a rubber-stamp

---

## Checkpoint Design (LOAD-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Per DOR code within each (report, FY) run | Tracks individual cities; resumes from last city. Matches requirement language. | ✓ |
| Per (report, FY) pair only | Simpler; failure mid-run restarts the full year | |

**User's choice:** Per DOR code

| Option | Description | Selected |
|--------|-------------|----------|
| scripts/output/ma_dls_progress.json, persists across runs | Single permanent load ledger | ✓ |
| scripts/output/ma_dls_progress_{report}_{fy}.json, one per run | Separate file per run, deleted on completion | |

**User's choice:** Single persistent file

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-skip already-loaded DOR codes silently, log count at end | Always-on, no flag, idempotent by default | ✓ |
| Require --resume flag to skip checkpoint entries | Explicit but requires remembering the flag | |

**User's choice:** Always-on, no flag required

---

## Fiscal Years Idempotency (LOAD-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Deduplicate — don't add a FY already in the array | JS-side includes() check before append | ✓ |
| Allow duplicates — tree RPC is idempotent anyway | Simpler SQL; array may have [2021, 2021] | |

**User's choice:** Deduplicate

| Option | Description | Selected |
|--------|-------------|----------|
| JS-side: read existing array, add FY if missing, update | Consistent with existing code style | ✓ |
| Postgres array_append + array_distinct in UPDATE SQL | Atomic but requires raw SQL or RPC | |

**User's choice:** JS-side

---

## Claude's Discretion

- Dry-run scope for SC-4: use existing `--load --file --dry-run` against cached JSON; no new `--limit` flag
- Checkpoint JSON structure: Claude chooses exact format
- Progress file stays in scripts/output/ (already gitignored)

## Deferred Ideas

- WR-04 hardcoded SUPABASE_URL fallback in scrapeMaDLS.js (line 41) — same pattern fixed in Phase 36; deferred to planner discretion or Phase 38 code review
- `--limit N` flag for capping bulk load to N cities — not needed for Phase 37 SC-4; deferred to Phase 38
- DOR code column in treasury.municipalities — no schema change needed for Phase 37 checkpoint approach
