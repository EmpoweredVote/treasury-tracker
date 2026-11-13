import { describe, it, expect } from 'vitest';
import { SOURCE_URL_EXCEPTIONS } from '../scripts/data/sourceUrlExceptions.mjs';
import { classifyCitations } from '../scripts/lib/sourceUrlProbe.mjs';

/**
 * ⚠⚠⚠ THIS FILE EXISTS BECAUSE A DECLARATION IS THE ONE PLACE THIS GATE CAN BE
 * TALKED OUT OF A FINDING. Everything else it reports is measured; an entry
 * here is a human's word, and a human's word is exactly what a future session
 * will be tempted to forge when the gate is red and the fix is slow.
 *
 * So the data itself is pinned, not just the mechanism that reads it.
 */

const isPdf = (u) => u.toLowerCase().endsWith('.pdf');
/** An observation shaped like `probeUrl`'s, for a host that refuses us. */
const refused = (url) => ({ url, status: 403, contentType: 'text/html', error: null });

describe('the declarations as shipped', () => {
  it('declares the 26 citations the 2026-11-12 fleet run could not ask', () => {
    const byHost = {};
    for (const e of SOURCE_URL_EXCEPTIONS) {
      const host = new URL(e.url).host;
      byHost[host] = (byHost[host] ?? 0) + 1;
    }
    expect(byHost).toEqual({
      'bendoregon.gov': 18,
      'archives.obm.ohio.gov': 6,
      'cms6.revize.com': 1,
      'data.virginia.gov': 1,
    });
    expect(SOURCE_URL_EXCEPTIONS).toHaveLength(26);
  });

  it('declares a unique url per entry', () => {
    // ⚠ `classifyCitations` keys a Map by url, so a duplicate would not
    // conflict loudly — the later entry would silently win.
    const urls = SOURCE_URL_EXCEPTIONS.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('gives every entry an id, a reason, and a date a person looked', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const e of SOURCE_URL_EXCEPTIONS) {
      expect(String(e.id ?? ''), `${e.url} id`).not.toBe('');
      expect(String(e.why ?? ''), `${e.id} why`).not.toBe('');
      expect(String(e.checkedOn ?? ''), `${e.id} checkedOn`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // ⭐ A date in the future is not a date anybody looked.
      expect(e.checkedOn <= today, `${e.id} checkedOn ${e.checkedOn} is in the future`).toBe(true);
    }
  });

  it('names a person-verifiable reason, not a tool failure', () => {
    // ⚠ "curl got a 403" is a fact about curl. The entry has to say what a
    // PERSON saw, or it records only that something was annoying once.
    for (const e of SOURCE_URL_EXCEPTIONS) {
      expect(e.why, `${e.id} why`).toMatch(/opened|opens|renders|served|serves/i);
    }
  });
});

describe('what a declaration does, measured against the real entries', () => {
  it('excuses each declared citation when its host refuses an automated client', () => {
    const obs = SOURCE_URL_EXCEPTIONS.map((e) => refused(e.url));
    const c = classifyCitations(obs, SOURCE_URL_EXCEPTIONS);
    expect(c.confirmed).toHaveLength(26);
    expect(c.unreachable).toEqual([]);
    expect(c.stale).toEqual([]);
  });

  it('⛔ may NEVER excuse a citation the publisher says is gone', () => {
    // A 404 is the publisher stating the document is gone. `dead` orders a
    // repair, and no sentence in this file may call that off.
    const obs = SOURCE_URL_EXCEPTIONS.map((e) => ({
      url: e.url, status: 404, contentType: 'text/html', error: null,
    }));
    const c = classifyCitations(obs, SOURCE_URL_EXCEPTIONS);
    expect(c.dead).toHaveLength(26);
    expect(c.confirmed).toEqual([]);
  });

  it('⛔ may NEVER excuse a host that served the wrong thing', () => {
    const pdfs = SOURCE_URL_EXCEPTIONS.filter((e) => isPdf(e.url));
    expect(pdfs.length).toBeGreaterThan(0);
    const obs = pdfs.map((e) => ({
      url: e.url, status: 200, contentType: 'text/html', error: null,
    }));
    const c = classifyCitations(obs, pdfs);
    expect(c.wrongType).toHaveLength(pdfs.length);
    expect(c.confirmed).toEqual([]);
  });

  it('goes STALE the moment a declared url answers again', () => {
    // ⭐ The entry is a claim about the live web. When the host relents, the
    // gate must fail until the sentence is deleted — a repo carrying an
    // out-of-date statement about the web is worse than one carrying none.
    const obs = SOURCE_URL_EXCEPTIONS.map((e) => ({
      url: e.url,
      status: 200,
      contentType: isPdf(e.url) ? 'application/pdf' : 'text/html',
      error: null,
    }));
    const c = classifyCitations(obs, SOURCE_URL_EXCEPTIONS);
    expect(c.stale).toHaveLength(26);
    expect(c.ok).toEqual([]);
  });

  it('goes stale when TT stops storing the url at all', () => {
    const c = classifyCitations([], SOURCE_URL_EXCEPTIONS);
    expect(c.stale).toHaveLength(26);
    expect(c.stale.every((s) => s.verdict === 'absent')).toBe(true);
  });
});
