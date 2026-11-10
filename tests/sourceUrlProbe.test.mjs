import { describe, it, expect } from 'vitest';
import {
  citationShape,
  promisedType,
  typeSatisfies,
  judgeProbe,
  probeUrl,
  classifyCitations,
  citationsAreClean,
  judgeUncited,
  familyOf,
  censusUncited,
} from '../scripts/lib/sourceUrlProbe.mjs';
import { PUBLISHER_OUTAGES } from '../scripts/data/publisherOutages.mjs';

/**
 * `budgets.source_url` was read by NO gate in this repo until this one.
 *
 * These tests are pure, so they run in the ordinary PR gate with no database
 * credential and no network — the same split as anonExecuteSweep.test.mjs. The
 * live half is `npm run verify:source-urls`; THIS half fixes what a probe
 * result MEANS, and in particular the three things the gate must never do:
 * call an unanswered host a pass, let a declaration excuse a dead link, or let
 * a 200 stand for a document when the host actually served a block page.
 */

describe('citationShape — the structural verdict, reached with no network call', () => {
  it('refuses the exact FAC presigned link that cost 227 Alaska rows', () => {
    // The real shape: app.fac.gov 302s to an S3 object whose own query string
    // says X-Amz-Expires=30. Thirty SECONDS. It was dead before the load that
    // wrote it finished, and every gate stayed green.
    const presigned = 'https://fac-federal-audit-clearinghouse.s3.amazonaws.com/report/2023-06-GSAFAC-0000012345.pdf'
      + '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA%2F20261029%2Fus-east-1'
      + '&X-Amz-Date=20261029T132010Z&X-Amz-Expires=30&X-Amz-Signature=deadbeef';
    const shape = citationShape(presigned);
    expect(shape.citable).toBe(false);
    expect(shape.reason).toMatch(/PRESIGNED/);
  });

  it('refuses presigned links from other object stores too — the defect is the shape, not Amazon', () => {
    expect(citationShape('https://storage.googleapis.com/x/y.pdf?X-Goog-Expires=600&X-Goog-Signature=ab').citable).toBe(false);
    expect(citationShape('https://host.gov/doc.pdf?Expires=1793212800&other=1').citable).toBe(false);
    expect(citationShape('https://host.gov/d?token=abcdefghijklmnopqrstuvwxyz012345').citable).toBe(false);
  });

  it('accepts an ordinary durable citation', () => {
    const shape = citationShape('https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000012345');
    expect(shape.citable).toBe(true);
    expect(shape.host).toBe('app.fac.gov');
  });

  it('refuses what a reader cannot click: non-http, whitespace, and hosts only this machine can reach', () => {
    expect(citationShape('file:///C:/exports/plano.xlsx').citable).toBe(false);
    expect(citationShape(' https://host.gov/a.pdf').citable).toBe(false);
    expect(citationShape('http://localhost:3000/a.pdf').citable).toBe(false);
    expect(citationShape('').citable).toBe(false);
    expect(citationShape(null).citable).toBe(false);
  });

  it('does NOT refuse a query string merely for having parameters', () => {
    // Socrata and ArcGIS cite with query strings all day. Only EXPIRY is fatal.
    expect(citationShape('https://data.lacity.org/resource/abcd-1234.json?$limit=50000').citable).toBe(true);
    expect(citationShape('https://services.arcgis.com/x/FeatureServer/0/query?where=1%3D1&f=json').citable).toBe(true);
  });
});

describe('promisedType / typeSatisfies — a 200 is not proof', () => {
  it('reads the promise out of the path, not the query string', () => {
    expect(promisedType('https://h.gov/acfr.pdf')).toBe('pdf');
    expect(promisedType('https://h.gov/data.xlsx?v=2')).toBe('spreadsheet');
    expect(promisedType('https://h.gov/export.csv')).toBe('csv');
    expect(promisedType('https://h.gov/dissemination/report/pdf/2023-06-GSAFAC-1')).toBe(null);
  });

  it('treats a URL that promises nothing as satisfied by anything', () => {
    // FAC's /report/pdf/<id> has no extension anywhere. Asserting a type we
    // were never promised would invent failures across a whole family.
    expect(typeSatisfies(null, 'text/html')).toBe(true);
  });

  it('treats silence as silence — some hosts send no content-type on HEAD', () => {
    expect(typeSatisfies('pdf', '')).toBe(true);
    expect(typeSatisfies('pdf', undefined)).toBe(true);
  });

  it('catches the block page: .pdf answered with text/html', () => {
    expect(typeSatisfies('pdf', 'text/html; charset=utf-8')).toBe(false);
    expect(typeSatisfies('spreadsheet', 'text/html')).toBe(false);
    expect(typeSatisfies('pdf', 'application/pdf')).toBe(true);
    expect(typeSatisfies('spreadsheet', 'application/octet-stream')).toBe(true);
  });
});

describe('judgeProbe', () => {
  const at = (url, over) => judgeProbe({ url, status: 200, contentType: 'application/pdf', ...over });

  it('passes a live document', () => {
    expect(at('https://h.gov/a.pdf').verdict).toBe('ok');
  });

  it('calls a 404 dead', () => {
    expect(at('https://h.gov/a.pdf', { status: 404 }).verdict).toBe('dead');
  });

  it('⚠⚠ does NOT call an unanswered host a pass', () => {
    // The shape this project keeps rediscovering: "we could not check" must
    // never be recorded as "we checked and it was fine".
    expect(at('https://h.gov/a.pdf', { status: null, error: 'ETIMEDOUT' }).verdict).toBe('unreachable');
    expect(at('https://h.gov/a.pdf', { status: undefined, error: null }).verdict).toBe('unreachable');
  });

  it('fails a 200 that served a block page where a document was promised', () => {
    const j = at('https://h.gov/acfr.pdf', { contentType: 'text/html; charset=utf-8' });
    expect(j.verdict).toBe('wrong-type');
    expect(j.detail).toMatch(/block page/);
  });

  it('puts shape before liveness — a presigned link that still answers is still uncitable', () => {
    const j = judgeProbe({
      url: 'https://s3.amazonaws.com/a.pdf?X-Amz-Expires=30&X-Amz-Signature=x',
      status: 200,
      contentType: 'application/pdf',
    });
    expect(j.verdict).toBe('uncitable');
  });
});

describe('probeUrl — how the question is asked', () => {
  const res = (status, contentType = '') => ({
    status,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? contentType : null) },
  });

  it('falls back to a one-byte GET when the host refuses HEAD', async () => {
    // Plenty of government servers answer HEAD with 405 while serving the same
    // URL happily to a GET. Calling that dead would invent failures.
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ method: opts.method, range: opts.headers.Range });
      return opts.method === 'HEAD' ? res(405) : res(200, 'application/pdf');
    };
    const out = await probeUrl('https://h.gov/a.pdf', { fetchImpl });
    expect(out.status).toBe(200);
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'GET']);
    expect(calls[1].range).toBe('bytes=0-0'); // not the whole 300 MB ACFR
  });

  it('⚠⚠ falls back to curl on a 403 — McKinney refuses Node\'s TLS fingerprint, not its headers', async () => {
    const fetchImpl = async () => res(403);
    const curlImpl = async () => ({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const out = await probeUrl('https://www.mckinneytexas.org/DocumentCenter/View/1.xlsx', { fetchImpl, curlImpl });
    expect(out.status).toBe(200);
    expect(out.viaCurl).toBe(true);
    // Without the fallback this would read as `dead`, and the gate would be
    // reporting on Node rather than on McKinney.
    expect(judgeProbe(out).verdict).toBe('ok');
  });

  it('records a 403 that curl cannot rescue either, rather than inventing a pass', async () => {
    const out = await probeUrl('https://h.gov/a.pdf', { fetchImpl: async () => res(403), curlImpl: null });
    expect(judgeProbe(out).verdict).toBe('dead');
  });

  it('never asks a presigned URL at all', async () => {
    let asked = false;
    const fetchImpl = async () => { asked = true; return res(200); };
    const out = await probeUrl('https://s3/a.pdf?X-Amz-Expires=30&X-Amz-Signature=x', { fetchImpl });
    expect(asked).toBe(false);
    expect(judgeProbe(out).verdict).toBe('uncitable');
  });

  it('turns a hung host into unreachable, not into a pass', async () => {
    const fetchImpl = (url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    });
    const out = await probeUrl('https://h.gov/a.pdf', { fetchImpl, timeoutMs: 10 });
    expect(judgeProbe(out).verdict).toBe('unreachable');
  });
});

describe('classifyCitations — what a declaration may and may not excuse', () => {
  const obs = (url, over) => ({ url, status: 200, contentType: 'application/pdf', error: null, ...over });

  it('lets a declaration excuse an unreachable host', () => {
    const c = classifyCitations(
      [obs('https://slow.gov/a.pdf', { status: null, error: 'ETIMEDOUT' })],
      [{ url: 'https://slow.gov/a.pdf', why: 'host refuses automated clients; checked by hand 2026-11-09' }],
    );
    expect(c.confirmed).toHaveLength(1);
    expect(c.unreachable).toHaveLength(0);
    expect(citationsAreClean(c)).toBe(true);
  });

  it('⛔ does NOT let a declaration excuse a dead link', () => {
    // A 404 is the publisher saying the document is gone. The answer is to
    // repair the URL, not to write a sentence about it.
    const c = classifyCitations(
      [obs('https://h.gov/a.pdf', { status: 404 })],
      [{ url: 'https://h.gov/a.pdf', why: 'we know, leave it' }],
    );
    expect(c.dead).toHaveLength(1);
    expect(citationsAreClean(c)).toBe(false);
  });

  it('⛔ does NOT let a declaration excuse an expiring link', () => {
    const url = 'https://s3/a.pdf?X-Amz-Expires=30&X-Amz-Signature=x';
    const c = classifyCitations([obs(url)], [{ url, why: 'it works when I click it' }]);
    expect(c.uncitable).toHaveLength(1);
    expect(citationsAreClean(c)).toBe(false);
  });

  it('reports a declaration the web has outgrown as stale', () => {
    const c = classifyCitations(
      [obs('https://recovered.gov/a.pdf')],
      [{ url: 'https://recovered.gov/a.pdf', why: 'was timing out in November' }],
    );
    expect(c.stale).toHaveLength(1);
    expect(c.ok).toHaveLength(0);
    expect(citationsAreClean(c)).toBe(false); // delete the declaration
  });

  it('reports a declaration for a URL no budget stores any more as stale', () => {
    const c = classifyCitations([], [{ url: 'https://gone.gov/a.pdf', why: 'old' }]);
    expect(c.stale).toHaveLength(1);
    expect(c.stale[0].verdict).toBe('absent');
  });

  it('is clean when every citation resolves', () => {
    const c = classifyCitations([obs('https://h.gov/a.pdf'), obs('https://h.gov/b.pdf')], []);
    expect(c.ok).toHaveLength(2);
    expect(citationsAreClean(c)).toBe(true);
  });
});

describe('familyOf — what the ratchet is keyed on', () => {
  it('collapses the 351 per-town MA sources onto their publisher', () => {
    expect(familyOf('Bedford — MA General Fund Expenditures')).toBe('MA General Fund Expenditures');
    expect(familyOf('Aquinnah — MA DLS General Fund Revenue by Source')).toBe('MA DLS General Fund Revenue by Source');
  });

  it('strips the fiscal year wherever it sits, including the MIDDLE', () => {
    expect(familyOf('Plano Check Register FY2017')).toBe('Plano Check Register');
    expect(familyOf('West Hollywood Demand Register FY2016-17')).toBe('West Hollywood Demand Register');
    // ⚠ The federal families put the year in the middle; a trailing-only strip
    // would make every one of the 50 years its own family.
    expect(familyOf('US Federal Outlays by Agency FY1976 (OMB Public Budget Database)'))
      .toBe('US Federal Outlays by Agency (OMB Public Budget Database)');
  });

  it('leaves a source with no town prefix and no year alone', () => {
    expect(familyOf('LA City Payroll')).toBe('LA City Payroll');
  });

  it('never returns an empty key', () => {
    expect(familyOf(null)).toBe('(null)');
    expect(familyOf('')).toBe('(null)');
    expect(familyOf('FY2024')).toBe('(null)');
  });
});

describe('censusUncited', () => {
  it('rolls a per-source tally up into families, keeping the total honest', () => {
    const c = censusUncited([
      { data_source: 'Bedford — MA General Fund Expenditures', budgets: 24 },
      { data_source: 'Acushnet — MA General Fund Expenditures', budgets: 24 },
      { data_source: 'Plano Check Register FY2017', budgets: 1 },
      { data_source: 'Plano Check Register FY2018', budgets: 1 },
    ]);
    expect(c.families).toEqual({ 'MA General Fund Expenditures': 48, 'Plano Check Register': 2 });
    expect(c.total).toBe(50);
  });
});

describe('judgeUncited — the ratchet over budgets that cite nothing at all', () => {
  const baseline = { families: { 'MA General Fund Expenditures': 8408, 'LA City Payroll': 10 } };

  it('passes when nothing moved', () => {
    expect(judgeUncited({ families: { ...baseline.families }, total: 8418 }, baseline).ok).toBe(true);
  });

  it('fails when a family grew — that is a load that shipped uncited rows', () => {
    const j = judgeUncited({ families: { ...baseline.families, 'LA City Payroll': 11 }, total: 8419 }, baseline);
    expect(j.ok).toBe(false);
    expect(j.grown).toEqual([{ family: 'LA City Payroll', count: 11, expected: 10 }]);
  });

  it('fails when a family that never cited anything appears', () => {
    const j = judgeUncited({ families: { ...baseline.families, 'Austin Check Register': 3 }, total: 8421 }, baseline);
    expect(j.ok).toBe(false);
    expect(j.appeared).toEqual([{ family: 'Austin Check Register', count: 3 }]);
  });

  it('⭐ treats paying one down as a NOTICE, never a failure', () => {
    const j = judgeUncited({ families: { ...baseline.families, 'LA City Payroll': 0 }, total: 8408 }, baseline);
    expect(j.ok).toBe(true);
    expect(j.paidDown.length).toBeGreaterThan(0);
  });

  it('notices a family that disappeared from the uncited set entirely', () => {
    const j = judgeUncited({ families: { 'MA General Fund Expenditures': 8408 }, total: 8408 }, baseline);
    expect(j.ok).toBe(true);
    expect(j.paidDown).toContainEqual({ family: 'LA City Payroll', count: 0, expected: 10 });
  });
});

/**
 * ⭐⭐⭐ A PUBLISHER THAT IS DOWN IS NOT A DOCUMENT THAT IS GONE.
 *
 * This gate shipped with one rule about a 404 — "the publisher says this
 * document is gone; repair the URL, never annotate it" — and on its first live
 * run that rule was wrong about 60 URLs covering 6,616 budgets, 93% of every
 * dead citation TT holds. Ohio's Auditor of State has been offline since a
 * cyberattack on 2026-10-25. Acting on `dead` would have meant rewriting 6,616
 * correct citations during an outage, with no live file to check a replacement
 * against.
 *
 * ⚠ The excusal is fenced three ways, and each fence is a test below, because
 * an outage that cannot expire is exactly the permanent annotation the original
 * rule existed to forbid.
 */
describe('publisher outages', () => {
  const OUTAGE = {
    id: 'test-outage',
    host: 'down.gov',
    began: '2026-10-25',
    observedOn: '2026-11-09',
    recheckAfter: '2026-12-10',
    evidence: 'We took the web server offline.',
    evidenceUrl: 'https://down.gov/',
  };
  const NOW = new Date('2026-11-09');
  const dead = (url) => ({ url, status: 404, contentType: 'text/html', error: null });
  // ⚠ `application/pdf`, not `text/html`. A `.pdf` answered with HTML judges
  // `wrong-type`, NOT `ok` — which is correct, and means a maintenance page
  // served under a document's URL does not read as the publisher recovering.
  // Only a genuine `ok` retires an outage.
  const live = (url) => ({ url, status: 200, contentType: 'application/pdf', error: null });

  it('reports a declared outage as a NOTICE, not a dead citation', () => {
    const c = classifyCitations(
      [dead('https://down.gov/a.pdf'), dead('https://down.gov/b.pdf')],
      [], [OUTAGE], NOW,
    );
    expect(c.dead).toHaveLength(0);
    expect(c.publisherDown).toHaveLength(2);
    expect(citationsAreClean(c)).toBe(true);
  });

  it('⚠⚠ excuses NOTHING on a host that is merely having a bad day', () => {
    // cg.sc.gov answers its root with a working site while 24 of its documents
    // 404. Those really did move, and no outage is declared for it.
    const c = classifyCitations([dead('https://moved.gov/a.pdf')], [], [OUTAGE], NOW);
    expect(c.dead).toHaveLength(1);
    expect(citationsAreClean(c)).toBe(false);
  });

  it('⛔ FENCE 1: an expired declaration fails the run', () => {
    const c = classifyCitations([dead('https://down.gov/a.pdf')], [], [OUTAGE], new Date('2027-01-01'));
    expect(c.expiredOutages).toHaveLength(1);
    expect(c.publisherDown).toHaveLength(0);
    expect(citationsAreClean(c)).toBe(false);
  });

  it('⛔ FENCE 2: one live URL on the host means the outage is over', () => {
    // The publisher is serving files again, so whatever is still 404 is
    // genuinely gone and must be repaired, not excused.
    const c = classifyCitations(
      [dead('https://down.gov/a.pdf'), live('https://down.gov/b.pdf')],
      [], [OUTAGE], NOW,
    );
    expect(c.staleOutages).toHaveLength(1);
    expect(c.publisherDown).toHaveLength(0);
    expect(c.dead).toHaveLength(1);
    expect(citationsAreClean(c)).toBe(false);
  });

  it('⛔ FENCE 3: an outage cannot excuse an EXPIRING link', () => {
    // Shape is not liveness. A presigned link is broken by its own form and no
    // outage makes it citable.
    const c = classifyCitations(
      [{ url: 'https://down.gov/a.pdf?X-Amz-Expires=30&X-Amz-Signature=x', status: 404, error: null }],
      [], [OUTAGE], NOW,
    );
    expect(c.uncitable).toHaveLength(1);
    expect(c.publisherDown).toHaveLength(0);
    expect(citationsAreClean(c)).toBe(false);
  });

  it('reports a declaration for a host nothing cites any more as stale', () => {
    const c = classifyCitations([dead('https://other.gov/a.pdf')], [], [OUTAGE], NOW);
    expect(c.staleOutages).toHaveLength(1);
    expect(c.staleOutages[0].why_stale).toMatch(/no stored citation/);
  });

  it('⚠ an unreachable host under a declared outage is a notice too, not a failure', () => {
    // The outage is the reason it cannot be asked; saying so twice helps nobody.
    const c = classifyCitations(
      [{ url: 'https://down.gov/a.pdf', status: null, error: 'ETIMEDOUT' }],
      [], [OUTAGE], NOW,
    );
    expect(c.publisherDown).toHaveLength(1);
    expect(c.unreachable).toHaveLength(0);
  });
});

describe('the Ohio declaration itself', () => {
  it('⚠ names a real host, carries a quote, and expires', () => {
    const ohio = PUBLISHER_OUTAGES.find((o) => o.host === 'www.ohioauditor.gov');
    expect(ohio, 'the Ohio AOS outage is not declared').toBeTruthy();
    expect(ohio.recheckAfter, 'an outage with no expiry is a permanent excuse').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(ohio.recheckAfter) > new Date(ohio.observedOn)).toBe(true);
    expect(ohio.evidence.length).toBeGreaterThan(40);
    expect(ohio.evidenceUrl).toMatch(/^https:\/\//);
  });

  it('⚠⚠ every declared outage expires, with no exceptions', () => {
    for (const o of PUBLISHER_OUTAGES) {
      expect(o.recheckAfter, `${o.host} has no recheckAfter`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(o.host, `${o.id} declares no host`).toBeTruthy();
      // ⚠ A host, not a URL prefix: the excusal is host-wide by design, because
      // "every citation on this host still fails" is what makes it safe.
      expect(o.host).not.toMatch(/\//);
    }
  });
});
