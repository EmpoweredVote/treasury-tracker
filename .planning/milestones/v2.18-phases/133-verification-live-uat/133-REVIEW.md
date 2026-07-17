---
phase: 133-verification-live-uat
reviewed: 2026-07-17T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/verify-phase133-rederive.mjs
  - scripts/verify-phase133-audit.mjs
  - scripts/verify-phase133-tether.mjs
findings:
  critical: 2
  warning: 1
  info: 2
  total: 5
status: resolved
resolved: 2026-07-17T00:00:00Z
resolution: "CR-01, CR-02, WR-01 all fixed 2026-07-17 (commit follows). Audit + tether re-run green after fixes (audit exit 0, tether exit 0). IN-01/IN-02 left as-is (low-risk; CR-02 resolved the one place IN-02 turned harmful)."
---

> **Resolution (2026-07-17):** The two Critical and one Warning findings were fixed inline in the verification harnesses and both scripts re-run clean:
> - **CR-01 (fixed)** — `reachable()` now re-applies the `pdf-or->=400KB` content bar (plus a 206-partial allowance) on the ranged-GET fallback, so a soft-404/login-wall 200/206 is no longer treated as reachable. Verified: Sahuarita's real PDFs still pass on content-type; South Tucson's `404`/`text/html` now correctly routes to Wayback corroboration rather than passing on status alone.
> - **CR-02 (fixed)** — the D-04(c) residue query now destructures `error` and throws on it (and uses `?? 0`), so a failed query surfaces as a failure instead of coalescing to a false "0 residue / PASS".
> - **WR-01 (fixed)** — the ported `matchEntityToCoverage` now gates city-tier matching on the real `CITY_TIER_TYPES` allow-list and returns `null` for other tiers, matching production, so a future copy-forward to a state/federal phase stays correct.
> - **IN-01 / IN-02 (not changed)** — low-risk; the one place IN-02 turned harmful was CR-02, which is now fixed.

# Phase 133: Code Review Report

**Reviewed:** 2026-07-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the three Phase 133 verification/audit harnesses (blind re-derivation, source-chain audit, tether pre-determination) for correctness of their verification logic — specifically for false-negative/false-positive risk in the pass/fail assertions, unsafe handling of untrusted remote data, and service-key handling, per the review's context note. The read-only design, exact-0 tolerance, and documented Oro Valley/WAF dispositions are intentional and not flagged.

Two BLOCKER-level findings were found in `verify-phase133-audit.mjs`: (1) the `reachable()` helper's ranged-GET fallback path drops the content-type/length validation that its own HEAD-check path enforces, so a host that returns any 2xx/206 status on the fallback GET is marked "reachable" even if the body is an HTML soft-404/error page rather than the ACFR PDF — this is the exact failure mode the D-04(b) assertion exists to catch, and it is least protected for Sahuarita, the one host with no WAF-403 fallback to lean on. (2) The D-04(c) orphan-residue check discards the Supabase `error` field from a `count`-only query and coalesces a failed/errored count to `0` via `count || 0`, which means a query failure (permissions, table rename, transient issue) silently reports as "0 residue / PASS" instead of surfacing as a failure — undermining the very assertion it's meant to prove.

One WARNING was found in `verify-phase133-tether.mjs`: its ported `matchEntityToCoverage` is not actually behaviorally verbatim with the production `src/utils/essentialsCoverage.ts` matcher, despite the file's own comment claiming so — it routes every non-`county` entity type into the city-tier branch instead of gating on the real `CITY_TIER_TYPES` set and returning `null` for `state`/`federal`/other tiers. This doesn't affect the current four-city run (all entities are `entity_type: 'city'`), but it is a latent landmine if this harness is ever reused/extended to other tiers.

Two INFO items round out the review: a municipality-ID sanity check in the rederive/audit-adjacent code only logs a note rather than failing, and Supabase query results are destructured without checking `.error` throughout all three files (mostly fails loud via a downstream crash, but is the root cause of finding CR-02).

## Critical Issues

### CR-01: `reachable()` fallback path skips the content-type/length check it claims to enforce

**File:** `scripts/verify-phase133-audit.mjs:130-152` (specifically the final `return` at line 148)
**Issue:** The function's own doc comment (lines 114-120) states the reachability bar is "HTTP 200 + (application/pdf OR body >= 400KB)". The HEAD-request branch (lines 132-135) actually enforces that bar. But when HEAD doesn't satisfy it and the code falls through to the ranged-GET retry (lines 138-148, added because "some CDNs reject HEAD"), the final `return` statement:
```js
return { ok: res.ok || res.status === 206, status: res.status, ct, len, expected403: false };
```
only checks the HTTP status — it never re-applies the `ct.includes('pdf') || len >= 400_000` test to the GET response, even though `ct` and `len` are computed right above it and are otherwise unused after that point. Any host that answers the ranged GET with a `200`/`206` (e.g., a CivicPlus/DocumentCenter "not found" page, a login-wall page, or any other soft-404 that doesn't bother to 404) is marked `ok: true` — a false PASS for assertion D-04(b·2). This is most exposed for **Sahuarita**, which is the one city configured with `waf403: false` and therefore has no 403-based safety net to catch a broken link either — it depends entirely on this GET fallback path validating content, which it doesn't.
**Fix:**
```js
res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-8' }, redirect: 'follow' });
ct = res.headers.get('content-type') || '';
len = parseInt(res.headers.get('content-length') || '0', 10);
if (res.status === 403 && waf403Expected) return { ok: true, status: res.status, ct, len, expected403: true };
const contentOk = ct.includes('pdf') || len >= 400_000 || res.status === 206; // 206 partial-content on a Range request implies the origin served real bytes
if (!(res.ok && contentOk) && waf403Expected) {
  const snap = await waybackCorroborated(url);
  if (snap) return { ok: true, status: res.status, ct, len, expected403: true, waybackCorroborated: true };
}
return { ok: res.ok && contentOk, status: res.status, ct, len, expected403: false };
```

### CR-02: Orphan-residue count silently defaults to 0 on a Supabase query error, masking a real check failure as a PASS

**File:** `scripts/verify-phase133-audit.mjs:218-224`
**Issue:**
```js
for (const dirKey of Object.keys(CITIES)) {
  const { count } = await sb.from('data_sources').select('*', { count: 'exact', head: true }).ilike('dataset_id', `${CITIES[dirKey].slug}-acfr%`);
  residueTotal += count || 0;
  residueDetail.push(`${dirKey}:${count || 0}`);
}
```
The `error` field of the Supabase response is never destructured or checked. If this query fails for any reason (a transient network blip, a permissions change, a table rename), `count` comes back `null`, `count || 0` silently coalesces it to `0`, and the printed detail line reads `"OroValley:0"` — indistinguishable from a genuine "checked, found nothing" result. `record('D-04(c) ...', residueTotal === 0, ...)` then reports **PASS**, even though the check never actually ran. This is precisely the false-positive-verification failure mode the review brief calls out: the harness's whole purpose is to prove an invariant (WR-05 ephemeral `data_sources` lifecycle) via the live DB, and a swallowed query error defeats that proof silently.
**Fix:**
```js
const { count, error } = await sb.from('data_sources').select('*', { count: 'exact', head: true }).ilike('dataset_id', `${CITIES[dirKey].slug}-acfr%`);
if (error) throw new Error(`data_sources residue check failed for ${dirKey}: ${error.message}`);
residueTotal += count ?? 0;
residueDetail.push(`${dirKey}:${count ?? 0}`);
```

## Warnings

### WR-01: `matchEntityToCoverage` in the tether harness is not actually behaviorally verbatim with production, despite the file's claim

**File:** `scripts/verify-phase133-tether.mjs:45-58` (compare `src/utils/essentialsCoverage.ts:158-204`)
**Issue:** The header comment (lines 15-19) states the matcher is "mirrored verbatim (behavior)" from `essentialsCoverage.ts`. The real production function gates city-tier matching on an explicit allow-list (`CITY_TIER_TYPES = {city, town, township, municipality}`) and returns `null` outright for `federal`, `state`, and any other tier (`nonprofit`, `special_district`, etc.) before ever touching `catalog.cities`. The ported version instead does:
```js
if (entity.entity_type === 'county') { records = catalog.counties; tier = 'county'; }
else { records = catalog.cities; tier = 'city'; } // city/town/township/municipality
```
— an unconditional `else`, so a `federal` or `state` (or `nonprofit`, etc.) entity would be silently treated as a city-tier lookup against `catalog.cities` instead of returning `null` as production does. It causes no incorrect output today because all four entities passed into `verdictFor` in this file are hardcoded as `entity_type: 'city'` (lines 100-104), but the discrepancy is real and would produce wrong verdicts (a spurious "covered"/"not covered" city-tier match instead of production's guaranteed `null`) if this harness is copied forward for a state/federal/other-tier phase, exactly as `verify-phase130-tether.mjs` was copied forward into this file.
**Fix:** Port the real gate instead of the collapsed `else`:
```js
const CITY_TIER_TYPES = new Set(['city', 'town', 'township', 'municipality']);
function matchEntityToCoverage(entity, catalog) {
  if (!catalog) return null;
  let records, tier;
  if (entity.entity_type === 'county') { records = catalog.counties; tier = 'county'; }
  else if (CITY_TIER_TYPES.has(entity.entity_type)) { records = catalog.cities; tier = 'city'; }
  else return null;
  ...
}
```

## Info

### IN-01: Municipality-ID prefix mismatch is only logged, never fails the run

**File:** `scripts/verify-phase133-rederive.mjs:322`
**Issue:** `if (!muni.id.startsWith(city.idPrefix)) console.error(...)` prints a note to stderr but does not increment `blockers` or otherwise affect the exit code. In practice this is low-risk (a true duplicate-name collision would already be caught by the preceding `.maybeSingle()` erroring out on >1 row), but as written the check is decorative — a real prefix drift (e.g., the phase-132 seed ID was regenerated) would be visible only to someone reading full console output, not to CI/automation gating on exit code.
**Fix:** Either remove the check (if it adds no real assurance beyond `.maybeSingle()`) or promote a real mismatch to a counted blocker so the exit code reflects it.

### IN-02: Supabase query results are destructured without checking `.error` throughout all three files

**File:** `scripts/verify-phase133-rederive.mjs:248-256`, `scripts/verify-phase133-audit.mjs:160-176`
**Issue:** Every `await sb.from(...)` call destructures only `data`/`count`, never `error`. Most call sites fail loud indirectly (e.g. `cats.map(...)` throws on `cats === null`, caught by the top-level `main().catch(...)` → exit 2), which is acceptable for a manually-run harness, but it means the actual Postgrest error message is lost and replaced by a generic downstream `TypeError`, complicating triage. CR-02 shows the one place where this pattern goes past "annoying" into "silently wrong."
**Fix:** Adopt a small helper (`async function q(promise) { const { data, error } = await promise; if (error) throw error; return data; }`) and use it at every call site so failures are both loud and diagnosable.

---

_Reviewed: 2026-07-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
