# CA-CITIES-01 — Reconciliation Record

**Spec:** `docs/superpowers/specs/2026-08-16-ca-cities-01-design.md`
**Plan:** `docs/superpowers/plans/2026-08-16-ca-cities-01.md`
**Machine-readable twin:** `scripts/data/ca-recon.json` — the harness reads that, not this file.

---

## What this document is for

Every one of the five cities already carries State Controller data for FY2003–2024. So **every
ACFR year this milestone loads lands on a year that already has a figure from a different
reporter.** This file records what happened when those two reporters were compared.

**Every overlapping city-year appears here, ties included.** A record that lists only the
problems cannot be audited for completeness, because a year that was never checked is
indistinguishable from a year that passed. That is the whole reason
`scripts/verify-ca-recon.mjs` exists.

### Bucket legend

| Bucket | Meaning | Loads? |
|---|---|---|
| **TIE** | Delta within the calibrated threshold | Yes — ACFR supersedes SCO |
| **EXPLAINED** | Delta exceeds threshold but matches a registered structural reason | Yes — reason recorded on the row |
| **UNEXPLAINED** | Anything else | **No.** SCO row left untouched, year written up below |
| *+DEPTH* | Orthogonal flag: the ACFR is materially coarser than the SCO row it would replace | Held pending an explicit call |

**UNEXPLAINED is not a failure.** It is the milestone's most interesting output — either a defect
in our extraction or a real discrepancy between what a city told the State and what its auditor
signed. It must never be resolved by widening the threshold.

---

## Calibration status

**UNCALIBRATED.** `scripts/data/caCalibration.mjs` ships with sentinel thresholds
(`tieAbs: 0`, `tiePct: 0`, empty `structural`), so every divergent year lands UNEXPLAINED and
nothing can load. Task 6 replaces these with values measured from Modesto.

Worth recording because it shaped the plan: **LA City provides no free calibration sample.**
Checked during scoping on the theory that it carries both an ACFR revenue series and an SCO
revenue series — it does, but they **partition cleanly by year** (FY2003–20 SCO, FY2021–24
Socrata, FY2025 ACFR) with **zero overlapping city-years anywhere in `treasury.budgets`**. The
SCO-vs-ACFR delta has therefore never been measured anywhere in this project.

---

## Guard evidence — the completeness harness was watched failing

Recorded per the WA-CITIES-01 precedent for new guards: a guard nobody watched fail is a guard
nobody has tested. Run 2026-08-16 against fixtures in `tests/fixtures/`.

**Control — correct data must pass, or a failure proves nothing:**

```
$ node scripts/verify-ca-recon.mjs --fixture tests/fixtures/ca-recon-clean
overlaps: 2  recon: 2  loaded: 1
buckets: TIE 1 · EXPLAINED 0 · UNEXPLAINED 1 · depth-flagged 0

✓ recon complete: nothing missing, nothing loaded around the gate
exit=0
```

**Mutation 1 — a recon entry deleted, simulating a city-year never examined:**

```
$ node scripts/verify-ca-recon.mjs --fixture tests/fixtures/ca-recon-mutation
overlaps: 2  recon: 1  loaded: 1

✗ 1 overlapping city-year(s) NEVER RECONCILED:
    Modesto FY2024 revenue

RECON INCOMPLETE
exit=1
```

**Mutation 2 — an UNEXPLAINED year loaded anyway, simulating a bypassed gate:**

```
$ node scripts/verify-ca-recon.mjs --fixture tests/fixtures/ca-recon-bypass
overlaps: 2  recon: 2  loaded: 2

✗ 1 loaded row(s) DID NOT CLEAR THE GATE:
    Modesto FY2024 revenue

RECON INCOMPLETE
exit=1
```

Both failure modes are caught and both name the exact city-year.

---

## Per-city records

### Modesto — *calibration city*

Chosen to calibrate because it has the richest existing SCO tree in the cohort
(**FY2024: 32 categories / 83 line items operating, 39 / 83 revenue**), which is the strongest
available test of whether superseding costs depth.

- **Source recon (Task 4):** not started.
- **Window:** not set.
- **Buckets:** none.

### Stockton

⚠ **Chapter 9 bankruptcy 2012, exit 2015 — entirely inside the FY2003–2024 window.** Expect the
hardest reconciliation in the cohort. A cluster of UNEXPLAINED years around the bankruptcy is a
plausible genuine finding, but **rule the parser out first, on rendered page images** — the Kent
lesson from WA-CITIES-01 is that "the reader is broken, the data is fine" was false, because the
extractor shared the reader's defect.

- **Source recon (Task 9):** not started.

### Irvine

- **Source recon (Task 10):** not started.

### Santa Clarita

Only city of the five carrying a `geo_id` (`0669088`).

- **Source recon (Task 11):** not started.

### Chula Vista

- **Source recon (Task 12):** not started.

---

## Substitutions

None. Order if one becomes necessary: San Bernardino (194,120) → Huntington Beach (192,503) →
Glendale (191,284).
