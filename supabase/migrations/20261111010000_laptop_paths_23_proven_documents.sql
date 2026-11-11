-- The laptop paths — 23 of 51 documents found on their publishers and PROVEN.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠⚠ `treasury.data_sources.base_url` HELD PATHS ON ONE CONTRIBUTOR'S LAPTOP
-- ─────────────────────────────────────────────────────────────────────────────
-- 51 distinct paths, 86 rows, 11 cities, in the production database:
--
--     file://C:/treasury-tracker/docs/Fresno/fy2024-adopted-budget.pdf
--     local:docs/Richardson/FY25 Downloadable Budget.xlsx
--
-- `citationShape()` calls these "uncitable", which is correct silence about a
-- CITATION and a lie about a PROVENANCE RECORD: a laptop path is not an
-- unknown, it is the provenance never having been recorded. #381 found them
-- and ratcheted them at 51 because there was no repair in hand. This is the
-- repair, for the 23 that could be proven.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐⭐ THE STRONGEST RUNG OF THE LADDER WAS AVAILABLE HERE, FOR FREE
-- ─────────────────────────────────────────────────────────────────────────────
-- These documents are unusual: **we still hold the file the loader parsed.**
-- So the question is not the weak "does this URL contain our numbers?" but the
-- strong "is this the same document?" — and every pair below was settled by
-- sha256 after a full download from the publisher, on 2026-11-11:
--
--     Long Beach   5/5    Fresno  7/7    Oakland  2/2
--     Riverside    2/2    Plano   7/7          = 23/23 BYTE-IDENTICAL
--
-- ⛔ The generator refuses to emit a pair that is not byte-identical, so no
-- "looks right" citation can reach this file. A matching content-length was
-- treated as a HINT and nothing more — which earned its keep twice:
--
--   • Fresno's budget page TODAY links an 11 MB file for FY2024 while the
--     53 MB document TT actually parsed still sits at its original upload
--     path. Citing the page's current link would have pointed readers at a
--     different document.
--   • Fresno FY2025 likewise: the page links a 52,234,448-byte re-upload; the
--     parsed document is 52,343,956 bytes. Close enough to pass a size
--     eyeball, not the same file.
--
-- ⚠ Two of these were a *directory* in disguise. Oakland's dead base_url was
-- an S3 key PREFIX; the objects are right there under a different capitalisation
-- (`FY23-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf`). Long Beach's was a
-- media-library folder; the files live in per-FY subfolders and carry NO `.pdf`
-- extension at all.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⛔⛔ THE OTHER 28 ARE NOT REPAIRED, AND THE REASON IS NOT EFFORT
-- ─────────────────────────────────────────────────────────────────────────────
-- Fremont (7), Richardson (8), San José (5), Santa Ana (4), Anaheim (2) and
-- Bakersfield (2) sit behind WAFs that refuse every automated client at the
-- DOCUMENT endpoint — tested 2026-11-11 with the full browser header set, with
-- the `Sec-Fetch-*` pair that unlocked the Oregon cities (#375), and with the
-- real headless Chromium `npm run e2e` installs, including a cookie-setting
-- page visit first. All 403. The Internet Archive, the usual fallback for
-- exactly this, is **temporarily offline** today, so the Wayback copies that
-- would have settled them could not be read either.
--
-- ⚠ A URL cannot be cited here on the strength of a search result. The whole
-- point of this repair is that the citation is PROVEN, and for those 28 it
-- cannot be — yet. They stay laptop paths, the ratchet drops 51 -> 28, and
-- scripts/data/sourceEndpointBaseline.mjs records what each one needs.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐ AND THE REPAIR A READER CAN ACTUALLY SEE
-- ─────────────────────────────────────────────────────────────────────────────
-- A `base_url` is an internal note; no reader has ever seen one. The 30 budgets
-- these 23 documents back cite **nothing at all** — they are inside the
-- 24,938-budget uncited baseline, and their pages carry no source chip. This
-- migration gives them the proven URL, so for the first time a reader of
-- Fresno's or Plano's budget can open the book the figures came from.
--
-- ⚠ `source_date` is the FISCAL-YEAR END, computed from the row's own
-- `fiscal_year_start_month` — Fresno/Oakland/Riverside run July (so FY2024 ends
-- 2024-06-30), Long Beach/Plano run October (2024-09-30). Not a fetch
-- timestamp: `scripts/lib/inglewoodFiscalCalendar.mjs` records what that costs.
-- It is the convention `acfrGfLoad.mjs` and `waSaoLoad.mjs` already stamp, and
-- the API REQUIRES data_source + source_url + source_date together before it
-- serves a chip at all, so a URL with no date would leave these pages exactly
-- as blank as they are now.
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. Re-running these loaders would re-mint
-- `budgets.id` and stale the frozen registry (#372 is the worked example).

do $$
declare
  v_rows     int;
  v_budgets  int;
  v_docs     int;
  v_expected_docs    int := 23;
  v_expected_dsrows  int := 36;
  v_expected_budgets int := 30;
  v_laptop_before    int;
  v_laptop_after     int;
begin
  create temp table lp_pair(old text primary key, new text not null) on commit drop;
  insert into lp_pair(old, new) values
  ('file://C:/treasury-tracker/docs/Fresno/fy2020-adopted-budget.pdf','https://www.fresno.gov/wp-content/uploads/2023/04/FY2020AdoptedBudgetUpdated2.pdf'),
  ('file://C:/treasury-tracker/docs/Fresno/fy2021-adopted-budget.pdf','https://www.fresno.gov/wp-content/uploads/2023/04/FY-2021-Final-Revised-Budget_WEBPAGE.pdf'),
  ('file://C:/treasury-tracker/docs/Fresno/fy2022-adopted-budget.pdf','https://www.fresno.gov/wp-content/uploads/2023/04/FY2022AdoptedBudgetLINKS.pdf'),
  ('file://C:/treasury-tracker/docs/Fresno/fy2023-adopted-budget.pdf','https://www.fresno.gov/wp-content/uploads/2023/04/upload_tempFY-2023-Adopted-Budget-1.pdf'),
  ('file://C:/treasury-tracker/docs/Fresno/fy2024-adopted-budget.pdf','https://www.fresno.gov/wp-content/uploads/2023/10/FY-2023-2024-Adopted-Budget.pdf'),
  ('file://C:/treasury-tracker/docs/Fresno/fy2025-adopted-budget.pdf','https://www.fresno.gov/wp-content/uploads/2024/10/FY-2025-ADOPTED-BUDGET.pdf'),
  ('file://C:/treasury-tracker/docs/Fresno/fy2026-adopted-budget.pdf','https://www.fresno.gov/wp-content/uploads/2025/10/FY-2026-Adopted-Budget.pdf'),
  ('file://C:/treasury-tracker/docs/Long Beach/fy22-fund-summary-gp.pdf','https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-22-adopted-budget/34-fund-summary-gp_22a-v2-gs'),
  ('file://C:/treasury-tracker/docs/Long Beach/fy23-fund-summary-gp.pdf','https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-23-adopted-budget/34-fund-summary-gp_23a_v1'),
  ('file://C:/treasury-tracker/docs/Long Beach/fy24-fund-summary-gp.pdf','https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-24-adopted-budget/35-fund-summary-gp'),
  ('file://C:/treasury-tracker/docs/Long Beach/fy25-fund-summary-gp.pdf','https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-25-adopted-budget/35-fund-summary-gp'),
  ('file://C:/treasury-tracker/docs/Long Beach/fy26-fund-summary-gp.pdf','https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-26-adopted-budget/33-fund-summary-gp'),
  ('file://C:/treasury-tracker/docs/Oakland/fy2023-25-adopted-budget.pdf','https://cao-94612.s3.us-west-2.amazonaws.com/documents/FY23-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf'),
  ('file://C:/treasury-tracker/docs/Oakland/fy2024-25-midcycle-adopted-budget.pdf','https://cao-94612.s3.us-west-2.amazonaws.com/documents/FY24-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf'),
  ('file://C:/treasury-tracker/docs/Plano/2018-19 Program of Service - Operating Budget (PDF).pdf','https://content.civicplus.com/api/assets/tx-plano/4e5b3769-a935-4aee-8698-29e4d192ab98'),
  ('file://C:/treasury-tracker/docs/Plano/2019-20 Program of Service - Operating Budget (PDF).pdf','https://content.civicplus.com/api/assets/tx-plano/39ed8ea7-626b-4264-9465-f64a85c1244b'),
  ('file://C:/treasury-tracker/docs/Plano/2021-22 Program of Service - Operating Budget (PDF).pdf','https://content.civicplus.com/api/assets/tx-plano/5a4703dd-412b-4996-9d04-b7cf49eabedb'),
  ('file://C:/treasury-tracker/docs/Plano/2022-23 Program of Service - Operating Budget (PDF).pdf','https://content.civicplus.com/api/assets/tx-plano/782a36c6-6b69-4329-a759-05e943ca8b63'),
  ('file://C:/treasury-tracker/docs/Plano/2023-24 Program of Service - Operating Budget (PDF).pdf','https://content.civicplus.com/api/assets/tx-plano/9fafb1c4-1096-444f-acd4-5499420af179'),
  ('file://C:/treasury-tracker/docs/Plano/2024-25 Program of Service - Operating Budget (PDF).pdf','https://content.civicplus.com/api/assets/tx-plano/f2f8d001-72a8-4bab-bfa2-70fb41e5ba91'),
  ('file://C:/treasury-tracker/docs/Plano/2025-26 Program of Service - Operating Budget (PDF).pdf','https://content.civicplus.com/api/assets/tx-plano/d8ecb839-3e56-45eb-a2ae-87287b26e2f1'),
  ('file://C:/treasury-tracker/docs/Riverside/fy2022-24-adopted-budget.pdf','https://riversideca.gov/finance/FY%202022-2024%20Biennial%20Budget%20(2).pdf'),
  ('file://C:/treasury-tracker/docs/Riverside/fy2024-26-adopted-budget.pdf','https://www.riversideca.gov/finance/PDF/FY24-26%20Budget/FY%202024-2026%20Budget%20Book.pdf');

  select count(distinct base_url) into v_laptop_before
    from treasury.data_sources
   where base_url like 'file://%' or base_url like 'local:%';

  -- FENCE 1: every path this migration was written against must still be here.
  select count(*) into v_docs
    from lp_pair p where exists (select 1 from treasury.data_sources ds where ds.base_url = p.old);
  if v_docs <> v_expected_docs then
    raise exception 'expected % laptop path(s) still in use, found % — the table moved under this migration',
      v_expected_docs, v_docs;
  end if;

  -- FENCE 2: ⚠ one document, one URL. A replacement reused across two
  -- different documents would mean a copy/paste error in the proof table, and
  -- would silently cite one fiscal year's book for another's figures.
  select count(*) into v_rows from (select new from lp_pair group by new having count(*) > 1) q;
  if v_rows <> 0 then
    raise exception '% replacement URL(s) are reused across documents', v_rows;
  end if;

  -- FENCE 3: shape. Every replacement must be an https URL on the PUBLISHER,
  -- never another local path and never a bare host.
  select count(*) into v_rows from lp_pair
   where new !~ '^https://[a-z0-9.-]+/.+' or new like 'file://%' or new like 'local:%';
  if v_rows <> 0 then
    raise exception '% replacement URL(s) are not a https publisher path', v_rows;
  end if;

  -- FENCE 4: nothing may already cite a replacement — that would merge two
  -- citations rather than repair one.
  select count(*) into v_rows
    from treasury.budgets b join lp_pair p on p.new = b.source_url;
  if v_rows <> 0 then
    raise exception '% budget(s) already cite a replacement URL', v_rows;
  end if;

  -- FENCE 5: ⚠⚠ THE CALENDAR MUST BE KNOWN. source_date below is derived from
  -- the row's own fiscal_year_start_month; a January start would compute the
  -- WRONG year's end (make_date(fy,1,1) - 1 day lands in fy-1), so refuse
  -- rather than stamp a date that is off by twelve months.
  select count(*) into v_rows
    from treasury.budgets b
    join treasury.data_sources ds
      on ds.name = b.data_source and ds.municipality_id = b.municipality_id
    join lp_pair p on p.old = ds.base_url
   where b.source_url is null and b.fiscal_year_start_month not in (7, 10);
  if v_rows <> 0 then
    raise exception '% budget(s) have a fiscal calendar this migration cannot date safely', v_rows;
  end if;

  -- ── 1. the provenance record: where the document actually lives ──────────
  update treasury.data_sources ds
     set base_url = p.new, updated_at = now()
    from lp_pair p
   where ds.base_url = p.old;
  get diagnostics v_rows = row_count;
  if v_rows <> v_expected_dsrows then
    raise exception 'updated % data_sources row(s), expected %', v_rows, v_expected_dsrows;
  end if;

  -- ── 2. ⭐ THE REPAIR THAT A READER CAN SEE ────────────────────────────────
  -- A base_url is an internal note. These 30 budgets cite NOTHING, so their
  -- pages carry no source chip at all. The join is the API's own
  -- (name, municipality_id) lateral, so a budget is cited with the document
  -- whose data_source label it already carries.
  --
  -- ⚠ source_date is the FISCAL-YEAR END, derived from the row's own
  -- fiscal_year_start_month -- not a fetch timestamp, and not invented. This
  -- is the house convention (scripts/lib/acfrGfLoad.mjs stamps
  -- `${fy}-${fyEndMonthDay}`, waSaoLoad.mjs stamps `${fy}-12-31`), and the API
  -- REQUIRES all three of data_source, source_url and source_date before it
  -- will serve a chip at all -- a URL with no date would leave these pages
  -- exactly as blank as they are now.
  update treasury.budgets b
     set source_url  = p.new,
         source_date = (make_date(b.fiscal_year::int, b.fiscal_year_start_month::int, 1) - interval '1 day')::date
    from treasury.data_sources ds, lp_pair p
   where ds.name = b.data_source
     and ds.municipality_id = b.municipality_id
     and p.new = ds.base_url
     and b.source_url is null;
  get diagnostics v_budgets = row_count;
  if v_budgets <> v_expected_budgets then
    raise exception 'cited % budget(s), expected %', v_budgets, v_expected_budgets;
  end if;

  -- FENCE 6: not one of the 23 may still be a laptop path.
  select count(*) into v_rows
    from treasury.data_sources ds join lp_pair p on p.old = ds.base_url;
  if v_rows <> 0 then
    raise exception '% row(s) still hold a repaired laptop path', v_rows;
  end if;

  -- FENCE 7: ⚠⚠ AND THE BLAST RADIUS. 51 distinct laptop paths existed; this
  -- repairs 23 and must leave EXACTLY 28 -- the four publishers that refuse
  -- every automated client. A different number means this touched rows it was
  -- never shown.
  select count(distinct base_url) into v_laptop_after
    from treasury.data_sources
   where base_url like 'file://%' or base_url like 'local:%';
  if v_laptop_before <> 51 or v_laptop_after <> 28 then
    raise exception 'laptop paths went % -> %, expected 51 -> 28', v_laptop_before, v_laptop_after;
  end if;

  -- FENCE 8: every newly cited budget must now have BOTH halves, or the API
  -- still serves no chip and this bought the reader nothing.
  select count(*) into v_rows
    from treasury.budgets b join lp_pair p on p.new = b.source_url
   where b.source_date is null or b.data_source is null;
  if v_rows <> 0 then
    raise exception '% newly cited budget(s) would still render no source chip', v_rows;
  end if;

  raise notice 'laptop paths % -> %; % data_sources row(s) repointed; % budget(s) newly cited',
    v_laptop_before, v_laptop_after, v_expected_dsrows, v_budgets;
end $$;
