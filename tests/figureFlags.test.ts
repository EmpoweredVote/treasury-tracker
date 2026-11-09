import { describe, it, expect } from 'vitest';
import { figureFlags, figureFlagFor } from '../src/data/figureFlags';
import { GA_FIGURE_FLAGS } from '../scripts/data/gaRlgfAnomalies.mjs';
import { MCKINNEY_REGISTER_ANOMALIES } from '../scripts/data/mckinneyRegisterAnomalies.mjs';
import { OUT_OF_PERIOD_EXCEPTIONS } from '../scripts/data/outOfPeriodExceptions.mjs';

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
  ...OUT_OF_PERIOD_EXCEPTIONS,
];

/**
 * ⚠⚠ WHICH ENTRIES ARE *SUPPOSED* TO REACH A READER.
 *
 * `loaded` means the DATA is loaded — true of every out-of-period entry, since
 * the whole point of that registry is that TT keeps the publisher's rows. It
 * does NOT mean the finding is worth a banner. West Hollywood FY2023 is 2.4%
 * out of period; a banner there costs a reader attention and teaches them to
 * skip the FY2024 one that matters.
 *
 * So promotion is explicit: `readerFacing === true`, or a GA entry's `loaded`,
 * which has always carried both meanings for that register.
 */
const shouldSurface = (f) => f.readerFacing === true
  || (f.readerFacing === undefined && f.loaded === true);

/**
 * ⚠ TWO REGISTERS SPELL "LOADED" DIFFERENTLY, and both spellings are honest.
 * GA uses a `loaded` boolean; the out-of-period registry states it as
 * `disposition: 'loaded-as-published'` / `'loaded-below-publisher-total'`,
 * which is more precise about HOW it was loaded. The guard below only needs to
 * know that TT holds the figure, so it accepts either.
 */
const isLoaded = (f) => f?.loaded === true || String(f?.disposition ?? '').startsWith('loaded');

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
      .filter(shouldSurface)
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
      expect(isLoaded(byId.get(f.id)), `${f.id} is flagged but its register entry is not loaded`).toBe(true);
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

  /**
   * ⚠⚠ WEST HOLLYWOOD HAS TWO SEAMS, and the receiving side of each is the
   * one that reads wrong without a banner: FY2025 shows $132.28M against
   * FY2024's $249.36M and looks like spending halved. Flagging only the
   * odd-looking side leaves the other silently misleading.
   */
  it('⚠⚠ both sides of each West Hollywood seam are flagged', () => {
    for (const [giving, receiving] of [[2019, 2020], [2024, 2025]]) {
      expect(figureFlagFor('West Hollywood', 'CA', giving, 'transactions'), `FY${giving}`)
        .toBeTruthy();
      expect(figureFlagFor('West Hollywood', 'CA', receiving, 'transactions'), `FY${receiving}`)
        .toBeTruthy();
    }
    // ⚠ And the years whose skew is too small for a banner stay unflagged, or
    // the ones that matter stop standing out.
    for (const quiet of [2018, 2021, 2022, 2023]) {
      expect(figureFlagFor('West Hollywood', 'CA', quiet, 'transactions'), `FY${quiet}`)
        .toBeUndefined();
    }
  });

  /**
   * ⚠⚠⚠ A FIGURE THAT IS STILL GROWING MUST BE DATED ON THE PAGE.
   *
   * West Hollywood's FY2025-26 register is sync_frequency WEEKLY and the city
   * is still posting into it, so the total this page prints for FY2026 rises on
   * its own. The first version of that banner said "$275.28 million shown here"
   * and "25.0%" flat — within weeks it would have been contradicted by the
   * figure displayed beside it, and would have UNDERSTATED the distortion it
   * exists to describe. A banner that disagrees with its own page is worse than
   * no banner.
   *
   * So any register entry marked `stillGrowing` must have reader-facing copy
   * that pins its numbers to a date, and must say the numbers move.
   */
  it('⚠⚠ a still-growing figure states its numbers as of a date', () => {
    const growing = AUTHOR_FACING_REGISTERS.filter((f) => f.stillGrowing === true && shouldSurface(f));
    expect(growing.length, 'no still-growing entry is surfaced — has the registry changed?')
      .toBeGreaterThan(0);

    const surfacedById = new Map(Object.values(figureFlags).map((f) => [f.id, f]));
    for (const entry of growing) {
      const f = surfacedById.get(entry.id);
      expect(f, `${entry.id} is marked stillGrowing but is not surfaced`).toBeTruthy();

      // ⚠ "as of <date>" has to be in the ALWAYS-VISIBLE copy, not only in the
      // evidence a reader must open. A skimming reader is exactly who misreads
      // a stale number.
      const visible = `${f.headline} ${f.summary}`;
      expect(/\bas of\b/i.test(visible), `${entry.id} quotes figures with no "as of" date`).toBe(true);
      expect(/\d{1,2} \w+ \d{4}|\d{4}-\d{2}-\d{2}/.test(visible), `${entry.id} has no explicit date`)
        .toBe(true);

      // ⚠ And it must tell the reader the number moves, or "as of" reads as
      // precision rather than as a warning.
      expect(
        /grow|rise|rising|keeps? (growing|rising)|still (posting|adding)|each week/i.test(visible),
        `${entry.id} does not say the figure moves`,
      ).toBe(true);
    }
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
