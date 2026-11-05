-- Plano stops publishing a vendor axis, because the publisher truncates it.
--
-- ⚠⚠⚠ WHAT IS WRONG. `PayeeName` in every Plano check-register file is a
-- 5-character FIXED-WIDTH field. Measured on FY2021, 29,054 rows:
--
--     payee length    3ch: 45   4ch: 4,229   5ch: 24,469   >5ch: 0
--     2,712 of 2,970 distinct values (91.3%) are exactly 5 characters
--
-- Nothing longer exists anywhere in any year. Values like "AT &", "CONN,"
-- and "LEE," are cut mid-token, so these are truncations, not codes.
--
-- ⚠⚠ IT MIS-AGGREGATES, which is worse than mislabelling. "COLLI" merges
-- Collin County with Collin Creek and anything else beginning COLLI, so the
-- grouping itself is wrong -- not merely its name. TT's largest Plano payee
-- read "MO MI" and held $483,527,652.16; others were "BOND" $242,552,005.00
-- and "RCRD" $209,071,358.39.
--
-- A wrong aggregation under a plausible-looking name is the kind of number
-- that gets quoted. Removing vendor_column makes the loader attribute these
-- transactions to NO vendor rather than to an invented one.
--
-- ⚠ NOTHING ELSE CHANGES. Amount, date, fund, cost centre, description,
-- document type and the dedup keys are all untouched, and every Plano total
-- stays exactly where it is. Only the payee axis goes.
--
-- ── WHAT IS *NOT* WRONG WITH PLANO, checked and recorded here ──────────────
--
--   * Row dedup is CORRECT. Its $25.46M of discarded rows is $24.10M of
--     certified export doubling plus an ordinary background (#335).
--   * dataset_type is already `transactions` -- Plano is the model the Frisco
--     and McKinney registers were corrected TO (#337).
--   * No phantom publisher total row (`npm run verify:total-rows`).
--   * All six files are clean 12-month fiscal years, 2019-10 to 2025-09.
--   * FY2021's $848,271,839.87 is REAL money in clearing funds -- 2021 MUN DR
--     REV BD CLEARING $209,071,358.39, Collin Creek East PID $81,960,682,
--     TIRZ No.4 $77,000,000 -- bond proceeds passing through, not a defect.
--
-- ⏭ THE REAL REMEDY is checkregister.plano.gov, the city's own register,
-- which carries full payee names and the same ten columns. It is an ASP.NET
-- __VIEWSTATE postback app with no export URL in the initial HTML, so it needs
-- a purpose-built loader. Until then TT says nothing rather than something
-- false.

update treasury.data_sources
   set column_mapping = column_mapping - 'vendor_column'
 where name like 'Plano Check Register FY%';

-- ⚠ Then clear the residue. Reloading leaves every truncated stub behind as an
-- unreferenced treasury.vendors row -- 8,638 of them, max length 7 characters,
-- the two longest being the loader's old blank fallback "Unknown" and a
-- "General" that landed in the payee slot from a mis-split line. Left in place
-- they are phantom payee names waiting to resurface in a future vendor listing
-- or search.
--
-- ⚠⚠ Scoped to Plano and to rows NOTHING references, so it cannot touch a
-- vendor any transaction still points at, here or in any other municipality.
delete from treasury.vendors v
 using treasury.municipalities m
 where m.id = v.municipality_id
   and m.name = 'Plano'
   and not exists (select 1 from treasury.transactions t where t.vendor_id = v.id);
