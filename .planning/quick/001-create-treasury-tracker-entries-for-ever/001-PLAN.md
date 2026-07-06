---
phase: quick-001
plan: 001
status: complete
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/seedCollinCountyMunicipalities.js
autonomous: false
must_haves:
  truths:
    - "Every official Collin County, TX municipality has a row in treasury.municipalities"
    - "Each new row has name set, state='TX', and entity_type='municipality'"
    - "No duplicate (name, state) rows are created on re-run (idempotent)"
    - "User can verify the count of TX/Collin County municipalities in the DB before and after"
  artifacts:
    - path: "scripts/seedCollinCountyMunicipalities.js"
      provides: "Idempotent seeder that lists existing TX municipalities, prints the diff vs. the official Collin County list, and inserts only missing ones"
      contains: "@supabase/supabase-js"
  key_links:
    - from: "scripts/seedCollinCountyMunicipalities.js"
      to: "treasury.municipalities (Supabase)"
      via: "createClient with SUPABASE_SERVICE_KEY, db.schema='treasury'"
      pattern: "from\\(['\"]municipalities['\"]\\)"
---

<objective>
Ensure every municipality in Collin County, Texas has a row in the `treasury.municipalities` table.

Purpose: Treasury Tracker currently covers some Texas cities, but Collin County coverage is incomplete. Seeding all Collin County municipalities is the prerequisite for loading their budget data later — without a `municipalities` row there is no FK target for `budgets`, `enrichments`, etc.

Output: An idempotent Node seed script (`scripts/seedCollinCountyMunicipalities.js`) that diffs the canonical Collin County list against the DB and inserts any missing rows, plus a one-time execution that creates all missing rows.
</objective>

<execution_context>
@C:\Users\Chris\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Chris\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@scripts/loadEVFinances.js
@src/data/dataLoader.ts

Key facts derived from existing code (do NOT re-derive — use as-is):
- Supabase client: `createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } })`
- Service key env: `SUPABASE_SERVICE_KEY` (fall back to `SUPABASE_SERVICE_ROLE_KEY`)
- Default `SUPABASE_URL`: `https://kxsdzaojfaibhuzmclfq.supabase.co`
- Table: `municipalities`
- Known columns used in inserts: `name` (text), `state` (text, 2-letter), `entity_type` (text — e.g. `'nonprofit'`, use `'municipality'` here)
- Existing pattern for "create if missing": `select().eq('name', X).maybeSingle()` then `.insert(...)` — see `getMunicipalityId()` in loadEVFinances.js

Canonical Collin County, TX municipality list (incorporated cities/towns whose boundaries lie wholly or partly in Collin County — source: Collin County government + Texas Comptroller incorporated places list):
- Allen
- Anna
- Blue Ridge
- Celina
- Dallas (partial — wholly seated in Dallas Co. but extends into Collin)
- Fairview
- Farmersville
- Frisco (partial)
- Garland (partial — seated in Dallas Co.)
- Josephine
- Lavon
- Lowry Crossing
- Lucas
- McKinney
- Melissa
- Murphy
- Nevada
- New Hope
- Parker
- Plano (partial)
- Princeton
- Prosper
- Richardson (partial — seated in Dallas Co.)
- Royse City (partial — seated in Rockwall Co.)
- Sachse (partial — seated in Dallas Co.)
- St. Paul
- Weston
- Wylie

Do NOT add Dallas/Garland/Richardson/Sachse if they already exist with state='TX' — they are seated in other counties and may already be tracked. The seeder must check first.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build idempotent Collin County seeder script</name>
  <files>scripts/seedCollinCountyMunicipalities.js</files>
  <action>
Create a new Node ESM script that:

1. Uses the same Supabase client setup as `scripts/loadEVFinances.js`:
   ```js
   import { createClient } from '@supabase/supabase-js';
   const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
   const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
   if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY env var'); process.exit(1); }
   const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
   ```

2. Defines the Collin County roster as a constant array:
   ```js
   const COLLIN_COUNTY_TX = [
     'Allen', 'Anna', 'Blue Ridge', 'Celina', 'Fairview', 'Farmersville',
     'Frisco', 'Josephine', 'Lavon', 'Lowry Crossing', 'Lucas', 'McKinney',
     'Melissa', 'Murphy', 'Nevada', 'New Hope', 'Parker', 'Plano',
     'Princeton', 'Prosper', 'St. Paul', 'Weston', 'Wylie',
     // Multi-county cities — included because they have residents/budget activity in Collin Co.
     'Dallas', 'Garland', 'Richardson', 'Royse City', 'Sachse',
   ];
   ```
   Add a top-of-file comment explaining the multi-county note (Dallas/Garland/Richardson/Royse City/Sachse are partially in Collin and may already exist seated in other counties — script is still idempotent).

3. Queries existing TX municipalities ONCE:
   ```js
   const { data: existing, error } = await supabase
     .from('municipalities')
     .select('id, name, state')
     .eq('state', 'TX');
   ```
   Build a `Set` of lowercase existing names for O(1) lookup.

4. Diffs the roster vs. existing and prints a clear report BEFORE inserting:
   - "Already in DB: <list>"
   - "Will insert: <list>"
   - Total counts for each.

5. Inserts missing rows in a single batch:
   ```js
   const toInsert = missing.map(name => ({ name, state: 'TX', entity_type: 'municipality' }));
   const { data, error } = await supabase
     .from('municipalities')
     .insert(toInsert)
     .select('id, name');
   ```
   If `toInsert.length === 0`, skip the insert and log "Nothing to insert — Collin County already fully seeded."

6. On success, prints inserted IDs and final summary. On error, prints the Supabase error and exits non-zero.

7. Make script executable-friendly (shebang `#!/usr/bin/env node`, ESM imports — match existing scripts/ style).

Why this design:
- Idempotent: safe to re-run; re-running inserts nothing.
- Single round-trip for read, single round-trip for write — minimizes API churn.
- Uses `entity_type: 'municipality'` to distinguish from `'nonprofit'` (Empowered Vote) per existing convention in loadEVFinances.js.
- Does NOT touch `enrichments` or `budgets` — those are separate downstream concerns.
- Does NOT delete or update existing rows — only inserts missing ones.

Do NOT:
- Hard-code the service key.
- Use the anon key (RLS will block inserts).
- Filter by county — the `municipalities` table has no county column (verified from loadEVFinances.js insert shape). State+name is the natural key.
- Add a unique constraint or migration — the task is just to seed rows.
  </action>
  <verify>
Run a syntax check with no env vars set — script should fail fast with the "Missing SUPABASE_SERVICE_KEY" message:
```
node scripts/seedCollinCountyMunicipalities.js
```
Expected: exits non-zero with the env var error (proves script loads and ESM imports resolve).
  </verify>
  <done>
File `scripts/seedCollinCountyMunicipalities.js` exists, parses cleanly under Node ESM, and prints the missing-env-var error when run without `SUPABASE_SERVICE_KEY`. The COLLIN_COUNTY_TX constant contains all 28 names from the roster.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Run the seeder against production Supabase</name>
  <what-built>
An idempotent Node seeder at `scripts/seedCollinCountyMunicipalities.js` that diffs the Collin County, TX roster against `treasury.municipalities` and inserts missing rows.
  </what-built>
  <how-to-verify>
This step requires the user because the `SUPABASE_SERVICE_KEY` is a secret and must be supplied from the user's environment / 1Password / Supabase dashboard. Claude cannot retrieve it.

Steps for the user:

1. Open a PowerShell terminal in `C:\treasury-tracker`.

2. Export the service role key for the current shell only (do NOT commit it):
   ```powershell
   $env:SUPABASE_SERVICE_KEY = "<paste service role key from Supabase dashboard -> Project Settings -> API>"
   ```

3. Run the seeder:
   ```powershell
   node scripts/seedCollinCountyMunicipalities.js
   ```

4. Confirm the report shows:
   - The "Already in DB" list contains any TX cities already known to the system.
   - The "Will insert" list contains all the truly missing Collin County municipalities.
   - The final summary line reports `Inserted N rows` (or `Nothing to insert` if everything was already present).

5. (Optional) Spot-check in Supabase SQL editor:
   ```sql
   select count(*) from treasury.municipalities
   where state = 'TX'
     and name in (
       'Allen','Anna','Blue Ridge','Celina','Fairview','Farmersville','Frisco',
       'Josephine','Lavon','Lowry Crossing','Lucas','McKinney','Melissa','Murphy',
       'Nevada','New Hope','Parker','Plano','Princeton','Prosper','St. Paul',
       'Weston','Wylie','Dallas','Garland','Richardson','Royse City','Sachse'
     );
   ```
   Expected: 28.

6. Re-run the seeder a second time to confirm idempotency — it should report `Nothing to insert`.
  </how-to-verify>
  <resume-signal>Type "approved" once the count check returns 28 and the second run is a no-op. If any rows are missing or the count is wrong, paste the seeder output and I'll diagnose.</resume-signal>
</task>

</tasks>

<verification>
- `scripts/seedCollinCountyMunicipalities.js` exists and is valid Node ESM.
- After user runs the seeder, `select count(*) from treasury.municipalities where state='TX' and name in (...28 names...)` returns 28.
- Re-running the seeder is a no-op (idempotent).
</verification>

<success_criteria>
- All 28 Collin County, TX municipalities (full + partial) exist in `treasury.municipalities` with `state='TX'` and `entity_type='municipality'`.
- The seeder script is checked into the repo for future re-runs / audits.
- No duplicate rows were created; no existing rows were modified.
</success_criteria>

<output>
After completion, create `.planning/quick/001-create-treasury-tracker-entries-for-ever/001-SUMMARY.md` capturing:
- Final count of TX municipalities before vs. after
- List of names actually inserted (from the seeder's "Will insert" report)
- Any names that were already present and skipped
- Confirmation that the second run was a no-op
</output>
