/**
 * web.archive.org citations — asked the way the Archive offers to be asked.
 *
 * NO SHEBANG — library module; tests import it.
 *
 * ── ⛔⛔⛔ THE PLAYBACK PATH CANNOT BE PROBED, BY ANY CLIENT ────────────────
 *
 * `verify:source-urls` has now been wrong about this host three times, each
 * time by changing HOW it asked rather than WHAT it asked:
 *
 *   #374  re-bucketed the 429 from `dead` to `unreachable`   (right, partial)
 *   #385  waited and re-asked the URL                        (24 -> 16 429s)
 *   #387¹ paced the whole host adaptively                    (2,369s, 9 429s)
 *   #387² sent the refusal to curl                           (25 of 27)
 *
 * Measured 2026-11-12, after the paced run, on the citations that failed:
 *
 *   straight after an 862s run    curl 429 x3          node 429 x3
 *   after 3 min of silence        curl 206             DRAINED
 *   one node HEAD, then curl      node 429 -> curl 429  ⭐ ONE node request
 *                                                         re-arms it for curl
 *   240s of silence, curl only    429 429 429 429 429 206
 *
 * ⭐⭐ So the limiter is cumulative, IP-wide, and drains only on silence — and
 * the drain is NOT reliably three minutes. curl is not immune; it was simply
 * luckier in the small sample that produced #387's "fingerprint" headline. A
 * gate cannot be built on which client got lucky.
 *
 * ⚠ The fingerprint effect is real for mckinneytexas.org (403, curl let
 * straight through, reproduced many times) and `curlProbe` stays for it. It is
 * NOT what is happening here, and this module is the correction.
 *
 * ── ⭐⭐⭐ WHAT THE ARCHIVE ACTUALLY PUBLISHES ──────────────────────────────
 *
 * `https://archive.org/wayback/available?url=…&timestamp=…` is the endpoint
 * the Internet Archive documents for programmatic use. It answered **200 six
 * times in a row, instantly, from node**, for the very URL playback was
 * refusing. That is this repo's oldest rule — ASK WHAT THE API PUBLISHES, NOT
 * WHAT THE CLIENT RENDERS — reached one host later than it should have been.
 *
 * ── ⛔⛔ IT MAY ACQUIT. IT MAY NEVER CONVICT. ──────────────────────────────
 *
 * The caller falls through to the ordinary probe on anything but a clean
 * confirmation. A programmatic index saying "no" is a statement about the
 * index; only the playback path can say the citation itself is broken, and
 * `dead` orders a destructive edit.
 *
 * ── ⚠⚠⚠ AND THE TRAP THAT WOULD MAKE IT WORSE THAN USELESS ────────────────
 *
 * The endpoint answers with the CLOSEST capture, not the one asked for:
 *
 *   …FY_2021_…pdf @ 20220510215335  ->  closest 20220510215335   ✅ exact
 *   …FY_2021_…pdf @ 19990101000000  ->  closest 20220114200341   ⛔ a
 *                                        DIFFERENT capture, available: true
 *
 * A citation names ONE capture, and a neighbour is a different document at a
 * different moment. Accepting it would hand back a green verdict for a link
 * that no longer resolves — precisely the defect this gate exists to catch.
 * So the timestamp must match EXACTLY.
 */

/** `https://web.archive.org/web/<14 digits><modifier>/<original URL>` */
const CAPTURE = /^https?:\/\/web\.archive\.org\/web\/(\d{14})([a-z]{2}_)?\/(.+)$/i;

/**
 * Split a wayback citation into the three things the Archive needs.
 *
 * ⚠ `original` is kept BYTE-FOR-BYTE. New Hampshire's ACFR lives under
 * `FY%2021` — a percent-encoded space — and re-encoding or decoding it here
 * would ask the API about a document that does not exist.
 *
 * Returns `null` for anything that is not a capture, including
 * `web.archive.org` URLs that are not playback (the gate then probes them
 * normally, which is the correct conservative default).
 */
export function parseWaybackCitation(url) {
  if (typeof url !== 'string') return null;
  const m = CAPTURE.exec(url.trim());
  if (!m) return null;
  return { timestamp: m[1], modifier: m[2] || '', original: m[3] };
}

/** The documented availability endpoint, asked about ONE exact capture. */
export function availabilityApiUrl({ timestamp, original } = {}) {
  return 'https://archive.org/wayback/available'
    + `?url=${encodeURIComponent(original)}&timestamp=${encodeURIComponent(timestamp)}`;
}

/**
 * Did the Archive confirm THE CAPTURE THIS CITATION NAMES?
 *
 * ⚠ Never throws: a malformed payload is "not confirmed", and the caller then
 * falls through to the ordinary probe.
 */
export function judgeAvailability(parsed, payload) {
  if (!parsed || typeof parsed.timestamp !== 'string') {
    return { confirmed: false, reason: 'not a wayback capture' };
  }
  const closest = payload && typeof payload === 'object'
    ? payload.archived_snapshots?.closest
    : null;
  if (!closest || typeof closest !== 'object') {
    return { confirmed: false, reason: 'the Archive holds no snapshot of this URL' };
  }
  if (closest.available !== true) {
    return { confirmed: false, reason: 'the Archive reports the snapshot as unavailable' };
  }
  if (closest.timestamp !== parsed.timestamp) {
    return {
      confirmed: false,
      reason: `the Archive offered a DIFFERENT capture (${closest.timestamp}) than the one cited `
        + `(${parsed.timestamp}) — a neighbouring capture is not this citation`,
    };
  }
  const archivedStatus = Number(closest.status);
  if (!Number.isFinite(archivedStatus) || archivedStatus < 200 || archivedStatus >= 300) {
    return {
      confirmed: false,
      reason: `the capture exists but archived HTTP ${closest.status} — a snapshot of an error page `
        + 'is not a citation',
    };
  }
  return { confirmed: true, archivedStatus, reason: `the Archive confirms capture ${parsed.timestamp}` };
}

/**
 * Ask the live endpoint about one capture.
 *
 * ⚠ `fetchImpl` is injected so every test in this repo stays offline.
 */
export async function askWaybackAvailability(parsed, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  if (!parsed) return { confirmed: false, reason: 'not a wayback capture' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(availabilityApiUrl(parsed), { signal: ac.signal, redirect: 'follow' });
    if (!res.ok) return { confirmed: false, reason: `the availability endpoint answered HTTP ${res.status}` };
    return judgeAvailability(parsed, await res.json());
  } catch (e) {
    return { confirmed: false, reason: `the availability endpoint could not be asked: ${e.message}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ⭐⭐⭐ THE CDX INDEX — the Archive's canonical answer, and a better one.
 *
 * ⚠⚠⚠ MEASURED 2026-11-12, AND IT IS WHY THIS EXISTS: `/wayback/available`
 * answered `archived_snapshots: {}` — "the Archive holds no snapshot of this
 * URL" — TWENTY TIMES RUNNING for a capture it had confirmed twenty minutes
 * earlier, and that playback itself serves. Not random flake: 20/20 empty for
 * one URL while its neighbour was 20/20 confirmed in the same breath. That
 * false negative failed the fleet run at 2,045 of 2,047.
 *
 * CDX answers the same question keyed to an EXACT timestamp range rather than
 * to a "closest" guess, and answers it with more: the archived status code AND
 * the archived mimetype. 5/5 in 135–335 ms immediately after a heavy run.
 *
 * ⛔⛔ IT STILL MAY NEVER CONVICT. An index that can invent a "no" can invent a
 * wrong mimetype too — see `sourceUrlProbe.mjs`, where a row that fails the
 * citation's promised type falls through to a real fetch instead of condemning
 * it.
 *
 * ── ⚠⚠⚠ TWO WAYS A CDX QUERY LIES BY RETURNING NOTHING ────────────────────
 *
 * Neither affects `cdxApiUrl` below, which asks for ONE exact URL. Both bite
 * the moment somebody asks "is this directory archived at all?", which is
 * exactly what the 2026-11-13 Ohio fallback check needed.
 *
 *   1. ⛔ **`url=path/*` SILENTLY RETURNS `[]`.** The documented wildcard does
 *      not work here. Measured on the same path in the same minute:
 *        url=ohioauditor.gov/references/*                 → 0 rows
 *        url=ohioauditor.gov/references/ + matchType=prefix → 40 rows
 *      Use `matchType=prefix` with NO asterisk. Every zero collected the other
 *      way is an artifact, and it reads exactly like "nothing is archived".
 *
 *   2. ⛔ **AN OVERLOADED ARCHIVE SERVES HTML, NOT JSON.** `Temporarily
 *      Offline` comes back with the same 200 a real answer has, and a parser
 *      counting JSON rows scores it zero. Check the body before trusting a
 *      count, and retry rather than record it.
 *
 * ⭐ And prove the instrument before believing any negative: ask for something
 * known to be archived on the SAME code path. A control that returns rows is
 * what separates "the Archive does not have it" from "I asked wrong".
 */
export function cdxApiUrl({ timestamp, original } = {}) {
  return 'https://web.archive.org/cdx/search/cdx'
    + `?url=${encodeURIComponent(original)}`
    + `&output=json&from=${encodeURIComponent(timestamp)}&to=${encodeURIComponent(timestamp)}&limit=20`;
}

/**
 * Judge a CDX response against the capture that was cited.
 *
 * ⚠ Columns are read BY NAME. The Archive is free to reorder or extend its own
 * output, and a fixed index would then read a digest as a status code.
 */
export function judgeCdx(parsed, payload) {
  if (!parsed || typeof parsed.timestamp !== 'string') {
    return { confirmed: false, reason: 'not a wayback capture' };
  }
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) {
    return { confirmed: false, reason: 'the index holds no row for this URL' };
  }
  const [header, ...rows] = payload;
  const col = (name) => header.findIndex((h) => String(h).toLowerCase() === name);
  const iTs = col('timestamp');
  const iStatus = col('statuscode');
  const iMime = col('mimetype');
  if (iTs < 0) return { confirmed: false, reason: 'the index response states no timestamp column' };

  let neighbour = null;
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const ts = String(r[iTs] ?? '');
    // ⚠⚠ THE SAME TRAP THE AVAILABILITY PATH HAS. A citation names ONE
    // capture; a row for the one beside it is a different document.
    if (ts !== parsed.timestamp) { if (!neighbour) neighbour = ts; continue; }

    const raw = iStatus >= 0 ? String(r[iStatus] ?? '') : '';
    const status = Number(raw);
    if (!Number.isFinite(status) || status < 200 || status >= 300) {
      return {
        confirmed: false,
        reason: raw === '-'
          // A revisit says "the same bytes as some other capture" and states no
          // status of its own. That is not this citation answering.
          ? 'the index row is a REVISIT and states no status of its own'
          : `the capture exists but archived HTTP ${raw} — a snapshot of an error page is not a citation`,
      };
    }
    return {
      confirmed: true,
      archivedStatus: status,
      archivedMime: iMime >= 0 ? String(r[iMime] ?? '') : '',
      reason: `the CDX index confirms capture ${parsed.timestamp}`,
    };
  }
  return {
    confirmed: false,
    reason: neighbour
      ? `the index offered a DIFFERENT capture (${neighbour}) than the one cited `
        + `(${parsed.timestamp}) — a neighbouring capture is not this citation`
      : 'the index holds no row for this capture',
  };
}

/** Ask the CDX index. Never throws: it is a courtesy, never a dependency. */
export async function askWaybackCdx(parsed, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  if (!parsed) return { confirmed: false, reason: 'not a wayback capture' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(cdxApiUrl(parsed), {
      signal: ac.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res || res.ok !== true) {
      return { confirmed: false, reason: `the CDX index answered HTTP ${res ? res.status : '?'}` };
    }
    return judgeCdx(parsed, await res.json());
  } catch (e) {
    return { confirmed: false, reason: `the CDX index could not be asked: ${e.message}` };
  } finally {
    clearTimeout(timer);
  }
}
