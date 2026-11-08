import { describe, it, expect } from 'vitest';
import { figureFlags, figureFlagFor } from '../src/data/figureFlags';
import { GA_FIGURE_FLAGS } from '../scripts/data/gaRlgfAnomalies.mjs';
import { MCKINNEY_REGISTER_ANOMALIES } from '../scripts/data/mckinneyRegisterAnomalies.mjs';

/**
 * ⚠⚠ EVERY AUTHOR-FACING REGISTER, NOT JUST GEORGIA'S.
 *
 * These guards were written when GA was the only register, and they asserted
 * that every reader-facing flag traces to `GA_FIGURE_FLAGS`. That stopped
 * being the right assertion the moment a second register existed: the first
 * non-Georgia flag would have failed as "an id the register does not carry"
 * even though its register entry was sitting right there.
 *
 * ⚠ ADD EVERY NEW REGISTER HERE. A register that is not in this list cannot
 * surface a flag — and worse, the test that proves corroborated findings reach
 * readers would silently stop covering it.
 *
 * ⚠⚠ scripts/data/friscoRegisterAnomalies.mjs is DELIBERATELY ABSENT. It is
 * marked not-reader-facing: its claim is an inference about the publisher
 * ("therefore the day was exported twice"), not a fact about the file, and it
 * has not been independently corroborated. Adding it here would be promoting
 * it by the back door.
 */
const AUTHOR_FACING_REGISTERS = [
  ...GA_FIGURE_FLAGS,
  ...MCKINNEY_REGISTER_ANOMALIES,
];

/**
 * ⚠⚠ THE GUARD THAT MATTERS: the author-facing register and the reader-facing
 * one must not drift. Every flag TT records about a government's figures was
 * invisible to readers until `src/data/figureFlags.ts` shipped, because nothing
 * under src/ read the register. These tests exist so that cannot happen again
 * silently — a new corroborated flag that is never surfaced now fails CI.
 */
describe('figure flags — reader-facing surfacing', () => {
  it('⚠⚠ every corroborated, loaded flag reaches the page — in EVERY register', () => {
    // ⚠ Was GA-only. A second register would otherwise have been able to
    // record a corroborated finding and never show it, which is the exact
    // failure this whole file was written to make impossible.
    const surfaced = new Set(Object.values(figureFlags).map((f) => f.id));
    const missing = AUTHOR_FACING_REGISTERS
      .filter((f) => f.loaded)
      .map((f) => f.id)
      .filter((id) => !surfaced.has(id));
    expect(missing, `recorded for maintainers but never shown to readers: ${missing.join(', ')}`)
      .toEqual([]);
  });

  /**
   * ⚠⚠⚠ A FLAG ABOUT A PERIOD MUST CARRY ITS OWN RETIREMENT CONDITION.
   *
   * McKinney's FY2026 banner says the year covers eleven months. If the city
   * republishes the file with September in it and TT reloads, that sentence
   * becomes FALSE — and a banner telling a reader a complete year is
   * incomplete is its own misinformation. The register entry has to say, in
   * mechanical terms, when to take it down.
   */
  it('⚠⚠ a period flag says when it must be retired', () => {
    const periodFlags = AUTHOR_FACING_REGISTERS.filter((f) => f.severity === 'incomplete-period');
    expect(periodFlags.length).toBeGreaterThan(0);
    for (const f of periodFlags) {
      expect(f.retireWhen, `${f.id} has no retirement condition`).toBeTruthy();
      expect(String(f.retireWhen).length, f.id).toBeGreaterThan(40);
    }
  });

  it('⚠ no reader-facing flag invents an id the register does not carry', () => {
    const known = new Set(AUTHOR_FACING_REGISTERS.map((f) => f.id));
    for (const f of Object.values(figureFlags)) {
      // Every surfaced flag must trace to a corroborated register entry — a
      // claim about a government's figures is never authored only in the UI.
      expect(known.has(f.id), `${f.id} has no entry in the author-facing register`).toBe(true);
    }
  });

  it('⚠ the register entry behind every surfaced flag is LOADED, never suppressed', () => {
    // The Milledgeville Rule: a flagged figure is published, not withheld. A
    // flag on a figure TT declined to load would be describing an absence.
    const byId = new Map(AUTHOR_FACING_REGISTERS.map((f) => [f.id, f]));
    for (const f of Object.values(figureFlags)) {
      expect(byId.get(f.id)?.loaded).toBe(true);
    }
  });

  it('keys parse into entity|state|year|dataset, and the lookup honours all four', () => {
    for (const key of Object.keys(figureFlags)) {
      const parts = key.split('|');
      expect(parts).toHaveLength(4);
      expect(Number.isInteger(Number(parts[2]))).toBe(true);
      expect(['operating', 'revenue', 'salaries', 'transactions']).toContain(parts[3]);
    }
    expect(figureFlagFor('DeKalb County', 'GA', 2018, 'operating')).toBeTruthy();
    // ⚠ The exact four values App.tsx passes for McKinney's payments view.
    // `treasury.municipalities` holds name 'McKinney', state 'TX'; a flag
    // keyed on anything else renders NOTHING and fails silently.
    expect(figureFlagFor('McKinney', 'TX', 2026, 'transactions')).toBeTruthy();
    expect(figureFlagFor('McKinney', 'TX', 2025, 'transactions')).toBeUndefined();
    expect(figureFlagFor('McKinney', 'TX', 2026, 'operating')).toBeUndefined();
    // ⚠ A near-miss must NOT match: wrong year, wrong dataset, wrong state.
    expect(figureFlagFor('DeKalb County', 'GA', 2019, 'operating')).toBeUndefined();
    expect(figureFlagFor('DeKalb County', 'GA', 2018, 'revenue')).toBeUndefined();
    expect(figureFlagFor('DeKalb County', 'NC', 2018, 'operating')).toBeUndefined();
    expect(figureFlagFor(undefined, 'GA', 2018, 'operating')).toBeUndefined();
  });

  it('⚠ every flag carries reader-facing copy and at least one source', () => {
    for (const [key, f] of Object.entries(figureFlags)) {
      expect(f.headline.length, key).toBeGreaterThan(10);
      expect(f.summary.length, key).toBeGreaterThan(40);
      expect(f.entries.length, key).toBeGreaterThanOrEqual(1);
      for (const e of f.entries) {
        // Always-sourced ground rule — no unsourced prose ships to a reader.
        expect(e.source_name, key).toBeTruthy();
        expect(e.source_url, key).toMatch(/^https:\/\//);
        expect(e.source_date, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('⚠⚠ the copy never implies wrongdoing', () => {
    // These are self-reported forms the publisher does not certify, and every
    // defect found so far UNDERSTATES spending. Tone is load-bearing: a flag
    // that reads as an accusation is a liability, not transparency.
    const forbidden = /\b(fraud|fraudulent|embezzl|corrupt|misappropriat|cover.?up|deliberate|falsif)/i;
    for (const [key, f] of Object.entries(figureFlags)) {
      const prose = [f.headline, f.summary, ...f.entries.flatMap((e) => [e.title ?? '', e.text])].join(' ');
      expect(forbidden.test(prose), `${key} uses accusatory language`).toBe(false);
    }
  });

  it('⚠⚠ a not-comparable flag never claims the figure is wrong', () => {
    // These figures are CORRECT — only the year-over-year comparison breaks.
    // Copy that implies a defect would tell the reader something false AND
    // impute a fault to a government that has none.
    const wrongness = /\b(understated|overstated|missing|incorrect|wrong|error|defect|should be)\b/i;
    for (const [key, f] of Object.entries(figureFlags)) {
      if (f.severity !== 'not-comparable') continue;
      expect(wrongness.test(f.headline), `${key} headline implies the figure is wrong`).toBe(false);
      // It must instead say what IS true: the comparison is the problem.
      const prose = `${f.headline} ${f.summary}`;
      expect(/not comparable|comparing|comparison|not a real/i.test(prose), key).toBe(true);
    }
  });

  it('⚠ both sides of a two-year seam are flagged, not just one', () => {
    // A reader can land on either year. Flagging only the odd-looking one
    // leaves the other silently misleading.
    const seam = Object.entries(figureFlags)
      .filter(([, f]) => f.id === 'fulton-fy2017-fy2018-property-tax-timing')
      .map(([k]) => k);
    expect(seam.sort()).toEqual([
      'Fulton County|GA|2017|revenue',
      'Fulton County|GA|2018|revenue',
    ]);
  });

  it('⚠ states plainly that the figure is shown as filed', () => {
    // The reader must be able to tell that TT did not alter the number — that
    // is the whole difference between flagging and quietly correcting.
    for (const [key, f] of Object.entries(figureFlags)) {
      const prose = `${f.summary} ${f.entries.map((e) => e.text).join(' ')}`;
      expect(/as filed|as published|shown as|displayed exactly|genuinely what/i.test(prose), key).toBe(true);
    }
  });

  it('\u26a0\u26a0 no HEADLINE renders a verdict on the government', () => {
    // CONTEXT, NOT A VERDICT (Chris, 2026-10-17). A headline says what the
    // figure covers and what it leaves out. It does not pronounce the number
    // broken -- TT is not the auditor, and the Fulton FY2017 case showed a
    // figure can look broken and be a court-ordered delay.
    const verdict = /\b(wrong|incorrect|error|erroneous|broken|invalid|bogus|failed|failure|bad data|mistake)\b/i;
    for (const [key, f] of Object.entries(figureFlags)) {
      expect(verdict.test(f.headline), `${key} headline delivers a verdict`).toBe(false);
    }
  });

  it('\u26a0 every flag tells the reader what to DO with the figure', () => {
    // This replaced the implied verdict. A banner that only says "be wary"
    // leaves the reader with nothing actionable.
    for (const [key, f] of Object.entries(figureFlags)) {
      expect(f.whatThisMeans, key).toBeTruthy();
      expect(f.whatThisMeans.length, key).toBeGreaterThan(25);
      expect(f.whatThisMeans, key).not.toBe(f.summary);
    }
  });

  it('\u26a0\u26a0 the MAGNITUDE survives in the headline, since styling no longer carries it', () => {
    // Calm is not quiet. With one neutral treatment for every severity, the
    // only thing stopping a skimming reader misusing a figure that is out by
    // sevenfold is the number itself, stated up front.
    for (const [key, f] of Object.entries(figureFlags)) {
      const hasScale = /\d/.test(f.headline)
        || /\b(seven|half|most|almost none|none|all)\b/i.test(f.headline);
      expect(hasScale, `${key} headline states no magnitude`).toBe(true);
    }
  });
});
