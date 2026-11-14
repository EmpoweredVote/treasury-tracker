-- The four MA rows the publisher has since filed.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ⛔⛔⛔ THE DIAGNOSIS IN #392 WAS WRONG, AND THE RIGHT ONE IS WORSE
-- ══════════════════════════════════════════════════════════════════════════
--
-- #392 left eleven MA budgets uncited and recorded the reason as "the
-- publisher no longer prints their figure". Measured 2026-11-13, that is not
-- what happened to the ten revenue rows. They are not Schedule A figures at
-- all.
--
-- ⚠⚠⚠ THEY ARE A DIFFERENT REPORT, AT A DIFFERENT FUND SCOPE. Their stored
-- category trees are Tax Levy / State Aid / Local Receipts / All Other /
-- **Enterprise & CPA Funds** — the column list of scrapeMaDLS.js's
-- `RevenueBySource.RBS.RevbySource2`, whose total column is **Total
-- Receipts**. Every other row in the family carries Schedule A's columns
-- (Taxes, State Revenue, Licenses and Permits, …). A category literally named
-- "Enterprise & CPA Funds" cannot belong to a row stamped
-- `fund_scope = 'general_fund'`: enterprise funds are by definition not it.
--
--   MEASURED ACROSS THE FAMILY — the defect is exactly these ten rows:
--     FY2021  350 Schedule A    0 Revenue-by-Source
--     FY2022  349 Schedule A    0
--     FY2023  350 Schedule A    0
--     FY2024  348 Schedule A    2   ← Hudson, Holyoke
--     FY2025  342 Schedule A    8   ← Hudson, Holyoke, Florida, Gill,
--                                     Gosnold, Brockton, Hopedale, Orange
--
-- ⭐⭐ AND TT'S OWN SOURCE FILES EXPLAIN WHY THEY SURVIVED. docs/MA/
-- GenFundRevenues2024.xlsx and 2025.xlsx print **0** for all ten — those
-- municipalities had not filed Schedule A when the workbooks were downloaded.
-- loadMaGFExcel.js skips a zero row rather than writing one (the family holds
-- 1,755 rows and not one zero), so it had nothing to overwrite the older
-- portal scrape with, and the scrape's Total Receipts figure stayed.
--
-- ⭐⭐⭐ FOUR OF THE TEN HAVE SINCE BEEN FILED, so Schedule A now prints a real
-- General Fund figure for them and this migration adopts it — total AND tree,
-- because a figure owns its categories and replacing one without the other
-- would leave a General Fund total explained by enterprise-fund categories.
-- Each total below was re-read from the publisher's own crosstab on
-- 2026-11-13 and equals the sum of the categories written with it.
--
-- ⛔ THE OTHER SIX ARE NOT TOUCHED HERE. Schedule A still prints zeros for
-- Hudson FY2024/FY2025, Holyoke FY2025, Florida FY2025, Gill FY2025 and
-- Gosnold FY2025 — they still have not filed. There is no General Fund figure
-- to adopt, and writing 0 would publish "this town collected nothing", which
-- is a different and worse falsehood than the one being fixed. They keep their
-- wrong-scope figure, stay uncited, and are named in the baseline until a
-- person decides what to do with them.
--
-- ⛔ ABINGTON FY2025 EXPENDITURES IS NOT TOUCHED EITHER, and it is not the
-- same defect. TT stores 69,061,344 in nine categories and that is EXACTLY
-- what docs/MA/GenFundExpenditures2025.xlsx says, to the dollar, including
-- Other Expenditures = 0 and Debt Service = 5,086,436. The live page now says
-- Debt Service 5,079,869 + Other Expenditures 6,566, total 69,061,343: the
-- publisher RESTATED after the workbook was downloaded. TT is a faithful
-- transcription of a dated snapshot, which is a maintenance question (refresh
-- the workbook) and not a defect to patch by hand.
--
-- ⚠ PROVENANCE OF THIS FILE. It was applied comment-stripped, so unlike
-- 20261113140000/160000/170000 its md5 does NOT match the statement recorded
-- in supabase_migrations.schema_migrations (version 20261114031316). What was
-- checked instead is stronger than "close enough": with every SQL comment and
-- all whitespace removed, the committed file and the statement that actually
-- ran are the SAME 8,865 characters, md5 35b95bc1d975fcce99cefb0801579865.
-- The difference is narrative only.
--
-- ⭐ VERIFIED AFTER APPLYING, against a FRESH read of the publisher rather
-- than the numbers typed below: 4/4 budgets tie on the total AND on every one
-- of their categories (8, 7, 8 and 9 respectively), each tree sums to its own
-- total, and all four now carry a Schedule A citation.

do $$
declare
  v_before  bigint;
  v_rbs     bigint;
  v_after   bigint;
  v_bad     bigint;
begin
  -- ── FENCE 1: ⚠⚠ exactly the four rows this migration was written against,
  -- and each must STILL be a Revenue-by-Source row. "Tax Levy" is the marker:
  -- no Schedule A row has that column. If the loader has already replaced one
  -- of them, stop — the figures below were read against the old state.
  select count(*) into v_before
    from treasury.budgets
   where id in ('5808bdc6-f747-4aef-a18d-138c88a967c2', 'b10848b7-afb7-49e0-a6db-359f831d1cda', 'a2bee9b6-a672-47d4-a252-4780e161dc10', '8f036b08-359d-41a2-aeb9-e4d967b69647');
  if v_before <> 4 then
    raise exception 'expected the 4 named budgets, found %', v_before;
  end if;

  select count(*) into v_rbs
    from treasury.budgets b
   where b.id in ('5808bdc6-f747-4aef-a18d-138c88a967c2', 'b10848b7-afb7-49e0-a6db-359f831d1cda', 'a2bee9b6-a672-47d4-a252-4780e161dc10', '8f036b08-359d-41a2-aeb9-e4d967b69647')
     and exists (select 1 from treasury.budget_categories c
                  where c.budget_id = b.id and c.name = 'Tax Levy');
  if v_rbs <> 4 then
    raise exception 'expected 4 Revenue-by-Source rows (a "Tax Levy" category), found %', v_rbs;
  end if;

  -- ── Holyoke FY2024 — Revenue by Source 205,834,091 (Total Receipts, incl. Enterprise & CPA)
  --    becomes Schedule A 190,436,046 (General Fund), 8 categories.
  delete from treasury.budget_categories where budget_id = '5808bdc6-f747-4aef-a18d-138c88a967c2';
  insert into treasury.budget_categories
    (budget_id, parent_id, name, amount, percentage, item_count, sort_order, depth, actual_amount, link_key)
  values
    ('5808bdc6-f747-4aef-a18d-138c88a967c2', null, 'State Revenue', 113611297, 59.65850446191262790308, 1, 0, 0, 0, 'state revenue'),
    ('5808bdc6-f747-4aef-a18d-138c88a967c2', null, 'Taxes', 69159604, 36.31644609970530979126, 1, 1, 0, 0, 'taxes'),
    ('5808bdc6-f747-4aef-a18d-138c88a967c2', null, 'Federal Revenue', 3180000, 1.66985193548914589989, 1, 2, 0, 0, 'federal revenue'),
    ('5808bdc6-f747-4aef-a18d-138c88a967c2', null, 'Service Charges', 1487680, 0.78119664383285924991, 1, 3, 0, 0, 'service charges'),
    ('5808bdc6-f747-4aef-a18d-138c88a967c2', null, 'Miscellaneous', 1199799, 0.63002725859998165436, 1, 4, 0, 0, 'miscellaneous'),
    ('5808bdc6-f747-4aef-a18d-138c88a967c2', null, 'Transfers', 829472, 0.43556459894152599333, 1, 5, 0, 0, 'transfers'),
    ('5808bdc6-f747-4aef-a18d-138c88a967c2', null, 'Licenses and Permits', 684062, 0.35920825619326290923, 1, 6, 0, 0, 'licenses and permits'),
    ('5808bdc6-f747-4aef-a18d-138c88a967c2', null, 'Revenue from Other Governments', 284132, 0.14920074532528362909, 1, 7, 0, 0, 'revenue from other governments');
  update treasury.budgets
     set total_budget = 190436046,
         source_url   = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund&iclMuni=137&islYear=2024&islAmountType=Revenues'
   where id = '5808bdc6-f747-4aef-a18d-138c88a967c2';

  -- ── Brockton FY2025 — Revenue by Source 602,895,995 (Total Receipts, incl. Enterprise & CPA)
  --    becomes Schedule A 515,466,068 (General Fund), 7 categories.
  delete from treasury.budget_categories where budget_id = 'b10848b7-afb7-49e0-a6db-359f831d1cda';
  insert into treasury.budget_categories
    (budget_id, parent_id, name, amount, percentage, item_count, sort_order, depth, actual_amount, link_key)
  values
    ('b10848b7-afb7-49e0-a6db-359f831d1cda', null, 'State Revenue', 290219318, 56.30231280325516962648, 1, 0, 0, 0, 'state revenue'),
    ('b10848b7-afb7-49e0-a6db-359f831d1cda', null, 'Taxes', 196442008, 38.10959056183694571018, 1, 1, 0, 0, 'taxes'),
    ('b10848b7-afb7-49e0-a6db-359f831d1cda', null, 'Transfers', 13151846, 2.55144747956523110233, 1, 2, 0, 0, 'transfers'),
    ('b10848b7-afb7-49e0-a6db-359f831d1cda', null, 'Miscellaneous', 8091290, 1.56970371132169250750, 1, 3, 0, 0, 'miscellaneous'),
    ('b10848b7-afb7-49e0-a6db-359f831d1cda', null, 'Licenses and Permits', 5803421, 1.12585897700641668351, 1, 4, 0, 0, 'licenses and permits'),
    ('b10848b7-afb7-49e0-a6db-359f831d1cda', null, 'Service Charges', 1755390, 0.34054423927667731853, 1, 5, 0, 0, 'service charges'),
    ('b10848b7-afb7-49e0-a6db-359f831d1cda', null, 'Revenue from Other Governments', 2795, 0.00054222773786925587, 1, 6, 0, 0, 'revenue from other governments');
  update treasury.budgets
     set total_budget = 515466068,
         source_url   = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund&iclMuni=044&islYear=2025&islAmountType=Revenues'
   where id = 'b10848b7-afb7-49e0-a6db-359f831d1cda';

  -- ── Hopedale FY2025 — Revenue by Source 36,518,862 (Total Receipts, incl. Enterprise & CPA)
  --    becomes Schedule A 31,212,766 (General Fund), 8 categories.
  delete from treasury.budget_categories where budget_id = 'a2bee9b6-a672-47d4-a252-4780e161dc10';
  insert into treasury.budget_categories
    (budget_id, parent_id, name, amount, percentage, item_count, sort_order, depth, actual_amount, link_key)
  values
    ('a2bee9b6-a672-47d4-a252-4780e161dc10', null, 'Taxes', 22453006, 71.93532928161509687470, 1, 0, 0, 0, 'taxes'),
    ('a2bee9b6-a672-47d4-a252-4780e161dc10', null, 'State Revenue', 7414767, 23.75555886331893873376, 1, 1, 0, 0, 'state revenue'),
    ('a2bee9b6-a672-47d4-a252-4780e161dc10', null, 'Transfers', 643200, 2.06069529371411697127, 1, 2, 0, 0, 'transfers'),
    ('a2bee9b6-a672-47d4-a252-4780e161dc10', null, 'Miscellaneous', 377838, 1.21052392473002878859, 1, 3, 0, 0, 'miscellaneous'),
    ('a2bee9b6-a672-47d4-a252-4780e161dc10', null, 'Licenses and Permits', 241868, 0.77490088510579291370, 1, 4, 0, 0, 'licenses and permits'),
    ('a2bee9b6-a672-47d4-a252-4780e161dc10', null, 'Service Charges', 46974, 0.15049611431425205521, 1, 5, 0, 0, 'service charges'),
    ('a2bee9b6-a672-47d4-a252-4780e161dc10', null, 'Fines and Forfeitures', 32988, 0.10568752541828557723, 1, 6, 0, 0, 'fines and forfeitures'),
    ('a2bee9b6-a672-47d4-a252-4780e161dc10', null, 'Revenue from Other Governments', 2125, 0.00680811178349269037, 1, 7, 0, 0, 'revenue from other governments');
  update treasury.budgets
     set total_budget = 31212766,
         source_url   = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund&iclMuni=138&islYear=2025&islAmountType=Revenues'
   where id = 'a2bee9b6-a672-47d4-a252-4780e161dc10';

  -- ── Orange FY2025 — Revenue by Source 31,458,942 (Total Receipts, incl. Enterprise & CPA)
  --    becomes Schedule A 28,416,765 (General Fund), 9 categories.
  delete from treasury.budget_categories where budget_id = '8f036b08-359d-41a2-aeb9-e4d967b69647';
  insert into treasury.budget_categories
    (budget_id, parent_id, name, amount, percentage, item_count, sort_order, depth, actual_amount, link_key)
  values
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'Taxes', 16385379, 57.66095824067236463861, 1, 0, 0, 0, 'taxes'),
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'State Revenue', 9263150, 32.59748250724528162436, 1, 1, 0, 0, 'state revenue'),
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'Service Charges', 1423497, 5.00935627260879279277, 1, 2, 0, 0, 'service charges'),
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'Miscellaneous', 636240, 2.23895999421468294699, 1, 3, 0, 0, 'miscellaneous'),
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'Transfers', 386220, 1.35912726167105946118, 1, 4, 0, 0, 'transfers'),
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'Licenses and Permits', 311863, 1.09746130497261029646, 1, 5, 0, 0, 'licenses and permits'),
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'Revenue from Other Governments', 7807, 0.02747321871437512567, 1, 6, 0, 0, 'revenue from other governments'),
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'Special Assessments', 1923, 0.00676713200816489793, 1, 7, 0, 0, 'special assessments'),
    ('8f036b08-359d-41a2-aeb9-e4d967b69647', null, 'Fines and Forfeitures', 686, 0.00241406789266828932, 1, 8, 0, 0, 'fines and forfeitures');
  update treasury.budgets
     set total_budget = 28416765,
         source_url   = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund&iclMuni=223&islYear=2025&islAmountType=Revenues'
   where id = '8f036b08-359d-41a2-aeb9-e4d967b69647';

  -- ── FENCE 2: ⭐ every repaired total must equal the sum of its own new
  -- categories. This is the whole point of replacing the tree with the figure.
  select count(*) into v_bad
    from treasury.budgets b
   where b.id in ('5808bdc6-f747-4aef-a18d-138c88a967c2', 'b10848b7-afb7-49e0-a6db-359f831d1cda', 'a2bee9b6-a672-47d4-a252-4780e161dc10', '8f036b08-359d-41a2-aeb9-e4d967b69647')
     and b.total_budget <> (select coalesce(sum(c.amount), -1)
                              from treasury.budget_categories c where c.budget_id = b.id);
  if v_bad > 0 then
    raise exception '% repaired budget(s) do not equal the sum of their categories', v_bad;
  end if;

  -- ── FENCE 3: ⛔ not one of the four may still carry a Revenue-by-Source
  -- category. A half-replaced tree is the defect wearing the repair's clothes.
  select count(*) into v_bad
    from treasury.budget_categories c
   where c.budget_id in ('5808bdc6-f747-4aef-a18d-138c88a967c2', 'b10848b7-afb7-49e0-a6db-359f831d1cda', 'a2bee9b6-a672-47d4-a252-4780e161dc10', '8f036b08-359d-41a2-aeb9-e4d967b69647')
     and c.name in ('Tax Levy', 'State Aid', 'Local Receipts', 'All Other', 'Enterprise & CPA Funds');
  if v_bad > 0 then
    raise exception '% Revenue-by-Source category(ies) survived the repair', v_bad;
  end if;

  -- ── FENCE 4: ⚠⚠ THE SIX UNFILED ROWS MUST BE UNTOUCHED. A migration that
  -- quietly widened its own scope is how six towns would get a $0 revenue.
  select count(*) into v_after
    from treasury.budgets b
   where b.data_source like '%MA DLS General Fund Revenue by Source%'
     and exists (select 1 from treasury.budget_categories c
                  where c.budget_id = b.id and c.name = 'Tax Levy');
  if v_after <> 6 then
    raise exception 'expected exactly 6 Revenue-by-Source rows left, found %', v_after;
  end if;

  select count(*) into v_bad
    from treasury.budgets b
   where b.data_source like '%MA DLS General Fund Revenue by Source%'
     and b.source_url is null;
  if v_bad <> 6 then
    raise exception 'expected exactly 6 uncited rows left in the family, found %', v_bad;
  end if;

  -- ⚠ And the family must still hold every row it held before.
  select count(*) into v_after
    from treasury.budgets
   where data_source like '%MA DLS General Fund Revenue by Source%';
  if v_after <> 1755 then
    raise exception 'expected 1,755 rows in the family, found %', v_after;
  end if;

  raise notice 'repaired 4 MA budget(s) from Revenue-by-Source to Schedule A';
end $$;
