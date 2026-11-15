/**
 * Reader-facing publisher outages.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠⚠⚠ THE GATE KNEW. THE READER DID NOT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `scripts/data/publisherOutages.mjs` has recorded since 2026-11-09 that the
 * Ohio Auditor of State's web server has been offline after a cyberattack, and
 * that **60 citations covering 6,616 budgets** have 404'd ever since. All of
 * that was author-facing. Measured 2026-11-15: nothing under `src/` mentioned
 * an outage at all, so a reader on any of those budgets saw an ordinary source
 * chip, clicked it, and landed on a 404 with no explanation.
 *
 * ⭐⭐ THAT IS THE SAME DEFECT AS A MISSING CITATION, WEARING THE OTHER MASK.
 * ev-accounts#1474 fixed the case where we held a good link and told the reader
 * nothing. This fixes the case where we KNOW the link is dead, hold the
 * publisher's own statement saying why, and still tell the reader nothing. In
 * both the figure is fine and the reader is left to guess.
 *
 * ⭐ A repo registry is the MINIMUM; publishing is the point — the same rule
 * `figureFlags.ts` exists to carry out. `tests/publisherOutages.test.ts` keeps
 * this file in step with the author-facing register so an outage cannot be
 * recorded for maintainers and left off the page.
 *
 * ── ⚠⚠ WHAT THIS IS NOT ────────────────────────────────────────────────────
 *
 * NOT a claim that the document is gone. A 404 from a server that is
 * simultaneously publishing a notice about being degraded is not the publisher
 * saying the file no longer exists — that distinction is the entire reason the
 * gate refuses to re-point these 6,616 citations. The figure is unchanged, the
 * stored URL is still the right one, and it should work again when the
 * publisher returns.
 *
 * NOT a prediction. No return date is claimed, because none has been stated.
 *
 * ── ⭐ THE COPY BAR, INHERITED FROM figureFlags.ts ─────────────────────────
 *
 * A FACT ABOUT THE PUBLISHER MAY SHIP; AN INFERENCE ABOUT THEM MAY NOT. Every
 * sentence below is checkable: the date the Auditor stated, the status code its
 * own server returns, the date a person last looked. We do NOT tell the reader
 * that the outage "is expected to continue" — the publisher posting audit
 * releases by hand is evidence for that, and it is still a guess about their
 * internal recovery.
 */

export interface PublisherOutage {
  /** Matches `id` in scripts/data/publisherOutages.mjs. */
  id: string;
  /** Lower-case hostname, compared against the citation URL's host. */
  host: string;
  /**
   * Who the quote is attributed to, in the reader's words.
   * ⚠ Lives in the DATA, not in the component: a second outage would otherwise
   * be published under the first publisher's name.
   */
  publisherName: string;
  /** ISO date the outage began, per the publisher's own statement. */
  began: string;
  /** ISO date a person last CONFIRMED it — not the date it was first believed. */
  observedOn: string;
  /** What the reader is told, in the chip's neighbourhood. */
  headline: string;
  /** The facts behind it. Every clause must be checkable. */
  detail: string;
  /** The publisher's own words. A quote, never a summary. */
  evidence: string;
  /** Where that quote is published — reachable even while the data section is not. */
  evidenceUrl: string;
}

export const PUBLISHER_OUTAGES: PublisherOutage[] = [
  {
    id: 'ohio-aos-cyberattack-2026-10-25',
    host: 'www.ohioauditor.gov',
    publisherName: 'Ohio Auditor of State',
    began: '2026-10-25',
    observedOn: '2026-11-15',
    // ⚠ No verdict word, no alarm, and no accusation: the publisher is the
    // victim here, not the culprit. "Offline" is what their own page says.
    headline: 'The Ohio Auditor of State’s website is offline',
    // ⚠ Each clause is a fact: their stated date, the status their server
    // returns, the date a person last checked, and what it means for the
    // figure. Nothing about when it will come back.
    detail: 'This figure’s source document cannot be opened while the publisher’s '
      + 'site is down. The Auditor of State reported that its web server was attacked '
      + 'on 25 October 2026, and its financial-reporting section has returned “not '
      + 'found” ever since — last checked 15 November 2026. The figure shown here is '
      + 'unchanged: it was read from this document before the outage, and the link '
      + 'should work again when the publisher restores the section.',
    evidence: 'On Sunday Oct. 25, the web server of the Ohio Auditor of State’s office '
      + 'was attacked by overseas cybercriminals',
    evidenceUrl: 'https://www.ohioauditor.gov/',
  },
];

/** The host of a URL, lower-cased, or null if it will not parse. */
function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The outage covering this citation, or null.
 *
 * ⚠⚠ `asOf` EXISTS SO THE NOTICE CANNOT OUTLIVE ITS EVIDENCE. An outage notice
 * is a claim about RIGHT NOW. If the publisher returns and nobody removes the
 * entry, a banner telling readers a working link is broken becomes its own
 * misinformation — the same trap `figureFlags.ts` records for McKinney's
 * eleven-month flag. The gate's `recheckAfter` fence forces a person to look;
 * this is the reader-facing half of the same idea.
 *
 * ⛔ Deliberately matched on HOST, not on the full URL: the outage is a
 * property of the publisher, and all 6,616 affected budgets share the host
 * while sharing no path.
 */
export function outageForUrl(
  url: string | null | undefined,
  asOf: Date = new Date(),
): PublisherOutage | null {
  const host = hostOf(url);
  if (!host) return null;
  const day = asOf.toISOString().slice(0, 10);
  return PUBLISHER_OUTAGES.find(
    (o) => o.host.toLowerCase() === host && o.began <= day,
  ) ?? null;
}
