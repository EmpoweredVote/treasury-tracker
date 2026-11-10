/**
 * Publishers that are OFFLINE — not publishers whose documents moved.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠⚠⚠ WHY THIS FILE HAD TO EXIST
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `verify:source-urls` shipped with one rule about a 404: it means *"the
 * publisher says this document is gone — repair the URL; do not annotate it"*,
 * and it may NEVER be declared away. That rule is right, and on its first live
 * run it was wrong about 60 URLs covering **6,616 budgets** — 93% of every dead
 * citation TT holds.
 *
 * Ohio's Auditor of State took its web server offline on **2026-10-25** after a
 * cyberattack. Every report path has 404'd since, including files fetched
 * successfully before. The verdict `dead` demanded a repair, and acting on it
 * would have been wrong in the most expensive way available: rewriting 6,616
 * correct citations to point somewhere else, during an outage, with no live
 * file to check any replacement against.
 *
 * ── ⭐⭐ THE DISTINCTION IS MEASURABLE, NOT RHETORICAL ──────────────────────
 *
 * Measured 2026-11-09 across the twenty hosts holding a dead citation:
 *
 *   cg.sc.gov                root → 200, "Home | Comptroller General"
 *                            24 of 24 documents 404 → THEY REALLY MOVED
 *   www.ohioauditor.gov      root → 200, "Website Temporarily Unavailable |
 *                            Ohio Auditor of State"; apex does not resolve at
 *                            all; 60 of 60 documents 404 → THE PUBLISHER IS DOWN
 *
 * Same status code, opposite meaning, and the publisher itself is what tells
 * them apart. Which is the rule the whole fleet runs on: **ask the publisher.**
 *
 * ── ⚠⚠ THE THREE FENCES, SO THIS CANNOT BECOME AN EXCUSE ───────────────────
 *
 * 1. **`recheckAfter` IS MANDATORY AND THE GATE ENFORCES IT.** Past that date
 *    the run FAILS until a person looks again. A declaration that never expires
 *    is exactly the permanent annotation `dead` was forbidden to have.
 * 2. **EVERY CITATION ON THE HOST MUST STILL FAIL.** If even one resolves, the
 *    publisher is serving files again, the rest are genuinely gone, and the
 *    gate reports this entry as stale.
 * 3. **IT CANNOT EXCUSE AN EXPIRING LINK.** `uncitable` is judged on shape
 *    before any outage is consulted.
 *
 * ⭐ `evidence` is a quote, not a summary. Editing quoted text falsifies what
 * it proves — the same rule `auditGradeRegistry.mjs` follows.
 *
 * @type {{id: string, host: string, began: string, observedOn: string,
 *         recheckAfter: string, evidence: string, evidenceUrl: string,
 *         citations: number, budgets: number}[]}
 */
export const PUBLISHER_OUTAGES = [
  {
    id: 'ohio-aos-cyberattack-2026-10-25',
    host: 'www.ohioauditor.gov',
    began: '2026-10-25',
    observedOn: '2026-11-09',
    // ⚠ A month. Long enough not to churn on a recovery that is plainly not
    // imminent — day 16 with no stated return date — and short enough that
    // nobody inherits this as settled fact. ⛔ Do NOT extend it without
    // re-probing a DATA path; the homepage is not the test (see below).
    recheckAfter: '2026-12-10',
    evidence:
      'On Sunday Oct. 25, the web server of the Ohio Auditor of State’s office was attacked '
      + 'by overseas cybercriminals and potentially foreign state actors … we took the web '
      + 'server and online accounts offline while internal and external experts scrutinize the '
      + 'threat activity. — Auditor Keith Faber',
    evidenceUrl: 'https://www.ohioauditor.gov/',
    citations: 60,
    budgets: 6616,
  },
];

/**
 * ⚠⚠⚠ PROBE THE FILE YOU ACTUALLY NEED, NEVER THE HOMEPAGE.
 *
 * On 2026-11-03 `https://www.ohioauditor.gov/` returned **200** with a
 * `Last-Modified` NEWER than the outage notice, which reads exactly like "the
 * site is back". It was not — they had merely touched an 8KB maintenance page.
 * The real test is a data path:
 * `.../SummarizedReports/City_2024_GAAP_Summarized.XLSX` → 404.
 *
 * ⚠ And the apex `ohioauditor.gov` does not resolve at all (curl exit 6) while
 * `www.` does. Probing only the apex reads as "host unreachable" and is wrong
 * about which failure this is.
 *
 * ⛔ DO NOT GO HUNTING FOR A MIRROR. The only trustworthy copy of this data is
 * the publisher's, and a citation that points at somebody else's copy is not a
 * citation of the publisher.
 *
 * ⚠ STILL OPEN AND UNVERIFIABLE UNTIL THE SITE RETURNS: the apex → `www.` move
 * of 2026-11-01 (6,616 rows) has never been confirmed against a live file,
 * because there has not been one since. See reference_ohio_aos_financial_data.
 */
export const OHIO_PROBE_PATH =
  'https://www.ohioauditor.gov/references/SummarizedAnnualFinancialReports/SummarizedReports/City_2024_GAAP_Summarized.XLSX';
