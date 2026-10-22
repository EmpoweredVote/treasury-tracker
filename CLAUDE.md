# Treasury Tracker — project notes for Claude

## Real data, current code (read before building UI)

Volunteers and designers: build on live public data, never on invented data. Invented data in a
component becomes rework for whoever merges the PR.

- **`npm run dev` with no `.env` reads the live public API** through the dev server's `/api` proxy
  (`vite.config.ts`). No keys are needed. Leave `VITE_API_URL` unset: an absolute value here points the proxy somewhere else (a local backend, for example).
- **Fetch through `src/data/dataLoader.ts` and `src/data/entityQueries.ts`.** Never type real-looking names, numbers, dates, quotes or IDs into a
  component, not even as placeholders. Interface copy is fine.
- **If a request fails, say so and stop.** Report the URL and status. Do not swap in invented data.
- **Data the API does not serve yet** goes in one module under `src/mocks/`, shaped like the
  response, starting with `// Stands in for: GET /api/<route> — not yet served by the API`. List it
  in the PR under "Data this needs from the API".
- **Locally you are signed out.** A failed or 401 `/api/auth/session` call in the console is expected.
  Account and user data is off-limits for design work; mock signed-in states under `src/mocks/`.
- **Start from current `main`:** `git fetch origin && git switch -c <branch> origin/main`. Use
  `@empoweredvote/ev-ui` components instead of copying or restyling them.
- **Standalone HTML prototypes** cannot call the API from the page. Fetch real records first
  (`curl https://accounts-api.empowered.vote/api/...`), embed them, and note the date fetched.

The `ev-designer` skill in EmpoweredVote/ev-ui (`plugins/ev-designer/`) has the index of public
routes with sample responses.

## Browser journeys (`e2e/`)

Journeys in `e2e/` test what users do. If your change alters a journey on purpose, update its test in
the same PR. Run `npm run e2e` locally (first time: `npx playwright install chromium`; if port 4173 is
taken, set `E2E_PORT`). They run on every PR as the `journeys` job, against the PR's own build and the
live API. A test marked `test.fail()` guards a known open bug; the PR that fixes the bug removes the mark.
