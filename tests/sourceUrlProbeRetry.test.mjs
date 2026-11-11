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

  it('⛔ NEVER re-asks an HTTP answer — a 403 is stable and means something', async () => {
    // Bend, OR answers 403 to every client. Retrying it would treble this
    // gate's runtime against ~20 citations to learn nothing new.
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
