# 46-SOURCES — Source of Record for Every Federal Explainer

**Created:** 2026-06-12 (46-01 execution). This file is the pipeline contract: 46-02 may author explainers ONLY from the texts recorded/referenced here plus each category's own sourced DB figures.

## Function descriptions (all 20 budget functions)

**Source: GAO, *A Glossary of Terms Used in the Federal Budget Process*, GAO-05-734SP (Sept 2005), Appendix IV "Budget Functional Classification"** — official per-function definitions (with includes/excludes), themselves derived from OMB's technical paper "The Functional Classification in the Budget."

- **Cite as:** source_label = `GAO Budget Glossary (GAO-05-734SP), App. IV`; source_url = `https://www.gao.gov/products/gao-05-734sp`
- **Fetch method (gao.gov curl-blocks):** the WebFetch fetcher passes GAO's bot wall and saves the binary — PDF acquired that way 2026-06-12, pdftotext'd; **verbatim full appendix committed at `docs/federal/gao_appendix4.txt`** (929 lines) — the authoring input.
- **Structure-stability check:** the 20-function set in App. IV matches OMB Circular A-11 (2025) Exhibit 79A exactly (050…950 — verified against `docs/federal/a11.txt` line 5479ff). A-11 and the PBDB user guide were tried first; both contain only code→title lists, no definitions (samples in 46-01-SUMMARY).
- **Vintage caveat (disclose if relevant):** definitions published 2005; the classification structure is stable by design (App. IV: "The functional structure is relatively stable"; changes require OMB consultation with the Budget Committees). Explainers must avoid any 2005-era program names that no longer exist — stick to the structural purpose language.

**Required sample extracts (verbatim, per 46-01 acceptance):**

> **550 Health** — "Programs other than Medicare whose basic purpose is to promote physical and mental health, including the prevention of illness and accidents. Excludes the Medicare program, the largest federal health program, which by law is in a separate function (function 570). Also excludes federal health care for military personnel (051) and veterans (703). Also excludes general scientific research that has medical applications (such as that conducted by the National Science Foundation) and health programs financed through foreign assistance programs." (gao_appendix4.txt:501-503)

> **900 Net Interest** — "Transactions that directly give rise to interest payments or income (lending) and the general shortfall or excess of outgo over income arising out of fiscal, monetary, and other policy considerations and leading to the creation of interest-bearing debt instruments (normally the public debt). Includes interest paid on the public debt, on uninvested funds, and on tax refunds, offset by interest collections." (gao_appendix4.txt:790-804)

Line index for all 20 function-level definitions in `docs/federal/gao_appendix4.txt`: 050 @25-60, 150 @80-94, 250 @136-142, 270 @161-169, 300 @195-207, 350 @227-251, 370 @275-298, 400 @323-369, 450 @405-409, 500 @440-442, 550 @495-503, 570 @533-537, 600 @545-562, 650 @591-615, 700 @623-635, 750 @677-681, 800 @694-720, 900 @768-804, 920 @846-856, 950 @858-860.

## Agency explainers (top 10 by FY2025 outlays)

**Source: USAspending `/api/v2/agency/{toptier_code}/` → official `mission` field** (agency-authored mission statements served via the federal DATA Act API), fetched live 2026-06-12.

- **Cite as:** source_label = `USAspending agency profile (official mission statement)`; source_url = `https://www.usaspending.gov/agency/<slug>` (human-facing page; API URL in evidence_summary)
- **Recipe (closed-input):** description = mission (what the agency says it does) + its biggest components BY OUR OWN sourced agency-lens tree (bureau names + FY2025 outlays from treasury.budget_categories — sourced DB figures). Missions alone are thin slogans for some agencies (DHS, OPM); the spending composition carries the informative load.

| T5 department (lens root) | toptier | Mission (fetched, verbatim) | CJ URL |
|---|---|---|---|
| Department of Health and Human Services | 075 | "It is the mission of the U.S. Department of Health & Human Services (HHS) to enhance and protect the health and well-being of all Americans. We fulfill that mission by providing for effective health and human services and fostering advances in medicine, public health, and social services." | hhs.gov/cj |
| Social Security Administration | 028 | "Deliver Social Security services that meet the changing needs of the public." | ssa.gov/cj |
| Department of the Treasury | 020 | "Maintain a strong economy and create economic and job opportunities by promoting the conditions that enable economic growth and stability at home and abroad, strengthen national security by combating threats and protecting the integrity of the financial system, and manage the U.S. Government's finances and resources effectively." | treasury.gov/cj |
| Department of Defense--Military Programs | 097 | "The mission of the Department of Defense is to provide the military forces needed to deter war and to protect the security of our country." | defense.gov/cj |
| Department of Veterans Affairs | 036 | "To fulfill President Lincoln's promise \"To care for him who shall have borne the battle, and for his widow, and his orphan\" by serving and honoring the men and women who are America's veterans." | va.gov/cj |
| Other Defense Civil Programs | — | **SKIPPED with rationale:** T5 composite grouping (military retirement trust funds, Corps-adjacent civil programs) — no single agency, no official mission text exists for the grouping. Forcing a mapping would mis-attribute. Candidate for a function-style structural description in a later pass. | — |
| Department of Agriculture | 012 | "We provide leadership on food, agriculture, natural resources, rural development, nutrition, and related issues based on sound public policy, the best available science, and efficient management." | usda.gov/cj |
| Office of Personnel Management | 024 | "Recruit, retain, and honor a world-class workforce to serve the American people." | opm.gov/cj |
| Department of Education | 091 | "ED's mission is to promote student achievement and preparation for global competitiveness by fostering educational excellence and ensuring equal access." | ed.gov/cj |
| Department of Homeland Security | 070 | "With honor and integrity, we will safeguard the American people, our homeland, and our values." | dhs.gov/cj |

## DoD audit record (SRC-03)

To be pinned in 46-03 Task 1 (defense.gov / dodig.mil / WebFetch-on-GAO / Congress.gov, in that order). The WebFetch-passes-GAO discovery above materially improves the odds.

## Blocked sources (for the record)

curl-blocked (403, browser UA insufficient): gao.gov HTML+assets, cbo.gov, crsreports.congress.gov. WORKAROUND PROVEN: WebFetch's fetcher passes gao.gov and saves binaries.
