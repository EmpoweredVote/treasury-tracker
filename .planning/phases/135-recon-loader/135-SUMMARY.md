# Phase 135 — Recon + Loader: SUMMARY

**Completed:** 2026-07-27 · **Requirements:** MAD-01 ✅ MAD-02 ✅ MAD-03 ✅ · **DB writes:** none (by design)

## MAD-01 — Reconciliation and basis verdict

Full working: [`135-RECON.md`](135-RECON.md).

Madison CY2024, CMREB vs the City's own audited ACFR, same period and same fund scope, both parsed from source:

| | CMREB | ACFR | delta |
|---|---:|---:|---:|
| Total revenue | 649,501,230 | 648,775,237 | +725,993 (**+0.11%**) |
| Total expenditure | 758,792,098 | 769,250,139 | −10,458,041 (**−1.36%**) |
| Taxes | 353,557,359 | 353,557,360 | **−1** |

The ACFR's own lines sum to its printed totals at $0 on both sides, so the parse was proven faithful before any delta was interpreted.

**Verdict: option (a) — load CMREB, labelled unaudited.** Fidelity is demonstrated rather than assumed; the categories are statewide-uniform (the only reason `WI-CITIES-01` is possible); Dane County comes in the same pass; and it carries an exact tie gate the ACFR path would not.

Two findings that constrain later phases:

- **CMREB function lines are not comparable to ACFR function lines.** CMREB distributes capital outlay across every activity line while the ACFR reports it as one $273.7M line — the ACFR's five current functions total $400.4M against CMREB's operations+capital $665.5M. Only totals may be reconciled against the ACFR. This must not be presented otherwise in the UI.
- **The two largest line deltas cancel** (Intergovernmental +5,187,411 vs Intergovernmental charges for services −5,029,625, net +157,786) — a classification shuffle, not missing money.

## MAD-02 — Loader and tie gate

`scripts/loadWICMREB.js`. Clones `loadOhioAOS.js` including its D-04b exclusion of Other Financing Sources/Uses.

- **Columns resolved by header name, never index**, with an up-front assertion that all 54 expected headers are present. A DOR reorder or rename fails loudly rather than loading a shifted column. Source typos (`Maintainence`, `Road- Related`, `Propriety`) reproduced exactly.
- **Nine-identity gate** re-derives every printed subtotal from its components; any mismatch refuses the row. A **second** check then proves the leaves actually loaded sum to the total actually emitted — the identities prove something about the source, this proves it about what we write.
- **`SOURCE_ROUNDING` ships empty** — a finding, not an oversight (86,472 checks pass). Present so a future drifting year is handled by exact delta, matching `lib/acfrGF.py` and `extractGresham.py`; deliberately not a tolerance.
- Traps encoded so they cannot be rediscovered the hard way: the narrow `Total Miscellaneous Revenues` grouping (±$56,381,522 if wrong) and non-empty-`Municipality` row filtering (inflated row counts).

## MAD-03 — Genericity and $0 dry-runs

| check | result |
|---|---|
| Madison + Dane County × CY2020–CY2024 | **10/10 entity-years tie** |
| `--all` sweep, CY2024 workbook | city **190/190** · village **417/417** · town **1242/1242** · county **72/72** |
| Madison CY2024 totals | revenue $649,501,230 / expenditure $758,792,098 — matches MAD-01 exactly |
| Unit tests | **14/14 pass** (`loadWICMREB.test.mjs`) |

Tests are weighted toward proving the gate **fails** when it should: corrupted component, corrupted printed subtotal, the Gresham leading-digit-truncation class, a dropped leaf, and an off-by-one registry entry that must still be rejected.

Two errors were caught and fixed during the phase, **both mine, neither in the loader**: a test fixture that docked the same amount off `Total Taxes` and `Subtotal-General Revenues` (which keeps that identity intact and breaks the next one up the chain), and a revenue leaf count of 15 where it is 16 — also corrected in the scoping brief.

## Handoff to Phase 136

Ready. The loader parses and validates but does not write; MAD-04/MAD-05 add `treasury_ensure_municipality` + `treasury_sync_city_budget` behind the never-overwrite guard.

- Watch the name collision with existing `Madison, MN` / `Madison County, OH` / `Madison County, VA` rows.
- Dane County must be written with `entity_type='county'` (Utah phantom-city-row lesson).
- MAD-06 labelling is a hard requirement, and MAD-01's verdict is explicitly conditional on it.
- Expect 20 budget rows: 2 entities × 5 years × 2 datasets.

## Commits

- `dd12e7a` MAD-01 reconciliation + verdict
- `495e2dd` MAD-02/MAD-03 loader, tests, scoping-brief correction
