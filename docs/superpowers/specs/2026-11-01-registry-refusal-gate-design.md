# A row must be able to tell a reader where it came from

**Design — 2026-11-01. Status: awaiting approval.**

## Intent, in the words that set it

> *"Ideally, when someone from Virginia goes to look at their financial records,
> they will be right. If they are looking at them, unsure of why they are right,
> they will be able to click a chip that takes them directly to the source for
> where we got the information."*

Two promises. The figure is right, and when the reader can't tell *why* it's
right, they don't have to trust us — they click through to the publisher's own
file and check for themselves. The chip is not decoration. It is the receipt
that makes the first promise verifiable by someone who has no reason to believe
Treasury Tracker.

This document covers the part of that which is a **gate**: making it impossible
to ship a row that cannot keep either promise.

## Why now

A row can fail the reader three ways, and all three are live today:

| failure | rows | measured |
|---|---|---|
| the figure is wrong | ~1,818 | Ohio: totals contradicting their own trees, plus 40 city MOD rows |
| there is no chip to click | 24,947 (4.3%) | `source_url` null or empty, across 1,367 of 5,929 sources |
| the chip works but the label is blank | 1,302 | `unknown` on all four provenance axes |

⭐ **The "no chip" cohort is two publishers, not 1,367 unrelated sources** —
measured, and much more tractable than the source count suggests:

```
CA State Controller — publicpay.ca.gov            7,682
"<Town> — MA General Fund …"  (702 source strings) 15,071
everything else                                    2,194
```

91% is CA compensation plus the Massachusetts DLS family, which is one
publisher split across 702 per-town `data_source` strings. Two pieces of work,
not a long tail.

The third cohort is the one with no gate at all:

```
Virginia APA Comparative Report                608   FY2023-24
Transparent Utah                               360   FY2014-25
bloomington-open-data                           24
Wisconsin DOR County and Municipal Revenues     20
King County ACFR (two sources)                  14
cambridge-open-data                              8
Connecticut State CAFR — one source per year   ~20   1 row each
Empowered Vote Financial Records                 4
```

Nobody chose this. A loader writes rows, the axis columns default to `unknown`
because no registry entry matches the new `data_source`, and **no gate reads
the axis columns at load time**. Hawaii shipped exactly this way twice. LA only
avoided it because someone probed by hand. The Ohio city MOD cohort was wrong
in all ten years because it was the one cohort with no test.

This is the same failure shape three times: *the data was wrong and every check
was green.*

## Goals

1. A loader **cannot write** rows for a source family that no registry entry
   matches. The write is refused, nothing is inserted, and the operator is told
   what to do about it.
2. A loader **cannot write** a row with no `source_url`.
3. The refusal is **impossible to miss** — not a value in a payload that 32
   call sites currently ignore.
4. The refusal is **helpful**: it hands back a ready-made registry entry with
   everything the machine already knows filled in.
5. The existing 1,302 + 24,947 rows are **ratcheted, not ignored** — recorded as
   debt that can only shrink.

## Non-goals

- **Draining the existing backlog.** Classifying Virginia, Utah and the rest is
  real work with real evidence-gathering behind it. This gate stops the bleeding;
  it does not do that work.
- **Checking that a `source_url` resolves.** That needs the network, and it is a
  separate piece. This gate only requires that a link is *present*.
- **Draining the 24,947 linkless rows.** Same reasoning: ratcheted, not fixed here.

## Anti-goals — what would make this a failure even if it worked

- **A gate that teaches people to route around it.** If the error message is
  `violates check constraint budgets_registered_family`, the next volunteer's
  fix will be to disable the gate. The message is part of the deliverable.
- **Turning silent bad data into silent no-data.** If the gate refuses and the
  loader prints a success line with a smaller number, we have made things worse.
  This is not hypothetical — `bulkLoadStateController.js` did precisely that
  until `rpcResult.mjs` was written, and 32 call sites still have the shape.
- **Making `unknown` illegal.** 24,778 rows are honestly `unknown` on audit grade
  and that is *correct* — SCOPE-01 deliberately classified 33.2% as unknown
  rather than guess. The gate's question is "does a registry entry **match** this
  family", never "is the value `unknown`". A registry entry whose considered
  answer is `unknown` passes.

## Constraints discovered during design — read these before planning

### ⛔⛔ CORRECTED AFTER REVIEW — read this before trusting anything below

Two claims in this document were wrong when written. Both are left in place,
struck through by this note, because the reasoning that produced them is the
useful part.

**1. "The RPC is the only real chokepoint" is FALSE.** `treasury.budgets` has
**two** write functions, and the gate shipped on the smaller one:

```
treasury_sync_budget_tree   262 files   <- the MAJORITY path
treasury_sync_city_budget    65 files
```

The claim came from counting call sites of one function. The ungated path
carried this document's own motivating incidents — `processHIAcfr.js`
(Hawaii), `scrapeMaDLS.js` (15,071 of the 24,947 linkless rows) and
`lib/acfrGfLoad.mjs`. Both paths are gated as of #317; see
`reference_budgets_two_write_paths` for how they differ.

**2. "All four axes" was reversed by measurement.** Only 62 of 5,929 families
(1.0%) match all four. The gate requires three: `audit_grade`, `fund_scope`,
`basis`.

### ⚠⚠⚠ WHAT THE GATE DOES NOT DO, STATED PLAINLY

**It refuses none of the eight cohorts in the "Why now" table above.** Every
one of them — Virginia, Transparent Utah, bloomington, Wisconsin DOR, King
County, cambridge, the Connecticut per-year sources and EV's own records —
is already in `treasury.budgets` and is therefore **grandfathered**.

That is the intended reading of "stop the bleeding", not an oversight: only
1,966 of 5,929 families match all three axes, so refusing the rest would
block the re-runs that fix bad data. But it means the gate changes nothing
about today's 1,302 unlabelled and 24,947 linkless rows. **The ratchet
(`npm run verify:provenance`), not the gate, is what keeps that from
growing.** The gate's job begins with the next family somebody adds.

### ⚠⚠ There is no single write path in JavaScript

**34 call sites invoke `treasury_sync_city_budget` directly, across 61 files.**
There is no shared helper to put a guard in. A JS-side guard would mean 34 edits
and nothing to stop the 35th loader from skipping it.

**The RPC is the only real chokepoint.** Every loader must go through it to
write. A gate there holds for a loader written next year by someone who never
read this document. That is where it goes.

### ⚠⚠⚠ 32 of 34 call sites cannot currently hear a refusal

The RPC reports failure **inside a successful PostgREST call** — it returns
`jsonb_build_object('error', …)` and supabase-js hands back `error: null`.
`scripts/lib/rpcResult.mjs` exists to classify that, and documents the bug it
was written for: a truthiness check on `result.rows_inserted` conflated *refused*,
*wrote nothing legitimately*, and *success*, so a refused write printed a success
line with a quietly smaller number.

These RPC callers do **not** import the classifier:

```
deriveTotalGovernmental  loadCASalaries        loadCoKsAcfrs      loadCountyBudget
loadFloridaDFS           loadFlStatewide       loadGeorgiaRLGF    loadInCountyAcfrs
loadIndianaGateway       loadLaCityAcfr        loadLACountyOperating
loadLACountyRevenue      loadLACountySalaries  loadMichiganF65    loadMiStatewideF65
loadMNOSA                loadNYCAcfrs          loadNyOscCities    loadNyOscMunicipal
loadNyOscSchools         loadOhioAOS           loadPaDced         loadPaStatewide
loadS8Acfrs              loadScCityAcfrs       loadScRfa          loadSdAcfrs
loadUtahTransparency     loadVAComparativeReport  loadWICMREB
sweepCASalaries          sweepOCSalaries
```

⚠ **Virginia and Utah — the two largest unlabelled cohorts — are both on that
list.** Possibly not a coincidence.

**Therefore routing every call site through the shared classifier is a
prerequisite, not a follow-up.** A gate whose refusal 32 loaders cannot hear
converts silent bad data into silent no-data, which is the anti-goal above.

Note also the RPC's blanket `EXCEPTION WHEN OTHERS RETURN jsonb_build_object(
'error', SQLERRM)`. A trigger, CHECK constraint or `RAISE` inside the function
is caught by that handler and converted into the same payload, so **no
mechanism avoids this prerequisite**. It is not a choice about where to raise.

### The database cannot read the registries

The registries are JavaScript modules holding regexes. The gate runs in
Postgres. The patterns must be mirrored into a table, synced by a script —
the pattern `syncFrozenInvariantState.mjs` already establishes.

⚠ The mirror introduces a drift surface, and this repo has been bitten by
exactly that: `diffFrozenExclusionMirror.mjs` reports 81 ids forever because it
compares file-by-file while the mirror dedupes. Whatever diff tool ships with
this one must be designed against that lesson — compare sets, not files.

### Settled by measurement during the builder check

**Requiring `source_url` does not break the derivation.** The worry was that
`deriveTotalGovernmental.mjs` computes rows that have no published document to
link to, and it is one of the 32 callers. Measured:

```
derivation = derived     341,278 rows    0 without a link
derivation = published   244,353 rows   24,947 without a link
```

Every derived row already carries a link — to the filings it was computed from.
The linkless rows are **all** on the published side. No exemption is needed.

**All four registries must match, not any one.** A partial match would publish
a source bar that answers two of the reader's questions and silently drops the
others. The precedent is already set: the LA audited load registered all four
*before* loading, byte-identically, after a probe showed all four reading
`unknown`.

⚠ This is affordable only because **the gate tests for a match, never for a
non-`unknown` value.** `accounting_basis` is `unknown` on 99.94% of rows, and a
family whose considered, cited answer is `unknown` passes the gate. The cost of
a new family is four entries, one of which will usually say "unknown, and here
is why" — which is the question being asked out loud rather than defaulted
past. *(My call. Say so if you want it relaxed to three.)*

### ⚠⚠⚠ The gate must be callable as a PREFLIGHT, before the loader spends anything

A refusal at write time arrives **after** the loader has already done its
expensive work. Utah is the worst case and the reason this is in the document:
`loadUtahTransparency.js --rollup` bills a BigQuery scan *before* it writes.
With the gate armed and Utah unregistered, the sequence is **scan, pay, refuse,
write nothing** — and the operator, having nothing to show for it, re-runs.

The 2026-06-19 incident was 622 jobs and ~21.2 TiB in ten hours, ≈ $132, on an
unfunded nonprofit. The rollup fix brought one refresh down to ~$0.29, but the
shape of the hazard is unchanged: **money leaves before the gate speaks.**

So the gate ships in two forms over one implementation:

1. **`assertRegisteredFamily(dataSourceName)`** — a cheap, local, network-free
   check a loader calls **first**, before fetching, scanning or downloading.
   Same registry data, same message, no database round trip.
2. **The RPC refusal** — the backstop that cannot be skipped or forgotten,
   for the loader that does not call the preflight.

⚠ The preflight is a courtesy, never the enforcement. A builder must not be
tempted to drop the RPC half because every current loader calls the preflight;
the whole premise is the loader written next year by someone who never read
this. Both, or the gate is advisory.

This applies beyond Utah — any loader that downloads before writing (PDF
fetches, FAC pulls, the Ohio workbooks) wastes the same way, just in minutes
rather than dollars.

### ⚠ Arming the gate makes unregistered families un-reloadable

Virginia and Utah cannot be re-run, re-loaded or corrected until they are
classified. That is the intent, but it is a real operational edge: an urgent
fix to one of those sources would be blocked behind an evidence-gathering task.

Ohio is **not** affected — `oh-aos-summarized` is registered, so the pending
Ohio reload is unaffected by this gate.

### `audit_grade` and `accounting_basis` are not RPC arguments

The RPC signature carries `p_fund_scope` and `p_basis` but **not** `p_audit_grade`
or `p_accounting_basis` — those are stamped after the fact by
`stampAuditGrade.mjs` and `stampAccountingBasis.mjs`. So the gate cannot check
all four axes at write time. It checks that **a registry entry matches the
family**; the stamping scripts and `verifyAxisStamps.mjs` remain responsible
for the values landing.

### Not every row is a government filing

"Empowered Vote Financial Records" and "Beneficial State Bank" are EV's own
books. **An inapplicable question is not an unanswered one** (#198). These need
an explicit registered answer of `not_applicable`, not an exemption list — an
exemption list is a place for things to hide.

### What already exists, and how this differs

`verifyAxisStamps.mjs` asserts *every row a registry **claims** actually
**carries** the value it claims.* This gate is the **other direction**: every
row carries a claim from **some** registry. They are complements, and neither
subsumes the other. Say so in the code, or someone will delete one.

## The decisions already made

**The refusal happens at load time, not afterwards** — Chris's call, chosen over
a post-hoc red check, on the grounds that "the window is where things get
forgotten."

**The registry stays a separate step from the insert** — because an entry is a
*cited claim*, not a setting. A real entry is two lines of value and twenty
lines of evidence naming the document read, where it came from, and what was
cross-checked. A CLI flag has nowhere to put that, would let 608 Virginia rows
silently disagree with each other, leaves no diff for a reviewer, and cannot
express "FY2016-2025 only, so FY2026 cannot auto-grade itself off a document
nobody has opened."

**The refusal generates the mechanical part of the entry.** The loader knows the
exact `data_source` string and which fiscal years are in the load, so the error
prints a paste-ready entry with those filled in and exactly two blanks: the
value, and the evidence. The part that cannot be automated is the part that
requires a human to have read something. That is the point of it, and it is also
the friction budget — "paste this and fill in what you read", not "go learn the
registry format".

## Left to the builder

- Whether the mirror table stores compiled patterns or source strings, and how
  a regex written in JS is evaluated in Postgres. ⚠ JS and POSIX regex differ;
  a pattern that silently fails to match in Postgres re-creates the bug this
  gate exists to prevent, so **prove equivalence against every existing entry**
  before trusting it.
- The order of the two phases. The classifier rollout must land before the gate
  is armed, but they could ship as one PR or two.
- Whether the ratchet for the existing 1,302 + 24,947 lives in the same script
  as the gate or its own `verify:` entry point.
- How the gate behaves under `--dry-run`. It should refuse there too, or a dry
  run stops predicting the real run.

## Verification this must carry

- The frozen invariant is **62,587 / `60098de6`** and must be unchanged — this
  work adds no figures and moves none.
- A test proving the gate refuses an unregistered family, written and watched
  to fail first.
- A test proving a registered family whose answer is `unknown` **passes** — the
  anti-goal, pinned.
- A test proving a refusal is visible at a call site that previously swallowed
  it. This is the one that matters most; without it the prerequisite is
  unverified.
- `npm test` green, and the CI simulation with `cache/`, `_oh-recon/` and
  `docs/OhioAOS/` hidden, since this repo has shipped tests that read gitignored
  directories four times.
