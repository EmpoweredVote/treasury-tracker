/**
 * How many budgets in each family cite NOTHING AT ALL.
 *
 * ⚠⚠⚠ THIS IS THE DEGENERATE CASE OF THE DEAD-CITATION DEFECT. A budget with a
 * broken `source_url` asks the reader to believe a figure and hands them a link
 * that fails; a budget with no `source_url` asks them to believe it and hands
 * them nothing. 24,960 budgets are in the second state, which is 4.3% of the
 * fleet — so `verify:source-urls` failing on their EXISTENCE would be red from
 * the first run, and a gate that is red by design is a gate nobody reads.
 *
 * ⭐ SO IT RATCHETS, exactly like the totals baselines, and for the reason
 * 20261104180000 gives: "Its baselines live in code ON PURPOSE — paying one
 * down is reviewed in a PR diff ... Mirroring them into a table would create a
 * second authority that can drift from the first."
 *
 * The gate's only assertion is that **nothing grew**. Paying one down is a
 * NOTICE; lowering the number here is the PR that records it.
 *
 * ── ⚠ WHAT A "FAMILY" IS ───────────────────────────────────────────────────
 *
 * `familyOf()` in scripts/lib/sourceUrlProbe.mjs, and both of its
 * normalisations are load-bearing: the per-town prefix is dropped (the MA DLS
 * families carry one `data_source` per town, 351 of them, three times over) and
 * the fiscal year is stripped wherever it sits, including the middle of the
 * federal names. That collapses ~1,060 distinct `data_source` strings to these
 * 75 families — small enough that every one is named here rather than hidden
 * in a tail bucket, so a new uncited year moves a COUNT a reviewer can see.
 *
 * ── ⚠⚠ THE FOUR THAT ARE 97.4% OF IT ───────────────────────────────────────
 *
 * MA General Fund Expenditures (8,408), CA publicpay (7,682), MA General Fund
 * Revenues (6,663) and MA DLS Revenue by Source (1,755). Each is ONE publisher
 * with one landing page, so each is one `UPDATE` away from being cited —
 * ⚠ a targeted UPDATE on `source_url` only, NEVER a re-load: re-running a
 * loader re-mints `budgets.id` and stales the id-keyed frozen registry.
 * See reference_source_url_never_verified.
 *
 * MEASURED 2026-11-09 against the live fleet.
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
    "Bloomington Annual Compensation": 24,
    "bloomington-open-data": 24,
    "Sacramento Operating Budget": 14,
    "Sacramento Revenue Budget": 14,
    "Bloomington Public Contracts": 11,
    "LA City Payroll": 10,
    "Plano Check Register": 10,
    "West Hollywood Demand Register": 10,
    "Frisco Check Register": 9,
    "LA City Checkbook": 9,
    "Plano Operating Budget": 9,
    "cambridge-open-data": 8,
    "Fremont Operating Budget": 8,
    "Fremont Revenue Budget": 8,
    "Richardson Operating Budget": 8,
    "Fresno General Fund Operating Budget": 7,
    "Leonardtown Operating Budget": 6,
    "West Hollywood Budget Expenditure Detail": 6,
    "West Hollywood Budget Revenue Detail": 6,
    "McKinney Check Register": 5,
    "McKinney Revenue": 5,
    "San Jose General Fund Operating Budget": 5,
    "San Jose General Fund Revenue Budget": 5,
    "ArcGIS: https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/LA_County_Employee_Salaries/FeatureServer/0": 4,
    "Empowered Vote Financial Records": 4,
    "McKinney Payroll Register": 4,
    "Plano Revenue": 4,
    "Riverside General Fund Operating Budget": 4,
    "San Francisco Operating Budget": 4,
    "San Francisco Revenue Budget": 4,
    "Santa Ana General Fund Operating Budget": 4,
    "Santa Ana General Fund Revenue Budget": 4,
    "Prosper ACFR": 3,
    "Prosper Revenue": 3,
    "Anaheim General Fund Operating Budget": 2,
    "Anaheim General Fund Revenue Budget": 2,
    "Bakersfield Operating Budget": 2,
    "Bakersfield Revenue Budget": 2,
    "Long Beach General Fund Operating Budget": 2,
    "Long Beach General Fund Revenue Budget": 2,
    "Oakland General Purpose Fund Operating Budget": 2,
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
