/**
 * How many budgets in each family cite NOTHING AT ALL.
 *
 * ⚠⚠⚠ THIS IS THE DEGENERATE CASE OF THE DEAD-CITATION DEFECT. A budget with a
 * broken `source_url` asks the reader to believe a figure and hands them a link
 * that fails; a budget with no `source_url` asks them to believe it and hands
 * them nothing. 24,806 budgets are in the second state, which is 4.2% of the
 * fleet (585,666 budgets) — so `verify:source-urls` failing on their EXISTENCE
 * would be red from the first run, and a gate that is red by design is a gate
 * nobody reads.
 *
 * ⭐ SO IT RATCHETS, exactly like the totals baselines, and for the reason
 * 20261104180000 gives: "Its baselines live in code ON PURPOSE — paying one
 * down is reviewed in a PR diff ... Mirroring them into a table would create a
 * second authority that can drift from the first."
 *
 * The gate's only assertion is that **nothing grew**. Paying one down is a
 * NOTICE; lowering the number here is the PR that records it.
 *
 * ⭐⭐ AND IT HAS BEEN PAID DOWN FOUR TIMES. The first measurement was 24,960
 * across 75 families. #372 cited West Hollywood's 22 uncited budgets — 10 demand
 * registers and 12 budget-detail years — which removed THREE families
 * outright, because every member of each was cited at once.
 *
 * ⭐ 2026-11-11: 24,938 → 24,908, and SEVEN more families went to zero. Those
 * budgets had no citation because the only record of where their document came
 * from was a path on a contributor's laptop in `data_sources.base_url`; the
 * documents were found on their publishers and proven BYTE-IDENTICAL by sha256
 * to the file the loader parsed, so the citation is the strongest kind this
 * repo issues. Fresno General Fund Operating Budget (7), Plano Operating
 * Budget (9), Plano Revenue (4), Riverside General Fund Operating Budget (4),
 * Long Beach Operating + Revenue (2+2), Oakland General Purpose Fund Operating
 * Budget (2). See 20261111010000_laptop_paths_23_proven_documents.sql.
 *
 * ⭐ 2026-11-11, SAME DAY, SECOND PASS: 24,908 → 24,877, four more families to
 * zero — Anaheim General Fund Operating and Revenue, Santa Ana General Fund
 * Operating and Revenue — plus partial pay-downs in Fremont (8→2 each side),
 * Richardson (8→3) and San José (5→4 each side).
 *
 * ⭐⭐ AND THE LESSON IS CHEAPER THAN THE FIRST PASS'S. The pass above recorded
 * 28 documents as unreachable; re-asking the SAME six hosts the next day moved
 * 18 of them. Anaheim had never refused us — a bare curl had been refused, and
 * a browser-shaped request gets the PDF. Santa Ana had MOVED, to a domain that
 * answers and to a GCS bucket with no WAF at all. The other three really do
 * refuse everything, and the Internet Archive — offline the day before —
 * settled eleven of those. See
 * 20261111020000_laptop_paths_wayback_and_successor_hosts.sql.
 *
 * ⭐⭐ 2026-11-13: 24,877 → 24,806, and SEVEN families went to zero at once —
 * 71 budgets, every one of them a payment, payroll or compensation register.
 * #389 shipped `scripts/citeNonStatementSources.mjs`, which reads the address
 * out of `data_sources`, PROBES IT, and writes only the ones that answered;
 * it ran on 2026-11-12 and these are what it earned. Bloomington Annual
 * Compensation (24), LA City Payroll (10), Plano Check Register (10), Frisco
 * Check Register (9), LA City Checkbook (9), McKinney Check Register (5),
 * McKinney Payroll Register (4).
 *
 * ⚠⚠ AND A FAMILY REACHING ZERO IS THE ONE PAY-DOWN THAT HAS TO BE PROVED.
 * This file counts budgets that cite NOTHING, so a family drops out of the
 * census when its rows get cited — and equally when its rows are DELETED. The
 * two are indistinguishable from here, and lowering the baseline for the
 * second one would retire a debt by destroying what owed it. The check is the
 * family's ROW count, not its uncited count: all seven still hold exactly the
 * budgets the old baseline named (24, 10, 10, 9, 9, 5, 4), now with a
 * `source_url` each — 31 distinct URLs for 71 budgets, because a register's
 * landing page serves every year of it. Those five hosts were then asked:
 * 32 of 32 live, exit 0 each — checkregister.plano.gov, friscotexas.gov,
 * mckinneytexas.org, controllerdata.lacity.org, data.bloomington.in.gov.
 *
 * That is what the ratchet is for: the number moves in a PR, with the reason
 * attached.
 *
 * ── ⚠ WHAT A "FAMILY" IS ───────────────────────────────────────────────────
 *
 * `familyOf()` in scripts/lib/sourceUrlProbe.mjs, and both of its
 * normalisations are load-bearing: the per-town prefix is dropped (the MA DLS
 * families carry one `data_source` per town, 351 of them, three times over) and
 * the fiscal year is stripped wherever it sits, including the middle of the
 * federal names. That collapses the 1,271 distinct `data_source` strings now
 * carrying uncited budgets to these 54 families — small enough that every one
 * is named here rather than hidden in a tail bucket, so a new uncited year
 * moves a COUNT a reviewer can see.
 *
 * ⚠ A key here must already BE a family: `familyOf(key) === key`. A raw
 * `data_source` pasted in — "Plano Check Register FY2026" — can never match
 * anything the census produces, so it would sit here as debt that cannot be
 * paid while its real family came back as `appeared`. Pinned by test.
 *
 * ── ⚠⚠ THE FOUR THAT ARE 97.5% OF IT ───────────────────────────────────────
 *
 * MA General Fund Expenditures (8,408), CA publicpay (7,682), MA General Fund
 * Revenues (6,663) and MA DLS Revenue by Source (1,755). Each is ONE publisher
 * with one landing page, so each is one `UPDATE` away from being cited —
 * ⚠ a targeted UPDATE on `source_url` only, NEVER a re-load: re-running a
 * loader re-mints `budgets.id` and stales the id-keyed frozen registry.
 * #372 is the worked example. See reference_source_url_never_verified.
 *
 * MEASURED 2026-11-13 against the live fleet, after #389.
 */
export const UNCITED_BASELINE = {
  families: {
    "MA General Fund Expenditures": 8408,
    "Government Compensation in California (publicpay.ca.gov)": 7682,
    "MA General Fund Revenues": 6663,
    "MA DLS General Fund Revenue by Source": 1755,
    "US Federal Outlays by Function (OMB Public Budget Database)": 50,
    "US Federal Outlays by Agency (OMB Public Budget Database)": 49,
    "US Federal Receipts by Source (OMB Historical Table 2.1)": 49,
    "bloomington-open-data": 24,
    "Sacramento Operating Budget": 14,
    "Sacramento Revenue Budget": 14,
    "Bloomington Public Contracts": 11,
    "cambridge-open-data": 8,
    "Leonardtown Operating Budget": 6,
    "McKinney Revenue": 5,
    "ArcGIS: https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/LA_County_Employee_Salaries/FeatureServer/0": 4,
    "Empowered Vote Financial Records": 4,
    "San Francisco Operating Budget": 4,
    "San Francisco Revenue Budget": 4,
    "San Jose General Fund Operating Budget": 4,
    "San Jose General Fund Revenue Budget": 4,
    "Prosper ACFR": 3,
    "Prosper Revenue": 3,
    "Richardson Operating Budget": 3,
    "Bakersfield Operating Budget": 2,
    "Bakersfield Revenue Budget": 2,
    "Fremont Operating Budget": 2,
    "Fremont Revenue Budget": 2,
    "Allen ACFR": 1,
    "Allen Revenue": 1,
    "Barnstable County Operating Budget": 1,
    "Beneficial State Bank": 1,
    "Bristol County Operating Budget": 1,
    "Celina ACFR": 1,
    "Celina Revenue": 1,
    "Dukes County Operating Budget": 1,
    "Frisco Revenue": 1,
    "Garland Operating Budget": 1,
    "LA County Open Data - Employee Salaries": 1,
    "Longview Operating Budget": 1,
    "Longview Revenue": 1,
    "Murphy Operating Budget": 1,
    "Norfolk County Operating Budget": 1,
    "platform exports": 1,
    "Plymouth County Operating Budget": 1,
    "Princeton Operating Budget": 1,
    "Sachse Operating Budget": 1,
    "San Diego Operating Budget": 1,
    "San Diego Revenue Budget": 1,
    "US Federal Outlays by Agency (MTS Table 5)": 1,
    "US Federal Outlays by Agency Transition Quarter (Jul–Sep 1976) (OMB Public Budget Database)": 1,
    "US Federal Outlays by Function Transition Quarter (Jul–Sep 1976) (OMB Public Budget Database)": 1,
    "US Federal Receipts by Source (MTS Table 9)": 1,
    "US Federal Receipts by Source Transition Quarter (Jul–Sep 1976) (OMB Historical Table 2.1)": 1,
    "Wylie Operating Budget": 1,
  },
};
