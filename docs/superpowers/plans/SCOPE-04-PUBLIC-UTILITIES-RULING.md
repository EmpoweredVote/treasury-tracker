# SCOPE-04 ruling — the `Public Utilities` root is GOVERNMENTAL

**Written:** 2026-08-19 · **Status:** ADJUDICATED, evidenced, closed
**Resolves:** `SCOPE-04-HANDOFF.md` §3.4, the 442-row "one judgement call"
**Method:** per-SOURCE classification with mandatory evidence (SCOPE-01's rule)
**Also carries:** a base-rate check of the whole CA SCO source (§7) — 8 city-years
tie to an audited ACFR, 1 fails
**Companion:** `SCOPE-04-NEGATIVES-RULING.md` adjudicates §3.5's negative-enterprise
trap. ⚠ Read its §5 before using the ACFR tie as a gate — the test has **three**
outcomes, and one of them is "diverges legitimately".

> The handoff said: *"Adjudicate against a document before deciding, and record
> the ruling."* This is that record. Two city ACFRs settle it to the dollar.
> **Do not re-litigate this from the SCO feed alone** — the feed's structure
> points the wrong way, and §4 explains why.

---

## 1. THE RULING

**`Public Utilities` and `Public Utilities and Other Expenditures` are
GOVERNMENTAL.** Both of their children — the `Public Utilities` sub-bucket and
the `Other Expenditures` sub-bucket — are governmental.

They are **included** in derived Total Governmental. Nothing is excluded, and no
per-row judgement is required.

**The exception queue closes entirely.** The handoff budgeted this as SCOPE-04's
one open adjudication; it costs the milestone zero rows.

## 2. The population is narrower than the handoff recorded

Measured 2026-08-19 against the live database:

| handoff said | actually |
|---|---|
| 442 rows | **445 rows** |
| (unstated) | **all CA cities**, no counties |
| (unstated) | **all `operating`** — zero revenue rows |
| (unstated) | **one source**: `CA State Controller - Expenditures` |
| (unstated) | FY2017–2024, **124 entities** |

Because it is one source, this is a single per-source ruling, not 445 decisions.

It is also **two source layouts**, which the handoff's single count concealed:

| FY | root name | budgets | children |
|---|---|---|---|
| 2017 | `Public Utilities` | 36 | utility rollups only |
| 2018–24 | `Public Utilities and Other Expenditures` | 409 | splits into `Public Utilities` (214) + `Other Expenditures` |

Both layouts are governmental. The split matters only for reading the data, not
for the ruling.

## 3. THE EVIDENCE — two exact ACFR ties

For each city, sum TT's **governmental** roots (every root except `… Enterprise
Fund` and `Internal Service Fund`) and compare with the audited *Total
Expenditures, Governmental Funds*.

### Cerritos FY2017 — `acfr-2017.pdf`, statistical section, col. 2016-17

```
14,867,204  Public Safety
14,355,648  Public Utilities          <-- the disputed root
13,446,809  General Government
12,963,812  Culture and Leisure
 7,291,629  Transportation
 3,469,447  Health
 1,963,199  Community Development
 1,593,583  Debt Service and Capital Outlay
-----------
69,951,331  = ACFR Total expenditures, governmental funds   EXACT
```

### Lakewood FY2017 — `2017_lakewood_cafr_final.pdf` p.33

```
13,964,668  Public Safety
11,722,082  Culture and Leisure
 7,762,779  Public Utilities          <-- the disputed root
 7,552,050  General Government
 6,799,588  Transportation
 5,064,902  Health
 4,915,225  Community Development
    49,872  Debt Service and Capital Outlay
-----------
57,831,166  = ACFR Total expenditures, governmental funds   EXACT
```

**Remove `Public Utilities` and neither city ties.** Two independent audited
documents, exact to the dollar, from cities with different utility structures.

### Both cities also fully reconstruct

| city | derived TG | + enterprise | + ISF | = stored `total_budget` |
|---|---|---|---|---|
| Cerritos | 69,951,331 | 20,076,412 | −251,214 | **89,776,529** ✓ |
| Lakewood | 57,831,166 | 9,315,161 | 1,271,913 | **68,418,240** ✓ |

This is the SCOPE-04 computation itself, validated end-to-end against audited
figures. It satisfies the handoff's §5.2 requirement for a **second** city with
an independent document — MA-01's lesson that one entity is not a rule.

## 4. ⚠ Why the SCO feed points the WRONG way — do not re-derive from it

The raw feed makes `Public Utilities` look proprietary. Three traps:

1. **The rows carry utility names.** `CURR_EXP_WATER`, `CURR_EXP_ELECTRIC`,
   `CURR_EXP_OTHER_PUB_UTILITIES1/2` — these read as enterprise activity.
2. **They co-occur with enterprise roots.** In 399 of 445 budgets the city also
   reports ~3 named `… Enterprise Fund` roots, so the utility rollup looks
   redundant.
3. **The magnitudes track the enterprise funds closely** — Cerritos' electric
   rollup lands within 0.2% of its electric enterprise total net of depreciation
   and interest.

All three are misleading. **`CURR_EXP_*` is the governmental current-expenditure
schedule** — the same form family as `CURR_EXP_POLICE`, `CURR_EXP_FIRE`,
`CURR_EXP_PARK_REC`, `CURR_EXP_LIBRARIES`. Enterprise funds use a different
schedule entirely (`PERS_SERV`, `GEN_ADMIN_EXP`, `DEPR_AMORT_EXP`, `INT_EXP`,
`OTHR_OP_EXP`). The `form_table` field on each raw row is the discriminator, and
the loader discards it.

**Cities remap their own functions into SCO's standard function set; only the
total is preserved.** This is why the evidence has to be a *total*, never a
line-by-line name match:

* Cerritos' own ACFR "Water and power" governmental line is **$0** in FY2016-17
  (and nil since 2013-14) — yet Cerritos allocated $14,355,648 of real
  governmental spending to SCO's `Public Utilities` function.
* Lakewood's ACFR has **no utility function at all** in governmental activities
  ("general government, public safety, transportation, community development,
  health and sanitation, and culture and leisure") and states plainly that it
  "uses enterprise funds to account for its Water Utility operations" — yet its
  SCO filing carries $7,762,779 under `Public Utilities`.
* Within the same cities, some roots match the ACFR exactly (Lakewood `Health` =
  5,064,902 = "Health and sanitation") while others don't (`Transportation`).

Matching individual function names against an ACFR will produce a false negative
here. **Tie the total.**

## 5. ⚠ Brisbane FY2017 — a real defect, and it is NOT this ruling

Brisbane looked like the counter-example: its `Public Utilities` root (1,945,588)
exactly equals its `Water Enterprise Fund` root, and its `Health` root
(1,780,090) exactly equals its `Sewer Enterprise Fund` root.

It is not a counter-example — **Brisbane does not tie under any classification of
`Public Utilities`.** It is a separate data defect:

```
ACFR governmental funds expenditures     20,117,070
ACFR Utility fund (Water, Sewer, GVMID)   5,866,494   (5,442,044 opex + 424,450 interest)
ACFR Marina fund                          2,089,184   (1,939,409 opex + 149,775 interest)  <-- = TT "Other Enterprise Fund" EXACT
ACFR Internal Service Funds               1,622,356   (TT stores 1,622,654 -- off by 298)
                                         ----------
                                         29,695,104
TT stored total_budget                    35,043,823
                                         ----------
overstatement                              5,348,719
```

Neither 1,945,588 nor 1,780,090 appears **anywhere** in Brisbane's FY2017 ACFR.

### The residual is a THIRD duplicate — the Marina (resolved 2026-08-19)

Brisbane reports **three** enterprise funds twice. The third is the Marina, and
it hides inside the governmental `Culture and Leisure` root:

```
Culture and Leisure = 5,675,907
    CURR_EXP_PARK_REC          2,143,904
    CURR_EXP_MARINA_WHARFS     3,506,424   <-- the Marina, again
    CURR_EXP_LIBRARIES            25,579
```

Brisbane's ACFR states it "uses enterprise funds to account for its Water and
Sewer Utility Services and **for its Marina**", and TT's `Other Enterprise Fund`
(2,089,184) is already the Marina's audited figure (1,939,409 opex + 149,775
interest). The ACFR's `Parks and recreation` is 2,138,545, matching
`CURR_EXP_PARK_REC` alone — so the 3,506,424 is purely additional.

That closes the gap:

```
governmental overstatement                7,489,237
  less Water   CURR_EXP_WATER             1,945,588
  less Sewer   CURR_EXP_SEWERS            1,780,090
  less Marina  CURR_EXP_MARINA_WHARFS     3,506,424
                                         ----------
  unexplained remainder                     257,135   (1.3%, ordinary mapping noise)
```

⚠ **This is why the exact-equality screen is NOT a gate.** The Marina is the
LARGEST of Brisbane's three duplicates and the screen never fired on it, because
the two Marina figures **differ** (3,506,424 vs 2,089,184). The screen caught 2
of 3 duplicates in the one city known to be broken.

⚠ **And there is no structural screen that would catch it either.** A
proprietary-named function line co-occurring with its enterprise fund is
*normal* — Cerritos and Lakewood both carry `CURR_EXP_WATER` alongside a
`Water Enterprise Fund` and both tie to their ACFRs exactly. **Only the
governmental ACFR tie distinguishes Brisbane from them.** Cf. §7 and
`SCOPE-04-NEGATIVES-RULING.md` §5: the tie is the discriminator, and it must be
read with the three-outcome caveat.

Separately, TT's Water + Sewer enterprise roots (3,725,678) understate the
ACFR's Utility fund (5,866,494) by 2,140,816, because that fund also contains
GVMID (Guadalupe Valley Municipal Improvement District), which Brisbane's SCO
filing drops.

### The quarantine list

| city | FY | why |
|---|---|---|
| **Brisbane** | 2017 | proven: does not reconcile to ACFR, overstated 5,348,719 |
| **Trinidad** | 2019 | probable: `Public Utilities and Other Expenditures` = `Water Enterprise Fund` = 389,498 |

Quarantine these from the derivation rather than silently publishing a derived
figure for them.

### The exact-equality screen — useful, but do not trust it as a gate

A governmental root exactly equalling an enterprise root in the same budget is a
cheap smoke detector. Across the **entire** era-B CA SCO population it fires on
only 4 pairs / 3 budgets / 3 entities:

```
Brisbane 2017  Public Utilities                        = Water Enterprise Fund   1,945,588
Brisbane 2017  Health                                  = Sewer Enterprise Fund   1,780,090
Trinidad 2019  Public Utilities and Other Expenditures = Water Enterprise Fund     389,498
Isleton  2017  Licenses and Permits                    = Other Enterprise Fund      19,031   <-- revenue row, $19k, almost certainly coincidence
```

⚠ **It would not have caught Brisbane's full error** — $1.6M of the
overstatement carries no signature. It is a screen for review, never a
correctness gate. Only reconciliation against an external audited total catches
the rest, and TT has no such total for most cities.

## 6. ⚠ Correction to the handoff: §3.2's tie check is TAUTOLOGICAL for this source

The handoff calls §3.2 "the green light":

> `rows whose ROOT categories do not sum to the stored total (>0.5%): 0`

For the CA SCO source that result is guaranteed by construction.
`scripts/bulkLoadStateController.js:163,173` computes:

```js
let total = 0;
// ...
  total += catTotal;      // total_budget IS the sum of the roots
```

So the check proves the tree is **internally consistent**, not that it matches
any published total. It cannot detect an inflated total — Brisbane passes it.

What *is* true, and is a stronger result: each raw row lands in exactly one
`category`, so roots cannot overlap at row level; and the roots themselves now
tie to audited ACFR totals at two cities (§3). Treat §3 as the green light and
§3.2 as a consistency check only.

## 7. Base-rate check — the 10-city reconciliation sample

Brisbane raised a question bigger than itself: **how often does an SCO city-year
disagree with its own ACFR?** 533 cities ride on this source and it had never
been checked against an external total. So a sample was drawn.

Sample selection: `order by md5(b.id::text || 'scope04-sample') limit 10` over
era-B `all_funds` / `operating` / `CA State Controller - Expenditures` rows.
Deterministic and reproducible — re-run it and you get the same ten.

**Result: 6 assessed, 6 tie, 0 fail.**

| city | FY | TT governmental sum | ACFR total expenditures, govt funds | |
|---|---|---|---|---|
| Lemon Grove | 2020 (a) | 17,237,420 | 17,237,420 | tie |
| Santa Monica | 2023 | 507,553,174 | 507,553,174 | tie |
| Bellflower | 2018 | 48,036,116 | 48,036,115 | tie, ±$1 |
| Rolling Hills Estates | 2017 | 12,755,598 | — | NOT ASSESSED |
| Palm Desert | 2018 | 84,029,517 | — | NOT ASSESSED |
| Ukiah | 2021 | 55,815,756 | 55,815,756 | tie |
| Livermore | 2022 | 162,902,604 | — | NOT ASSESSED |
| Anaheim | 2018 | 544,967,997 | 544,968 (b) | tie |
| Lakeport | 2023 | 10,877,670 | 10,877,670 | tie |
| Trinidad | 2024 | 2,541,368 | — | NOT ASSESSED |

(a) Lemon Grove FY2019 is not published; FY2020 was substituted and TT's FY2020
row checked against it. Same test, different year.
(b) Anaheim's ACFR is **in thousands**. 544,968k vs 544,967,997 — exact at the
reported precision. Cf. the Seattle rule: the tie is unit-invariant, but you
must know which unit you are in.

**The four gaps are availability, not failure.** Palm Desert publishes only
FY2021+; Livermore, Rolling Hills Estates and Trinidad return 403 to automated
fetches even with full browser headers (the Oregon `Sec-Fetch-*` WAF pattern),
and archive.org was rate-limiting (429). Each blocked **before any number was
seen**, so their absence cannot bias the result toward success.

### ⚠ How much this proves — and how much it does not

Across all work: **8 independent city-years tie exactly, 1 fails (Brisbane)**,
spanning a 27× size range (Lakeport $20M to Anaheim $1.3B) and five fiscal
years. No size or era pattern in the failure.

But **six samples is not proof of rarity.** With zero failures in six, the rule
of three puts the 95% upper bound on the failure rate near 50%. Do not cite
"6/6" as if it settled the question.

The stronger evidence is **population-wide, not sample-based**: the exact-duplicate
screen (§5) fires on only 3 budgets in the entire era-B CA SCO population. That
is a census rather than a sample — but it detects only the one failure mode, and
§5 records that it would have missed $1.6M of Brisbane's own error.

Conclusion: Brisbane is an outlier, and SCOPE-04 should proceed with a
quarantine list rather than a defensive redesign. Further sampling is poor value
— most of this run's cost was fighting WAFs, not analysis.

## 8. What this changes for SCOPE-04

* The `Public Utilities` adjudication is **done**; the exception queue is empty.
* The remaining §3.4 open case is **only** the negative-enterprise rows.
* §5.2's "find a second city with an independent document" is **satisfied** by
  Cerritos and Lakewood. Modesto FY2024 still deserves its own re-check.
* Add **Brisbane FY2017** and **Trinidad FY2019** to a quarantine list.
* ⚠ **Trinidad is the one city verification has failed to reach twice** — FY2019
  is only *suspected*, and FY2024 landed in the §7 sample but its documents are
  unreachable. If a single extra document is worth chasing, chase that one.
* The `derived_TG <= all_funds_total` gate is still required — it is unrelated to
  this ruling and still catches the negative-enterprise trap.

## 9. Reproduction

Primary source rows (note `form_table`, which the loader discards):

```
https://bythenumbers.sco.ca.gov/resource/ju3w-4gxp.json?$limit=2000&$where=entity_name='Cerritos' AND fiscal_year='2017'
```

Documents used:

| city | document |
|---|---|
| Cerritos FY2017 | `https://www.cerritos.gov/media/htdbxbeh/acfr-2017.pdf` |
| Lakewood FY2017 | `https://www.lakewoodca.gov/files/assets/public/v/1/government/citydocs/acfr/acfr-thru-2020/2017_lakewood_cafr_final.pdf` |
| Brisbane FY2017 | `https://www.brisbaneca.gov/ArchiveCenter/ViewFile/Item/142` |

§7 sample documents:

| city | document |
|---|---|
| Santa Monica FY2023 | `https://www.santamonica.gov/media/Finance/Budgets%20&%20Reports/2023/2023%20Annual%20Comprehensive%20Financial%20Report.pdf` |
| Bellflower FY2018 | `https://cms5.revize.com/revize/bellflowerca/Document%20Center/Department/Finance/Financial%20Reports/2017-18%20City%20of%20Bellflower%20CAFR%20(For%20Distrbution).pdf` (the source's own typo, "Distrbution") |
| Ukiah FY2021 | `https://cityofukiah.com/wp-content/uploads/2023/01/Annual-ACFR-Report-City-June-30-2021.pdf` |
| Lakeport FY2023 | `https://www.cityoflakeport.com/Lakeport%20ACFR%20-%20Final.pdf` |
| Lemon Grove FY2020 | `https://www.lemongrove.ca.gov/media/edif1ovn/20192020-financial-stateme.pdf` |
| Anaheim FY2018 | `https://www.nrc.gov/docs/ML1903/ML19036A774.pdf` — the city's own archive is awkward to address; the NRC hosts a complete copy (Anaheim is a party to a nuclear plant agreement). Verify the June 30, 2018 header before trusting it. |

⚠ `pdftotext -layout` scrambles the column order in all three of these reports and
will hand you numbers attached to the wrong labels. **Use `pdftotext -raw`** for
the fund statements and statistical tables.
