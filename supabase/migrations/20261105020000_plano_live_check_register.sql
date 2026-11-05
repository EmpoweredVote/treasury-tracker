-- Plano's check registers move from a local file drop to the city's own URL.
--
-- ⚠⚠ WHAT THEY WERE. Six `file://C:/Transparent Motivations/Data Drop/...`
-- paths -- files on ONE person's machine. Nobody else could refresh them, no
-- gate could re-fetch them, and `source_url` pointed at nothing a reader could
-- open. A transparency tool citing a path on a laptop is citing nothing.
--
-- ⭐⭐ WHAT THEY ARE NOW. checkregister.plano.gov exports CSV from a PLAIN GET:
--
--   ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=..&ED=..
--
-- No session, no cookies, no __VIEWSTATE. The site LOOKS like an ASP.NET
-- postback app -- and the "Export to Excel" control is not a postback at all,
-- it is a `window.open` to the URL above. Finding that turned a scraping
-- project into a one-line base_url change.
--
--   ET=AP      Accounts Payable (the only expense type the export serves)
--   Detail=T   transactions; A/C/F/P give account, cost-centre, fund and payee
--              summaries instead
--   A/C/F/P=-1 no filter
--
-- ⭐ PROVEN EQUIVALENT to the drop, not assumed. FY2023 fetched live against
-- `PlanoFinancialReport 2023.csv`: 29,632 rows and $400,087,000.57 on BOTH
-- sides, and the row multisets are identical -- only the order differs. The
-- drop came from this endpoint.
--
-- ⚠⚠ THE PAYEE IS STILL TRUNCATED, and this is what settles it. The live
-- export returns `PayeeName` as "HOME " -- five characters -- so the 5-char
-- field recorded in 20261105010000 is the CITY'S OWN limitation, not an
-- artifact of the data drop. There is no fuller source behind it: the payee
-- summary (Detail=P) truncates identically and the on-screen drill-down shows
-- no longer name. Plano's vendor axis stays off, now for a proven reason.
--
-- ⚠ The loader had to stop choosing its parser by URL suffix. This URL ends in
-- a query string, and `endsWith('.csv')` would have handed CSV to the XLSX
-- parser; it now sniffs the zip magic bytes instead.
--
-- ⚠⚠⚠ SD AND ED ARE EXCLUSIVE. Every range below is the fiscal year WIDENED BY
-- ONE DAY AT EACH END -- FY2022 is SD=9/30/2021 ED=10/1/2022, not 10/1 to 9/30.
--
-- This is the trap in the whole endpoint, and it is silent. A first attempt
-- used the obvious inclusive dates and lost 1,349 rows worth $4,695,756.53
-- from FY2022 alone -- every one of them dated exactly 10/1/2021 or 9/30/2022,
-- the first and last day of the year. It would have looked like the city had
-- revised its data.
--
-- Proven directly, not inferred: SD=9/30/2021&ED=10/2/2021 returns ONLY rows
-- dated 10/1/2021, and SD=ED=10/1/2021 returns NOTHING AT ALL. The app's own
-- UI agrees -- entering 10/01-10/03 builds a URL reading SD=9/30&ED=10/4.
--
-- ⚠ FY2023 and FY2025 matched the drop under BOTH readings, because their
-- boundary days happened to carry no payments. Two years agreeing is not
-- evidence the bounds are inclusive; it is a coincidence that would have
-- hidden this.

update treasury.data_sources
   set base_url = 'https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=9/30/2019&ED=10/1/2020'
 where name = 'Plano Check Register FY2020';

update treasury.data_sources
   set base_url = 'https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=9/30/2020&ED=10/1/2021'
 where name = 'Plano Check Register FY2021';

update treasury.data_sources
   set base_url = 'https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=9/30/2021&ED=10/1/2022'
 where name = 'Plano Check Register FY2022';

update treasury.data_sources
   set base_url = 'https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=9/30/2022&ED=10/1/2023'
 where name = 'Plano Check Register FY2023';

update treasury.data_sources
   set base_url = 'https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=9/30/2023&ED=10/1/2024'
 where name = 'Plano Check Register FY2024';

update treasury.data_sources
   set base_url = 'https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=9/30/2024&ED=10/1/2025'
 where name = 'Plano Check Register FY2025';
