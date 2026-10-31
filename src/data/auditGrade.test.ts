import { describe, it, expect } from 'vitest';
import {
  normalizeAuditGrade, isAudited, weakestGrade, AUDIT_GRADE_VALUES,
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

  // ⚠ A payroll roster has no auditor to hold an opinion, so this is false for
  // the same reason `unknown` is — but for a different cause. `unknown` has no
  // opinion we have READ; this has no opinion to read.
  it('is false for a record that is not a financial statement', () => {
    expect(isAudited('not_applicable')).toBe(false);
  });
});

describe('weakestGrade', () => {
  // ⚠⚠ OVER-DISCLOSURE, NOT A RANKING. A series is one pill, and its entries
  // can in principle carry different grades. If they do, the pill must state the
  // WEAKER of them: the failure this guards against is a reader seeing "audited"
  // over a figure only half of which is. Same one-directional rule as
  // AvailableSeries.derivation, and the same rule the loader applies to a mixed
  // source ("mixed takes the weaker branch").
  //
  // ⚠ This is about which copy gets CHOSEN. It is not a reader-facing rank and
  // no string here is rendered — the "no value ranks itself" contract above is
  // untouched.
  it('takes the weaker grade when a series disagrees with itself', () => {
    expect(weakestGrade(['audited_gaap', 'self_reported_unaudited'])).toBe('self_reported_unaudited');
    expect(weakestGrade(['self_reported_unaudited', 'unknown'])).toBe('unknown');
    expect(weakestGrade(['compiled_from_audited', 'audited_gaap'])).toBe('compiled_from_audited');
  });

  it('returns the only grade when a series agrees with itself', () => {
    expect(weakestGrade(['audited_gaap'])).toBe('audited_gaap');
    expect(weakestGrade(['unknown', 'unknown'])).toBe('unknown');
  });

  // ⚠ Empty is UNKNOWN, never a grade — the same direction normalizeAuditGrade
  // takes. Nothing to disclose is not a licence to assert.
  it('reads an empty series as unknown, never as a grade', () => {
    expect(weakestGrade([])).toBe('unknown');
  });

  it('reads an unrecognised value as unknown rather than ignoring it', () => {
    expect(weakestGrade(['audited_gaap', 'garbage' as AuditGrade])).toBe('unknown');
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

  // ⚠⚠ `unknown` is 38,421 of 583,569 rows (6.6%), across the sources nobody has
  // recon'd yet (measured 2026-10-30; it was 68% at 88,820 rows on 2026-08-31,
  // and the stale figure reached readers — see the D1 tests below). It means
  // Treasury Tracker has not established
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

  // ⚠⚠ `self_reported_unaudited` is 524,174 rows — 89.8% of the database and the
  // note a reader actually meets most often (measured 2026-10-30; it was 27,912
  // across 835 entities on 2026-08-31). It is a statutory filing a finance officer signs,
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

  // ⭐ ADDED 2026-10-30 (§5.4). The two failures this value exists to prevent.
  //
  // It must not CONFESS TO A GAP — that is `unknown`'s sentence and it is false
  // here: nobody failed to check, there is nothing to check. And it must not
  // read as a complaint about the record. The label says what the record IS.
  it('says what the record IS, never what is missing from it', () => {
    const { label, short, long } = AUDIT_GRADE_COPY.not_applicable;
    for (const text of [label, short, long]) {
      expect(text, `not_applicable copy confesses to a gap: ${text}`)
        .not.toMatch(/not (yet )?establish|have not checked|unverified|unaudited|missing/i);
    }
    expect(`${short} ${long}`).toMatch(/financial statement/i);
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

  // ⚠⚠ D1 — THIS SENTENCE SHIPPED FALSE AND NOBODY NOTICED FOR TWO MONTHS.
  //
  // It said the "not established" note "is roughly two figures in every three".
  // True on 2026-08-31 at 88,820 rows. By 2026-10-30 the table held 583,569 and
  // `unknown` was 6.6% — one in fifteen. A hard-coded fraction in reader-facing
  // copy rots silently as the corpus grows, and no gate reads it.
  //
  // So: no fraction, no percentage. Word it to stay true, or derive it.
  it('states no fraction or percentage that can rot', () => {
    const all = Object.values(AUDIT_GRADE_EXPLAINER).join(' ');
    // The noun in the middle is why the first draft of this test passed over the
    // live defect: the string is "two FIGURES in every three", not "two in three".
    expect(all).not.toMatch(/\b(one|two|three|four|five|half)\s+(\w+\s+)?(in|of)\s+(every\s+)?(one|two|three|four|five|ten|\d+)\b/i);
    expect(all).not.toMatch(/\b\d+(\.\d+)?\s?%/);
  });

  // The same defect in its other half: the explainer also named which note a
  // reader meets most often, and that changed too — it is "Government-reported"
  // now, at 89.8%. Which note is commonest is a fact about the database on one
  // day, not about what the notes MEAN.
  it('does not claim which note is commonest', () => {
    const all = Object.values(AUDIT_GRADE_EXPLAINER).join(' ');
    expect(all).not.toMatch(/\bcommonest\b|\bmost common\b|\bmost often\b/i);
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
      // ⚠ OFF THE ASSURANCE AXIS, not at the bottom of it. Listed last so the
      // five assurance values keep their order and their indices.
      'not_applicable',
    ];
    expect([...AUDIT_GRADE_VALUES]).toEqual(expected);
  });
});
