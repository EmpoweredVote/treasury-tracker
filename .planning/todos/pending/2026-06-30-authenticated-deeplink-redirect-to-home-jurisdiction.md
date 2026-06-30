---
created: 2026-06-30T22:32:00.000Z
title: Authenticated users get silently redirected to their home jurisdiction on any unrecognized deep-link
area: frontend-routing
files:
  - src/App.tsx:201-310
origin_phase: 106
requirements: []
---

## Problem

Surfaced during Phase 106 Chris UAT ("trying to link directly only works in incognito, otherwise I get
teleported to Los Angeles").

The mount effect in `src/App.tsx` (lines 201-310) only honors a deep-link when a recognized `entity=`
param is present (line 208 bypasses auth routing and loads that entity). If the URL lacks a valid
`entity=` param — e.g. a malformed/short/legacy link, or a link using different param names — `entityParam`
is null and the app falls through to **auth-based routing**: an authenticated Connected/Empowered user is
auto-navigated to their own home jurisdiction city (`session.jurisdiction.city`), which for the tester is
Los Angeles. In incognito (no token) the same URL lands on the guest landing page instead.

The immediate trigger (UAT checklist links using `?state=XX&fy=YYYY`) was fixed in 106-03 by switching to
the canonical `?entity=<slug>&year=<fy>&dataset=<type>` format. But the underlying behavior remains: a
signed-in user who follows a shared link the app can't parse is silently teleported home rather than shown
the link target or an honest "couldn't resolve this link" state.

## Solution (proposed, to scope later)

- When a URL has query params that look like a deep-link attempt (any of `entity`, `state`, `dataset`,
  `year`, `fy`, `fiscal_year`) but no resolvable `entity`, do NOT silently auto-navigate the authenticated
  user to their home city. Either (a) attempt to resolve common alternate param names (`state`→match the
  state node, `fy`→`year`) before falling back, and/or (b) show the requested-but-unresolved state on the
  landing page rather than overriding intent.
- Consider honoring a `state=<ABBR>` param as a first-class deep-link to the state node (maps to
  `entity=<statename>-<abbr>`), since state-level links are now a common share target after v2.11/v2.12.

Out of Phase 106 scope (frontend/auth routing, not v2.12 data). Candidate for a future routing/UX phase.
