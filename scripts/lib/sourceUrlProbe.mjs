/**
 * `budgets.source_url` — the one claim on a TT page that nothing has ever
 * checked.
 *
 * NO SHEBANG — library module; tests import it.
 *
 * ── ⚠⚠⚠ THE BLIND SPOT THIS CLOSES ─────────────────────────────────────────
 *
 * Every guard this repo runs on a load reads MONEY or IDENTITY: the tie gate
 * (components vs printed total), the fiscal-year assertion, the per-capita
 * guard, the sanity ceiling, the churn gate, the frozen invariant, the scope
 * sweep. NOT ONE OF THEM READS A URL.
 *
 * So in 2026-10 the Federal Audit Clearinghouse's `/dissemination/report/pdf/`
 * endpoint answered with a 302 to a presigned S3 object carrying
 * `X-Amz-Expires=30` — THIRTY SECONDS — `fetchAkBoroughs.mjs` recorded
 * `res.url` (the repo's usual and usually-correct "cite what served the bytes"
 * rule), and 227 Alaska rows shipped a link that was dead before the load that
 * wrote it had finished. Every figure on those pages was right. Every gate was
 * green. The only broken thing was the citation, and a citation is the whole
 * basis on which a reader is asked to believe the figure.
 *
 * `facCitable.assertCitable()` closed that at the point the manifest is
 * written, for FAC. This module asks the general question, of the whole fleet,
 * against the live web: ⭐ **IS THE LINK UNDER THE CHART STILL A LINK?**
 *
 * ── ⭐⭐ WHAT "ASK THE PUBLISHER" MEANS HERE ────────────────────────────────
 *
 * It means the host, and nothing else. There is no stored copy to compare
 * against, no baseline that could be right while the web is wrong. A citation
 * either resolves today or it does not, and only the host can say. That makes
 * this the purest form of the rule the rest of the gates follow — see
 * [[reference_xlsx_row_coverage_gate]] and `outOfPeriodPublisher.mjs`.
 *
 * ── ⚠⚠ A 200 IS NOT PROOF ──────────────────────────────────────────────────
 *
 * `xlsxRows.downloadXLSX` already learned this the hard way: "a block page
 * served 200 text/html is precisely what lies about its type". A WAF block
 * page, a login wall and a themed 404 all arrive as `200 text/html`. So when
 * the URL itself promises a document — it ends `.pdf`, `.xlsx`, `.csv` — and
 * the host answers with HTML, that is a FAILURE, not a pass. A URL with no
 * document extension promises nothing, so nothing is asserted about its type.
 */

import { parseWaybackCitation } from './waybackCitation.mjs';

/** Verdicts, worst first. The gate's exit code is decided from these. */
export const VERDICTS = ['uncitable', 'dead', 'wrong-type', 'unreachable', 'ok'];

/**
 * ⚠ The query parameters that make a URL EXPIRE. A link carrying one of these
 * is not a citation at all — it is a receipt for one download — so this is the
 * one verdict that may NEVER be declared away in the exceptions file.
 *
 * `X-Amz-*` is the FAC/S3 case that cost 227 rows. The others are the same
 * shape from other object stores and CDNs, added because the defect is a
 * property of presigned URLs in general, not of Amazon.
 */
const EXPIRING_PARAMS = [
  /[?&]X-Amz-(Expires|Signature|Credential)=/i, // AWS S3 presigned (the FAC defect)
  /[?&]X-Goog-(Expires|Signature|Credential)=/i, // Google Cloud Storage presigned
  /[?&](sig|sv|se)=[^&]*&?.*[?&]sp=/i, // Azure Blob SAS (needs sig + sp together)
  /[?&](Expires|expiry|expires_at)=\d{9,}/i, // a bare unix-timestamp expiry
  /[?&]token=[A-Za-z0-9._-]{20,}/i, // a long opaque session/download token
];

/**
 * Structural verdict, reached WITHOUT a network call.
 *
 * ⭐ This runs first and is final: a presigned link that happens to still
 * resolve while we probe it is still uncitable, because it will not resolve
 * for the reader. Liveness cannot rescue it, so we do not even ask.
 */
export function citationShape(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return { citable: false, reason: 'empty' };
  }
  if (url !== url.trim()) {
    return { citable: false, reason: 'surrounding whitespace — the stored value is not exactly a URL' };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { citable: false, reason: `not an http(s) URL: ${truncate(url)}` };
  }
  for (const re of EXPIRING_PARAMS) {
    if (re.test(url)) {
      return {
        citable: false,
        reason: 'a PRESIGNED, EXPIRING link — it is a receipt for one download, not a citation. '
          + 'Record the URL that was REQUESTED, not the object it redirects to.',
      };
    }
  }
  let host;
  try {
    host = new URL(url).hostname;
  } catch (e) {
    return { citable: false, reason: `unparseable as a URL: ${e.message}` };
  }
  if (/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/i.test(host) || /\.local$/i.test(host)) {
    return { citable: false, reason: `a host only this machine can reach: ${host}` };
  }
  return { citable: true, reason: null, host };
}

/**
 * What the URL itself promises it will serve.
 *
 * ⚠ Extension-less is `null`, NOT "html". FAC's `/report/pdf/<uuid>` serves a
 * PDF with no extension anywhere in the path, and plenty of portals serve a
 * document from a query string. Asserting a type we were never promised would
 * invent failures; asserting nothing is the honest default.
 */
export function promisedType(url) {
  let pathname;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  if (/\.pdf$/.test(pathname)) return 'pdf';
  if (/\.(xlsx|xls|xlsm)$/.test(pathname)) return 'spreadsheet';
  if (/\.csv$/.test(pathname)) return 'csv';
  if (/\.(json|geojson)$/.test(pathname)) return 'json';
  if (/\.zip$/.test(pathname)) return 'zip';
  return null;
}

/** Does a served content-type satisfy what the URL promised? */
export function typeSatisfies(promised, contentType) {
  if (!promised) return true; // promised nothing, so nothing to break
  const ct = String(contentType || '').toLowerCase();
  if (ct === '') return true; // ⚠ silence is not a lie; some hosts send no type on HEAD
  switch (promised) {
    case 'pdf': return ct.includes('pdf') || ct.includes('octet-stream');
    case 'spreadsheet': return ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('octet-stream');
    case 'csv': return ct.includes('csv') || ct.includes('text/plain') || ct.includes('octet-stream');
    case 'json': return ct.includes('json') || ct.includes('text/plain');
    case 'zip': return ct.includes('zip') || ct.includes('octet-stream');
    default: return true;
  }
}

/**
 * Turn one probe result into a verdict.
 *
 * ⚠⚠ `unreachable` IS NOT A PASS. A host that refused to answer has told us
 * nothing, and "we could not check" must never be recorded as "we checked and
 * it was fine" — the shape this project keeps rediscovering (see
 * `out_of_period_watchdog.sql`'s `evaluated = 0` clause, and #363's
 * publisher-could-not-be-asked FAIL).
 */
export function judgeProbe({ url, status, contentType, error }) {
  const shape = citationShape(url);
  if (!shape.citable) return { verdict: 'uncitable', detail: shape.reason };

  if (error) {
    return { verdict: 'unreachable', detail: error };
  }
  if (typeof status !== 'number') {
    return { verdict: 'unreachable', detail: 'no status was recorded' };
  }
  // ⚠⚠⚠ ONLY THE PUBLISHER'S "IT IS GONE" MAY BE `dead`.
  //
  // `dead` carries exactly one instruction — REPAIR THE URL, do not annotate
  // it — so the bar for it is a statement ABOUT THE DOCUMENT. HTTP has two:
  // 404 Not Found and 410 Gone. Everything else in 4xx/5xx is a statement
  // about the REQUEST or the SERVER, and obeying `dead` on one of those means
  // rewriting a citation that was never broken.
  //
  // ⭐ This shipped as `status >= 400` and it was wrong in the same way #373
  // was wrong about Ohio: a publisher that cannot answer right now is not a
  // document that is gone. The symptom was a backlog that would not hold
  // still — three consecutive fleet runs reported 102, then 77, then 79 dead,
  // because nine web.archive.org citations were being RATE LIMITED (429) and
  // twenty more hosts answer automated clients with 403. A gate whose repair
  // list changes between runs is measuring itself, not the publishers.
  //
  // `unreachable` is the honest bucket and is already declarable, precisely
  // because a person with a browser can still click one of these.
  if (status === 404 || status === 410) {
    return { verdict: 'dead', detail: `HTTP ${status}` };
  }
  if (status >= 400) {
    return {
      verdict: 'unreachable',
      detail: `HTTP ${status} — the server refused or failed the request; `
        + 'it did not say the document is gone',
    };
  }
  if (status >= 300) {
    // ⚠ Only reachable if the caller did NOT follow redirects. Following is
    // the default, so a 3xx here means the chain could not be resolved.
    return { verdict: 'unreachable', detail: `HTTP ${status} and the redirect was not followed` };
  }
  const promised = promisedType(url);
  if (!typeSatisfies(promised, contentType)) {
    return {
      verdict: 'wrong-type',
      detail: `the URL ends .${promised === 'spreadsheet' ? 'xlsx' : promised} but the host served `
        + `"${contentType}" — a block page, a login wall or a themed 404 all arrive as 200 text/html`,
    };
  }
  return { verdict: 'ok', detail: `HTTP ${status}${contentType ? ` ${contentType}` : ''}` };
}

/**
 * Ask one host about one URL.
 *
 * ⚠ HEAD FIRST, THEN A ONE-BYTE GET. Plenty of government servers answer HEAD
 * with 405, 501 — or, on CivicPlus, a flat 404 — while serving the same URL
 * happily to a GET; treating that as dead would invent failures across whole
 * families at once. The fallback asks for `bytes=0-0` so a 300 MB ACFR is not
 * downloaded to prove it exists.
 *
 * ⚠⚠⚠ SO A HEAD MAY NOT CONDEMN A DOCUMENT BY ITSELF — a 404 or 410 from HEAD
 * is re-asked with a GET before it is believed. See NEEDS_A_SECOND_OPINION
 * below for what it cost to learn that.
 *
 * ⚠⚠ AND THEN curl. mckinneytexas.org answers Node with a flat 403 — not for
 * want of headers: the identical User-Agent, Sec-Fetch trio, Referer and
 * Accept all still 403 from `fetch()` while curl is let straight through, so it
 * is the TLS/client fingerprint being matched. `xlsxRows.downloadXLSX` already
 * falls back this way, and a gate that called McKinney's own citation dead
 * would be reporting on Node, not on McKinney.
 */
/**
 * ⚠⚠⚠ A CONNECTION THAT WAS NEVER ESTABLISHED IS NOT AN ANSWER.
 *
 * These are the errors where the host never got to say anything: the socket
 * was refused, reset, or never opened. They are categorically different from
 * `HTTP 403`, which IS an answer — a refusal, but a stable one that says the
 * same thing on every run.
 *
 * ⛔ Deliberately NOT in here: timeouts. A host that is merely slow (Indiana
 * Gateway takes 25s and sometimes loses) would double this gate's worst-case
 * runtime for no gain in truth, and a timeout at least means something
 * answered the SYN.
 */
const CONNECTION_NEVER_MADE = /Failed to connect|Connection refused|ECONNREFUSED|ECONNRESET|socket hang up|EAI_AGAIN|Could not connect to server|curl: \(3[56]\)|curl: \(7\)/i;

/**
 * ⭐⭐ WHY THIS RETRIES, AND WHY ONLY THIS CASE.
 *
 * #374 found the gate's repair list moving between runs — 102, then 77, then
 * 79 dead — and named the rule: "a gate whose repair list changes between runs
 * is measuring itself, not the publishers." It fixed the verdict (429 and 403
 * became `unreachable`); it did not fix the measurement.
 *
 * It is still moving. Measured 2026-11-11 over the 27 web.archive.org
 * citations: 22 live and 5 refused at the socket, a DIFFERENT five each run,
 * and every one of them served the document on a retry seconds later. Three of
 * those five are citations that predate this change. So the failure is the
 * Archive blinking under load, not a statement about any URL — and reporting
 * it as "could not be asked" asks a human to investigate the gate's own luck.
 *
 * ⚠ THE BUDGET IS SET FROM THE MEASURED RATE, NOT FROM WHATEVER MADE ONE RUN
 * GREEN. Refusals ran at about 5 in 27 (~18%) per attempt and are independent
 * — the New Hampshire citation that survived two retries answered 206 on five
 * consecutive hand probes a minute later. Four attempts puts the per-URL odds
 * near 0.1% and the odds of ANY of the 27 failing near 3%, against ~15% at two
 * retries. ⛔ It does not make the gate deterministic, and nothing here should
 * be read as claiming that; it makes a flake rare enough to be worth
 * investigating when it happens.
 */
export async function probeUrl(url, options = {}) {
  const { retries = 3, retryDelayMs = 1500, sleepImpl = null } = options;
  let out = await probeOnce(url, options);
  for (let i = 0; i < retries; i += 1) {
    const refusedSocket = out.status === null && out.error && CONNECTION_NEVER_MADE.test(out.error);
    // ⚠⚠ 429 IS THE SERVER TELLING US WHAT TO DO, AND WE WERE NOT LISTENING.
    //
    // #374 re-bucketed web.archive.org's rate limiting from `dead` to
    // `unreachable` and left it there — "nine web.archive.org citations were
    // being RATE LIMITED (429)". That stopped it corrupting the dead list; it
    // never stopped it happening.
    //
    // #383 took the Archive from 16 citations to 27, which pushes a run's
    // burst past the limit: the gate asks 27 times in a few seconds and is
    // told to slow down 26 times, while a single curl to any one of those URLs
    // answers 200 in a couple of seconds. A 429 is not a refusal and not an
    // outage — it is a request for spacing, and the honest response is to wait
    // longer and ask again rather than to report the citation as unaskable.
    const rateLimited = out.status === 429;
    if (!refusedSocket && !rateLimited) break;
    // A rate limit needs real spacing, not the courtesy pause a dropped socket
    // wants — the Archive's own guidance is measured in tens of seconds.
    const base = rateLimited ? Math.max(retryDelayMs, 5000) : retryDelayMs;
    const wait = base * (i + 1) * (rateLimited ? 2 : 1);
    await (sleepImpl ? sleepImpl(wait) : new Promise((r) => { setTimeout(r, wait); }));
    out = await probeOnce(url, options);
    if (out.status !== null && out.status !== 429) out = { ...out, recoveredAfterRetry: true };
  }
  return out;
}

/**
 * ⭐⭐⭐ A RATE LIMIT IS A PROPERTY OF THE HOST. THE BACKOFF WAS A PROPERTY OF
 * ONE URL, AND THAT IS WHY #385 ONLY HALF-WORKED.
 *
 * The 2026-11-11 fleet run measured it: web.archive.org 429s fell from 24 to
 * 16 and stopped. `probeUrl` waits and re-asks, which is right for the URL in
 * hand and useless for the twenty-six behind it — each one discovered the
 * limit privately, spent three retries inside it (three MORE requests into a
 * limiter, which deepens it), and handed back to a loop that waited 150 ms and
 * asked about the next. That is not a backoff, it is twenty-seven bursts.
 *
 * ⚠⚠ PROBED BY HAND, AND THE SHAPE DECIDES THE DESIGN. The Archive served
 * twelve rapid requests for one URL, dropped the thirteenth connection
 * outright, and then refused eight DISTINCT archive URLs in a row. The limiter
 * is cumulative, host-wide, and once tripped it STOPS ANSWERING rather than
 * saying 429 — so a pacer that watched only for the status code would speed
 * back up at the exact moment it must not.
 *
 * ⛔ It is deliberately NOT a global rate limit. 128 of 129 hosts never
 * complain, and slowing them to protect one would add hours to a 23-minute run
 * to fix a problem they do not have.
 */
export function createHostPacer({
  basePauseMs = 150,
  limitFloorMs = 5_000,
  maxPauseMs = 60_000,
  easeAfter = 10,
} = {}) {
  const state = new Map();
  const get = (host) => state.get(host) ?? { pauseMs: basePauseMs, limited: false, calm: 0 };
  const widen = (from, stated) => Math.min(
    maxPauseMs,
    Number.isFinite(stated) && stated > 0 ? stated : Math.max(limitFloorMs, from * 2),
  );

  return {
    pauseFor: (host) => get(host).pauseMs,
    record(host, probe = {}) {
      const s = { ...get(host) };
      const rateLimited = probe.status === 429;
      const refused = probe.status === null && Boolean(probe.error);
      if (rateLimited) {
        s.limited = true;
        s.calm = 0;
        s.pauseMs = widen(s.pauseMs, probe.retryAfterMs);
      } else if (s.limited && refused) {
        // Silence from a host that has already said 429 is the same message.
        s.calm = 0;
        s.pauseMs = widen(s.pauseMs);
      } else if (s.limited) {
        // ⚠ Ease back rather than snapping to base: the run is long and the
        // limit is cumulative, so one good answer proves very little.
        s.calm += 1;
        if (s.calm >= easeAfter) {
          s.calm = 0;
          s.pauseMs = Math.max(basePauseMs, Math.round(s.pauseMs / 2));
        }
      }
      state.set(host, s);
    },
  };
}

async function probeOnce(url, {
  fetchImpl = fetch, curlImpl = null, waybackImpl = null, cdxImpl = null, timeoutMs = 20_000,
} = {}) {
  const shape = citationShape(url);
  if (!shape.citable) return { url, status: null, contentType: null, error: null };

  const attempt = async (method, extraHeaders) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method,
        redirect: 'follow',
        signal: ac.signal,
        headers: { ...BROWSER_HEADERS, ...extraHeaders },
      });
      const seen = { status: res.status, contentType: res.headers.get('content-type') || '' };
      // ⚠ A server that states how long to wait has told us more than our own
      // guess can. Seconds only: the HTTP-date form is legal and nothing we
      // ask has ever sent one, and a header we cannot parse must leave the
      // pause alone rather than poison it with NaN.
      if (res.status === 429) {
        const stated = Number(res.headers.get('retry-after'));
        if (Number.isFinite(stated) && stated > 0) seen.retryAfterMs = stated * 1000;
      }
      return seen;
    } finally {
      clearTimeout(timer);
    }
  };

  // ⚠⚠⚠ A HEAD IS NEVER ALLOWED TO CONDEMN A DOCUMENT ON ITS OWN.
  //
  // HEAD asks about the METHOD; only the method that actually fetches
  // documents can tell us the document is gone. So 404 and 410 — the two
  // statuses that produce `dead`, the one verdict that orders a destructive
  // edit — must be CONFIRMED by a GET before we believe them.
  //
  // ⭐ This shipped as `405, 501, 403` and it was wrong in the same way #373
  // was wrong about Ohio and #374 about web.archive.org, one rung lower down
  // the ladder. The comment above already had the right idea — "plenty of
  // government servers answer HEAD with 405 while serving the same URL happily
  // to a GET" — but enumerated the refusals it had happened to meet. CivicPlus
  // DocumentCenter is exactly that case and says 404:
  //
  //   corneliusor.gov/DocumentCenter/View/1301/…FY2024-PDF
  //       HEAD → 404 text/html        GET → 200 application/pdf, 1,781,772 B
  //
  // The gate called that document dead and demanded we rewrite a citation that
  // was never broken. CivicPlus runs a large share of US municipal sites, so
  // this is the "invent failures across whole families at once" the comment
  // above warns about, realised.
  //
  // ⚠ Confirming costs one extra request, and ONLY for a URL we are otherwise
  // about to declare dead. A document that really is gone answers 404 to the
  // GET as well and still lands on `dead` — see the test named
  // "confirmation is not immunity".
  // ⛔⛔⛔ 429 IS IN THIS SET BECAUSE IT IS NOT A RATE LIMIT. Measured
  // 2026-11-11 on the same URL in the same minute: curl answered 200/206 four
  // times running while Node fetch answered 429 four times running.
  // web.archive.org is matching Node's fingerprint, exactly as
  // mckinneytexas.org does with a 403. Returning early here is what kept a
  // refusal away from the curl fallback that already existed for this case.
  const NEEDS_A_SECOND_OPINION = new Set([403, 404, 405, 410, 429, 501]);
  /** Statuses that mean "this client is not welcome" — try curl before believing them. */
  const FINGERPRINT_REFUSALS = new Set([403, 429]);

  let last = null;
  try {
    last = await attempt('HEAD', {});
    if (!NEEDS_A_SECOND_OPINION.has(last.status)) {
      return { url, ...last, error: null };
    }
  } catch (e) {
    last = null;
    if (e.name === 'AbortError') last = { timedOut: true };
  }

  // HEAD was refused or unsupported — ask for a single byte instead.
  try {
    const got = await attempt('GET', { Range: 'bytes=0-0' });
    if (!FINGERPRINT_REFUSALS.has(got.status)) return { url, ...got, error: null };
    last = got;
  } catch (e) {
    if (!last) last = { error: e.message };
  }

  // ⭐⭐⭐ STILL REFUSED — AND IF THIS IS A WAYBACK CAPTURE, ASK THE ARCHIVE
  // THE WAY THE ARCHIVE OFFERS TO BE ASKED.
  //
  // This goes BEFORE curl deliberately. Measured 2026-11-12: curl does not
  // rescue web.archive.org (five 429s in six, cold, after 240s of silence),
  // and every extra playback request re-arms a limiter that drains only on
  // silence — one node HEAD was enough to re-arm it against curl. So for this
  // host curl is not a second opinion, it is a third request into the thing
  // that is refusing us. See scripts/lib/waybackCitation.mjs for the full
  // measurement, and for why the timestamp must match EXACTLY.
  //
  // ⛔⛔ IT MAY ACQUIT, IT MAY NEVER CONVICT: anything short of a clean
  // confirmation falls through and the refusal stands exactly as it was.
  const capture = (cdxImpl || waybackImpl) ? parseWaybackCitation(url) : null;

  // ⭐ CDX FIRST. It answers on an EXACT timestamp range rather than a
  // "closest" guess, and it states the archived status AND mimetype — so
  // unlike the availability endpoint it can satisfy the type promise too.
  //
  // ⛔⛔ AND IT MAY STILL NEVER CONVICT. Measured 2026-11-12: the availability
  // endpoint returned "no snapshot" 20/20 for a capture that exists, so these
  // indexes demonstrably invent a "no". One that can invent a "no" can invent
  // a wrong mimetype, and `wrong-type` orders a repair. A row that fails the
  // promised type therefore falls THROUGH to a real fetch rather than
  // condemning the citation on an index's word.
  if (capture && cdxImpl) {
    try {
      const verdict = await cdxImpl(capture);
      if (verdict && verdict.confirmed
          && typeSatisfies(promisedType(url), verdict.archivedMime || '')) {
        return {
          url,
          status: verdict.archivedStatus,
          contentType: verdict.archivedMime || '',
          error: null,
          viaWayback: true,
          viaCdx: true,
        };
      }
    } catch { /* the index is a courtesy, never a dependency */ }
  }

  if (waybackImpl) {
    if (capture) {
      try {
        const verdict = await waybackImpl(capture);
        if (verdict && verdict.confirmed) {
          // ⚠ No content type is claimed. The availability endpoint does not
          // serve the bytes, so it cannot speak to them — and `typeSatisfies`
          // already treats silence as silence rather than as a lie.
          return {
            url, status: verdict.archivedStatus, contentType: '', error: null, viaWayback: true,
          };
        }
      } catch { /* the endpoint is a courtesy, never a dependency */ }
    }
  }

  // Still refused. If this host blocks Node's fingerprint, curl gets through.
  if (curlImpl) {
    try {
      const viaCurl = await curlImpl(url);
      if (viaCurl && typeof viaCurl.status === 'number') {
        return { url, status: viaCurl.status, contentType: viaCurl.contentType || '', error: null, viaCurl: true };
      }
    } catch (e) {
      return { url, status: null, contentType: null, error: `curl also failed: ${e.message}` };
    }
  }

  if (last && typeof last.status === 'number') {
    const out = { url, status: last.status, contentType: last.contentType || '', error: null };
    // ⚠ Carried to the end: a 429 now falls through to the curl fallback, and
    // the host pacer still wants what the server said if curl cannot help.
    if (last.retryAfterMs) out.retryAfterMs = last.retryAfterMs;
    return out;
  }
  if (last && last.timedOut) return { url, status: null, contentType: null, error: `no answer within ${timeoutMs} ms` };
  return { url, status: null, contentType: null, error: (last && last.error) || 'the host did not answer' };
}

/** Copied from `xlsxRows.mjs` — the same hosts refuse the same bare client. */
export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Sort observations into the buckets the gate reports and exits on.
 *
 * `declared` is the exceptions list — URLs a human has looked at and recorded a
 * reason for. ⚠ It can excuse `unreachable` only. It can NEVER excuse
 * `uncitable` (the link cannot work for a reader, whatever we write about it)
 * and it can never excuse `dead` (a 404 is the publisher saying the document is
 * gone; the answer is to repair the URL, not to annotate it).
 */
export function classifyCitations(observations, declared = [], outages = [], asOf = new Date()) {
  const byUrl = new Map(declared.map((d) => [d.url, d]));
  const matched = new Set();

  const out = {
    ok: [], dead: [], wrongType: [], unreachable: [], uncitable: [], confirmed: [], stale: [],
    publisherDown: [], expiredOutages: [], staleOutages: [],
  };

  // ── ⭐⭐ A PUBLISHER OUTAGE IS NOT A DEAD DOCUMENT ────────────────────────
  //
  // Ohio's Auditor of State took its web server offline on 2026-10-25 after a
  // cyberattack. Every report path has 404'd since — including files that were
  // fetched successfully before — while the root serves the office's own
  // "Website Temporarily Unavailable" notice and the apex domain stops
  // resolving entirely.
  //
  // ⚠⚠⚠ THIS GATE READ ALL 60 OF THOSE AS `dead`, WHICH SAYS "the publisher
  // says this document is gone — repair the URL". Acting on that would have
  // been wrong in the most expensive way available: rewriting 6,616 correct
  // citations to point somewhere else, during an outage, with no live file to
  // check any replacement against. The verdict demanded a repair that would
  // have damaged the data.
  //
  // ⭐ The distinction is MEASURABLE, not rhetorical. Of the twenty hosts
  // holding a dead citation, `cg.sc.gov` answers its root with a working site
  // ("Home | Comptroller General") while 24 of its documents 404 — those
  // documents really did move. Ohio answers its root with a notice saying it is
  // down. Same 404, opposite meaning.
  //
  // ── ⚠⚠ WHAT MAY AND MAY NOT BE DECLARED ─────────────────────────────────
  //
  // An outage is the ONE thing that can excuse a `dead` verdict, and it is
  // fenced three ways so it cannot become the annotation `dead` was forbidden
  // to have:
  //
  //   1. ⚠ IT EXPIRES. `recheckAfter` is mandatory. A declaration that never
  //      expires is a permanent excuse, which is precisely what "repair the
  //      URL, do not annotate it" exists to prevent. Past that date the gate
  //      FAILS until a person looks again.
  //   2. ⚠⚠ EVERY CITATION ON THE HOST MUST STILL FAIL. If even one resolves,
  //      the publisher is serving files again and the rest are genuinely gone —
  //      the declaration is stale and the gate says so.
  //   3. ⛔ IT CANNOT EXCUSE `uncitable`. An expiring link is broken by its own
  //      shape; no outage makes it citable.
  const outageFor = new Map(outages.map((o) => [o.host, o]));
  const hostRows = new Map();
  for (const obs of observations) {
    const host = citationShape(obs.url).host || '(unparseable)';
    if (!hostRows.has(host)) hostRows.set(host, []);
    hostRows.get(host).push(obs);
  }

  /** Hosts whose outage declaration is live AND still describes reality. */
  const downHosts = new Set();
  const now = asOf instanceof Date ? asOf : new Date(asOf);
  for (const o of outages) {
    const rows = hostRows.get(o.host);
    if (!rows || rows.length === 0) {
      out.staleOutages.push({ ...o, why_stale: 'no stored citation points at this host any more' });
      continue;
    }
    const anyOk = rows.some((r) => judgeProbe(r).verdict === 'ok');
    if (anyOk) {
      out.staleOutages.push({ ...o, why_stale: 'the host is serving files again — delete this and repair whatever is still dead' });
      continue;
    }
    if (new Date(o.recheckAfter) < now) {
      out.expiredOutages.push({ ...o, why_expired: `recheckAfter ${o.recheckAfter} has passed` });
      continue;
    }
    downHosts.add(o.host);
  }

  for (const obs of observations) {
    const { verdict, detail } = judgeProbe(obs);
    const row = { ...obs, verdict, detail };
    const dec = byUrl.get(obs.url);
    if (dec) matched.add(obs.url);

    if (verdict === 'ok') {
      // ⚠ A declared URL that now answers is a STALE declaration: the repo is
      // carrying a sentence about the web that is no longer true. Same rule as
      // the xlsx registry and the out-of-period exceptions — delete it.
      if (dec) out.stale.push({ ...row, declared: dec });
      else out.ok.push(row);
      continue;
    }
    // ⛔ `uncitable` is checked BEFORE the outage, so an expiring link is never
    // excused by one. Shape is not liveness.
    if (verdict === 'uncitable') { out.uncitable.push(row); continue; }

    const host = citationShape(obs.url).host;
    if (downHosts.has(host)) {
      out.publisherDown.push({ ...row, outage: outageFor.get(host) });
      continue;
    }

    if (verdict === 'unreachable' && dec) {
      out.confirmed.push({ ...row, declared: dec });
      continue;
    }
    if (verdict === 'dead') out.dead.push(row);
    else if (verdict === 'wrong-type') out.wrongType.push(row);
    else out.unreachable.push(row);
  }

  // A declaration whose URL is no longer stored anywhere is also stale — it
  // describes a citation TT has stopped making.
  for (const d of declared) {
    if (!matched.has(d.url)) out.stale.push({ url: d.url, verdict: 'absent', detail: 'no budget stores this URL any more', declared: d });
  }
  return out;
}

/** True when nothing in this run should fail the gate. */
export function citationsAreClean(c) {
  return c.dead.length === 0
    && c.wrongType.length === 0
    && c.unreachable.length === 0
    && c.uncitable.length === 0
    && c.stale.length === 0
    // ⚠ A declared outage that has expired or stopped being true is a FAILURE,
    // not a notice. `publisherDown` itself is the notice.
    && (c.expiredOutages ?? []).length === 0
    && (c.staleOutages ?? []).length === 0;
}

/**
 * The uncited-budget ratchet.
 *
 * ⚠⚠ A BUDGET WITH NO `source_url` IS THE DEGENERATE CASE OF THE SAME DEFECT —
 * the reader is asked to believe a figure with nothing to click. There are
 * 24,960 of them, so failing on their existence would make this gate red by
 * design, and a gate that is red by design is a gate nobody reads.
 *
 * ⭐ So it RATCHETS, exactly like the totals baselines: the counts live in code
 * on purpose, paying one down is reviewed in a PR diff, and the gate's only
 * assertion is that nothing GREW. A new load that ships uncited rows moves a
 * number, and the diff says which family.
 */
export function judgeUncited(observed, baseline) {
  const grown = [];
  const appeared = [];
  const paidDown = [];

  for (const [family, count] of Object.entries(observed.families)) {
    const expected = baseline.families[family];
    if (expected === undefined) appeared.push({ family, count });
    else if (count > expected) grown.push({ family, count, expected });
    else if (count < expected) paidDown.push({ family, count, expected });
  }
  for (const [family, expected] of Object.entries(baseline.families)) {
    if (observed.families[family] === undefined) paidDown.push({ family, count: 0, expected });
  }

  return {
    grown,
    appeared,
    paidDown,
    observedTotal: observed.total,
    baselineTotal: Object.values(baseline.families).reduce((a, b) => a + b, 0),
    ok: grown.length === 0 && appeared.length === 0,
  };
}

/**
 * The family a `data_source` belongs to, for the ratchet above.
 *
 * ⭐ TWO NORMALISATIONS, BOTH LOAD-BEARING:
 *
 * 1. `"Bedford — MA General Fund Expenditures"` → `"MA General Fund
 *    Expenditures"`. The MA DLS families carry one `data_source` PER TOWN —
 *    351 of them, three times over. Keyed on the raw string the baseline file
 *    would be a thousand lines long and nobody would read the diff.
 *
 * 2. `"Plano Check Register FY2017"` → `"Plano Check Register"`, and the year
 *    is stripped wherever it sits, because the federal families put it in the
 *    MIDDLE (`"US Federal Outlays by Agency FY1976 (OMB Public Budget
 *    Database)"`). ⚠ This is what makes the ratchet mean something: loading
 *    FY2027 of an already-uncited family moves that family's COUNT, which the
 *    gate fails on. Without it, every new year would look like a brand-new
 *    family instead — true, but it would bury the signal.
 *
 * Measured against the live fleet on 2026-11-09: 1,000-odd distinct
 * `data_source` strings collapse to **75 families**, small enough to name every
 * one in the baseline rather than hide a tail in a bucket.
 */
export function familyOf(dataSource) {
  const raw = dataSource === null || dataSource === undefined || dataSource === '' ? '(null)' : String(dataSource);
  const afterDash = raw.includes('—') ? raw.split('—').slice(1).join('—').trim() : raw;
  return afterDash.replace(/\s*FY\d{2,4}(-\d{2,4})?/g, '').trim() || '(null)';
}

/** Roll a per-`data_source` tally up into the per-family census. */
export function censusUncited(rows) {
  const families = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.budgets ?? r.count ?? 0);
    const f = familyOf(r.data_source);
    families[f] = (families[f] || 0) + n;
    total += n;
  }
  return { families, total };
}

function truncate(s, n = 90) {
  const str = String(s);
  return str.length > n ? `${str.slice(0, n)}…` : str;
}
