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
the same PR. Run `npm run e2e` locally (first time: `npx playwright install chromium`; if port 4174 is
taken, set `E2E_PORT`). They run on every PR as the `journeys` job, against the PR's own build and the
live API. A test marked `test.fail()` guards a known open bug; the PR that fixes the bug removes the mark.

## Render settings live in ev-infra

This repo's Render services (`treasury-tracker-frontend`) are managed by the Render Blueprint in
[`EmpoweredVote/ev-infra`](https://github.com/EmpoweredVote/ev-infra) (`render.yaml`).

- Build and start commands, rewrites, headers, custom domains, plans, cron
  schedules and build filters change **only through a PR to ev-infra**. Render
  syncs its `main` branch automatically.
- A setting changed in the Render dashboard is **undone on the next sync**.
- Env var **values** are the exception: set them in the Render dashboard. Add a
  new variable's name to ev-infra (with `sync: false`) so the record stays complete.
- Do not add a `render.yaml` to this repo. Render does not read it.

## Never aggregate the big tables in production

The production database (E.V Backend, `kxsdzaojfaibhuzmclfq`) runs on a small compute size with a
daily Disk IO budget. One whole-table read of a large table uses gigabytes of that budget. In
November 2026 audit scripts and ad-hoc counts used it up (ev-cto decision 0038).

- **Never run `count(*)`, `sum()`, `count(distinct …)` or any other unfiltered aggregate** on these
  tables in production: `transparent_motivations.contributions`, `treasury.budgets`,
  `treasury.budget_categories`, `treasury.transactions`, `essentials.legislative_votes`.
- **For a row estimate,** read `pg_class.reltuples` (or `pg_stats` for distinct counts). For a
  sample, use `TABLESAMPLE SYSTEM (1)`.
- **Never page an RPC that scans a whole table with `.range()`.** PostgREST re-runs the function for
  every page. Page by key instead: pass the last key back in, as `source_url_census_page` does.
- **For whole-table work on contributions,** use the local FEC mirror
  (`ev-accounts/backend/scripts/033-fec-mirror-bootstrap.ts`), not production.
- **After adding a script that reads the database,** check `extensions.pg_stat_statements`
  (`shared_blks_read`, `temp_blks_written`) after one run.
