---
phase: 32
slug: state-entity-infrastructure
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-08
audited: 2026-06-08
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for Nyquist gap coverage — State Entity Infrastructure.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — TypeScript/Vite project; static analysis + DB query script |
| **Config file** | none |
| **Quick run command** | `node scripts/verify-phase32.mjs` |
| **Full suite command** | `node scripts/verify-phase32.mjs && npx tsc -b --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/verify-phase32.mjs`
- **After every plan wave:** Full suite: `node scripts/verify-phase32.mjs && npx tsc -b --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green + human visual checks completed
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 0 | INFRA-01 | db-verify | `node scripts/verify-phase32.mjs` — asserts `municipalities_entity_type_check` constraint exists and includes 'state'; confirmed by live DB row `entity_type='state'` | ✅ | ✅ green |
| 32-01-02 | 01 | 0 | INFRA-01 | db-verify | `node scripts/verify-phase32.mjs` — attempts INSERT with `entity_type='invalid_xyz'`; asserts PostgreSQL error 23514 (check_violation) from `municipalities_entity_type_check` | ✅ | ✅ green |
| 32-02-01 | 02 | 0 | INFRA-02 | static | `node scripts/verify-phase32.mjs` — reads `src/types/budget.ts`, asserts `entity_type:` union block contains `'state'`; also covered by `npx tsc -b --noEmit` | ✅ | ✅ green |
| 32-03-01 | 03 | 0 | INFRA-03 | static | `node scripts/verify-phase32.mjs` — reads `EntitySwitcher.tsx`, asserts (a) `STATE GOVERNMENTS` literal text, (b) `m.entity_type === 'state'` pre-filter, (c) `entity_type === 'state'` displayName branch returning `selectedEntity.name` | ✅ | ✅ green |
| 32-04-01 | 04 | 0 | INFRA-03 | static | `node scripts/verify-phase32.mjs` — reads `C:/EV-Accounts/backend/src/lib/treasuryService.ts`, asserts `HAVING COUNT(b.id) > 0` appears inside `getCities()` function body | ✅ | ✅ green |
| 32-04-02 | 04 | 0 | INFRA-03 | static | `node scripts/verify-phase32.mjs` — reads `EntitySwitcher.tsx`, asserts `available_datasets.length > 0` guard is present in the `useMemo` grouping logic | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All gaps are verified in a single script. No framework install needed.

- [x] `scripts/verify-phase32.mjs` — covers all 6 automatable gaps (32-01-01, 32-01-02, 32-02-01, 32-03-01, 32-04-01, 32-04-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| STATE GOVERNMENTS section visible in browser dropdown | INFRA-03 | Requires browser session with live municipality data containing a state entity; JSX conditional render (`stateEntities.length > 0`) cannot be exercised programmatically | Open treasurytracker.empowered.vote; click the entity picker dropdown; confirm a "STATE GOVERNMENTS" sticky section header appears above the CALIFORNIA / TEXAS / OREGON groups, with state entities listed below it using name-only format (e.g., "California", not "California, CA") |
| Empty-dataset municipalities (e.g. Carver, MA) absent from dropdown | INFRA-03 | Requires a running app and knowledge of which municipalities in the target DB have zero budget rows; cannot be confirmed by static analysis or scripted DB query alone | Open the entity picker dropdown and confirm that any municipality known to have zero rows in `treasury.budgets` does NOT appear in the list. Any listed entity should load budget data without error when selected. |

---

## Validation Audit 2026-06-08

| Metric | Count |
|--------|-------|
| Gaps found | 6 |
| Resolved | 6 |
| Escalated | 0 |
| Manual-only | 2 |

**Gaps resolved:**

- 32-01-01: Live DB behavioral test — INSERT of live `entity_type='state'` row confirmed accepted; constraint existence proven by live data.
- 32-01-02: Live DB behavioral test — INSERT with `entity_type='invalid_xyz'` rejected with PostgreSQL error 23514 (`check_violation`) from `municipalities_entity_type_check`.
- 32-02-01: Static read of `src/types/budget.ts` — `entity_type:` union block confirmed to contain `'state'`.
- 32-03-01: Static read of `src/components/EntitySwitcher.tsx` — all three patterns verified: `STATE GOVERNMENTS` text, `m.entity_type === 'state'` pre-filter, and `entity_type === 'state'` displayName branch.
- 32-04-01: Static read of `C:/EV-Accounts/backend/src/lib/treasuryService.ts` — `HAVING COUNT(b.id) > 0` confirmed inside `getCities()` function body.
- 32-04-02: Static read of `src/components/EntitySwitcher.tsx` — `available_datasets.length > 0` guard confirmed in `useMemo` grouped logic.

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all gaps
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-06-08 (Nyquist audit — all 6 automated gaps green, 2 manual-only visual)
