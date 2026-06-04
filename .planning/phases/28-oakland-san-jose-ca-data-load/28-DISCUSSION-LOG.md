# Phase 28: Oakland + San Jose CA Data Load - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 28-oakland-san-jose-ca-data-load
**Areas discussed:** Oakland FY depth, San Jose fund scope, Revenue data strategy, Plan structure, API cost gate

---

## Oakland FY Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Current biennial only (FY2025+FY2026) | One PDF, minimum scope, meets success criteria | |
| 2 biennials (FY2023–2026) | 2 PDFs, adds 2 more years | |
| Deeper history (FY2021+) | 3+ biennials, maximizes historical depth | ✓ |

**User's choice:** Deeper history (FY2021+)
**Notes:** "You decide" on exact depth — researcher determines what's available and how far back document formats are consistent.

---

### Oakland biennial extraction approach

| Option | Description | Selected |
|--------|-------------|----------|
| Single pass yields both FYs | Extractor reads PDF once, emits FY N + FY N+1 | ✓ |
| Two separate passes with --fy flag | Run extractor twice per PDF | |
| You decide | Researcher/planner picks | |

**User's choice:** Single pass yields both FYs
**Notes:** Matches Portland Vol 1 per-page FY detection pattern.

---

## San Jose Fund Scope

| Option | Description | Selected |
|--------|-------------|----------|
| General Fund only (~$1.7–1.9B) | Filter to GF; consistent with success criteria | ✓ |
| All-funds with enterprise labels | Load all funds, label Airport/Wastewater/Water | |
| All-funds without labels | Load everything, no enterprise distinction | |

**User's choice:** General Fund only
**Notes:** Matches roadmap success criteria. Enterprise funds inflate total misleadingly.

---

### San Jose PDF extraction approach

| Option | Description | Selected |
|--------|-------------|----------|
| Find GF summary page/section | Target specific page range | |
| Read the whole document | Parse all 400+ pages | |
| You decide | Researcher determines approach | ✓ |

**User's choice:** You decide
**Notes:** Researcher picks based on actual PDF structure.

---

### San Jose FY range

| Option | Description | Selected |
|--------|-------------|----------|
| Match Oakland's depth | Same historical depth as Oakland | |
| Most recent 2–3 years only | Limit scope for large PDFs | |
| You decide | Researcher recommends | ✓ |

**User's choice:** You decide

---

## Revenue Data Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Extract from operating budget PDF | Same PDF has revenue section (Fremont pattern) | |
| Require dedicated Revenue Budget PDF | Portland Vol 2 pattern | |
| Best effort — revenue if in PDF, skip if not | Try operating PDF; defer if not cleanly available | ✓ |

**User's choice:** Best effort
**Notes:** Don't block the phase on revenue. If revenue isn't cleanly extractable, note as deferred.

---

### Oakland "General Purpose Fund" naming

| Option | Description | Selected |
|--------|-------------|----------|
| Display as-is: 'General Purpose Fund' | Keep Oakland's actual terminology | ✓ |
| Normalize to 'General Fund' | Consistent UX across cities | |
| You decide | Based on UI fund name handling | |

**User's choice:** Display as-is
**Notes:** Oakland's fund is officially named "General Purpose Fund" (GPF) — use this throughout.

---

## API Cost Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, run enrichment (~$0.06 total) | Already budgeted in REQUIREMENTS.md | |
| Skip enrichment | Defer to later phase | |
| Run enrichment only if <$0.10 | Verify estimate; gate at $0.10 | ✓ |

**User's choice:** Run enrichment only if <$0.10
**Notes:** User expressed general preference to minimize API costs. $0.10 gate is tighter than the $5 project-wide threshold.

---

## Plan Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 3 plans: seeder → Oakland → SJ+enrich+verify | SJ carries verification | |
| 4 plans: seeder → Oakland → San Jose → enrich+verify | Clean separation | ✓ |
| 2 plans: both seed+extract+load → enrich+verify | Most compact | |

**User's choice:** 4 plans (seeder → Oakland → San Jose → enrich+verify)

---

## Claude's Discretion

- Oakland FY range: researcher determines depth based on available PDFs and format consistency
- San Jose FY range: researcher determines based on available PDFs
- San Jose PDF page extraction approach: researcher picks targeted vs. full-document based on actual PDF layout

## Deferred Ideas

- County linking for Oakland (Alameda County) and San Jose (Santa Clara County) — future phase
- `loadCAPopulation.js` reusable Census downloader — suggested in Phase 26; still deferred
- Oakland pre-FY2021 biennials — deferred if older formats are inconsistent
