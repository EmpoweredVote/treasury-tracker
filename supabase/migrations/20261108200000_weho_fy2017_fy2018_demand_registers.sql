-- West Hollywood: two published demand registers TT never knew existed.
--
-- ⚠⚠⚠ ASK THE HOST WHAT IT HAS EVER SERVED. TT held eight WeHo demand
-- registers. `data.weho.org/api/catalog/v1?q=demand%20register` returns TEN.
-- The two extra files are not new; they have been published the whole time and
-- nothing in TT ever looked. A coverage figure measures a DECLARATION, not a
-- publisher.
--
--     jaed-p39k   titled "FY 2016-17"   20,470 rows
--     cz69-a684   titled "FY 2017-18"   20,570 rows
--
-- ── WHICH YEAR EACH FILE ACTUALLY COVERS ───────────────────────────────
--
-- ⚠⚠ THE FILE TITLES ARE NOT THE YEARS — the rule 20261105130000 established.
-- Every row's `date` was parsed and binned on a July-June fiscal year before
-- either file was given a year:
--
--     jaed-p39k   FY2014 5 | FY2015 88 | FY2016 1,248 | FY2017 18,840 (92.0%) | FY2018 288
--     cz69-a684   FY2015 15 | FY2016 29 | FY2017 148 | FY2018 20,099 (97.7%) | FY2019 278
--
-- So jaed-p39k is a FY2017 file and cz69-a684 is a FY2018 file. Here the
-- titles happen to agree with the data, which is NOT a reason to trust the
-- next one: "FY2022-24" is a FY2024 file.
--
-- ⭐⭐ cz69-a684 COVERS FY2018 — THE YEAR 20261105130000 RETIRED. That
-- migration deleted the WeHo FY2018 budget because "NO published file covers
-- it", and against the eight files then registered that was true. It is not
-- true of the catalog. FY2018 had been serving readers a fabricated $0,
-- produced by a mapping that read a column its dataset did not have; it now
-- carries $126,384,123.60 over 20,570 published rows, verified against the
-- publisher. The earlier deletion was still right: a sourced figure replaces a
-- fabricated one, it does not excuse it.
--
-- ⚠⚠ THESE TWO FILES USE DIFFERENT COLUMN NAMES FROM THE OTHER EIGHT, and
-- getting this wrong is exactly what fabricated the old FY2018 zero:
--
--     the other eight      these two
--     check_date           date
--     amt_paid             amount_paid
--     invoice_description  description
--     invoice_number       inv_no
--     check_status         status
--
-- `po_num` exists on cz69-a684 and NOT on jaed-p39k, so only the former maps
-- it. Mapping a column a dataset lacks yields silent nulls, or silent zeroes
-- where money should be.
--
-- ⚠ `skip_fy_filter` is true because neither file carries a fiscal_year
-- column. That makes a SINGLE declared year mandatory — the edge function's
-- assertSingleYearWhenSkippingFyFilter refuses two, which is what stopped
-- "FY2022-24" refreshing for months.
--
-- ⚠ EACH FILE CARRIES ONE ROW PUBLISHED EMPTY: no category, no amount_paid.
-- Loaded as published and flagged, per the Milledgeville rule. It takes no
-- link_key, so it becomes no root and moves no money, and `verify:txn-trees`
-- reports it rather than hiding it.
--
-- Verified against the publisher's own `$group=category`, not TT's copy:
--
--     FY2017   21 categories   $114,707,826.85   delta $0.00
--     FY2018   20 categories   $126,384,123.60   delta $0.00
--
-- West Hollywood is now TEN consecutive years, FY2017-FY2026, one source each.
insert into treasury.data_sources (
  municipality_id, name, description, api_type, base_url, dataset_id,
  dataset_type, column_mapping, fiscal_year_start_month, fiscal_years,
  default_filters, is_enabled, sync_frequency, priority
) values
(
  'e9892544-4251-4c2e-b3de-5a99080563a7',
  'West Hollywood Demand Register FY2016-17',
  'West Hollywood demand register, published file titled FY 2016-17. Bound to FY2017: 18,840 of 20,470 rows (92.0%) fall in July 2016-June 2017.',
  'socrata', 'https://data.weho.org', 'jaed-p39k', 'transactions',
  jsonb_build_object(
    'date_column', 'date',
    'amount_column', 'amount_paid',
    'vendor_column', 'vendor_name',
    'vendor_id_column', 'vendor_code',
    'description_column', 'description',
    'invoice_number_column', 'inv_no',
    'payment_method_column', 'status',
    'expense_category_column', 'category',
    'source_row_id_column', ':id',
    'skip_fy_filter', true
  ),
  7, array[2017], '{}'::jsonb, true, 'manual', 5
),
(
  'e9892544-4251-4c2e-b3de-5a99080563a7',
  'West Hollywood Demand Register FY2017-18',
  'West Hollywood demand register, published file titled FY 2017-18. Bound to FY2018: 20,099 of 20,570 rows (97.7%) fall in July 2017-June 2018.',
  'socrata', 'https://data.weho.org', 'cz69-a684', 'transactions',
  jsonb_build_object(
    'date_column', 'date',
    'amount_column', 'amount_paid',
    'vendor_column', 'vendor_name',
    'vendor_id_column', 'vendor_code',
    'description_column', 'description',
    'invoice_number_column', 'inv_no',
    'payment_method_column', 'status',
    'expense_category_column', 'category',
    'po_number_column', 'po_num',
    'source_row_id_column', ':id',
    'skip_fy_filter', true
  ),
  7, array[2018], '{}'::jsonb, true, 'manual', 5
);

-- ⚠ Guards the two things that silently break this family: more than one
-- declared year (the edge function then refuses the source outright) and a
-- mapping copied from the other eight files' column names.
do $$
declare n int;
begin
  select count(*) into n from treasury.data_sources
   where name in ('West Hollywood Demand Register FY2016-17',
                  'West Hollywood Demand Register FY2017-18')
     and array_length(fiscal_years, 1) = 1
     and column_mapping->>'amount_column' = 'amount_paid'
     and column_mapping->>'date_column' = 'date';
  if n <> 2 then
    raise exception 'expected 2 correctly mapped WeHo sources, found %', n;
  end if;
end $$;
