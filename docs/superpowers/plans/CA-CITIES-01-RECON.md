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

**Source recon (Task 4): COMPLETE 2026-08-16. Series is usable.**

Modesto publishes **31 years, FY1994-95 through FY2024-25**, through a CivicPlus ArchiveCenter
at `https://www.modestogov.com/ArchiveCenter/ViewFile/Item/<id>`. Item ids are pinned in
`scripts/fetchCaCities.mjs`. **A plain GET works — no `Sec-Fetch-*` WAF workaround needed**;
that was an Oregon-cities requirement and does not apply here.

Fiscal year is bound from each document's own period sentence ("Year Ended June 30, 2025"),
never from the archive title, which uses the span form ("FY 2024-25").

#### ⚠ The window is FY2002–FY2025, 23 years. Four exclusions, none of them a parser problem

| Years | Finding | Disposition |
|---|---|---|
| FY1995–1999 | **Image-only scans** — ~1 char/page (e.g. FY1995: 155 chars across 155 pages) | Excluded. No OCR recovery; that class of work returned zero rows in v2.22 |
| FY2000–2001 | **Pre-GASB-34 format** — "Combined Statement of Revenues, Expenditures and Changes in Fund Balances – All Governmental Fund Types", not the modern governmental-funds statement | **Deferred, not refused.** Needs a second extractor config. See the open question below |
| FY2009 | **Image-only scan** — 236 chars across 148 pages, cover page only, despite neighbours on both sides being clean | Excluded. Isolated, so the walk continues either side |
| — | FY2002–2008, FY2010–2025 all locate a clean two-page statement with a `General` column and whole-dollar amounts | **23 loadable years** |

#### ⚠ THE SPEC WAS WRONG: this DOES buy recency and pre-2003 history

The spec states "ACFR actuals top out at FY2024, the same year SCO already reaches" and that
this is explicitly not a recency milestone. **That is false for Modesto.** Its ACFR series
reaches **FY2025**, a year beyond SCO's ceiling, and **FY2002**, a year below SCO's FY2003 floor.

Both fall outside the overlap and so have nothing to reconcile against — they are recorded
`NO-SCO-ROW` and load on that basis. Concretely, of the 23 loadable years:

- **21 overlap** SCO (FY2003–2008, FY2010–2024) → the reconciliation set
- **2 do not** (FY2002, FY2025) → new data, no second reporter to compare

Whether the other four cities also publish an FY2025 should be checked at their recon, and the
spec's claim amended once the cohort is known rather than from this one city.

#### ⚠ Decoy statement pages — three distinct kinds, all observed

Selecting the statement by title alone picks a wrong page in three different ways here:

1. **Table of contents** (every year) — lists the statement title.
2. **Statistical section**, "Changes in Fund Balances of Governmental Funds – Last Ten Fiscal
   Years" (every year) — a ten-year summary, not the statement.
3. **⚠ Management's Discussion & Analysis** — FY2008 p24 reprints the exact heading
   "Statement of Revenues, Expenditures, and Changes in Fund Balances / Governmental Funds"
   over a **summarized Major/Non-major table**. This is the dangerous one: it is not obviously
   a decoy, and its aggregated figures would load as plausible-looking wrong numbers. The real
   statement is p36–37.
4. **Combining statements for NONMAJOR funds** (FY2015 p114/p116) — right title, wrong scope.

Statement pages resolved by content, per year: FY2002 p28 · FY2003 p36 · FY2004 p32 · FY2005 p36
· FY2006 p34 · FY2007 p34 · FY2008 **p36** · FY2010 p34 · FY2011 p38 · FY2012 p38 · FY2013 p42 ·
FY2014 p42 · FY2015 p44 · FY2016 p46 · FY2017 p42 · FY2018 p42 · FY2019 p46 · FY2020 p50 ·
FY2021 p56 · FY2022 p60 · FY2023 p64 · FY2024 p81 · FY2025 p93. Each spans two pages.

#### Open question for Chris — FY2000 and FY2001

They are readable, they sit below SCO's floor so they would be pure new history, and they need a
**second extractor config** for the pre-GASB-34 layout. The spec says "max available depth", but
WA-CITIES-01's hard-won rule was that an era-split is exactly the work that ends a window. Two
years of new history against a second config is a judgement call, not a mechanical one — flagged
rather than decided.

- **Buckets:** none yet — reconciliation runs at Task 6, after the extractor exists.

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
