-- Ohio AOS source_url: bare apex -> www.
--
-- Measured 2026-11-01: `ohioauditor.gov` fails DNS outright (curl exit 6,
-- HTTP 000) while `www.ohioauditor.gov` resolves and answers. Every Ohio row
-- was stamped with the apex, so the "source" link under 6,616 published
-- budgets points at a hostname that does not resolve.
--
-- Follows 20261101000100-era work: the manifests and the audit-grade citation
-- already moved to www (a57ab70b, 0f2f2828). This aligns the rows that were
-- loaded before that change, so what a reader clicks matches what the loader
-- would stamp today.
--
-- ── WHAT WAS CHECKED FIRST ─────────────────────────────────────────────────
--
--   6,616 rows carry an apex source_url, across 60 distinct URLs
--       0 of them sit outside the manifest's own filename pattern
--       0 of them belong to any data_source but Ohio AOS
--       0 rows already use www, so this cannot double-prefix
--
-- 60 distinct URLs = 30 city + 30 county (FY2016-2025 x GAAP/CASH/MOD),
-- exactly the manifest set, so the rewrite is a host swap and nothing else.
--
-- ⚠ This touches NO figure. `source_url` is not part of the frozen invariant,
-- which digests (id | total_budget); verified 62,587 / 60098de6 before and
-- after. No gate reads a source_url either — which is why these links rotted
-- unnoticed in the first place.
--
-- ⛔ THE www URLS ARE UNVERIFIED AGAINST A LIVE FILE. The Ohio Auditor of
-- State website has been offline since a cyberattack on 2026-10-25 (its own
-- notice, signed by Auditor Keith Faber) and every report path returns 404.
-- www is the host that RESOLVES; that the file is served from it is inferred
-- from the pre-outage path, not confirmed. Re-probe when the site returns.
--
-- Idempotent: the predicate matches only the apex form, so re-applying is a
-- no-op.

-- ⚠ An explicit prefix replace, not substring() arithmetic: a reviewer should
-- not have to count that 'https://ohioauditor.gov/' is 24 characters to see
-- that this is right. The predicate guarantees the prefix is at the start.
update treasury.budgets
set source_url = replace(source_url,
                         'https://ohioauditor.gov/',
                         'https://www.ohioauditor.gov/')
where source_url like 'https://ohioauditor.gov/%';
