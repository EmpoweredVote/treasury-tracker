import { describe, it, expect } from 'vitest';
import { revenueOpening, heroSubtitle } from './narrativeCopy';

/**
 * ⚠ Found while verifying the state source chip, 2026-08-23. The narrative's
 * revenue sentence opened with the words "The city" for EVERY non-nonprofit
 * entity, so the New York state page read:
 *
 *   "The city funded this through $93.9 billion in revenue"
 *
 * — on a page whose own headline is "New York Finances" and whose population is
 * 20.2 million. The same sentence was wrong on every county too. Cities were right
 * by accident, and the federal page never rendered this narrative at all (it uses
 * FederalLanding) — verified in the running app, after I first assumed otherwise.
 * Chris's call: use the entity's own name.
 *
 * The paragraph above it already said "New York spent ..." correctly, which is why
 * this survived: the defect is one clause into a paragraph that otherwise reads
 * fine, and no figure is wrong.
 */
describe('revenueOpening', () => {
  it('names a state rather than calling it a city', () => {
    expect(revenueOpening('New York', false, true)).toBe('New York funded this through');
  });

  it('names a county', () => {
    expect(revenueOpening('Travis County', false, true)).toBe('Travis County funded this through');
  });

  it('names the federal entity, if it is ever asked', () => {
    // The federal page renders FederalLanding, not this narrative — so this is the
    // helper being correct for an input it does not currently receive, not a claim
    // that the federal page was affected.
    expect(revenueOpening('United States', false, true)).toBe('United States funded this through');
  });

  it('keeps the present tense for a year that has not closed', () => {
    expect(revenueOpening('Modesto', false, false)).toBe('Modesto funds this through');
  });

  it('keeps the nonprofit wording, which was already correct', () => {
    expect(revenueOpening('Empowered Vote', true, true)).toBe('Empowered Vote raised');
    expect(revenueOpening('Empowered Vote', true, false)).toBe('Empowered Vote raises');
  });

  it('never says "the city" about anything', () => {
    // The defect, stated directly.
    for (const name of ['New York', 'Travis County', 'United States', 'Modesto']) {
      for (const past of [true, false]) {
        expect(revenueOpening(name, false, past).toLowerCase()).not.toContain('the city');
      }
    }
  });
});

/**
 * ⚠ The hero line said "Explore how public funds are allocated and spent." on
 * EVERY page, including Empowered Vote's own — where the money is donations,
 * not public funds. Same shape as the revenueOpening defect above.
 */
describe('heroSubtitle', () => {
  it('keeps the public-funds line for governments', () => {
    expect(heroSubtitle(false)).toBe('Explore how public funds are allocated and spent.');
  });

  it('never calls a nonprofit’s money public funds', () => {
    // The defect, stated directly.
    expect(heroSubtitle(true).toLowerCase()).not.toContain('public funds');
  });

  it('says whose money it is on the nonprofit page', () => {
    expect(heroSubtitle(true)).toBe('Explore how this nonprofit raises and spends its money.');
  });

  it('makes no completeness claim — the page publishes the bank balance only', () => {
    // EV also holds an untransferred Givebutter wallet balance, so "every dollar"
    // or "all of our money" would be an overclaim on a transparency page.
    const s = heroSubtitle(true).toLowerCase();
    for (const claim of ['every dollar', 'every penny', 'all of', 'complete', 'full accounting']) {
      expect(s).not.toContain(claim);
    }
  });
});
