import { describe, it, expect } from 'vitest';
import {
  normalizeAuditGrade, isAudited, AUDIT_GRADE_VALUES,
  AUDIT_GRADE_COPY, AUDIT_GRADE_EXPLAINER,
  type AuditGrade,
} from './auditGrade';

describe('normalizeAuditGrade', () => {
  it('passes through the five legal values', () => {
    for (const v of AUDIT_GRADE_VALUES) expect(normalizeAuditGrade(v)).toBe(v);
  });

  // ⚠⚠ Direction matters, and it is the OPPOSITE of normalizeDerivation's.
  //
  // `derivation` defaults to 'published' because every pre-SCOPE-04 row IS
  // published, so the default states a fact. There is no equivalent fact here:
  // a row whose grade we have not been told is a row NOBODY HAS LOOKED AT.
  // Defaulting to any graded value would have Treasury Tracker assert an audit
  // it never read — a false public claim about a government's books, and worse
  // than admitting ignorance. scripts/lib/budgetAxes.mjs states the same rule
  // for the loading side; this is the reader side of it.
  it('treats anything absent or unrecognised as UNKNOWN, never as a grade', () => {
    for (const raw of [undefined, null, '', 'garbage', 42, 'audited', 'AUDITED_GAAP'])
      expect(normalizeAuditGrade(raw)).toBe('unknown');
  });
});

describe('isAudited', () => {
  // ⚠ BOTH audited values, not just the GAAP one. An OCBOA report carries an
  // independent opinion under Government Auditing Standards exactly as a GAAP
  // one does; excluding it here would rebuild the ladder this module rejects.
  it('is true for both independently audited grades', () => {
    expect(isAudited('audited_gaap')).toBe(true);
    expect(isAudited('audited_ocboa')).toBe(true);
  });

  it('is false for compiled, self-reported and unknown', () => {
    expect(isAudited('compiled_from_audited')).toBe(false);
    expect(isAudited('self_reported_unaudited')).toBe(false);
    expect(isAudited('unknown')).toBe(false);
  });
});

describe('AUDIT_GRADE_COPY', () => {
  it('covers every legal value with all three fields filled', () => {
    for (const v of AUDIT_GRADE_VALUES) {
      const c = AUDIT_GRADE_COPY[v];
      expect(c, `no copy for ${v}`).toBeDefined();
      for (const field of ['label', 'short', 'long'] as const) {
        expect(c[field].trim(), `${v}.${field} is empty`).not.toBe('');
      }
    }
  });

  // ⚠⚠ `unknown` is 60,368 of 88,820 rows (68%) — the value a reader meets most
  // often, across 2,122 entities. It means Treasury Tracker has not established
  // the assurance level. It is NOT a finding about the government, and most of
  // those governments are perfectly well audited. Rendering it as a warning
  // would libel them at scale, which is why the words are pinned here rather
  // than left to whoever next edits the file.
  it('never renders `unknown` as a warning about the government', () => {
    const { label, short, long } = AUDIT_GRADE_COPY.unknown;
    for (const text of [label, short, long]) {
      expect(text).not.toMatch(
        /suspicious|dubious|questionable|red flag|warning|concern|risk|fail|refus|conceal/i
      );
    }
    expect(label).toMatch(/not (yet )?establish/i);
  });

  // ⚠⚠ `self_reported_unaudited` is 27,912 rows across 835 entities — nearly
  // every remaining row. It is a statutory filing a finance officer signs,
  // frequently drawn straight from audited books; it simply has not itself been
  // audited. "Unverified" or "unreliable" overstates that, and is the second way
  // this module could libel a government at scale.
  it('never calls a self-reported filing unverified or made up', () => {
    const { label, short, long } = AUDIT_GRADE_COPY.self_reported_unaudited;
    for (const text of [label, short, long]) {
      expect(text).not.toMatch(/unverified|unreliable|made up|made-up|untrustworthy|inaccurate/i);
    }
    // It must still say the thing that is true.
    expect(`${short} ${long}`).toMatch(/not been (independently )?audited|no independent audit/i);
  });

  // ⚠⚠ The distinction that breaks a linear scale. audited_ocboa has the SAME
  // assurance as audited_gaap and DIFFERENT comparability. If the copy fails to
  // say both halves, a reader reads it as a lesser audit — which it is not.
  it('says OCBOA is equal assurance but not comparable line-for-line', () => {
    const c = AUDIT_GRADE_COPY.audited_ocboa;
    const text = `${c.short} ${c.long}`;
    expect(text, 'must assert the audit is just as independent').toMatch(/same|equally|just as|no less/i);
    expect(text, 'must name the comparability cost').toMatch(/compar/i);
    expect(text, 'must not present itself as a weaker audit').not.toMatch(/weaker|lesser|lower quality|worse/i);
  });

  it('marks compiled_from_audited as sourced from audited statements', () => {
    const c = AUDIT_GRADE_COPY.compiled_from_audited;
    const text = `${c.short} ${c.long}`;
    expect(text).toMatch(/audited/i);
    expect(text).toMatch(/state|agency/i);
  });

  // ⚠⚠ The spec's rule 3: this is NOT a 1–5 star ladder, and no copy string may
  // imply one. Two dimensions (assurance, comparability) cannot be flattened
  // into a rank without misrepresenting audited_ocboa.
  it('no value ranks itself against the others', () => {
    for (const v of AUDIT_GRADE_VALUES) {
      const c = AUDIT_GRADE_COPY[v];
      for (const text of [c.label, c.short, c.long]) {
        expect(text, `${v} implies a rank`).not.toMatch(
          /\bbest\b|\bworst\b|\bhighest\b|\blowest\b|\bstar\b|\btier\b|\brank\b|\bscore\b/i
        );
      }
    }
  });

  it('gives every value a distinct label', () => {
    const labels = AUDIT_GRADE_VALUES.map((v) => AUDIT_GRADE_COPY[v].label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('AUDIT_GRADE_EXPLAINER', () => {
  it('is filled in', () => {
    expect(AUDIT_GRADE_EXPLAINER.heading.trim()).not.toBe('');
    for (const k of ['intro', 'whatAuditMeans', 'whyUnknownIsNotBad', 'whatWeDo'] as const) {
      expect(AUDIT_GRADE_EXPLAINER[k].trim(), `${k} is empty`).not.toBe('');
    }
  });

  // ⚠ The one place a reader learns the list is not a ranking. If the shared
  // explainer does not say it, nothing else on the page does.
  it('tells the reader the grades are not a ranking', () => {
    const all = Object.values(AUDIT_GRADE_EXPLAINER).join(' ');
    expect(all).toMatch(/not a rank|not a ranking|not a score|not a ladder|not better or worse/i);
  });

  // ⚠ A qualified opinion currently grades identically to a clean one — every
  // Harrison County MS year (10 rows) is an "except for" opinion and reads as
  // audited_gaap. Filed as an open decision, NOT silently papered over. The
  // explainer must not claim a precision the vocabulary does not have.
  it('does not claim the grades distinguish clean from qualified opinions', () => {
    const all = Object.values(AUDIT_GRADE_EXPLAINER).join(' ');
    expect(all).not.toMatch(/\bclean opinion\b|\bunmodified opinion\b|\bwithout reservation\b/i);
  });
});

describe('the vocabulary itself', () => {
  it('matches the CHECK constraint on treasury.budgets exactly', () => {
    // ⚠ Order and membership both. If the database gains a value and this list
    // does not, normalizeAuditGrade() silently downgrades real grades to
    // `unknown` and the reader is told less than Treasury Tracker knows.
    const expected: AuditGrade[] = [
      'audited_gaap', 'audited_ocboa', 'compiled_from_audited',
      'self_reported_unaudited', 'unknown',
    ];
    expect([...AUDIT_GRADE_VALUES]).toEqual(expected);
  });
});
