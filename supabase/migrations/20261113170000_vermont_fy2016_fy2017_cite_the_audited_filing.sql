-- Vermont FY2016 and FY2017: the two the Auditor does not host.
--
-- 20261113160000 repaired six of the eight dead Vermont citations to
-- auditor.vermont.gov and left these two, because the Auditor's ACFR series
-- runs 1998-2015 and then restarts at 2018 — 2016 and 2017 fall in the gap,
-- and its index page links FY2016 to the same dead finance.vermont.gov URL.
--
-- ⭐⭐ THE FEDERAL AUDIT CLEARINGHOUSE HAS THEM, AND ITS PDF ENDPOINT TAKES NO
-- KEY. Every Single Audit reporting package filed under the Uniform Guidance
-- is served at app.fac.gov/dissemination/report/pdf/<report_id>, free and
-- unauthenticated, back to FY2016 — which is exactly as far back as this needs
-- to reach. The package is the State of Vermont's OWN filing, made under
-- federal penalty, and it contains the audited financial statements.
--
--   STATE OF VERMONT  2016-06-CENSUS-0000175300  fy_end 2016-06-30
--   STATE OF VERMONT  2017-06-CENSUS-0000175300  fy_end 2017-06-30
--
-- ⭐⭐⭐ BOTH WERE TAKEN TO THE TOP OF THE VERIFICATION LADDER, like the six:
--
--   FY    bytes      pages  cover    GF expenditures    GF revenues
--   2016  4,963,708   455    ok       803,696,532  ok  1,430,388,220  ok
--   2017  4,826,986   411    ok       896,218,729  ok  1,454,702,163  ok
--
-- 4 of 4 budgets tie to a figure printed inside the document now cited.
--
-- ⚠ IT IS A REPORTING PACKAGE, NOT THE ACFR AS VERMONT PUBLISHED IT — 455
-- pages against the ACFR's ~256, because the Single Audit schedules travel
-- with it. The figures are the same and are the state's own audited ones; a
-- reader gets more document than they asked for, not a different one.
--
-- ⛔⛔ THE ALTERNATIVE WAS CHECKED AND DELIBERATELY NOT TAKEN. The Internet
-- Archive holds full captures of Vermont's own files and they verify too —
-- 20240624210637 (5,439,090 B, 256 pages) and 20250218192204 (5,809,440 B,
-- 267 pages), both complete, right cover, both figures present. They are the
-- better-shaped document and the worse citation: web.archive.org answered 429
-- to every fetch for the first two attempts and only served on the third,
-- four minutes apart, because its limiter is cumulative, IP-wide and drains
-- only on silence (reference_source_url_gate). A live, keyless, permanent
-- endpoint beats an archive of a dead one. ⭐ Recorded here so that if FAC
-- ever moves, the next session knows these captures exist AND have been
-- verified, rather than starting from a re-survey.

do $$
declare
  v_before   bigint;
  v_updated  bigint;
  v_left     bigint;
  v_bad      bigint;
  v_expected bigint := 4;
begin
  create temporary table vt_fac_moves (old_url text primary key, new_url text not null)
    on commit drop;
  insert into vt_fac_moves (old_url, new_url) values
    ('https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2016_CAFR_FINAL.pdf',
     'https://app.fac.gov/dissemination/report/pdf/2016-06-CENSUS-0000175300'),
    ('https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2017_CAFR_FINAL.pdf',
     'https://app.fac.gov/dissemination/report/pdf/2017-06-CENSUS-0000175300');

  -- ── FENCE 1: exactly the four budgets 20261113160000 left behind.
  select count(*) into v_before
    from treasury.budgets b join vt_fac_moves m on m.old_url = b.source_url;
  if v_before <> v_expected then
    raise exception 'expected % unrepaired Vermont budget(s), found %', v_expected, v_before;
  end if;

  select count(*) into v_bad
    from (select m.old_url, count(b.id) as n
            from vt_fac_moves m
            left join treasury.budgets b on b.source_url = m.old_url
           group by m.old_url) t
   where t.n <> 2;
  if v_bad > 0 then
    raise exception '% of the two URLs does not carry exactly 2 budgets', v_bad;
  end if;

  update treasury.budgets b
     set source_url = m.new_url
    from vt_fac_moves m
   where b.source_url = m.old_url;
  get diagnostics v_updated = row_count;

  if v_updated <> v_expected then
    raise exception 'wrote % citation(s), expected %', v_updated, v_expected;
  end if;

  -- ── FENCE 2: ⚠⚠ NOTHING may still cite finance.vermont.gov's CAFR folder.
  -- FY2015 lives in that folder and is LIVE, so this is scoped to the two
  -- repaired names rather than to the folder — a blanket check would demand
  -- the repair of a citation that works.
  select count(*) into v_left
    from treasury.budgets b join vt_fac_moves m on m.old_url = b.source_url;
  if v_left > 0 then
    raise exception '% budget(s) still cite a dead Vermont URL', v_left;
  end if;

  -- ── FENCE 3: ⭐ the whole Vermont family must now be reachable, and every
  -- citation must be a PDF on one of the three hosts that actually serve one.
  select count(*) into v_bad
    from treasury.budgets
   where data_source like 'Vermont State ACFR%'
     and source_url !~ '^https://(auditor|finance)\.vermont\.gov/sites/(auditor|finance)/files/documents/[^ ]+\.pdf$'
     and source_url !~ '^https://app\.fac\.gov/dissemination/report/pdf/[0-9]{4}-[0-9]{2}-CENSUS-[0-9]+$';
  if v_bad > 0 then
    raise exception '% Vermont citation(s) are on no host known to serve them', v_bad;
  end if;

  -- ⚠ All 22 rows, all 11 years, must still be here. A repair that loses a row
  -- is worse than the dead link it fixed.
  select count(*) into v_left from treasury.budgets where data_source like 'Vermont State ACFR%';
  if v_left <> 22 then
    raise exception 'expected 22 Vermont budget(s), found %', v_left;
  end if;

  raise notice 'cited % Vermont budget(s) to the Federal Audit Clearinghouse', v_updated;
end $$;
