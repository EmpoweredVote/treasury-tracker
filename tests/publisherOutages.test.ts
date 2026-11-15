import { describe, it, expect } from 'vitest';
import { PUBLISHER_OUTAGES, outageForUrl } from '../src/data/publisherOutages';
import { PUBLISHER_OUTAGES as AUTHOR_FACING } from '../scripts/data/publisherOutages.mjs';

/**
 * ⚠⚠⚠ THE GUARD THAT AN OUTAGE RECORDED FOR MAINTAINERS REACHES READERS.
 *
 * `scripts/data/publisherOutages.mjs` recorded from 2026-11-09 that 60
 * citations over 6,616 budgets had 404'd since Ohio's Auditor of State was
 * attacked. Measured 2026-11-15, nothing under `src/` mentioned an outage, so
 * every one of those readers clicked a correct citation and met an unexplained
 * 404. A repo registry is the MINIMUM; publishing is the point.
 *
 * ⭐ Same shape as tests/figureFlags.test.ts, and for the same reason: the two
 * halves drift apart silently, and the half that goes missing is always the
 * reader's.
 */

describe('the reader-facing mirror stays in step with the author-facing register', () => {
  it('publishes every declared outage — none recorded for maintainers only', () => {
    const authorIds = AUTHOR_FACING.map((o: { id: string }) => o.id).sort();
    const readerIds = PUBLISHER_OUTAGES.map((o) => o.id).sort();
    expect(readerIds, 'declared in scripts/data but not published to readers')
      .toEqual(authorIds);
  });

  it('agrees with the register on host and start date, so the notice cannot drift', () => {
    for (const reader of PUBLISHER_OUTAGES) {
      const author = AUTHOR_FACING.find((o: { id: string }) => o.id === reader.id);
      expect(author, `no author-facing entry for ${reader.id}`).toBeTruthy();
      expect(reader.host).toBe(author.host);
      expect(reader.began).toBe(author.began);
    }
  });

  it('⚠ never claims to have looked before the outage began', () => {
    for (const o of PUBLISHER_OUTAGES) {
      expect(o.observedOn >= o.began, `${o.id}: observedOn precedes began`).toBe(true);
    }
  });
});

describe('the copy bar — a FACT about the publisher may ship, an INFERENCE may not', () => {
  it('quotes the publisher rather than summarising them', () => {
    for (const o of PUBLISHER_OUTAGES) {
      const author = AUTHOR_FACING.find((x: { id: string }) => x.id === o.id);
      // ⭐ The reader-facing quote must be the author-facing one, not a
      // paraphrase. Editing quoted text falsifies what it proves.
      expect(author.evidence.startsWith(o.evidence) || o.evidence.startsWith(author.evidence))
        .toBe(true);
      expect(o.evidenceUrl).toMatch(/^https:\/\//);
      expect(o.publisherName.length).toBeGreaterThan(3);
    }
  });

  it('⛔ never tells the reader the document is GONE — it is unreachable, not withdrawn', () => {
    // The entire reason the gate refuses to re-point these 6,616 citations is
    // that a 404 from a server publishing a degradation notice is not the
    // publisher saying the file no longer exists. The copy must not say it
    // either.
    for (const o of PUBLISHER_OUTAGES) {
      const copy = `${o.headline} ${o.detail}`.toLowerCase();
      expect(copy).not.toMatch(/deleted|removed|withdrawn|no longer exists|gone for good/);
    }
  });

  it('⛔ makes no prediction about when the publisher returns', () => {
    for (const o of PUBLISHER_OUTAGES) {
      const copy = `${o.headline} ${o.detail}`.toLowerCase();
      expect(copy).not.toMatch(/will be back|expected to|should return by|soon|shortly/);
    }
  });

  it('⛔ does not accuse the publisher — they are the victim here', () => {
    for (const o of PUBLISHER_OUTAGES) {
      const copy = `${o.headline} ${o.detail}`.toLowerCase();
      expect(copy).not.toMatch(/failed to|negligent|should have|careless|incompetent/);
    }
  });

  it('reassures that the FIGURE is unaffected — the link is what broke', () => {
    for (const o of PUBLISHER_OUTAGES) {
      expect(`${o.detail}`.toLowerCase()).toMatch(/unchanged|still|unaffected/);
    }
  });

  it('carries a checkable date in the detail, not a vague "recently"', () => {
    for (const o of PUBLISHER_OUTAGES) {
      expect(o.detail).toMatch(/\d{4}/);
      expect(o.detail.length).toBeGreaterThan(80);
      expect(o.headline).not.toBe(o.detail);
    }
  });
});

describe('outageForUrl — matched on HOST, because an outage is a property of the publisher', () => {
  const OHIO = 'https://www.ohioauditor.gov/references/SummarizedAnnualFinancialReports'
    + '/SummarizedReports/City_2016_CASH_Summarized.XLSX';

  it('matches a cited document on a host that is down', () => {
    expect(outageForUrl(OHIO)?.id).toBe('ohio-aos-cyberattack-2026-10-25');
  });

  it('matches EVERY path on that host — 6,616 budgets share it and share no path', () => {
    expect(outageForUrl('https://www.ohioauditor.gov/anything/else.XLSX')).toBeTruthy();
  });

  it('does not match a different publisher', () => {
    expect(outageForUrl('https://dls-gw.dor.state.ma.us/reports/rdPage.aspx')).toBeNull();
    expect(outageForUrl('https://bythenumbers.sco.ca.gov/d/ju3w-4gxp')).toBeNull();
  });

  it('⚠ does not match a LOOKALIKE host', () => {
    // Substring matching would light the notice up on an unrelated publisher.
    expect(outageForUrl('https://www.ohioauditor.gov.evil.example/x')).toBeNull();
    expect(outageForUrl('https://notohioauditor.gov/x')).toBeNull();
  });

  it('survives a malformed or absent URL rather than throwing', () => {
    expect(outageForUrl(null)).toBeNull();
    expect(outageForUrl(undefined)).toBeNull();
    expect(outageForUrl('')).toBeNull();
    expect(outageForUrl('local:docs/Richardson/FY25 Downloadable Budget.xlsx')).toBeNull();
  });

  it('⛔⛔ SHOWS NOTHING BEFORE THE OUTAGE BEGAN', () => {
    // A notice is a claim about RIGHT NOW. Rendering it over a historical date
    // would tell a reader a link was broken on a day it worked.
    expect(outageForUrl(OHIO, new Date('2026-10-01T00:00:00Z'))).toBeNull();
    expect(outageForUrl(OHIO, new Date('2026-10-25T00:00:00Z'))).toBeTruthy();
  });
});
