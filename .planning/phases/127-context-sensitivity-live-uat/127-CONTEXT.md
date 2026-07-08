# Phase 127: Context-Sensitivity + Live UAT - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The v2.16 capstone. Confirm the Essentials tether behaves context-sensitively **end-to-end
in the deployed app** (TETH-03) and pass Chris's live-app UAT across every entity tier
(VER-01). Phase 126 already built the gate logic (`resolveFeatureIcons` returns `[]` → no
icon when no real per-location link exists; tier-correct deep-links; always-light chip).
So Phase 127 is **verify-and-fix**, not new feature work: exercise the real cross-origin
`coverage.json` fetch in production, prove the icon appears only where a genuine link
exists, and fix any defects UAT surfaces before the phase closes.

**In scope:** live-app verification of the coverage gate across the UAT matrix; exercising
the real cross-origin fetch + graceful degradation; fixing defects found during UAT; a UAT
checklist artifact + Chris sign-off.
**Out of scope:** new products in the icon row (Compass/Read&Rank stay reserved); banner
imagery; any label-only fallback for geoid-less places (see D-127-01); changes to the
Essentials producer.
</domain>

<decisions>
## Implementation Decisions

### Context-sensitivity edge cases (TETH-03)
- **D-127-01 — Geoid-less covered places show NO icon (accepted, not a bug).** A place
  Essentials covers but with no census GEOID (e.g. Bloomington IN, `geoids: []`) renders
  **no icon**, because the city/county deep-link requires `browse_government_list=<geoid>`.
  This honors ICON-03 ("icon only when a real per-location link exists") and avoids a
  broken/coarse link. No label-only fallback is added this phase. UAT must confirm this
  behavior explicitly (covered-but-no-icon is correct, not a gate failure). Reverses the
  Phase-126 "flagged for 127" open item — resolved as "no icon".
- **D-127-02 — The uncovered-place negative case is REQUIRED in UAT.** Even though it was
  not pre-selected in discussion, TETH-03 and VER-01 explicitly require verifying that a
  genuinely-uncovered place shows no icon. This is distinct from D-127-01 (uncovered ≠
  covered-but-geoid-less). Kept in the matrix.

### UAT scope & failure handling (VER-01)
- **D-127-03 — Verify-and-fix within this phase.** Defects found during live UAT are fixed
  and re-verified inside Phase 127; the phase closes only when the full UAT matrix is green.
  The milestone stays self-contained (no punting fixes to a later phase/backlog).
- **D-127-04 — Pass bar = visual correctness + live network behavior.** For each entity:
  correct icon-or-absence AND correct Essentials destination when present. PLUS the live
  behaviors the fixture couldn't prove: (a) the real cross-origin fetch of
  `https://essentials.empowered.vote/coverage.json` succeeds (CORS `*`); (b) if Essentials
  is unreachable, the banner still renders and simply shows no icon (graceful degrade,
  COV-02); (c) no new console errors; (d) roughly one fetch per session (in-memory cache).

### UAT matrix (concrete entities — D-127-05)
Confirmed against live coverage.json + the TT DB this session:
- **Covered city:** Long Beach CA (GEOID `0643000`) → icon → `browse_government_list=0643000&browse_state=CA`.
- **Covered county:** Los Angeles County CA (`06037`) primary; **Salt Lake County UT** (`49035`)
  secondary (exercises the UT county-label form + state-scoped disambiguation). Both exist
  in TT and in Essentials' 16 covered counties.
- **Covered state:** California CA (all 50 covered) → `browse_state_officials=CA`.
- **Federal:** United States → `browse_federal_officials=1&browse_label=United+States` (icon SHOWS — the D2 reversal of the original "no federal icon").
- **Uncovered city (negative case, required — D-127-02):** a TT city confirmed absent from
  coverage.json (candidate: Plano TX; planner/UAT confirms absence) → NO icon.
- **Geoid-less covered edge (D-127-01):** Bloomington IN → covered but NO icon.
- **Light-mode legibility check (D-126-03):** confirm the light symbol on the navy chip reads
  well over banner art in BOTH light and dark themes.

### Claude's Discretion
- Exact UAT checklist format/artifact; whether to add a lightweight automated live-fetch
  smoke check vs. pure manual UAT; final choice of the confirmed uncovered-city entity.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & prior context
- `.planning/REQUIREMENTS.md` — TETH-03 (context-sensitivity), VER-01 (live UAT + Chris sign-off)
- `.planning/phases/126-tethered-feature-icon-row/126-CONTEXT.md` — D-126-01..06 (tooltip, layout, always-light chip, registry, geoid-less→null)
- `.planning/phases/126-tethered-feature-icon-row/126-VERIFICATION.md` — what 126 proved (fixture-backed) vs deferred to live UAT
- `.planning/phases/125-essentials-coverage-contract/125-CONTEXT.md` — coverage contract shape; D-01a CORS/origin

### Implementation (TT)
- `src/utils/featureIcons.ts` — `resolveFeatureIcons`/`buildEssentialsHref` (the gate); per-tier deep-links; geoid-less→null
- `src/utils/essentialsCoverage.ts` — `useEssentialsCoverage`, `fetchCoverage` (never-throws), `ESSENTIALS_URL`
- `src/components/FeatureIconRow.tsx` — chip/tooltip render (@floating-ui)
- `src/App.tsx` — hero-banner wiring (`data-essentials-coverage` seam + `<FeatureIconRow>`)

### Live producer (verify against, do not modify)
- `https://essentials.empowered.vote/coverage.json` — live catalog (cities 136, counties 16, states 50, federal)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveFeatureIcons(coverageRecord)` (Phase 126) — already returns `[]` for uncovered/geoid-less/null; the gate is implemented, 127 verifies it live.
- `data-essentials-coverage="covered|none"` seam on the hero div (Phase 125) — a stable DOM hook for UAT/DevTools inspection.
- `useEssentialsCoverage` in-memory cached fetch (Phase 125) — the one-fetch/session + never-throw behavior D-127-04 verifies live.

### Established Patterns
- Verification precedent: fixture-backed vitest (125/126) is green; 127 adds the LIVE cross-origin + visual dimension that fixtures can't cover.
- `npm run lint` is a broken gate in TT (pre-existing errors) — verify a lint DELTA, not a green exit, for any 127 fixes.

### Integration Points
- Real cross-origin fetch to the deployed Essentials origin; the deployed TT app at treasurytracker.empowered.vote (icon shipped live in Phase 126).
</code_context>

<specifics>
## Specific Ideas
- UAT is Chris's live-app sign-off (VER-01) — the human gate, not just automated checks.
- The federal entity SHOWING an icon is the headline behavior change of this milestone (reverses the original "no federal target" assumption) — make it a prominent UAT line.
</specifics>

<deferred>
## Deferred Ideas
- Label-only Essentials fallback for geoid-less covered places (would light Bloomington IN's icon) — explicitly declined this phase (D-127-01); revisit only if Essentials adds a label-only browse contract.
- Compass / Read & Rank live resolvers — reserved registry slots; future milestone.
- Banner imagery work ("Smart Banner" imagery) — deferred out of v2.16 from the start.

None of the above are in Phase 127 scope.
</deferred>

---

*Phase: 127-context-sensitivity-live-uat*
*Context gathered: 2026-07-08*
