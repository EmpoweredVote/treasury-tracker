# Knight Communities — Progress

Authoritative per-entity status for the campaign designed in
`.planning/KNIGHT-COMMUNITIES-SEEDING.md`. Updated at the end of every session,
in the same commit as that session's work.

**Roster:** Knight Foundation's official 26 communities + Nashville, TN = 27
primary entities, plus 16 parent counties = **43 entities**.

---

## Source-family audit-grade evidence

Per spec §3.5, a non-`unknown` grade requires evidence recorded here **and** a
`source_url` on the row. A family that does not verify gets no registry entry and
its rows stay `unknown`.

### Ohio Auditor of State Summarized Annual Financial Reports → `self_reported_unaudited`

**Verified 2026-08-28** by direct fetch of
`https://ohioauditor.gov/references/SummarizedAnnualFinancialReports`.

Verbatim, from the publisher's own download page:

> "Download **UNAUDITED** annual financial report information by filing year, or
> browse summarized data by entity type and accounting basis. Data is presented by
> entity type, filing year, and basis of accounting in accordance with Ohio
> Revised Code § 117.38"

Reinforced by: "To request a copy of an unaudited Hinkle System filing, email
HinkleSystem@ohioauditor.gov".

The publisher states the audit status in its own words, in capitals, on the page
the files are downloaded from. This is the strongest evidence of the three.

### CA State Controller — Cities Annual Report → `self_reported_unaudited`

**Verified 2026-08-28** from California Government Code § 53891(a), verbatim:

> "The officer of each local agency who has charge of the financial records shall
> furnish to the Controller a report of all the financial transactions of the
> local agency during the preceding fiscal year."

> "The report shall contain underlying data from audited financial statements
> prepared in accordance with generally accepted accounting principles, **if this
> data is available**."

⚠ **This is a genuinely mixed source and the grade is a judgment call, recorded
here so it can be challenged.** The statute directs agencies to draw on audited
statements, which puts SCO above a bare self-report — but two facts keep it out
of `compiled_from_audited`:

1. The audited-data requirement is **conditional** ("if this data is available"),
   so an unknown share of rows is not audit-derived and nothing in the dataset
   distinguishes them.
2. The report is **furnished by the agency's own finance officer**. SCO receives
   and compiles it; it does not audit it.

Per the vocabulary's own rule, a mixed source takes the **weaker** branch.

⚠ Do **not** reuse `scripts/data/basisRegistry.mjs` entry `ca-sco-city-exp` as
audit evidence. Its Modesto FY2024 reconciliation establishes that the figures are
closed-year *actuals*, which is a statement about basis, not about assurance.

### Minnesota OSA City/County Finances Report → `unknown` (NO REGISTRY ENTRY)

**Could not be verified 2026-08-28.** Three publisher pages checked:

- `https://www.osa.state.mn.us/reports-data-analysis/local-government/cities/`
- `https://www.osa.state.mn.us/reports-data-analysis/reports/local-government-finances-report/`
- `https://www.auditor.state.mn.us/reports-data-analysis/reports/local-government-finances-report/`

None states what the Finances Report is compiled **from**, nor its audit status.
The only related sentence is a general description of the office:

> "In addition to performing audits, the State Auditor's Office reviews the
> financial statements, audits, management letters, and financial reporting forms
> of all local governments under the Office's purview."

That describes what OSA reviews, not what populates this dataset.

**What is known but is NOT sufficient:** cities submit a Local Government
Financial Reporting Form through SAFES, and separately file a GAAP audit. Because
OSA receives both, "compiled from the self-reported form" is *likely* but not
stated. Guessing `self_reported_unaudited` here would be inference from plausibility
— exactly what spec §3.5 forbids.

⚠ `GAAPInd` in the raw data indicates **basis of accounting**, not audit status.
Do not read it as evidence of audit.

**Consequence:** Duluth, Saint Paul, Ramsey County and Saint Louis County stay
`unknown` — 4 of this session's 9 entities. **Resolving this is a live follow-up:**
the likely route is the methodology or notes section inside a `cired_*` report PDF,
or a direct question to OSA.

---

## Entity status

Legend — Status: `loaded` · `partial` · `pending`. Grade: as stamped on the rows.

| Entity | State | Type | Status | Source | Grade | Oracle | FY month | PR |
|---|---|---|---|---|---|---|---|---|
| Akron | OH | city | loaded | OH AOS | self_reported_unaudited | — | | |
| Summit County | OH | county | loaded | OH AOS | self_reported_unaudited | — | | |
| Duluth | MN | city | loaded | MN OSA | unknown (unverified) | — | | |
| Saint Paul | MN | city | loaded | MN OSA | unknown (unverified) | — | | |
| Ramsey County | MN | county | loaded | MN OSA | unknown (unverified) | — | | |
| Saint Louis County | MN | county | loaded | MN OSA | unknown (unverified) | — | | |
| Long Beach | CA | city | loaded | CA SCO | self_reported_unaudited | — | | |
| Los Angeles County | CA | county | loaded | CA SCO | self_reported_unaudited | — | | |
| Santa Clara County | CA | county | loaded | CA SCO | self_reported_unaudited | — | | |
| San Jose | CA | city | **partial** | CA SCO series missing | | | | |

The 33 remaining entities are `pending` and are listed in spec §2.

---

## Known issues found during this campaign

### ⚠ HIGH — the frozen-figure invariant is jammed, and has been for some time

**Found 2026-08-28, before this session made any database write.**
`node scripts/verify-budget-axes.mjs` fails its final check:

```
✗ FROZEN FIGURE DIGEST MOVED — a row that existed at v2.24 changed or vanished
    expected 4cce9d6a8dfe9ac235dfd488f1903243892c7ebc4ac41b17dbd9022bfb068b9a
    got      c6e08b16db81224f487a85509230769e9b14e46b44b128deaee7ee45cd2056a5
```

Its other checks pass. **This is bookkeeping drift, not known corruption:**

| | rows |
|---|---|
| Live rows | 87,880 |
| Excluded (`scope02` 12 + `postV224` 148 + `scope04` 7,650) | 7,810 |
| Non-excluded, i.e. what gets hashed | **80,070** |
| `frozen_row_count` the hash was built from | **79,916** |
| **Unaccounted** | **154** |

154 rows created since v2.24 are in no exclusion file, so they are inside the
hash. **It therefore cannot match, whether or not any original figure changed** —
the harness can no longer distinguish "new rows leaked in" from "a figure moved."
This is the exact failure its own code comment records for v2.27–v2.29, recurring.

⚠ **The 154 cannot be localized from the database.** `created_at` is populated on
**19 of 87,880 rows**, newest timestamp 2026-03-24 — the RPC write path does not
set it. And the baseline stores only a count and a hash, never the ID set. So
drift here is detectable but not attributable.

⚠ **Do NOT regenerate `figures_frozen`.** The file forbids it, and doing so would
destroy the only evidence of what the 154 are.

Nothing runs this harness automatically — `npm test` is green and does not include
it — so it could have been failing for weeks unnoticed. Needs its own session.

### Flaky guard test — `tests/listAllSources.test.mjs`

### Flaky guard test — `tests/listAllSources.test.mjs`

Observed 2026-08-28: "has no live capped-RPC call anywhere in scripts/" failed
once in a full `npm test` run, then passed in isolation (13/13) and on an
immediate re-run (1,387/1,387).

**Mechanism:** the describe block calls `readdirSync('scripts')` once, then each
`it` calls `readFileSync` per path. Anything that creates or removes a file in
`scripts/` between those two moments makes the read throw.

Not caused by the Knight work. Recorded rather than fixed, because a guard that
intermittently fails erodes the exact signal it exists to provide, and the fix
(tolerating a vanished file) could equally mask a real problem. **Worth a
deliberate decision.**
