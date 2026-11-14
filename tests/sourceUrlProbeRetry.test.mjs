import { describe, it, expect } from 'vitest';
import { probeUrl } from '../scripts/lib/sourceUrlProbe.mjs';

/**
 * ⚠⚠⚠ THE GATE WAS STILL MEASURING ITSELF.
 *
 * #374 fixed the VERDICT for a host that refuses automated clients (429/403 →
 * `unreachable`, which is declarable). It did not fix the MEASUREMENT: a
 * connection that is never established still landed in "could not be asked",
 * so the gate's failure list moved between runs.
 *
 * Measured 2026-11-11 across the 27 web.archive.org citations: 22 live, 5
 * refused at the socket, a different five each run, all of them serving the
 * document seconds later. Three of the five predate #383.
 *
 * These pin the distinction that makes the retry safe: a refused SOCKET is
 * re-asked, an HTTP ANSWER never is.
 */

const noSleep = () => Promise.resolve();

function fetchThatFails(message, { succeedOnAttempt = Infinity } = {}) {
  const calls = { n: 0 };
  const impl = async () => {
    calls.n += 1;
    if (calls.n >= succeedOnAttempt) {
      return { status: 200, headers: { get: () => 'application/pdf' } };
    }
    throw new Error(message);
  };
  return { impl, calls };
}

describe('probeUrl retries a connection that was never made', () => {
  it('⭐ re-asks a refused socket and reports the recovery', async () => {
    // HEAD then GET per attempt, so attempt 2 begins at call 3.
    const { impl, calls } = fetchThatFails('Failed to connect to web.archive.org port 443',
      { succeedOnAttempt: 3 });
    const r = await probeUrl('https://web.archive.org/web/20250725223944id_/https://x.gov/a.pdf',
      { fetchImpl: impl, sleepImpl: noSleep });
    expect(r.status).toBe(200);
    expect(r.recoveredAfterRetry).toBe(true);
    expect(calls.n).toBeGreaterThan(2);
  });

  it('gives up after the bounded number of tries rather than hanging', async () => {
    const { impl } = fetchThatFails('ECONNREFUSED');
    const r = await probeUrl('https://web.archive.org/web/1id_/https://x.gov/a.pdf',
      { fetchImpl: impl, sleepImpl: noSleep, retries: 2 });
    expect(r.status).toBeNull();
    expect(r.error).toMatch(/ECONNREFUSED/);
    expect(r.recoveredAfterRetry).toBeUndefined();
  });

  /**
   * ⚠⚠ 429 IS NOT A REFUSAL — IT IS A REQUEST FOR SPACING.
   *
   * #374 moved web.archive.org's rate limiting out of `dead` and into
   * `unreachable` and stopped there. #383 took the Archive from 16 citations
   * to 27, and a run's burst now trips the limit: the gate asks 27 times in a
   * few seconds and is told to slow down 26 times, while a single curl to any
   * one of those URLs answers 200 in a couple of seconds.
   */
  it('⭐ BACKS OFF and re-asks on 429, because the server said to', async () => {
    let n = 0;
    const impl = async () => {
      n += 1;
      // ⚠ A 429 is returned by the HEAD itself (only a 403 falls through to
      // the one-byte GET), so each attempt is ONE call: initial + 3 retries.
      if (n >= 4) return { status: 200, headers: { get: () => 'application/pdf' } };
      return { status: 429, headers: { get: () => 'text/html' } };
    };
    const waited = [];
    const r = await probeUrl('https://web.archive.org/web/1id_/https://x.gov/a.pdf',
      { fetchImpl: impl, sleepImpl: (ms) => { waited.push(ms); return Promise.resolve(); } });
    expect(r.status).toBe(200);
    expect(r.recoveredAfterRetry).toBe(true);
    // and it waits LONGER than it would for a dropped socket
    expect(Math.min(...waited)).toBeGreaterThanOrEqual(10000);
  });

  it('⚠ still reports 429 when the publisher never relents', async () => {
    const impl = async () => ({ status: 429, headers: { get: () => 'text/html' } });
    const r = await probeUrl('https://web.archive.org/web/1id_/https://x.gov/a.pdf',
      { fetchImpl: impl, sleepImpl: () => Promise.resolve() });
    expect(r.status).toBe(429);
    expect(r.recoveredAfterRetry).toBeUndefined();
  });

  it('⛔ NEVER re-asks an HTTP answer — a 403 is stable and means something', async () => {
    // Bend, OR answered 403 to every client on 2026-11-12. Retrying it would
    // treble this gate's runtime against ~20 citations to learn nothing new.
    //
    // ⚠ The URL is a fixture, not a claim: `fetchImpl` supplies the 403, and
    // what this pins is that ONE HTTP answer ends the asking. Bend itself
    // relented on 2026-11-13 and its declarations were deleted — a host that
    // changes its mind must not quietly change what this test asserts.
    let n = 0;
    const impl = async () => { n += 1; return { status: 403, headers: { get: () => 'text/html' } }; };
    const r = await probeUrl('https://bendoregon.gov/wp-content/uploads/2025/12/x.pdf',
      { fetchImpl: impl, sleepImpl: noSleep });
    expect(r.status).toBe(403);
    expect(n).toBeLessThanOrEqual(2); // HEAD + GET of ONE attempt, no retry
  });

  it('⛔ NEVER re-asks a timeout — slow is not the same as refused', async () => {
    let n = 0;
    const impl = async () => { n += 1; throw new Error('no answer within 20000 ms'); };
    const r = await probeUrl('https://www.in.gov/comptroller/files/Entire_2013_CAFR.pdf',
      { fetchImpl: impl, sleepImpl: noSleep });
    expect(r.status).toBeNull();
    expect(n).toBeLessThanOrEqual(2);
  });

  it('⚠ an uncitable shape is still answered without touching the network', async () => {
    let n = 0;
    const impl = async () => { n += 1; throw new Error('Failed to connect'); };
    const r = await probeUrl('file://C:/treasury-tracker/docs/x.pdf',
      { fetchImpl: impl, sleepImpl: noSleep });
    expect(n).toBe(0);
    expect(r.error).toBeNull();
  });
});

/**
 * ⚠⚠⚠ A NAME THAT DID NOT RESOLVE IS NOT AN ANSWER EITHER — AND THE GATE
 * REPORTED ON ITSELF A FOURTH TIME BECAUSE OF IT.
 *
 * #373 called a down publisher dead. #374 called a rate limit a refusal. #376
 * let a HEAD condemn a document. Each time the gate measured its own trouble
 * and filed it under the publisher's name.
 *
 * Measured 2026-11-14, fleet run on cbb7164d: **23 citations failed in one
 * run**, every one of them `publications.iowa.gov`, every one of them
 * `curl: (6) Could not resolve host`. Minutes later, by hand:
 *
 *     FY09_cafr.pdf   206 application/pdf  connect 0.09s
 *     10_cafr.pdf     206 application/pdf  connect 0.06s
 *     2004CAFR.pdf    206 application/pdf  connect 0.06s
 *     2005CAFR.pdf    206 application/pdf  connect 0.08s
 *
 * The host was fine. The resolver on this machine blinked, and because
 * `CONNECTION_NEVER_MADE` carried `EAI_AGAIN` and `curl: (7)` but NOT
 * `ENOTFOUND` or `curl: (6)`, not one of the 23 was ever re-asked.
 *
 * ⭐ A retry cannot EXCUSE a host that is genuinely gone — the same logic as
 * "confirmation is not immunity" one rung up. A removed name fails all four
 * attempts and still lands on `unreachable`; the cost is three extra requests,
 * and only for a URL already on its way to being reported.
 */
describe('probeUrl retries a name that did not resolve', () => {
  it('⭐ re-asks node\'s ENOTFOUND and reports the recovery', async () => {
    const { impl, calls } = fetchThatFails(
      'getaddrinfo ENOTFOUND publications.iowa.gov', { succeedOnAttempt: 3 });
    const r = await probeUrl('https://publications.iowa.gov/10536/1/FY09_cafr.pdf',
      { fetchImpl: impl, sleepImpl: noSleep });
    expect(r.status).toBe(200);
    expect(r.recoveredAfterRetry).toBe(true);
    expect(calls.n).toBeGreaterThan(2);
  });

  it('⭐ re-asks curl exit 6, the exact error the 2026-11-14 run reported', async () => {
    const { impl, calls } = fetchThatFails(
      'curl: (6) Could not resolve host: publications.iowa.gov', { succeedOnAttempt: 3 });
    const r = await probeUrl('https://publications.iowa.gov/5516/1/2004CAFR.pdf',
      { fetchImpl: impl, sleepImpl: noSleep });
    expect(r.status).toBe(200);
    expect(r.recoveredAfterRetry).toBe(true);
    expect(calls.n).toBeGreaterThan(2);
  });

  it('⛔ CONFIRMATION IS NOT IMMUNITY — a name that is really gone still fails', async () => {
    // ⚠ This is the case the retry must NOT excuse. `ohioauditor.gov`'s apex
    // does not resolve at all (publisherOutages.mjs records curl exit 6), and
    // an outage is declared on evidence, never on a probe giving up quietly.
    const { impl } = fetchThatFails('curl: (6) Could not resolve host: ohioauditor.gov');
    const r = await probeUrl('https://ohioauditor.gov/some/report.pdf',
      { fetchImpl: impl, sleepImpl: noSleep, retries: 2 });
    expect(r.status).toBeNull();
    expect(r.error).toMatch(/Could not resolve host/);
    expect(r.recoveredAfterRetry).toBeUndefined();
  });
});
