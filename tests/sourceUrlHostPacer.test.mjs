import { describe, it, expect } from 'vitest';
import { createHostPacer, probeUrl } from '../scripts/lib/sourceUrlProbe.mjs';

/**
 * ⚠⚠⚠ THE RETRY WAS LOCAL AND THE RATE LIMIT IS NOT.
 *
 * #385 taught `probeUrl` that a 429 is an instruction: wait, then ask again.
 * The 2026-11-11 fleet run measured what that was worth — web.archive.org 429s
 * fell from 24 to 16 and stopped there, and the run still failed.
 *
 * The reason is that a rate limit is a property of the HOST and the backoff was
 * a property of ONE URL. Each archive citation discovered the limit by itself,
 * spent its three retries inside it — three more requests into a limiter, which
 * deepens it — and handed the gate straight back to the per-host loop, which
 * waited 150 ms and asked about the next one. Twenty-seven citations each
 * learning the same lesson privately is not a backoff; it is twenty-seven
 * bursts.
 *
 * ⭐ Probed by hand while fixing this, and the shape matters: the Archive
 * served twelve rapid requests for one URL without complaint, then answered the
 * thirteenth by dropping the connection outright, and refused eight DISTINCT
 * archive URLs immediately afterwards. The limiter is cumulative, it is
 * host-wide, and once tripped it stops answering rather than saying 429. So
 * the fix cannot be "re-ask harder" — it has to be "ask the whole host slower,
 * starting at the first sign".
 *
 * These tests pin that: what one URL learns, its siblings must obey.
 */

describe('createHostPacer — a rate limit belongs to the host, not the URL', () => {
  it('leaves a host that never complains at the base pause', () => {
    const pacer = createHostPacer({ basePauseMs: 150 });
    pacer.record('bythenumbers.sco.ca.gov', { status: 200 });
    pacer.record('bythenumbers.sco.ca.gov', { status: 206 });
    expect(pacer.pauseFor('bythenumbers.sco.ca.gov')).toBe(150);
  });

  it('⭐ THE BUG: a 429 on one URL slows the NEXT URL on the same host', () => {
    const pacer = createHostPacer({ basePauseMs: 150, limitFloorMs: 5000 });
    expect(pacer.pauseFor('web.archive.org')).toBe(150);
    pacer.record('web.archive.org', { status: 429 });
    // The sibling has not been asked yet and already pays the new price.
    expect(pacer.pauseFor('web.archive.org')).toBeGreaterThanOrEqual(5000);
  });

  it('widens further when the host says so again, and never past the cap', () => {
    const pacer = createHostPacer({ basePauseMs: 150, limitFloorMs: 5000, maxPauseMs: 30000 });
    pacer.record('web.archive.org', { status: 429 });
    const first = pacer.pauseFor('web.archive.org');
    pacer.record('web.archive.org', { status: 429 });
    expect(pacer.pauseFor('web.archive.org')).toBeGreaterThan(first);
    for (let i = 0; i < 20; i += 1) pacer.record('web.archive.org', { status: 429 });
    expect(pacer.pauseFor('web.archive.org')).toBe(30000);
  });

  /**
   * ⚠⚠ A TRIPPED LIMITER STOPS TALKING. Measured by hand: after the Archive
   * had had enough it did not answer 429, it refused the connection — and
   * eight distinct archive URLs then failed in a row. A pacer that only
   * recognises the status code would speed back up at exactly the moment it
   * must not.
   */
  it('⚠ treats a refused connection on an already-limited host as more of the same', () => {
    const pacer = createHostPacer({ basePauseMs: 150, limitFloorMs: 5000 });
    pacer.record('web.archive.org', { status: 429 });
    const afterLimit = pacer.pauseFor('web.archive.org');
    pacer.record('web.archive.org', { status: null, error: 'Failed to connect to web.archive.org port 443' });
    expect(pacer.pauseFor('web.archive.org')).toBeGreaterThan(afterLimit);
  });

  it('⛔ does NOT read a refused socket on a calm host as a rate limit', () => {
    // Plenty of hosts drop a connection for their own reasons. Only a host
    // that has actually said 429 gets the rate-limit reading.
    const pacer = createHostPacer({ basePauseMs: 150 });
    pacer.record('www.cor.net', { status: null, error: 'ECONNRESET' });
    expect(pacer.pauseFor('www.cor.net')).toBe(150);
  });

  it('⛔ one host being limited never slows a different host', () => {
    const pacer = createHostPacer({ basePauseMs: 150, limitFloorMs: 5000 });
    pacer.record('web.archive.org', { status: 429 });
    expect(pacer.pauseFor('www.fremont.gov')).toBe(150);
  });

  it('⭐ honours Retry-After when the server states one, over its own guess', () => {
    const pacer = createHostPacer({ basePauseMs: 150, limitFloorMs: 5000, maxPauseMs: 120000 });
    pacer.record('web.archive.org', { status: 429, retryAfterMs: 42000 });
    expect(pacer.pauseFor('web.archive.org')).toBe(42000);
  });

  it('eases back off a host that has recovered, rather than staying slow forever', () => {
    const pacer = createHostPacer({ basePauseMs: 150, limitFloorMs: 5000 });
    pacer.record('web.archive.org', { status: 429 });
    const limited = pacer.pauseFor('web.archive.org');
    for (let i = 0; i < 12; i += 1) pacer.record('web.archive.org', { status: 200 });
    const eased = pacer.pauseFor('web.archive.org');
    expect(eased).toBeLessThan(limited);
    expect(eased).toBeGreaterThanOrEqual(150);
  });
});

describe('probeUrl reports what the pacer needs to know', () => {
  it('⭐ surfaces Retry-After in milliseconds so the host pause can use it', async () => {
    const impl = async () => ({
      status: 429,
      headers: { get: (h) => (/^retry-after$/i.test(h) ? '30' : 'text/html') },
    });
    const r = await probeUrl('https://web.archive.org/web/1id_/https://x.gov/a.pdf',
      { fetchImpl: impl, sleepImpl: () => Promise.resolve(), retries: 0 });
    expect(r.status).toBe(429);
    expect(r.retryAfterMs).toBe(30000);
  });

  it('says nothing about Retry-After when the server did not send one', async () => {
    const impl = async () => ({ status: 429, headers: { get: () => 'text/html' } });
    const r = await probeUrl('https://web.archive.org/web/1id_/https://x.gov/a.pdf',
      { fetchImpl: impl, sleepImpl: () => Promise.resolve(), retries: 0 });
    expect(r.retryAfterMs).toBeUndefined();
  });
});

/**
 * ⚠⚠ THE PACER IS WORTH NOTHING UNTIL THE LOOP OBEYS IT.
 *
 * Both passes of this gate — citations and `data_sources.base_url` — walk one
 * host serially and sleep a fixed 150 ms between requests. That constant is
 * the actual burst: it is what marched 27 archive citations into a limiter
 * three retries at a time.
 */
describe('observeAll paces each host by what that host has said', () => {
  it('⭐ slows the REST of a host after one of its URLs is rate limited', async () => {
    const { observeAll } = await import('../scripts/verifySourceUrls.mjs');
    const rows = [
      { source_url: 'https://web.archive.org/web/1id_/https://a.gov/a.pdf' },
      { source_url: 'https://web.archive.org/web/2id_/https://b.gov/b.pdf' },
      { source_url: 'https://web.archive.org/web/3id_/https://c.gov/c.pdf' },
    ];
    const probeImpl = async (url) => (url.includes('/web/1id_/')
      ? { url, status: 429, contentType: 'text/html', error: null }
      : { url, status: 200, contentType: 'application/pdf', error: null });
    const waited = [];
    await observeAll(rows, { probeImpl, sleepImpl: (ms) => { waited.push(ms); return Promise.resolve(); } });
    expect(waited.length).toBe(3);
    // The first URL drew the 429; the two behind it must not be asked at 150ms.
    expect(waited[1]).toBeGreaterThanOrEqual(5000);
    expect(waited[2]).toBeGreaterThanOrEqual(5000);
  });

  it('⛔ leaves an unrelated host at the courtesy pause', async () => {
    const { observeAll } = await import('../scripts/verifySourceUrls.mjs');
    const rows = [
      { source_url: 'https://web.archive.org/web/1id_/https://a.gov/a.pdf' },
      { source_url: 'https://www.fremont.gov/home/showpublisheddocument/1/2' },
    ];
    const probeImpl = async (url) => (url.includes('archive.org')
      ? { url, status: 429, contentType: 'text/html', error: null }
      : { url, status: 200, contentType: 'application/pdf', error: null });
    const byUrl = new Map();
    await observeAll(rows, {
      probeImpl,
      sleepImpl: (ms) => Promise.resolve(byUrl.set(byUrl.size, ms)),
    });
    expect([...byUrl.values()].some((ms) => ms === 150)).toBe(true);
  });

  /**
   * ⚠⚠⚠ THE TWO PASSES MUST SHARE WHAT THEY LEARNED. The citation pass meets
   * web.archive.org 27 times and the base_url pass meets it again minutes
   * later; a fresh pacer per pass throws the lesson away and re-trips the
   * limiter from a standing start. The 2026-11-11 run failed in BOTH passes.
   */
  it('⭐ carries a host\'s pace from one pass into the next', async () => {
    const { observeAll } = await import('../scripts/verifySourceUrls.mjs');
    const limited = async (url) => ({ url, status: 429, contentType: 'text/html', error: null });
    const ok = async (url) => ({ url, status: 200, contentType: 'application/pdf', error: null });
    await observeAll([{ source_url: 'https://web.archive.org/web/1id_/https://a.gov/a.pdf' }],
      { probeImpl: limited, sleepImpl: () => Promise.resolve() });
    const waited = [];
    await observeAll([{ source_url: 'https://web.archive.org/web/9id_/https://z.gov/z.pdf' }],
      { probeImpl: ok, sleepImpl: (ms) => { waited.push(ms); return Promise.resolve(); } });
    expect(waited[0]).toBeGreaterThanOrEqual(5000);
  });
});
