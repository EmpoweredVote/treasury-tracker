/**
 * Source → ACCOUNTING BASIS, with the document each claim was read from.
 *
 * NO SHEBANG — data module under scripts/data/, imported by tests.
 *
 * ── THE FAILURE DIRECTION ────────────────────────────────────────────────────
 *
 * THE DEFAULT IS `unknown`, and `unknown` is a correct outcome rather than a
 * shortfall. A basis is only ever asserted by an entry carrying the document it
 * was read from. No matching entry, a null data_source, an entry with no
 * evidence, a pattern that throws — every one yields `unknown`, because the
 * destructive direction here is "declare how a government measured its money",
 * not "skip".
 *
 * ⚠⚠ NO BULK `gaap` BACKFILL, NOW OR LATER. Assuming GAAP for every unexamined
 * row is the same unevidenced assertion this axis exists to prevent, and it
 * would silently mark ~280k rows with a claim nobody checked.
 *
 * ── ⚠⚠ WHY THE WA ENTITIES ARE LISTED BY NAME ───────────────────────────────
 *
 * Redmond and Duvall are BOTH `WA State Auditor — ...`, both King County, both
 * loaded by the same pipeline — and they do not share an accounting basis.
 * Redmond files a GAAP ACFR; Duvall reports on the cash-basis BARS regulatory
 * framework and its auditor issues an ADVERSE opinion on U.S. GAAP.
 *
 * A pattern anchored on the publisher prefix would therefore stamp Duvall
 * `gaap` — a false public claim about a document that explicitly denies GAAP.
 * So `wa-sao-gaap` names its entities EXPLICITLY, the way `in-county-acfr-tg`
 * names its seventeen counties in fundScopeRegistry.mjs.
 *
 * The cost of that choice is deliberate: a NEW WA entity matches nothing and
 * lands `unknown` until somebody reads its opinion letter. That is the correct
 * failure direction — a WA city's basis is not derivable from its publisher,
 * and this registry is the proof.
 *
 * ⚠ `classifyAxis` returns the FIRST match, so order would also protect this.
 * It is NOT relied on: tests/accountingBasis.test.mjs asserts the gaap pattern
 * cannot match Duvall in isolation. Order is a second belt, never the rule.
 *
 * Source strings were resolved by QUERYING the live table, not transcribed.
 */
import { ACCOUNTING_BASIS } from '../lib/budgetAxes.mjs';

/** The WA SAO entities whose filings are GAAP ACFRs. Duvall is NOT among them. */
const WA_GAAP_ENTITIES = [
  'Tacoma', 'Spokane', 'Vancouver', 'Bellevue', 'Kent', 'Everett', 'Redmond',
  'Bainbridge Island', 'Kitsap County',
];

export const ACCOUNTING_BASIS_REGISTRY = [
  {
    // ⚠ FIRST, and named explicitly. See the header.
    id: 'wa-sao-duvall-cash',
    // ⚠⚠ THE YEARS ARE ENUMERATED TO THE LOADED WINDOW, exactly as the
    // audit-grade twin's are. `FY\d{4}` looks harmless and is not: the two
    // entries carry the two halves of one fact about one document, so a year
    // inside one pattern and outside the other is a row published with half a
    // description. A future FY2026 load would have landed `accounting_basis =
    // cash` — an unevidenced claim about a document NOBODY HAS READ, which
    // this file's own header forbids — beside `audit_grade = unknown`.
    // FY2015 and earlier were never read either (the floor rule excludes them)
    // and must not inherit the basis from a document they are not in.
    // tests/auditGradeRegistry.test.mjs asserts the two agree, sampling years
    // OUTSIDE the window as well as inside it, because a sample taken only
    // inside passes whether or not they agree.
    match: /^WA State Auditor — Duvall Annual Financial Report FY(?:201[6-9]|202[0-5]) \(General Fund, (?:Expenditure by Function|Revenue by Source)\)$/,
    value: ACCOUNTING_BASIS.CASH,
    evidence: {
      document: "City of Duvall FY2023 Financial Statements Audit Report, WA State Auditor "
        + "(ARN 1036127, portal.sao.wa.gov) — the auditor's report and Note 1.",
      figures: 'THE OPINION IS SPLIT AND BOTH HALVES MATTER. Unmodified on the regulatory '
        + 'basis: "Unmodified Opinion on the Regulatory Basis of Accounting (BARS Manual)". '
        + 'ADVERSE on GAAP: "Adverse Opinion on U.S. GAAP", because "the financial statements '
        + 'are prepared by the City using accounting practices prescribed by the BARS Manual, '
        + 'which is a basis of accounting other than GAAP". Note 1 adds that "Financial '
        + 'transactions are recognized on a cash basis of accounting" and that '
        + '"Government-wide statements, as defined in GAAP, are not presented." '
        + 'So the figure is AUDITED and it is NOT GAAP — which is exactly the pair of facts '
        + 'this axis exists to carry, and the reason audit_grade alone cannot carry it.',
    },
  },
  {
    id: 'wa-sao-gaap',
    match: new RegExp(
      '^WA State Auditor — (?:'
      + WA_GAAP_ENTITIES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
      + ') Annual Financial Report FY\\d{4} \\(General Fund, (?:Expenditure by Function|Revenue by Source)\\)$',
    ),
    value: ACCOUNTING_BASIS.GAAP,
    evidence: {
      document: 'Each entity\'s own WA SAO bound financial statements, the same documents the '
        + 'loader read. Redmond FY2024 (ARN 1040508) is the entity added this milestone: '
        + 'docs/Redmond/redmond-2024-acfr.pdf p.43.',
      figures: 'Redmond FY2024 prints "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND '
        + 'BALANCES / GOVERNMENTAL FUNDS" with a General Fund column totalling Total revenues '
        + '149,301,843 and Total expenditures 140,249,393 — the stored figures exactly. A '
        + 'governmental-funds statement with fund balances IS the GAAP presentation; Duvall, '
        + 'by contrast, prints "Fund Resources and Uses Arising from Cash Transactions" with '
        + 'Beginning/Ending Cash and Investments and no government-wide statements at all.',
    },
  },
  {
    id: 'sd-brown-county-modified-cash',
    match: /^Brown County ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY\d{4} actual, modified cash basis\)$/,
    value: ACCOUNTING_BASIS.MODIFIED_CASH,
    evidence: {
      document: 'Brown County, South Dakota ACFR, audited by the South Dakota Department of '
        + 'Legislative Audit; corroborated independently by the Federal Audit Clearinghouse.',
      figures: 'Its statements are TITLED "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN '
        + 'FUND BALANCES - MODIFIED CASH BASIS", and the auditor writes that they are '
        + '"prepared on the modified cash basis of accounting, which is a basis of accounting '
        + 'other than accounting principles generally accepted in the United States of '
        + 'America". FAC agrees from a separate record: gaap_results = not_gaap on every '
        + 'filing. ⚠ MODIFIED cash, not cash — a different measurement from Duvall\'s, which '
        + 'is why isComparablePair refuses those two against each other as well.',
    },
  },
  {
    id: 'sd-aberdeen-gaap',
    match: /^City of Aberdeen ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY\d{4} actual, GAAP basis\)$/,
    value: ACCOUNTING_BASIS.GAAP,
    evidence: {
      document: 'City of Aberdeen, South Dakota ACFR — Brown County\'s own county seat, '
        + 'audited in the same town.',
      figures: 'GAAP basis, whole dollars, and the loader records it as such in its own '
        + 'data_source label. ⚠ TWELVE MILES FROM BROWN COUNTY AND MEASURED DIFFERENTLY: '
        + 'neither entity\'s basis may ever be carried to the other. That pair is the '
        + 'clearest demonstration in the database that basis is a property of the FILING, '
        + 'not of the state, the publisher or the region.',
    },
  },
];
