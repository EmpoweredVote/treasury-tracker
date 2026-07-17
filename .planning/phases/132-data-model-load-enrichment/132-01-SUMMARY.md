---
phase: 132
plan: "132-01"
title: "Seed 4 Pima municipalities + link to existing Pima County node"
status: complete
requirements: [PIMA-04]
completed: 2026-07-17
---

# 132-01 SUMMARY — Data model

**Outcome: complete.** `scripts/seedPimaMunicipalities.js` seeds Oro Valley, Marana, Sahuarita, South Tucson (all `entity_type='city'`, state AZ, 2024 Census populations 48,855 / 62,380 / 37,448 / 4,535) and links each to the **existing** Pima County node (`b799043e-…`) via `county_id`.

- Ran twice: run 1 inserted 4 cities + linked; run 2 = all updates + "already-linked" (idempotent, 0 net change).
- Reuses the existing Pima node (resolve-and-abort-if-missing); **no second county node** created; Tucson untouched.
- Zero `data_source` rows created (owned by 132-02).

Municipality ids: Oro Valley `1edc0ca1`, Marana `bff60025`, Sahuarita `3fdb131c`, South Tucson `cfa8cc5b`.

**Must-haves:** ✅ 4 city rows (pop>0, 2024) · ✅ each `county_id`=Pima · ✅ NULL-or-same link guard · ✅ idempotent · ✅ no dup county node · ✅ no data_source rows.
