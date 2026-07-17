---
phase: 132
plan: "132-02"
title: "Load 4 Pima cities' GF operating + revenue via source-safe RPC"
status: complete
requirements: [PIMA-05]
completed: 2026-07-17
---

# 132-02 SUMMARY — Load

**Outcome: complete. 44 budgets rows loaded, all independently re-derive to the 131-RECON totals at $0.** `scripts/processPimaCities.js` runs `extractAcfrGF.py` (via `py -3`) per city×FY×mode, maps to the RPC tree, and loads through the source-safe `treasury_sync_budget_tree`.

- **Loaded:** Oro Valley 12, Marana 12, Sahuarita 12, South Tucson 8 = **44** (operating + revenue per city-FY).
- **Independent re-derivation:** DB-stored depth-0 category sums == the 131-RECON printed totals at exactly $0 for all 44 (verified by SQL, not the extractor self-tie).
- **Provenance:** every row has a non-null `source_url` (canonical origin URL from RECON) + `source_date`=FY-06-30; 0 null. Ephemeral `data_sources` — **0 residue** after run.
- **Idempotent:** re-run of both modes left exactly 44 rows (0 net change); Tucson untouched (20 rows).
- **Oro Valley label cleanup (resolves Phase 131 deferred):** `OV_LABEL_FIXES` maps the 5 `-table` glyph splits ("Tran s it"→Transit, "In teres t"→Interest, "Integovernmental"→Intergovernmental, two "investments" variants) at map time — OV leaves now read cleanly; other cities verbatim.
- Source-safe: uses `treasury_sync_budget_tree`, no reference to `treasury_sync_city_budget`.

**Must-haves:** ✅ 44 rows via source-safe RPC · ✅ $0 independent re-derivation · ✅ durable source_url+source_date · ✅ 0 data_sources residue · ✅ idempotent · ✅ revenue dataset per city (Money In auto-enables) · ✅ per-capita renders · ✅ OV labels normalized.
