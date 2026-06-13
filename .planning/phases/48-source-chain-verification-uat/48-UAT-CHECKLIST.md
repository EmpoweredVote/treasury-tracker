# 48-UAT — Production Walkthrough (Chris)

**~15 minutes.** All URLs below are production. Automated pre-flight ran 9/9 green
on 2026-06-12, and the 48-01 audit machine-verified all 61 source URLs — so this
walkthrough is about the *experience*: does it read right, link right, and feel
trustworthy. Reply with a per-item ✓ or a flag (anything odd counts).

Start here: https://treasurytracker.empowered.vote/?entity=united-states-us&year=2025&dataset=operating

## A. Landing (federal)

1. [ ] **Bands**: proportional Mandatory / Discretionary / Net Interest bar renders and the proportions look sane (Mandatory dominates)
2. [ ] **Deficit strip**: receipts vs outlays bars; shows **Deficit: $1,774.7B** and the "borrowed cents per dollar" line (expect ~25¢)
3. [ ] **This-year strip** (FY2026 FYTD): debt figure ~$39.2T; Net Interest ($722.7B) running ahead of Defense ($630.9B)
4. [ ] **Source chips**: each strip/figure has a chip ("OMB Historical Tables", "Treasury Fiscal Data", "· fetched <date> ↗") — click one or two; they land on the right official page

## B. Lenses

5. [ ] Default lens is **"What it's for"** (function): ~20 clean categories, Social Security / Medicare / Health / National Defense prominent; total displayed **$7,532.2B** with the visual-vs-official disclosure available (official net outlays $7,011.1B)
6. [ ] Toggle **"Who spends it"** (agency): HHS ($2,671.5B) / SSA ($1,710.4B) / Treasury / Defense top the list; toggle back works

## C. Explainers (Tier 1)

7. [ ] Drill **Health** → plain-language explainer ("Health care programs…") with its citation; nothing reads like marketing or opinion
8. [ ] Drill **National Defense** → explainer present; the **DoD failed-audits disclosure** appears with its GAO citation

## D. Program origins (Tier 2 — the new standard)

9. [ ] **Health** → "Where this program comes from": Affordable Care Act — H.R. 3590 (111th), P.L. 111-148, 2010, Sponsor Rep. Rangel, 40 cosponsors. **Click 2–3 links** (bill page, sponsor, public law) — each lands on the official record it claims
10. [ ] **Social Security** → foundational card: official 1935 title, Public Law 74-271, Enacted 1935, and the honest **sponsor-boundary note** (no fabricated sponsor) with its coverage-dates link
11. [ ] **Medicare** → foundational card + "Related act: Medicare prescription drug coverage (2003)" (the MMA, P.L. 108-173) as a linked extra row
12. [ ] Spot one more of your choice (Transportation → IIJA; Income Security → Welfare reform; agency lens → NASA / Space Act) — reads right, links right
13. [ ] A category with **no** program row (e.g., National Defense, Net Interest) shows **no** origins card — no empty shell

## E. Regression (cities / counties / states untouched)

14. [ ] **Plano** (?entity=plano-tx): icicle + line items as always, no federal artifacts
15. [ ] **California** (?entity=california-ca): state page normal
16. [ ] **Los Angeles County** (?entity=los-angeles-county-ca): county page normal

## F. Gut check

17. [ ] Dark mode on the federal pages (toggle top-left): legible, no broken contrast
18. [ ] Anything that would make a skeptical citizen trust this LESS? (wording, a number that looks off, a link that surprises) — flag it even if small

---
*48-01 note: the bot-walled URL list planned for this checklist came back EMPTY — all 61 source URLs machine-verified (real-browser content match included). Items 4 and 9 cover the rendered-chain clicks the audit can't reach.*
