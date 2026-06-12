# 47-PROGRAMS — The Pilot Contract

**Created:** 2026-06-12 (47-01 execution). Every CONFIRMED row is backed by a live fetch this session; the fetched title is quoted verbatim. CONDITIONAL rows carry refined-query instructions for 47-02 — the same fetched-title gate applies; unconfirmable → skip.

## Confirmed — modern (Congress.gov `/v3/bill/{congress}/{type}/{number}`)

| # | Program (display) | IDs | Fetched title (verbatim) | PL | Sponsor (fetched) | Cosp | name_key |
|---|---|---|---|---|---|---|---|
| 1 | Affordable Care Act | 111/hr/3590 | Patient Protection and Affordable Care Act | 111-148 | Rep. Rangel, Charles B. [D-NY-15] | 40 | health |
| 2 | Welfare reform / TANF | 104/hr/3734 | Personal Responsibility and Work Opportunity Reconciliation Act of 1996 | 104-193 | Rep. Kasich, John R. [R-OH-12] | — | income security |
| 3 | Department of Homeland Security | 107/hr/5005 | Homeland Security Act of 2002 | 107-296 | Rep. Armey, Richard K. [R-TX-26] | 118 | department of homeland security |
| 4 | Special education (IDEA) | 108/hr/1350 | Individuals with Disabilities Education Improvement Act of 2004 | 108-446 | Rep. Castle, Michael N. [R-DE-At Large] | 19 | education, training, employment, and social services\|elementary, secondary, and vocational education |
| 5 | Department of Education | 96/s/210 | An act to establish a Department of Education, and for other purposes. | 96-88 | Sen. Ribicoff, Abraham A. [D-CT] | 47 | department of education |
| 6 | Infrastructure Investment and Jobs Act | 117/hr/3684 | Infrastructure Investment and Jobs Act | 117-58 | Rep. DeFazio, Peter A. [D-OR-4] | 5 | transportation |
| 7 | CHIPS and Science Act | 117/hr/4346 | CHIPS and Science Act | 117-167 | Rep. Ryan, Tim [D-OH-13] | — | general science, space, and technology |
| 8 | Federal disaster relief (Stafford framework) | 100/hr/2707 | Major Disaster Relief and Emergency Assistance Amendments of 1987 | 100-707 | Rep. Ridge, Thomas J. [R-PA-21] | 111 | community and regional development\|disaster relief and insurance |

Display rule: program display names ARE the fetched titles' subject matter; where a popular name (e.g. "Stafford Act") is not in the fetched record, display the official title only.

## Confirmed — foundational (GovInfo STATUTE; sponsor fields NULL + boundary note)

| # | Program | Record | Fetched title (verbatim, truncated by API display) | name_key |
|---|---|---|---|---|
| 9 | Social Security | STATUTE-49, dateIssued 1935-08-14 | "An Act To provide for the general welfare by establishing a system of [Federal old-age benefits]…" — 47-02 fetches the granule for the full official title + page citation (the full 1935 title also covers unemployment compensation; if the fetched granule title confirms, add row 9b → income security\|unemployment compensation) | social security |
| 10 | NASA / Space Act | STATUTE-72-Pg426-2, 1958-07-29 | "An Act to provide for research into problems of flight within and outside the earths [atmosphere]…" | national aeronautics and space administration |
| 11 | Food stamps (1964 act) | STATUTE-78-Pg703, 1964-08-31 | "An Act to strengthen the agricultural economy to help to achieve a fuller and more ef[fective use of food abundances]…" | income security\|food and nutrition assistance |

## Conditional — 47-02 must title-confirm with refined queries (else skip)

| Program | Refined probe | Target name_key |
|---|---|---|
| Medicare (Social Security Amendments of 1965) | STATUTE search with publishdate:range(1965-07-01,1965-08-15) + "hospital insurance"; expect "An Act to provide a hospital insurance program for the aged…" | medicare |
| Interstate highways (Federal-Aid Highway Act of 1956) | range(1956-06-01,1956-07-15) + "highway" | transportation\|ground transportation |
| Higher Education Act of 1965 (Pell lineage) | range(1965-10-01,1965-11-30) + "higher education" | department of education — NOTE: function-lens 'higher education' subfunction was excluded (net-negative); agency node only |
| Head Start lineage (Economic Opportunity Act of 1964) | range(1964-08-01,1964-09-01) + "economic opportunity" | education, training, employment, and social services\|social services |
| Medicare prescription drugs (MMA 2003, 108/hr/1) | Congress.gov probe — CONFLICT: 'medicare' name_key taken by the 1965 act (UNIQUE constraint = one program per node). Resolve: keep 1965 as the node's row; record MMA in its details jsonb as an additional linked fact ONLY if fetched | — |

## Skips (with rationale)

- **Post-9/11 GI Bill** — probed 110/hr/2642; fetched title is "Supplemental Appropriations Act, 2008"; the record alone cannot support the program claim. (Veterans node keeps its Tier 1 explainer; a future pass can use the law's title structure via text endpoints.)
- **CHIP (1997)** — created inside the Balanced Budget Act of 1997; same omnibus problem.
- **Other Defense Civil Programs / SNAP-2008 retitle** — farm-bill omnibus titles don't name the program.

## Tally

11 confirmed + up to 5 conditional → 12–16 rows (≥15 requires ≥4 conditionals confirming; if short, 47-02 may also probe: Voting Rights-adjacent? NO — stay within budget-visible categories: candidates = Clean Air Act (EPA/natural resources, 1970 — pre-1973 STATUTE), Federal-Aid Highway Act 1956, National School Lunch Act 1946. Same gate.)
