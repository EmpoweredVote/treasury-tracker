# Phase 130: Verification + Live UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 130-verification-live-uat
**Areas discussed:** Re-derivation rigor, Source-chain audit, Live UAT format, Tether confirmation

---

## Re-derivation rigor (TUC-07)

### Coverage
| Option | Description | Selected |
|--------|-------------|----------|
| Full 20/20 | Re-derive all 10 FYs × (revenue + expenditure) from the 10 source PDFs | ✓ |
| Anchor + boundary sample | FY2024 + FY2015 + 1–2 random interior FYs only | |

### Method
| Option | Description | Selected |
|--------|-------------|----------|
| Fresh independent script | Throwaway re-derivation script, GF-sum logic from scratch (no extractTucson.py import), compares to live DB pulled independently | ✓ |
| Manual pdftotext + hand-sum | pdftotext -table per PDF, hand-verify each total | |
| Bookend-tie only | Confirm printed Total revenues/expenditures line == DB total_budget | |

### Depth
| Option | Description | Selected |
|--------|-------------|----------|
| Full tree, all FYs | Every displayed leaf (10 rev sources; 2-level exp functions) for all 10 FYs vs live DB line items | ✓ |
| Totals + anchor tree | Two roll-up totals all FYs + full leaf tree for FY2024 only | |
| Totals only | Just GF Total revenues + Total expenditures per FY | |

**User's choice:** Full 20/20 · fresh independent script · full tree all FYs.
**Notes:** Corpus is only 10 PDFs so full coverage is cheap; the independent script must NOT reuse `extractTucson.py` to satisfy "loader-independent, directly from source ACFR."

---

## Source-chain audit (TUC-07)

### Pass bar
| Option | Description | Selected |
|--------|-------------|----------|
| Full audit | Non-null source_url/date + source_url resolves to correct per-FY PDF + 0 residue + no stale labels + Pima/Tucson population provenance | ✓ |
| Non-null + residue only | Non-null source fields + 0 residue (129's existing checks) | |

### Known WARNING items (CR-01 residue-on-failure, WR-01 dead pre-load-delete)
| Option | Description | Selected |
|--------|-------------|----------|
| Document as accepted debt | Keep 130 verify-only; record as latent gaps + future follow-up | |
| Fix inline (small hardening) | Wrap ephemeral data_sources cleanup in finally/catch; remove dead pre-load delete. No re-load. | ✓ |

**User's choice:** Full audit · fix both WARNING items inline.
**Notes:** Fixes are data-neutral (failure-path / dead code); smoke-check idempotency + re-run audit after. Matches the project's "fix it right" culture.

---

## Live UAT format (TUC-08)

### Format + environment
| Option | Description | Selected |
|--------|-------------|----------|
| Checklist doc @ prod | Formal 130-UAT-CHECKLIST.md w/ status frontmatter, run vs treasurytracker.empowered.vote | ✓ |
| Checklist doc @ local | Same checklist vs local dev build | |
| Conversational walkthrough | Walk scenarios conversationally, capture inline, no standalone doc | |

### Extra scenarios (multi-select)
| Option | Description | Selected |
|--------|-------------|----------|
| AZ state regression | Existing Arizona state node still renders, undisturbed by Tucson load | ✓ |
| Year switcher / era labels | Drill multiple FYs; per-FY era-variant labels render honestly | ✓ |
| FY21/FY22 merged-label quirk | Cosmetic merged revenue labels display OK + enrichment explains | ✓ |
| FY2025-absence empty state | FY2025 simply absent, no broken/phantom render | ✓ |

**User's choice:** Formal checklist @ prod · all four extras.
**Notes:** Baseline scenarios (icicle, Money In/Out, per-capita, source chips, breadcrumb + Cities-in-County) already locked by TUC-08.

---

## Tether confirmation (TUC-09)

### Method
| Option | Description | Selected |
|--------|-------------|----------|
| Determine-then-confirm | Fetch live coverage.json + run matchEntityToCoverage for Tucson/Pima to compute expected icon state, then Chris confirms render matches | ✓ |
| Visual-only | Chris just looks at the banner, reports icon present/absent | |

### Gap documentation (if not covered)
| Option | Description | Selected |
|--------|-------------|----------|
| Doc + remediation pointer | Record in 130-VERIFICATION + point at exact Essentials fix (add Tucson city record to catalog; repo at C:/transparent motivations/essentials) | ✓ |
| Verification note only | Just note the gap as accepted, no cross-repo detail | |

**User's choice:** Determine-then-confirm · doc + remediation pointer.
**Notes:** Either coverage outcome requires no TT code change (v2.16 mechanism is generic); icon appears automatically once Essentials publishes coverage.

---

## Claude's Discretion

- Plan/task decomposition, re-derivation-script internals, log formatting, checklist scenario wording.
- Whether re-derivation + source-chain audit are one script or two.
- Inline execution (no gsd-verifier / research subagents — project token/machine-strain policy); direct DB queries + PDF reads.

## Deferred Ideas

- Essentials coverage add for Tucson (cross-repo, if D-10 gap confirmed).
- FY2025 Tucson ACFR (~late 2026), pre-FY2015 history, Pima County's own budget, OpenGov adopted-budget layer, TUC-SAL-01 (Tucson comp) — all out of this milestone.
