-- Brockton, Hopedale and Orange FY2025 expenditures: three late filings, cited.
--
-- ⭐⭐⭐ THESE ROWS DID NOT EXIST UNTIL TODAY, AND ONLY A REFRESHED WORKBOOK
-- COULD HAVE FOUND THEM. docs/MA/GenFundExpenditures2025.xlsx was captured
-- before these three municipalities filed Schedule A; the workbook printed 0
-- for them, loadMaGFExcel.js skips a zero row rather than writing one, and TT
-- therefore held NO General Fund expenditure row at all for them. Brockton is
-- one of the largest cities in the Commonwealth and its FY2025 expenditures —
-- $569,559,551 — were simply absent.
--
-- ⚠ The gap was invisible to every gate TT has. The figure tie checks stored
-- rows against the publisher; it cannot miss a row that was never stored. A
-- refreshed source file is the only thing that surfaces an absence.
--
-- ⭐ TIED BEFORE CITED, 3 of 3, against a fresh read of the publisher's own
-- crosstab on 2026-11-14 — and each one's ten categories sum to its total
-- exactly:
--
--     Brockton  (044)   569,559,551
--     Hopedale  (138)    31,947,362
--     Orange    (223)    28,125,112
--
-- ⚠⚠ THE LOADER CANNOT CITE WHAT IT WRITES — `treasury_sync_budget_tree` takes
-- no `p_source_url` — so a newly loaded year always arrives linkless and the
-- uncited ratchet would read these three as a family that GREW. This is the
-- targeted UPDATE the loader's own docblock prescribes, in the shape
-- `maDlsUrl()` builds.

do $$
declare
  v_bad bigint;
begin
  -- ── FENCE 1: ⚠⚠ exactly three uncited FY2025 MA expenditure rows, and they
  -- must be the three this migration was written against, at the tied totals.
  select count(*) into v_bad from (values
    ('Brockton'::text, 569559551::numeric, '044'::text),
    ('Hopedale',        31947362,          '138'),
    ('Orange',          28125112,          '223')
  ) as want(name, total, dor)
  join treasury.municipalities m on m.name = want.name and m.state = 'MA'
  join treasury.budgets b on b.municipality_id = m.id
   and b.fiscal_year = 2025 and b.dataset_type = 'operating'
   and b.data_source like '%MA General Fund Expenditures'
  where b.total_budget = want.total and b.source_url is null;
  if v_bad <> 3 then
    raise exception 'expected 3 uncited late filings at the tied totals, found %', v_bad;
  end if;

  select count(*) into v_bad
    from treasury.budgets
   where data_source like '%MA General Fund Expenditures'
     and fiscal_year = 2025 and source_url is null;
  if v_bad <> 3 then
    raise exception 'expected exactly 3 uncited FY2025 MA expenditure rows, found %', v_bad;
  end if;

  update treasury.budgets b
     set source_url = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund'
                      || '&iclMuni=' || want.dor || '&islYear=2025&islAmountType=Expenditures'
    from (values
      ('Brockton'::text, '044'::text),
      ('Hopedale',       '138'),
      ('Orange',         '223')
    ) as want(name, dor)
    join treasury.municipalities m on m.name = want.name and m.state = 'MA'
   where b.municipality_id = m.id
     and b.fiscal_year = 2025 and b.dataset_type = 'operating'
     and b.data_source like '%MA General Fund Expenditures'
     and b.source_url is null;

  -- ── FENCE 2: ⭐ NO MA ROW MAY CITE NOTHING. This is what 20261114110000
  -- achieved and what a new year quietly undoes; it is asserted over the whole
  -- MA estate rather than the three, so a forgotten row anywhere fails here.
  select count(*) into v_bad
    from treasury.budgets
   where (data_source like '%MA General Fund Expenditures'
       or data_source like '%MA General Fund Revenues'
       or data_source like '%MA DLS General Fund Revenue by Source'
       or data_source like '%MA DLS Revenue by Source (Total Receipts)')
     and source_url is null;
  if v_bad > 0 then
    raise exception '% MA budget(s) still cite nothing', v_bad;
  end if;

  -- ── FENCE 3: ⚠ every citation written here must match the Schedule A shape.
  select count(*) into v_bad
    from treasury.budgets
   where data_source like '%MA General Fund Expenditures' and fiscal_year = 2025
     and source_url !~ '^https://dls-gw\.dor\.state\.ma\.us/reports/rdPage\.aspx\?rdReport=ScheduleA\.GeneralFund&iclMuni=[0-9]{3}&islYear=2025&islAmountType=Expenditures$';
  if v_bad > 0 then
    raise exception '% FY2025 citation(s) are malformed', v_bad;
  end if;

  -- ⚠ And the year must now hold 346 rows: 343 that were already there plus
  -- the three late filings. Five municipalities still have not filed.
  select count(*) into v_bad
    from treasury.budgets
   where data_source like '%MA General Fund Expenditures' and fiscal_year = 2025;
  if v_bad <> 346 then
    raise exception 'expected 346 FY2025 MA expenditure rows, found %', v_bad;
  end if;

  raise notice 'cited 3 late FY2025 filings: Brockton, Hopedale, Orange';
end $$;
