/**
 * The Indiana population join.
 *
 * ⚠⚠ THE DEFECT THAT MOTIVATES EVERY TEST HERE. A first attempt keyed on
 * `exactMatchKey`, which DELETES spaces. Census `Elizabeth town` and roster
 * `Elizabethtown` therefore produced the SAME key — two real, different Indiana
 * governments (Elizabeth, Harrison County, pop 201; Elizabethtown, Bartholomew
 * County, pop 417). The join matched Elizabethtown to Elizabeth's row, gave it
 * the wrong population, and reported ZERO ambiguities, because nothing checked
 * whether two governments had claimed the SAME census row.
 *
 * So this file pins three separate things:
 *   1. the key preserves word boundaries,
 *   2. the type-word trap (`Clay City` must not become `clay`),
 *   3. INJECTIVITY — one census row may back at most one government.
 *
 * ⚠ The same `exactMatchKey` is used by scripts/buildFlStatewideEntities.mjs.
 * The collision class is latent there; it is FLAGGED, not fixed here.
 */
import { describe, it, expect } from 'vitest';

import { wordKey, joinIndianaPopulations } from '../scripts/lib/inPopulation.mjs';

/** Minimal census rows, shaped like readPepCsv output. */
const place = (NAME, PLACE, pop, COUNTY = '000') => ({
  SUMLEV: '162', STATE: '18', COUNTY, PLACE, NAME, POPESTIMATE2024: String(pop),
});
const part = (NAME, PLACE, COUNTY, pop) => ({
  SUMLEV: '157', STATE: '18', COUNTY, PLACE, NAME, POPESTIMATE2024: String(pop),
});
const county = (CTYNAME, COUNTY, pop) => ({
  SUMLEV: '050', STATE: '18', COUNTY, CTYNAME, POPESTIMATE2024: String(pop),
});
const gov = (name, entityType, countyName = 'Somewhere') => ({
  key: `in-${name.toLowerCase().replace(/\W/g, '')}`, name, entityType, countyName,
});

describe('wordKey', () => {
  it('keeps a two-word name distinct from its concatenation', () => {
    // THE Elizabeth / Elizabethtown COLLISION. If this ever passes as equal, a
    // government silently takes another government's population.
    expect(wordKey('Elizabeth town')).not.toBe(wordKey('Elizabethtown'));
  });

  it('normalises case, punctuation and repeated spaces', () => {
    expect(wordKey("Prince's  Lakes")).toBe(wordKey('Princes Lakes'));
    expect(wordKey('St. Joseph')).toBe(wordKey('st joseph'));
  });
});

describe('joinIndianaPopulations', () => {
  it('matches a place whose census name carries a designator', () => {
    const r = joinIndianaPopulations({
      roster: [gov('Ellettsville', 'town')],
      placeRows: [place('Ellettsville town', '20000', 6500)],
      countyRows: [],
    });
    expect(r.problems).toEqual([]);
    expect(r.matched).toEqual([expect.objectContaining({ name: 'Ellettsville', population: 6500 })]);
  });

  it('does NOT strip a type word from the ROSTER name', () => {
    // `Clay City` is the town's real name. A rule that strips the trailing
    // "City" turns it into `Clay` and it matches nothing — or worse, matches a
    // different government. FL's Everglades City and PA's Oil City are the same
    // trap; eight Michigan villages are genuinely named `... City`.
    const r = joinIndianaPopulations({
      roster: [gov('Clay City', 'town')],
      placeRows: [place('Clay City town', '13006', 706), place('Clay town', '99999', 1)],
      countyRows: [],
    });
    expect(r.problems).toEqual([]);
    expect(r.matched[0].population).toBe(706);
  });

  it('REFUSES when two governments would claim the same census row', () => {
    // Injectivity. This is what `ambiguous: 0` failed to notice.
    const r = joinIndianaPopulations({
      roster: [gov('Elizabethtown', 'town'), gov('Elizabeth', 'town')],
      placeRows: [place('Elizabeth town', '20000', 201)],
      countyRows: [],
      aliases: [{ name: 'Elizabethtown', placeCode: '20000', censusName: 'Elizabeth town', reason: 'deliberately wrong, for the test' }],
    });
    expect(r.problems.join(' ')).toMatch(/claimed by more than one/i);
  });

  it('disambiguates two same-named places by the roster county', () => {
    const r = joinIndianaPopulations({
      roster: [gov('Springfield', 'town', 'Adams')],
      placeRows: [place('Springfield town', '111', 100), place('Springfield town', '222', 900)],
      partRows: [part('Springfield town', '111', '001', 100), part('Springfield town', '222', '003', 900)],
      countyRows: [county('Adams County', '001', 5000), county('Boone County', '003', 6000)],
    });
    expect(r.problems).toEqual([]);
    expect(r.matched[0].population).toBe(100);
  });

  it('uses a declared alias, keyed on the census PLACE code', () => {
    const r = joinIndianaPopulations({
      roster: [gov('LaPorte', 'city')],
      placeRows: [place('La Porte city', '42246', 22444)],
      countyRows: [],
      aliases: [{ name: 'LaPorte', placeCode: '42246', censusName: 'La Porte city', reason: 'Census spaces it' }],
    });
    expect(r.problems).toEqual([]);
    expect(r.matched[0].population).toBe(22444);
  });

  it('REFUSES a declared alias that is not observed', () => {
    // ⚠⚠ The South Carolina rule: a declared exception that is never exercised
    // rots into dead permission, so it must FAIL rather than sit unused.
    const r = joinIndianaPopulations({
      roster: [gov('Ellettsville', 'town')],
      placeRows: [place('Ellettsville town', '20000', 6500)],
      countyRows: [],
      aliases: [{ name: 'Nowhere', placeCode: '00000', censusName: 'Nowhere town', reason: 'stale' }],
    });
    expect(r.problems.join(' ')).toMatch(/alias.*not observed|never matched/i);
  });

  it('REFUSES an alias whose PLACE code is not in the census file', () => {
    const r = joinIndianaPopulations({
      roster: [gov('LaPorte', 'city')],
      placeRows: [place('La Porte city', '42246', 22444)],
      countyRows: [],
      aliases: [{ name: 'LaPorte', placeCode: '00001', censusName: 'La Porte city', reason: 'wrong code' }],
    });
    expect(r.problems.join(' ')).toMatch(/no census place with PLACE/i);
  });

  it('reports an undeclared miss rather than skipping it', () => {
    const r = joinIndianaPopulations({
      roster: [gov('Hardinsburg', 'town')],
      placeRows: [],
      countyRows: [],
    });
    expect(r.problems.join(' ')).toMatch(/no census place/i);
    expect(r.matched).toEqual([]);
  });

  it('accepts a DECLARED absence without a population and without a problem', () => {
    const r = joinIndianaPopulations({
      roster: [gov('Hardinsburg', 'town', 'Washington')],
      placeRows: [],
      countyRows: [],
      absent: [{ name: 'Hardinsburg', reason: 'no row of any SUMLEV in sub-est2024_18' }],
    });
    expect(r.problems).toEqual([]);
    expect(r.matched).toEqual([]);
    expect(r.declaredAbsent).toEqual(['Hardinsburg']);
  });

  it('REFUSES a declared absence that the census file actually covers', () => {
    // The mirror of the unobserved-alias rule: if the place IS there, the
    // declaration is a lie and the population should have been loaded.
    const r = joinIndianaPopulations({
      roster: [gov('Ellettsville', 'town')],
      placeRows: [place('Ellettsville town', '20000', 6500)],
      countyRows: [],
      absent: [{ name: 'Ellettsville', reason: 'claims absence' }],
    });
    expect(r.problems.join(' ')).toMatch(/declared absent.*but the census file has it/i);
  });

  it('matches counties by their own name against the county file', () => {
    const r = joinIndianaPopulations({
      roster: [gov('Adams County', 'county', 'Adams')],
      placeRows: [],
      countyRows: [county('Adams County', '001', 35777)],
    });
    expect(r.problems).toEqual([]);
    expect(r.matched[0].population).toBe(35777);
  });

  it('never returns a non-positive population', () => {
    const r = joinIndianaPopulations({
      roster: [gov('Ghost', 'town')],
      placeRows: [place('Ghost town', '30000', 0)],
      countyRows: [],
    });
    expect(r.problems.join(' ')).toMatch(/non-positive/i);
  });
});
