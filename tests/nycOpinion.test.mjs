import { describe, it, expect } from 'vitest';
import { readOpinion } from '../scripts/lib/nycOpinion.mjs';

const CLEAN_MODERN = 'Based on our audits and the reports of other auditors, the accompanying '
  + 'financial statements present fairly, in all material respects, the respective financial '
  + 'position of the governmental activities ... of The City of New York, as of June 30, 2024.';

// Verbatim shape of a pre-2012 SAS-58 qualification. ⚠ It CONTAINS the
// unmodified phrase and does NOT contain the words "qualified opinion".
const PRE_2012_QUALIFIED = 'Except for the effects of not recording the pension liability '
  + 'described in Note 4, the financial statements referred to above present fairly, in all '
  + 'material respects, the financial position of the City as of June 30, 2006.';

describe('NYC audit-opinion gate', () => {
  it('accepts an unmodified opinion', () => {
    expect(readOpinion(CLEAN_MODERN).unmodified).toBe(true);
  });

  it('does not read "unqualified" as "qualified"', () => {
    const r = readOpinion('In our opinion the statements present fairly, in all material '
      + 'respects ... we expressed an unqualified opinion on those statements.');
    expect(r.modifiedHits).toEqual([]);
    expect(r.unmodified).toBe(true);
  });

  it('does not trip on a line-broken "un- qualified"', () => {
    const r = readOpinion('we expressed an un- qualified opinion, and the statements '
      + 'present fairly, in all material respects, the position of the City.');
    expect(r.modifiedHits).toEqual([]);
    expect(r.unmodified).toBe(true);
  });

  // ⚠⚠ THE HOLE THIS MODULE EXISTS TO CLOSE. Ten of NYC's 24 books predate the
  // AU-C 705 "Qualified Opinion" heading. A gate resting on that heading alone
  // passes this text and grades a qualified book as audited-clean.
  it('CATCHES a pre-2012 "except for" qualification that never says "qualified opinion"', () => {
    const r = readOpinion(PRE_2012_QUALIFIED);
    expect(r.modifiedHits).toContain('except for the effects');
    expect(r.unmodified).toBe(false);
  });

  it('catches a modern qualified opinion by its heading', () => {
    const r = readOpinion('Basis for Qualified Opinion. ... the statements present fairly, '
      + 'in all material respects, except as noted.');
    expect(r.unmodified).toBe(false);
  });

  it('catches an adverse opinion and a disclaimer', () => {
    expect(readOpinion('Adverse Opinion. In our opinion ...').unmodified).toBe(false);
    expect(readOpinion('Disclaimer of Opinion. We do not express ...').unmodified).toBe(false);
  });

  it('reports a book with no opinion language at all as not unmodified', () => {
    const r = readOpinion('Table of contents. Independent Auditor. Page 3.');
    expect(r.hasOpinionPhrase).toBe(false);
    expect(r.unmodified).toBe(false);
  });
});
