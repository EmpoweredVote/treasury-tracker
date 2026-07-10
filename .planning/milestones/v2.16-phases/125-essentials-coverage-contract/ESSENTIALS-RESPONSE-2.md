# Treasury Tracker ← Essentials: Response #2 (contract locked)

**From:** Essentials engineering · **To:** Treasury Tracker · **Date:** 2026-07-07
**Re:** Your answers to Response #1's 3 questions

All three settled. Contract is now frozen to your **1b** shape. Point-by-point:

## 1. Two-phase rollout — agreed, with your tweak
Adopted: **the `federal` record is OMITTED from `coverage.json` until Deliverable 2 is live.** No
dead target ships. D1's `coverage.json` will contain `cities` / `counties` / `states` only; the
`federal` key appears in the same build where the `browse_federal_officials=1` route + accounts-api
endpoint go live. (Change from Response #1, which proposed emitting it early — your way is cleaner.)

## 2. Federal target string — confirmed byte-for-byte
`/results?browse_federal_officials=1&browse_label=United+States` — matched verbatim when D2 lands.
Agreed on `+`→space via URLSearchParams.

## 3. Matcher assumptions — all confirmed ✔
Frozen to 1b, and confirming your four points against `src/lib/coverage.js`:
- **GEOIDs are strings, leading zeros preserved** — ✔ e.g. `"0643000"` (Long Beach), `"06037"` (LA County). Never numeric.
- **state / abbrev are 2-letter** — ✔ uppercase 2-letter (`"CA"`, `"OR"`). Your case-tolerance is belt-and-suspenders; we emit uppercase.
- **`geoids` is always an array** — ✔ we map `browseGovernmentList ?? []`, so single→`["…"]`, geoid-less (Bloomington)→`[]`. Never a bare string, never null.
- **labels verbatim from `coverage.js`** — ✔ emitted as-is. Heads-up on two real cases your normalizer will see:
  - County suffixes are inconsistent in source: `"Washington County, OR"` (has `, OR`) vs `"Washington County"` (UT, bare) — both exist. Your strip/normalize handles it; we won't "fix" them (they're the source of truth).
  - Cities are bare (`"Long Beach"`, `"Los Angeles"`), state carried in the `state` field.

## Edge you flagged — DC
Acknowledged: `COVERAGE_BROWSE_STATES` excludes DC (no statewide executives seeded), so a TT DC
**state** entity gets no Essentials icon. Accepted as-is — not changing coverage this milestone.
(DC **cities/counties** would still appear if any were ever added to `COVERAGE_STATES`; none today.)

---

**Status:** Contract locked. Essentials to implement D1 (generator + CORS, `federal` omitted) on
Chris's go, then D2 (accounts-api national-officials endpoint + `Results.jsx` route) as the follow-on
that unlocks the `federal` record. Next message here when D1 is deployed and DoD #1–3 pass.
