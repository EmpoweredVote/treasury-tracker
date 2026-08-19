# SCOPE-04 handoff — derived Total Governmental, and the enterprise slice

**Written:** 2026-08-19, at the close of v2.26 · **Status:** scoped and **feasibility-probed**, not specced, not planned
**Read first:** `SCOPE-03-CLOSEOUT.md`, then `SCOPE-02-CLOSEOUT.md` §"Premise 1"

> This exists so a fresh session can start SCOPE-04 without re-deriving what a
> day of work already established. **The probe results in §3 are the substance
> here** — they were measured against the live database on 2026-08-19 and they
> change the shape of the milestone. Do not re-run them to "check"; re-run them
> only if you intend to act on a discrepancy.

---

## 1. Where things stand

`main` @ `0c80491`, tagged **`v2.26`**. Working tree clean, everything pushed.

Shipped in the last session: SCOPE-03's series toggle (#31), the NUL-byte lint
and pre-commit hook (#32), the v2.26 sign-off (#33), and I/O test timeouts plus
**`npm test` in CI** (#34).

⚠ **Before #34, CI ran only `npm run build`** — no test had ever gated a PR.
Every guard in `tests/` was inert. That is fixed; assume tests now gate.

## 2. What SCOPE-04 is, and why it is one milestone rather than two

SCOPE-03's closeout lists two separate inheritances: *derived Total Governmental
for era B*, and *the enterprise slice made visible*.

**They are the same computation.** Subtracting the enterprise/ISF roots from an
all-funds total to get Total Governmental **is** identifying the enterprise
slice. Do them together or you do the hard part twice.

What it delivers:

* **Chris's original request.** He asked on 2026-08-18 for "a toggle between
  General Funds and All funds and the other funds". SCOPE-03 built the control
  but **zero** entities carry two known fund scopes, so it renders a single inert
  pill almost everywhere. This gives **533 cities** a real second scope and makes
  the toggle do what he asked for.
* **The thing he called the point of the whole arc:** *"the transfer between an
  enterprise fund and the general fund is where money gets quietly reclassified,
  and a tool that only ever shows one total cannot show that movement."*

## 3. ⚠ THE FEASIBILITY PROBE — measured 2026-08-19, live database

This is the part that is expensive to rediscover.

### 3.1 The era boundary is real, and sharper than SCOPE-02 recorded

Root-level categories only (`parent_id is null`), `fund_scope='all_funds'`,
`operating`+`revenue`:

| era | rows | with enterprise/ISF roots | avg enterprise share |
|---|---|---|---|
| **B — FY2017+** | 8,508 | **90.0%** | **28.3%** |
| A — FY2003–16 | 14,752 | **9.6%** | 7.4% |

⚠ **A first pass reported era A at 37.1%. That was WRONG — it summed nested
categories as well as roots.** Corrected to roots-only it is 9.6%. Era A is even
less derivable than SCOPE-02 believed. **Do not attempt era A.** Its proprietary
activity is smeared across function roots (Modesto FY2016: solid waste inside
`Health`, transit inside `Transportation`), and no subset of era-A roots equals
the enterprise funds.

### 3.2 The arithmetic is safe — this is the green light

```
rows whose ROOT categories do not sum to the stored total (>0.5%):  0   (both eras)
```

**Every one of the 23,260 all-funds rows has a complete, non-overlapping root
level.** Subtraction is arithmetically sound. This was the main open risk and it
is closed.

### 3.3 The enterprise vocabulary is CLOSED and explicit

Era-B root names are drawn from a fixed set. Every enterprise root is literally
named `… Enterprise Fund`, plus `Internal Service Fund`:

```
Internal Service Fund · Sewer · Water · Other · Solid Waste · Airport ·
Transit · Electric · Harbor and Port · Hospital · Gas   (all "… Enterprise Fund")
```

Everything else is unambiguously governmental (`General Government and Public
Safety`, `Debt Service and Capital Outlay`, `Public Protection`, …).

⚠ **Match loosely, never on exact strings.** The source carries typos:
`Hospital Enterprise Fund Fund` (duplicated word) and `Gas  Enterprise Fund`
(double space). `~* '(enterprise|internal service)'` catches all of them.

### 3.4 The exception queue — small, bounded, and known

Out of **8,508** era-B rows:

| count | case | what it means |
|---|---|---|
| **852** | no enterprise root at all | derived TG would equal All Funds. **Skip these** — do not write a duplicate row at a second scope; there is no second scope to create |
| **442** | a `Public Utilities` / `Public Utilities and Other Expenditures` root | ⚠ **The one judgement call.** In era A this root was the smeared-proprietary bucket SCOPE-02 warned about. In era B it survives at only 2–3%. Is it enterprise or governmental? **Adjudicate against a document before deciding**, and record the ruling |
| **≥10** | **negative** enterprise amounts | see below — this is the trap |
| 0 | enterprise ≥ 90% of total | no pathological rows |
| 0 | derived TG ≤ 0 | no pathological rows |

Observed enterprise share ranges **−5.6% to 88.3%**.

### 3.5 ⚠ THE TRAP: negative enterprise amounts

Real rows carry negative enterprise roots:

```
Turlock          FY2021 operating  Water Enterprise Fund      -20,395,012
Stanislaus Cnty  FY2022 revenue    Transit Enterprise Fund    -17,990,970
Pleasanton       FY2022 operating  Internal Service Fund       -8,363,414
Scotts Valley    FY2021 operating  Other Enterprise Fund       -2,043,973
```

**Subtracting a negative makes derived Total Governmental LARGER than All
Funds** — which is nonsense, since Total Governmental is a subset. It would sit
on the chart between two correct years looking entirely plausible. This is
exactly the failure shape SCOPE-02 warned about for era A.

**Gate it: assert `derived_TG <= all_funds_total` on every row, and refuse the
negative ones rather than silently producing a too-high figure.** Then adjudicate
them separately — they are probably net-of-internal-charges or a restatement, but
that needs a document, not a guess.

## 4. Constraints inherited from the arc — do not relitigate

* **This is the first database write since SCOPE-02.** `figures_frozen` must stay
  `3bc12db8bb7dd04c1602befd68d78020e39d333df75705f6f94d3c1a939d82a2`. Derived
  rows are NEW rows; no existing figure moves. SCOPE-02 widened the unique index
  to include `fund_scope` and `basis` **precisely so this can coexist** rather
  than overwrite.
* **A derived figure is not a published one.** Every other number in TT is
  something a government printed. These are TT's arithmetic over published
  components. **This needs its own honesty in the UI**, distinct from the four
  `fund_scope` values — a reader must be able to tell "we computed this" from
  "they published this". Decide the mechanism early; it affects the schema.
* **Classification is per SOURCE with evidence** (SCOPE-01's rule). A derivation
  is a different animal and needs its own provenance story.
* **The app's API is Express/TS in `C:\EV-Accounts`**, not the Go service. A new
  column is invisible until that repo's explicit SELECT lists are edited. The
  database is shared, so there is no deploy ordering: land the column, then
  surface it.

## 5. Suggested first moves

1. **Do not spec yet.** Adjudicate §3.4's two open cases first — the 442
   `Public Utilities` rows and the negative-enterprise rows — because both change
   the milestone's shape and its row counts.
2. **Re-verify the Modesto FY2024 tie** (`588,042,068 − 296,400,946 = 291,641,122`)
   against the ACFR, then find a **second** city with an independent document.
   ⚠ MA-01's lesson: a rule verified on one entity is not a rule. Natick's $2 tie
   looked definitive and Lexington broke it.
3. Only then brainstorm → spec → plan.

## 6. Repo gotchas that will otherwise cost an hour

* ⚠ **`docs/*` is gitignored.** Every file under `docs/superpowers/` is tracked
  only because it was `git add -f`'d. **A new doc is invisible unless force-added.**
* ⚠ **`npm run build` is the gate, never `npx tsc --noEmit`** — the latter does
  not build project references. `erasableSyntaxOnly` also bans TypeScript
  constructor parameter properties (TS1294), which `npm test` will not catch.
* ⚠ **No component tests exist and none can be written**: `vitest.config.ts` is
  `environment: 'node'` and its `include` never collects `.test.tsx`. Such a file
  **silently does not run**. Push testable logic into pure modules.
* ⚠ **Any test that reads the filesystem needs an explicit timeout.** Its runtime
  tracks disk contention, not the code. Prove one is in force with
  `npx vitest run --testTimeout=1` — a test that still passes is carrying its own.
* ⚠ **`npm run lint` never exits 0.** It is a broken gate; do not trust it.
* ⚠ **`python`/`python3`/`py` on PATH are Windows Store stubs.** Real Python is at
  `%LOCALAPPDATA%\Python\pythoncore-3.14-64`.
* The pre-commit NUL guard needs `git config core.hooksPath .githooks` once per
  clone (or any `npm install`).

## 7. Where the real detail lives

| | |
|---|---|
| SCOPE-03 outcome, and what it inherits | `SCOPE-03-CLOSEOUT.md` |
| Why era A is underivable, the ten rulings | `SCOPE-02-CLOSEOUT.md` |
| Fund-scope rules, evidence discipline | `SCOPE-01-CLOSEOUT.md`, `SCOPE-01-RECON.md` |
| Series model consumed by the toggle | `src/data/budgetSeries.ts`, `src/data/seriesSelection.ts` |
| Reader-facing copy, single reviewable home | `src/data/fundScopeVocabulary.ts` |
