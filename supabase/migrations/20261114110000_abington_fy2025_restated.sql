-- Abington FY2025 expenditures: the publisher restated, TT had not.
--
-- ⭐⭐⭐ THIS IS THE WHOLE OF "REFRESH THE MA WORKBOOKS". It was opened as a
-- maintenance job on 48 dated files; measured 2026-11-14, the drift is ONE
-- CELL. The other 16,825 MA rows are already verified against the live
-- publisher — 16,819 by the Schedule A figure tie in verify:source-urls and 6
-- by the Revenue-by-Source tie in 20261114100000 — and DLS has not published
-- FY2026 yet (sampled Abington/Boston/Brockton/Holyoke: rows returned, every
-- figure 0), so there is no missing year either.
--
-- ⚠ ONLY AN UNCITED ROW CAN DRIFT UNSEEN, which is why this one did. The tie
-- runs over CITED rows; Abington was left uncited by 20261113140000 precisely
-- because it did not tie, so it is the one MA row the gate never re-checks.
-- One uncited row, one restatement — the same row.
--
-- ⭐ TT WAS NEVER WRONG. docs/MA/GenFundExpenditures2025.xlsx says, to the
-- dollar, exactly what TT stored: Other Expenditures 0, Debt Service
-- 5,086,436, Total 69,061,344. The publisher has since moved 6,566 out of Debt
-- Service into its own column and the total fell by $1:
--
--                            workbook (and TT)      publisher, 2026-11-14
--     Other Expenditures                     0                      6,566
--     Debt Service                   5,086,436                  5,079,869
--     Total Expenditures            69,061,344                 69,061,343
--
-- The other eight categories are identical in both. Read FRESH from the
-- publisher before this was written: the ten components sum to 69,061,343
-- exactly, so the restated figures are internally consistent.
--
-- ⚠⚠ THE WORKBOOK IS STILL THE PRE-RESTATEMENT SNAPSHOT, and this migration
-- cannot change that — mass.gov answers 403 to every automated client, so a
-- genuine re-download needs a person with a browser. A future
-- `loadMaGFExcel.js --fy 2025` would therefore REVERT this row. That warning
-- lives next to the call in the loader, where someone about to run it will see
-- it, rather than only here.

do $$
declare
  v_bad bigint;
begin
  -- ── FENCE 1: ⚠⚠ this must still be the row the workbook wrote — uncited,
  -- 9 categories, no "Other Expenditures", and the workbook's own total. If
  -- any of that has moved, the figures below describe something else.
  select count(*) into v_bad
    from treasury.budgets b
   where b.id = 'a05ab7d9-00ed-4461-a85d-a53c4de1ee96'
     and b.total_budget = 69061344
     and b.source_url is null
     and (select count(*) from treasury.budget_categories c where c.budget_id = b.id) = 9
     and not exists (select 1 from treasury.budget_categories c
                      where c.budget_id = b.id and c.name = 'Other Expenditures');
  if v_bad <> 1 then
    raise exception 'Abington FY2025 is not in the pre-restatement state this migration was written against';
  end if;

  delete from treasury.budget_categories where budget_id = 'a05ab7d9-00ed-4461-a85d-a53c4de1ee96';
  insert into treasury.budget_categories
    (budget_id, parent_id, name, amount, percentage, item_count, sort_order, depth, actual_amount, link_key)
  values
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Education', 33038062, 47.83871926730414259055, 1, 0, 0, 0, 'education'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Fixed Costs', 11231674, 16.26332983417365696255, 1, 1, 0, 0, 'fixed costs'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Public Safety', 9963797, 14.42745907793887027992, 1, 2, 0, 0, 'public safety'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Debt Service', 5079869, 7.35558965310014301053, 1, 3, 0, 0, 'debt service'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Public Works', 3968025, 5.74565281766964730537, 1, 4, 0, 0, 'public works'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'General Government', 2809429, 4.06801964450647890459, 1, 5, 0, 0, 'general government'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Intergov Assessments', 1391428, 2.01477112890781784316, 1, 6, 0, 0, 'intergov assessments'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Culture and Recreation', 860829, 1.24647011280970887448, 1, 7, 0, 0, 'culture and recreation'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Human Services', 711664, 1.03048097399438054467, 1, 8, 0, 0, 'human services'),
    ('a05ab7d9-00ed-4461-a85d-a53c4de1ee96', null, 'Other Expenditures', 6566, 0.00950748959515600525, 1, 9, 0, 0, 'other expenditures');

  update treasury.budgets
     set total_budget = 69061343,
         source_url   = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund&iclMuni=001&islYear=2025&islAmountType=Expenditures'
   where id = 'a05ab7d9-00ed-4461-a85d-a53c4de1ee96';

  -- ── FENCE 2: ⭐ the tree must sum to the total, with the restated split.
  select count(*) into v_bad
    from treasury.budgets b
   where b.id = 'a05ab7d9-00ed-4461-a85d-a53c4de1ee96'
     and (b.total_budget <> (select coalesce(sum(c.amount), -1) from treasury.budget_categories c where c.budget_id = b.id)
          or b.total_budget <> 69061343
          or b.source_url is null);
  if v_bad > 0 then
    raise exception 'Abington FY2025 did not land on the restated figure';
  end if;

  select count(*) into v_bad
    from treasury.budget_categories
   where budget_id = 'a05ab7d9-00ed-4461-a85d-a53c4de1ee96' and name = 'Other Expenditures' and amount = 6566;
  if v_bad <> 1 then
    raise exception 'the restated Other Expenditures column is missing';
  end if;

  -- ── FENCE 3: ⚠⚠ AND NOW NO MA ROW IS UNCITED AT ALL. Abington was the last
  -- one; if this does not hold, something else lost its link while this ran.
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

  raise notice 'Abington FY2025 restated: 69,061,344 -> 69,061,343, 9 categories -> 10, cited';
end $$;
