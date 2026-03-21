# Phase 1: Routing Shell + Data Namespacing - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire React Router into the app so `/bloomington` renders the existing budget tracker identically to v1.0, `/` shows a placeholder city picker, and unknown slugs (including `/los-angeles`) redirect to `/`. Simultaneously migrate all data files from `public/data/` to namespaced paths (`public/data/bloomington/`) and eliminate the silent mock-data fallback — all in one atomic commit.

Phase 2 will make the city picker config-driven. Phase 4 will add real LA data. This phase only establishes the routing shell and data path structure.

</domain>

<decisions>
## Implementation Decisions

### City picker at `/`
- Styled placeholder component (~30 lines), not a bare link
- Shows a Bloomington card ("Bloomington, IN" + "View budget →" link to `/bloomington`)
- Shows a Los Angeles "Coming Soon" card (hardcoded — Phase 2 makes it config-driven)
- Uses its own page-level layout with existing CSS variables/tokens (colors, fonts) — NOT wrapped in SiteHeader
- Phase 2 replaces this component entirely; no investment in config system here

### Back-to-cities navigation (ROUTE-04)
- Rendered as a `<Link to="/">← Cities</Link>` using React Router's `Link`
- Placed **above** the `SiteHeader` component in `CityPage.tsx` — does not modify or pass props into SiteHeader
- Visible on every city page; integrates with router history (browser back also works)

### dataLoader.ts
- **Delete the file entirely** — it is dead code (never imported by App.tsx) and contains the mock-data fallback pattern this phase eliminates
- The live fetch implementations are `loadDataset()` in App.tsx and the inline fetch in `LinkedTransactionsPanel.tsx`

### Error display when data file is missing
- Improve error message to show the failed file path and dataset type: e.g., "Could not load operating budget (2025). File: /data/bloomington/budget-2025.json"
- Error state includes a "← Back to Cities" link so users are not stuck on a broken page
- Existing error UI container (App.tsx ~line 225) is kept; only the message content and the back-link are added

### Claude's Discretion
- Exact CSS class names and styling for city picker cards and the "← Cities" back link
- Whether to add a `pages/` directory or keep CityPickerPage.tsx and CityPage.tsx flat in `src/`
- Internal structure of AppRouter.tsx (whether App.tsx becomes the router shell or a new file is created)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Routing and data loading (live implementations)
- `src/App.tsx` — Contains the live `loadDataset()` function (lines 24–53) and both LinkedTransactionsPanel call sites (lines ~427 and ~462). This is the file to extract CityPage from.
- `src/main.tsx` — Currently wraps `<App />` directly — needs BrowserRouter added here
- `src/components/LinkedTransactionsPanel.tsx` — Line 67 fetches `./data/transactions-${fiscalYear}-index.json` directly; needs citySlug prop added

### Dead code to delete
- `src/data/dataLoader.ts` — Dead code (never imported). Contains mock-data fallback. Delete in Phase 1.

### Netlify / deploy config (do not duplicate redirect rules)
- `netlify.toml` — Already has `/* /index.html 200` SPA catch-all. Do not add to `_redirects`.
- `public/_redirects` — Has `/api/*` proxy rule only. Leave as-is.

### No external specs
No external design docs or ADRs — requirements are fully captured in decisions above and REQUIREMENTS.md.

</canonical_refs>

<specifics>
## Specific Ideas

- The "← Cities" link label is `← Cities` (not "Back", not "Home")
- The Bloomington city picker card shows: city name + "View budget →" as the link text
- Los Angeles card is visually distinct (muted/disabled appearance) with "Coming Soon" label
- Error message format: "Could not load {dataset} data ({year}). File: /data/{citySlug}/{filename}.json"
- All data fetch paths change from `./data/` to `/data/` (absolute) — required because relative paths break under routing when URL is `/bloomington`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SiteHeader` from `@chrisandrewsedu/ev-ui`: Used in App.tsx. CityPage keeps it. CityPickerPage uses its own layout (no SiteHeader).
- Existing error container at App.tsx ~line 225: Reuse the markup, update message content and add Link
- CSS variables already defined in `App.css` / `index.css`: Use these in city picker cards for consistency

### Established Patterns
- `loadDataset()` in App.tsx (lines 24–53): The authoritative data loader. Update signature to accept `citySlug: string`. Absolute paths only.
- Error boundary pattern: `if (!budgetData)` check at App.tsx ~line 225 — kept, message improved
- `LinkedTransactionsPanel` call sites at App.tsx ~lines 427 and 462: Both must receive `citySlug={slug}` prop after CityPage extraction

### Integration Points
- `main.tsx` → add `<BrowserRouter>` wrapper around AppRouter (or App if App becomes router shell)
- `App.tsx` → extract budget tracker body into `CityPage.tsx`; App.tsx becomes router shell OR new `AppRouter.tsx` created
- `public/data/*.json` (22 files) → move to `public/data/bloomington/*.json`
- `src/data/dataLoader.ts` → delete

</code_context>

<deferred>
## Deferred Ideas

- Config-driven city picker (card grid from city registry) — Phase 2
- Real "Los Angeles" route with data — Phase 4
- Improving the loading state ("Loading data..." text) — out of scope for Phase 1
- Styling the city picker to match final Phase 2 design — Phase 2 replaces this component anyway

</deferred>

---

*Phase: 01-routing-shell-data-namespacing*
*Context gathered: 2026-03-21*
