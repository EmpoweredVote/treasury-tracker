/**
 * Sentence openings for the plain-language narrative, kept out of the component
 * so they can be tested.
 */

/**
 * How the revenue sentence begins: "<name> funded this through $X in revenue…".
 *
 * ⚠ This said **"The city"** for every non-nonprofit entity until 2026-08-23, so
 * the New York state page read *"The city funded this through $93.9 billion"* —
 * under a headline saying "New York Finances", beside a population of 20.2 million.
 * Every COUNTY read the same way. Found while verifying the state source chip;
 * Chris's call was to use the entity's own name, which is what the nonprofit branch
 * had always done.
 *
 * ⚠ Blast radius, measured rather than assumed: **states and counties**. Cities were
 * right by accident (they are cities), and the FEDERAL page never showed this
 * sentence at all — `entity_type === 'federal'` renders `FederalLanding` instead of
 * this narrative, which I initially got wrong and checked in the running app.
 *
 * It survived because the paragraph *above* it already names the entity correctly
 * ("In 2024, New York spent $115.8 billion…"), so the defect is one clause inside
 * a paragraph that otherwise reads well — and no figure is wrong, which is why no
 * gate would ever have flagged it.
 *
 * @param name  the entity's own display name
 * @param isNonprofit  nonprofits raise income; governments fund spending with revenue
 * @param isPast  true once the period has closed — past tense rather than present
 */
export function revenueOpening(name: string, isNonprofit: boolean, isPast: boolean): string {
  if (isNonprofit) return `${name} ${isPast ? 'raised' : 'raises'}`;
  return `${name} ${isPast ? 'funded' : 'funds'} this through`;
}
