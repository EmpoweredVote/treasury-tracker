import { describe, it, expect } from 'vitest';
import { cdxApiUrl, judgeCdx, askWaybackCdx, parseWaybackCitation } from '../scripts/lib/waybackCitation.mjs';
import { probeUrl, judgeProbe } from '../scripts/lib/sourceUrlProbe.mjs';

/**
 * ⭐⭐⭐ WHY A SECOND ARCHIVE ORACLE EXISTS, MEASURED 2026-11-12.
 *
 * `/wayback/available` answered `archived_snapshots: {}` — "the Archive holds
 * no snapshot of this URL" — TWENTY TIMES RUNNING for a capture it had
 * confirmed twenty minutes earlier, and that playback itself serves. It is not
 * random flake: it was 20/20 empty for one URL and 20/20 confirmed for its
 * neighbour in the same breath. That false negative is what failed the
 * 2026-11-12 fleet run at 2,045 of 2,047.
 *
 * The CDX index answers the same question exactly, and answers it with MORE:
 * the archived status code AND the archived mimetype, keyed to an exact
 * timestamp range rather than to a "closest" guess.
 *
 * ⛔⛔ IT STILL MAY NEVER CONVICT. An index that can invent a "no" can invent
 * a wrong mimetype too, so a CDX row that fails the citation's promised type
 * must fall through to a real fetch rather than condemn it.
 */

const HEADER = ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'];
const row = (ts, mime, status) => ['net,cor)/x', ts, 'https://www.cor.net/x', mime, status, 'DIG', '173913'];
const CAP = parseWaybackCitation('https://web.archive.org/web/20230309070104id_/https://www.cor.net/x');

describe('cdxApiUrl', () => {
  it('pins the query to the EXACT timestamp, both ends', () => {
    const u = cdxApiUrl(CAP);
    expect(u).toContain('from=20230309070104');
    expect(u).toContain('to=20230309070104');
    expect(u).toContain('output=json');
  });

  it('keeps the original URL byte-for-byte, re-encoded not decoded', () => {
    // ⚠ `FY%2021` is a percent-encoded SPACE. Decoding it would ask the index
    // about a different document — the same trap the availability path has.
    const cap = parseWaybackCitation('https://web.archive.org/web/20220510215335/https://x.gov/FY%2021.pdf');
    expect(cdxApiUrl(cap)).toContain(encodeURIComponent('https://x.gov/FY%2021.pdf'));
    expect(cdxApiUrl(cap)).toContain('FY%252021');
  });
});

describe('judgeCdx', () => {
  it('confirms a row whose timestamp matches exactly, with its status and mimetype', () => {
    const v = judgeCdx(CAP, [HEADER, row('20230309070104', 'application/pdf', '200')]);
    expect(v.confirmed).toBe(true);
    expect(v.archivedStatus).toBe(200);
    expect(v.archivedMime).toBe('application/pdf');
  });

  it('reads its columns BY NAME, not by position', () => {
    // The Archive is free to reorder or extend its own columns.
    const header = ['timestamp', 'statuscode', 'mimetype'];
    const v = judgeCdx(CAP, [header, ['20230309070104', '200', 'application/pdf']]);
    expect(v.confirmed).toBe(true);
    expect(v.archivedMime).toBe('application/pdf');
  });

  it('⛔ refuses a NEIGHBOURING capture, even inside the same response', () => {
    const v = judgeCdx(CAP, [HEADER, row('20230309070105', 'application/pdf', '200')]);
    expect(v.confirmed).toBe(false);
    expect(v.reason).toMatch(/different capture|20230309070105/);
  });

  it('⛔ does not confirm a revisit record, whose status is "-"', () => {
    // A revisit says "same bytes as some other capture" and states no status
    // of its own. That is not this citation answering.
    const v = judgeCdx(CAP, [HEADER, row('20230309070104', 'warc/revisit', '-')]);
    expect(v.confirmed).toBe(false);
  });

  it('⛔ does not confirm a capture OF an error page', () => {
    for (const status of ['404', '500', '301']) {
      expect(judgeCdx(CAP, [HEADER, row('20230309070104', 'text/html', status)]).confirmed).toBe(false);
    }
  });

  it('is not confirmed by an empty index, and never throws on rubbish', () => {
    expect(judgeCdx(CAP, [HEADER]).confirmed).toBe(false);
    expect(judgeCdx(CAP, []).confirmed).toBe(false);
    for (const junk of [null, undefined, {}, 'nope', [[]], [HEADER, null], [HEADER, 'x']]) {
      expect(() => judgeCdx(CAP, junk)).not.toThrow();
      expect(judgeCdx(CAP, junk).confirmed).toBe(false);
    }
    expect(judgeCdx(null, [HEADER, row('20230309070104', 'application/pdf', '200')]).confirmed).toBe(false);
  });
});

describe('askWaybackCdx', () => {
  it('is not confirmed when the index refuses, and does not throw', async () => {
    const fetchImpl = async () => ({ ok: false, status: 429, json: async () => [] });
    await expect(askWaybackCdx(CAP, { fetchImpl })).resolves.toMatchObject({ confirmed: false });
  });

  it('is not confirmed when the index throws, and does not throw', async () => {
    const fetchImpl = async () => { throw new Error('socket hang up'); };
    await expect(askWaybackCdx(CAP, { fetchImpl })).resolves.toMatchObject({ confirmed: false });
  });
});

describe('the probe, wired to both oracles', () => {
  const CAPTURE = 'https://web.archive.org/web/20230309070104id_/https://www.cor.net/x.pdf';
  const refuse = async () => ({ status: 429, headers: { get: () => '' } });
  const noSleep = async () => {};

  it('rescues a 429 from the CDX index, and reports the archived type', async () => {
    const out = await probeUrl(CAPTURE, {
      fetchImpl: refuse,
      sleepImpl: noSleep,
      cdxImpl: async () => ({ confirmed: true, archivedStatus: 200, archivedMime: 'application/pdf' }),
      waybackImpl: async () => { throw new Error('must not be asked'); },
    });
    expect(judgeProbe(out).verdict).toBe('ok');
    expect(out.contentType).toBe('application/pdf');
    expect(out.viaWayback).toBe(true);
  });

  it('falls through to the availability endpoint when CDX cannot answer', async () => {
    let askedAvailability = 0;
    const out = await probeUrl(CAPTURE, {
      fetchImpl: refuse,
      sleepImpl: noSleep,
      cdxImpl: async () => ({ confirmed: false, reason: 'the index holds no row' }),
      waybackImpl: async () => { askedAvailability += 1; return { confirmed: true, archivedStatus: 200 }; },
    });
    expect(askedAvailability).toBeGreaterThan(0);
    expect(judgeProbe(out).verdict).toBe('ok');
    // ⚠ The availability endpoint does not serve bytes, so it claims no type.
    expect(out.contentType).toBe('');
  });

  it('⛔ NEVER convicts on an index mimetype — a mismatch falls through to a real fetch', async () => {
    // The .pdf citation's row says text/html. An index that can invent a "no"
    // can invent this too, so it may not produce `wrong-type` on its own.
    let askedAvailability = 0;
    const out = await probeUrl(CAPTURE, {
      fetchImpl: refuse,
      sleepImpl: noSleep,
      cdxImpl: async () => ({ confirmed: true, archivedStatus: 200, archivedMime: 'text/html' }),
      waybackImpl: async () => { askedAvailability += 1; return { confirmed: false }; },
    });
    expect(judgeProbe(out).verdict).not.toBe('wrong-type');
    expect(judgeProbe(out).verdict).toBe('unreachable');
    expect(askedAvailability).toBeGreaterThan(0);
  });

  it('never asks either oracle for a URL that is not a wayback capture', async () => {
    let asked = 0;
    const count = async () => { asked += 1; return { confirmed: true, archivedStatus: 200 }; };
    await probeUrl('https://example.gov/budget.pdf', {
      fetchImpl: refuse, sleepImpl: noSleep, cdxImpl: count, waybackImpl: count,
    });
    expect(asked).toBe(0);
  });

  it('a throwing CDX endpoint cannot break the probe', async () => {
    const out = await probeUrl(CAPTURE, {
      fetchImpl: refuse,
      sleepImpl: noSleep,
      cdxImpl: async () => { throw new Error('boom'); },
      waybackImpl: async () => ({ confirmed: true, archivedStatus: 200 }),
    });
    expect(judgeProbe(out).verdict).toBe('ok');
  });
});
