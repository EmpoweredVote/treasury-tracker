# SoCal County Onboarding Runbook

How to add any California county's cities (operating + revenue) to Treasury
Tracker using the hardened, reusable pipeline. Every step is one command and
generalizes to any county — no per-county code.

> Built and proven in Phase 52 (SoCal Bulk Pipeline Hardening). The Orange
> County data load itself is Phase 53; this runbook is the procedure it (and
> every future SoCal county) follows.

## Prerequisites

- Env var `SUPABASE_SERVICE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) set for the
  `kxsdzaojfaibhuzmclfq` project. `SUPABASE_URL` defaults to the prod project.
- For enrichment only: `ANTHROPIC_API_KEY` (and see the **$5 cost gate** below).
- The SCO "ByTheNumbers" datasets cover roughly **FY2003–FY2024**.
- Always run each step with `--dry-run` first and read the output before writing.

The county name you pass must match the SCO `county` field exactly (e.g.
`"Orange"`, `"Ventura"`, `"San Bernardino"` — no "County" suffix).

---

## Step 1 — Bulk load (operating + revenue)

Loads every city in the county from the SCO ByTheNumbers feed. Operating
(expenditures) **and** revenue load by default. Pass each fiscal year with a
repeated `--fy`.

```bash
# Dry-run first — lists the cities and counts, writes nothing:
node scripts/bulkLoadStateController.js --county "<Name>" --fy 2022 --fy 2023 --fy 2024 --dry-run --list-cities

# Real load (records today as the fetch date; override with --source-date):
node scripts/bulkLoadStateController.js --county "<Name>" --fy 2022 --fy 2023 --fy 2024 --source-date 2026-06-14
```

What it does:
- Auto-creates a `city` municipality for any city not yet in the DB, with the
  feed's per-year `estimated_population` (per-capita renders on first load).
- Writes each city's budget tree via `treasury_sync_city_budget`, passing the
  **durable source URL + fetch date** (see conventions below).
- **Skips, never overwrites,** any city whose budget for that (fiscal year,
  dataset) already came from a different source — see the collision rule below.

---

## Step 2 — Seed the county entity + link its cities

Creates the county entity (`entity_type='county'`) once and links every member
city via `county_id`, so the breadcrumb chain and the Cities-in-County panel
populate automatically. Membership is derived from the same SCO `county` field
the loader uses, so the linked set matches what was loaded.

```bash
# Dry-run first:
node scripts/seedCountyLinks.js --county "<Name>" --dry-run

# Real link:
node scripts/seedCountyLinks.js --county "<Name>"
```

Behavior:
- Reuses an existing county entity (never duplicates it). Idempotent on re-run.
- Sets `county_id` only where it is NULL or already this county. A city already
  linked to a **different** county is reported as skipped and is **not** repointed
  unless you pass `--force`.
- Linking never touches budget data, so cities kept from another source (e.g.
  Anaheim, Santa Ana) still get attached to the county without losing their data.
- Cities returned by SCO that aren't in the DB yet are reported as
  "load budget first" — run Step 1 then re-run Step 2.

---

## Step 3 — Enrich categories (optional, cost-gated)

Generates plain-language descriptions for opaque fund/category names via the
Claude API. **This spends money — estimate first and respect the $5 gate**
(Empowered Vote is an unfunded nonprofit; stop and get approval if a run would
exceed ~$5).

```bash
# Estimate scope/cost without spending (per city):
node scripts/enrichCategories.js --city "<City>" --state CA --dry-run

# Run for a specific city once you've confirmed the cost is under the gate:
node scripts/enrichCategories.js --city "<City>" --state CA
```

Enrichment is per-city/state-scoped (there is no `--county` flag). Enrich the
cities you just loaded, one city at a time or via the script's batch flags, after
estimating cost.

---

## Step 4 — Verify

- Spot-check one city's loaded total against its published ACFR / SCO figure for
  the same year (totals should match within rounding).
- Open the county in the app and confirm the **breadcrumb chain** (city → county →
  state) and the **Cities-in-County panel** list the linked cities.
- Confirm a loaded city figure shows a source (the durable ByTheNumbers page URL +
  fetch date persisted in Step 1).

---

## Step 5 — Load the county's own budget (don't stop at cities)

Onboarding the **cities** in a county does NOT give the **county government** a
budget. A county entity with linked cities but no budget of its own is a
"grouper": until Phase 56 it was invisible in `/treasury/cities` (so the
breadcrumb county chip silently disappeared), and even once visible its page has
no budget chart — only the Cities-in-County directory. Orange County shipped this
way and needed a follow-up (Phase 57) to load the county budget.

**Lesson — do this up front on the next county-onboarding milestone:** treat the
county-government budget as part of onboarding, not an afterthought. For each
county, load its operating + revenue budget from the county's published ACFR
(**all-governmental-funds basis** — see the Phase 56 definitional note that SCO
ByTheNumbers totals are all-funds, not General Fund) and/or adopted budget,
attached to the county entity — the same way LA County (Phase 25) and the MA
counties (Phase 41) were loaded. Document the basis + source. If you deliberately
ship cities-only, record it as a known gap so the empty county page is expected,
not a UAT surprise.

**Command (the reusable Phase 57 tool — generalizes the LA County one-offs):**

```bash
# 1. Dry-run a canary year first (zero writes — prints categories/totals/population)
node scripts/loadCountyBudget.js --county "<County>" --fy 2024 --dry-run

# 2. Load the canary year for real, verify, then backfill the full range in <=2-year submits
node scripts/loadCountyBudget.js --county "<County>" --fy 2024
node scripts/loadCountyBudget.js --county "<County>" --fy 2003 --fy 2004   # ...repeat across the range

# Args: --county (SCO entity_name) --entity (DB municipality name; default "<County> County")
#       --type operating|revenue (default both) --population <int sourced fallback>
#       --source-date <YYYY-MM-DD> (default today) --dry-run
# The county entity MUST already exist (seeded in Step 1) — the loader errors if not found,
# never ensure-creates with a clobbering population. Datasets: operating uctr-c2j8 / revenue emxv-k8xv.
```

The same locked conventions below apply (durable `/d/<id>` source_url, population backfill-only,
never overwrite existing custom data).

---

## Locked conventions (do not regress)

These three rules are enforced by the scripts and MUST be preserved by any future
operator or edit:

1. **Source attribution (always-sourced).** `source_url` is the **durable
   ByTheNumbers dataset page** (`https://bythenumbers.sco.ca.gov/d/ju3w-4gxp` for
   expenditures, `/d/rrtv-rsj9` for revenues) — **never** the `/resource/*.json`
   API endpoint. `source_date` is the fetch date (`--source-date`, default today).
   Both persist on `treasury.budgets` via the `treasury_sync_city_budget` RPC.
2. **Population source.** Cities get the SCO feed's per-year `estimated_population`.
   The loader backfills an existing city whose population is 0/NULL and never
   lowers a non-zero population to 0.
3. **Never overwrite existing custom data.** A city whose (fiscal year, dataset)
   budget came from a different source is skipped and logged
   (`SKIP <city> (<state>) — existing <source> data preserved`). Cities like
   Anaheim and Santa Ana are **linked** to the county but **not reloaded**.

---

## Validation (Phase 52, 2026-06-14)

The hardened pipeline was proven against **Ventura County** — a non-Orange,
not-yet-loaded county — entirely via dry-run, writing nothing:

```
$ node scripts/bulkLoadStateController.js --county "Ventura" --fy 2023 --dry-run --list-cities
  Source date: 2026-06-14 (today)
  10 cities found, 2,370 total rows   (Expenditures)
    Camarillo, Fillmore, Moorpark, Ojai, Oxnard, Port Hueneme,
    San Buenaventura, Santa Paula, Simi Valley, Thousand Oaks
  10 cities found, 3,640 total rows   (Revenues)
  (dry run — skipping import) 10 cities would import, 0 skipped

$ node scripts/seedCountyLinks.js --county "Ventura" --dry-run
  [DRY RUN] Would create county entity "Ventura County"
  10 entity names returned by SCO for this county.
  Not yet in DB — load budget first (10): Camarillo, Fillmore, Moorpark, Ojai,
    Oxnard, Port Hueneme, San Buenaventura, Santa Paula, Simi Valley, Thousand Oaks
  Dry run complete — no writes performed.
```

**No-write confirmation:** after both dry-runs, a DB probe showed **0** "Ventura
County" entities and **0** of the 10 Ventura cities present — the dry-run path
provably writes nothing. (Collision-skip was separately proven against Los
Angeles County FY2023, where the custom-sourced City of Los Angeles was skipped
with its `Socrata: https://data.lacity.org` data preserved.)
