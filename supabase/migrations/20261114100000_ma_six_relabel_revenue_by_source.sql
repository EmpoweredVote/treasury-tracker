-- The six MA rows that are not General Fund, told truthfully.
--
-- 20261114090000 proved what these are: stale `scrapeMaDLS.js` Revenue-by-
-- Source rows in a General Fund family, carrying a category literally named
-- "Enterprise & CPA Funds". Four of the ten it found have since been filed and
-- were replaced with Schedule A. THESE SIX HAVE NOT, so there is no General
-- Fund figure to adopt and #397 left them alone pending a decision.
--
-- ⭐⭐ THE DECISION WAS TO RELABEL RATHER THAN DELETE, AND IT IS THE RIGHT ONE:
-- nothing is wrong with these numbers. They are real figures the Division of
-- Local Services publishes. The only thing wrong was the label on them, which
-- claimed a fund scope they never had.
--
-- ⚠⚠ ALL THREE CLAIMS MOVE TOGETHER. Fixing one alone leaves the row
-- contradicting itself — a row whose scope says all_funds under a label that
-- says General Fund is no more honest than before:
--
--   fund_scope    general_fund → all_funds
--   data_source   "… MA DLS General Fund Revenue by Source"
--                   → "… MA DLS Revenue by Source (Total Receipts)"
--   source_url    null → the Revenue-by-Source report itself
--
-- ⭐ `all_funds` is the honest bucket of the five the check constraint allows.
-- Total Receipts includes Enterprise & CPA Funds; enterprise funds are
-- proprietary, so this is neither general_fund nor total_governmental.
--
-- ⭐⭐⭐ THE CITATION WAS TIED BEFORE IT WAS WRITTEN — 6 of 6, and not on the
-- total alone but on the components that make it, read from the publisher on
-- 2026-11-14:
--
--   Hudson  FY2024  64,003,333 + 17,700,392 + 8,814,873 + 4,887,874 + 12,115,271 = 107,521,743 ✅
--   Hudson  FY2025  66,774,365 + 18,868,011 + 8,538,475 + 8,977,748 + 13,397,491 = 116,556,090 ✅
--   Holyoke FY2025  66,903,986 + 117,641,534 + 12,369,520 + 3,866,855 + 9,723,112 = 210,505,007 ✅
--   Florida FY2025   3,091,393 + 897,663 + 384,386 + 374,000 + 0                 =   4,747,442 ✅
--   Gill    FY2025   3,381,699 + 352,934 + 311,900 + 414,864 + 0                 =   4,461,397 ✅
--   Gosnold FY2025     852,130 + 40,711 + 772,657 + 279,134 + 184,088            =   2,128,720 ✅
--
-- ⚠ THE TIE MATTERED MORE THAN USUAL HERE. The DLS Gateway answers HTTP 200
-- to a report name that does not exist, so a liveness probe of these URLs
-- proves nothing whatever — the figures are the only evidence that the URL is
-- the right one. ⚠ Florida is the familiar one-dollar artifact: the report
-- PRINTS 4,747,443 while its own five components sum to 4,747,442, and TT
-- stores the component sum so the drill-down adds up. Same choice as
-- extractBend.py's source_rounding and acfrGF.py's component-sum rule.
--
-- ⛔ WHAT THIS DOES NOT FIX. The other 1,749 rows in the old family keep a
-- label that names the wrong report too: they are Schedule A figures under
-- "Revenue by Source". That is wrong in a different direction — their SCOPE is
-- right and their REPORT name is not — and renaming 1,749 rows is a bigger job
-- than this one, needing the three registry axes to move with it.

do $$
declare
  v_before bigint;
  v_bad    bigint;
  v_after  bigint;
begin
  -- ── FENCE 1: ⚠⚠ exactly the six, and each must still be what 20261114090000
  -- left behind — a general_fund row with a "Tax Levy" category and no link.
  select count(*) into v_before
    from treasury.budgets b
   where b.id in ('2276a007-2df4-465e-bde8-ec8ab5cf507d', '0cb10407-9cb6-4394-a0ac-62d4baa10366', 'f53b61c1-9a33-4291-be6d-1ff56cf4d65e', 'cebfae31-8843-4d96-a0b8-8249667bda2c', 'ed238af5-6695-4e81-82ed-0bca6314e9d1', '2363031c-7373-4fa2-a7a3-f872670950da')
     and b.fund_scope = 'general_fund'
     and b.source_url is null
     and exists (select 1 from treasury.budget_categories c
                  where c.budget_id = b.id and c.name = 'Tax Levy');
  if v_before <> 6 then
    raise exception 'expected 6 unfiled Revenue-by-Source rows, found %', v_before;
  end if;

  -- ⚠ And their totals must be the ones the tie above was run against. A row
  -- reloaded since would make every figure in this file a statement about
  -- something that is no longer there.
  select count(*) into v_bad from (values
    ('2276a007-2df4-465e-bde8-ec8ab5cf507d'::uuid, 107521743::numeric),
    ('0cb10407-9cb6-4394-a0ac-62d4baa10366'::uuid, 116556090::numeric),
    ('f53b61c1-9a33-4291-be6d-1ff56cf4d65e'::uuid, 210505007::numeric),
    ('cebfae31-8843-4d96-a0b8-8249667bda2c'::uuid, 4747442::numeric),
    ('ed238af5-6695-4e81-82ed-0bca6314e9d1'::uuid, 4461397::numeric),
    ('2363031c-7373-4fa2-a7a3-f872670950da'::uuid, 2128720::numeric)
  ) as want(id, total)
  join treasury.budgets b on b.id = want.id
  where b.total_budget <> want.total;
  if v_bad > 0 then
    raise exception '% of the six no longer hold the total they were tied on', v_bad;
  end if;

  update treasury.budgets
     set fund_scope  = 'all_funds',
         data_source = 'Hudson — MA DLS Revenue by Source (Total Receipts)',
         source_url  = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=RevenueBySource.RBS.RevbySource2&rdSubReport=True&rdResizeFrame=True&iclMuni2=Hudson&iclYear2=2024'
   where id = '2276a007-2df4-465e-bde8-ec8ab5cf507d';

  update treasury.budgets
     set fund_scope  = 'all_funds',
         data_source = 'Hudson — MA DLS Revenue by Source (Total Receipts)',
         source_url  = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=RevenueBySource.RBS.RevbySource2&rdSubReport=True&rdResizeFrame=True&iclMuni2=Hudson&iclYear2=2025'
   where id = '0cb10407-9cb6-4394-a0ac-62d4baa10366';

  update treasury.budgets
     set fund_scope  = 'all_funds',
         data_source = 'Holyoke — MA DLS Revenue by Source (Total Receipts)',
         source_url  = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=RevenueBySource.RBS.RevbySource2&rdSubReport=True&rdResizeFrame=True&iclMuni2=Holyoke&iclYear2=2025'
   where id = 'f53b61c1-9a33-4291-be6d-1ff56cf4d65e';

  update treasury.budgets
     set fund_scope  = 'all_funds',
         data_source = 'Florida — MA DLS Revenue by Source (Total Receipts)',
         source_url  = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=RevenueBySource.RBS.RevbySource2&rdSubReport=True&rdResizeFrame=True&iclMuni2=Florida&iclYear2=2025'
   where id = 'cebfae31-8843-4d96-a0b8-8249667bda2c';

  update treasury.budgets
     set fund_scope  = 'all_funds',
         data_source = 'Gill — MA DLS Revenue by Source (Total Receipts)',
         source_url  = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=RevenueBySource.RBS.RevbySource2&rdSubReport=True&rdResizeFrame=True&iclMuni2=Gill&iclYear2=2025'
   where id = 'ed238af5-6695-4e81-82ed-0bca6314e9d1';

  update treasury.budgets
     set fund_scope  = 'all_funds',
         data_source = 'Gosnold — MA DLS Revenue by Source (Total Receipts)',
         source_url  = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=RevenueBySource.RBS.RevbySource2&rdSubReport=True&rdResizeFrame=True&iclMuni2=Gosnold&iclYear2=2025'
   where id = '2363031c-7373-4fa2-a7a3-f872670950da';

  -- ── FENCE 2: ⭐ all six must now be all_funds, cited, and relabelled.
  select count(*) into v_after
    from treasury.budgets
   where id in ('2276a007-2df4-465e-bde8-ec8ab5cf507d', '0cb10407-9cb6-4394-a0ac-62d4baa10366', 'f53b61c1-9a33-4291-be6d-1ff56cf4d65e', 'cebfae31-8843-4d96-a0b8-8249667bda2c', 'ed238af5-6695-4e81-82ed-0bca6314e9d1', '2363031c-7373-4fa2-a7a3-f872670950da')
     and fund_scope = 'all_funds'
     and source_url like 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=RevenueBySource.RBS.RevbySource2%'
     and data_source like '%MA DLS Revenue by Source (Total Receipts)';
  if v_after <> 6 then
    raise exception 'expected 6 relabelled rows, found %', v_after;
  end if;

  -- ── FENCE 3: ⛔⛔ NOT ONE ROW MAY STILL CLAIM GENERAL FUND WHILE HOLDING AN
  -- ENTERPRISE CATEGORY. This is the defect itself, stated as a rule, and it
  -- is checked across the WHOLE fleet rather than these six — if it is true
  -- anywhere else, this migration fixed an instance and missed the class.
  select count(*) into v_bad
    from treasury.budgets b
   where b.fund_scope = 'general_fund'
     and exists (select 1 from treasury.budget_categories c
                  where c.budget_id = b.id and c.name = 'Enterprise & CPA Funds');
  if v_bad > 0 then
    raise exception '% general_fund budget(s) still carry an Enterprise & CPA Funds category', v_bad;
  end if;

  -- ── FENCE 4: ⚠ the old family keeps its other 1,749 rows, all still cited.
  select count(*) into v_after
    from treasury.budgets
   where data_source like '%MA DLS General Fund Revenue by Source';
  if v_after <> 1749 then
    raise exception 'expected 1,749 rows left in the old family, found %', v_after;
  end if;

  select count(*) into v_bad
    from treasury.budgets
   where data_source like '%MA DLS General Fund Revenue by Source'
     and source_url is null;
  if v_bad > 0 then
    raise exception '% rows left uncited in the old family', v_bad;
  end if;

  raise notice 'relabelled 6 MA budget(s) to Revenue by Source (Total Receipts), all_funds, cited';
end $$;
