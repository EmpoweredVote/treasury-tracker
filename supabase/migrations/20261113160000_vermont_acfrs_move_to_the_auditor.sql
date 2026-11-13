-- Vermont's state ACFRs: eight citations the publisher's own page still links
-- to and no longer serves.
--
-- ⚠⚠⚠ THE DIAGNOSIS IS "MOVED", AND THE HOST-ROOT TEST IS WHAT SAYS SO.
-- verify:source-urls reported 8 dead citations over 16 budgets on 2026-11-13,
-- all finance.vermont.gov, FY2016-FY2023. #373's test separates a publisher
-- that is DOWN from a document that MOVED:
--     finance.vermont.gov/                            200  42,514 B
--     finance.vermont.gov/reports-and-publications    200  37,963 B
--     …/Rpts_Pubs/CAFR/FIN-2016_CAFR_FINAL.pdf        404
-- The host is up, so this is a repair, not an outage declaration.
--
-- ⚠⚠ AND IT IS NOT A FOLDER MOVE EITHER. TT holds eleven Vermont ACFR URLs
-- across two folders and the survivors are scattered through both: FY2015
-- (3,750,384 B), FY2024 and FY2025 all still serve, while eight files are gone
-- from inside the same two folders. Guessed replacements all 404.
--
-- ⛔⛔ AND THE PUBLISHER'S OWN INDEX STILL LINKS TO ALL EIGHT DEAD FILES. TT's
-- citations were never wrong: they are the addresses Vermont publishes, and
-- Vermont has lost the files behind eight of them. The page can be the stale
-- thing.
--
-- ⭐⭐ THE REPAIR: auditor.vermont.gov publishes the same ACFR series — the
-- body that audits and signs them, so first-party, not a mirror. Corroborated
-- on a year nobody needed repaired: the Auditor's 2015_CAFR.pdf is 3,750,384
-- bytes, the SAME SIZE as Finance's live FIN-2015_CAFR_FINAL.pdf.
--
-- ⭐⭐⭐ EVERY ONE WAS TAKEN TO THE TOP OF THE VERIFICATION LADDER — downloaded,
-- checked for a complete PDF trailer, read for the fiscal year on the cover,
-- and searched for BOTH figures TT stores:
--   FY    bytes      pages  cover    GF expenditures    GF revenues
--   2018  5,930,500   277    ok       926,931,860  ok  1,551,378,929  ok
--   2019  5,756,360   281    ok     1,023,627,442  ok  1,632,556,268  ok
--   2020  4,441,354   287    ok       994,638,981  ok  1,569,802,827  ok
--   2021  5,281,432   291    ok     1,045,477,912  ok  1,894,179,158  ok
--   2022  4,809,948   303    ok     1,467,335,595  ok  2,180,020,790  ok
--   2023  4,254,789   305    ok     1,452,737,080  ok  2,267,178,350  ok
-- 12 of 12 budgets tie to a figure printed inside the document now cited.
--
-- ⛔ FY2016 AND FY2017 ARE NOT REPAIRED HERE. The Auditor's series runs
-- 1998-2015 then restarts at 2018. The Internet Archive holds full captures of
-- both, but a capture cannot be cited on CDX metadata alone — the figures have
-- to be read out of it, and web.archive.org is answering 429 to every fetch.
-- Those two stay dead and keep failing the gate until the document is read.

do $$
declare
  v_before   bigint;
  v_updated  bigint;
  v_left     bigint;
  v_bad      bigint;
  v_expected bigint := 12;
begin
  create temporary table vt_acfr_moves (old_url text primary key, new_url text not null)
    on commit drop;
  insert into vt_acfr_moves (old_url, new_url) values
    ('https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2018_CAFR_FINAL.pdf',
     'https://auditor.vermont.gov/sites/auditor/files/documents/CAFR%20-%202018.pdf'),
    ('https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/2019_CAFR_FINAL.pdf',
     'https://auditor.vermont.gov/sites/auditor/files/documents/Vermont%20CAFR%20-%202019.pdf'),
    ('https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/VERMONT_2020_CAFR_FINAL.pdf',
     'https://auditor.vermont.gov/sites/auditor/files/documents/Vermont%20CAFR%20-%202020.pdf'),
    ('https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/VERMONT_2021_ACFR_FINAL.pdf',
     'https://auditor.vermont.gov/sites/auditor/files/documents/VERMONT_2021_ACFR_FINAL.pdf'),
    ('https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2022_ACFR_FINAL.pdf',
     'https://auditor.vermont.gov/sites/auditor/files/documents/VERMONT_2022_ACFR_FINAL.pdf'),
    ('https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2023_ACFR_FINAL.pdf',
     'https://auditor.vermont.gov/sites/auditor/files/documents/VERMONT_2023_ACFR_FINAL.pdf');

  -- ── FENCE 1: ⚠⚠ the population must be what was measured. Each old URL
  -- carries exactly TWO budgets — the General Fund expenditure row and the
  -- revenue row for that year, both read from the same document.
  select count(*) into v_before
    from treasury.budgets b join vt_acfr_moves m on m.old_url = b.source_url;
  if v_before <> v_expected then
    raise exception 'expected % Vermont budget(s) on the six dead URLs, found %', v_expected, v_before;
  end if;

  select count(*) into v_bad
    from (select m.old_url, count(b.id) as n
            from vt_acfr_moves m
            left join treasury.budgets b on b.source_url = m.old_url
           group by m.old_url) t
   where t.n <> 2;
  if v_bad > 0 then
    raise exception '% of the six URLs does not carry exactly 2 budgets', v_bad;
  end if;

  -- ⚠ FY2015, FY2024 and FY2025 are LIVE on finance.vermont.gov and are not
  -- touched. A repair that moved a working citation would be a regression
  -- dressed as a fix.
  update treasury.budgets b
     set source_url = m.new_url
    from vt_acfr_moves m
   where b.source_url = m.old_url;
  get diagnostics v_updated = row_count;

  if v_updated <> v_expected then
    raise exception 'wrote % citation(s), expected %', v_updated, v_expected;
  end if;

  -- ── FENCE 2: none of the six old URLs may survive anywhere.
  select count(*) into v_left
    from treasury.budgets b join vt_acfr_moves m on m.old_url = b.source_url;
  if v_left > 0 then
    raise exception '% budget(s) still cite a dead Vermont URL', v_left;
  end if;

  -- ── FENCE 3: ⚠ the two Vermont years that are NOT repaired must still be
  -- here. Silence is how a repair quietly swallows the rows it could not fix.
  select count(*) into v_left
    from treasury.budgets
   where source_url in (
     'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2016_CAFR_FINAL.pdf',
     'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2017_CAFR_FINAL.pdf');
  if v_left <> 4 then
    raise exception 'expected FY2016 and FY2017 to keep their 4 unrepaired citations, found %', v_left;
  end if;

  -- ── FENCE 4: every Vermont citation must be a .pdf on a vermont.gov
  -- documents path.
  select count(*) into v_bad
    from treasury.budgets
   where data_source like 'Vermont State ACFR%'
     and source_url !~ '^https://(auditor|finance)\.vermont\.gov/sites/(auditor|finance)/files/documents/[^ ]+\.pdf$';
  if v_bad > 0 then
    raise exception '% Vermont citation(s) are not a .pdf on a vermont.gov documents path', v_bad;
  end if;

  raise notice 'moved % Vermont citation(s) to the Auditor of Accounts', v_updated;
end $$;
