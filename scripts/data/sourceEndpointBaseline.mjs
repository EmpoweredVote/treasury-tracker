/**
 * ⚠⚠ WHAT `treasury.data_sources.base_url` IS KNOWN TO BE WRONG ABOUT, TODAY.
 *
 * This file is a BACKLOG, not an excuse list. Every entry is a sentence about
 * the web that was true on the date beside it, and `verify:source-urls` fails
 * if one of them stops being true — the publisher came back, or the row was
 * deleted — because a repo that tells itself something out of date about a
 * publisher is worse off than one that says nothing.
 *
 * ── ⭐⭐ WHY THESE ARE DECLARED RATHER THAN REPAIRED ────────────────────────
 *
 * **Repairing these ten URLs would not change one reader-facing link.** Checked
 * before declaring, not assumed: every budget behind every entry here carries
 * `source_url IS NULL`, so it is already inside the 24,938-budget uncited
 * baseline and its page shows no source chip at all. `base_url` on a
 * `pdf_download` / `xlsx_download` / `csv_download` row is a note about where a
 * human fetched a file for a manual loader — `supabase/functions/treasury-sync`
 * refuses every api_type but `socrata` with `400 Unsupported`, so nothing calls
 * these on a schedule either.
 *
 * ⛔ So the honest repair is NOT a new `base_url`. It is giving those budgets a
 * real `source_url` — a citation campaign against the uncited backlog, the same
 * work #370→#380 did for the cited ones. Writing a fresh landing page into
 * `base_url` here would make this file green while changing nothing a reader
 * can see, which is the #380 defect wearing a new hat.
 *
 * ⚠ A row that DOES drive a sync (`api_type = 'socrata'`) can never be declared
 * here — `judgeEndpoints()` puts those in `syncBroken` before it ever consults
 * this list, because a dead one is a job that fails on its next tick. All seven
 * socrata endpoints were live on 2026-11-10.
 */

export const SOURCE_ENDPOINT_BASELINE = Object.freeze({
  /**
   * ⚠⚠⚠ PATHS ON ONE CONTRIBUTOR'S LAPTOP, IN THE PRODUCTION DATABASE.
   * 51 distinct, 86 rows, 11 cities (Anaheim, Bakersfield, Fremont, Fresno,
   * Long Beach, Oakland, Plano, Richardson, Riverside, San Jose, Santa Ana),
   * spelled two ways: `file://C:/treasury-tracker/docs/...` from the
   * pdf_download loaders and `local:docs/...` from the xlsx ones.
   *
   * ⭐ THIS IS WHERE THE LOST PROVENANCE WENT. Those eleven cities have 234
   * budgets citing nothing at all, and `docs/*` is gitignored — so the only
   * copy of each document is on one machine, and TT records no publisher URL
   * for it anywhere. The repair is to find the document on the publisher's
   * site and cite it; there is no cheaper one.
   *
   * ⚠ A COUNT, DELIBERATELY, AND IT IS THE WEAKER CHOICE. A count cannot tell
   * "one repaired, one new" from "nothing changed". It is a count because the
   * alternative is committing 51 absolute paths from a contributor's
   * filesystem into a public repo to buy a distinction nobody would act on
   * differently — and the gate PRINTS all of them on every run, so a swap is
   * still visible to a reader. May shrink. May never grow.
   */
  localPaths: 51,

  /**
   * Endpoints that answered, and answered wrong. Probed with the gate's own
   * ladder (HEAD → one-byte Range GET → curl), twice each, same verdict both
   * times — so none of these is a flake.
   */
  provenanceBroken: Object.freeze([
    {
      url: 'https://cao-94612.s3.us-west-2.amazonaws.com/documents/',
      verdict: 'dead',
      observedOn: '2026-11-10',
      // ⚠ This was never a document URL. S3 404s a prefix with no key, so this
      // has answered 404 since the day it was written — the loader was given
      // the folder the PDF sat in, not the PDF.
      why: 'Oakland — an S3 key PREFIX, not an object. S3 answers 404 for a '
        + 'directory, so this has never resolved and never will. 2 rows '
        + '(operating + revenue), 18 uncited Oakland budgets.',
    },
    {
      url: 'https://cms3.revize.com/revize/allentx/Documents/Departments/Finance/Financial%20Transparency/Budget/Adopted%20Budget/FY%202025-2026%20City%20of%20Allen%20Annual%20Budget.pdf',
      verdict: 'dead',
      observedOn: '2026-11-10',
      why: 'Allen TX — Revize retired the FY2025-26 adopted budget from this '
        + 'path. Last synced 2026-05-04, so it served at least once.',
    },
    {
      url: 'https://leonardtown.somd.com/pdf/Budget-FY2023.pdf',
      verdict: 'wrong-type',
      observedOn: '2026-11-10',
      why: 'Leonardtown MD moved its whole site — leonardtown.somd.com now '
        + '302s every path to https://www.leonardtownmd.gov/, which is why a '
        + '.pdf URL serves text/html. The new /budget page renders its '
        + 'documents in JS, so the replacement needs a browser to find.',
    },
    {
      url: 'https://leonardtown.somd.com/pdf/BudgetFY2024.pdf',
      verdict: 'wrong-type',
      observedOn: '2026-11-10',
      why: 'Leonardtown MD — same site move as FY2023.',
    },
    {
      url: 'https://leonardtown.somd.com/pdf/BudgetDraft2025.pdf',
      verdict: 'wrong-type',
      observedOn: '2026-11-10',
      why: 'Leonardtown MD — same site move as FY2023.',
    },
    {
      url: 'https://raw.githubusercontent.com/opensacorg/openbudgetsac.org/main/_src/data/flow',
      verdict: 'dead',
      observedOn: '2026-11-10',
      why: 'Sacramento — a path inside the opensacorg/openbudgetsac.org repo '
        + 'that no longer exists on `main`. A third-party volunteer project, '
        + 'not the City; the City is the source to re-cite against.',
    },
    {
      url: 'https://www.fresno.gov/finance/city-budget/',
      verdict: 'dead',
      observedOn: '2026-11-10',
      // ⚠ fresno.gov answers 404 to this gate's ladder and 403 to a bare
      // curl — different clients, different refusals. Recorded as the gate
      // sees it; either way the page is not serving.
      why: 'Fresno — the finance landing page 404s (and /finance/ and '
        + '/budget/ 403 a plain client), 23 uncited Fresno budgets behind it.',
    },
    {
      url: 'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/',
      verdict: 'dead',
      observedOn: '2026-11-10',
      why: 'Long Beach — a media-library DIRECTORY, not a document. 20 '
        + 'uncited Long Beach budgets behind it.',
    },
    {
      url: 'https://www.riversideca.gov/finance/budget',
      verdict: 'dead',
      observedOn: '2026-11-10',
      why: 'Riverside — /finance/budget 404s while /finance/ answers 200, so '
        + 'the page moved within a live site. 20 uncited Riverside budgets.',
    },
    {
      url: 'https://www.santa-ana.org/budget/',
      verdict: 'unreachable',
      observedOn: '2026-11-10',
      // ⚠⚠ NOT dead, and the distinction is #373's. The host refuses
      // automated clients; it never said the document is gone.
      why: 'Santa Ana — 403 to automated clients on BOTH santa-ana.org and '
        + 'the successor santa-ana.gov (which the old domain redirects to). '
        + 'A browser gets 200. Needs a human to look and confirm the '
        + 'successor URL. 24 uncited Santa Ana budgets.',
    },
  ]),
});
