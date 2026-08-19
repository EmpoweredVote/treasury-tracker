# SCOPE-04 ruling — negative enterprise amounts

**Written:** 2026-08-19 · **Status:** 5 of 7 material rows ADJUDICATED; 2 open
**Resolves:** `SCOPE-04-HANDOFF.md` §3.5, "THE TRAP"
**Companion:** `SCOPE-04-PUBLIC-UTILITIES-RULING.md` (§3 of that doc establishes
the ACFR tie method used throughout here)

> ⚠ **The headline: there is NO pattern rule.** Negatives split roughly evenly
> between source filing errors and audited-correct figures, and the split does
> not follow the line type. Every material row needs its own document. Two
> separate attempts to write a general rule died here — §4 records both so they
> are not attempted a third time.

---

## 1. THE RULING

* **Negative enterprise/ISF amounts are NOT categorically errors.** Of five
  material rows adjudicated against city ACFRs, **3 are source filing errors and
  2 are audited-correct**.
* **Adjudicate per row, against a document.** Do not rule this class by pattern,
  by line type, or by magnitude.
* **Derived Total Governmental is unaffected by any of it** — see §6.

## 2. The population is 16 lines, not 44 rows and not 924

The count moved twice while being chased. Both intermediate numbers are wrong
and are recorded here so nobody re-derives them:

| framing | count | why it is wrong |
|---|---|---|
| negative **root** amounts | 44 rows | misses errors hiding inside a positive root |
| negative **child** lines | 924 lines / 511 budgets / −$629M | massively over-counts — see below |
| **negative `Operating Expenses` children, `operating` dataset** | **16 lines / 14 entities / −$38.8M** | ✅ the real class |

⚠ **870 of the 924 are negative `Nonoperating Revenues` in the REVENUE dataset —
these are legitimate investment losses**, clustered in FY2022 (Pasadena, Palo
Alto, Stockton, Fresno, Ontario, LA County). A fund can lose money on
investments. **Never quarantine these.**

Breakdown of all 924:

| dataset | child | lines | entities | dollars | verdict |
|---|---|---|---|---|---|
| revenue | `Nonoperating Revenues` | 870 | 282 | −580,638,010 | legitimate (investment losses) |
| operating | **`Operating Expenses`** | **16** | **14** | **−38,825,004** | **the class to adjudicate** |
| operating | `Nonoperating Expenses` | 31 | 27 | −5,258,102 | unexamined, small |
| revenue | `Operating Revenues` | 5 | 5 | −4,342,399 | unexamined, small |
| operating | `Nonoperating Expense` | 2 | 2 | −9,860 | trivial |

Of the 16, only **2 hide inside a positive root** (Piedmont FY2024 −290,079;
Stanislaus County FY2022 −224,246), both immaterial. So a root-level scan catches
14 of 16 — better than feared, but not complete.

## 3. THE ADJUDICATIONS

Method: sum TT's non-enterprise roots against the audited *Total Expenditures,
Governmental Funds*; then compare the specific fund against the audited
*Total Operating Expenses* in the proprietary-funds statement.

| city | FY | bad line | verdict |
|---|---|---|---|
| Turlock | 2021 | `MATERIAL_SUPP` Water −30,589,216 | **ERROR** |
| Cerritos | 2017 | `MATERIAL_SUPP` ISF −890,525 | **ERROR** |
| Scotts Valley | 2021 | `PERS_SERV` Recreation −2,161,969 | **ERROR** |
| Pleasanton | 2022 | `PERS_SERV` ISF −16,499,516 | **LEGITIMATE** |
| Placentia | 2021 | `PERS_SERV` Sewer −2,128,097 | **LEGITIMATE** |

### 3.1 Turlock FY2021 — ERROR, and the whole city-year fails

ACFR proprietary funds: Water **Total Operating Expenses = 8,054,180**.
TT's water lines excluding the bad one sum to 7,685,897, so:

```
7,685,897 + 368,283 = 8,054,180      (exact)
```

**True Materials and Supplies = +368,283**, not −30,589,216 — wrong by 30,957,499.

⚠ Turlock's **governmental** side also misses: ACFR `Total Expenditures 59,089,572`
vs TT 58,103,078, off 986,494. Like Brisbane, the entire filing fails to
reconcile → **quarantine the city-year**, do not patch the one line.

### 3.2 Cerritos FY2017 — ERROR (ISF only)

ACFR, Equipment Replacement Internal Service Fund:

```
Operations                487,300
Depreciation              152,012
Total Operating Expenses  639,312     ← positive
```

TT stores −251,214 because of a spurious `MATERIAL_SUPP = −890,525`
(`639,312 − 890,525 = −251,213`, ±1 rounding).

⚠ **Cerritos' governmental total still ties EXACTLY** (69,951,331). The error is
confined to the ISF, so the `Public Utilities` ruling that rests on Cerritos is
untouched. Its all-funds total is understated by 890,525.

### 3.3 Scotts Valley FY2021 — ERROR (Recreation fund only)

ACFR proprietary funds: Recreation **451,235** | Wastewater 3,205,744 |
Internal Service **45,963**.

TT's ISF = **45,963** — exact. Same filing, same city, one fund right and one
wrong: **errors are per-fund, not per-city.** TT's Recreation
(`Other Enterprise Fund`) = −2,043,973; its positives sum to 117,996, so:

```
451,235 − 117,996 = 333,239          true Personnel Services
```

⚠ Governmental side off by 35,668 (0.25%): ACFR 14,518,864 vs TT 14,483,196.

### 3.4 Pleasanton FY2022 — LEGITIMATE

The ACFR's Internal Service Funds **Total** column, reproduced line for line by TT:

```
Personnel services & OPEB adjustment   (16,499,516)
Repairs and maintenance                    333,323
Materials, supplies and services         5,653,701
Depreciation expense                     2,149,078
Total Operating Expenses                (8,363,414)
```

The negative is an **OPEB remeasurement credit** and is audited. Pleasanton's
governmental total also ties exactly (141,089,117). **Publish this as-is** — the
enterprise slice should show it.

### 3.5 Placentia FY2021 — LEGITIMATE

ACFR, Sewer Maintenance fund:

```
Administration              (18,334)
Maintenance              (1,873,661)
Depreciation expense        527,316
Total operating expenses (1,364,679)   ← negative, audited
```

TT's depreciation line matches exactly (527,316). The Refuse fund's
`Administration` is negative too. **Publish as-is.**

## 4. ⚠ TWO GENERAL RULES THAT DIED HERE — do not retry them

**Attempt 1: "a negative operating expense is always a filing error."**
Killed by Pleasanton and Placentia, both audited negatives.

**Attempt 2: "a negative *Personnel Services* is facially impossible — you
cannot spend negative payroll."** Killed by the same two. OPEB and pension
remeasurement credits legitimately drive a fund's payroll expense below zero,
and auditors sign it.

What survives is only a **weak prior**, not a rule:

| line type | errors | legitimate |
|---|---|---|
| `MATERIAL_SUPP` | 2 | 0 |
| `PERS_SERV` | 1 | 2 |

A negative *Materials and Supplies* has no obvious accounting story; a negative
*Personnel Services* has a very common one. Use that to **prioritise** which
document to pull first. Never to decide the outcome.

## 5. ⚠ THE ACFR TIE TEST HAS THREE OUTCOMES, NOT TWO

This is the most reusable finding in this document. A row that fails to tie is
**not** automatically bad:

1. **Ties exactly** — 10 city-years so far.
2. **Source filing error** — Brisbane FY2017, Turlock FY2021, Cerritos FY2017
   (ISF), Scotts Valley FY2021 (Recreation).
3. **Definitional divergence — NOT an error.**

Category 3 was found at Placentia FY2021, whose governmental side missed by
$51M and looked catastrophic:

```
Issuance of debt                  52,950,000    <- pension obligation bonds
Contributions to pension trust   (47,526,199)   <- other financing USE, below the line
```

Placentia reported that pension-trust contribution as **debt service
expenditure** on the SCO form (`CURR_EXP_OTHER_DEBT_SERV = 46,755,693`), while
GAAP puts it below the expenditure line. The SCO figure is its own definition,
consistently applied — it is not wrong.

⚠ **A naive "must tie to ACFR" quarantine gate would wrongly discard category 3.**
The signature is a `Debt Service` child exceeding ~25% of `total_budget`; it is
bounded at **26 rows across FY2017–2024**, peaking at 6 in FY2021 (California's
big pension-obligation-bond year). Refunding years behave the same way — cf.
Madison WI, where CMREB expenditure includes refunded debt principal.

## 6. ✅ Derived Total Governmental is ALGEBRAICALLY IMMUNE to all of this

Because `total_budget = Σ roots` for this source (the tautology recorded in
`SCOPE-04-PUBLIC-UTILITIES-RULING.md` §6):

```
derived_TG = total_budget − (enterprise + ISF) ≡ Σ governmental roots
```

Every defect in this document lives **inside** enterprise/ISF roots, so none of
it can contaminate Total Governmental. And the governmental side is exactly what
the nine ACFR ties verify.

**SCOPE-04 therefore splits cleanly: the Total Governmental half is sound and
shippable; only the enterprise-slice half carries this data-quality problem, and
it is 16 lines wide.**

## 7. Gates

* **Keep** `derived_TG <= all_funds_total` (the handoff's gate). ⚠ But know that
  it catches only the **6** rows where enterprise+ISF nets negative — 6 of 44.
* **Add**: flag any negative `Operating Expenses` child under an enterprise/ISF
  root. Catches all 16, including the 2 a root-level scan misses.
* **Do NOT gate on** negative `Nonoperating Revenues` — 870 legitimate rows.
* **Do NOT gate on** "fails to tie to ACFR" without first excluding category 3
  (§5).

## 8. Disposition

**Quarantine (no derived figure published):**

| entity | FY | reason |
|---|---|---|
| Brisbane | 2017 | whole filing fails to reconcile (PU ruling §5) |
| Turlock | 2021 | whole filing fails to reconcile |
| Scotts Valley | 2021 | Recreation fund error; governmental off 35,668 |
| Cerritos | 2017 | ISF error only — governmental total is SOUND |
| Trinidad | 2019 | probable; never verified (documents unreachable twice) |

**Publish as-is (audited negatives):** Pleasanton FY2022, Placentia FY2021.

**Open — not adjudicated:**

* **Ridgecrest FY2022** — `GEN_ADMIN_EXP` Transit −1,489,679. Site 403s and its
  CivicPlus archive item IDs are not guessable.
* **Sierra County FY2019** — Solid Waste −1,266,291. A ~3,000-person county on
  the separate SCO **county** dataset.
* **The sub-1% tail** — Larkspur ×3, Jackson, Piedmont, Stanislaus County,
  Exeter (−$419), Siskiyou County (−$367). ⚠ Given §4, do **not** rule these
  errors by pattern. They are immaterial either way: flag, do not quarantine.
* The 31 `Nonoperating Expenses` and 5 `Operating Revenues` negatives (§2) were
  never examined.

## 9. Reproduction

Raw source rows carry `form_table`, which the loader discards and which is the
only way to see which line is negative:

```
https://bythenumbers.sco.ca.gov/resource/ju3w-4gxp.json?$limit=2000&$where=entity_name='Turlock' AND fiscal_year='2021'
```

| city | document |
|---|---|
| Turlock FY2021 | `https://ci.turlock.ca.us/_pdf/budgetdocument.asp?id=46` — ⚠ ids are not chronological; probe and check the cover year |
| Pleasanton FY2022 | `https://www.cityofpleasantonca.gov/assets/our-government/finance-department/financial-reports/acfr-6-30-2022.pdf` |
| Scotts Valley FY2021 | `https://www.scottsvalley.gov/DocumentCenter/View/3085/FY-2020-2021` |
| Placentia FY2021 | `https://www.placentia.org/ArchiveCenter/ViewFile/Item/4849` |
| Cerritos FY2017 | `https://www.cerritos.gov/media/htdbxbeh/acfr-2017.pdf` |

⚠ Use **`pdftotext -raw`**, never `-layout`, for fund statements — `-layout`
scrambles column order and attaches numbers to the wrong labels.

⚠ Read the **combining** statement for internal service funds, not just the
summary column. Pleasanton's individual-fund detail is what proves its negative
is an OPEB adjustment rather than a bad line.
