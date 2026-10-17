# Georgia statewide sweep — scoping

**Written 2026-10-17 at the end of the Atlanta session, while the detail was
still in hand. Start here, then read `GA-RLGF-RECON.md`.**

The route is proven: `scripts/loadGeorgiaRLGF.mjs` has read 65 filings across
7 governments with 0 oracle failures. **The marginal cost of the sweep is
verification, not code** — the Florida shape.

---

## 1. Scale

DCA's dropdown carries **720 governments** with a 7-digit CICOID:

| CICOID prefix | kind | count |
|---|---|---|
| `1` | county | **159** — exactly Georgia's county count, which validates the parse |
| `2` | municipality | **553** |
| `3` | consolidated | **8** |

**7 are already loaded** (Baldwin County, Milledgeville, Macon-Bibb,
Columbus-Muscogee, Atlanta, Fulton, DeKalb), so **713 remain**.

At FY2016–2025 that is **up to ~7,130 workbooks**, roughly **2.9 GB** of `.xls`
plus a similar volume of converted `.xlsx`. Real gaps will reduce it. Expect
~14,000 budget rows (2 per entity-year).

⚠ Data cost is **$0** — free, no key, no terms acceptance. The real costs are
machine time (fetch + convert) and session tokens.

---

## 2. Do not rebuild these

| already exists | where |
|---|---|
| the loader, all oracles, the anomaly machinery | `scripts/loadGeorgiaRLGF.mjs` |
| the parser and its 19 traps | `scripts/lib/gaRlgf.mjs` |
| BIFF8 → xlsx with per-cell `--check` | `scripts/tools/xlsToXlsx.py` |
| corroborated defect registers | `scripts/data/gaRlgfAnomalies.mjs` |
| reader-facing flags | `src/data/figureFlags.ts` |
| the entity roster | `scripts/data/georgiaRlgfEntities.mjs` |

---

## 3. ⚠⚠ The one real architectural question

**`resolveMonth()` will not scale as written.** It requires each entity to
declare `fiscalYearStartMonth` in the roster by hand and REFUSES when the
filing's own `FYEmonth` disagrees. That is right for 7 entities and impossible
for 720.

Georgia is **not** a uniform-month state (FAC's GA slice: 225 July / 212
January / 60 October / 41 other), and the Atlanta wave proved the split runs
*inside one metro* — Atlanta starts in July, both of its own counties start in
January. So a per-state default is not available.

**Proposed inversion, needs sign-off:** make the filing's own `FYEmonth` the
PRIMARY source, with the FAC census as corroboration, and refuse the filing
when the two conflict. That keeps the fysm guarantee (never default, never
carry a month across a boundary) without a hand-written roster of 720.

⚠ `censusGuard()` returns `{ok:true}` when it cannot find an entity, so a
census miss must be recorded as "unverified", never as "confirmed" — the
Columbus-Muscogee blind spot, at 720× the scale.

---

## 4. Decisions needed before any code

1. **Scope.** All 713 at once, or **the 159 counties first**? The counties are
   a clean, complete, independently checkable set (Georgia has exactly 159),
   they are the larger governments, and they would prove the sweep end to end
   at a fifth of the volume. ⭐ Recommended.
2. **Years.** FY2016–2025 (the `LOAD1` generation) only — or also FY2009–2015?
   ⚠ The older edition has **no `LOAD1` at all**, a different key vocabulary,
   and carries **1,393 `#REF!` cells**. It is MORE error-ridden, not less.
   Recommend deferring it.
3. **Parent counties for 553 municipalities.** ⭐ The CICOID encodes it: the
   middle three digits are DCA's own county number, so `2060002` (Atlanta)
   carries `060` = Fulton (`1060060`). That join is derivable with no name
   matching — which matters, because name matching is what the wave-1
   collisions (`Bibb City`, `Baldwin City`, `Macon County`) punish.
   ⚠ A city straddling a county line still gets an APPROXIMATE parent; record
   it as such, per Atlanta.
4. **Populations.** Census Vintage 2024 (`sub-est2024_13.csv` SUMLEV=162 for
   places, `co-est2024-alldata.csv` SUMLEV=050 for counties). ⚠ Join by FIPS
   where possible, never by bare name.
5. **The 8 consolidated governments** are typed `city` with `county_id` NULL,
   per the SF / Philadelphia / Macon-Bibb / Columbus-Muscogee precedent. Two
   are already loaded; the other six need identifying from the `3` prefix.

---

## 5. Phasing, with a gate at each step

1. **Enumerate** — drive the `Default.aspx` postback per CICOID to get each
   government's true file list. ⚠⚠ **A STATUS CODE IS NOT EVIDENCE A FILING
   EXISTS**: DCA serves a 1,245-byte HTML 404 and a ranged request for it
   returns **206**. Probe the BYTES (`d0cf11e0` real, `3c21444f` the error
   page). Both routes agreed exactly on the wave-2 gaps.
2. **Fetch + convert** in batches, `xlsToXlsx.py --check` on every batch. A
   batch that does not round-trip every cell does not proceed.
3. **Dry-run** the loader over each batch. **Gate: 0 oracle failures.** The
   loader already refuses to write when a filing does not tie, and refuses an
   empty run outright.
4. **Triage the failures** — expect some. Every one is either a new
   `GA_FORM_TOTAL_DEFECTS` entry (corroborated first) or a parser gap. ⚠⚠ Run
   the **REAPPEARANCE TEST** before calling anything a defect: Fulton FY2017
   sat at 0.592 of its neighbours and was a court-ordered billing delay.
5. **Load**, then `verify:frozen` → `check:forks` → `register:rows --milestone
   ga-statewide` → `syncFrozenInvariantState.mjs`. ⚠ Register in the SAME
   commit as the write.

---

## 6. What the sweep will meet, guaranteed

All documented in `GA-RLGF-RECON.md` — read §2, §6, §8, §9, §10 before
starting:

* the **206-on-a-404** trap (§2)
* a **printed total that omits its own last line** (§6)
* **whole filings at ~1/11** of their own audited accounts (§8)
* **timing shifts that are NOT defects** (§9) — and the reappearance test
* the **×1000 keying slip** (§10). ⭐ It is STRUCTURAL: all three governments
  checked print their ACFRs in thousands while the form says "enter dollar
  amounts". **Expect it at scale.** ⚠ It has only ever appeared in
  balance-sheet Parts, never in Parts I–VI, so it may not touch loaded data —
  but that null was measured on 7 governments, not 720. **Re-measure.**

⚠⚠ **A partition count is a measurement with a date, not a constant.** Every
figure in this document is from 2026-10-17 and must be re-measured, not
carried forward.
