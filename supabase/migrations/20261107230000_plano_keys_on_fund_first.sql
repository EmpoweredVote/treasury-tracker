-- Plano keys its rows on the FUND first, so it can have a breakdown at all.
--
-- ⚠⚠⚠ WHY THE ORDER IS THE WHOLE ISSUE. The drill-down matches only a LEADING
-- `|` segment, so whichever column comes first in a link key is the ONLY axis a
-- reader can ever be given for that source. The loaders hardcoded
-- `[department, fund, expense_category]`, which put Plano's COST CENTRE first —
-- and Plano's cost-centre names arrive machine-truncated at 25 characters:
--
--     UTILITYMAINTADMINISTRATIO      SOLIDWASTECOLLECTIONS
--
-- That is the same defect that removed Plano's vendor axis in #340, where the
-- publisher truncates payee names to five characters ("MO MI"). Its FUND names
-- are clean and publishable — `Water & Sewer`, `G.O. Debt Service`,
-- `Equipment Maintenance`, 62-69 of them a year — but fund was segment two, so
-- a fund root was not a prefix the API could match and Plano had no usable
-- breakdown at all.
--
-- `link_key_columns` is read by scripts/lib/publisherIds.mjs (and mirrored in
-- the edge function). Absent means the historical order, so this changes Plano
-- and nothing else.
--
-- ⚠⚠ THIS RE-KEYS EVERY PLANO ROW, and a link key is the definition of "the
-- same row" for the dedup index. The six years must be reloaded with
-- `--force-reload` in the same change, and their trees built afterwards.
--
-- ⚠ Safe to re-key because Plano is NOT on cron: every one of its 1,497
-- sync_logs rows is `triggered_by = 'bulk_load'`. Nothing will silently
-- rewrite these keys back.
update treasury.data_sources
   set column_mapping = column_mapping || jsonb_build_object(
         'link_key_columns', jsonb_build_array('fund_column', 'department_column'))
 where name like 'Plano Check Register FY%';

do $$
declare n int;
begin
  select count(*) into n from treasury.data_sources
   where name like 'Plano Check Register FY%'
     and column_mapping -> 'link_key_columns' = jsonb_build_array('fund_column', 'department_column');
  if n <> 6 then
    raise exception 'expected 6 Plano check registers to carry link_key_columns, got %', n;
  end if;
end $$;
