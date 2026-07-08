# Requirements — v2.16 Tethered Icons & Smart Banner

**Milestone goal:** Add a context-sensitive, cross-product "tethered feature-icon" row to Treasury Tracker's hero banner — the reciprocal of Essentials' Phase 187 tethered-icon row. The banner's *current entity* (city / county / state / federal) deep-links into other Empowered Vote products, starting with the Essentials yellow magnifying glass (bottom-right), rendered **only when Essentials actually covers that location**. A generic product registry reserves fixed, non-rendering slots for Compass and Read & Rank so they plug in later with zero layout change.

**The reciprocal contract (already built on the Essentials side, Phase 187):**
- Essentials' `SectionBanner` shows a bottom-right row of circular semi-transparent chips, one per EV product, each deep-linking the banner's own location.
- Essentials learns TT's coverage by calling TT's `/treasury/cities` and matching by name + state (`treasury.js`); it deep-links `financials.empowered.vote/?entity=<name-state>`.
- TT is the mirror: it must learn Essentials' coverage the same way and deep-link into Essentials' `/results?browse_*` routes.

**Constraints (standing):**
- **"Smart Banner" = the context-sensitive tether logic only** — no banner-image changes this milestone (per-image Wikimedia attribution and low-res state-flag fixes stay deferred).
- **Frontend-only on the TT side** — no TT DB/schema changes. TT's banner is a plain `div` in `App.tsx` (image + gradient + title + Wikimedia credit), not a `SectionBanner` component.
- **Visual cohesion with Essentials:** ~36px circular chip, `rgba(13,17,23,0.55)` bg + `blur(2px)`, ~20px icon, 8px gap, `@floating-ui` tooltip on hover + keyboard focus, `aria-label` on the link. Icons from `C:\ev-landing\ev-landing-main\icons\` copied into TT `public/`.
- **TT is light + dark** (Essentials' banner is dark-only) — pick the icon light/dark variant per active theme; the chip background must keep any icon legible in both themes.
- **No dead links / no greyed placeholders** — an icon renders only when a real per-location link can be built; the row left-aligns whatever is live.
- **EV nonprofit:** free only; $5 AI-spend gate (no AI needed here).

---

## v2.16 Requirements

### Coverage Contract (COV)

- [x] **COV-01** — Essentials publishes its coverage catalog (`COVERAGE_STATES` / `COVERAGE_COUNTIES` / `COVERAGE_BROWSE_STATES` from `src/lib/coverage.js`, each area carrying its Census GEOID(s), state abbrev, label, and `hasContext` flag) as a **public, unauthenticated, fetchable resource** — a **build-time-generated static `coverage.json`** in the Essentials static site's `public/` (generator reads `coverage.js` as the single source of truth), served at the Essentials origin with a **CORS header** allowing TT's origin — reciprocal to TT's `/treasury/cities`. *(Cross-repo: `essentials`.)*
- [x] **COV-02** — TT fetches the Essentials coverage catalog at runtime (once per session, cached in-memory, mirroring `wikiImage.ts`), and never blocks or breaks banner render on a slow/failed/empty fetch — a fetch failure degrades to no tether icon (async icon pop-in), exactly like TT's existing hero-image graceful fallback.
- [x] **COV-03** — TT resolves the current entity to an Essentials coverage record by **name + state** (city/county tier), by **state abbrev** (state tier), or by **entity_type** (federal tier), reusing Essentials' `normalizePlace`-style loose matching (plus stripping trailing `County` / `, ST`) so "St."/"Saint" and punctuation differences don't cause false misses; matching is **tier-aligned** and returns null on a wrong/absent state; a match yields the GEOID(s) / abbrev / federal target needed to build the deep-link.
- [x] **COV-04** — Essentials gains a **national-officials browse route** (e.g. `/results?browse_federal_officials=1`) surfacing federal-tier officials (President/VP, U.S. Senate, U.S. House, Cabinet, Federal Judiciary, Independent Agencies — data already classified in `src/lib/classify.js`), and the published catalog carries a **federal record** targeting it, so TT's federal "United States" entity resolves to a real Essentials deep-link. *(Cross-repo: `essentials`; folded into Phase 125 alongside COV-01. Reverses the original "no federal target" assumption.)*

### Tethered Icon Row (ICON)

- [ ] **ICON-01** — TT renders a tethered feature-icon row on the hero banner, positioned **bottom-right**, as circular semi-transparent chips visually cohesive with Essentials' `SectionBanner` chip treatment, and it **never obscures the banner title** (bottom-left) or the Wikimedia credit (currently bottom-right — reconcile placement).
- [ ] **ICON-02** — each icon exposes an accessible tooltip naming the product (e.g. "Essentials") that appears on **both hover and keyboard focus**, plus an `aria-label` on the link; the icon is a real external `<a target="_blank" rel="noopener noreferrer">`.
- [ ] **ICON-03** — an icon renders **only** when a real per-location link exists for that product; there are no dead, greyed, or placeholder icons, and the row left-aligns whatever is live (no gaps).
- [ ] **ICON-04** — each icon picks the correct light/dark SVG variant for the active TT theme, and the chip keeps the icon legible over any banner art in both themes.

### Cross-Product Tethering (TETH)

- [ ] **TETH-01** — the Essentials icon deep-links the **banner's current entity** into Essentials — city/county → `/results?browse_government_list=<geoid>&browse_state=<abbr>&browse_label=<label>`; state → `/results?browse_state_officials=<abbr>&browse_label=<label>`; federal → `/results?browse_federal_officials=1&browse_label=United States` (per COV-04) — and never the user's own saved/broker location.
- [ ] **TETH-02** — the icon row is driven by a **generic product registry** with a fixed reserved order `[essentials, compass, readrank]`; each product declares a per-location resolver returning a link-or-null. Only Essentials is a live entry; Compass and Read & Rank are reserved (documented) non-rendering slots that plug in with zero layout change once each has a per-location contract.
- [ ] **TETH-03** — context-sensitivity holds end-to-end: a city/county with no Essentials coverage shows **no** Essentials icon; the federal ("United States") entity **shows** the Essentials icon linking to Essentials' national-officials browse (per COV-04); a covered state/city shows the icon linking to the correct Essentials browse.

### Verification (VER)

- [ ] **VER-01** — verify the tether end-to-end in the live app: a covered city, a covered county (if any TT county overlaps Essentials coverage), a covered state, an *uncovered* city, and the federal entity (now expected to show the icon → national-officials browse, per COV-04) each render the correct icon-or-absence and, when present, the icon opens the correct Essentials location. Chris live-app UAT sign-off.

---

## Future Requirements (deferred)

- [ ] **TETH-FUT-01** — wire Compass and/or Read & Rank tether icons once each product exposes a per-location deep-link contract (reserved slots ship this milestone).
- [ ] **BANR-FUT-01** — reciprocal population/stats slot on the TT banner (analog of Essentials' Phase 188 Location Stats Strip).
- [ ] **BANR-FUT-02** — banner-imagery improvements: per-image Wikimedia attribution (replace the generic "Wikimedia Commons" credit) and fixing low-res state-flag banners. *(Explicitly out of "Smart Banner" scope.)*
- [ ] **VOTES-01** — votes/amendments exploration hub (the eventual mission destination).
- [ ] **SRCSTD-01** — backfill the always-sourced standard to city/state data.

## Out of Scope (this milestone)

- **TT-side banner-image changes** — "Smart Banner" is the tether logic only; imagery stays as-is (see BANR-FUT-02).
- **TT DB / schema changes** — the feature is frontend-only; coverage lives on the Essentials side.
- **A stats/population slot on the TT banner** — reserved conceptually (top-right, per Essentials' D-07) but not built (see BANR-FUT-01).
- **Reverse-direction changes to Essentials' own banner** — Essentials' Phase 187 already ships; this milestone touches Essentials only to publish its coverage catalog (COV-01) and add the national-officials browse route (COV-04).
- **Paid APIs / AI spend** — none required.

---

## Traceability

Each requirement maps to exactly one phase (12/12 mapped).

| Requirement | Phase |
|-------------|-------|
| COV-01 | 125 — Essentials Coverage Contract |
| COV-02 | 125 — Essentials Coverage Contract |
| COV-03 | 125 — Essentials Coverage Contract |
| COV-04 | 125 — Essentials Coverage Contract |
| ICON-01 | 126 — Tethered Feature-Icon Row |
| ICON-02 | 126 — Tethered Feature-Icon Row |
| ICON-03 | 126 — Tethered Feature-Icon Row |
| ICON-04 | 126 — Tethered Feature-Icon Row |
| TETH-01 | 126 — Tethered Feature-Icon Row |
| TETH-02 | 126 — Tethered Feature-Icon Row |
| TETH-03 | 127 — Context-Sensitivity + Live UAT |
| VER-01 | 127 — Context-Sensitivity + Live UAT |
