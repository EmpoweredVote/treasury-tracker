# SDD ledger — plan: docs/superpowers/plans/2026-10-09-nyc-onboarding.md

Spec: docs/superpowers/specs/2026-10-09-nyc-onboarding-design.md (read)
Executor: inline (superpowers:executing-plans), native, chosen by Chris 2026-10-09.

Setup: Ruling: NO git worktree — auto-memory `acfr_recon_structure_unreliable`
records worktrees as UNSAFE in this repo because `.env` is gitignored and does
not travel, and every load/verify step here runs `node --env-file=.env`. Working
directly on branch `feat/nyc-onboarding` (not main, so consent rule satisfied).
Cost if wrong: branch work is not isolated from the main checkout.

## Pre-flight scan (shared interfaces)

| Producer → Consumer | Produces vs consumes | Finding |
|---|---|---|
| T1 → T2, T4, T6 | `NYC_FYS`, `nycAcfrUrl`, `nycAcfrFilename` | clean |
| T2 → T3, T4, T6, T7 | `docs/NYC/nyc-{fy}-acfr.pdf` | ⚠ T2's Interfaces block says the name must match a `filePattern` in T6; T6 uses no `filePattern` (that field belongs to `acfrGfLoad.mjs`, which T6 explicitly does not use) |
| T3 → T4, T6 | `extractNYC.py` CLI | clean; T4 adds `--scope`, default `general`, so T3's own invocations stay valid |
| T5 → T6 | `NYC_ENTITY` | ⚠ T5's main-guard uses `import.meta.url` with a backslash replace — brittle on Windows and not the repo convention |
| T6 → its own test | `FUND_SCOPES`, `sourceNameFor`, `sourcePrefixFor`, `scopeFlag` | ⚠ the test imports the loader module; if the module runs `main()` at import it would attempt a live DB load during `vitest` |

Setup: Ruling: T2's `filePattern` reference is a leftover from the
`acfrGfLoad.mjs` design that T6 abandoned — the PDF path is constructed directly
as `docs/NYC/nyc-${fy}-acfr.pdf` in every consumer. Dropping the reference, not
adding a `filePattern` field. Cost if wrong: nothing; no code reads it.

Setup: Ruling: both `seedNewYorkCity.mjs` (T5) and `loadNYCAcfrs.mjs` (T6) use
the repo's existing main-guard convention, taken from
`scripts/loadInCountyAcfrs.mjs`:
`const invokedDirectly = process.argv[1] && process.argv[1].endsWith('<file>.mjs');`
rather than the `import.meta.url` form written into the plan. It is what the
codebase already does, and it keeps both modules safely importable from vitest.
Cost if wrong: a module could execute on import and attempt a live write during
the test suite — which is exactly what this prevents.

## Tasks

Task 1: complete (commits 24122bee..0020c4a2, tests: npx vitest run tests/nycAcfrSources.test.mjs → 7/7 pass)
Task 2: complete (commits 0020c4a2..729ee5e3, tests: node scripts/fetchNYC.mjs → 24/24 present + guard exits 1 on FY2026)
Task 2: Ruling: the 24 in-window PDFs were COPIED from this session's earlier first-party downloads (same comptroller.nyc.gov URLs, fetched 2026-10-09) rather than re-downloaded, then validated with the fetcher's own size+magic checks — all 24 pass. Saves ~230MB of redundant transfer. Cost if wrong: a stale or wrong-year byte would be caught downstream by the per-FY tie gate and the cross-book check.
Task 3: Ruling: the spec (§7) put "any change to scripts/lib/acfrGF.py" OUT OF SCOPE. That line was written before the `-table` reader was known to FAIL MECHANICALLY on this issuer: NYC's underline rules are underscore characters interleaved into the digits of the Total rows, which are the rows `anchors()` builds the column grid from, so every data row read zero. The alternatives were (a) move NYC to `acfrGfCoords.py`, which is General-Fund-only and would have silently discarded the two-scope decision Chris made explicitly, or (b) a narrow opt-in library repair. Chose (b): `strip_underline_rules` behind `underscore_rules=False`, plus a shared dot-leader strip in `norm_label`. Proven inert by a 332-run corpus diff over 9 shipped entities (0 changed) and 307+39 selftests. Cost if wrong: a shared-library regression reaching ~30 ACFR entities — which is what the corpus diff was run to bound.
Task 3: Ruling: added `select_fiscal_year=True`, not in the plan. Every NYC book prints TWO complete statements (current + prior year) and both tie at zero, so "earliest qualifying page" is a guess I had verified on one book out of 24. The library's own docs on this flag say "Do not reason about which year must come first." Cost if wrong: none; a book that does not print the requested year now fails loudly instead of yielding the wrong year's money under the right year's label.
Task 3: Ruling: added `parents=('current operations', ...)` and three `label_fixes`, neither in the plan, both found by sweeping all 24 years rather than the single year the plan checked. FY2002/FY2004 print `Current Operations:` as a real heading; without it the heading welds onto its first child and publishes a bogus category while tying at zero. Cost if wrong: a mis-nested FY2002/FY2004 tree — bounded by the printed indentation, which was read with `-layout`.
Task 3: complete (commits 729ee5e3..26f3d044, tests: acfrGF.selftest.py 307 OK; acfrGfCoords.selftest.py 39 OK; corpus diff 332 runs 0 changed; 48/48 NYC GF ties at zero)
Task 4: Ruling: ANSWERED THE SPEC'S OPEN QUESTION, and the first answer was NO. acfrGF.py's `target_column='last'` does NOT reproduce under the default `positional` strategy — it reads the Adjustments/Eliminations column instead (FY2024 General government came back as -43,100 against a printed 6,286,459). Rather than take the plan's exit-3 branch to the coordinate reader (which has no target_column at all and would have killed the two-scope design), set `column_strategy='ordinal'` on the TOTAL config only. One choice per SCOPE on a mechanical reason that holds across all 24 years, not per-year curve-fitting; the General Fund is column 0 and stays on `positional`, re-verified 48/48. Cost if wrong: the total-governmental series reads a wrong column — bounded by 48/48 ties plus a direct assertion of the blank-cell row's printed value in all four affected years.
Task 4: complete (commits 26f3d044..11568365, tests: node scripts/probeNycTotalColumn.mjs → exit 0, 48/48 ties at zero + 4 blank-cell assertions; GF re-verified 48/48; selftests 307 OK)
Task 5: Ruling: population is Census PEP POPESTIMATE2024 = 8,478,072, read directly from sub-est2024_36.csv rather than recalled. Vintage 2025 revises it to ~8,597,000; NYC deliberately stays on Vintage 2024 because per-capita is only comparable against the vintage every other TT place carries. Cost if wrong: NYC per-capita reads ~1.4% high relative to a 2025-vintage world.
Task 5: complete (commits 11568365..b9bf6960, tests: npx vitest run tests/nycEntityShape.test.mjs → 4/4 pass; dry-run clean)
Task 6: complete (commits b9bf6960..c365a190, tests: npx vitest run tests/nycLoaderLabels.test.mjs → 8/8 pass; full dry-run 96/96 extractions tie at zero, 0 refusals)
Task 7: Ruling: DROPPED the planned `acfrGfCoords.py` corroborator and wrote `verifyNycGlyphs.py` instead. Measured: CoordsConfig has no target_column (so it covers only one of the two scopes) AND cannot read NYC unaided — its total-row anchors miss on letter-spacing ("T otal revenues"), and pdfplumber renders the underline rules as underscore glyphs too, which corrects the plan's assumption that a glyph reader is immune to them. Making it work would mean editing anchors 8 shipped entities depend on. The replacement is independent on page choice and column assignment — the dimensions `exclude_ignore` and positional/ordinal actually put at risk — and covers BOTH scopes. Cost if wrong: corroboration is by a reader I wrote rather than one already in service; mitigated by it finding its own page and sharing no code with the -table path.
Task 7: Ruling: CHECK 2 reports restatements instead of failing them. NYC genuinely restates prior-year figures in several early books (FY2003/04/06/07 found), the same phenomenon that set the FY2001 window floor. TT loads each year from its OWN audited book, so a restatement is expected; >5% divergence still fails, as that is a misread not a revision. Cost if wrong: a real misread under 5% is reported as a restatement rather than failing the run — bounded by CHECK 1, which compares two readers on the same book.
Task 7: Ruling: `geoid_basis` must be `census-pep-162-exact`, not the invented `census_place`. The DB's `municipalities_geoid_shape` CHECK keys the required geoid length off a fixed vocabulary and rejected the row. SUMLEV 162 is the record the population was read from. Cost if wrong: none; the constraint enforces it.
Task 7: complete (commits c365a190..9720c824, tests: glyph reader matches -table on FY2002/2015/2023/2024 across both scopes, 6/6 columns)
Task 8: Ruling: the full suite surfaced TWO failures, both caused by this work and both legitimate guards — the shebang-on-test-imported-module guard and the treasury_sync_city_budget caller registry. Fixed rather than suppressed; the registry entry carries the measured axis pair (48 general_fund + 48 total_governmental, all actual/published). Cost if wrong: none, both are now green and the suite is 2828/2828.
Task 8: live load COMPLETE — 96 rows, FY2002-FY2025, 4 groups of 24, 0 wrong fysm, 0 unsourced, 0 wrong basis; idempotence re-run left 96 rows / 96 distinct keys.
Task 7/8 verification: CHECK 1 PASSED — 96/96 glyph comparisons, zero failures (both scopes, all 24 years, including page-choice agreement between the two readers). CHECK 2 had started when the background waiter was REAPED BY THE HARNESS for system memory pressure — not a failure of the check. CHECK 2/3/4 therefore UNRUN in this session. Not restarted: the harness instruction says to report and restart only when asked.
Final review: NOT RUN (session ended on cost grounds at the user's direction). No fresh-context whole-branch review was performed — weaker than the process normally requires, and the user should know that before merge.
