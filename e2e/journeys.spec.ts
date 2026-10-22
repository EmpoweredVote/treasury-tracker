import type { Page } from '@playwright/test';
import { test, expect, PINNED_CITY, PINNED_SEARCH } from './support';

// Each title is the plain-English line a PR author sees when the journey
// breaks. If your change alters one of these journeys on purpose, update the
// test in the same PR.

async function searchPinned(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: /Search by city name or state/ }).fill(PINNED_SEARCH);
}

/** The search results for PINNED_SEARCH: one button per matching place. */
function searchResults(page: Page) {
  return page.getByRole('button', { name: new RegExp(`^${PINNED_SEARCH}\\b`) });
}

function resultFor(page: Page, state: string) {
  return page.getByRole('button', { name: new RegExp(`^${PINNED_SEARCH}, ${state}\\b`) });
}

/** The headline spending figure, e.g. "Money Out $1.8B". */
function moneyOut(page: Page) {
  return page.getByRole('button', { name: /^Money Out \$[\d.,]+/ });
}

async function openPinnedCity(page: Page) {
  await searchPinned(page);
  await resultFor(page, PINNED_CITY.state).click();
  await expect(page).toHaveURL(/[?&]entity=atlanta-ga\b/);
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(PINNED_CITY.name) })).toBeVisible();
}

test('Searching "Atlanta" shows each result with its state @phone', async ({ page }) => {
  await searchPinned(page);
  await expect(resultFor(page, 'GA')).toBeVisible();
  await expect(resultFor(page, 'IN')).toBeVisible();
  for (const result of await searchResults(page).all()) {
    await expect(result).toHaveAccessibleName(new RegExp(`^${PINNED_SEARCH}, [A-Z]{2}(?![A-Za-z])`));
  }
});

// Expected to fail until EmpoweredVote/treasury-tracker#280 (same-name places
// look alike). Today the two-letter state is the only cue. The PR that fixes
// #280 removes `test.fail()`, and from then on this guards against regression.
test('Atlanta, GA and Atlanta, IN can be told apart', async ({ page }) => {
  test.fail();
  await searchPinned(page);
  // Something beyond the two-letter state: full state name, county or kind of place.
  await expect(resultFor(page, 'GA')).toHaveText(/Georgia|County|\bcity\b/i);
  await expect(resultFor(page, 'IN')).toHaveText(/Indiana|County|\btown\b/i);
});

test('A city page shows figures and draws its chart @phone', async ({ page }) => {
  await openPinnedCity(page);
  await expect(moneyOut(page)).toBeVisible();

  // The chart is the icicle: a list of segments, one per category. Drawn means
  // segments exist AND have real width — an empty or collapsed chart fails.
  // `includeHidden`: below `sm` the strip is aria-hidden on purpose (the cards
  // below it are the screen-reader path), but it is still drawn on screen.
  const chart = page.getByRole('list', { name: /breakdown/i, includeHidden: true });
  await expect(chart).toBeVisible();
  const segments = chart.getByRole('listitem', { includeHidden: true });
  await expect(segments.first()).toBeVisible();
  for (const segment of await segments.all()) {
    await expect(segment).toHaveAttribute('aria-label', /\$[\d.,]+/);
  }
  const box = await segments.first().boundingBox();
  expect(box?.width ?? 0, 'the biggest chart segment has no width').toBeGreaterThan(0);
});

test('Changing the year changes the figures', async ({ page }) => {
  await openPinnedCity(page);
  await expect(moneyOut(page)).toBeVisible();
  const before = await moneyOut(page).textContent();
  const yearBefore = new URL(page.url()).searchParams.get('year');

  await page.getByRole('button', { name: 'Select fiscal year' }).click();
  const other = page.getByRole('option', { selected: false }).first();
  const year = (await other.innerText()).match(/\d{4}/)?.[0];
  expect(year, 'the year menu offers no other year').toBeTruthy();
  expect(year).not.toBe(yearBefore);
  await other.click();

  await expect(page).toHaveURL(new RegExp(`[?&]year=${year}\\b`));
  await expect.poll(() => moneyOut(page).textContent(), { message: 'the figures did not change' })
    .not.toBe(before);
});

// Expected to fail until EmpoweredVote/treasury-tracker#281: the app moves
// between views with history.pushState but has no popstate handler, so Back
// changes the URL and leaves the city on screen. The fix removes `test.fail()`.
test('Back from a city returns to search with the query kept', async ({ page }) => {
  test.fail();
  await openPinnedCity(page);
  await page.goBack();
  await expect(page.getByRole('textbox', { name: /Search by city name or state/ })).toHaveValue(PINNED_SEARCH);
  await expect(resultFor(page, PINNED_CITY.state)).toBeVisible();
});
