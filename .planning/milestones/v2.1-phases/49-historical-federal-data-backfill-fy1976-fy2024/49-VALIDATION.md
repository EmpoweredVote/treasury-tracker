---
phase: 49
slug: historical-federal-data-backfill-fy1976-fy2024
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 49 — Validation Strategy

> Per-phase validation contract. This is a **data-loading** phase — validation is
> reconciliation assertions, the source-chain audit, and coverage SQL, not a JS/Py
> unit-test framework. Every check is $0 (free OMB sources + local DB queries).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (data reconciliation + audit harness + SQL) |
| **Config file** | none — loaders self-validate; `scripts/auditFederalSources.mjs` is the audit harness |
| **Quick run command** | `node scripts/<loader>.js --fy <N> --dry-run` (per-year reconciliation, no writes) |
| **Full suite command** | `node scripts/auditFederalSources.mjs` (source-chain PASS for all federal rows) |
| **Estimated runtime** | dry-run ~5–15s/year; audit ~30–60s |

---

## Sampling Rate

- **After every task commit:** run the affected loader `--dry-run` for the sample years (FY1976, TQ, FY1985, FY2000, FY2014, FY2024); confirm exit 0 + reconciliation/tier reported.
- **After the loaders wave:** dry-run each loader across the full span; no year may error (Tier-2 fallback is allowed, must be logged).
- **Before `/gsd:verify-work`:** `auditFederalSources.mjs` all-PASS + coverage SQL returns zero gaps.
- **Max feedback latency:** ~15s (single-year dry-run).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 49-01-01 | 01 | 1 | CTX-01 (TQ storage) | T-49-01 | Migration is additive + backward-compatible; existing rows unaffected | sql | `SELECT column_name FROM information_schema.columns WHERE table_schema='treasury' AND table_name='budgets' AND column_name='period_label'` | ✅ | ⬜ pending |
| 49-01-02 | 01 | 1 | CTX-01 | T-49-01 | Unique guarantee preserved (NULLS NOT DISTINCT) | sql | reconcile unique index def includes `period_label` | ✅ | ⬜ pending |
| 49-02-01 | 02 | 1 | HIST-01 | T-49-02 | Per-year anchor from Hist 1.1; halts only at Tier 2 with disclosure | dry-run | `node scripts/loadFederalFunctions.js --fy 2000 --dry-run` exits 0, reports delta | ✅ | ⬜ pending |
| 49-03-01 | 03 | 1 | HIST-02 | T-49-02 | Agency tree from PBD reconciles to same anchor as function | dry-run | `node scripts/loadFederalAgencies.js --fy 2000 --source omb --dry-run` exits 0 | ✅ | ⬜ pending |
| 49-04-01 | 04 | 1 | HIST-03 | T-49-02 | 7 Hist 2.1 buckets sum to receipts anchor within tolerance | dry-run | `node scripts/loadFederalReceipts.js --fy 2000 --dry-run` exits 0 | ✅ | ⬜ pending |
| 49-05-01 | 05 | 2 | HIST-01..04 | T-49-03 | Idempotent re-run; every row sourced | audit | `node scripts/auditFederalSources.mjs` all-PASS | ✅ | ⬜ pending |
| 49-05-02 | 05 | 2 | HIST-04 | — | Gap-free coverage | sql | coverage query returns 0 missing (year,lens) pairs FY1976–FY2024 + 3 TQ rows | ✅ | ⬜ pending |
| 49-05-03 | 05 | 2 | CTX-01 | — | Per-year disclosures recomputed, not copied | sql | each loaded year has its own `federal_context_metrics` reconciliation row | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — `auditFederalSources.mjs` is the
source-chain harness, reconciliation is built into each loader, coverage/disclosure are SQL.
No test framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TQ schema migration applied to shared `budgets` table + RPC | CTX-01 | First schema change to an app-facing shared table; must be reviewed before apply | Checkpoint in 49-01: present migration SQL + RPC diff; apply via `mcp__supabase-local__apply_migration` only after GO |
| 1970s–80s account depth actually reconciles (R-02) | HIST-01/02 | Depends on live OMB file contents unknown until fetched | Inspect sample-year dry-run tier distribution; confirm Tier-2 fallbacks are rare and each carries a recorded gap |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify (dry-run / audit / SQL) or a documented manual checkpoint
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
