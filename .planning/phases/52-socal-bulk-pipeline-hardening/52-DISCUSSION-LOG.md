# Phase 52: SoCal Bulk Pipeline Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 52-socal-bulk-pipeline-hardening
**Areas discussed:** Population source, Source-link target, County seed + link automation, Existing-city collision policy

---

## Population source

| Option | Description | Selected |
|--------|-------------|----------|
| SCO estimated_population | Per-year population from the ByTheNumbers feed (line 168). Free, in-data, honest per-year per-capita. | ✓ |
| Uniform 2024 Census vintage | Match existing cities' single-vintage approach; needs separate Census fetch, loses per-year accuracy. | |

**User's choice:** SCO estimated_population (Recommended)
**Notes:** Per-year population is an improvement over the v1.3 single-vintage limitation; zero extra work since it's already in the source rows.

---

## Source-link target

| Option | Description | Selected |
|--------|-------------|----------|
| Durable ByTheNumbers page | Human-facing dataset page; source_date = fetch date. Matches v2.1 durable-URL standard. | ✓ |
| Raw Socrata API endpoint | Exact resource URL queried; precise but version-specific/fragile. | |

**User's choice:** Durable ByTheNumbers page (Recommended)
**Notes:** Closes the always-sourced gap — current RPC carries only data_source_name; source_url + source_date must be plumbed through.

---

## County seed + link automation

| Option | Description | Selected |
|--------|-------------|----------|
| Generic one-command helper | Reusable 'seed county + link cities' keyed off the SCO county field; every future county is one command. | ✓ |
| Manual per-county step in runbook | Leave linking as a documented manual step like seedLACountyLinks.js. | |

**User's choice:** Generic one-command helper (Recommended)
**Notes:** Delivers PIPE-01's one-command promise; OC seed+link execution still happens in Phase 54 using this helper.

---

## Existing-city collision policy

| Option | Description | Selected |
|--------|-------------|----------|
| Never overwrite budget data | Skip/refuse to alter budget data for cities already loaded from another source; log skips; still allow county-linking. | ✓ |
| Add as additional source | Load SCO data alongside existing custom data; both kept/selectable; adds disambiguation complexity. | |

**User's choice:** Never overwrite budget data (Recommended)
**Notes:** Protects Anaheim, Santa Ana, and LA custom data. Linking is allowed (linking ≠ overwriting), so these cities still attach to their county.

## Claude's Discretion

- RPC/schema mechanics for carrying source_url/source_date; idempotency/upsert details; dry-run assertion mechanics; choice of the specific non-OC county to dry-run against (must be unloaded and non-Orange).

## Deferred Ideas

- Orange County op+rev load → Phase 53.
- OC entity seed + link + enrichment execution → Phase 54.
- Backfilling always-sourced standard to other existing city data (LA custom, TX, OR, MA) → future milestone.
- Other SoCal counties (Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial) → future milestone (SOCAL-01..06).
