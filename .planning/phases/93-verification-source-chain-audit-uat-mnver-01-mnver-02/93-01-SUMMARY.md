---
phase: 93-verification-source-chain-audit-uat-mnver-01-mnver-02
plan: 01
status: complete
completed: 2026-06-27
requirements: [MNVER-01]
---

# 93-01 Summary — ACFR Reconciliation (MNVER-01 part A)

## What was done
Independently reconciled the stored MN figures for the locked sample (Minneapolis + Hennepin County) against each entity's **published ACFR** governmental-funds Statement of Revenues, Expenditures, and Changes in Fund Balances. Read-only; ACFR PDFs downloaded + the relevant statement read directly (PDFs use custom font encoding — extracted via page-image render + pdfplumber column extraction). Result in `93-01-RECON.md`.

## Result — PASS / EXPLAINED
- **Hennepin County FY2021:** PASS (near-exact). Revenue stored $1,851,255,583 vs ACFR $1,852,541,519 (−0.07%); expenditures stored $1,834,835,822 vs ACFR $1,833,705,402 (+0.06%).
- **Minneapolis FY2023:** EXPLAINED. Stored is +15% vs the City ACFR primary-government fund statement because the OSA "city" reporting entity consolidates the **Minneapolis Park & Recreation Board** ($212.75M, no counterpart in the City ACFR fund statement) + uses OSA functional taxonomy. Functions that map 1:1 match to the dollar (Public Safety $332,834,000 exact; Health $36,542,000 exact), confirming the loader parsed OSA correctly. Source is correctly attributed to OSA.

## Key finding (for UAT / product awareness)
The Minneapolis "City" total legitimately includes the Park & Recreation Board (and likely other boards) — broader than the City's primary-government ACFR, but accurate to its OSA source. Counties (Hennepin) have no such component-unit gap → near-penny match.

## Key files
- `.planning/phases/93-verification-source-chain-audit-uat-mnver-01-mnver-02/93-01-RECON.md` (created) — the reconciliation record, per-entity numbers + deltas + explanations + ACFR citations + verdict.
- Working artifacts (gitignored / scratch): `_mn-recon/` (downloaded ACFR PDFs + rendered statement pages).

## Self-Check: PASSED
- Both entities reconciled against published ACFRs with deltas attributed to known differences (Hennepin near-exact; Minneapolis reporting-entity scope).
- No DB writes (read-only plan).
- MNVER-01 part A satisfied; part B (audit + re-derivation + icicle + state-node fix) = 93-02; UAT = 93-03.
