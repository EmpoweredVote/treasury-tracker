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
    // ⭐ RECHECKED 2026-11-13 (day 19) — STILL DOWN, and the measurement is
    // below. `observedOn` is the last date a person confirmed it, not the date
    // it was first believed.
    observedOn: '2026-11-13',
    // ⚠ A month from the FIRST observation. Long enough not to churn on a
    // recovery that is plainly not imminent — no stated return date — and
    // short enough that nobody inherits this as settled fact. ⛔ Do NOT extend
    // it without re-probing a DATA path; the homepage is not the test (below).
    //
    // ⛔⛔ DELIBERATELY NOT PUSHED OUT BY THE 2026-11-13 RECHECK, even though
    // the publisher now looks settled in for a while (it has started posting
    // audit releases weekly by hand "while our systems remain offline"). That
    // inference is an argument for expecting a longer outage, which is exactly
    // the argument a fence exists to refuse. The date stands; a person looks
    // on 2026-12-10.
    recheckAfter: '2026-12-10',
    // ── ⭐⭐ WHAT THE 2026-11-13 RECHECK MEASURED ─────────────────────────
    //
    //   ohioauditor.gov                        curl exit 6 — does not resolve
    //   www.ohioauditor.gov/                   200  8,566 B maintenance page
    //                                          Last-Modified Thu 12 Nov 2026
    //   www.ohioauditor.gov/AuditReleases/     200  4,481 B  ⭐ NEW since Nov 5
    //   …/references/SummarizedAnnualFinancialReports      404   (landing)
    //   …/financialreporting/default.html                  404   (filing page)
    //   all 60 stored citations                            404   60 of 60
    //
    // ⚠⚠ THE LAST LINE IS FENCE 2 AND IT HOLDS: not one of the sixty resolves,
    // so the declaration still describes reality. ⭐ Probed with RANGED CURL,
    // never node's fetch — #394 measured hosts that refuse node outright while
    // serving curl, and a node 403 would be a fact about node.
    //
    // ⭐⭐⭐ AND THE SHAPE IS SHARPER THAN "THE PUBLISHER IS DOWN". The web
    // server answers fine; what is missing is the whole financial-reporting
    // section — its landing page, its filing page and all sixty files, while
    // a hand-maintained releases page went UP during the outage. A 404 from a
    // server that is simultaneously publishing a notice about being degraded
    // is not the publisher saying the document is gone, which is the entire
    // reason `dead` would be the wrong verdict here.
    evidence:
      'On Sunday Oct. 25, the web server of the Ohio Auditor of State’s office was attacked '
      + 'by overseas cybercriminals and potentially foreign state actors … we took the web '
      + 'server and online accounts offline while internal and external experts scrutinize the '
      + 'threat activity. — Auditor Keith Faber'
      // ⭐ Read off the same page on 2026-11-13, and the freshest dated thing
      // the publisher says about its own systems. ⚠ Quoted, never summarised.
      + ' ‖ As of November 5, 2026, audit reports scheduled for release are being posted each '
      + 'Thursday on this temporary page while our systems remain offline.',
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
