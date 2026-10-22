import { test, expect, apiIsUp } from './support';

// The journeys need the live API. If this fails on its own, the API is down,
// not the PR (global-setup turns that into a skip, not a red check).
test('live API returns the place index', async ({ request }) => {
  expect(await apiIsUp(request)).toBe(true);
});
