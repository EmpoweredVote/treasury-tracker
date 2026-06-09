# Phase 36: Selective City Retrofit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 36-selective-city-retrofit
**Areas discussed:** Lead audit target, Genuine 3rd level bar, Enrichment during reload, Pilot count target

---

## Lead Audit Target

| Option | Description | Selected |
|--------|-------------|----------|
| Dallas first | Check Socrata operating dataset for `department` column. Config-only retrofit if it exists. | |
| SF first | Unaudited Socrata candidate — likely has department→program columns. | |
| Portland first | Service area grouping is genuine Portland structure. More PDF extraction work. | |
| Audit all 3 simultaneously | Check all three in parallel, pick best candidates based on findings. | ✓ |

**User's choice:** Audit all 3 simultaneously.
**Notes:** "My goal is not to have 2 deep or 3 deep, my goal is to accurately reflect reality in a way that is helpful for other citizens to be able to follow their tax dollars. For some cities that may be 2 deep — for others 4." Goal is accuracy and citizen usefulness, not a fixed depth.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Depth recommendation + evidence | Recommended depth, columns/tables per level, extraction blockers. | ✓ |
| Retrofit-or-skip verdict only | Binary outcome, less detail. | |
| You decide | Claude picks format based on findings. | |

**User's choice:** Depth recommendation + evidence, built as a reusable framework for all 30+ cities.
**Notes:** "Build this inquiry in a way that can be applied across every city."

---

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown doc in .planning/ (human reference) | Framework doc guides future engineers loading any city. | |
| Structured output in DB or config | Per-city verdict stored queryably. | |
| Both — doc for humans, DB for source of truth | Framework doc + per-city DB records. | ✓ |

**User's choice:** Both — markdown doc + DB records.

---

## Genuine 3rd Level Bar

| Option | Description | Selected |
|--------|-------------|----------|
| Citizen usefulness test only | Recognizable organizational unit label. | |
| Official document test only | City uses this grouping in published budget documents. | |
| Both — must pass both tests | Citizen-recognizable AND in city's official budget documents. | ✓ |

**User's choice:** Both tests required.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Still genuine — collapse null rows to parent leaf | Phase 35 D-05 pattern. Partial coverage is fine. | ✓ |
| Reject if incomplete | Skip retrofit if significant null coverage. | |
| Threshold-based | Pick a coverage cutoff (e.g., 70%). | |

**User's choice:** Still genuine — apply Phase 35 D-05 null-collapse pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — load 4 levels if data supports it | No depth cap; consistent with N-level philosophy. | ✓ |
| Cap at 3 for Phase 36 | Keep scope tight; 4+ in a future phase. | |
| You decide per city | Claude recommends during audit. | |

**User's choice:** No depth cap — load as deep as the genuine data goes.

---

## Enrichment During Reload

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve by node name matching | Re-attach descriptions to nodes sharing same name after depth change. | ✓ |
| Wipe and re-enrich everything | Delete all enrichment, reload, re-enrich. Subject to $5 gate. | |
| Preserve existing depths, enrich only new nodes | Don't touch existing; enrich only new nodes. | |

**User's choice:** Preserve by node name matching.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Delete orphaned rows silently | Drop if no name match. | |
| Log orphans, don't delete | Keep in DB, log warning. | ✓ |
| You decide | Claude picks what's cleanest. | |

**User's choice:** Log orphans, don't delete.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — enrich new nodes as part of retrofit | Subject to $5 cost gate. | ✓ |
| No — defer enrichment for new nodes | Ship structural retrofit first. | |
| You decide per city | Based on node count and estimated cost. | |

**User's choice:** Yes — enrich new nodes in Phase 36, subject to $5 gate.

---

## Pilot Count Target

| Option | Description | Selected |
|--------|-------------|----------|
| Retrofit all that pass the genuineness test | If all 3 pass, retrofit all 3 in Phase 36. | ✓ |
| Retrofit exactly 1, queue others for Phase 37 | Keep Phase 36 scope tight. | |
| Retrofit all 3 regardless | Commit now to all 3. | |

**User's choice:** Retrofit only if genuinely needed — but if all 3 qualify, do all 3.
**Notes:** "I don't want to retrofit if it doesn't need it, but if all 3 do, please do."

---

| Option | Description | Selected |
|--------|-------------|----------|
| Mark as audited/confirmed-2-level in DB | Record the verdict, no reload needed. | ✓ |
| Skip silently — only record cities needing changes | Absence means audited and appropriate. | |

**User's choice:** Mark as audited/confirmed in DB — always record the verdict.

---

## Claude's Discretion

None — all areas were decided by the user.

## Deferred Ideas

- **Full retrofit of all 30+ cities**: The audit framework built in Phase 36 enables this in a future milestone. Phase 36 covers only the 3 pilot cities (Portland, Dallas, SF).
