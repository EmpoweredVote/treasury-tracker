import { describe, it, expect } from 'vitest';
import { probeUrl, judgeProbe } from '../scripts/lib/sourceUrlProbe.mjs';
import {
  parseWaybackCitation,
  availabilityApiUrl,
  judgeAvailability,
} from '../scripts/lib/waybackCitation.mjs';

/**
 * ⭐⭐⭐ ASK WHAT THE PUBLISHER PUBLISHES, NOT WHAT THE CLIENT RENDERS.
 *
 * `verify:source-urls` could not get a stable answer out of web.archive.org.
 * #385 waited longer; #387's first commit paced the whole host; #387's second
 * commit sent a 429 to curl. Measured 2026-11-12, all three are beaten by the
 * same host:
 *
 *   after an 862s paced run      curl 429 x3        node 429 x3
 *   after 3 min of silence       curl 206           (drained)
 *   one node HEAD, then curl     node 429 -> curl 429   (ONE node request
 *                                                        re-arms it for curl)
 *   240s silence, curl only      429 429 429 429 429 206
 *
 * ⛔⛔ So the PLAYBACK path (`/web/<ts>/`) cannot be probed deterministically
 * from one IP by ANY client. It is rate limited, cumulatively and IP-wide, it
 * drains only on silence, and the drain is not reliable at three minutes.
 *
 * ⭐ But the Archive publishes a second endpoint for exactly this question —
 * `https://archive.org/wayback/available` — which answered 200 six times in a
 * row, instantly, from node, for the very URL playback was refusing. That is
 * the rule the rest of this fleet already runs on, reached one host later.
 *
 * ⚠⚠⚠ THE TRAP THAT MAKES THIS DANGEROUS IF DONE NAIVELY: the endpoint
 * answers with the CLOSEST snapshot, not the one asked for. Measured:
 *
 *   ...FY_2021_...pdf @ 20220510215335  ->  closest 20220510215335  ✅ exact
 *   ...FY_2021_...pdf @ 19990101000000  ->  closest 20220114200341  ⛔ A
 *                                            DIFFERENT CAPTURE, available:true
 *
 * A citation names ONE capture. Accepting a neighbour would pass a link that
 * no longer resolves, which is the entire defect this gate exists to catch.
 */

const NH = 'https://web.archive.org/web/20220510215335if_'
  + '/https://www.das.nh.gov/accounting/FY%2021/FY_2021_Annual_Comprehensive_Financial_Report.pdf';

const ok = (timestamp, status = '200') => ({
  archived_snapshots: { closest: { available: true, status, timestamp, url: 'http://web.archive.org/…' } },
});

describe('parseWaybackCitation — a citation names one capture', () => {
  it('reads the timestamp, the modifier and the original URL', () => {
    expect(parseWaybackCitation(NH)).toEqual({
      timestamp: '20220510215335',
      modifier: 'if_',
      original: 'https://www.das.nh.gov/accounting/FY%2021/FY_2021_Annual_Comprehensive_Financial_Report.pdf',
    });
  });

  it('reads the id_ modifier — 19 of TT\'s 27 archive citations use it', () => {
    const u = 'https://web.archive.org/web/20260215072617id_'
      + '/https://www.corneliusor.gov/DocumentCenter/View/462/Annual-Comprehensive-Financial-Report-FY2023-PDF';
    expect(parseWaybackCitation(u)).toMatchObject({ timestamp: '20260215072617', modifier: 'id_' });
  });

  it('reads a capture with no modifier at all', () => {
    const u = 'https://web.archive.org/web/20220510215335/https://example.gov/acfr.pdf';
    expect(parseWaybackCitation(u)).toMatchObject({ timestamp: '20220510215335', modifier: '' });
  });

  it('⚠ keeps the original URL BYTE-FOR-BYTE — %2021 is a space that must survive', () => {
    // Re-encoding here would ask the API about a different document.
    expect(parseWaybackCitation(NH).original).toContain('FY%2021');
  });

  it('returns null for a URL that is not a wayback capture', () => {
    expect(parseWaybackCitation('https://www.das.nh.gov/accounting/acfr.pdf')).toBeNull();
    expect(parseWaybackCitation('https://archive.org/details/something')).toBeNull();
    expect(parseWaybackCitation('https://web.archive.org/')).toBeNull();
  });

  it('returns null rather than throwing on rubbish', () => {
    expect(parseWaybackCitation(null)).toBeNull();
    expect(parseWaybackCitation('')).toBeNull();
    expect(parseWaybackCitation(42)).toBeNull();
  });

  it('refuses a timestamp that is not 14 digits — a partial one means a DIFFERENT capture', () => {
    expect(parseWaybackCitation('https://web.archive.org/web/2022/https://example.gov/a.pdf')).toBeNull();
  });
});

describe('availabilityApiUrl', () => {
  it('asks for the exact capture, with the original URL encoded as one parameter', () => {
    const u = availabilityApiUrl(parseWaybackCitation(NH));
    expect(u.startsWith('https://archive.org/wayback/available?')).toBe(true);
    expect(u).toContain('timestamp=20220510215335');
    // ⚠ %2021 must reach the API intact, so it arrives double-encoded in the query.
    expect(u).toContain('FY%252021');
  });
});

describe('judgeAvailability — ⛔ MAY ACQUIT, MAY NEVER CONVICT', () => {
  const parsed = parseWaybackCitation(NH);

  it('confirms the exact capture the citation names', () => {
    expect(judgeAvailability(parsed, ok('20220510215335'))).toMatchObject({ confirmed: true, archivedStatus: 200 });
  });

  it('⭐⭐ THE TRAP: a NEIGHBOURING capture is not the one cited, and is NOT a pass', () => {
    const v = judgeAvailability(parsed, ok('20220114200341'));
    expect(v.confirmed).toBe(false);
    expect(v.reason).toMatch(/20220114200341/);
  });

  it('does not confirm when the Archive holds no snapshot at all', () => {
    expect(judgeAvailability(parsed, { archived_snapshots: {} }).confirmed).toBe(false);
  });

  it('does not confirm when available is false', () => {
    const payload = ok('20220510215335');
    payload.archived_snapshots.closest.available = false;
    expect(judgeAvailability(parsed, payload).confirmed).toBe(false);
  });

  it('⚠ does not confirm a capture OF AN ERROR PAGE — an archived 404 is not a citation', () => {
    expect(judgeAvailability(parsed, ok('20220510215335', '404')).confirmed).toBe(false);
    expect(judgeAvailability(parsed, ok('20220510215335', '500')).confirmed).toBe(false);
  });

  it('returns not-confirmed rather than throwing on a malformed or empty payload', () => {
    for (const bad of [null, undefined, {}, { archived_snapshots: null }, 'nonsense', 7]) {
      expect(judgeAvailability(parsed, bad).confirmed).toBe(false);
    }
  });

  it('returns not-confirmed when the citation itself did not parse', () => {
    expect(judgeAvailability(null, ok('20220510215335')).confirmed).toBe(false);
  });
});

/**
 * ⭐ THE INTEGRATION RULE, PINNED BOTH WAYS.
 *
 * The availability endpoint is a SECOND OPINION on a refusal. It must never
 * replace the playback probe when playback is answering, because only playback
 * can check that a `.pdf` citation is served as a PDF — and it must never turn
 * a refusal into something worse than the refusal already was.
 */
describe('probeUrl — the Archive is asked about its own captures', () => {
  const res = (status, contentType = '') => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? contentType : null) },
  });

  it('⭐ rescues a playback 429 with the Archive\'s own confirmation', async () => {
    const asked = [];
    const out = await probeUrl(NH, {
      retries: 0,
      fetchImpl: async (u) => { asked.push(u); return res(429, 'text/html'); },
      waybackImpl: async () => ({ confirmed: true, archivedStatus: 200, reason: 'confirmed' }),
    });
    expect(out.status).toBe(200);
    expect(out.viaWayback).toBe(true);
    expect(judgeProbe(out).verdict).toBe('ok');
  });

  it('⛔⛔ MAY NEVER CONVICT: an unconfirmed capture leaves the refusal exactly as it was', async () => {
    const out = await probeUrl(NH, {
      retries: 0,
      fetchImpl: async () => res(429, 'text/html'),
      waybackImpl: async () => ({ confirmed: false, reason: 'the Archive holds no snapshot of this URL' }),
    });
    // Still 429/unreachable — NOT `dead`, which would order a repair.
    expect(out.status).toBe(429);
    expect(judgeProbe(out).verdict).toBe('unreachable');
  });

  it('⚠ does not ask the Archive when playback is answering — the stronger check wins', async () => {
    let asked = 0;
    const out = await probeUrl(NH, {
      retries: 0,
      fetchImpl: async () => res(206, 'application/pdf'),
      waybackImpl: async () => { asked += 1; return { confirmed: true, archivedStatus: 200 }; },
    });
    expect(asked).toBe(0);
    expect(out.status).toBe(206);
    expect(judgeProbe(out).verdict).toBe('ok');
  });

  it('⚠ never asks the Archive about a URL that is not one of its captures', async () => {
    let asked = 0;
    await probeUrl('https://www.das.nh.gov/accounting/acfr.pdf', {
      retries: 0,
      fetchImpl: async () => res(429, 'text/html'),
      waybackImpl: async () => { asked += 1; return { confirmed: true, archivedStatus: 200 }; },
    });
    expect(asked).toBe(0);
  });

  it('⭐⭐ STOPS THE RETRY STORM: a confirmed capture costs no retries at all', async () => {
    let slept = 0;
    let playbackRequests = 0;
    await probeUrl(NH, {
      retries: 3,
      fetchImpl: async () => { playbackRequests += 1; return res(429, 'text/html'); },
      sleepImpl: async () => { slept += 1; },
      waybackImpl: async () => ({ confirmed: true, archivedStatus: 200 }),
    });
    // HEAD + one-byte GET, then the Archive. No third, fourth or twelfth ask.
    expect(playbackRequests).toBe(2);
    expect(slept).toBe(0);
  });

  it('⚠ a failing availability endpoint must not break the probe', async () => {
    const out = await probeUrl(NH, {
      retries: 0,
      fetchImpl: async () => res(429, 'text/html'),
      waybackImpl: async () => { throw new Error('endpoint down'); },
    });
    expect(out.status).toBe(429);
  });
});
